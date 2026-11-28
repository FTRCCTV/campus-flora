# 校园植物园在中国大陆的部署方案

本文回答一个问题：**「植迹」现在挂在 ChatGPT Sites 上，老师和评委怎么在大陆的校园网/手机上稳定打开？**
结论是：把服务跑在**自己的域名 + 自己的进程**上。仓库已经为此准备好了 Node 自托管适配器
（`deploy/`），业务代码不需要重写；剩下的是选服务器、备案、配 HTTPS。

> 诚实声明：本文的步骤在真实公网服务器上**尚未逐条实测**（比赛前应按第 6 节在候选服务器上走一遍）。
> 延迟、价格、备案时长是公开资料与经验区间，会随地域、运营商、活动变化，购买前以云厂商官网为准。
> 自托管适配器本身已在本机 Node 24 上用同进程 `worker.fetch` 跑通：首页、注册、登录、
> 花园保存与版本冲突、好友申请/通过（见 `deploy/README.md`）。

---

## 0. 先看结论

| 你的处境 | 建议 | 上线耗时 |
| --- | --- | --- |
| 距离答辩 1–2 周，团队自己出钱，不想碰备案 | **路线 A：香港/新加坡轻量 + Docker + Caddy** | 当天 |
| 长期对大陆用户开放，或以学校/社团名义运营 | **路线 B：腾讯云轻量（境内）+ ICP 备案** | 备案 1–3 周 + 部署半天 |
| 学校能提供域名和服务器 | 找网络中心要**子域名 + 反代 + 一台可部署的机器**，走学校统一备案 | 看学校流程 |
| 只想答辩兜底、不追求大陆稳定 | 保持 Cloudflare Workers（现状）+ 离线包 `campus-flora-offline.html` 演示 | 0 |

三条路径的差别不在代码，在**备案、延迟、数据存放地**这三件事上。

---

## 1. 为什么现在大陆访问不了 / 慢

1. **域名不是我们自己的。** 现在入口是 `cau-campus-flora-notebook.bubblybox131.chatgpt.site`。
   `chatgpt.site` 是第三方平台域名，解析与线路由平台决定，我们无法加 CDN、无法换线路、
   也无法向评委解释"这个域名和我们是什么关系"。
2. **底层是 Cloudflare 免费网络。** Cloudflare 免费版在中国大陆没有可用节点（大陆境内节点
   需要企业资质单独签约）。大陆访客会被调度到香港/新加坡/日本/美西，实测常见
   **150–400 ms**，晚高峰丢包和抖动明显，部分校园网/运营商还会出现打不开。
3. **没有自有 HTTPS 域名，登录态也存不住。** 我们的会话 Cookie 是
   `__Host-flora_session`（`Secure; HttpOnly; Path=/; SameSite=Lax`）。`__Host-` 前缀强制
   HTTPS，且不能带 `Domain`。换到自有域名后，必须由自己的 HTTPS 终结层（Caddy/nginx）来发它；
   用 `http://` 或局域网 IP 访问，表现就是"注册成功、一刷新就退出"。
4. **数据在别人平台上。** 花园、账号、好友关系都在 R2/D1，既不能本地备份，也不方便说明
   数据存放地（合规问题，见第 7 节）。

所以目标很明确：**自有域名 + 自有 HTTPS + 自有进程 + 可备份的数据目录**。
`deploy/node-server.mjs` 就是那个"自有进程"：它把已提交的 Worker bundle 原样跑在 Node 上，
用文件系统模拟 R2、用 Node 24 内置的 `node:sqlite` 模拟 D1，**不需要改一行业务代码**。

---

## 2. 三条可选路径

### 2.1 对比表

