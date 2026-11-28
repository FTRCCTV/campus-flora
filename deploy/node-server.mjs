// 植迹自托管适配器 · HTTP 服务层
//
// 目标：把已提交的 Worker bundle（dist/server/index.js，自包含 ES Module，
// `export default {fetch(request, env)}`）原样跑在 node:http 上，不做任何改写。
// 因此这个文件只干三件事：
//
//   1. Node IncomingMessage -> Web Request（method/url/headers/body 完整搬运）；
//   2. Response(fetch 返回值, 可能是流) -> Node ServerResponse（状态码/多值
//      Set-Cookie/流式 body）；
//   3. 启动参数、错误兜底、优雅退出、以及反代下的来源地址修复。
//
// 业务逻辑（路由、Cookie、Origin 校验、限流）全部留在 Worker bundle 里，
// 这样线上 Cloudflare 版和自托管版跑的是同一份代码，不会出现两套行为。
//
// 用法：
//   node build.mjs                 # 先生成 dist/server/index.js
//   node deploy/node-server.mjs    # 再启动
//
// 环境变量见 deploy/README.md。默认只监听 127.0.0.1，容器里用 HOST=0.0.0.0。

import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createEnv} from './node-storage.mjs';

// 与花园同步上限一致（server/account.mjs 的 maxBytes）。超过就 413，不把内存吃满。
export const MAX_BODY_BYTES = 16 * 1024 * 1024;

const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade',
]);

// 这些头只在可信反代后面才能用，见 normalizeForwarded()。
const FORWARDED_HEADERS = ['cf-connecting-ip', 'x-real-ip', 'x-forwarded-for', 'x-forwarded-proto', 'x-forwarded-host'];

export function envFlag(value) {
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function normalizeOrigin(value) {
  const raw = String(value || '').split(',')[0].trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return /^https?:$/.test(url.protocol) ? url.origin : '';
  } catch {
    throw new Error('PUBLIC_ORIGIN 不是合法地址：' + raw);
  }
}

// 反代后面，真实访客地址藏在 X-Forwarded-For 里；直接暴露时这些头谁都能伪造。
//   · FLORA_TRUST_PROXY=1：只信任最后一跳（Caddy/nginx 追加的那一项），把它写成
//     x-real-ip 交给 server/auth.mjs 的 clientIp()，并丢掉客户端自带的头；
//   · 未开启：把这些头全部删掉，clientIp() 退回 'unknown'（限流退化为全局共享，
//     但不会被伪造地址绕过）。单层反代是这里的假设，多层请自行扩展。
function normalizeForwarded(headers, rawForwardedFor, trustProxy) {
  for (const name of FORWARDED_HEADERS) headers.delete(name);
  if (!trustProxy) return;
  const chain = String(rawForwardedFor || '')
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
  const client = chain.length ? chain[chain.length - 1] : '';
  if (client) headers.set('x-real-ip', client);
}

// 请求体：超过上限时继续把连接读完（丢弃数据）再回 413，避免半路 destroy 导致
// 客户端只看到连接重置。Content-Length 超限的情况在调用处提前拒绝。
function readBody(req, limit) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolveBody(tooLarge ? null : Buffer.concat(chunks)));
    req.on('error', reject);
    req.on('aborted', () => reject(Object.assign(new Error('客户端中断了请求'), {code: 'E_ABORTED'})));
  });
}

function sendJSON(res, status, payload) {
  if (res.headersSent || res.destroyed) return;
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': body.byteLength,
    'cache-control': 'no-store',
  });
  res.end(body);
}

