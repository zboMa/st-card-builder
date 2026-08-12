# AI 助手

> SoT：本文 + `src/lib/assistant/*`。字段写入规则见 [`../domains/st-card-fields.md`](../domains/st-card-fields.md)。设计哲学见 [`core-design-philosophy.md`](./core-design-philosophy.md) **§6.5、§6.3.6–§6.3.8.1**。

## 位置

右栏 `AssistantPanel.astro`（DOM/样式壳）+ `src/lib/assistant/panelBoot.mjs`（ReAct 循环、工具执行、会话）；与卡/世界书/MVU/小说/导出共用状态。

## 设计哲学：多人卡原生（须遵守）

SoT 论述见 [`core-design-philosophy.md`](./core-design-philosophy.md) **§2.1**；写卡指南 **§2.0**。助手与 AI 引擎须默认：

| 原则 | 助手行为 |
|------|----------|
| 卡 = 场景 + 卡司 + 世界 | 建卡引导（`assistantBuildGuide`）优先 worldbook 承载 NPC，charDesc 写局面/规则 |
| 无「卡即唯一扮演者」 | **禁止**建议把多 NPC 小传 merge 进 `charDesc`；人物用 `create/update_worldbook_entry` |
| Promote 边界 | `sync_novel_entities` / Story→卡 只写 worldbook；不改 charName/charDesc（除非用户明确改角色设定） |
| 单人 = 退化 | 卡司 N=1 时描述可略详，仍推荐世界书存详情 |
| **卡进度** | 「缺什么 / 下一步」读 **§6.1 `cardProgress`**；**metric 只叙述数量，不要求达标人数** |

`{{characterFieldHint}}` / `{{buildGuide}}` / 进度相关注入须与上表一致（**代码对齐见 §11 D3、D10**）。

## 全局助手（§6.5 · 须遵守）

**不绑定侧栏 view**；**不**按 view 切 persona 或硬过滤工具。

| 机制 | 说明 |
|------|------|
| 工具 | 全量 `ASSISTANT_TOOLS` + `risk.mjs` |
| **`{{locationBlock}}`** | 侧栏 view、当前卡、可选 Story novel、试聊条数/选段数；**不**默认灌 transcript |
| 倾向 | 意图对应当前页 → 优先相关工具；跨模块允许 |
| 防改错 | **target 不清 → 只读定位 + 问用户**；Story 页改卡 **不要求**强制口播提醒 |
| 试聊 Tab | **游玩**；改卡只在 **助手 Tab**（含试聊回流 §6.3.6） |

**送模顺序**：`assistantSystem` → `locationBlock`（§6.5.5）→ `buildGuide`（+ 可选 cardProgress）→ `toolList` → `catalogOverview`。

**location 规则**（`promptCanon.assistantLocationRules`，D13）：当前页优先；跨模块允许；target 不清先问；Story 页改卡不强制口播。

**试聊回流**：§6.3.6–§6.3.7；fixes 允许/禁止表；apply 前 executor 校验。

**试聊归档 Story**：§6.3.8–§6.3.8.1 `promote_chat_episode`；写 Story 章草稿（`sourceMeta`）/ `plotLedger`（`LEDGER_STATUSES` + 可选 `mvuSnapshot`）；append **D16** Promotion L0；与回流 **分线**（不写卡）；共用选段弹窗。Story 字段见 [`story-studio.md`](./story-studio.md)。

**Story↔卡 / 工坊→Story 桥**（§6.2.2 · D17，待实现）：`promote_story_graph_to_card`、`seed_story_graph_from_card`、`seed_story_from_novel_entities` — 均 confirm + L0 + `sourceRef`（D16）。

**Promotion 历史**（§3.8.1 · D16）：`list_promotions` 只读；**不提供**回滚。

**实现差距**：D13；D10；D15；D12；**D16**（L0 + sourceRef）；**D17**（三向桥）；PR 顺序见 core-design **§9.1**。

## 试聊 vs 试聊回流

