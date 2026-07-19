# ST Card Builder — 架构与设计手册

> 本文件供新 Agent 会话载入，涵盖项目架构、NSFW/NTL 设计哲学、已完成改动、当前状态。
> 最后更新：2026-07-20（主制卡侧 + 小说工坊架构统一，测试全绿）

---

## 项目概览

- **Astro 5** 单页应用，`src/pages/index.astro` 入口，纯静态输出到 `dist/`
- 所有视图常驻 DOM，`data-view` 切换，`html/body` 锁死 `overflow:hidden`
- 三栏布局：AppSidebar（左）| 主视图 | AssistantPanel（右）
- 状态管理无框架：`window.__get*__/__set*__` 桥接 + CustomEvent + localStorage/IndexedDB
- AI 后端：OpenAI 兼容 Chat Completions API，密钥存 localStorage（明文，用户自管）

---

## 目录结构与模块地图

```
src/lib/
├── utils.mjs                      # 纯函数工具：uid, escapeHtml, crc32, createTextChunk,
│                                  #   deepCopy, strategyLabelZh, parseJsonLoose, truncatePreviewLine
├── idbReady.mjs                   # IDB Promise 异步等待（事件驱动 + 100ms 轮询回退）
├── idbStore.mjs                   # IndexedDB 数据库 open
├── charTags.mjs                   # 角色标签规范化 / 合并 / 上下文构建
├── avatarIdb.mjs                  # 头像 IndexedDB 读写
├── statusBar.mjs                  # 状态栏设计器（30 套主题、HTML 生成、snippet 构建）
├── tavernScripts.mjs              # 酒馆脚本规范化
├── regexScripts.mjs               # 正则脚本规范化
├── aiTaskCenter.mjs               # 全局 AI 任务队列（AbortController 取消）
│
├── card-builder/                  # ══ 制卡主侧（2026-07 重构）══
│   ├── state.mjs                  #   状态工厂 + buildCardJSONFromDraft + genId + 标签/WB 工具
│   ├── stateMachine.mjs           #   localStorage 草稿 CRUD + debounce 存盘
│   ├── browserApp.mjs             #   独立 orchestrator（备用，未接入）
│   ├── shared/
│   │   └── context.mjs            #   共享 ctx 工厂（$、save、callAI、runTracked、showConfirmDialog）
│   └── panels/
│       ├── cardManager.mjs        #   卡片管理：渲染、CRUD、封面缩略图、__assistantCardApi__
│       ├── character.mjs          #   角色设定：字段、标签、头像、NSFW 渲染/同步
│       ├── worldbook.mjs          #   世界书：条目列表、弹窗编辑、搜索筛选、AI 整理/键生成
│       ├── aiEngine.mjs           #   AI 引擎：3 阶段生成、预设、模型 fetch、标签生成、预览
│       └── export.mjs             #   导出 JSON/PNG、导入卡片、PNG chunk 工具
│
├── novel/                         # ══ 小说工坊（2026-07 重构）══
│   ├── state.mjs                  #   状态工厂 + IDB 桶操作（remove/copy）
│   ├── stateMachine.mjs           #   IndexedDB + localStorage 状态持久化
│   ├── browserApp.mjs             #   轻量 orchestrator：ctx 创建 → 面板注册 → 桥接挂载 → boot
│   ├── schema.mjs                 #   角色档案 schema + 规范化
│   ├── nsfwSupport.mjs            #   NSFW/NTL 模板、口味预设、质量门、调色盘引导（962 行）
│   ├── chapters.mjs               #   拆章：标题正则 / 空行密度 / 按字数切片
│   ├── entityStore.mjs            #   实体 CRUD、别名匹配、投影到 characters/wbEntries
│   ├── graphMerge.mjs             #   知识图谱合并与规范化
│   ├── graphViz.mjs               #   @antv/g6 图谱渲染与布局
│   ├── analyzePipeline.mjs        #   分析管道 def
│   ├── recall.mjs                 #   多场景召回
│   ├── rag/                        #   混合 RAG（chunker/embedClient/hybridSearch/indexBuild/keywordSearch/vectorSearch/store/inject/embeddingConfig）
│   ├── sync.mjs                   #   产出同步到主卡（人物→角色设定、条目→世界书）
│   ├── shared/
│   │   ├── context.mjs            #   共享 ctx 工厂（$、setStatus、openNovelModal、confirmExpandRecall）
│   │   └── bridge.mjs            #   助手桥接 + 产出同步（createNovelBridge）
│   └── panels/
│       ├── source.mjs             #   原始资料（上传/清空/重置）
│       ├── chapters.mjs           #   章节拆分/合并/启用/禁用
│       ├── setup.mjs              #   角色设定 + 开场白
│       ├── analyze.mjs            #   完整分析（骨架+丰满+关系）+ 图谱操作
│       ├── characters.mjs         #   人物列表（扫描/丰满/合并/同步）
│       ├── worldbook.mjs          #   世界书条目（抽取/扩展/编辑/同步）
│       └── style.mjs              #   文风蒸馏
│
├── assistant/                     # AI 助手（未变）
│   ├── tools.mjs                  #   工具注册表
│   ├── risk.mjs                   #   风险分级
│   ├── reactParse.mjs             #   ReAct 解析器
│   ├── executor.mjs               #   执行器
│   ├── characterFields.mjs        #   角色字段规范化
│   ├── toolTraceSummary.mjs       #   工具追踪摘要
│   ├── session.mjs                #   会话管理
│   ├── ragInject.mjs              #   RAG 注入
│   └── tokenEstimate.mjs          #   Token 估算
│
├── promptCanon.mjs                # 默认提示词块
├── promptStore.mjs                # 用户 prompt 覆写（localStorage）
│
└── statusBarThemes/               # 30 套状态栏视觉主题（15 美学 × single/multi）

src/styles/
├── tokens.css                     # 设计 token（"夜庭 Nocturne" 暗色调，oklch 色空间）
└── ui-patterns.css                # 共享 UI 组件（面板、按钮、芯片、弹窗、标签等）

tests/                             # 22 个测试文件，346 个测试，全部通过
```

