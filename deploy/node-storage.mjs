// 植迹自托管适配器 · 存储层
//
// Cloudflare 版把数据放在两个绑定上：BUCKET（R2 对象存储）和 DB（D1，SQLite）。
// 这个文件用 Node 内置模块把两者在本地复刻出来，接口按 Worker 代码实际调用到
// 的那一小块语义实现，不引入任何 npm 依赖：
//
//   BUCKET.get(key)                -> {httpEtag, size, text(), json(), arrayBuffer()} | null
//   BUCKET.put(key, value, opts)   -> {key, httpEtag, size} | null（只有 onlyIf 不满足时才 null）
//   BUCKET.delete(key)             -> undefined
//   BUCKET.head(key)               -> {key, httpEtag, size} | null（兼容用，当前 Worker 不调用）
//
//   DB.prepare(sql).bind(...args).first() / .all() / .run()
//
// 关键约定（与 R2 / D1 保持一致，改这里之前先看 server/*.mjs 怎么用）：
//
// 1. `httpEtag` 是带引号的 32 位小写十六进制。客户端把它当作花园/账号的版本号，
//    server/account.mjs 用 /^(new|"[a-f0-9]{32}")$/ 校验，所以格式不能随便改。
//    etag 由内容哈希得出，因此进程重启后同一个对象仍然是同一个版本。
// 2. put 的条件写：`If-None-Match: *` = 只在对象不存在时写入（注册、首次保存花园）；
//    `If-Match: <etag>` = 只在当前 etag 相等时写入（账号迁移、花园并发保存）。
//    条件不满足返回 null，调用方据此返回 409。同一个 key 的「读-判断-写」在进程内
//    用队列串行化，否则两个并发请求可能都通过 If-Match 检查。
// 3. DB 的 SQL 用 `?` 占位符。D1 返回 {results} / {meta:{changes}}，这里照抄。
//
// 数据布局（FLORA_DATA_DIR，默认 ./flora-data）：
//   <dataDir>/objects/<按 key 分层的安全文件名>   花园、账号、会话、配额
//   <dataDir>/flora.sqlite                        SQLite 库（好友关系）
// 备份这两个东西就够了，见 deploy/README.md。

import {createHash, randomUUID} from 'node:crypto';
import {mkdirSync, readFileSync} from 'node:fs';
import {mkdir, readFile, rename, rm, unlink, writeFile} from 'node:fs/promises';
import {dirname, join, resolve, sep} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const defaultSchemaPath = join(here, 'schema.sql');
const DEFAULT_DATA_DIR = './flora-data';
// 单个对象的硬上限。花园请求体是 16 MiB，这里留一倍余量兜住异常调用。
const DEFAULT_MAX_OBJECT_BYTES = 32 * 1024 * 1024;

const etagOf = bytes => '"' + createHash('sha256').update(bytes).digest('hex').slice(0, 32) + '"';

// ---- key -> 文件名 ---------------------------------------------------------
// 对象 key 形如 `auth/names/<sha256>`、`gardens/v1/<uuid>.json`，用 `/` 分层。
// 逐段 encodeURIComponent 后仍要处理三件 Windows 会咬人的事：
//   · `.` 不编码，而 `..`、结尾的点在 Win32 上会被规范化 —— 把点统一写成 %2E；
//   · CON/PRN/AUX/NUL/COM1/LPT1 是设备名 —— 加 `%_` 前缀，`%_` 不可能是正常转义；
//   · 单段过长会顶到文件名长度上限 —— 退化成 `%` + sha256，同样不会与转义结果撞车
//     （encodeURIComponent 只会产出大写十六进制的 %XX）。
// 因此映射是单射的：不同 key 不会落到同一个文件，key 也不会逃出 dataDir。
const windowsReserved = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const MAX_SEGMENT_LENGTH = 110;

function safeSegment(segment) {
  if (segment === '') return '%%';
  let name = encodeURIComponent(segment).replace(/\./g, '%2E');
  if (windowsReserved.test(name)) name = '%_' + name;
  if (name.length > MAX_SEGMENT_LENGTH) name = '%' + createHash('sha256').update(segment, 'utf8').digest('hex');
  return name;
}

function objectPath(objectsDir, key) {
  const path = join(objectsDir, ...String(key).split('/').map(safeSegment));
  // 逐段转义后本来就不可能带分隔符，这里再做一次断言，防止以后改 key 规则时出岔子。
  if (!resolve(path).startsWith(resolve(objectsDir) + sep)) throw new Error('对象 key 非法：' + key);
  return path;
}

