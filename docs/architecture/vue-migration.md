# Vue 迁移重构指南

> **状态**：暂停（2026-11-03）。已完成状态栏 + MVU 变量卡；后续批次未开始，进度见 §11。本文件是全项目「Astro 外壳 + Vue 岛 + Nanostores 单一数据源」迁移的唯一规范。
> 任何迁移动作都必须对照本指南；行为或约定变更须同步改本文件。

---

## 0. 北极星（不可动摇的三条）

1. **单一数据源**：每个域（card / novel / story / assistant）有且只有一个权威状态对象，任何时刻 `ctx.state === store.get()`。
2. **写入口唯一**：所有写操作走具名 action；页面/组件只读。
3. **增量可上线**：任何一步做完都能 `npm test` + `npm run build` 通过，旧功能零回归。

违反任一条，这一步就不算完成。

---

## 1. 目标架构

```
Astro 外壳（index.astro / Layout / 侧栏 / hash 视图）
   └─ Vue 岛（client:only="vue"）逐面板替换
         └─ @nanostores/vue useStore(...) 订阅
               └─ Nanostores store（单一数据源）+ 纯逻辑 .mjs（不动）
```

- **Astro 继续管**：页面外壳、侧栏、视图切换、静态结构。
- **Vue 逐步接管**：面板的渲染与交互。
- **Nanostores 管**：跨岛共享状态（Astro 官方推荐的跨岛方案）。
- **纯逻辑 `.mjs` 不动**：`statusBarBuild`、`novel/*`、`storyStudio/*`、同步、导出等约 70% 代码原样保留。

依赖（已安装）：`vue`、`@astrojs/vue@^5`（Astro 5 对应版本）、`nanostores`、`@nanostores/vue`。
`astro.config.mjs` 已注册 `integrations: [vue()]`，输出仍为 `static`。

---

## 2. 状态规范（最重要的一节）

### 2.1 store 一律用 `atom`，共享对象不要用 `map`

Nanostores 的 `map.setKey` 内部是 `{ ...old, [key]: value }`，**会替换对象引用**，导致 `ctx.state` / `sm.state` 持有的旧引用失效，破坏单一对象约束。

```js
// src/lib/store/cardStore.mjs —— ✅ 正确做法
export const cardStore = atom({});

export function setCardKey(key, value) {
  var state = cardStore.get();
  state[key] = value;      // 原地改，引用不变
  cardStore.notify();
  markCardDirty();
}
```

错误示范：`map(initial)` + `store.setKey(...)` 用于 `ctx.state` 这种被大量闭包捕获的对象。

### 2.2 单一数据源检查点

- `initCardStore(createDefaultCardState())` 返回的对象 = `ctx.state` = `sm.state`（`browserApp.mjs`）。
- 初始化后**禁止** `store.set(newObj)` 整体替换；重置 / 换实例用 `replaceCardKeys(next)`（原地增删改顶层 key）。
- 多实例（多卡 / 多小说 / 多 Story）用 `src/lib/store/registry.mjs` 按 `domain:id` 注册；切实例只切活跃引用，**不共享数据**。

### 2.3 写入口与订阅

- 写：`src/lib/store/cardActions.mjs` 的具名 action（内部 `setCardKey`）。新域同理（`novelActions` / `storyActions`）。
- 读：`cardState()` / `computed(cardStore, ...)`。
- 持久化：**订阅者，不是调用方**。`store.subscribe(debounce(save))`；保留 `pagehide` / `visibilitychange` flush。
- 派生值：`computed` 现算，不写回 state。

### 2.4 过渡期「版本信号」生命周期

- 旧面板仍裸写 `ctx.state.x = y` 时，靠 `stateVersion` + `installCardStoreShim`（`ctx.save()` / `card-builder-data-changed` → bump）驱动 Vue 更新。
- **每迁完一个面板**：把该面板写入改成 action，并确认它不再依赖裸写。
- **全部迁完**：删除 `stateVersion` 与 shim，改为精细 `computed` / `listenKeys`。

---

## 3. 组件规范（Vue 岛）