| 维度 | 路线 A：香港/新加坡轻量 + 自托管 | 路线 B：境内轻量（腾讯云/阿里云）+ 自托管 | 路线 C：Cloudflare Workers + 自定义域名（现状架构） |
| --- | --- | --- | --- |
| 是否需要 ICP 备案 | **不需要**（服务器在境外）；域名需实名 | **需要**（服务器在境内，不备案 80/443 会被云厂商阻断） | 不需要（服务器在境外） |
| 大致成本 | 轻量 2C2G：**约 40–100 元/月**；域名 30–80 元/年 | 轻量 2C2G：**约 50–100 元/月**（学生/活动价更低）；域名 30–80 元/年；备案免费 | Workers/R2/D1 免费额度内 **0–5 美元/月**；域名另计 |
| 大陆延迟（经验值） | 华南 20–40 ms、华东 40–60 ms、北方 60–90 ms；跨境晚高峰会抖 | **同城/同省 5–20 ms、跨省 20–50 ms**，三网直连，最稳 | 150–400 ms 且不稳定，部分网络不可达 |
| 运维复杂度 | 中：装 Docker、Caddy 自动证书、备份脚本 | 中 + 备案材料与等待 | **低**：平台托管，但不可控 |
| 数据存放地（合规） | 境外（香港/新加坡）→ 涉及数据出境告知 | **境内**，最符合校园/教育场景的合规预期 | 境外（Cloudflare 全球网络） |
| 适合谁 | 比赛冲刺、团队自持、快速上线 | 长期运营、学校名义、要求稳定合规 | 演示兜底、海外访问、零运维试水 |
| 主要风险 | 跨境线路波动；数据出境 | 备案被驳回/超时；教育类内容可能被要求补充材料 | 大陆可用性无法保证 |

### 2.2 三条路径各一句话

* **路线 A**：不备案、当天能上，代价是跨境链路。适合"答辩前必须有个能打开的网址"。
* **路线 B**：备案是唯一门槛，过了之后体验最好、最合规。适合"这个项目要继续做下去"。
* **路线 C**：代码不用动（现状），但大陆访问质量不受我们控制，只能当备用入口。

### 2.3 第四个选项：学校的服务器和子域名

如果中国农大网络中心能给一台已备案的服务器和一个 `*.edu.cn` 子域名，这是**最快也最稳**的：
备案主体、接入商、开放端口都由学校统一管理，我们只需要：

1. 要一个子域名（如 `flora.xxx.edu.cn`）和它的 A 记录解析权；
2. 在服务器上装 Docker（或直接用学校给的 Node 环境），按路线 A 的第 5–8 步部署；
3. `PUBLIC_ORIGIN` 填学校子域名，`FLORA_TRUST_PROXY=1`；
4. 确认学校防火墙允许 443 入站、允许服务器出网访问 `my-api.plantnet.org` 与 `api.deepseek.com`。

学校域名通常不允许个人随意解析，需要指导老师或社团挂靠单位出面申请，**这件事要提前两周启动**。

---

## 3. 路线 A：香港轻量 + Docker + Caddy（可照抄）

以腾讯云轻量应用服务器（香港）为例，阿里云轻量香港/新加坡同理。下面命令在服务器上以 `root`
或带 `sudo` 执行，系统用 Ubuntu 24.04 LTS。

### A1. 买机器、配 DNS

1. 购买：地域选**香港**（或新加坡），配置 2 核 2G、带宽 30 Mbps 峰值、系统 Ubuntu 24.04。
2. 域名：在任意注册商买一个域名（`.com` 约 60–80 元/年，`.cn` 约 30 元/年），完成**域名实名认证**
   （国内注册商要求，通常 1 个工作日内通过）。
3. DNS：在域名解析里加一条 A 记录，例如

   | 记录类型 | 主机记录 | 记录值 | TTL |
   | --- | --- | --- | --- |
   | A | `flora`（或 `@`） | 服务器公网 IP | 600 |

   验证（在本地电脑上，用公共 DNS 查，避免本地缓存）：

   ```bash
   nslookup flora.example.com 223.5.5.5     # 阿里 DNS
   nslookup flora.example.com 119.29.29.29  # 腾讯 DNS
   ```

   两条都返回同一台服务器 IP 再往下走；不生效就等 10 分钟再查，**不要在 DNS 没生效时配 HTTPS**。

4. 防火墙：云控制台"防火墙"只放行 **TCP 22、80、443**；**不要放行 3000**。
   服务器上也确认一下：

   ```bash
   sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
   sudo ufw enable
   ```

