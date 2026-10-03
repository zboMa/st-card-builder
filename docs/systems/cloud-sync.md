# 云端数据与账户（产品化 REST）

> SoT（云端存取 / docIds / 离线 / 分享 / API 配置上云）：本文 + `src/lib/sync/*` + `server/src/data/*`。  
> 认证细节 → [`auth.md`](./auth.md)；管理端 → [`admin.md`](./admin.md)；部署 → [`../ops/production.md`](../ops/production.md)。

将能力从「仅浏览器本地」扩展为**可选云端账户数据**。未登录时 **LS / IndexedDB 全功能离线**；登录后保存走 REST，打开卡时拉取**完整卡包**（避免数据拆碎）。

## 组件

| 层 | 说明 |
|---|---|
| 前端 | `cloudApi.mjs` + `cloudStore.mjs`（barrel）+ `outbox.mjs`；本地权威仍为 LS/IDB |
| 前端·拆分 | `cloudStoreShared.mjs`（状态/outbox 桥）· `cloudStoreCard.mjs`（卡包/头像/工坊）· `cloudStoreStory.mjs`（Story 独立）· `cloudStorePrefs.mjs`（偏好）· `cardCloudIndex.mjs`（卡索引就绪门闩）；对外仍从 `cloudStore.mjs` / `sync/index.mjs` import |
| API | `server/src/data/routes.mjs`：`/api/data/*`（Session / Bearer） |
| 数据库 | CouchDB **一用户一库** `userdb-stcb-{userId}`，**仅服务端 Nano 读写** |

> 已移除：浏览器 Pouch 复制、`GET /api/sync/credentials`、浏览器直连 Couch Basic Auth。旧 `/api/sync/*` 返回 **410**。

## 助手会话随卡

- **按卡隔离**：AI 助手会话与撤销快照按 `draftId` 存储（`assistantSessionKeyFor` / `assistantSnapshotKeyFor`，无卡回退全局键）；切卡即切换对应会话。
- **随卡上云**：`PUT /cards/:id/bundle` 携带 `assistant` 字段；`GET .../bundle` 水合时写回该卡会话键。旧全局会话在首次加载时一次性迁移到首张卡（标记 `st_v3_builder_assistant_session_migrated_v1`）。
- **删卡**：本地与云端级联删除该卡 assistant 会话。

## 本地启动

```bash
cp server/.env.example server/.env
npm run couch          # docker compose 起 CouchDB :5984
npm install
npm install --prefix server
npm run server:dev     # :8787
npm run dev            # Astro :18826（127.0.0.1），/api 代理到 8787
```

> dev 端口固定 `127.0.0.1:18826`（`astro.config.mjs` 顶层 `server`）：原 `8826` 落在 Windows 排除段 `8781–8880`（Hyper-V/WinNAT 等），绑定会 `EACCES`。改端口仅影响本地 dev。  
> Windows 上 API 跑在 WSL（NAT）时，开发代理解析 Ubuntu 地址再转到 `:8787`（保留 `/api` 前缀）。本机 `127.0.0.1:8787` 到不了 WSL。可用 `DEV_API_PROXY` 覆盖目标。

打开侧栏 **配置 → 账户与云端**：

- 邮箱登录 / 邀请码注册；未登录可完整离线制卡
- **Session 探测**：见 [`auth.md`](./auth.md)「浏览器 session 探测门闩」；无本地 hint 时不打 `/api/auth/status`，打开本页或 OAuth 回跳时会 `force` 探测一次
- 「刷新云端列表」：flush 离线队列 → 拉云端索引（stub）；**不上传**本地卡包
- 卡包上云：卡管理对单卡点「同步上云」；本地已有卡可用「从云端覆盖」
- 点开某张云端卡：`GET /api/data/cards/:id/bundle` 灌回 LS+IDB 后正常编辑

## 产品语义（替代旧「三分法同步」）

| 能力 | 行为 |
|---|---|
| **保存** | 始终先写本地；**不**自动推云（避免制作过程中频繁请求） |
| **上云** | 卡管理「同步上云」：确认前 flush 当前卡本地编辑 → `PUT .../bundle`；失败入 outbox |
| **列表** | boot 登录后与进入卡管理 /「刷新云端列表」时 `GET /api/data/cards` 合并云+本地；正文懒加载 |
| **打开卡** | `GET .../bundle`：卡+头像+**小说工坊+RAG+助手会话**（与卡一套）；**不含**试聊 transcript / Episode IDB / Promotion L0（§6.3.6–§6.3.8，仅本地 IDB/LS）；卡管理时间旁云标：未上云 / 未同步 / 已同步 |
| **写出的小说** | Story Studio 独立：`GET /stories/:cardId/catalog`、打开时拉单部；**不进**开卡 bundle |
| **删除** | 本地确认弹窗；默认删绑卡套件；**可勾选**是否级联删 Story |
| **卡管理云操作** | 「⋯」：同步上云 · 从云端覆盖 · 删云端；工具栏「同步未上云」批量上云 |
| **偏好** | `PUT /api/data/prefs/ui|prompts`（防抖） |
| **AI 密钥** | `PUT/GET/DELETE /api/data/secrets/ai-config`（客户端口令加密，服务端只存密文；包内含 AI 主配置、Embedding、搜索、生图 `imageConfig`） |

## 用户场景（怎么做）

