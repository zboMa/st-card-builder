# 文档体系索引

> **改代码前先找真相源（SoT）。** 行为变更必须在同一 PR 更新对应 SoT；禁止在 README / 局部注释另立一套规范。

文档分三层。**必读只有契约和指南。** [`archive/`](./archive/) 不是依据。

| 层 | 是什么 | 改代码时 |
|---|---|---|
| 契约 | `architecture/`、`domains/`、`systems/`、`ui/design-system.md`、`ops/production.md`、`ops/nginx.md` | 行为变了就改对应文件 |
| 指南 | `guides/` | 教人怎么用，不规定代码结构 |
| 档案 | `archive/` | 不改、不当 SoT |

## 怎么找文档

| 你要做什么 | 读哪里 |
|---|---|
| Agent / 贡献者硬约束 | [`../AGENTS.md`](../AGENTS.md) |
| UI 按钮、tip、搜索条、空态 | [`ui/design-system.md`](./ui/design-system.md) |
| 壳层场景主题（已实施） | [`ui/design-system.md`](./ui/design-system.md)、`src/lib/theme/`；场景规格见 [`ui/theme-scenes-v3-final.md`](./ui/theme-scenes-v3-final.md)（M3–M5 不是契约） |
| 邮箱/Discord 登录、Session | [`systems/auth.md`](./systems/auth.md) |
| 云端数据 REST、分享、密钥上云、配额 | [`systems/cloud-sync.md`](./systems/cloud-sync.md)、[`systems/quota.md`](./systems/quota.md) |
| 管理端权限与 API | [`systems/admin.md`](./systems/admin.md) |
| NSFW/NTL/恶堕层与入口 | [`domains/nsfw-ntl.md`](./domains/nsfw-ntl.md) |
| ST 卡字段名（creatorNotes 等） | [`domains/st-card-fields.md`](./domains/st-card-fields.md) |
| 壳层启动、模块地图 | [`architecture/overview.md`](./architecture/overview.md) |
| 核心设计思想（四模块、已决契约 §6、试聊 §5.3） | [`architecture/core-design-philosophy.md`](./architecture/core-design-philosophy.md) |
| 操作引擎 / 重任务互斥 | [`architecture/action-engine.md`](./architecture/action-engine.md) |
| 小说工坊 / 分析管道 | [`architecture/novel-workshop.md`](./architecture/novel-workshop.md)、[`architecture/novel-analysis.md`](./architecture/novel-analysis.md) |
| 助手工具与风险 | [`architecture/assistant.md`](./architecture/assistant.md) |
| 卡侧面板 | [`architecture/card-builder.md`](./architecture/card-builder.md) |
| 小说创作（story studio） | [`architecture/story-studio.md`](./architecture/story-studio.md) |
| Story 千章规模（Spine/Body/Memory · L1） | [`architecture/story-scale.md`](./architecture/story-scale.md) |
| 试聊运行时 | [`architecture/chat-runtime.md`](./architecture/chat-runtime.md) |
| 生产部署 / Nginx | [`ops/production.md`](./ops/production.md)、[`ops/nginx.md`](./ops/nginx.md) |
| 发版前手测 | [`ops/regression-checklist.md`](./ops/regression-checklist.md)（自动化以 `npm test` 为准） |
| 写卡教程 / 目录扩写质量 | [`guides/`](./guides/)（**§2.0 多人卡原生**） |
| 精品卡写法（样本，不搬原文） | [`guides/card-craft-samples.md`](./guides/card-craft-samples.md) |

## 真相源（SoT）

| 主题 | SoT | 不要当 SoT |
|---|---|---|
| UI 模式 | `docs/ui/design-system.md` + `src/styles/ui-patterns.css` + `tokens.css` | 各面板私有大按钮样式；`archive/` 里的主题旧稿 |
| 认证 | `docs/systems/auth.md` + `server/src/auth/*` + `server/.env.example` | README 过时登录描述 |
| 同步 / Couch | `docs/systems/cloud-sync.md` + `src/lib/sync/docIds.mjs` | 本机 `COUCHDB_URL` 当浏览器地址 |
| ST 卡字段 | `docs/domains/st-card-fields.md` + `src/lib/assistant/characterFields.mjs` | 随手猜的 ST 字段名 |
| NSFW / NTL | **代码** `src/lib/adult/**`；规则见 `domains/nsfw-ntl.md`（**禁止文档写死口味数量**） | README / 旧架构里的数量 |
| 部署 | `docs/ops/production.md` + `deploy/` + `.github/workflows/deploy.yml` | 「没有 CI/Docker」类传言 |
| 产品级设计思想 | `docs/architecture/core-design-philosophy.md`（§1–§7、§10；§5.3、§6） | `archive/philosophy-tracker-2026-08.md` 的快照和票表 |
| 主题场景 | `src/lib/theme/` + `docs/ui/design-system.md` | v3 文内未实施的 M3–M5 |

## 目录约定

```
docs/
  README.md           ← 本索引
  architecture/       契约：代码如何组织与启动
  domains/            契约：字段、成人内容
  systems/            契约：auth / sync / admin
  ui/                 契约：design-system；theme-scenes-v3 只作已实施场景规格
  ops/                契约：production、nginx；regression-checklist 是手测单
  guides/             指南：教程与目录写作标准
  archive/            档案：不是契约
```
