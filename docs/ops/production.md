# 生产部署清单（L0）

> SoT：本文 + `deploy/` + `.github/workflows/deploy.yml`。  
> 同步行为见 [`../systems/cloud-sync.md`](../systems/cloud-sync.md)；Nginx 摘要见 [`nginx.md`](./nginx.md)。

多端备份为主；邮箱邀请码注册（可暂时关闭 Discord UI）；密钥仅密文上云。

## 组件

| 服务 | 说明 |
|---|---|
| 主站静态 | `dist-card/` → **`/var/www/card`** |
| 管理端静态 | `dist-card-admin/` → **`/var/www/card-admin`**（独立站点，如 card-admin.taojiu.love） |
| API | `server/` Express，systemd **`st-card-builder-api`** |
| CouchDB | 同机 Docker Compose；systemd **`st-card-builder-couch`** |

## 生产环境变量（必查）

```bash
DEV_LOGIN_ENABLED=false
AUTH_EMAIL_ENABLED=true
AUTH_DISCORD_LOGIN_ENABLED=false
INVITE_CODES=your-secret-invite
ADMIN_EMAILS=ops@example.com
ADMIN_READONLY_EMAILS=

# Discord（可保留配置，UI 关闭时不走这条路径）
AUTH_ENFORCE_DISCORD_MEMBERSHIP=true
DISCORD_GUILD_ID=...
DISCORD_REQUIRED_ROLE_IDS=role1,role2
ADMIN_DISCORD_IDS=...
ADMIN_READONLY_DISCORD_IDS=

SESSION_SECRET=<长随机串>
COOKIE_SECURE=true
SESSION_COOKIE_DOMAIN=.taojiu.love   # 主站+管理端共用 Session
ADMIN_BACKUP_ENABLED=false

PUBLIC_APP_URL=https://card.taojiu.love
PUBLIC_ADMIN_URL=https://card-admin.taojiu.love
PUBLIC_API_URL=https://card-api.taojiu.love
# 浏览器同步用；Nginx 将 /couch/ 反代到本机 Couch。见 deploy/nginx-card-api.conf.example
PUBLIC_COUCH_URL=https://card-api.taojiu.love/couch
# Discord Redirect 只登记 API：https://card-api.taojiu.love/api/auth/discord/callback
# CORS：主站/管理端 Origin 已由 PUBLIC_* 自动加入。CORS_ORIGINS=* 表示放行任意源并反射 Origin（勿指望字面 ACAO:*）。
# CORS_ORIGINS=*

COUCHDB_URL=http://127.0.0.1:5984
COUCHDB_USER=admin
COUCHDB_PASSWORD=...
COUCH_AUTO_PROVISION=true
```

## 邮箱登录链路

1. 主站账户页：注册（邮箱 + 密码 + 邀请码）或登录
2. `POST /api/auth/register|login` 写 HttpOnly Session
3. 管理端：同一 Session；邮箱须在 `ADMIN_EMAILS` / `ADMIN_READONLY_EMAILS`

## Discord 登录链路（可选）

1. 前端按钮 → `{PUBLIC_API_URL}/api/auth/discord?return_to=当前页`
2. API 302 → `https://discord.com/api/oauth2/authorize?...`
3. Discord → API `/api/auth/discord/callback`（code 换 token，写 HttpOnly Session）
4. 302 回校验过的 `return_to`（须为 PUBLIC_APP_URL / PUBLIC_ADMIN_URL Origin）

> 若 API 主机无法访问 Discord（如国内出网超时），callback 会失败；此时保持 `AUTH_DISCORD_LOGIN_ENABLED=false`，改用邮箱。

## 云同步与 Couch 对外地址

