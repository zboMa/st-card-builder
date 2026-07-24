# 试聊运行时对标 SillyTavern 1.18.0

> 实现库：`src/lib/chatRuntime/`  
> 目标：角色试聊在世界书触发/注入与正则管线上尽量与 **SillyTavern 1.18.0** 一致，便于验卡。

## 已对齐（本波）

| 能力 | 行为摘要 |
|---|---|
| Scan depth | 扫最近 N 条；`0` 时 selective 不扫历史，constant 仍可激活 |
| Keys | 明文子串（默认不区分大小写）；`/pattern/flags` 正则 key |
| Constant / Selective | constant 必评估；selective 需 key 命中 |
| Probability | `prob` + `useProbability` |
| Order | 激活后按 `order` 升序插入（小数更靠前/离结尾更远） |
| Secondary + selectiveLogic | `AND_ANY(0)` / `NOT_ALL(1)` / `NOT_ANY(2)` / `AND_ALL(3)` |
| @D 注入 | `position===4` 按 `depth`（0=栈底）与 `role` 插入 |
| 非 @D 槽位 | 0/1 角色定义前后；2/3 示例前后；5/6 作者注前后 |
| 递归/组 | 轻量：一轮 content 回扫；同 group 按 weight/override 择一 |
| 正则 | placement 用户/AI/世界书；markdownOnly / promptOnly；min/maxDepth |
| 宏 | `{{char}}` / `{{user}}`（常见大小写） |

## 已知差异（相对 ST 1.18.0 全文）

- **非** Prompt Manager 逐块等价；续写 system 指令为构建器实用增强。
- **向量世界书**按 selective 降级处理。
- 无全局 World Info 选择器、无 outlet、无自动化 ID / STScript。
- 扫描缓冲：`budgetTokens`（tiktoken 截断近端）；旧名 `budgetChars` 视为 token 数兼容
- 卡字段 `personality` / `scenario` / `mes_example` 仅在 state 有值时注入。
- 斜杠命令 placement、推理块完整链路未做。

## 上下文预算（与助手共用）

试聊发送与世界书扫描缓冲、小说 RAG / prior 拼装统一走 `assistant/contextManager`（tiktoken `cl100k_base`）：

- 总窗 **200k**；回复预留取 `max(chatMaxTokens, 8k)`
- **≥60%** 启动压缩；**≥80%** 激进压缩
- Token 指示与 Prompt 调试区显示真实 tok 与压缩档位
- **禁止**再用字符数粗估 token / 字符盲切当 token 预算

## 使用

试聊配置抽屉可调 **扫描深度**、**用户名**。调试模式可查看组装后的 messages 与激活条目。  
单测：`node --test tests/chatRuntime.test.mjs`；上下文：`tests/contextManager.test.mjs`
