# 云端数据与账户（产品化 REST）

> SoT（云端存取 / docIds / 离线 / 分享 / API 配置上云）：本文 + `src/lib/sync/*` + `server/src/data/*`。  
> 认证细节 → [`auth.md`](./auth.md)；管理端 → [`admin.md`](./admin.md)；部署 → [`../ops/production.md`](../ops/production.md)。

将能力从「仅浏览器本地」扩展为**可选云端账户数据**。未登录时 **LS / IndexedDB 全功能离线**；登录后保存走 REST，打开卡时拉取**完整卡包**（避免数据拆碎）。

## 组件

| 层 | 说明 |
|---|---|
| 前端 | `cloudApi.mjs` + `cloudStore.mjs`（barrel）+ `outbox.mjs`；本地权威仍为 LS/IDB |
| 前端·拆分 | `cloudStoreShared.mjs`（状态/outbox 桥）· `cloudStoreCard.mjs`（卡包/头像/工坊）· `cloudStoreStory.mjs`（Story 独立）· `cloudStorePrefs.mjs`（偏好）；对外仍从 `cloudStore.mjs` import |
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
- 「刷新云端列表」：flush 离线队列 → 拉云端索引（stub）；**不上传**本地卡包
- 卡包上云：卡管理对单卡点「同步上云」；本地已有卡可用「从云端覆盖」
- 点开某张云端卡：`GET /api/data/cards/:id/bundle` 灌回 LS+IDB 后正常编辑

## 产品语义（替代旧「三分法同步」）

| 能力 | 行为 |
|---|---|
| **保存** | 始终先写本地；**不**自动推云（避免制作过程中频繁请求） |
| **上云** | 卡管理「同步上云」：确认前 flush 当前卡本地编辑 → `PUT .../bundle`；失败入 outbox |
| **列表** | 进入卡管理或「刷新云端列表」时 `GET /api/data/cards` 合并云+本地；正文懒加载 |
| **打开卡** | `GET .../bundle`：卡+头像+**小说工坊+RAG**（与卡一套）；卡管理时间旁云标：未上云 / 未同步 / 已同步 |
| **写出的小说** | Story Studio 独立：`GET /stories/:cardId/catalog`、打开时拉单部；**不进**开卡 bundle |
| **删除** | 本地确认弹窗；默认删绑卡套件；**可勾选**是否级联删 Story |
| **卡管理云操作** | 「⋯」：同步上云 · 从云端覆盖 · 删云端；工具栏「同步未上云」批量上云 |
| **偏好** | `PUT /api/data/prefs/ui|prompts`（防抖） |
| **AI 密钥** | `PUT/GET/DELETE /api/data/secrets/ai-config`（客户端口令加密，服务端只存密文） |

## 用户场景（怎么做）

| 场景 | 本地 | 云端 | 用户操作 |
|---|---|---|---|
| **日常制作** | 编辑即 autosave 到 LS/IDB | 不推 | 无需点同步；Network 不应频繁 PUT bundle |
| **首次上云** | 已有草稿 | 无 | 卡管理 →「同步上云」 |
| **改完要上云** | dirty（云标「上云未同步」） | 旧版 | 「同步上云」；云端较新时会警告 |
| **多张待上云** | 多张 dirty | — | 卡管理 →「同步未上云」 |
| **换机 / 另一台有新版本** | 旧 | 新 | 卡管理 →「从云端覆盖」（或先拉列表再覆盖） |
| **只看云上有啥** | 可有 stub | 索引 | 进卡管理或账户「刷新云端列表」 |
| **打开云端 stub 卡** | stub | 有正文 | 点开卡 → `GET .../bundle` 水合 |
| **离线 / 未登录** | 全功能 | — | 不做云操作 |
| **Story 写出的小说** | 独立 | 独立 API | 不进开卡 bundle；删卡可选是否删 Story |

云标三态：无 `localSyncedAt` → **未上云**；有基线且 `updatedAt` ≠ `localSyncedAt` → **上云未同步**；否则 **已同步**。  
手动回归见 [`../ops/regression-checklist.md`](../ops/regression-checklist.md)。

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
- 重新登录或「刷新云端列表」时 `flushOutbox`

## 邮箱登录

- `POST /api/auth/register`：`{ email, password, inviteCode }`
- `POST /api/auth/login`：`{ email, password }`
- Session 用户：`{ id: email_<hash>, provider: 'email', email, username, displayName }`

## 角色卡 / 小说分享

分享仍走 `/api/share/*`（发布快照 + 映射库），与云端 REST 并存。详见下文历史章节语义：工作稿 ≠ 分享可见内容；分享读 release。

### 角色卡分享

- **版本列表** `versions[]`：切版 / 增版 / 发布时写入；**普通保存只写草稿**；**已发条目不可变**
- **发布**：写入该版快照并 `published=true`，草稿自动升小版本；云成功后再落本地（失败回滚）；云端写 `card/{id}/release` + `card/{id}/release/{ver}`（删卡/删小说会清历史版）
- **卡云标**：以 `localSyncedAt` 对齐草稿 `updatedAt`；`markCardSynced` 清除 `pendingUpload`；**无 `localSyncedAt` 一律显示「未上云」**（merge 索引不得单独置 `onCloud`）
- **映射**：`stcb-public-shares` → `share/{token}`
- **API**：`/api/share/cards/*`；info 含 latest + 各已发版 `versions/:ver/json|png`

### 小说分享

- 与卡同语义：`versions[]` + 唯一草稿；**增版**写列表不发；**发布**写已发并草稿再 +1
- **发布快照**：`story/{cardId}/{novelId}/release`（latest）+ `…/release/{displayVersion}`
- **读者**：`/#share/{token}`（latest）与 `/#share/{token}/v/{displayVersion}`（钉版本）
- **API**：`GET /api/share/novels/:token`、`GET /api/share/novels/:token/versions/:ver`

## AI API 配置加密上云

- 账户页填写同步口令（≥6）后加密上传
- 文档 `secrets/ai-config` 含 `enc`（PBKDF2 + AES-GCM），无明文

## 生产注意

- **不要**再要求浏览器可达 `PUBLIC_COUCH_URL`（可保留内网 Couch 给 API）
- Nginx 公网 `/couch/` 可下线；API 仅需本机 `COUCHDB_URL`
- `/api/sync/credentials` 已 410

## 管理端

见 [`admin.md`](./admin.md)。