- **用 `client:only="vue"`**：这些面板依赖 `window` / IndexedDB / G6，构建期无法渲染。
- **DOM 归属唯一**：一旦某块 DOM 交给 Vue，**必须删掉旧模块对它的 `innerHTML` 写入与事件委托**，否则双渲染 / 双触发。
- **沿用现有 class**：先复用全局 CSS（`ui-patterns.css` 等），SFC 只加组件私有样式，避免视觉回归。
- **生命周期清理**：G6 / GSAP / 定时器 / `URL.createObjectURL` 必须在 `onBeforeUnmount` 清理。
- **Vue 侧响应式**：`useStore(stateVersion)` 拿版本号再读 `cardStore.get()`；不要指望 `useStore(cardStore)` 在同对象引用下触发更新（Vue 用 `Object.is` 比引用）。
- **按钮 / 图标**：沿用 `ui-patterns.css`（`.btn-inline`、`.btn-icon`、`.ui-search-*` 等），不另起一套。
- 操作结果反馈统一 `ctx.appFeedback` / `appFeedback`（见 `docs/ui/design-system.md`「操作反馈路由」）。

---

## 4. 路由与视图

- **暂时不引入 `vue-router`**：继续用 Astro 现有 hash 视图切换（`data-view` + `app-view`），避免双路由。
- 全部面板迁完后再评估是否换 SPA 路由。

---

## 5. 桥接与兼容

- `window.__get*__ / __set*__`：**签名不变**，内部改调 action；逐面板迁移时再收编。
- `card-builder-data-changed`：过渡期保留；由 shim 统一 bump 版本。
- `ctx.state`：迁移期间保持同一对象；Vue 组件不要持有它的深拷贝当权威。
- **只减不增**：新代码不得再新增 `window.__*__` 桥。

---

## 6. 单页面迁移 SOP（每个面板照做）

1. **盘点**：列出该面板的读点、写点、DOM 节点、事件、存储、副作用（IDB / 网络 / 定时器）。
2. **建模**：状态收进对应 store slice；新增具名 actions；派生用 `computed`。
3. **先切读**：Vue 组件用 store 渲染；旧渲染函数暂时保留但停用（删写 DOM 那段或加开关）。
4. **再切写**：旧事件委托停用，动作转发到 actions 或既有 `panel.*` 方法。
5. **替换挂载**：`.astro` 里换成 `<Xxx client:only="vue" />`；组件根保留原 `id` / `class`。
6. **清理**：删旧 boot / bind 中对应 DOM 逻辑，避免双绑定。
7. **补测试**：纯逻辑测试保留；源码 grep 类测试随迁移更新；必要时加 snapshot 测试。
8. **验收**：`npm test` → `npm run build` → 手测清单（见 §8）。

---

## 7. 迁移顺序（先易后难）

| 批次 | 面板 | 说明 |
|---|---|---|
| 试点 | 角色卡管理（网格列表切片） | 验证「store 快照 + Vue 列表 + 桥接」管线 |
| 2 | TavernScripts / Regex / 小说小面板 | 逻辑已抽离，UI 简单 |
| 3 | Character / Greeting / Worldbook / 小说主面板 | 字段多但结构清晰 |
| 4 | StatusBar / VariableCard / NovelAnalyze | 重交互，纯逻辑齐全 |
| 5 | Assistant / StoryStudio（G6）/ ShareReader / admin | 最复杂，最后动 |

原则：**一次只迁一个面板；迁完一批跑一次全量测试与构建。**

---

## 8. 验收 / Definition of Done

- [ ] `ctx.state === store.get()`，且该面板无新增裸写。
- [ ] 旧 DOM 写入与事件委托已移除（无双触发）。
- [ ] 生命周期资源已清理（缩略图 URL、定时器、图实例）。
- [ ] `npm test` 全绿、`npm run build` 成功。
- [ ] 手测：切换卡、保存 / 刷新恢复、云同步状态、导出 / 分享入口、移动端布局。
- [ ] 相关 `docs/` 契约同步更新。

---

## 9. 常见坑（务必对照）