| | 试聊 Tab | 试聊回流（助手） |
|---|----------|------------------|
| 作用 | RP 验卡 | 读 transcript → 诊断 → **用户择 fixes** → 改卡 |
| 存储 | `st_v3_chat_playground_session:{draftId}` **仅本地** | session + `get_chat_feedback` / `analyze_chat_feedback` |
| 选段 | **弹窗**（一行一段，单行预览）；结果跨 Tab 保留 | analyze 传 `messageIds` |
| 应用 | — | 对话指定编号 → `apply_chat_feedback_fixes`（分项 confirm） |
| 禁止 | — | 本局剧情/MVU 终值进卡；与 Story 归档（D12）分线 |

用户也可 **不用回流**，直接口述让助手改卡。

## 流水线

1. 用户输入 → 系统提示（含工具说明、字段 hint、locationBlock）  
2. 模型默认**自然语言**回复；仅需操作卡面时输出 tool JSON → `reactParse.mjs`（只用于执行）  
3. `risk.mjs` 分级 → `executor.mjs` 执行工具  
4. 小改自动应用；大改预览确认；`session.mjs` 存会话与撤销快照（**按卡隔离**，切卡重载对应会话；随卡 bundle 上云）
5. **大改确认后续接**：确认弹窗期间任务保持运行、`busy` 保持 true（防并行/切卡）；点「应用」后从该步下一步续接，让模型总结结果或继续调工具；点「拒绝」则取消任务复位
6. **单轮步数上限**（`MAX_REACT_STEPS=20`）：最后一轮提示模型用自然语言收尾；到顶仍未收尾时给出「回复『继续』」提示  

**对话契约**：像现代智能体——能直接答就直接答；工具按需调用。气泡展示人读文案；送模保留该步原文（`modelContent`）。等待模型/工具时 UI 显示「正在…」提示条（`assistant-msg--pending`）。

## 消息渲染

- 助手回复按 **markdown** 渲染（`assistant/markdownRender.mjs`，marked 18 + 安全壳）：标题 / 列表 / 引用 / 表格 / 代码块 / 行内码 / 链接；换行保留（`breaks`）
- **安全**：原始 HTML 一律转义为文本（`<script>` / `onerror=` 不可执行）；链接仅放行 `http/https/mailto`，其余 scheme 降级纯文本；图片不加载，降级为链接文本
- 用户消息 / 工具卡 / 错误提示保持纯文本（`textContent` / 转义后 `innerHTML`）

## 模块

| 文件 | 职责 |
|---|---|
| `tools.mjs` | 工具注册表 |
| `risk.mjs` | none / auto / confirm |
| `reactParse.mjs` | 解析 Thought/Action |
| `executor.mjs` | barrel：`createToolExecutor` |
| `executorResolve.mjs` | `normalizeTarget` / `resolveWorldbookIndex` |
| `executorHelpers.mjs` / `executorExecute.mjs` | 搜索/lint helpers + 工具执行 |
| `characterFields.mjs` | 字段归一 |
| `session.mjs` | 会话与快照栈（按卡隔离 + 旧全局会话迁移） |
| `ragInject.mjs` | 小说 RAG 注入 |
| `contextManager.mjs` | 送模上下文预算与压缩（tiktoken / 200k · 60% / 80%） |
| `tokenEstimate.mjs` | Token 展示文案（计数委托 contextManager） |
| `toolTraceSummary.mjs` | 轨迹摘要 |
| `markdownRender.mjs` | 回复 markdown 渲染（安全壳） |

## 会话存储（按卡）

- 助手：`st_v3_builder_assistant_session:{draftId}`、快照 `st_v3_builder_assistant_snapshots:{draftId}`；无卡回退全局键。
- 试聊（D15）：`st_v3_chat_playground_session:{draftId}` — **仅 localStorage，不上云**。
- 切卡（`card-draft-changed`）重载对应会话；任务进行中对切卡已硬禁（Action Engine），监听再做 `busy` 兜底。
- 云 bundle `assistant` 字段随卡上云/水合；**不含**试聊 transcript。详见 [`../systems/cloud-sync.md`](../systems/cloud-sync.md)。

## 上下文预算