// Response -> ServerResponse。Set-Cookie 可能有多条，必须走 getSetCookie()，
// 否则 Headers 迭代会把它合并成一行，浏览器只认最后一条。
async function writeResponse(res, response, method) {
  const headers = {};
  for (const [name, value] of response.headers) {
    if (name === 'set-cookie' || HOP_BY_HOP.has(name)) continue;
    headers[name] = value;
  }
  const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  if (cookies.length) headers['set-cookie'] = cookies;

  res.writeHead(response.status, headers);
  if (method === 'HEAD' || !response.body) {
    res.end();
    return;
  }
  for await (const chunk of response.body) {
    if (res.destroyed || res.writableEnded) return;
    if (!res.write(chunk)) await new Promise(done => res.once('drain', done));
  }
  res.end();
}

// 供测试/嵌入使用：把 worker.fetch 接到 node:http 的 handler 上。
export function createHandler({worker, env, origin = '', trustProxy = false, log = false, maxBodyBytes = MAX_BODY_BYTES} = {}) {
  if (!worker || typeof worker.fetch !== 'function') throw new Error('worker.fetch 不存在，请检查 dist/server/index.js');
  if (!env || !env.BUCKET || !env.DB) throw new Error('env 缺少 BUCKET/DB，请用 createEnv()');
  const publicOrigin = normalizeOrigin(origin);

  // 没配 PUBLIC_ORIGIN 时用请求自身的 Host 拼 URL；反代后面是常见情况，
  // 协议优先取 X-Forwarded-Proto（只有信任反代时），否则按 http 处理。
  // 这仍然只是「构造 request.url」，真正的 CSRF 判定在 server/auth.mjs 的
  // sameOrigin()：它要求 Origin 头等于 URL.origin 或 PUBLIC_ORIGIN 之一，
  // 而浏览器控制 Origin 与 Host，攻击页无法伪造两者相等。
  const requestOrigin = req => {
    if (publicOrigin) return publicOrigin;
    const host = req.headers.host;
    if (!host) return 'http://127.0.0.1';
    const forwardedProto = trustProxy ? String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() : '';
    return (forwardedProto === 'https' ? 'https' : 'http') + '://' + host;
  };

  return async function handle(req, res) {
    const started = Date.now();
    let method = 'GET';
    let pathname = '/';
    let status = 500;
    try {
      method = String(req.method || 'GET').toUpperCase();
      const raw = req.url || '/';
      // 不用请求里的 Host 决定 origin：反代后面它与访客看到的地址可能不同，
      // 而 Worker 的 sameOrigin() 要拿 URL.origin 比对 Origin 头。
      const url = new URL(raw.startsWith('/') ? raw : '/' + raw, requestOrigin(req));
      pathname = url.pathname;

      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) {
        if (name === 'host' || HOP_BY_HOP.has(name) || value === undefined) continue;
        if (Array.isArray(value)) for (const item of value) headers.append(name, item);
        else headers.set(name, value);
      }
      normalizeForwarded(headers, req.headers['x-forwarded-for'], trustProxy);

      let body;
      const wantsBody = method !== 'GET' && method !== 'HEAD';
      if (wantsBody) {
        const declared = Number(req.headers['content-length']);
        if (Number.isFinite(declared) && declared > maxBodyBytes) {
          status = 413;
          sendJSON(res, 413, {error: '请求体超过 16 MiB 上限。'});
          req.resume();
          return;
        }
        body = await readBody(req, maxBodyBytes);
        if (body === null) {
          status = 413;
          sendJSON(res, 413, {error: '请求体超过 16 MiB 上限。'});
          return;
        }
      }

      const request = new Request(url, {method, headers, body});
      const response = await worker.fetch(request, env);
      status = response.status;
      await writeResponse(res, response, method);
    } catch (error) {
      status = 500;
      // 只记错误类型与消息，不打印 cookie、请求体或密钥。
      console.error('[植迹] 请求处理失败', method, pathname, error?.stack || error);
      if (!res.headersSent) sendJSON(res, 500, {error: '服务暂时不可用，请稍后再试。'});
      else res.destroy();
    } finally {
      if (log) console.log('[植迹]', method, pathname, status, Date.now() - started + 'ms');
    }
  };
}

