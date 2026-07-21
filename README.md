# ST Card Builder

面向 SillyTavern 的浏览器端角色卡、世界书与辅助工作流编辑器。项目基于 Astro，编辑结果保存在浏览器草稿中，可导入、导出并继续在 SillyTavern 中使用。

## 功能

- 左侧边栏菜单式工作台（角色卡制作 / 小说 / 完成制作 / 配置），切换视图保留未保存数据；支持 `#view-id` 深链。
- **全局 AI 任务中心**：侧栏标题「卡片构建器」右侧显示 `已完成/全部`（如 `1/5`），点击打开居中任务列表；统一登记世界书/人物/文风/引擎/助手等 AI 任务，支持停止单任务或全部进行中、清除已完成。
- **右栏 AI 辅助助手**（ReAct + 工具调用）：与角色/世界书/MVU/小说/导出共用同一状态；小改自动应用，大改先预览确认；支持补丁撤销与会话本地保存。
- 角色卡基础信息编辑与预览。
- 独立「开场白」模块：主开场（`first_mes`）与备选开场（`alternate_greetings`）。
- 内嵌世界书条目的创建、编辑、搜索、AI 扩写与触发词整理。
- AI 配置（横向三 Tab：API / 酒馆预设 / AI 引擎选项）、预设导入；「角色设定」右上角 **AI 引擎** 弹窗一键生成角色、世界书骨架与开场白（三阶段，后续阶段注入前序结果作参考）。
- 提示词配置：可编辑各生成环节与助手提示词，默认值为内置模板，持久化到 `localStorage`（`st_v3_builder_prompts`）。
- 世界书审计与本地试聊（试聊问题可经助手回流建议改卡）。
- 变量卡、「状态栏」、独立「正则」与「酒馆脚本」模块：状态栏紧凑分步（人数→预设→生成覆盖 MVU→排版→注入）+ 大预览；左栏固定底栏（上一步/下一步同行）+ 分段人数 + 短卡网格 + AI 工具行；排版=一对一视觉主题（**15 美学族 × 单人/多人 = 30 套**，一主题一文件于 `src/lib/statusBarThemes/`，按人数严格过滤；核心 10 族结构互异——手帐 Tab / CRT / 蜡封 / 卷轴 / 装备栏 / 日记 / HUD / 水墨 / 仪表盘 / 古书，非统一换皮）+ **自定义排版**（AI 按描述生成 HTML/CSS，可基于现有主题或从零生成并迭代）；多人**入选角色人人同套详字段、同信息量**（无「其他角色」精简区）；**勾选模块须在预览中可见**（无硬截断丢字段；多人全局任务/事件单独展示）；模块勾选即时联动预览；题材预设与 NSFW 组合；支持独立勾选「只识别女角色」（不嵌套在 AI 按钮内），无配角摘要；正则面板两栏编辑、实时保存与测试弹窗；酒馆脚本面板对齐同交互（实时保存、行内删除、中文标签，无测试弹窗），管理 `tavern_helper.scripts`（与 MVU/状态栏注入共存）。
- 独立「角色卡管理」模块：预览卡片网格（默认 4 列，窄屏自适应；封面/卡名/更新时间/当前标记）、新建/切换/删除/复制/重命名；右上角新建+导入；**每张卡底部**可导出该卡 JSON/PNG（ST 格式，不含小说工坊）；浏览器本地保存。头像高清图（长边 ≤2048px）与封面缩略图（≤512px）存 **IndexedDB**，草稿 JSON 仅存 `avatarInIdb` 标记；小说工坊大文本同样走 IndexedDB 分桶。
- 「角色设定」支持角色标签（紧凑 chip +「AI 生成」/ 输入 / 添加）；对接 ST `tags` / `data.tags`；AI 生成合并进现有标签，上下文按「AI 配置 → AI 引擎」字数上限截断（默认 12k）。
- 「世界书条目」：标题行右上小号横排（单条生成 / 智能整理 / 补全触发词 / 新建）；下方仅搜索筛选 + 条目列表；搜索结果为单列紧凑命中行（整行可点跳转展开）；AI 配置为真弹窗；列表为折叠预览（标题 + 常驻/可选彩色 tag + 右侧图标操作），点编辑/新建走居中弹窗。
- 小说工坊：原始资料 → 拆章 → 角色设定/开场白 → **小说分析**（RAG + 实体抽取 + G6 关系图谱）→ **人物列表 / 世界书条目**（结果展示，扫描/抽取为降级）→ 文风蒸馏；助手问答可混合检索原文注入。详见 [`docs/novel-analysis-architecture.md`](docs/novel-analysis-architecture.md)。