### A2. 安装 Docker

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo systemctl enable --now docker
sudo docker version   # 能看到 Server 段即成功
```

### A3. 拉代码、写环境变量

```bash
sudo git clone https://github.com/FTRCCTV/campus-flora.git /srv/campus-flora
cd /srv/campus-flora
sudo tee /srv/campus-flora/.env >/dev/null <<'EOF'
PUBLIC_ORIGIN=https://flora.example.com
FLORA_TRUST_PROXY=1
PASSWORD_ROUNDS=310000
PLANTNET_API_KEY=替换成你的密钥
DEEPSEEK_API_KEY=替换成你的密钥
EOF
sudo chmod 600 /srv/campus-flora/.env
```

* `PUBLIC_ORIGIN` 必须是**带 https、不带结尾斜杠**的完整 origin；换成你的真实域名。
* `FLORA_TRUST_PROXY=1` 让服务从 `X-Forwarded-For` 取真实访客地址（反代后面必须开）。
* `PASSWORD_ROUNDS=310000` 是 OWASP 对 PBKDF2-SHA256 的建议量级，代价是登录多花约 0.1–0.3 秒；
  保守可留空用默认 100000。老账号下次登录会自动迁移到新轮数。

### A4. 构建并启动容器

```bash
cd /srv/campus-flora
sudo docker build -t flora .
sudo docker run -d --name flora --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  -v flora-data:/data \
  --env-file /srv/campus-flora/.env \
  flora
sudo docker logs -f flora
```

看到下面这几行说明进程正常（`Ctrl+C` 只是退出日志，不会停容器）：

```
植迹 · 自托管服务已启动
  监听地址: http://0.0.0.0:3000（对外，0.0.0.0 表示所有网卡）
  数据目录: /data
  SQLite  : /data/flora.sqlite
  公开地址: https://flora.example.com
  反代信任: FLORA_TRUST_PROXY=1（取 X-Forwarded-For 最后一跳）
```

`-p 127.0.0.1:3000:3000` 表示 3000 只绑在本机回环地址，公网必须经 Caddy。

### A5. 安装 Caddy、配自动 HTTPS

```bash
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy

sudo tee /etc/caddy/Caddyfile >/dev/null <<'EOF'
flora.example.com {
    encode zstd gzip
    request_body {
        max_size 20MB
    }
    reverse_proxy 127.0.0.1:3000 {
        header_up X-Forwarded-Proto {scheme}
    }
}
EOF

sudo systemctl reload caddy
sudo journalctl -u caddy -f     # 首次会申请 Let's Encrypt 证书，看到 certificate obtained 即可
```

* `request_body max_size 20MB` 不能省：花园同步请求上限是 16 MiB，识别照片 4 MB；
  Caddy 默认限制会让保存花园直接 413。
* Caddy 会自动续期证书；服务器需要能被外网访问 80/443（Let's Encrypt HTTP-01 校验）。
* 证书失败先查 DNS 和防火墙，`journalctl -u caddy` 会写清原因；DNS 没生效时 Caddy 会反复重试。

### A6. 自检（服务器上就能跑完）

```bash
curl -sSI https://flora.example.com/ | head -n 5
# 期望：HTTP/2 200、content-type: text/html; charset=utf-8

curl -sS -c /tmp/flora.cookies -o /dev/null -w '%{http_code}\n' \
  -X POST https://flora.example.com/api/auth/register \
  -H 'content-type: application/json' \
  -H 'origin: https://flora.example.com' \
  -d '{"name":"deploy_check","password":"deploy-check-001"}'
# 期望：200（用户名已存在时是 409，也说明链路通）

