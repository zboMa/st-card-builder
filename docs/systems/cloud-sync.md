# 云端数据与账户（产品化 REST）

> SoT（云端存取 / docIds / 离线 / 分享 / API 配置上云）：本文 + `src/lib/sync/*` + `server/src/data/*`。  
> 认证细节 → [`auth.md`](./auth.md)；管理端 → [`admin.md`](./admin.md)；部署 → [`../ops/production.md`](../ops/production.md)。

将能力从「仅浏览器本地」扩展为**可选云端账户数据**。未登录时 **LS / IndexedDB 全功能离线**；登录后保存走 REST，打开卡时拉取**完整卡包**（避免数据拆碎）。

## 组件

| 层 | 说明 |
|---|---|
| 前端 | `src/lib/sync/cloudApi.mjs` + `cloudStore.mjs` + `outbox.mjs`；本地权威仍为 LS/IDB |
| API | `server/src/data/routes.mjs`：`/api/data/*`（Session / Bearer） |
| 数据库 | CouchDB **一用户一库** `userdb-stcb-{userId}`，**仅服务端 Nano 读写** |

> 已移除：浏览器 Pouch 复制、`GET /api/sync/credentials`、浏览器直连 Couch Basic Auth。旧 `/api/sync/*` 返回 **410**。

## 本地启动

```bash
cp server/.env.example server/.env
npm run couch          # docker compose 起 CouchDB :5984
npm install
npm install --prefix server
npm run server:dev     # :8787
npm run dev            # Astro :4321，/api 代理到 8787
```

打开侧栏 **配置 → 账户与云端**：

- 邮箱登录 / 邀请码注册；未登录可完整离线制卡
- 「立即对齐」：flush 离线队列 → 上传本地卡包 → 拉云端列表（stub）→ 可选水合
- 点开某张云端卡：`GET /api/data/cards/:id/bundle` 灌回 LS+IDB 后正常编辑

## 产品语义（替代旧「三分法同步」）

| 能力 | 行为 |
|---|---|
| **保存** | 始终先写本地；已登录则 `PUT` 云端，失败入 outbox |
| **列表** | `GET /api/data/cards`；仅摘要，正文懒加载 |
| **打开卡** | `GET .../bundle`：卡草稿 + 头像 + **小说工坊** + **RAG**（与卡一套） |
| **写出的小说** | Story Studio 独立：`GET /stories/:cardId/catalog`、打开时拉单部；**不进**开卡 bundle |
| **删除** | 本地确认弹窗；默认删绑卡套件；**可勾选**是否级联删 Story 小说 |
| **偏好** | `PUT /api/data/prefs/ui|prompts`（防抖） |
| **AI 密钥** | `PUT/GET/DELETE /api/data/secrets/ai-config`（客户端口令加密，服务端只存密文） |

## 主要 API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/data/status` | 云端就绪探测 |
| GET/PUT | `/api/data/cards`、`/cards/:id` | 列表 / 单卡草稿 |
| GET/PUT | `/api/data/cards/:id/bundle` | **卡包**（卡+头像+工坊+RAG；不含 Story） |
| DELETE | `/api/data/cards/:id?deleteStories=0\|1` | 删卡；`deleteStories=1` 才级联删写出的小说 |
| GET/PUT | `/api/data/stories/:cardId/catalog` 等 | Story 独立存取 |

文档 ID 约定仍见 `src/lib/sync/docIds.mjs`（与历史 Couch 文档兼容，存量库无需迁移格式）。

## 离线

- 未登录 / 断网：业务照常读写 LS/IDB
- 意图写云端时写入 `localStorage` outbox（`st_v3_cloud_outbox_v1`）
- 重新登录或「立即对齐」时 `flushOutbox`

## 邮箱登录

- `POST /api/auth/register`：`{ email, password, inviteCode }`
- `POST /api/auth/login`：`{ email, password }`
- Session 用户：`{ id: email_<hash>, provider: 'email', email, username, displayName }`

## 角色卡 / 小说分享

分享仍走 `/api/share/*`（发布快照 + 映射库），与云端 REST 并存。详见下文历史章节语义：工作稿 ≠ 分享可见内容；分享读 release。

### 角色卡分享

- **发布快照** `card/{id}/release`：仅在「角色卡管理」点 **发布** 时写入
- **映射**：`stcb-public-shares` → `share/{token}`
- **API**：`/api/share/cards/*`

### 小说分享

- **发布快照** `story/{cardId}/{novelId}/release`
- **读者入口**：`/#share/{token}`

## AI API 配置加密上云

- 账户页填写同步口令（≥6）后加密上传
- 文档 `secrets/ai-config` 含 `enc`（PBKDF2 + AES-GCM），无明文

## 生产注意

- **不要**再要求浏览器可达 `PUBLIC_COUCH_URL`（可保留内网 Couch 给 API）
- Nginx 公网 `/couch/` 可下线；API 仅需本机 `COUCHDB_URL`
- `/api/sync/credentials` 已 410

## 管理端

见 [`admin.md`](./admin.md)。
