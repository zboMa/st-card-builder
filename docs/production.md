# 生产部署清单（L0）

> 多端备份为主；Discord 门禁；密钥仅密文上云。配合 [`cloud-sync.md`](./cloud-sync.md)。

## 组件

| 服务 | 说明 |
|---|---|
| 静态站 | `npm run build` → `dist/`（Caddy/Nginx） |
| API | `server/` Express，systemd **`st-card-builder-api`** |
| CouchDB | 同机 Docker Compose；systemd **`st-card-builder-couch`**（部署探活，不可达则自动拉起） |
| 管理端 | `/admin`（仅 `ADMIN_DISCORD_IDS` 白名单） |

## 生产环境变量（必查）

```bash
DEV_LOGIN_ENABLED=false
AUTH_ENFORCE_DISCORD_MEMBERSHIP=true
DISCORD_GUILD_ID=...
DISCORD_REQUIRED_ROLE_IDS=role1,role2
SESSION_SECRET=<长随机串>
COOKIE_SECURE=true          # HTTPS 下必须 true
ADMIN_DISCORD_IDS=            # 纯数字雪花 ID，逗号分隔；只写服务器 .env，勿进 Git

PUBLIC_APP_URL=https://your.domain

# 同机 Couch：必须是 127.0.0.1/localhost（API 在宿主机，不能写 docker 服务名 couchdb）
COUCHDB_URL=http://127.0.0.1:5984
COUCHDB_USER=admin
COUCHDB_PASSWORD=...
COUCH_AUTO_PROVISION=true     # false=只校验不拉起；无 Docker 时自动拉起会失败并中止部署
```

## GitHub Actions 部署

workflow：`.github/workflows/deploy.yml`（push `master`）。

| 产物 | 服务器路径 |
|---|---|
| 静态站 `dist/` | `/var/www/card`（经 `/var/temp-card` 中转） |
| API `server/` | **`$HOME/st-card-builder/server`**（不覆盖已有 `.env`） |
| 部署资产 | `$HOME/st-card-builder/deploy/`（compose、ensure-couch、unit 模板） |
| Couch 数据卷 | `$HOME/st-card-builder/couch-data/` |
| systemd | `st-card-builder-couch` + `st-card-builder-api` |

### 部署时 Couch 逻辑

1. 读 `server/.env` 的 `COUCHDB_*`，请求 `{COUCHDB_URL}/_up`
2. 已健康 → 跳过
3. 不可达且 `COUCH_AUTO_PROVISION=true` 且 URL 为本机 → `docker compose up -d`（`couchdb:3.4`，端口 `5984`）
4. **无可用 Docker → 部署失败**
5. 外置 / 非本机 URL 不可达 → 部署失败（不会在本机另起一套）

### 服务器一次性准备

```bash
mkdir -p ~/st-card-builder/server
cp /path/to/server/.env.example ~/st-card-builder/server/.env
# 编辑 .env：DEV_LOGIN_ENABLED=false、Discord、Couch、ADMIN_DISCORD_IDS、PUBLIC_APP_URL、COOKIE_SECURE=true …
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
2. Discord 非门禁成员：无法完成注册  
3. 白名单管理员可开 `/admin`；普通用户 403  
4. AI 密钥上传后 Couch 中为密文（`enc: v1`），无明文 key  
