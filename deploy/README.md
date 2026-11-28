# 植迹 · 自托管运行说明（Node + 文件系统 + SQLite）

这套适配器让「植迹」不依赖 ChatGPT Sites / Cloudflare：把仓库里已有的 Worker bundle
（`dist/server/index.js`，自包含 ES Module，`export default {fetch(request, env)}`）
直接跑在 Node 上，并把两个云绑定在本地复刻：

| Cloudflare 绑定 | 自托管实现 | 落盘位置 |
| --- | --- | --- |
| `BUCKET`（R2） | 文件系统对象存储，支持 `If-Match` / `If-None-Match: *` 条件写 | `$FLORA_DATA_DIR/objects/` |
| `DB`（D1） | Node 24 内置 `node:sqlite`（`DatabaseSync`），启动时执行 `deploy/schema.sql` | `$FLORA_DATA_DIR/flora.sqlite` |
| `PLANTNET_API_KEY` / `DEEPSEEK_API_KEY` | 环境变量透传 | — |

业务代码一行没改：路由、Cookie、Origin 校验、限流、花园版本冲突全都还在原来的
`server/*.mjs` + `dist/*.js` 里。这样线上 Cloudflare 版和自托管版是同一份逻辑。

新增文件：

```
deploy/node-storage.mjs   文件系统 BUCKET + node:sqlite 版 D1 + createEnv()
deploy/node-server.mjs    node:http -> Web Request/Response 转发层，可直接启动
deploy/schema.sql         garden_friends 的 SQLite DDL（与 drizzle/0000 对应）
deploy/README.md          本文件
Dockerfile / .dockerignore
```

---

## 1. 本机自测（不用 Docker）

需要 Node ≥ 24（`node:sqlite` 在 24 上可用；22 上属于实验特性，未验证）。

```bash
# 1) 生成服务端 bundle（前端/服务端改动后都要重跑；仓库里已提交 dist/server/index.js，可跳过）
node build.mjs

# 2) 启动（默认只监听 127.0.0.1:3000，数据目录 ./flora-data）
node deploy/node-server.mjs
# 浏览器打开 http://127.0.0.1:3000
```

指定端口与数据目录（PowerShell 与 bash 写法不同）：

```powershell
$env:PORT='3000'; $env:FLORA_DATA_DIR='.\flora-data'; node deploy/node-server.mjs
```

```bash
PORT=3000 FLORA_DATA_DIR=./flora-data node deploy/node-server.mjs
```

> **HTTPS 是硬要求。** 登录 Cookie 叫 `__Host-flora_session`，带 `Secure; HttpOnly;
> Path=/; SameSite=Lax`。`__Host-` 前缀规定浏览器只在 HTTPS（或被判为可信的
> `http://127.0.0.1` / `http://localhost`）下保存它。所以：
> · 本机用 `127.0.0.1` 自测可以登录；
> · 用 `http://192.168.x.x` 或 `http://你的域名` 在手机上打开，**能看页面但登录态存不住**，
>   表现是"注册成功但刷新就退出"——这不是 bug，必须上 HTTPS（见第 4 节）。

停止：`Ctrl+C`，服务会关闭监听并收尾 SQLite（`SIGINT` / `SIGTERM` 都处理了）。

---

## 2. Docker

```bash
docker build -t flora .
docker run -d --name flora \
  --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  -v flora-data:/data \
  -e PUBLIC_ORIGIN=https://flora.example.com \
  -e FLORA_TRUST_PROXY=1 \
  -e PLANTNET_API_KEY=... \
  -e DEEPSEEK_API_KEY=... \
  flora
```

要点：

* `-p 127.0.0.1:3000:3000` 只让宿主反代访问，公网只开 80/443。
* 镜像内 `HOST=0.0.0.0`（容器必须），数据统一在 `/data`。
* 用命名卷 `flora-data` 时无需关心属主；如果改成宿主目录
  （`-v /srv/flora-data:/data`），需要 `chown -R 1000:1000 /srv/flora-data`
  （镜像内以 `node` 用户 uid 1000 运行）。
* 环境变量多时用 `--env-file .env`（`KEY=VALUE` 每行一条，不要引号）。
* 更新版本：

  ```bash
  git pull && docker build -t flora . \
    && docker rm -f flora && docker run -d ... flora   # 参数同上
  ```

  `docker build` 会自动执行 `node build.mjs`，所以改完前端/服务端不用单独构建。
  数据在卷里，重建容器不丢。

---

## 3. 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | 监听地址。容器内必须 `0.0.0.0`；裸机建议保持 `127.0.0.1` 只给反代用。 |
| `PORT` | `3000` | 监听端口。 |
| `FLORA_DATA_DIR` | `./flora-data` | 数据根目录（对象 + SQLite）。Docker 里是 `/data`。 |
| `FLORA_SQLITE` | `$FLORA_DATA_DIR/flora.sqlite` | SQLite 文件路径，一般不用改。 |
| `PUBLIC_ORIGIN` | 空 | **上线必填**，如 `https://flora.example.com`。可逗号分隔多个。Worker 的 `sameOrigin()` 用它放行来源；不填就只能靠请求自身的 Host，反代后容易 403「请求来源不匹配」。 |
| `PLANTNET_API_KEY` | 空 | Pl@ntNet 识别密钥。不配时 `/api/identify` 返回 401（客户端可临时自带 `x-plantnet-key`，但不建议线上这样用）。 |
| `DEEPSEEK_API_KEY` | 空 | DeepSeek 密钥。不配时 `/api/model`、`/api/duel` 的体系判定返回 503，其余功能正常。 |
| `PASSWORD_ROUNDS` | `100000` | PBKDF2 轮数，范围 100000–1000000。调高后老账号下次登录自动迁移；不要低于默认值。 |
| `REGISTER_DAILY_LIMIT` | `200` | 全站每天最多注册数（防把服务当免费图床）。 |
| `FLORA_TRUST_PROXY` | 关 | `1` = 信任反代：取 `X-Forwarded-For` **最后一跳**作为访客地址。不开启时会忽略所有来源头，匿名限流退化为 `unknown` 单桶。单层反代场景开启。 |
| `FLORA_LOG` | 关 | `1` = 每个请求打一行 `method path status ms`，排障用。 |

