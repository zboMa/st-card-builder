# 卡侧（Card Builder）

> SoT：本文 + `src/lib/card-builder/*`。字段见 [`../domains/st-card-fields.md`](../domains/st-card-fields.md)。

## Boot

`initCardBuilder()`（`browserApp.mjs` + `fieldValidation.mjs` / `bootAiConfig.mjs`）由 `index.astro` 调用，是卡侧**唯一**启动入口；并挂载主站 Action Engine。

切卡 / 删卡 / 复制 / 新建 / 导入 / 切版本在重任务进行中 **硬禁**（含 `__assistantCardApi__`）。详见 [`action-engine.md`](./action-engine.md)。

## 结构

| 路径 | 职责 |
|---|---|
| `browserApp.mjs` | boot 入口 |
| `fieldValidation.mjs` | 字段字典与 JSON 校验 |
| `bootAiConfig.mjs` | AI 配置持久化与 `window.__*` 桥 |
| `state.mjs` | 状态工厂、`buildCardJSONFromDraft`、标签/WB 工具 |
| `stateMachine.mjs` | 草稿 CRUD + debounce（落盘经 `draftsStore` → IndexedDB） |
| `../draftsStore.mjs` | 卡草稿 IDB 唯一权威（内存缓存） |
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
| `panels/worldbookShared.mjs` | 列表/搜索/编辑/AI（虚拟列表 `virtualList` + 委托） |
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

## 本地草稿保存触发矩阵

> 落盘目标：IndexedDB `cardDraftsV1`（唯一权威；内存缓存同步读写；无 localStorage）；核心 API：`stateMachine.saveDraft()` / `draftsStore`。  
> **内容未变**时不刷新 `updatedAt`、不写盘（`draftContentEqual`，见 `state.mjs`）。  
> 真实落盘时写入 `contentRev`（正文 CRC，见 `sync/contentRev.mjs`），云 dirty 主判据。

### 底层入口

| 入口 | 防抖 | sync DOM 文本 | 最终调用 |
|---|---|---|---|
| `ctx.save()` | 500ms | 否 | `saveDebounced` → `saveDraft` |
| `saveCurrentDraft()` | 否 | 是 | `saveDraft` |
| `debouncedUpdateAndSave()` | 500ms | 是 + 预览 | `saveCurrentDraft` |
| `flushSave()` / `flushUpdateAndSave()` | 否（清 timer） | flush 路径会 sync | `saveDraft` |

### 用户交互（制卡）

| 区域 | 触发 |
|---|---|
| 角色设定 | 文本 `input` / 版本 `change` → `debouncedUpdateAndSave`；标签 → `saveCurrentDraft`；头像 → `saveDraft` |
| 世界书 | 增删改 / AI 应用 → `ctx.save()`；删条目 → `ctx.flushSave()` |
| 成人配置 | 开关/表单 → `ctx.save()` |
| AI 引擎 / MVU | 脚本与生成 → `ctx.save()` / `triggerGlobalUpdate` |
| 导入导出 | `applyJSONFromEditor`、头像导入 → `saveCurrentDraft`；导出当前卡前 → `saveCurrentDraft` |
| 卡管理 | 新建 → `saveCurrentDraft`；增版/切版前 → `saveCurrentDraft` |

### 非点击但仍会落盘

| 触发 | 原因 |
|---|---|
| `pagehide` / `visibilitychange`（hidden） | 冲掉 debounce，防关页丢编辑（`cardManagerBind.mjs`） |
| 导入 / AI 写回 / 助手 API | 代码写入 state 后需持久化 |
| 导出 / 发布 / 增版前 save | 保证读到最新 DOM/ state |

### 不经 `saveDraft` 的例外

- `cloudStoreShared.writeDrafts`：云端水合写入 drafts map（同步子系统）
- 其余 drafts 变更应经 `stateMachine.saveDraft` / `writeDraftsMap` / `patchDraftRecord` / `renameDraft` 等 API

### 小说工坊

独立链：`novel/stateMachine` → IndexedDB `novelWorkshopV3:card:*`；`ctx.save()` 防抖；同样 `pagehide` flush。  
**不**写入制卡 drafts；上云随卡包手动同步。

## 相关

- NSFW 入口：[`../domains/nsfw-ntl.md`](../domains/nsfw-ntl.md)
- 助手：[`assistant.md`](./assistant.md)
