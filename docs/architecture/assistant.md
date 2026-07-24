# AI 助手

> SoT：本文 + `src/lib/assistant/*`。字段写入规则见 [`../domains/st-card-fields.md`](../domains/st-card-fields.md)。

## 位置

右栏 `AssistantPanel.astro`（DOM/样式壳）+ `src/lib/assistant/panelBoot.mjs`（ReAct 循环、工具执行、会话）；与卡/世界书/MVU/小说/导出共用状态。

## 流水线

1. 用户输入 → 系统提示（含工具说明、字段 hint）  
2. 模型默认**自然语言**回复；仅需操作卡面时输出 tool JSON → `reactParse.mjs`（只用于执行）  
3. `risk.mjs` 分级 → `executor.mjs` 执行工具  
4. 小改自动应用；大改预览确认；`session.mjs` 存会话与撤销快照  

**对话契约**：像现代智能体——能直接答就直接答；工具按需调用。气泡展示人读文案；送模保留该步原文（`modelContent`）。等待模型/工具时 UI 显示「正在…」提示条（`assistant-msg--pending`）。
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
| `session.mjs` | 会话与快照栈 |
| `ragInject.mjs` | 小说 RAG 注入 |
| `contextManager.mjs` | 送模上下文预算与压缩（tiktoken / 200k · 60% / 80%） |
| `tokenEstimate.mjs` | Token 展示文案（计数委托 contextManager） |
| `toolTraceSummary.mjs` | 轨迹摘要 |

## 上下文预算

- 编码：`js-tiktoken`（OpenAI `cl100k_base`，浏览器/Node 可用）
- 总窗口 **200k** tokens；预留约 **8k** 给回复，输入预算 = 200k − 8k
- **≥60%** 输入预算：启动压缩（旧**工具结果**缩预览；assistant 原文不丢弃、不重组）
- **≥80%**：激进压缩（工具只留摘要、裁剪旧 RAG、必要时对过长条按 token 截断）
- **禁止**对单条工具结果做固定字符盲切（旧 `slice(0, 1200)` 已移除）；压缩只在 `prepareAssistantMessages` / `prepareChatCompletionMessages` 发送时整体进行
- **禁止**把模型输出改写成 Thought-only / 自造 Action 再喂回模型（影响持续输出）
- 试聊发送复用 `prepareChatCompletionMessages`（同一套预算；回复预留取 `max(max_tokens, 8k)`）
- 调参入口：`CONTEXT_BUDGET`（`limit` / `softRatio` / `hardRatio` / `reserveReply`）
- **全项目约定**：凡「送模上下文预算 / 截断 / token 指示」一律走 `contextManager`（tiktoken）；禁止 `length/2`、`chars×2`、固定字符盲切冒充 token。字数 UI（如拆章 `charLimit`）仍可按字符，但不得当作 token 预算。

## 写入规则（摘要）

- 自动：单字段微调、单条世界书增改  
- 确认：删除、整段覆盖、批量、整卡生成、小说全量合并、多卡删切等  
- **不做**：头像、代导出文件、读写 API Key  
- 改卡后本地 `saveCurrentDraft` 会触发 `card-local-saved`；已登录时提示用户到卡管理「同步上云」（不自动推云）

工具全表以代码 `tools.mjs` 为准；产品摘要见 README。

## 相关

- 卡侧桥接：[`card-builder.md`](./card-builder.md)
- 小说桥接：[`novel-workshop.md`](./novel-workshop.md)