1. `map.setKey` 换引用 → 破坏单一对象（用 `atom`）。
2. Astro 岛包裹层若影响布局 → `astro-island { display: contents; }`。
3. 新旧都绑事件 → 重复执行（迁移时先删旧委托）。
4. 缩略图 objectURL 不回收 → 内存泄漏（`onBeforeUnmount` revoke）。
5. 持久化时序：500ms debounce + `pagehide` / `visibilitychange` flush 必须保留。
6. `useStore` 同引用不触发更新 → 用 `stateVersion`。
7. 源码 grep 测试会因文件移动失效 → 随迁移同步改。
8. 不要用 `v-html` 承载可交互业务逻辑；试点期若为降险临时使用，须在后续迭代替换为组件并记录 TODO。

---

## 10. 回滚策略

- 每个面板迁移独立、挂载点可回退：`.astro` 恢复旧组件 + 旧 boot 保留一周再删。
- store 层与 Vue 层解耦，回退 Vue 不影响状态层。

---

## 11. 当前进度

- [x] Phase 0：依赖 + Astro Vue 集成 + store 内核（`cardStore` / `cardActions` / `registry`）+ 桥接收口 + 单测。
- [x] 试点：角色卡管理整页 Vue 化（列表/筛选/工具栏/更多菜单/版本菜单/导出检查/导入）。
- [x] AI 助手：标题栏 + 「助手」stage（消息/工具卡/待确认/输入区）+ RAG/上下文弹窗 Vue 化；试聊 / FAB / 移动端 sheet 仍留 Astro。
- [x] 世界与限定（adult-config）：整面板 Vue 化（世界观预设 / 载体框架 / NSFW / 口味 / 表达 / NTL / 恶堕 / 纯爱 / 体系总纲 + 添加弹窗）。
- [x] 小说原始资料（novel-source）：原始资料 / 全局处理配置 / 文件导入 / 重置 Vue 岛化。
- [x] 世界书条目（worldbook）：列表 / 搜索 / 筛选 / 编辑 / AI 单条·整理·触发词 / 整理预览 Vue 化；审计器保留共享弹窗。
- [x] 开场白（greetings）：主开场 / 备选列表 / 排序删除 / 变量起点 / AI 填写 Vue 化；`window.__*` 降级为 cardStore 兼容镜像。
- [x] 状态栏（statusbar）：四步表单 / 预设模块 / 人物勾选 / 变量树 / 预览 / 注入脚本 Vue 化；生成与提示词仍走 panelBoot。
- [x] MVU 变量卡（variable-card）：节点画布 / 推断候选 / 变量预览 / 详情 / 底部操作 Vue 化；设计/注入/助手 API 走桥。
- [ ] 后续批次见 §7；当前暂停，未开始。

> 暂停记录（2026-11-03）：本轮停在状态栏与 MVU 变量卡完成；恢复时先补浏览器手测，再从 §7 第 4 批剩余项（NovelAnalyze）及 AI 配置/引擎等候选继续。

- 验收：`npm test` 958 通过 / 170 suites；`npm run build` 成功；状态栏/MVU 静态 DOM 已从 `dist/index.html` 移除。
- 未完成：状态栏/MVU 真实浏览器手测（变量生成/预览、节点拖拽/连线/缩放/展开大屏）。

### 角色卡管理落地记录（参考实现）

- 视图：`src/components/cardManager/*.vue`（`CardManagerPanel` 根 + 工具栏/筛选/网格/卡片/弹层）。
- 视图快照：`cardListStore.mjs` + `cardManagerViewModel.mjs`（无 DOM，可单测）。
- 桥：`cardManagerBridge.mjs`（`cardManagerApi` 门面 + `installCardManagerBridge`）。
- 业务逻辑复用：`cardManagerCrud/Cloud/PublishShare/Export` 不变；`cardManagerRender` 只产出快照；`cardManagerBind` 只保留事件/助手 API/保存冲刷。
- 导入解析：`cardImportParsers.mjs`（纯函数 + 文件读取）。
- 测试：`tests/cardManagerRender.test.mjs` 已改为快照断言；`tests/sidebarNav.test.mjs`、`tests/exportChecklist.test.mjs` 已同步 Vue 源。

