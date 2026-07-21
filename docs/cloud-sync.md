# 云同步与账户（Node + CouchDB + PouchDB）

> 将能力从「仅浏览器本地」扩展为可选上云同步。正式登录优先邮箱（邀请码注册）；Discord OAuth 仍保留，可用开关暂时隐藏。调试可用临时用户名。

## 组件

| 层 | 说明 |
|---|---|
| 前端 | `pouchdb-browser` 本地库 `stcb-pouch-v1`；业务文档模型见 `src/lib/sync/docIds.mjs` |
| API | `server/` Express：`/api/auth/*`、`/api/sync/credentials`、`/api/health` |
| 数据库 | CouchDB **一用户一库** `userdb-stcb-{userId}` |

## 本地启动

```bash
cp server/.env.example server/.env
npm run couch          # docker compose 起 CouchDB :5984
npm install            # 根依赖含 pouchdb-browser
npm install --prefix server
npm run server:dev     # :8787
npm run dev            # Astro :4321，/api 代理到 8787
```

打开侧栏 **配置 → 账户与同步**：

- `AUTH_EMAIL_ENABLED=true` 时用邮箱登录；注册需 `INVITE_CODES`（或 `INVITE_CODE`）中的邀请码。
- `AUTH_DISCORD_LOGIN_ENABLED=false` 时隐藏 Discord 按钮（路由仍可用）。
- `DEV_LOGIN_ENABLED=true` 时可输入用户名点「进入」调试。

## 同步行为

- 每 **5 分钟**自动同步（已登录时）；也可点「立即同步」。
- 重开后拉云端 **卡列表**（`meta/card-index`）；点开某卡再懒同步正文。
- **API 密钥默认不上云**。在「AI 配置」中单独「同步密钥到云端 / 拉取 / 清除」。
- 浏览器经 `/api/sync/credentials` 拿到 `dbUrl` 后，由 PouchDB **直连** Couch（Basic Auth）。
  - 生产 `dbUrl` 必须是 `PUBLIC_COUCH_URL`（如 `https://card-api.taojiu.love/couch/userdb-…`）
  - **不要**把服务端本机 `COUCHDB_URL=http://127.0.0.1:5984` 发给浏览器
  - Nginx：`deploy/nginx-card-api.conf.example`

## 邮箱登录

- `POST /api/auth/register`：`{ email, password, inviteCode }`（密码 ≥8，PBKDF2 存 Couch `email-auth/{email}`）
- `POST /api/auth/login`：`{ email, password }`
- Session `user`：`{ id: email_<hash>, provider: 'email', email, username, displayName }`
- `/api/auth/status` 暴露 `emailAuthEnabled` / `emailRegistrationOpen` / `discordLoginEnabled`，**从不**返回邀请码
- 管理端白名单：`ADMIN_EMAILS` / `ADMIN_READONLY_EMAILS`（与 Discord ID 白名单并存）

## Discord

- OAuth：前端打开 `{PUBLIC_API_URL}/api/auth/discord?return_to=…` → API 再 302 到 Discord authorize → callback 写 Session → 回 `return_to`
- 管理端独立静态站 `/var/www/card-admin`；主站 `/var/www/card`；Session 可用 `SESSION_COOKIE_DOMAIN` 共用
- `AUTH_ENFORCE_DISCORD_MEMBERSHIP=false`（默认）：不校验服务器/身份组。
- `=true` 且 `DISCORD_GUILD_ID` / `DISCORD_REQUIRED_ROLE_IDS` **留空**：**拒绝所有正式 Discord 注册**（调试登录仍可用）。
- `AUTH_DISCORD_LOGIN_ENABLED`：仅控制 UI 展示；国内服务器若无法访问 Discord API，建议先关 UI，改用邮箱。

## 文档 ID 前缀

`meta/card-index` · `card/{id}` · `card/{id}/release` · `card/{id}/release/{character_version}` · `novel/{id}` · `rag/{id}` · `story/{id}/…` · `story/{cardId}/{novelId}/release` · `secrets/ai-config` · `prefs/*`

## 角色卡分享（登录 + 可选密码）