`/api/identify` 与 `/api/model` 仍然调用外部服务（Pl@ntNet、DeepSeek），
它们需要服务器能出网；大陆服务器访问境外 Pl@ntNet 较慢时，识别会更容易超时
（上游超时 25 秒），这不是适配器的问题。

---

## 4. 反向代理（HTTPS）

用 Caddy 最省事（自动申请/续期 Let's Encrypt 证书）。宿主装好 Caddy 后：

```caddyfile
flora.example.com {
    encode zstd gzip
    request_body {
        max_size 20MB
    }
    reverse_proxy 127.0.0.1:3000 {
        header_up X-Forwarded-Proto {scheme}
    }
}
```

* Caddy 会自动带上 `X-Forwarded-For`、`Host`，并把真实访客地址追加在队尾。
* 容器/进程启动时务必同时配 `PUBLIC_ORIGIN=https://flora.example.com`
  和 `FLORA_TRUST_PROXY=1`。
* `request_body max_size 20MB`：花园同步上限是 16 MiB，识别照片 4 MB；
  默认限制（如 nginx 的 1 MB）会让保存花园直接 413。
* nginx 对照写法：

  ```nginx
  server {
      listen 443 ssl http2;
      server_name flora.example.com;
      client_max_body_size 20m;
      location / {
          proxy_pass http://127.0.0.1:3000;
          proxy_set_header Host $host;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
      }
  }
  ```

* 只能信任**一层**反代：`FLORA_TRUST_PROXY` 取的是 XFF 队尾，多层反代需要自己扩展
  `normalizeForwarded()`（`deploy/node-server.mjs`）。
* 不要在反代层再改 `Set-Cookie`，响应多值 Set-Cookie 已按条透传。

---

## 5. 数据与备份

```
$FLORA_DATA_DIR/
├── objects/          # 花园、账号、会话、限流计数器（键名即路径，逐段转义）
│   ├── gardens/v1/<uuid>%2Ejson
│   └── auth/...
└── flora.sqlite      # 好友关系（garden_friends），WAL 模式
```

数据库热备份（`VACUUM INTO` 得到一致快照，不会拷到写一半的页）：

```bash
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p /srv/flora-backup
docker exec flora node -e "const{DatabaseSync}=require('node:sqlite');new DatabaseSync('/data/flora.sqlite').exec(\"VACUUM INTO '/data/flora-$STAMP.sqlite'\")"
docker cp "flora:/data/flora-$STAMP.sqlite" "/srv/flora-backup/"
docker exec flora rm "/data/flora-$STAMP.sqlite"
docker cp flora:/data/objects "/srv/flora-backup/objects-$STAMP"
tar czf "/srv/flora-backup/flora-$STAMP.tgz" -C /srv/flora-backup "objects-$STAMP" "flora-$STAMP.sqlite"
rm -rf "/srv/flora-backup/objects-$STAMP" "/srv/flora-backup/flora-$STAMP.sqlite"
```

cron 示例（每天 03:30，保留 14 天）：

```cron
30 3 * * * /srv/flora-backup.sh >> /var/log/flora-backup.log 2>&1
0 4 * * * find /srv/flora-backup -name 'flora-*.tgz' -mtime +14 -delete
```

恢复：停容器 → 把 `objects/` 与 sqlite（连同 `-wal`/`-shm` 一并删掉再放）放回卷里
→ 起容器 → 用浏览器登录验证。演练一次比备份十次有用。

---

## 6. 已知边界

* **单实例**。SQLite 与"同 key 条件写"是进程内串行化，不能多副本同时写同一数据。
  要水平扩展得把 `BUCKET` 换成 S3 兼容存储、`DB` 换成 PostgreSQL（未实现）。
* 没有 CDN 与边缘缓存，静态页从你的服务器出，首屏体积约 400 KB（gzip 后约 120 KB，
  反代开 `encode` 即可）。
* `/api/og.png` 等后续新增路由以 `dist/server/index.js` 实际内容为准；旧 bundle 会 404。
* 对象 key 到文件名做了转义（`encodeURIComponent` + 点转 `%2E` + 设备名/超长兜底），
  不要用外部脚本另建同名目录，否则 `BUCKET.get()` 找不到。
* 进程被 `kill -9` 时正在写的对象会留一个 `.tmp-*` 临时文件，可安全删除
  （正式文件只由 `rename` 原子替换）。

---

## 7. 验收与上线

部署完成后按 [`docs/china-hosting.md`](../docs/china-hosting.md) 的验收清单走一遍：
注册 → 拍照识别 → 栽种 → 保存 → 换设备登录 → 好友申请/通过。重点看三件事：

1. 浏览器地址栏是 HTTPS 且证书有效；
2. DevTools → Application → Cookies 里 `__Host-flora_session` 存在且带 Secure/HttpOnly；
3. `docker logs flora` 没有 `请求来源不匹配`（有就查 `PUBLIC_ORIGIN` 是否写成
   `https://域名`、没有结尾斜杠、协议一致）。