### 架构模式

**ctx → stateMachine → panels 代理模式**（card-builder 和 novel 完全一致）：

```
createXxxState()          # 状态工厂，纯数据
    ↓
createXxxStateMachine()   # 持久化（localStorage / IndexedDB）
    ↓
createXxxContext(sm)      # ctx 工厂：$、save()、callAI()、runTracked()、showConfirmDialog()
    ↓
registerXxxPanel(ctx)     # 各面板注册：ctx.panels.xxx = panel（提供 render/bind/run 方法）
    ↓
window.__get*__/__set*__  # 桥接函数挂到 window
    ↓
CustomEvent 分发           # card-builder-data-changed / card-draft-changed / nsfw-config-changed
```

**窗口桥接**: `index.astro` 中定义 `window.__getXxx__()` / `window.__setXxx__(v, opts)`，面板和 .astro 组件统一通过此桥接读写状态。

**事件流转**:
```
state 变更 → ctx.save() → __set*__() → CustomEvent → 其他 panel/component 响应
```

---

## 数据惯例

- **作者注释** = `creatorNotes`（非 ST 的 `postHistoryInstructions`）。助手执行器自动映射 `postHistoryInstructions` → `creatorNotes`
- 小说工坊存 IndexedDB：`novelWorkshopV3:card:{cardId}`，**不包含在导出 JSON/PNG 中**
- RAG 索引：IndexedDB `novelRagV1:card:{cardId}`
- 草稿 localStorage：`st_v3_builder_drafts`，当前卡：`st_v3_builder_current_id`
- AI 配置：`st_v3_builder_ai_config`（含 API key、模型、NSFW/NTL 口味设置）
- 世界书条目 `comment` = 标题，用于去重和同步
- 头像存 IndexedDB `blob` store，草稿仅存 `avatarInIdb: true` 标记

---

## NSFW/NTL 设计哲学

### 三层调色盘架构

```
第一层：角色核心调色盘（始终存在，与 NSFW 无关）
  └─ persona_layers / tension_pairs / core_desire

第二层：NSFW 口味（开启 NSFW 后叠加）
  └─ desire_palette / sexual_psychology / situational_modulation / aftercare

第三层：NTL 禁忌层（开启 NTL 后叠加，与 NSFW 解耦）
  └─ 8 种禁忌类型 + attrs.ntl
```

### 核心思想

**不是给人物加标签，而是给 AI 一个调色盘**。用 `primary_hue`（主色调）、`accent_hue`（对比色）、`temperature`（冷暖）、`texture`（触感）来描述欲望——
同一张 Kinks 牌在不同调色盘下读起来完全不同。

### 20 种 NSFW 口味预设 + 8 种 NTL 禁忌类型

详见 `src/lib/novel/nsfwSupport.mjs`（962 行），完整定义了口味的 `group/label/description/palette/focus/avoid` 和 NTL 禁忌 `attrs`。

### 全局配置 —— 角色设定是唯一入口

NSFW/NTL 配置存储在 `st_v3_builder_ai_config`，**CharacterPanel 是唯一 UI 入口**。

```
CharacterPanel（唯一配置入口）
    ↓ 读写
st_v3_builder_ai_config (localStorage)
    ↓ nsfw-config-changed 事件
    ├→ 角色卡生成 prompt 注入（AI 引擎/开场白/世界书/标签）
    └→ 小说工坊 pipeline 同步（browserApp 监听事件 → state.adultMode/ntlMode/nsfwFlavor/ntlTabooTypes）
```

**小说工坊原始资料面板**不包含任何 NSFW/NTL 配置 UI——只有分片/召回/处理模式等纯工作流配置。

---

## 共享工具函数 (`src/lib/utils.mjs`)