### AI 助手落地记录（方案 B）

- 视图：`src/components/assistant/*.vue`（`AssistantHeader` 标题栏 + `AssistantStage` / `AssistantMessage` / `AssistantToolCard` / `AssistantCompaction` / `AssistantPending` / `AssistantComposer` / `AssistantModals`）。
- 视图快照：`assistantStore.mjs`（`atom` + `patchAssistantView`，`useStore` 直接订阅）+ `assistantViewModel.mjs`（`uiMessages` → 可渲染快照、上下文弹窗快照，纯函数）。
- 桥：`assistantBridge.mjs`（`assistantApi` 门面 + `installAssistantBridge`）；Vue 只调 `assistantApi.*`。
- `panelBoot.mjs` 只保留引擎 / 会话 / shell（模式、移动端）；RAG 与上下文只产出快照，弹窗 DOM 由 `AssistantModals`（Teleport to body）渲染。
- 未迁：`ChatPlayground`（试聊 stage，Astro 岛无法内嵌）、FAB 与移动端 sheet。
- 测试：`readAssistantPanelSources` 已纳入 `src/components/assistant/**` + viewModel + bridge；`tests/assistantCore.test.mjs` 的 DOM 命令式断言已改为 Vue/action 等价断言。

### 角色设定落地记录

- 视图：`src/components/character/*.vue`（`CharacterPanel` + `CharacterTags` + `CharacterVersionBar` + `CharacterAvatarAside` + `CharacterAvatarGallery` + `CharacterAvatarGenModal`）。
- 视图快照：`characterViewModel.mjs`（字段/标签/token/版本/头像/生成弹窗）；UI 态 `characterStore.mjs`（版本基线、token tick、头像、生成弹窗）。
- 逻辑：`character.mjs` 只保留字段/标签/版本/头像/标签 AI 逻辑；DOM 输入、标签、头像、版本与生成弹窗全部由 Vue 接管。
- 头像：`characterAvatar.mjs` 接管 IDB manifest、主图、缩略图 objectURL、上传/选主图/删除；保留已发布卡面禁删。
- 桥：`characterBridge.mjs` 暴露 `window.__characterPanelApi__`，保留 `__get/__setCharTags__`、`__characterApplyAvatarDataUrl__`、`__open/closeJsonPreviewModal__`；JSON 预览继续使用共享 Astro `PreviewPanel` 外壳。
- 删除：`characterPanelBoot.mjs`、`avatarGalleryPanel.mjs`、`imageGen/avatarModal.mjs`。
- 测试：`readCharacterPanelSources` 纳入 Vue/VM/bridge/avatar/store；新增 `tests/characterViewModel.test.mjs`。

### 世界书面板落地记录

- 视图：`src/components/worldbook/WorldbookPanel.vue`（标题/搜索/条目列表/编辑与 AI 弹窗/整理预览）；`WorldbookPanel.astro` 改薄壳并保留共享审计器弹窗。
- 快照：`worldbookViewModel.mjs`（行/搜索/编辑/整理预览）+ `store/worldbookStore.mjs`；权威数据仍是 `cardStore.worldbookEntries`。
- 桥：`worldbookBridge.mjs` 暴露 `window.__worldbookPanelApi__` 与 `__assistantWbAi__`；条目 CRUD/搜索/AI 单条/整理/触发词走桥。
- 共享逻辑：`worldbookShared.mjs` 的 `renderEntriesList` 支持发布快照；AI 生成/重写/触发词逻辑复用。
- 例外：世界书审计器（`WorldbookAuditor.astro`）与关系图仍为共享 Astro/外部弹窗。
- 测试：`readWorldbookPanelSources` 纳入 Astro/Vue/store/VM/bridge；新增 `tests/worldbookViewModel.test.mjs`；更新 sidebar/design/assistant 相关源码断言。

### 开场白落地记录

