# 管理端

> SoT：本文 + `server/src/admin/*` + `src/lib/admin/browserApp.mjs`。认证见 [`auth.md`](./auth.md)。

## 访问

- 页面：`/admin`（独立静态站 `dist-card-admin`，生产如 `card-admin.taojiu.love`）
- 须已登录且 `getAdminRole(user)` 非空  
  - 运维：`ADMIN_EMAILS` / `ADMIN_DISCORD_IDS`  
  - 只读：`ADMIN_READONLY_EMAILS` / `ADMIN_READONLY_DISCORD_IDS`

## 模块

仪表盘、用户、分享、插件 Token、Couch 库、审计、系统（健康/备份）

## API 前缀

`/api/admin/` — `overview` | `me` | `perms` | `users`(+`/disable`|`/password`|`/:id/overview`) | `cards`(+`/:u/:c/{disable,restore,export}`) | `novels`(+`/:u/:c/:n/{disable,restore}`) | `shares` | `tokens` | `databases` | `audit` | `moderation/{flags,approvals}` | `backup`(+`/backups`) | `oplog` | `loginlog` | `params` | `dicts` | `files` | `invites` | `quota/users` | `reports/trends` | `system-status` | `roles` | `menus`

写操作记入 `stcb-admin` 审计。备份需 `ADMIN_BACKUP_ENABLED=true`。

客户端写入口经 **独立 Action Engine 实例**（同契约，不与主站共享单例）做 ops / busy 门禁 → [`../architecture/action-engine.md`](../architecture/action-engine.md)。

## UI 注意

- 登录门禁与主站共用 `auth-login.css`；隐藏门禁须尊重 `[hidden]`
- 主站账户页 **不** 放「打开管理端」入口（直接访问管理端 URL）

## 相关

- 同步与分享：[`cloud-sync.md`](./cloud-sync.md)
- 部署：[`../ops/production.md`](../ops/production.md)

---

# 第二代升级：系统型后台（当前实施中）

目标：把「功能型后台」升级为「系统型后台」——不改代码即可完成角色/菜单/参数/日志/任务/文件/内容管理。

## 权限点（perm）

写操作一律要求权限点；读端点只要求 `isAdminUser`。权限点命名 `{域}.{动作}`：

| 域 | 权限点 | 语义 |
|---|---|---|
| admin | `admin.user.disable` / `admin.share.toggle` / `admin.share.delete` / `admin.token.revoke` / `admin.token.purge` / `admin.backup.run` | 既有写操作（原有 6 个） |
| content | `content.card.read` / `content.card.disable` / `content.card.delete` / `content.card.export` / `content.novel.read` / `content.novel.disable` / `content.novel.delete` / `content.novel.export` / `content.share.disable` | 卡/小说/分享内容管理 |
| moderation | `moderation.review`（审核处置）/ `moderation.approve`（高危审批）/ `moderation.resolve`（申诉） | 审核合规 |
| sys | `sys.role.manage` / `sys.menu.manage` / `sys.param.manage` / `sys.dict.manage` / `sys.log.view` / `sys.task.manage` / `sys.task.trigger` / `sys.file.manage` / `sys.invite.manage` / `sys.quota.manage` / `sys.backup.manage` / `sys.monitor.view` / `sys.user.manage` | 系统底座 |

**种子角色**（`role/` 文档，不可删除，可改权限）：
- `ops`：全部权限点（含 admin.*）
- `readonly`：无任何写权限点；仅读端点

旧 `getAdminRole()`/`isOpsAdmin()` 语义保留为兼容层，等价于「角色归并权限点后是否含对应 admin.* 权限」。新接口一律走 `requirePerm('xxx')`。

## 数据模型（stcb-admin 库文档 type 前缀）

