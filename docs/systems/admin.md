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

`/api/admin/` — `overview` | `users` | `shares` | `tokens` | `databases` | `audit` | `backup` | `me`

写操作记入 `stcb-admin` 审计。备份需 `ADMIN_BACKUP_ENABLED=true`。

客户端写入口经 **独立 Action Engine 实例**（同契约，不与主站共享单例）做 ops / busy 门禁 → [`../architecture/action-engine.md`](../architecture/action-engine.md)。

## UI 注意

- 登录门禁与主站共用 `auth-login.css`；隐藏门禁须尊重 `[hidden]`
- 主站账户页 **不** 放「打开管理端」入口（直接访问管理端 URL）

## 相关

- 同步与分享：[`cloud-sync.md`](./cloud-sync.md)
- 部署：[`../ops/production.md`](../ops/production.md)