- 视图：`src/components/greeting/GreetingPanel.vue` + `GreetingAltItem.vue`；`GreetingPanel.astro` 改 Vue 薄壳，保留原 DOM id（`firstMes` / `altGreetingsList` / `btnAddGreeting` 等）与全局样式。
- 快照：`greetingViewModel.mjs`（主开场/备选行/token/变量起点提示）+ `store/greetingStore.mjs`；权威数据仍是 `cardStore` 的 `firstMes` / `altGreetings` / `greetingInitMain` / `greetingInitAlts`。
- 桥：`greetingBridge.mjs` 暴露 `window.__greetingPanelApi__`，保留 `__acceptGreetingTexts__` / `__setGreetingInit__` / `__renderAltGreetings__`；`window.__altGreetings__` 等改为 cardStore 的 getter/setter 兼容镜像。
- 行为：输入走 `setGreetingFields`，token 文本 200ms 防抖；AI 初始值复用 `ctx.fetchAIContent` + `ctx.runTracked` + `greetingInit` 纯函数。
- 测试：`readGreetingPanelSources` 纳入 Astro/Vue/store/VM/bridge；新增 `tests/greetingViewModel.test.mjs`；sidebar 开场白 DOM 断言改读聚合源码。

### 状态栏落地记录

- 视图：`src/components/statusBar/StatusBarPanel.vue` + `StatusBarTree.vue`；`StatusBarPanel.astro` 改 `client:only="vue"` 薄壳，保留四步/预览/变量/注入脚本 DOM id。
- 快照：`panels/statusBarViewModel.mjs`（预设/模块/人物/步骤标记/树）+ `store/statusBarStore.mjs`（视图/预览 HTML/脚本/忙态）；权威设计仍是 `cardBuilderExtensions[STATUS_BAR_EXT_KEY]`。
- 桥：`statusBar/panelBoot.mjs` 改为无 DOM API，经 `registerStatusBar` 在 `browserApp` 启动；保留 `window.__statusBarApi__` 的 `getDesign` / `setDesign` / `getSnapshot` / `applyOptions` / `generateVariables` / `generateLayout` / `editVariables`，另暴露 `__statusBarPanelApi__`。
- 行为：表单写入经 `setCardExtensionField` + `ctx.save()`；生成仍走 `engineTryAllowed` + `ctx.runTracked`，保留预览 iframe / 变量树 / 三楼样例 / 提示词预览。
- 测试：`readStatusBarPanelSources` 纳入 Astro/Vue/store/VM/boot；新增 `tests/statusBarViewModel.test.mjs`，状态栏 DOM 断言改读聚合源码。

### MVU 变量卡落地记录

- 视图：`src/components/mvu/VariableCardPanel.vue` + `MvuGraph.vue` + `MvuInferPanel.vue` + `MvuVariablePreview.vue`；`VariableCardPanel.astro` 改 `client:only="vue"` 薄壳。
- 快照：`variableCardViewModel.mjs`（变量分组/结果清单/固定与动态节点/连线/尺码）+ `store/mvuStore.mjs`（状态/预览/代码/推断/图布局/忙态）；设计权威仍是 `cardBuilderExtensions[zmer_mvu_design]`，图布局写 `zmer_mvu_runtime_graph`。
- 桥：`variableCardPanel.mjs` 改为无 DOM API，经 `registerMvu` 在 `browserApp` 启动；保留 `__applyExternalVariableDesign__` / `__assistantMvuApi__` / `__mvuInferApi__`，另暴露 `window.__mvuPanelApi__`。
- 画布：Vue 渲染节点/连线/端口/代码编辑器，保留拖拽、连线、滚轮缩放、适应、整理、展开大屏；动态变量节点与断线状态由布局扩展驱动。
- 行为：单条生成/重写/删除、推断合并、清除/删除、导出、世界书条目与正则/助手脚本注入均复用原逻辑。
- 测试：`readVariableCardPanelSources` 纳入 Astro/Vue/store/VM/boot；新增 `tests/variableCardViewModel.test.mjs`，更新状态栏与正则相关源码断言。

### 小说原始资料落地记录