| 场景 | 本地 | 云端 | 用户操作 |
|---|---|---|---|
| **日常制作** | 编辑即 autosave 到 LS/IDB | 不推 | 无需点同步；Network 不应频繁 PUT bundle |
| **首次上云** | 已有草稿 | 无 | 卡管理 →「同步上云」 |
| **改完要上云** | 本地有新改动（↑ 云标） | 旧版 | 「同步上云」 |
| **云端他端已更新** | 旧 | 新（↓ 云标） | 「从云端更新 / 覆盖」 |
| **双方都有新改动** | 新 | 新 | 列表显示 ↑+↓；先拉或先推需用户选择 |
| **多张待上云** | 多张需上传 | — | 卡管理 →「同步未上云」（不含仅云端新） |
| **换机 / 另一台有新版本** | 旧 | 新 | 卡管理 →「从云端覆盖」（或先拉列表再覆盖） |
| **只看云上有啥** | 可有 stub | 索引 | boot 已登录会预拉；或进卡管理 / 账户「刷新云端列表」 |
| **打开云端 stub 卡** | stub | 有正文 | 点开卡 → `GET .../bundle` 水合 |
| **离线 / 未登录** | 全功能 | — | 不做云操作 |
| **Story 写出的小说** | 独立 | 独立 API | 不进开卡 bundle；删卡可选是否删 Story |

### 卡索引就绪门闩（防空卡竞态）

登录态下，本地 hydrate 后会 `ensureCardCloudIndex()`（`cardCloudIndex.mjs`），状态：`idle | pending | ready | error | disabled`。

- **pending** 且本地 drafts 为空：禁止 `saveDraft` 隐式 `genId` 落盘（角色页打字不抢建空卡）；显式「新建」仍可用
- **本地已有卡但 `draftId` 为空**（例如正在拉云端 bundle）：同样禁止隐式 `genId`；`loadDraft` 会先同步 `loadDraftIntoState` 占住当前卡
- **ready** 后若有 stub/正文卡：boot 优先恢复非空当前卡（空本地孤儿不抢选中，但不删除）
- **删光本地唯一卡**：先 force 拉索引；有云卡则切过去，确认无卡才 `createBlankDraft`
- **合并不做孤儿修剪**：`pullCloudCardIndexAndMerge` 只按 id upsert stub，不因「像空卡」删除本地草稿

云标五态（卡管理封面 meta 行）：无 `localSyncedAt` / `syncedContentRev` 基线 → **未上云**；基线对齐 → **已同步**；仅本地新 → **本地有新改动**（↑）；仅索引/远端 manifest 新于基线 → **云端有更新**（↓）；双方分叉 → **↑+↓**。判据：`contentRev` + 索引 `cloudContentRev` + `localAvatarsManifestRev` / `cloudAvatarsManifestRev` + `localVersionsManifestRev` / `cloudVersionsManifestRev` + `bundleTouch`（工坊/RAG 等）。旧卡无 `contentRev` 时回退 `updatedAt` vs `localSyncedAt`。  
手动回归见 [`../ops/regression-checklist.md`](../ops/regression-checklist.md)。

## 主要 API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/data/status` | 云端就绪探测 |
| GET/PUT | `/api/data/cards`、`/cards/:id` | 列表 / 单卡草稿 |
| GET/PUT | `/api/data/cards/:id/bundle` | **卡包**（卡+头像+工坊+RAG+助手会话；**不含**试聊 transcript / `chatEpisodeV1` / `promotionLogV1` / Story） |
| DELETE | `/api/data/cards/:id?deleteStories=0\|1` | 删卡；`deleteStories=1` 才级联删写出的小说 |
| GET/PUT | `/api/data/stories/:cardId/catalog` 等 | Story 独立存取 |

文档 ID 约定仍见 `src/lib/sync/docIds.mjs`（与历史 Couch 文档兼容，存量库无需迁移格式）。

## 离线

- 未登录 / 断网：业务照常读写 LS/IDB。不请求 `/api/data/quota` 与 `/api/auth/tokens`。账户页倒计时只改本地文案；这两个接口在登录成功、进入账户页、同步结束时拉。
- 意图写云端时写入 `localStorage` outbox（`st_v3_cloud_outbox_v1`）
- 重新登录或「刷新云端列表」时 `flushOutbox`

## 邮箱登录

- `POST /api/auth/register`：`{ email, password, inviteCode }`
- `POST /api/auth/login`：`{ email, password }`
- Session 用户：`{ id: email_<hash>, provider: 'email', email, username, displayName }`

## 角色卡 / 小说分享

分享仍走 `/api/share/*`（发布快照 + 映射库），与云端 REST 并存。详见下文历史章节语义：工作稿 ≠ 分享可见内容；分享读 release。

### 角色卡分享

- **版本列表**：持久化在 IDB `cardVersionsV1:{cardId}`（不进工作稿 JSON）；切版 / 增版 / 发布时 commit；**autosave 不写 versions**；云端增量 doc `card/{id}/versions/manifest` + `…/snapshots/{ver}`
- **卡面 gallery**：IDB `cardAvatarsV1:{cardId}` + 内容寻址 blob；工作稿只存 `activeAvatarId`；每卡最多 **20** 张，2048/512 JPEG；云端 `card/{id}/avatars/manifest` + `avatar/blobs/{hash}`；上/下拉与 bundle 并行（bundle 仍带当前 active 头像以兼容旧服务端）
- **发布**：写入该版快照并 `published=true`，草稿自动升小版本；云成功后再落本地（失败回滚）；云端写 `card/{id}/release` + `card/{id}/release/{ver}`（删卡/删小说会清历史版）
- **卡云标**：`resolveCardCloudStatus` + `markCardSynced`（含 manifest rev 基线）；`mergeCloudIndexIntoMeta` 可写入 `cloudContentRev` 与 manifest rev 字段；发布门禁与列表共用同一判定
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
