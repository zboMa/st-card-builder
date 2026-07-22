# 卡侧（Card Builder）

> SoT：本文 + `src/lib/card-builder/*`。字段见 [`../domains/st-card-fields.md`](../domains/st-card-fields.md)。

## Boot

`initCardBuilder()`（`browserApp.mjs`）由 `index.astro` 调用，是卡侧**唯一**启动入口。

## 结构

| 路径 | 职责 |
|---|---|
| `state.mjs` | 状态工厂、`buildCardJSONFromDraft`、标签/WB 工具 |
| `stateMachine.mjs` | localStorage 草稿 CRUD + debounce |
| `shared/context.mjs` | `$`、save、callAI、runTracked、确认框 |
| `panels/cardManager.mjs` | 卡列表/封面/发布分享入口 |
| `panels/character.mjs` | 角色设定（**不含** NSFW 配置 UI） |
| `panels/worldbook.mjs` | 世界书条目 |
| `panels/aiEngine.mjs` | 一键生成三阶段 |
| `panels/export.mjs` | JSON/PNG 导入导出 |
| `panels/adultConfig.mjs` | 成人配置（NSFW/NTL SoT UI） |

## UI

- 角色卡管理、列表底栏：遵循 [`../ui/design-system.md`](../ui/design-system.md)（`btn-inline`、封面叠字、角标）
- 视图 id 示例：`card-manager`、`character`、`greetings`、`worldbook`、`adult-config`

## 导出边界

导出 ST 卡 **不含** 小说工坊 IDB / RAG / story studio 工作稿。

## 相关

- NSFW 入口：[`../domains/nsfw-ntl.md`](../domains/nsfw-ntl.md)
- 助手：[`assistant.md`](./assistant.md)