## 界面结构

三栏布局：`左侧菜单（顶部品牌区）` + `主工作区` + `右栏 AI 助手`。全站壳层视觉见 [`docs/design-system.md`](docs/design-system.md)（**夜庭 Nocturne** token + `ui-patterns.css` 共享组件：深靛底 + 玫瑰紫 accent + 磨砂面板 + chip/按钮层级）。无全宽顶栏；侧栏顶部品牌区为「卡片构建器 / 一个简单的制卡器」，标题右侧为 AI 任务进度徽章（无任务时隐藏），无版本或访客 tag。侧栏导航为线性 SVG 图标（非 emoji）。助手不是侧栏菜单项，默认与主区并排且占满右栏高度。视口高度锁死（`html/body` 与主壳 `overflow: hidden`），仅主工作区、助手对话区与侧栏中间菜单各自内部滚动；侧栏为三段式——顶固定品牌、中可滚业务菜单、底固定「配置」组。世界书 / 拆章 / 角色设定·开场白生成 / 人物·世界书抽取 / 文风蒸馏 / 角色试聊激活时面板占满主区剩余高度（配置固定，列表或预览区内滚）。

| 分区 | 菜单项 | 说明 |
|---|---|---|
| 角色卡制作 | 角色卡管理、角色设定、开场白、世界书条目、状态栏、MVU 变量节点、正则、酒馆脚本 | 管理 → 设定（含 AI 引擎弹窗）→ 开场白 → 世界书 → … |
| 小说 | 原始资料、拆章、角色设定、开场白、小说分析、人物列表、世界书条目、文风 | 主路径分析含图谱；列表展示实体；扫描/抽取为降级；助手 RAG 问答 |
| 完成制作 | 角色试聊、JSON 实时追踪、世界书内容监测 | 试聊：标题行右上（调试右侧为重置/重生成）；配置固定 / 对话区（含世界书触发标签）内滚 / 输入固定；导入导出在「角色卡管理」 |
| 配置（固定底部） | AI 配置、提示词配置 | 三 Tab：API 配置 / 酒馆预设 / AI 引擎选项；含 AI 助手系统提示 |

### 全局 AI 任务中心

- **入口**：侧栏品牌区标题「卡片构建器」右侧 `已完成/全部`（如 `1/5`）；无任务时隐藏。
- **弹窗**：居中列表，进行中置顶；可停止单任务 / 停止全部进行中 / 清除已完成。
- **覆盖类型**：世界书单条生成/整理/补键/重写/扩写、人物扫描/AI 扩展、世界书条目抽取/条目 AI 扩展、小说分析（骨架/丰满/关系）、文风蒸馏、小说角色设定/开场白生成、AI 引擎一键生成、角色标签 AI 生成、助手 ReAct、角色试聊、世界书审计、状态栏人物识别/变量设计生成等。
- **实现**：`src/lib/aiTaskCenter.mjs` + `AiTaskCenterUI.astro`；各面板经 `AbortController` 可取消进行中的 `fetch`。
- **小说长任务停止**：侧栏任务列表点「停止」对应任务（或「停止全部」）。扫描全书 / AI 抽取 / 小说分析 / 文风蒸馏进行中按钮 loading+disabled；取消后恢复并提示「已取消」；分片循环在领取下一片前检查 `signal`。

### 右栏 AI 助手（摘要）

