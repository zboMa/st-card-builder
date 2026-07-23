# AI 助手

> SoT：本文 + `src/lib/assistant/*`。字段写入规则见 [`../domains/st-card-fields.md`](../domains/st-card-fields.md)。

## 位置

右栏 `AssistantPanel.astro`（DOM/样式壳）+ `src/lib/assistant/panelBoot.mjs`（ReAct 循环、工具执行、会话）；与卡/世界书/MVU/小说/导出共用状态。

## 流水线

1. 用户输入 → 系统提示（含工具说明、字段 hint）  
2. LLM ReAct 轨迹 → `reactParse.mjs`  
3. `risk.mjs` 分级 → `executor.mjs` 执行工具  
4. 小改自动应用；大改预览确认；`session.mjs` 存会话与撤销快照  

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
| `tokenEstimate.mjs` | Token 估算 |
| `toolTraceSummary.mjs` | 轨迹摘要 |

## 写入规则（摘要）

- 自动：单字段微调、单条世界书增改  
- 确认：删除、整段覆盖、批量、整卡生成、小说全量合并、多卡删切等  
- **不做**：头像、代导出文件、读写 API Key  
- 改卡后本地 `saveCurrentDraft` 会触发 `card-local-saved`；已登录时提示用户到卡管理「同步上云」（不自动推云）

工具全表以代码 `tools.mjs` 为准；产品摘要见 README。

## 相关

- 卡侧桥接：[`card-builder.md`](./card-builder.md)
- 小说桥接：[`novel-workshop.md`](./novel-workshop.md)
