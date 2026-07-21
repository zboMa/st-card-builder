# 生产部署清单（L0）

> 多端备份为主；Discord 门禁；密钥仅密文上云。配合 [`cloud-sync.md`](./cloud-sync.md)。

## 组件

| 服务 | 说明 |
|---|---|
| 静态站 | `npm run build` → `dist/`（Caddy/Nginx） |
| API | `server/` Express，默认 `:8787`，反代 `/api/*` |
| CouchDB | 一用户一库 + `stcb-public-shares` + `stcb-admin` |
| 管理端 | `/admin`（仅 `ADMIN_DISCORD_IDS` 白名单） |

## 生产环境变量（必查）

```bash
DEV_LOGIN_ENABLED=false
AUTH_ENFORCE_DISCORD_MEMBERSHIP=true
DISCORD_GUILD_ID=...
DISCORD_REQUIRED_ROLE_IDS=role1,role2
SESSION_SECRET=<长随机串>
COOKIE_SECURE=true          # HTTPS 下必须 true
ADMIN_DISCORD_IDS=123,456   # 纯数字 Discord 用户雪花 ID
PUBLIC_APP_URL=https://your.domain
COUCHDB_URL=http://couchdb:5984
COUCHDB_USER=...
COUCHDB_PASSWORD=...
```

## Docker Compose（参考）

根目录 `docker-compose.yml` 含 CouchDB；API 可用：

```bash
cp server/.env.example server/.env   # 按上表改生产值
npm run couch
npm install --prefix server
npm run server                       # 或用进程管理器托管
npm run build && npx serve dist      # 或 Caddy 指 dist/
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