- **用法**：底部「快捷」默认收起，点击弹出预设列表（chips 挂真实工具名），选中后填入输入框并关闭（不直接发送）；点外或再点「快捷」也可关闭；发送 / 清空 / 撤销为小按钮横排；对话区展示回复与工具轨迹；大改时下方折叠「待确认变更」。
- **状态**：标题左侧绿点表示就绪；忙碌/提示用 tip，无独立「就绪」文案位；无折叠按钮。
- **未配置 AI**：发送时仅 tip 提示去「AI 配置」，不发起对话、不以大红错误框打断。
- **写入规则**：单字段微调、单条世界书增改 → 自动应用；删除、整段覆盖、批量补丁、整卡/骨架生成、小说全量合并、MVU 注入、多卡切换/删除 → 确认后应用；`撤销` 恢复上一补丁快照（含小说桶）。
- **定向修改**：世界书 / 小说人物 / 开场白支持 `target`（id|titleMatch|index）+ `mode`（rewrite|expand|patch）+ `instruction`；先定位再改。
- **角色字段名**：助手写入角色设定时用 `charName` / `charDesc` / `creatorNotes` 等规范名；**作者注释 = `creatorNotes`**（勿用 ST 的 `postHistoryInstructions`，本应用无独立 Author's Note 字段）；未知字段会被拒绝并提示。
- **不做**：头像处理；代导出 JSON/PNG（仅 `export_card_check` / `get_export_preview`）；读写 API Key。
- **会话键**：`st_v3_builder_assistant_session`；快照栈：`st_v3_builder_assistant_snapshots`。

#### 助手工具全表（按域）

| 域 | 工具 | 风险 |
|---|---|---|
| 只读 | `get_character_*` / `get_worldbook_*` / `search_card_content` / `audit_worldbook` / `lint_for_sillytavern` / `get_chat_feedback` / `get_mvu_state` / `get_novel_workspace` / `novel_list_outputs` / `get_export_preview` / `export_card_check` / `list_cards` / `get_engine_options` / `get_prompt_ids` | none |
| 角色/开场白 | `update_character_fields` / `replace_character_section` / `expand_character_field` / `rewrite_greeting` / `expand_greeting` / `update_alternate_greeting` | auto↑confirm |
| 世界书 | CRUD（`delete_worldbook_entry` 支持 `{ all: true }` 清空全部）+ `generate_worldbook_entry` / `organize_worldbook` / `batch_fill_worldbook_keys` / `rewrite_worldbook_entry` / `expand_worldbook_entry` / `generate_worldbook_skeleton` / `fix_from_lint` | 生成类 confirm |
| 多卡 | `switch_card` / `create_card` / `duplicate_card` / `rename_card` / `delete_card` / `import_card`（已解析 JSON） | 删/切/建 confirm |
| 小说 | `set_novel_source` / `novel_split_chapters` / `novel_extract_*` / `novel_distill_style` / `novel_patch_chapters` / `novel_expand_character` / `novel_rewrite_character` / `novel_sync_outputs`（真 await） | 抽取 confirm |
| MVU | `upsert_mvu_design`（可不注入）/ `upsert_mvu_variables` / `clear_mvu` / `patch_mvu_node` | confirm/auto |
| 引擎 | `set_engine_options`（骨架条数等非密钥） | auto |
| 试聊 | `analyze_chat_feedback`（LLM 结构化 fixes）/ `apply_chat_feedback_fixes` | 应用 confirm |
| 通用 | `open_module` / `apply_patch_bundle` / `undo_last_bundle` / `suggest_fixes` | — |

## 小说工坊

流水线：`有资料 → 有启用章节 → 分析/角色设定/开场白/人物/世界书/文风可运行`。未完成前置时后续操作禁用并提示。旧深链 `#novel-outputs` 会落到人物列表。

界面与主卡「角色设定」「开场白」等共用 `.panel` / `.form-group` / `.btn` 体系。小说侧 view id 为 `novel-character-setup` / `novel-greetings`，勿与主卡 `character` / `greetings` 混淆。世界书列表交互与主卡「世界书条目」一致（折叠预览 + 居中弹窗编辑）。