- **工作稿** `card/{id}` 随同步更新；**不等于**分享可见内容。
- **发布快照** `card/{id}/release` + 版本档 `card/{id}/release/{character_version}`：仅在「角色卡管理」点 **发布** 时写入（版号 = 酒馆 `character_version`）。
- **映射**：`stcb-public-shares` 文档 `share/{token}`，`type: card-share` → `{ ownerUserId, cardId, passwordHash?, pngPublic?, expiresAt? }`。
- **访问规则**：
  - 信息页 / 版本 JSON：必须登录（Session 或插件 Bearer）+ 可选分享密码。
  - PNG 直链（作者开启 `pngPublic`）：持链可匿名下载**最新** PNG（内含完整卡数据）。
- **API**（前缀 `/api/share/cards`）：
  - `POST /publish`（登录）发布 JSON + 可选 PNG
  - `POST /`（登录）创建/更新分享；`DELETE /:token` 停分享
  - `GET /:token`、`GET /:token/versions/:ver/json`（登录 + 密码）
  - `GET /:token/png`（可选匿名）
- **插件**：仓库 `extensions/sillytavern-card-share/`；API 固定 `PUBLIC_API_URL`（生产 `https://card-api.taojiu.love`）；登录走 `/api/auth/discord?client=st_plugin` → Bearer。
- **环境变量**：`PUBLIC_API_URL`（分享链接 Origin）；`PUBLIC_APP_URL` / `PUBLIC_ADMIN_URL` 自动进 CORS 白名单。`CORS_ORIGINS` 可追加额外源，或设 `*` 放行任意 Origin（带 Cookie 时反射请求 Origin，不是字面 `ACAO:*`）。

## 小说分享（只读链接）

- **工作稿** `story/{cardId}/{novelId}` 随同步更新，供作者多端编辑。
- **发布快照** `story/{cardId}/{novelId}/release`：仅用户在「小说管理」点 **增版** 时写入；分享链接**只读 release**，不会暴露开发态草稿。
- **版号**：完整展示版 = 酒馆 `character_version` + `-` + 小说 `novelVersion`（如 `1.2-3`）。卡版本不另开字段；小说版号仅主动增版时变化，**不用同步时间当版本**。
- **映射**：公开库 `stcb-public-shares` 文档 `share/{token}` → `{ ownerUserId, cardId, novelId, expiresAt? }`。
- **API**：`POST /api/share/novels`（登录；可 `resetToken` / `expiresInDays`）、`GET /api/share/novels/:token`（公开）、`DELETE /api/share/novels/:token`（登录停用）。
- **读者入口**：`/#share/{token}` 只渲染阅读壳。
- **管理 UI**：落后提示（草稿超前于已发布）、重置链接、可选过期天数。

## 密钥加密上云

- AI 配置中填写**同步口令**（≥6）后「加密同步到云端」。
- 文档形态：`secrets/ai-config` 含 `enc`（PBKDF2 + AES-GCM），**无明文**。
- 新设备：同步后「拉取并解密」；口令错误则失败，服务端无法代解密。

## 管理端

- 页面：`/admin`（Nocturne 深色，与主站一致）
- 权限：
  - `ADMIN_DISCORD_IDS` / `ADMIN_EMAILS` → **运维**（读写）
  - `ADMIN_READONLY_DISCORD_IDS` / `ADMIN_READONLY_EMAILS` → **只读**
- 模块：仪表盘、用户、分享（卡/小说 + 软停用/硬删）、插件 Token、Couch 库一览与孤儿提示、审计（筛选/导出）、系统健康与可选逻辑备份
- API：`/api/admin/overview|users|shares|tokens|databases|audit|backup|me`
- 写操作均记入 `stcb-admin` 审计；备份需 `ADMIN_BACKUP_ENABLED=true`
- 管理库：`stcb-admin`（用户注册表 + 邮箱认证文档 + 审计 + Bearer）

## 生产清单

见 [`production.md`](./production.md)。

## 迁移

首次打开会把旧 `localStorage` 草稿与 IndexedDB 小说/RAG/story 迁入 Pouch（**不**自动迁 API key）。
