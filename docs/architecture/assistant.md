# AI 助手

> SoT：本文 + `src/lib/assistant/*`。字段写入规则见 [`../domains/st-card-fields.md`](../domains/st-card-fields.md)。设计哲学见 [`core-design-philosophy.md`](./core-design-philosophy.md) **§6.5、§6.3.6–§6.3.8.1**。

## 位置

右栏 `AssistantPanel.astro`（DOM/样式壳）+ `src/lib/assistant/panelBoot.mjs`（ReAct 循环、工具执行、会话）；与卡/世界书/MVU/小说/导出共用状态。

## 设计哲学：多人卡原生（须遵守）

SoT 论述见 [`core-design-philosophy.md`](./core-design-philosophy.md) **§2.1**；写卡指南 **§2.0**。助手与 AI 引擎须默认：

| 原则 | 助手行为 |
|------|----------|
| 卡 = 场景 + 卡司 + 世界 | 建卡引导（`assistantBuildGuide`）优先 worldbook 承载 NPC，charDesc 写局面/规则 |
| 无「卡即唯一扮演者」 | **禁止**建议把多 NPC 小传 merge 进 `charDesc`；人物长文用 `generate_worldbook_entry` / `expand_worldbook_entry` / `rewrite_worldbook_entry`，短结构仍可用 `create/update_worldbook_entry` |
| Promote 边界 | `sync_novel_entities` / Story→卡 只写 worldbook；不改 charName/charDesc（除非用户明确改角色设定） |
| 单人 = 退化 | 卡司 N=1 时描述可略详，仍推荐世界书存详情 |
| **卡进度** | 「缺什么 / 下一步」读 **§6.1 `cardProgress`**；**metric 只叙述数量，不要求达标人数** |

`{{characterFieldHint}}` / `{{buildGuide}}` / 进度相关注入须与上表一致。

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

**Story↔卡 / 工坊→Story 桥**（§6.2.2）：`promote_story_graph_to_card`、`seed_story_graph_from_card`、`seed_story_from_novel_entities` — 均 confirm + L0 + `sourceRef`。

**Promotion 历史**（§3.8.1）：`list_promotions` 只读；**不提供**回滚。

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
5. **大改确认后续接**：确认弹窗期间任务保持运行、`busy` 保持 true（防并行/切卡）。点「应用」后确认卡收起，对话里立刻出现同一张工具卡，摘要为「执行中」；工具返回后就地换成结果，不另起一行打字提示。成功后从该步下一步续接。请求没到达（抛错）时确认卡回来，红字说明原因，不叫模型，用户可再点「应用」。工具返回业务失败时结束本轮并标任务失败，不续接；失败写成工具结果，下一句用户消息里模型才看得到。执行中点停止会取消这次拉起的生成任务，不续接。点「拒绝」则取消任务复位。
6. **单轮步数上限**（`MAX_REACT_STEPS=20`）：最后一轮提示模型用自然语言收尾；到顶仍未收尾时给出「回复『继续』」提示  

**对话契约**：像现代智能体——能直接答就直接答；工具按需调用。气泡展示人读文案；送模保留该步原文（`modelContent`）。等待模型时对话区显示「正在…」提示条（`assistant-msg--pending`）。工具执行中用工具卡上的「执行中」，不用这条提示代替。

**标题状态**（`#assistantStatusTip`，不是 `appFeedback` 通道）：只写「正在思考…」与「等待确认大改…」。进行中绿点表示忙碌；闲置隐藏文案，只留绿点就绪。回合 `finally` 在仍等待确认时不得清掉标题文案。思考中的步骤文案进对话提示条；工具是否在执行看工具卡。

**操作反馈**走 `appFeedback`，点击时一次，不常驻标题栏：

| 情况 | 通道 |
|------|------|
| 小说检索桥接未就绪、RAG 已关闭、无 RAG 预览数据、请输入内容、该消息无可用检索文本、未填 AI 接口 | 警告 toast |
| RAG 预览失败等错误 | notification |
| 会话已清空 | 成功 toast |
| 切卡 | 信息 toast |
| 「已停止」 | 只在对话气泡，不写标题 |
| ReAct 运行失败 | 对话保留「错误：…」气泡，另加一条 notification；不再 toast 同一句 |

试聊未填角色描述：点「开始试聊」时警告 toast，禁止 `alert`。工具卡风险标、token 计数、工具返回里的「桥接未就绪」留在原处，不改成 toast。

常驻说明用公共类：标题下导语 `.ui-panel-lead`，空态 `.ui-empty-tip`，快捷键 `.ui-hint`，刻度/读数 `.ui-meta`。

**重试**