- 视图：`src/components/novel/NovelSourcePanel.vue`；`NovelSourcePanel.astro` 改薄壳 `client:only="vue"`。
- 快照：`sourceViewModel.mjs`（表单/文件摘要/统计 chips）+ `store/novelSourceStore.mjs`（状态、拖拽、提示）；`sm.state` 仍是小说权威状态。
- 逻辑：`panels/source.mjs` 的 `render()` 只发布快照，`bind()` 安装 `window.__novelSourceApi__`；字段更新、文件导入/清空、重置、拖拽均走 API，不再读写 DOM。
- 修复：重置改为原地清空/赋值，保持 `ctx.state === sm.state`。
- 测试：`readNovelSourcePanelSources` 纳入 Astro/Vue/source/VM/store；`novelCore.test.mjs` 的源码断言改读聚合源码；新增 `tests/novelSourceViewModel.test.mjs`。

### 正则落地记录

- 视图：`src/components/regex/*.vue`（`RegexPanel` + `RegexList` + `RegexEditor` + `RegexTestModal`）。
- 逻辑：`regexPanelBoot.mjs` 改为纯 API（无 DOM），保留 `window.__regexPanelApi__`、`persistEditor` 与 180ms 自动保存。
- 快照：`regexViewModel.mjs`（列表/自动徽标/placement 摘要/编辑器草稿）；UI 态 `regexStore.mjs`（选中 id、编辑草稿、提示、测试弹窗）。
- 测试弹窗：Vue `Teleport to="body"`，保留 `body.rx-modal-open`、Esc/遮罩/取消关闭；解析仍走 `applyRegexScript` 与当前编辑区。
- 状态：仍通过 `__get/__setRegexScripts__` 写 `regexScripts`；保留 `silent`、`lastRefreshFp`/`refreshFingerprint` 防自刷。
- 测试：`readRegexPanelSources` 纳入 Vue/VM/store；`tests/regexScripts.test.mjs` 的 DOM 断言改为 Vue/API；新增 `tests/regexViewModel.test.mjs`。

### 酒馆脚本落地记录

- 视图：`src/components/tavernScripts/*.vue`（`TavernScriptsPanel` + `TavernScriptList` + `TavernScriptEditor`）。
- 逻辑：`tavernPanelBoot.mjs` 改为纯 API（无 DOM），保留 `window.__tavernScriptsPanelApi__`、`persistEditor` 与 180ms 自动保存。
- 快照：`tavernViewModel.mjs`（列表/自动徽标/编辑器草稿）；UI 态 `tavernScriptsStore.mjs`（选中 id、JSON 文本、提示）。
- 状态：仍通过 `__get/__setTavernHelperScripts__` 写 `tavernHelperScripts`；监听 data/draft/view 事件刷新。
- 测试：`readTavernScriptsPanelSources` 纳入 Vue/VM/store；`tests/tavernScripts.test.mjs` 的 DOM 断言改为 Vue/API；新增 `tests/tavernViewModel.test.mjs`。

### 世界与限定落地记录

- 视图：`src/components/adultConfig/*.vue`（`AdultConfigPanel` 面板 + `AdultDashedList` 通用行 + `AdultAddModal` + `AdultSelect` 增强下拉）。
- 视图快照：`adultViewModel.mjs`（纯函数：行/上限/载体框架/候选/添加目录/预览）+ `adultStore.mjs`（`busy`、`addModal`）。
- 状态：卡状态仍以 `cardStore` + `stateVersion` 为准；写入口 `adultActions.mjs`。
- 逻辑：`adultConfigPanel.mjs` 的 AI 生成 / 目录 / 候选逻辑保留；DOM 渲染/读值/同步方法由 `adultConfigState.mjs` 覆盖为 state 操作。
- 桥：`adultConfigBridge.mjs` 暴露 `window.__adultConfigApi__`，并保留 `__get/__setNsfwConfig__`、`__generate*__`、`__buildAdultPromptHints__`、导出检查等旧 API。
- 兼容：`adultConfigBind.mjs` 已删除；`initCardStore` 初始化后 bump 一次版本号，确保先挂载的 Vue 岛在 store 就绪后重算。
- 测试：`readAdultConfigPanelSources` 纳入 Vue/VM/bridge/state/actions；新增 `tests/adultViewModel.test.mjs`。
