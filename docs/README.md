# 文档体系索引

> **改代码前先找真相源（SoT）。** 行为变更必须在同一 PR 更新对应 SoT；禁止在 README / 局部注释另立一套规范。

## 怎么找文档

| 你要做什么 | 读哪里 |
|---|---|
| Agent / 贡献者硬约束 | [`../AGENTS.md`](../AGENTS.md) |
| UI 按钮、tip、搜索条、空态 | [`ui/design-system.md`](./ui/design-system.md) |
| 壳层精品场景主题（换肤/特效） | [`ui/theme-scenes-v3-final.md`](./ui/theme-scenes-v3-final.md) |
| 邮箱/Discord 登录、Session | [`systems/auth.md`](./systems/auth.md) |
| 云端数据 REST、分享、密钥上云、配额 | [`systems/cloud-sync.md`](./systems/cloud-sync.md)、[`systems/quota.md`](./systems/quota.md) |
| 管理端权限与 API | [`systems/admin.md`](./systems/admin.md) |
| NSFW/NTL/恶堕层与入口 | [`domains/nsfw-ntl.md`](./domains/nsfw-ntl.md) |
| ST 卡字段名（creatorNotes 等） | [`domains/st-card-fields.md`](./domains/st-card-fields.md) |
| 壳层启动、模块地图 | [`architecture/overview.md`](./architecture/overview.md) |
| **操作引擎 / 重任务互斥** | [`architecture/action-engine.md`](./architecture/action-engine.md) |
| 小说工坊 / 分析管道 | [`architecture/novel-workshop.md`](./architecture/novel-workshop.md)、[`architecture/novel-analysis.md`](./architecture/novel-analysis.md) |
| 助手工具与风险 | [`architecture/assistant.md`](./architecture/assistant.md) |
| 卡侧面板 | [`architecture/card-builder.md`](./architecture/card-builder.md) |
| 小说创作（story studio） | [`architecture/story-studio.md`](./architecture/story-studio.md) |
| 试聊运行时 | [`architecture/chat-runtime.md`](./architecture/chat-runtime.md) |
| 生产部署 / Nginx | [`ops/production.md`](./ops/production.md)、[`ops/nginx.md`](./ops/nginx.md) |
| 升级路线 / 回归 / 基线 | [`ops/upgrade-roadmap.md`](./ops/upgrade-roadmap.md)、[`ops/product-roadmap-v1.md`](./ops/product-roadmap-v1.md)、[`ops/competitive-research-2026.md`](./ops/competitive-research-2026.md)、[`ops/regression-checklist.md`](./ops/regression-checklist.md)、[`ops/baseline-metrics.md`](./ops/baseline-metrics.md) |
| 写卡教程 / 目录扩写质量 | [`guides/`](./guides/) |

## 真相源（SoT）

| 主题 | SoT | 不要当 SoT |
|---|---|---|
| UI 模式 | `docs/ui/design-system.md` + `src/styles/ui-patterns.css` + `tokens.css` | 各面板私有大按钮样式 |
| 认证 | `docs/systems/auth.md` + `server/src/auth/*` + `server/.env.example` | README 过时登录描述 |
| 同步 / Couch | `docs/systems/cloud-sync.md` + `src/lib/sync/docIds.mjs` | 本机 `COUCHDB_URL` 当浏览器地址 |
| ST 卡字段 | `docs/domains/st-card-fields.md` + `src/lib/assistant/characterFields.mjs` | 随手猜的 ST 字段名 |
| NSFW / NTL | **代码** `src/lib/adult/**`；规则见 `domains/nsfw-ntl.md`（**禁止文档写死口味数量**） | README / 旧架构里的数量 |
| 部署 | `docs/ops/production.md` + `deploy/` + `.github/workflows/deploy.yml` | 「没有 CI/Docker」类传言 |
| 升级执行 | `docs/ops/upgrade-roadmap.md` + `regression-checklist.md` + `baseline-metrics.md` | 口头约定无文档 |

## 目录约定

```
docs/
  README.md           ← 本索引
  architecture/       代码如何组织与启动
  domains/            业务领域契约（字段、成人内容）
  systems/            跨端系统（auth / sync / admin）
  ui/                 视觉与交互契约
  ops/                生产与运维
  guides/             给人看的教程与目录写作标准
```

## 旧路径

根下旧文件名已改为跳转 stub，请改用上表路径。