grep '__Host-flora_session' /tmp/flora.cookies && echo 'Cookie 正常'
curl -sS -b /tmp/flora.cookies https://flora.example.com/api/account
# 期望：{"user":{...},"version":"new",...}
rm -f /tmp/flora.cookies
```

> 如果 `api/auth/register` 返回 **403 请求来源不匹配**，99% 是 `PUBLIC_ORIGIN` 写错
> （漏 https、多结尾斜杠、域名拼错）。改完 `.env` 后要
> `docker rm -f flora` 再 `docker run`（环境变量在启动时读取）。

### A7. 备份（上线当天就配）

在服务器上建 `/srv/flora-backup.sh`：

```bash
#!/bin/sh
set -eu
STAMP=$(date +%Y%m%d-%H%M%S)
DEST=/srv/flora-backup
mkdir -p "$DEST"
# SQLite 一致快照（VACUUM INTO），不会拷到写一半的页
docker exec flora node -e "const{DatabaseSync}=require('node:sqlite');new DatabaseSync('/data/flora.sqlite').exec(\"VACUUM INTO '/data/flora-$STAMP.sqlite'\")"
docker cp "flora:/data/flora-$STAMP.sqlite" "$DEST/"
docker exec flora rm "/data/flora-$STAMP.sqlite"
# 对象目录（花园 JSON、账号、会话、限流计数）
docker cp flora:/data/objects "$DEST/objects-$STAMP"
tar czf "$DEST/flora-$STAMP.tgz" -C "$DEST" "objects-$STAMP" "flora-$STAMP.sqlite"
rm -rf "$DEST/objects-$STAMP" "$DEST/flora-$STAMP.sqlite"
find "$DEST" -name 'flora-*.tgz' -mtime +14 -delete
```

```bash
sudo chmod +x /srv/flora-backup.sh
sudo /srv/flora-backup.sh && ls -lh /srv/flora-backup/
sudo crontab -e
# 加一行：
# 30 3 * * * /srv/flora-backup.sh >> /var/log/flora-backup.log 2>&1
```

恢复演练：停容器 → 把 `objects/` 与 `flora.sqlite` 放回卷 → 起容器 → 登录看花园是否完整。
**没演练过的备份等于没有备份。**

---

## 4. 路线 B：腾讯云轻量（境内，需 ICP 备案）

境内服务器的部署动作（Docker、Caddy、启动、备份）与路线 A **完全一样**，区别只有三处：
**先备案、DNS 指向境内 IP、证书签发要等备案通过**。

### B1. 域名实名 + 买机器

1. 域名完成实名认证（未实名的域名无法备案）。
2. 购买腾讯云轻量应用服务器，地域选**北京/上海/广州**（或离学校近的地域），2 核 2G，
   Ubuntu 24.04。**购买前确认该实例支持备案**（轻量支持，但每个实例有备案配额限制，
   腾讯云文档会写明；有过往备案记录的实例不能重复用）。
3. 备案通过前**不要**把域名解析到这台机器对外提供网站服务：境内实例未备案时，
   80/443 会被云厂商阻断（不同厂商策略略有差异），HTTP-01 证书校验也会失败。

### B2. 备案（这是路线 B 真正的门槛）

在腾讯云控制台 →「备案」→ 首次备案，按接入商引导填写：

| 材料 | 个人主体 | 学校/社团主体 |
| --- | --- | --- |
| 主体证件 | 身份证正反面 | 事业单位法人证书 / 营业执照 + 授权书 |
| 负责人 | 本人（需人脸核验） | 单位指定负责人（需授权书、人脸核验） |
| 网站信息 | 网站名称、服务内容、域名 | 同左，内容选"教育/其他"按接入商建议 |
| 服务器 | 需为该账号下境内实例 | 同左 |

时间线（各省管局不同，以下为常见区间）：

1. 提交材料、接入商初审：**1–2 个工作日**（材料不全会被打回，提前准备）；
2. 短信核验 / 人脸核验：当天完成；
3. **省通信管理局审核：1–20 个工作日**，多数省份 5–10 个工作日；
4. 通过后拿到备案号（如 `京ICP备XXXXXXXX号-X`），按要求把备案号放到网站页脚。

**备案期间的工程安排**：部署与联调照做，但不要绑域名对外。
可以先用 `http://服务器IP:3000`（部分厂商对未备案实例的非标端口也可能限制）做本机/内网验证，
或者干脆先在本机 `node deploy/node-server.mjs` 跑通全流程，等备案通过再切公网。

**注意**：备案主体、域名、服务器要一致；换服务器/换接入商要做"接入备案"或"变更备案"。
以学校名义运营必须由学校授权办理，个人主体不能替学校备案。

### B3. 备案通过后

1. DNS A 记录：`flora.example.com` → 境内服务器公网 IP。
2. 腾讯云轻量"防火墙"面板放行 TCP 22/80/443（3000 不放行）。
3. 继续按 **A2–A7** 部署（Docker、Caddy、启动、自检、备份），`PUBLIC_ORIGIN` 换成同一域名。
4. Caddy 申请证书需要 80 端口可达——备案通过后即可；若 80 被占用/限制，改用腾讯云免费
   SSL 证书手动配置，或给 Caddy 加 DNS-01 插件（需自行编译，成本更高，优先解决 80）。
5. **网站上线后 30 日内**完成公安联网备案（全国互联网安全管理服务平台），
   按属地公安要求提交；很多省份是强制的，别漏。

### B4. 境内路径的成本