// ---- 值归一化 --------------------------------------------------------------
async function toBytes(value) {
  if (typeof value === 'string') return Buffer.from(value, 'utf8');
  if (value instanceof Uint8Array) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  if (value && typeof value.arrayBuffer === 'function') return Buffer.from(await value.arrayBuffer());
  if (value && typeof value.getReader === 'function') {
    const chunks = [];
    for await (const chunk of value) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }
  throw new TypeError('BUCKET.put 只接受 string / Uint8Array / ArrayBuffer / Blob / ReadableStream');
}

// Headers 和普通对象都要能读；`Headers` 的大小写不敏感由它自己保证。
function headerValue(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === 'function') return headers.get(name) ?? null;
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === name.toLowerCase()) {
      const value = headers[key];
      return value == null ? null : String(value);
    }
  }
  return null;
}

const etagList = value => value.split(',').map(part => part.trim()).filter(Boolean);

// R2 的 put onlyIf 只用到这几条；两条都写时以 If-Match 为准。
function preconditionHolds(onlyIf, currentEtag) {
  const ifMatch = headerValue(onlyIf, 'if-match');
  if (ifMatch != null) {
    if (ifMatch.trim() === '*') return currentEtag !== null;
    return currentEtag !== null && etagList(ifMatch).includes(currentEtag);
  }
  const ifNoneMatch = headerValue(onlyIf, 'if-none-match');
  if (ifNoneMatch != null) {
    if (ifNoneMatch.trim() === '*') return currentEtag === null;
    return currentEtag === null || !etagList(ifNoneMatch).includes(currentEtag);
  }
  return true;
}

// ---- 同一 key 的条件写串行化 ----------------------------------------------
// 单进程里 fs 操作是异步的，两个请求可能同时读到旧 etag 再都写入。
// 用一条 Promise 链把同一 key 的 put/delete 排队，保证「读-判断-写」不被插队。
const keyLocks = new Map();

function withKeyLock(key, work) {
  const previous = keyLocks.get(key) || Promise.resolve();
  const current = previous.then(work, work);
  const guard = current.catch(() => {});
  keyLocks.set(key, guard);
  guard.then(() => {
    if (keyLocks.get(key) === guard) keyLocks.delete(key);
  });
  return current;
}

