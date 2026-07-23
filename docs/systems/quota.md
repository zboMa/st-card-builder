# 云端配额（SoT）

> 本地制卡不限；配额约束**云端写入**、**活跃分享**、**插件 Bearer** 数量。

## 档位

| 档位 | 标识 | 默认上限 |
|---|---|---|
| 注册基础 | `registered` | 云卡 10 · 容量 500MB · 分享 3 · Story/卡目录 5 · 设备 3 · 批量上云 5 |
| 会员 | `member` | 云卡 50 · 5GB · 分享 20 · Story/卡目录 30 · 设备 10 · 批量 20 |
| 管理员 | `admin` | 不限 |

用户 registry 文档 `user/{userId}` 可设 `quotaTier: 'member'`。Discord 会员 Role 映射后续可在登录回调写入。

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/data/quota` | `{ tier, limits, usage, warnings[] }` |
| GET | `/api/data/export` | 导出云卡索引 + bundle + prefs（不含 AI 密钥明文） |
| GET | `/api/data/cards/:id/conflict` | 云端摘要（rev / 世界书条数等） |
| GET | `/api/auth/tokens` | 当前用户 Bearer 列表 |
| DELETE | `/api/auth/tokens/:docId` | 吊销设备 |

超限：`413` + `{ error: 'quota_*', quota: {...} }`

## 拦截点

- `PUT /api/data/cards/:id/bundle` — 卡数量 / 容量
- `POST /api/share/cards` / `POST /api/share/novels` — 新建分享
- `PUT /api/data/stories/:cardId/catalog` — 目录条数
- Discord 插件 Bearer 签发

## 前端

- 账户页「云端用量」「同步中心」：`quotaClient.mjs` + `syncCenter.mjs`
- 卡管理上云 / 分享前：`ensureCloudQuota()`

## 相关

- [`cloud-sync.md`](./cloud-sync.md)
- [`auth.md`](./auth.md)