| 项目 | 金额 |
| --- | --- |
| 轻量 2C2G（境内） | 约 50–100 元/月（学生机/活动价可低至 20–50） |
| 域名 | 30–80 元/年 |
| ICP 备案 | 免费（材料与时间成本才是大头） |
| SSL 证书 | 免费（Let's Encrypt / 云厂商免费证书） |

---

## 5. 现有代码需要改什么（清单）

好消息：**业务逻辑不用改**。需要动的只有部署配置和两个写死的域名常量。

### 5.1 部署时必填的环境变量

| 变量 | 是否必填 | 说明 |
| --- | --- | --- |
| `PUBLIC_ORIGIN` | **必填** | 如 `https://flora.example.com`。反代/自定义域名下 Worker 的 `sameOrigin()` 靠它放行来源；漏配会出现 403「请求来源不匹配」。 |
| `PLANTNET_API_KEY` | 必填（要识别） | Pl@ntNet 密钥。不配时 `/api/identify` 返回 401。 |
| `DEEPSEEK_API_KEY` | 必填（要株形/体系） | DeepSeek 密钥。不配时 `/api/model`、`/api/duel` 的体系判定返回 503，其余正常。 |
| `FLORA_TRUST_PROXY` | 反代后必填 `1` | 否则访客地址恒为 `unknown`，限流退化成一个全局桶。 |
| `PASSWORD_ROUNDS` | 建议 `310000` | 范围 100000–1000000；老账号下次登录自动迁移。 |
| `FLORA_DATA_DIR` | Docker 已内置 `/data` | 裸机部署时指到持久盘目录，**不要放在 `/tmp`**。 |
| `REGISTER_DAILY_LIMIT` | 可选，默认 200 | 全站每日注册上限。 |

### 5.2 必须改的两处域名常量（否则离线版还指向 chatgpt.site）

离线版 `植迹.exe`（Go 启动器）内嵌了离线 HTML，页面里的"打开在线版"和 `/api/*` 转发都写死了旧域名：

1. **`offline/main.go:25`**

   ```go
   const service = "https://cau-campus-flora-notebook.bubblybox131.chatgpt.site"
   ```

   改成你的域名，例如 `const service = "https://flora.example.com"`。
   这里负责离线版把 `/api/identify`、`/api/model`、`/api/faction` 转发到在线服务；
   不改的话，离线版一用识别就打到 chatgpt.site（大陆极可能超时）。

2. **`dist/app.js:7`**

   ```js
   const hosted='https://cau-campus-flora-notebook.bubblybox131.chatgpt.site/';
   ```

   改成 `const hosted='https://flora.example.com/';`（**注意保留结尾斜杠**）。
   这里负责离线版页面里"打开在线版"的链接。

3. 改完必须重打三样东西，顺序不能错：

   ```bash
   node build.mjs                                # 重新生成 dist/server/index.js（内嵌前端）
   node build.mjs campus-flora-offline.html      # 重新生成离线单文件页
   # 然后用 offline/package.ps1 或 go build 重新打包 Windows 离线版
   ```

   `offline/main.go` 用 `//go:embed campus-flora-offline.html` 内嵌页面，
   所以**先**生成 HTML，**再**编译 exe。最后把新的 `植迹.exe`/zip 替换 GitHub Release 附件，
   并在 README 里更新在线版链接（`README.md:5` 也写着旧域名，属可选修改）。

4. 云端架构里的对应关系（供理解，不用改代码）：

   | Cloudflare 绑定 | 自托管 | 说明 |
   | --- | --- | --- |
   | `env.BUCKET`（R2） | `deploy/node-storage.mjs` 的文件系统实现 | 花园、账号、会话、限流计数 |
   | `env.DB`（D1） | `node:sqlite`（`DatabaseSync`）+ `deploy/schema.sql` | `garden_friends` 好友关系 |
   | `env.PLANTNET_API_KEY` / `DEEPSEEK_API_KEY` | 同名环境变量 | 外部 API 密钥 |

### 5.3 数据迁移（如果已有线上用户）