| 函数 | 用途 | 使用者 |
|---|---|---|
| `uid(prefix)` | 唯一 ID 生成（`prefix + '_' + 8 位 base36`） | novel entityStore、chapters、characters 面板 |
| `genId()` (state.mjs) | 草稿 ID（`draft_` + timestamp） | card-builder stateMachine、cardManager |
| `escapeHtml(text)` | HTML 实体转义 | 所有 innerHTML 写入路径 |
| `crc32(arr)` / `createTextChunk(kw, text)` | PNG tEXt 块生成 | cardManager、export |
| `strategyLabelZh(strategy)` | 世界书策略中文标签 | card-builder worldbook、novel worldbook |
| `deepCopy(obj)` | 深拷贝（优先 structuredClone） | stateMachine、cardManager、bridge |
| `parseJsonLoose(text)` | 宽松 JSON 解析（支持 markdown fence） | 各 AI 响应解析处 |
| `truncatePreviewLine(text)` | 单行截断预览 | worldbook 条目渲染 |
| `normalizeNameList(primary, raw)` | 姓名列表规范化 | 人物分析 |

---

## 已完成的关键改动

### 架构重构（2026-07）

- **主制卡侧拆分**: `index.astro` 3486 行 `is:inline` 脚本 → 468 行 `type="module"` 引导 + 8 个面板文件（~4,400 行）
- **小说工坊拆分**: `browserApp.mjs` 4264 行 → 684 行 orchestrator + 7 个面板文件 + stateMachine + context + bridge（~4,500 行）
- **两侧架构对齐**: 统一 ctx → stateMachine → panels 代理模式，相同的注册/绑定/运行生命周期
- **工具函数统一**: `utils.mjs` 消除 5 个 `uid()` 重复定义、`createTextChunk/crc32` 重复、`strategyLabelZh` 重复
- **深拷贝优化**: 3 处 `JSON.parse(JSON.stringify())` → `deepCopy()`（优先 `structuredClone`）
- **IDB 就绪优化**: 20ms 高频轮询 → 事件驱动（`st-idb-ready`）+ 100ms 低频回退

### 代码质量（2026-07）

- **24 个空 catch 块**: 全部添加 `console.warn('op', err)` 日志
- **3 处无确认删除**: 添加 `confirm('确认删除？')` 守卫（characters / worldbook 面板）
- **弹窗焦点陷阱**: `showConfirmDialog` 添加 Tab 循环 + Escape 关闭 + 焦点恢复
- **XSS 防护**: `index.astro` 中 model ID 回填增加 `escapeHtml()` 包装

### Bug 修复（历史）

- `NovelCharactersPanel.astro` 缺失 `novelModalExpandMeta` 元素
- 图谱按钮在分析期间未禁态
- `beforeunload`/`pagehide` 刷新保护（防抖 280ms）
- 卡片管理封面初始不显示 → `getDraftsForDisplay` 优先保留已存储的 avatar
- 标签行 AI 按钮改为虚线边框小按钮

### NSFW/NTL 增强（历史）

- 20 种口味预设 + 8 种 NTL 禁忌类型
- NTL 人物数据模型（`emptyNtlPersonAttrs` / `normalizeNtlPersonAttrs` / `mergeNtlPersonAttrs`）
- RAG 增强搜索覆盖 7 个 pipeline 场景
- `promptCanon` 更新为调色盘引导写作法

---

## 当前状态

### 测试

- **346/346 测试全部通过**，0 失败
- 22 个测试文件覆盖：侧栏契约、novel 核心、assistant 核心、状态栏、RAG、测试文件路径保持与模块文件同步

### 架构债（已解决）

- ~~`browserApp.mjs` 4266 行巨石~~ → 已拆为 8 面板 + orchestrator
- ~~`index.astro` 3486 行内联脚本~~ → 已拆为模块引导
- ~~多份 uid 生成函数~~ → 统一到 `utils.mjs`
- ~~双份 legacy 数据~~ → adultMode 主字段化

### 已知缺口

- **VariableCardPanel.astro** 仍 2,535 行，含内联 JS——排序最大单体待拆（但作为后制，优先级低）
- 状态栏 NSFW 草案无 NTL 版本
- 开场白面板的口味注入待完善
- 无 lint/typecheck/CI——依赖人工 `npm test && npm run build`
- 无响应式/移动端支持（桌面端专用）
- API 密钥明文存 localStorage（前端无加密手段，用户应知晓）

---

## 开发命令

```bash
npm run dev          # 开发服务器 → http://localhost:4321
npm run build        # 静态构建 → dist/
npm test             # Node.js 原生 test runner（346 tests, 22 files）
npm test -- tests/novelCore.test.mjs  # 单文件测试
```

- 提交前执行 `npm test && npm run build`
- VS Code 推荐插件：`astro-build.astro-vscode`
- 项目 `.mjs` ESM 模块，`var` 为主，纯 JS 无 TypeScript
- GSAP 3 通过 CDN `is:inline` 全局可用
- `@antv/g6 5.x` 客户端侧加载，用于小说工坊关系图谱