| 前缀 | type | 用途 |
|---|---|---|
| `user/{id}` | user-registry | 已有；增 `roles[]`、`lastActiveAt`、`lastIp` |
| `role/{id}` | role | RBAC 角色（name/desc/perms[]/menus[]/builtin） |
| `menu/{id}` | menu | 菜单树（parentId/name/path/perm/icon/order） |
| `sys-param/{key}` | sys-param | 运行时参数（env 白名单键可覆盖） |
| `dict/{type}` | dict | 数据字典（items[]） |
| `sys-oplog/{ts}-{r}` | sys-oplog | 操作日志（who/action/target/ip/ua/result/at） |
| `sys-login/{ts}-{r}` | sys-login | 登录日志 |
| `task/{id}` | task | 定时任务（schedule/type/enabled/lastRun） |
| `task-run/{taskId}/{ts}` | task-run | 任务执行记录 |
| `file/{id}` | file | 后台文件元数据（磁盘路径/大小/类型） |
| `invite/{code}` | invite | 邀请码（status/usedBy/expiresAt） |
| `mod-flag/{id}` | mod-flag | 举报（target/type/reason/status） |
| `mod-action/{id}` | mod-action | 审核/审批动作记录 |
| `card/{userId}/{cardId}` | card-index-entry | 卡聚合索引条目 |
| `novel/{userId}/{cardId}/{novelId}` | novel-index-entry | 小说聚合索引条目 |
| `backup-run/{ts}` | backup-run | 备份历史 |
| `event/{ts}-{r}` | event | 行为埋点（用户端 POST `/api/data/event`） |
| `auth-lock/{email}` | auth-lock | 登录失败锁定（`auth.loginFailLock` 参数控制） |

## 埋点与趋势

- 用户端：`src/lib/track.mjs` `track(name, extra)` → POST `/api/data/event`（fire-and-forget，静默失败）。
- 管理端：`GET /api/admin/reports/trends?days=N` 按日聚合事件/注册/新卡；仪表盘折线展示。
- 事件落在 `stcb-admin` 的 `event/` 文档，量大会膨胀，建议趋势任务定期清理（未来由调度器补充）。

## 内容索引与处置

- **聚合索引**：`server/src/index/aggregate.mjs` 扫描全部 `userdb-stcb-*`，把卡/小说元数据汇入 `stcb-admin` 索引条目（`card/{userId}/{cardId}` / `novel/{userId}/{cardId}/{novelId}`）。写入/删除走增量钩子，定时任务全量重建兜底。
- **索引条目字段（卡）**：`userId/cardId/charName/updatedAt/contentRev/wbCount/bundleBytes/avatar/charTags[]/nsfw/characterVersion/createdAt/novelCount/storyCount/share{token,enabled,expired}|null/moderated{status,by,at,reason}`。
- **索引条目字段（小说）**：`userId/cardId/novelId/title/updatedAt/published/chapterCount/moderated`。
- **下架（软）**：在用户库 `card/{cardId}` 或 `story/{cardId}/{novelId}` 文档写 `moderation:{status:'removed',by,at,reason}`（force），用户端读/同步路径过滤 `moderation.status==='removed'`；索引条目同步标记。恢复=清该字段。
- **删除（硬）**：危险操作，走 `moderation.approve` 审批流，二次确认 + 操作日志。

## 调度器

`server/src/scheduler.mjs`：`setInterval` 每分钟扫描 `task/` 文档，按 `schedule`（cron 表达式子集 / 固定间隔）触发，写 `task-run/`。内建任务：`index.rebuild`（全量重建聚合索引）、`backup.periodic`（周期备份）、`token.purge`（清理过期 token）。管理端可启停 / 手动触发 / 看执行记录。

## 参数与字典

- 参数读取顺序：`config.mjs` env 权威 → `sys-param` 白名单键覆盖。白名单键定在 `server/src/sysparams.mjs`。
- 字典：`/api/admin/dicts` CRUD；前端硬编码下拉逐步字典化（用户状态 / 分享类型 / 审计动作 / 审核状态）。

## 里程碑

| 期 | 内容 |
|---|---|
| P1 | 数据模型 + 聚合索引 + 调度器 + RBAC/菜单 |
| P2 | 卡/小说/分享内容管理 + 用户档案 |
| P3 | 举报/审核队列/申诉/审批流 |
| P4 | 日志/参数/字典/文件/邀请码/配额/备份/监控/用户增强 |
| P5 | 埋点 + 趋势报表 |