| 模块 | 视图 id | 能力 |
|---|---|---|
| 原始资料 | `novel-source` | 导入/拖拽/手动补充/AI Context；处理模式、并行数、AI 扩展召回预算（默认 30000）；**不含** NSFW/NTL UI（入口在「角色设定」）；**不含**分片字数；「重置并清空结果」清空章节/人物/世界书草稿/文风等产出，保留原文与分片等配置 |
| 拆章 | `novel-chapters` | 标题/空行/字数拆分（含本模块单片字数）；顶栏批量；行内图标操作；点标题/预览弹窗看正文；列表内滚 |
| 角色设定 | `novel-character-setup` | 可从实体库选人；优先 RAG 召回原文，无命中回退字数/章节范围；生成写入当前卡 `charName`/`wbName`/`charDesc`/`creatorNotes` |
| 开场白 | `novel-greetings` | 同上（实体+RAG / 范围回退）+ 开场白数量；写入 `first_mes` + `alternate_greetings` |
| 小说分析 | `novel-analyze` | RAG 索引（过期才重建）+ 骨架/丰满/关系；读取全局 NSFW/NTL；失败片可重跑；NSFW/NTL→状态栏草案；页内 **G6 关系图谱** |
| 人物列表 | `novel-characters` | 展示/编辑人物实体；丰满所选（RAG）；无实体时行内 AI 扩展；可选「扫描全书」降级；同步角色设定/世界书；**任务中心可停** |
| 世界书条目 | `novel-worldbook` | 展示/编辑非人物实体；类型筛选；丰满所选；可选「AI 抽取」降级；同步主世界书；**任务中心可停** |
| 文风蒸馏 | `novel-style` | 抽样蒸馏；全局 NSFW 开时出「NSFW 文风指令」，NTL 开时出「NTL 文风指令」；同步为世界书「文风」条目；**任务中心可停** |

分片方式（人物/世界书/分析各自独立，默认**按字数**）：

- **按字数**：配置分片字数（4k / 8k / 12k / 16k / 24k / 32k / 48k / 64k，默认 8k）
- **按章节**：配置分片章节数（每 N 个有文本启用章一次请求，默认 1）

文风默认抽样 16k，拆章默认单片 8k。

### 扫描 / 抽取预估次数

- **按字数**（跨章 packing）：按启用章顺序贪心拼入当前片，加入下一章将超过分片字数则开新片；单章超长则章内按字数切开。空章不计。`N` = 实际片数
- **按章节**：`N = ceil(有文本启用章数 / 分片章节数)`
- 预估与真实扫描/抽取共用同一分片入口；改方式、数值或章节启停后即时重算按钮「约 N 次 · …」。

### 人物 / 世界书 AI 扩展

- **人物**：用人名 + 别名匹配原文；输出附录 1；未写明字段合理虚构补全（禁止留「原文未提及」）；结果回写实体库。
- **世界书条目**：用标题 + 触发词匹配原文，扩写 `content`。
- **落卡**：多人仅首人写 `charName`；YAML 跳过空/占位字段；`syncStatus` 与实体一致；世界书同步合并实体与未入库草稿。
- **NSFW / NTL（角色设定·全局配置）**：CharacterPanel 为唯一 UI 入口；NSFW 分步补情欲向（`attrs.adult` / NSFW 档案）；NTL 独立补禁忌张力（可只开或叠加）；质量门仅 NSFW 强制身体向门槛。
- 召回预算默认 **30000** 字（原始资料可改）；超预算按首现 / 共现 / 分散章抽样。
- UI 点击扩展：**先居中弹窗**展示将使用的原文摘录与字数，确认后才调用；走任务中心，可停。
- 助手工具（`novel_expand_character` / `novel_expand_worldbook`）直跑并跳过确认弹窗。

### 小说本地分桶（按 cardId）

- **桶键**：`novelWorkshopV3:card:{cardId}`（`cardId` 即草稿 id，如 `draft_…`）。
- **存储**：IndexedDB `json` store 优先；首次加载时从 localStorage 同名键或旧全局/V2 迁入 IDB 并清理 localStorage。
- **切换/新建**：切卡加载对应桶；新建卡为空状态。
- **迁移**：若某卡尚无桶，且存在旧全局 `novelWorkshopV3`（有实质内容），则迁入**当前** cardId 并删除全局键；否则再尝试旧 `novelWorkshopV2` 源文本。已有桶的卡不会误吃全局（导入角色卡也不改绑定）。
- **导出**：角色卡 JSON/PNG **不包含**小说工坊内容；小说仅本地编辑绑定。助手小说工具读写当前卡对应桶。

