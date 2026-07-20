# 云同步与账户（Node + CouchDB + PouchDB）

> 将能力从「仅浏览器本地」扩展为可选上云同步。正式登录仅 Discord；调试可用临时用户名。

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

打开侧栏 **配置 → 账户与同步**：若 `DEV_LOGIN_ENABLED=true`，输入用户名点「进入」即可调试。

## 同步行为

- 每 **5 分钟**自动同步（已登录时）；也可点「立即同步」。
- 重开后拉云端 **卡列表**（`meta/card-index`）；点开某卡再懒同步正文。
- **API 密钥默认不上云**。在「AI 配置」中单独「同步密钥到云端 / 拉取 / 清除」。

## Discord

- OAuth：`/api/auth/discord`
- `AUTH_ENFORCE_DISCORD_MEMBERSHIP=false`（默认）：不校验服务器/身份组。
- `=true` 且 `DISCORD_GUILD_ID` / `DISCORD_REQUIRED_ROLE_IDS` **留空**：**拒绝所有正式 Discord 注册**（调试登录仍可用）。

## 文档 ID 前缀

`meta/card-index` · `card/{id}` · `novel/{id}` · `rag/{id}` · `story/{id}/…` · `secrets/ai-config` · `prefs/*`

## 迁移

首次打开会把旧 `localStorage` 草稿与 IndexedDB 小说/RAG/story 迁入 Pouch（**不**自动迁 API key）。
