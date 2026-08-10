# 认证（Auth）

> SoT：本文 + `server/src/auth/*` + `server/src/config.mjs` + `server/.env.example`。  
> 同步凭证与 Couch 对外地址见 [`cloud-sync.md`](./cloud-sync.md)。

## 现状策略

- **正式入口优先邮箱**：邀请码注册 + 密码登录  
- Discord OAuth **保留路由**，可用 `AUTH_DISCORD_LOGIN_ENABLED=false` 隐藏 UI（国内 API 常无法换 token）  
- 调试：`DEV_LOGIN_ENABLED` → `POST /api/auth/dev-login`（生产必须关）

## 环境变量

| 变量 | 作用 |
|---|---|
| `AUTH_EMAIL_ENABLED` | 开邮箱注册/登录 |
| `INVITE_CODES` / `INVITE_CODE` | 注册邀请码（从不下发前端） |
| `AUTH_DISCORD_LOGIN_ENABLED` | UI 是否展示 Discord |
| `AUTH_ENFORCE_DISCORD_MEMBERSHIP` | Discord 门禁（Guild/Role） |
| `ADMIN_EMAILS` / `ADMIN_READONLY_EMAILS` | 邮箱管理员 |
| `ADMIN_DISCORD_IDS` / `ADMIN_READONLY_DISCORD_IDS` | Discord 管理员 |
| `SESSION_SECRET` / `COOKIE_SECURE` / `SESSION_COOKIE_DOMAIN` | Session Cookie |
| `PUBLIC_APP_URL` / `PUBLIC_ADMIN_URL` / `PUBLIC_API_URL` | 回调与 CORS |

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/auth/status` | 用户 + 公开开关（含 `emailAuthEnabled`、`discordLoginEnabled`、`emailRegistrationOpen`） |
| POST | `/api/auth/register` | `{ email, password, inviteCode }` |
| POST | `/api/auth/login` | `{ email, password }` |
| POST | `/api/auth/logout` | 清 Session |
| POST | `/api/auth/dev-login` | 调试用户名 |
| GET | `/api/auth/discord` | OAuth 入口 |
| GET | `/api/auth/discord/callback` | OAuth 回调 |

密码：PBKDF2，存 Couch `email-auth/{email}`；用户注册表 `user/{id}`。

Session 用户形态（邮箱）：

```json
{ "id": "email_<hash>", "provider": "email", "email", "username", "displayName" }
```

## 前端入口

- 主站：`AccountSyncPanel.astro`（登录门禁 + 已登录同步）
- 管理端：`admin.astro` + `src/lib/admin/browserApp.mjs`（仅登录，注册在主站）
- 样式：`src/styles/auth-login.css`（`.auth-login-screen[hidden]` 必须 `display:none !important`）

### 浏览器 session 探测门闩（`authSessionHint.mjs`）

- localStorage 键 `st_v3_auth_session_hint`：标记「本机曾成功登录过」。
- **无 hint**：首屏 boot **不**请求 `GET /api/auth/status`（避免离线/未部署 API 时进页弹连接失败）。
- **有 hint**：boot 与进入 **账户与同步** 视图时会探测；失败可 toast/notify（见 `design-system.md`「云账户探测」）。
- **进入 `#account-sync`**：`force` 探测一次，便于仅有 Cookie、尚无 hint 的老会话恢复 UI；OAuth 回调 hash 含 `auth` 时同样 `force` 且失败不 notify。
- 登录成功 / `showLoggedIn` 写入 hint；登出清除 hint。

## 相关

- 管理端角色：[`admin.md`](./admin.md)
- 生产清单：[`../ops/production.md`](../ops/production.md)