* **新站可以重新注册**：比赛 Demo 阶段最省事。旧站的会话 Cookie 与新站无关，切换时用户需重新登录。
* **要搬数据**：需要写一个一次性导出脚本（尚未提供），规则是
  * R2 对象 `gardens/v1/<encodeURIComponent(userId)>.json` → `<FLORA_DATA_DIR>/objects/gardens/v1/<同名>.json`；
  * R2 对象 `auth/names/<sha256(小写用户名)>`、`auth/sessions/*` 同样按 key 落盘（会话可不搬）；
  * D1 的 `garden_friends` 逐行导出 INSERT 进 `flora.sqlite`（表结构见 `deploy/schema.sql`）；
  * 迁移后抽查：花园版本号仍是 `"32位十六进制"`、好友关系 `accepted` 状态正确。
* 切换窗口：先停写、导出、导入、核对条数，再让新站接受写入；旧库保留只读备份一段时间。

### 5.4 备份

按 `deploy/README.md` 第 5 节（或 A7 的脚本）每天备份 `objects/` + `flora.sqlite`，
保留 14 天以上，并至少做一次**恢复演练**。数据目录是全部家当，丢了无法从代码恢复。

---

## 6. 验收清单（校园网 + 手机流量）

在第 6.3 的矩阵里记录，答辩材料可以直接引用这张表。

### 6.1 部署自检（服务器上）

- [ ] `nslookup 域名 223.5.5.5` 和 `119.29.29.29` 都返回目标服务器 IP
- [ ] `curl -sSI https://域名/` 返回 `200`，证书不是自签（浏览器无警告）
- [ ] `curl` 注册接口返回 200 且响应含 `Set-Cookie: __Host-flora_session=...`
- [ ] `docker logs flora` 无持续报错，无「请求来源不匹配」
- [ ] 公网只开放 22/80/443；`3000` 从外网访问不通
- [ ] `https://域名/api/account` 未登录返回 `{"user":null}`（而不是 502/HTML 错误页）

### 6.2 功能验收（手机浏览器，HTTPS）

- [ ] 首屏能打开（约 400 KB，gzip 后约 120 KB），无白屏
- [ ] 注册 → 自动登录 → 刷新后仍是登录态（DevTools → Application → Cookies 里
      `__Host-flora_session` 带 `Secure`、`HttpOnly`）
- [ ] 拍照 → 识别 → 出现候选学名（记录耗时与是否超时）
- [ ] 选一株栽种 → 保存 → 刷新后花园还在（看 Network 里 `PUT /api/account` 返回新版本号）
- [ ] 换第二台设备登录同一账号 → 花园一致
- [ ] 两台设备同时改同一花园 → 后保存的一方收到 409「花园已有更新」提示（不是静默覆盖）
- [ ] 好友申请 → 对方通过 → 能访问好友花园
- [ ] 礼物 / 对战（如果答辩版本包含）：至少各走一遍
- [ ] `curl -sS -X POST https://域名/api/model -H 'content-type: application/json' -H 'origin: https://域名' -d '{"latin":"..."}'` 能返回株形参数（验证 DeepSeek 密钥与出网）

### 6.3 网络矩阵记录表

在同一地点、同一账号下分别测，每格填「打开耗时 / 识别耗时 / 结果」：

| 网络 | 首屏(s) | 识别(s) | 保存花园 | 备注 |
| --- | --- | --- | --- | --- |
| 校园 Wi-Fi（教学区） | | | | |
| 校园 Wi-Fi（宿舍区） | | | | |
| 中国移动 4G/5G | | | | |
| 中国联通 4G/5G | | | | |
| 中国电信 4G/5G | | | | |

判定建议：首屏 < 2 s、识别 < 10 s 视为可用；出现 5 s 以上首屏或识别频繁超时，
考虑换地域/加带宽/开 CDN（境内已备案可上云厂商 CDN）。

### 6.4 常见故障对照

| 现象 | 大概率原因 | 处理 |
| --- | --- | --- |
| 页面打开但登录存不住、刷新即退出 | 不是 HTTPS，或域名带端口/是 IP | 用 `https://域名` 访问；本机自测用 `http://127.0.0.1` |
| `403 请求来源不匹配` | `PUBLIC_ORIGIN` 写错/没配 | 改成 `https://域名`（无结尾斜杠），重建容器 |
| 保存花园 413 | 反代请求体限制太小 | Caddy `request_body max_size 20MB`；nginx `client_max_body_size 20m` |
| 识别 401 / 503 | 没配 `PLANTNET_API_KEY`，或服务器出网失败 | 配密钥；在服务器上 `curl -I https://my-api.plantnet.org` 验证出网 |
| 株形/体系 503 | 没配 `DEEPSEEK_API_KEY` | 配密钥后重建容器 |
| 502 / 504 | Caddy 连不上 3000，或进程挂了 | `docker ps`、`docker logs flora`；确认容器内 `HOST=0.0.0.0` |
| 打开的是旧页面 | 反代/浏览器缓存，或没重新 `node build.mjs` | 强制刷新；重建镜像（`docker build` 会自动构建） |
| 证书申请失败 | DNS 未生效 / 80 被墙或未备案 | 先修 DNS/备案；`journalctl -u caddy` 看原因 |

