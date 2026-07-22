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
| `panels/cardManager.mjs` | 卡列表 boot（`registerCardManager`） |
| `panels/cardManagerShared.mjs` | 共享 state/工具、筛选、封面缩略图 |
| `panels/cardManagerRender.mjs` | 列表渲染、导出检查角标、版本/更多菜单 |
| `panels/cardManagerCrud.mjs` | 草稿 CRUD、加载/保存 |
| `panels/cardManagerPublishShare.mjs` | 增版/切版、发布、分享 |
| `panels/cardManagerCloud.mjs` | 云端上传/拉取/删除 |
| `panels/cardManagerExport.mjs` | JSON/PNG 导出 |
| `panels/cardManagerBind.mjs` | 事件绑定、`__assistantCardApi__` |
| `panels/character.mjs` | 角色设定（**不含** NSFW 配置 UI） |
| `panels/worldbook.mjs` | 世界书 boot（`registerWorldbook`） |
| `panels/worldbookShared.mjs` | 列表/搜索/编辑/AI 生成逻辑 |
| `panels/worldbookBind.mjs` | DOM 绑定 + `__assistantWbAi__` |
| `panels/aiEngine.mjs` | AI 引擎 boot（`registerAiEngine`） |
| `panels/aiEngineShared.mjs` | 预设/世界观/持久化 helpers |
| `panels/aiEnginePanel.mjs` | 三阶段生成、Tag、模型拉取 |
| `panels/aiEngineBind.mjs` | 事件绑定 |
| `panels/export.mjs` | JSON/PNG 导入导出 |
| `panels/adultConfig.mjs` | 成人配置 boot（`registerAdultConfig`） |
| `panels/adultConfigShared.mjs` | 口味/表达/世界观 helpers |
| `panels/adultConfigPanel.mjs` | NSFW/NTL/恶堕 UI 与生成 |
| `panels/adultConfigBind.mjs` | `__getNsfwConfig__` 桥 + DOM 绑定 |

## UI

- 角色卡管理、列表底栏：遵循 [`../ui/design-system.md`](../ui/design-system.md)（`btn-inline`、封面叠字、角标）
- 视图 id 示例：`card-manager`、`character`、`greetings`、`worldbook`、`adult-config`

## 导出边界

导出 ST 卡 **不含** 小说工坊 IDB / RAG / story studio 工作稿。

## 相关

- NSFW 入口：[`../domains/nsfw-ntl.md`](../domains/nsfw-ntl.md)
- 助手：[`assistant.md`](./assistant.md)
