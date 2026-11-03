# 卡侧（Card Builder）

> SoT：本文 + `src/lib/card-builder/*`。字段见 [`../domains/st-card-fields.md`](../domains/st-card-fields.md)。

## Boot

`initCardBuilder()`（`browserApp.mjs` + `fieldValidation.mjs` / `bootAiConfig.mjs`）由 `index.astro` 调用，是卡侧**唯一**启动入口；并挂载主站 Action Engine。

`st-idb-ready`：`hydrateDraftsStore` →（登录时）`ensureCardCloudIndex` → 同步 `loadDraftIntoState` 占住当前卡后再异步灌 bundle；索引 pending 或「已有卡但无 draftId」时不隐式建卡。该事件只发一次，可能早于 boot 监听；`__stIdbReady__` 或 `__idbReady__` 已在时立刻走同一条恢复，用 `st_v3_builder_current_id` 重新选中上次的卡。详见 [`../systems/cloud-sync.md`](../systems/cloud-sync.md)「卡索引就绪门闩」。

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
| `panels/character.mjs` | 角色设定逻辑 API（字段/标签/版本/头像；**不含** NSFW 配置 UI） |
| `panels/characterViewModel.mjs` | 角色设定纯函数视图快照（字段/token/版本/头像/生成弹窗） |
| `panels/characterBridge.mjs` | `__characterPanelApi__` + 标签/头像/JSON 预览旧桥 |
| `panels/characterAvatar.mjs` | 头像主图、画廊 manifest、缩略图 objectURL、上传/选主图/删除 |
| `components/character/*.vue` | 角色设定 Vue 视图（面板/标签/版本/头像/生成弹窗） |
| `store/characterStore.mjs` | 角色设定瞬时 UI 状态（版本基线/token tick/头像/生成弹窗） |
| `regexPanelBoot.mjs` | 正则逻辑 API（选择/新增/删除/移动/启停/测试/自动保存；无 DOM） |
| `panels/regexViewModel.mjs` | 正则纯函数视图快照（列表/自动徽标/placement/编辑器） |
| `store/regexStore.mjs` | 正则瞬时 UI 状态（选中项/编辑草稿/提示/测试弹窗） |
| `components/regex/*.vue` | 正则 Vue 视图（列表/编辑器/测试弹窗） |
| `tavernPanelBoot.mjs` | 酒馆脚本逻辑 API（选择/新增/删除/移动/启停/自动保存；无 DOM） |
| `panels/tavernViewModel.mjs` | 酒馆脚本纯函数视图快照（列表/徽标/编辑器） |
| `store/tavernScriptsStore.mjs` | 酒馆脚本瞬时 UI 状态（选中项/编辑器草稿/提示） |
| `components/tavernScripts/*.vue` | 酒馆脚本 Vue 视图（列表/编辑器） |
| `panels/worldbook.mjs` | 世界书 boot（`registerWorldbook`） |
| `panels/worldbookBridge.mjs` | 世界书 Vue 桥：CRUD/搜索/AI/`__assistantWbAi__` |
| `panels/worldbookViewModel.mjs` | 世界书纯函数快照（行/搜索/编辑/整理预览） |
| `store/worldbookStore.mjs` | 世界书瞬时 UI 状态（搜索/筛选/弹窗/状态） |
| `components/worldbook/WorldbookPanel.vue` | 世界书面板 Vue 视图（列表/搜索/编辑/AI 弹窗） |
| `panels/worldbookShared.mjs` | AI/旧渲染共享逻辑；`renderEntriesList` 可切换为快照发布 |
| `panels/worldbookBind.mjs` | 旧 DOM 绑定（已不再由 boot 调用，保留兼容） |
| `panels/greeting.mjs` | 开场白 boot（`registerGreeting`） |
| `panels/greetingBridge.mjs` | 开场白 Vue 桥：字段/排序/变量起点/AI/旧 window API |
| `panels/greetingViewModel.mjs` | 开场白纯函数快照（开场/token/变量起点提示） |
| `store/greetingStore.mjs` | 开场白瞬时 UI 状态与发布快照 |
| `components/greeting/*.vue` | 开场白 Vue 视图（主开场/备选行） |
| `panels/statusBar.mjs` | 状态栏 boot（`registerStatusBar`） |
| `statusBar/panelBoot.mjs` | 状态栏 Vue 桥：设计/生成/预览/提示词/样例楼层；无 DOM |
| `panels/statusBarViewModel.mjs` | 状态栏纯函数快照（预设/模块/人物/步骤/变量树） |
| `store/statusBarStore.mjs` | 状态栏瞬时 UI 状态与发布快照 |
| `components/statusBar/*.vue` | 状态栏 Vue 视图（四步/预览/变量树/注入脚本） |
| `panels/mvu.mjs` | MVU 变量卡 boot（`registerMvu`） |
| `mvu/variableCardPanel.mjs` | MVU 设计与生成桥：同步/注入/单条变量/推断/导出；无 DOM |
| `mvu/variableCardViewModel.mjs` | MVU 纯函数视图（变量分组/结果清单/节点画布） |
| `store/mvuStore.mjs` | MVU 瞬时 UI 状态与图布局快照 |
| `components/mvu/*.vue` | MVU Vue 视图（变量卡/节点画布/推断/变量预览） |
| `panels/aiEngine.mjs` | AI 引擎 boot（`registerAiEngine`） |
| `panels/aiEngineShared.mjs` | 预设/世界观/持久化 helpers |
| `panels/aiEnginePanel.mjs` | 三阶段生成、Tag、模型拉取 |
| `panels/aiEngineBind.mjs` | 事件绑定 |
| `panels/export.mjs` | JSON/PNG 导入导出 |
| `panels/adultConfig.mjs` | 成人配置 boot（`registerAdultConfig`） |
| `panels/adultConfigShared.mjs` | 口味/表达/世界观 helpers |
| `panels/adultConfigPanel.mjs` | NSFW/NTL/恶堕生成与目录逻辑（Vue 化后不再写 DOM） |
| `panels/adultConfigState.mjs` | 覆盖旧 DOM 方法：state 读写 / 同步 |
| `panels/adultConfigBridge.mjs` | `__adultConfigApi__` + `__getNsfwConfig__` 等旧桥 |
| `panels/adultViewModel.mjs` | 纯函数视图快照（列表/框架/目标/添加目录） |
| `components/adultConfig/*.vue` | 世界与限定 Vue 视图 |

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
| 开场白 | 主开场/备选/变量起点 `input` → `ctx.save()`；token 快照 200ms 防抖 |
| 状态栏 | 勾选/预设/模块/额外要求/排版说明 → `ctx.save()`；样例楼层仅内存 |
| MVU 变量卡 | 设计/图布局/单条变量 → ctx.save()；推断候选仅内存 |
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