async function readMaybe(path) {
  try {
    const bytes = await readFile(path);
    return {bytes, etag: etagOf(bytes)};
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

export function createBucket({dataDir = DEFAULT_DATA_DIR, maxBytes = DEFAULT_MAX_OBJECT_BYTES} = {}) {
  const root = resolve(dataDir);
  const objectsDir = join(root, 'objects');
  // 先建目录，让「数据目录写不进去」在启动阶段就报错，而不是等第一个用户注册。
  mkdirSync(objectsDir, {recursive: true});

  return {
    root,
    objectsDir,

    // R2 的 get：不存在返回 null，存在返回带 httpEtag 的对象。
    async get(key) {
      const current = await readMaybe(objectPath(objectsDir, key));
      if (!current) return null;
      const text = () => Promise.resolve(current.bytes.toString('utf8'));
      return {
        key: String(key),
        httpEtag: current.etag,
        size: current.bytes.byteLength,
        text,
        async json() {
          return JSON.parse(current.bytes.toString('utf8'));
        },
        async arrayBuffer() {
          const {buffer, byteOffset, byteLength} = current.bytes;
          return buffer.slice(byteOffset, byteOffset + byteLength);
        },
      };
    },

    // 当前 Worker 没用到 head（只在已删除的代码里出现过），保留给运维脚本/调试。
    async head(key) {
      const current = await readMaybe(objectPath(objectsDir, key));
      return current ? {key: String(key), httpEtag: current.etag, size: current.bytes.byteLength} : null;
    },

    async put(key, value, options = {}) {
      const bytes = await toBytes(value);
      if (bytes.byteLength > maxBytes) throw new Error('对象超过 ' + maxBytes + ' 字节上限：' + key);
      const path = objectPath(objectsDir, key);
      return withKeyLock(String(key), async () => {
        const current = await readMaybe(path);
        if (!preconditionHolds(options.onlyIf, current?.etag ?? null)) return null;
        await mkdir(dirname(path), {recursive: true});
        // 先写临时文件再 rename：读方永远看不到半个 JSON，进程被杀也不会留破损对象。
        const temp = path + '.tmp-' + process.pid + '-' + randomUUID();
        await writeFile(temp, bytes);
        try {
          await rename(temp, path);
        } catch (error) {
          await rm(temp, {force: true});
          throw error;
        }
        const httpEtag = etagOf(bytes);
        return {
          key: String(key),
          httpEtag,
          size: bytes.byteLength,
          httpMetadata: options.httpMetadata,
          uploaded: new Date(),
        };
      });
    },

    async delete(key) {
      const path = objectPath(objectsDir, key);
      return withKeyLock(String(key), async () => {
        try {
          await unlink(path);
        } catch (error) {
          if (error?.code !== 'ENOENT') throw error;
        }
      });
    },
  };
}

// ---- DB：node:sqlite 版 D1 -------------------------------------------------
// D1 的 bind 只接受 SQLite 认识的基本类型；`undefined` / `boolean` 会被拒绝，
// 所以统一归一化，免得调用方漏传参数时抛出的错误看起来像 SQL 语法问题。
function bindValue(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') return value;
  throw new TypeError('DB.bind 不支持的值类型：' + Object.prototype.toString.call(value));
}

function statementFor(db, statements, sql) {
  let prepared = statements.get(sql);
  if (!prepared) {
    prepared = db.prepare(sql);
    statements.set(sql, prepared);
  }
  return prepared;
}

function createStatement(db, statements, sql) {
  // 与 D1 一样，bind 返回新语句，原语句可复用；这里只是把参数挂上去。
  const make = args => ({
    bind: (...next) => make(next),
    async first(column) {
      const row = statementFor(db, statements, sql).get(...args.map(bindValue));
      if (row == null) return null;
      return column === undefined ? row : row[column] ?? null;
    },
    async all() {
      const results = statementFor(db, statements, sql).all(...args.map(bindValue));
      return {results, success: true, meta: {changes: 0, rows_read: results.length}};
    },
    async run() {
      const info = statementFor(db, statements, sql).run(...args.map(bindValue));
      const changes = Number(info?.changes ?? 0);
      return {
        results: [],
        success: true,
        meta: {changes, rows_written: changes, last_row_id: Number(info?.lastInsertRowid ?? 0)},
      };
    },
  });
  return make([]);
}

export function createDatabase({sqlitePath, schemaPath = defaultSchemaPath} = {}) {
  if (!sqlitePath) throw new Error('createDatabase 需要 sqlitePath');
  const memory = sqlitePath === ':memory:';
  if (!memory) mkdirSync(dirname(resolve(sqlitePath)), {recursive: true});

  // 同步 API 是 node:sqlite 唯一的形式。这里的查询都是单行/单表小操作，
  // 单进程校园部署足够；真要水平扩展就换 PostgreSQL，而不是在这里上连接池。
  const db = new DatabaseSync(sqlitePath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec('PRAGMA busy_timeout = 5000');
  // schema.sql 全部是 CREATE ... IF NOT EXISTS，重复启动是幂等的。
  db.exec(readFileSync(schemaPath, 'utf8'));

  const statements = new Map();
  let closed = false;
  return {
    prepare: sql => createStatement(db, statements, sql),
    exec: sql => db.exec(sql),
    close() {
      if (closed) return;
      closed = true;
      statements.clear();
      db.close();
    },
    get raw() {
      return db;
    },
  };
}

// ---- 组装 env --------------------------------------------------------------
// 返回的形状直接喂给 Worker 的 fetch(request, env)。只有真正配置了的变量才会出现，
// 未配置时 server/*.mjs 的既有分支会自己降级（识别返回 401/403、株形返回 503）。
const PASSTHROUGH = ['PLANTNET_API_KEY', 'DEEPSEEK_API_KEY', 'PUBLIC_ORIGIN', 'PASSWORD_ROUNDS', 'REGISTER_DAILY_LIMIT'];

export function createEnv({dataDir, sqlitePath, schemaPath, maxObjectBytes} = {}) {
  const resolvedDataDir = resolve(dataDir || process.env.FLORA_DATA_DIR || DEFAULT_DATA_DIR);
  const resolvedSqlitePath = sqlitePath || process.env.FLORA_SQLITE || join(resolvedDataDir, 'flora.sqlite');
  const BUCKET = createBucket({dataDir: resolvedDataDir, maxBytes: maxObjectBytes});
  const DB = createDatabase({sqlitePath: resolvedSqlitePath, schemaPath});

  const env = {BUCKET, DB};
  for (const name of PASSTHROUGH) {
    const value = process.env[name];
    if (value !== undefined && value !== '') env[name] = value;
  }
  // 不在枚举里，避免污染 Worker 看到的 env；运维日志用。
  Object.defineProperty(env, 'info', {
    value: {dataDir: resolvedDataDir, sqlitePath: resolvedSqlitePath, schemaPath: schemaPath || defaultSchemaPath},
    enumerable: false,
  });
  Object.defineProperty(env, 'close', {
    value: () => DB.close(),
    enumerable: false,
  });
  return env;
}