- **服务端**用 `COUCHDB_URL=http://127.0.0.1:5984`（仅本机）
- **浏览器**用 `PUBLIC_COUCH_URL`（或默认 `{PUBLIC_API_URL}/couch`）
- `/api/sync/credentials` 返回的 `dbUrl` 必须是浏览器可达地址，**禁止**把 `127.0.0.1` 发给前端
- Nginx 示例：`deploy/nginx-card-api.conf.example`（`/api/` → `:8787`，`/couch/` → `:5984`）

## GitHub Actions 部署

workflow：`.github/workflows/deploy.yml`（push `master`）。构建注入 `PUBLIC_*`（可用 repo Variables 覆盖）。

| 产物 | 服务器路径 |
|---|---|
| `dist-card/` | `/var/www/card` |
| `dist-card-admin/` | `/var/www/card-admin` |
| API `server/` | `/home/st-card-builder/server`（固定路径，不跟 SSH `$HOME`） |
| systemd | `st-card-builder-couch` + `st-card-builder-api` |

Nginx：两个站点各自 root；**不必**在静态站反代 `/api`（前端已直连 `PUBLIC_API_URL`）。API 站点单独反代到 `:8787`。

### 部署时 Couch 逻辑

1. 读 `server/.env` 的 `COUCHDB_*`，请求 `{COUCHDB_URL}/_up`
2. 已健康 → 跳过
3. 不可达且 `COUCH_AUTO_PROVISION=true` 且 URL 为本机 → `docker compose up -d`（镜像 `docker.m.daocloud.io/library/couchdb:3.4`，端口 `5984`）
4. **无可用 Docker → 部署失败**
5. 外置 / 非本机 URL 不可达 → 部署失败（不会在本机另起一套）

> 生产 Compose 使用 DaoCloud 对 Docker Hub `library/couchdb` 的代理，减轻国内直连 Hub 超时。CI SSH 步 `command_timeout` 为 30m。
### 服务器一次性准备

```bash
mkdir -p /home/st-card-builder/server
cp /path/to/server/.env.example /home/st-card-builder/server/.env
# 编辑 .env：DEV_LOGIN_ENABLED=false、AUTH_EMAIL_ENABLED、INVITE_CODES、ADMIN_EMAILS、
# PUBLIC_APP_URL、PUBLIC_API_URL、COOKIE_SECURE=true …
```

确保：

1. Node.js ≥ 18 在 PATH（单元默认 `/usr/bin/node`）
2. **已安装 Docker**，且部署用户可 `docker info`（或免密 `sudo docker`）
3. Nginx/Caddy：`/api/*` → `http://127.0.0.1:8787`
4. 部署用户对 `systemctl` 有权限（root 或 sudo）

首次合并进 master 后看 Actions 日志；探活失败时：

```bash
journalctl -u st-card-builder-api -n 80
journalctl -u st-card-builder-couch -n 40
docker logs stcb-couchdb
```

## Docker Compose（参考）

- **生产同机**：`deploy/docker-compose.couch.yml`（由 CI / `st-card-builder-couch` 拉起）
- **本地开发**：根目录 `docker-compose.yml` + `npm run couch`

```bash
cp server/.env.example server/.env   # 仅本地开发
npm run couch
npm install --prefix server
npm run server:dev
```

## 备份

```bash
# 需 curl + jq；默认备份到 ./backups/
./scripts/backup-couch.sh
```

恢复：将备份的 `.json` 用 Couch `_bulk_docs` 或 `couchdb-backup` 类工具导入对应库。至少演练一次「删测试用户库 → 从备份恢复」。

## 探活

- `GET /api/health` → Couch `ok: true`
- 管理端总览同样读 health

## 上线门禁验收

1. `DEV_LOGIN` 关：调试登录 403  
2. 无邀请码 / 错误邀请码：注册失败；邮箱登录成功可同步  
3. `ADMIN_EMAILS` 运维可开 `/admin`；只读管理员可看不可写；普通用户 403  
4. AI 密钥上传后 Couch 中为密文（`enc: v1`），无明文 key  
5. API 502 时管理端显示诊断条（检查 systemd / 反代 / Couch）
