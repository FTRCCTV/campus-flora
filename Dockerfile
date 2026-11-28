# 植迹 · 自托管镜像
#
# 构建与运行（详见 deploy/README.md）：
#   docker build -t flora .
#   docker run -d --name flora -p 127.0.0.1:3000:3000 -v flora-data:/data \
#     -e PUBLIC_ORIGIN=https://flora.example.com -e FLORA_TRUST_PROXY=1 \
#     -e PLANTNET_API_KEY=... -e DEEPSEEK_API_KEY=... flora
#
# 说明：
#   · build.mjs 只用 Node 内置模块拼 dist/server/index.js，所以不需要 npm install，
#     镜像里没有任何 node_modules；业务代码跑的是 Worker 同一份 bundle。
#   · 数据（BUCKET 对象 + SQLite）全部落在 /data，容器可随时重建。
#   · 容器内必须 HOST=0.0.0.0，宿主端口建议只绑 127.0.0.1，由 Caddy/nginx 做 HTTPS。

FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    FLORA_DATA_DIR=/data

# 复制构建输入：前端静态资源 + 服务端模块 + 自托管适配器。
COPY package.json ./
COPY build.mjs ./
COPY dist ./dist
COPY server ./server
COPY deploy ./deploy

# 生成 dist/server/index.js（与 `npm run build` 等价，不需要依赖）。
RUN node build.mjs

# 非 root 运行；/data 需要可写，预先建好并交给 node 用户。
RUN mkdir -p /data && chown -R node:node /app /data
USER node

VOLUME ["/data"]
EXPOSE 3000

# /api/account 未带 Cookie 时返回 200 {"user":null}，比拉 400 KB 首页轻得多。
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/account').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "deploy/node-server.mjs"]