- 可重试错误（新消息 `retryable`，或旧会话 `error` 且正文为半角「错误:」/ 全角「错误：」，含 Failed to fetch）：气泡上只有重试图标。助手回复不提供复制。
- 撤销失败、应用失败：没有重试。请求没到达时确认卡还在，再点「应用」；业务失败则本轮已结束，下一句用户消息再继续。
- 重试重发会话里已有的最后一条用户输入，不读输入框，不再追加相同用户消息。`busy` 或任务中心占用 `card.assistant.react` 时不能再开一轮。该用户消息之后没有工具轨迹：删掉可重试错误后从 step 0 重跑。已有工具轨迹：保留轨迹，从工具结果续接（`startStep >= 1`），避免把已改过的卡再写一遍。检查点之前的工具不计入步数。
- `uiMessagesToModelHistory` 跳过 `role === 'assistant' && error`。工具错误（`role === 'tool'`）仍送模。
- 按钮用 DOM API 创建，图标不写进消息正文的 `innerHTML`。错误正文继续转义。用户气泡仍只有 RAG 图标。

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
| `contextManager.mjs` | 送模面与检查点（tiktoken / 200k · 硬阈值写一次检查点）；跳过助手错误气泡与执行中的工具卡 |
| `retryTurn.mjs` | 重试规划：无工具轨迹从 step 0；有轨迹则续接 |
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
- **工具结果送模**只有返回或错误，不含调用参数。参数留在上一句模型自己的工具调用里，也留在卡片上。旧会话里已经写进 `modelDetail` 的参数，发送时剥掉。失败标成「工具结果·失败」。执行中的卡片不送模。
- **送模面**从最近一次成功的上下文检查点开始。检查点之前的对话留在会话里，底部 token 数的是送模面，写上检查点后数字下降并停住。
- **≥80%（硬阈值）**且检查点之前还有可收起的对话：下一次模型调用前单独做一次摘要，写入检查点。近端约 8k tokens 原样保留；切在工具结果上时，前一条助手调用留在近端。下一次再压，是在旧检查点上补新内容，不把被盖住的原文再读一遍。摘要失败不写检查点。不在等待确认或工具执行中途切。
- 送模面仍超过输入预算时，当次发送丢掉最旧的几条，不改会话原文。禁止对单条工具结果做固定字符盲切（旧 `slice(0, 1200)`）。
- **禁止**把模型输出改写成 Thought-only / 自造 Action 再喂回模型（影响持续输出）
- 试聊仍走 `prepareChatCompletionMessages` 的发送时压缩（同一套预算；回复预留取 `max(max_tokens, 8k)`）
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

## 长文生成

角色长文、开场白、世界书正文、小说人物档案、小说世界书，每次只调用一个生成工具写一篇。助手把这次要写的内容放进 `instruction`（已确认的设定、要写什么、不要写什么、和已有人物/物品/地点的关系）。工具再调一次模型，并带上世界与限定（世界观预设始终在内；框架、口味、姿势语言、情趣话风、NTL、成人 Canon 按开关）和已有关联索引（人物 / 地点 / 物品 / 势力 / 事件 / 规则各一行，本次任务点到的条目附截断正文）。

| 工具 | 提示词 | 篇幅 |
|------|--------|------|
| `expand_character_field` | `assistantCharField` | 按这个字段该说的话说完 |
| `rewrite_greeting` / `expand_greeting` | `assistantGreeting` | 只写用户指定的这一场；正文不含 `<initvar>` |
| `generate_worldbook_entry` | `wbSingle` | 短事实就短。人物条在 NSFW 开启时，同一条档案后另写「情欲」 |
| `expand_worldbook_entry` / `rewrite_worldbook_entry` | `wbRewrite` | 按本次任务补全。人物条同样在同一条里写「情欲」 |
| `novel_expand_character` / `novel_rewrite_character` | `novelCharExpand` | 附录 1 字段写满，关系点名已有条目 |
| `novel_expand_worldbook` | `novelWbExpand` | 至少 200 字 |

`update_character_fields` 只接受角色名、世界书名和标签。场景契约、作者注释、开场白、世界书长正文如果被塞进写入工具，调用时就改成对应的生成工具：`expand_character_field`、`rewrite_greeting`、`generate_worldbook_entry` 或 `rewrite_worldbook_entry`。同一调用里的短字段先写入。确认卡上的工具是生成工具，`instruction` 是已确认设定的方向，不是把草稿原样存成正文。`instruction` 过短时仍拒绝。若守卫仍拦住，错误回到规划让模型重选工具，不显示「应用失败」，也不结束本轮。`generate_character_draft` 与 `generate_worldbook_skeleton` 不再作为助手的长文入口。世界书单条生成/重写与面板共用 `worldbookShared` 的上下文拼装。引擎面板的分阶段生成不走这条改道。生成结果若未点名已有人物或物品，工具返回 `linkWarning`，不阻断写入。

开场初始值走 `set_greeting_init`，`target` 与 `rewrite_greeting` / `expand_greeting` 相同（`main`、`{ alternate: n }` 或序号）。`overrides` 只写和世界书 `[initvar]` 保底不同的路径和值；`clear: true` 从空表开始，值为 `null` 删掉一条。没有保底时拒绝，提示先生成变量。`rewrite_greeting` 写完正文后清掉这一条的旧初始值，返回 `initCleared`；`expand_greeting`、`update_alternate_greeting`、`update_character_fields` 保留。`get_character_fields` 带回 `greetingInitMain` 与 `greetingInitAlts`。

## 相关

- 卡侧桥接：[`card-builder.md`](./card-builder.md)
- 小说桥接：[`novel-workshop.md`](./novel-workshop.md)
- 试聊 runtime：[`chat-runtime.md`](./chat-runtime.md)