async function loadWorker() {
  try {
    return (await import('../dist/server/index.js')).default;
  } catch (error) {
    throw new Error('无法加载 dist/server/index.js，请先在项目根目录运行 `node build.mjs`。原始错误：' + error.message);
  }
}

// 启动服务。返回 {server, env, close()}，close() 会关闭监听并收尾 SQLite。
export async function start(options = {}) {
  const host = options.host ?? process.env.HOST ?? '127.0.0.1';
  const portValue = options.port ?? process.env.PORT ?? '3000';
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT 无效：' + portValue);

  const origin = options.origin ?? process.env.PUBLIC_ORIGIN ?? '';
  const trustProxy = options.trustProxy ?? envFlag(process.env.FLORA_TRUST_PROXY);
  const log = options.log ?? envFlag(process.env.FLORA_LOG);
  const env = options.env ?? createEnv();
  const worker = options.worker ?? await loadWorker();
  const server = createServer(createHandler({worker, env, origin, trustProxy, log}));
  // 识别接口的上游超时是 25s，株形生成 60s；留足够余量但不无限挂着。
  server.headersTimeout = 20_000;
  server.requestTimeout = 180_000;
  server.keepAliveTimeout = 65_000;

  await new Promise((onListen, onError) => {
    server.once('error', onError);
    server.listen(port, host, () => {
      server.off('error', onError);
      onListen();
    });
  });

  const address = server.address();
  const shownHost = typeof address === 'object' && address ? address.address : host;
  const shownPort = typeof address === 'object' && address ? address.port : port;
  const info = env.info || {};
  console.log('植迹 · 自托管服务已启动');
  console.log('  监听地址: http://' + shownHost + ':' + shownPort + (host === '0.0.0.0' ? '（对外，0.0.0.0 表示所有网卡）' : '（仅本机）'));
  console.log('  数据目录: ' + (info.dataDir || '(未知)'));
  console.log('  SQLite  : ' + (info.sqlitePath || '(未知)'));
  console.log('  公开地址: ' + (normalizeOrigin(origin) || '(未设置 PUBLIC_ORIGIN，Origin 校验将依赖请求地址)'));
  console.log('  反代信任: ' + (trustProxy ? 'FLORA_TRUST_PROXY=1（取 X-Forwarded-For 最后一跳）' : '关闭（忽略 X-Forwarded-For 等来源头）'));

  if (!normalizeOrigin(origin)) console.warn('[植迹] 提醒：反代/自定义域名部署请设置 PUBLIC_ORIGIN=https://你的域名，否则 Origin 校验可能失败（403 请求来源不匹配）。');
  if (!env.PLANTNET_API_KEY) console.warn('[植迹] 提醒：未配置 PLANTNET_API_KEY，/api/identify 需要客户端自带 x-plantnet-key 或返回 401。');
  if (!env.DEEPSEEK_API_KEY) console.warn('[植迹] 提醒：未配置 DEEPSEEK_API_KEY，/api/model 与 /api/duel 的体系判定将返回 503。');

  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    await new Promise(done => server.close(() => done()));
    try {
      env.close?.();
    } catch (error) {
      console.error('[植迹] 关闭数据库失败：', error?.message || error);
    }
  };

  if (options.handleSignals !== false) {
    const shutdown = signal => {
      console.log('\n[植迹] 收到 ' + signal + '，正在关闭…');
      // 二次信号直接退出，别让挂起的连接拖住容器。
      process.once('SIGINT', () => process.exit(1));
      process.once('SIGTERM', () => process.exit(1));
      close().then(() => process.exit(0), () => process.exit(1));
    };
    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
  }

  return {server, env, close};
}

function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
  } catch {
    return false;
  }
}

if (isMainModule()) {
  start().catch(error => {
    console.error('[植迹] 启动失败：' + (error?.message || error));
    process.exitCode = 1;
  });
}