- 编码：`js-tiktoken`（OpenAI `cl100k_base`，浏览器/Node 可用）
- 总窗口 **200k** tokens；预留约 **8k** 给回复，输入预算 = 200k − 8k
- **≥60%** 输入预算：启动压缩（旧**工具结果**缩预览；assistant 原文不丢弃、不重组）
- **≥80%**：激进压缩（工具只留摘要、裁剪旧 RAG、必要时对过长条按 token 截断）
- **禁止**对单条工具结果做固定字符盲切（旧 `slice(0, 1200)` 已移除）；压缩只在 `prepareAssistantMessages` / `prepareChatCompletionMessages` 发送时整体进行
- **禁止**把模型输出改写成 Thought-only / 自造 Action 再喂回模型（影响持续输出）
- 试聊发送复用 `prepareChatCompletionMessages`（同一套预算；回复预留取 `max(max_tokens, 8k)`）
- 调参入口：`CONTEXT_BUDGET`（`limit` / `softRatio` / `hardRatio` / `reserveReply`）
- **目录概览混合注入（方案 B）**：system 默认只带**紧凑索引**（`buildCatalogIndexText`，约 1k tokens，仅组名+条数）；当**本轮或近 9 条上下文命中目录关键词**（`catalogSummaries.isCatalogRelevantText`：世界观/口味/姿势/话风/NTL/禁忌/恶堕/NSFW/成人/框架/推荐搭配/配卡等）时当轮追加**完整概览**（全量 id+摘要）以保持识别不退化；未命中则模型用 `get_adult_catalog` 按需取全量（懒解析 `boot.catalogDataJson`，支持 `kinds/groups/query/withSummary`）。目录分组均为中文标签；NTL/世界观按 `NTL_GROUPS` / `WORLDVIEW_GROUPS` 映射
- **全项目约定**：凡「送模上下文预算 / 截断 / token 指示」一律走 `contextManager`（tiktoken）；禁止 `length/2`、`chars×2`、固定字符盲切冒充 token。字数 UI（如拆章 `charLimit`）仍可按字符，但不得当作 token 预算。

## 世界书工具（V2）

- 助手侧 JSON：**`comment`（标题）+ 可选 `type`**（与 `worldbookRegistry.OUTLINE_TYPES` / 引擎骨架一致）；`get_worldbook_list` / `get_worldbook_entry` / create·update 返回值均为该形态（含 `kind` 供调试）。
- 落盘经 `fromAiJsonEntry`：`type` → `outline_*` + `owner: user`；无 `type` → `kind: user`。禁止用 `comment` 合并键 upsert 多条。
- 分类与侧栏 family 以 `entryFamily(entry)` 为准；详见 [`../domains/st-card-fields.md`](../domains/st-card-fields.md)。

## 写入规则（摘要）

- 自动：单字段微调、单条世界书增改（`update_worldbook_entry` 支持 `indices` 多索引批量，>1 条升 confirm）  
- 确认：删除、整段覆盖、批量、整卡生成、小说全量合并、多卡删切、**成人/NTL 配置写入**（`set_adult_config` / `set_novel_adult_mode` / `set_novel_ntl_mode`）、**设置小说原文**（`set_novel_source`）等  
- **撤销覆盖**：快照含 角色 / 世界书 / MVU 设计 / 小说桶 / **成人配置（nsfw）** / **引擎选项（skeletonCount / tagContextChars）**；`undo_last_bundle` 可整体回滚  
- **不做**：头像、代导出文件、读写 API Key  
- 改卡后本地 `saveCurrentDraft` 会触发 `card-local-saved`；已登录时提示用户到卡管理「同步上云」（不自动推云）

## 小说 RAG（默认关闭）

- `state.rag.enabled` **默认 `false`**：新桶/无显式配置一律不注入；已在 AI 配置显式开启的卡保留开启
- 注入仅在 `ragOpt.enabled === true` 时执行；RAG 预览按钮同开关
- 详见 [`novel-analysis.md`](./novel-analysis.md)

工具全表以代码 `tools.mjs` 为准；产品摘要见 README。

## 相关

- 卡侧桥接：[`card-builder.md`](./card-builder.md)
- 小说桥接：[`novel-workshop.md`](./novel-workshop.md)
- 试聊 runtime：[`chat-runtime.md`](./chat-runtime.md)