---

## 7. 合规提醒（别等评委会问）

1. **ICP 备案**：服务器在境内就必须备案，备案免费但需要真实主体材料；未备案的 80/443 会被阻断。
   备案号按要求展示在页脚。以学校名义运营需学校授权，个人不能替单位备案。
2. **公安联网备案**：网站上线后 30 日内按属地要求完成（多数省份强制）。
3. **个人信息**：我们只收集用户名和密码的 PBKDF2 盐+摘要，不收集手机号/邮箱；会话 Cookie 仅
   用于登录。**不要**在日志里记录密码、照片、Cookie（现有代码不记录，反代也不要开
   request body 日志）。
4. **照片外发第三方**：识别会把用户照片上传到 **Pl@ntNet**（法国，境外服务器）；株形生成会把
   学名/描述发给 **DeepSeek**（境内）。这两件事必须在页面上（至少注册/首次识别时）明确告知，
   并取得用户同意；答辩材料里也要写明。照片可能拍到人脸、门牌，提醒用户避免。
5. **数据出境**：选香港/新加坡或 Cloudflare 时，花园数据与照片会落到境外，按《个人信息保护法》
   属于数据出境，需要告知并取得单独同意。校园项目规模小也应说明，别等出事再补。
6. **未成年人**：校园场景可能有未满 14 周岁的用户，其个人信息属敏感个人信息，需要监护人同意；
   至少要在页面上做年龄提示，避免收集不必要的信息。
7. **第三方 API 条款**：Pl@ntNet 免费额度/非商业使用限制、DeepSeek 服务条款，都应按官方文档
   使用并署名；不要把密钥写进前端或仓库（现在密钥只在服务端环境变量里）。

---

## 8. 成本汇总与选型建议

| 方案 | 首月成本 | 每月成本 | 备案 | 大陆体验 |
| --- | --- | --- | --- | --- |
| A 香港轻量 2C2G | 服务器 40–100 + 域名约 5 | 40–100 | 不需要 | 好，跨境晚高峰会抖 |
| B 境内轻量 2C2G | 服务器 50–100 + 域名约 5 | 50–100 | 需要，1–3 周 | 最好，20–50 ms |
| C Cloudflare Workers | 0–5 美元 | 0–5 美元 | 不需要 | 不稳定，150–400 ms |
| 学校服务器 | 0 | 0 | 由学校统一管理 | 最好 |

**推荐**：答辩前用 **A**（当天上线，能演示所有在线功能）；如果项目要继续做，答辩后立刻走 **B**
（备案期间可以继续用 A 的服务，DNS 切换即可；数据目录整个拷过去就能迁移）。
**C 和离线包留作兜底**：现场网络出问题时用 `campus-flora-offline.html` + 示例布景演示三维花园，
但拍照识别、账号同步、好友互动必须在线，所以主入口还是要 A 或 B。

---

## 9. 参考

* [腾讯云 ICP 备案条件与材料](https://cloud.tencent.com/document/product/243/18908/)
* [腾讯云接入备案说明](https://cloud.tencent.com/document/faq/243/43878)
* [Caddy 反向代理与自动 HTTPS](https://caddyserver.com/docs/quick-starts/reverse-proxy)
* [Let's Encrypt HTTP-01 校验说明](https://letsencrypt.org/docs/challenge-types/)
* [Pl@ntNet 识别接口文档](https://my.plantnet.org/doc/api/identify)
* [DeepSeek API 文档](https://api-docs.deepseek.com/zh-cn/)
* 自托管运行细节：[`deploy/README.md`](../deploy/README.md)
* 旧版部署思路（Cloudflare 架构迁移顺序、从候选服务器实测 API）：见本文件历史版本