### IndexedDB 本地大对象（`st-card-builder`）

- **json store**：小说工坊全状态（按 cardId 分桶）。
- **blob store**：头像高清（≤2048px JPEG）+ 管理页封面缩略图（≤512px）。
- 草稿 `localStorage` 仅存轻量 JSON；旧卡内嵌 `avatarBase64` 在加载时自动迁入 IDB。

## 开发

要求：Node.js 18 或更高版本。

```bash
git clone git@github.com:wominIII/st-card-builder.git
cd st-card-builder
npm install
npm run dev
```

默认开发地址为 `http://localhost:4321`。

## 构建

```bash
npm run build
npm run preview
```

`npm run build` 会生成静态文件到 `dist/`，可直接部署到任意静态 Web 服务。项目当前部署示例使用 Caddy/Nginx 提供静态文件，并保留 `/api/*` 反向代理到本机 API（`:8787`）。

GitHub Actions（push `master`）：静态站 → `/var/www/card`；API → **`$HOME/st-card-builder/server`**（systemd `st-card-builder-api`）；同机 CouchDB 由部署探活，不可达则 Docker 自动拉起（`st-card-builder-couch`，无 Docker 则部署失败）。详见 [`docs/production.md`](docs/production.md)。

## AI 接口

在左侧「配置 → AI 配置」填写兼容 OpenAI Chat Completions 的接口地址、密钥和模型。密钥只由浏览器请求时使用；请不要将密钥写入仓库或导出的角色卡。

## 提示词配置

- 入口：左侧「配置 → 提示词配置」。
- **Tab**：角色卡制作 / 世界书 / 状态栏·MVU / 小说 / AI 助手；切换保留未保存编辑；可保存全部或恢复本页/全部默认。
- **描述体系**：`src/lib/promptCanon.mjs` 公共块（内容维 / NSFW 人物与世界 / 推断 / 输出契约）组装各默认提示词，驱动全链路具体可扮演产出。
- 存储键：`st_v3_builder_prompts`（仅保存与默认不同的覆盖项）。
- 读取：各生成链路优先用用户配置，否则回退内置默认值。
- 动态上下文（角色信息、预设、搜索结果等）仍由原逻辑拼接，不改变生成语义。
- AI 助手相关：`assistantSystem`（含 `{{toolList}}`）、`assistantReactHint`、`assistantChatFeedback`。

## 数据说明

- 编辑状态主要保存在浏览器 `localStorage` 和当前角色卡扩展数据中。
- 小说产出默认只存在工坊分桶草稿中（按 cardId）；在人物/世界书/文风模块内确认同步后才写入角色设定或主世界书；导出卡文件不含小说桶。
- 世界书同步按条目 `comment` 匹配：冲突策略可选覆盖 / 合并 / 跳过；人物条目 comment 形如 `[小说人物] 姓名`；文风条目 comment 固定为 `文风`。

## 验证

```bash
npm test               # 346 个测试，22 个文件，全部通过
npm run build          # 静态构建
```

提交前请至少执行测试与构建验证。

## 开发（贡献者）

项目采用原生 `.mjs` ESM 模块，无 TypeScript、无框架依赖。启动方式：

```bash
npm install
npm run dev            # http://localhost:4321
```

### 可选：云同步（Node + CouchDB + PouchDB）

```bash
cp server/.env.example server/.env
npm run couch          # 需本机 Docker：CouchDB :5984
npm install --prefix server
npm run server:dev     # API :8787（Astro 已代理 /api）
```

侧栏 **配置 → 账户与同步**：Discord 门禁登录（生产关 `DEV_LOGIN`）；AI 配置内用**同步口令加密**后上传密钥。小说分享见云同步文档。管理端：`/admin`（`ADMIN_DISCORD_IDS` 白名单）。

- 说明：[`docs/cloud-sync.md`](docs/cloud-sync.md)
- 生产清单 / 备份：[`docs/production.md`](docs/production.md)、`scripts/backup-couch.sh`

架构说明见 [`docs/architecture-and-design.md`](docs/architecture-and-design.md)，快速上手见 [`AGENTS.md`](AGENTS.md)。
