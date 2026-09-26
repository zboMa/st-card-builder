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

## 试聊记录与选段（§6.3.6–§6.3.7 · D15）

与 **助手会话分离**；完整契约见 [`core-design-philosophy.md`](./core-design-philosophy.md) **§6.3.7**。

| 项 | 契约 |
|----|------|
| **持久化** | `st_v3_chat_playground_session:{draftId}`；`messages[]` + `selection.messageIds`；**不上云** |
| **选段** | **弹窗**；一行一段、单行 preview（≤120 字）；多选后写入 `selection`；跨 Tab 保留 |
| **默认 analyze** | 无选段 → 最近 **16** 条；有选段 → 仅 `messageIds` |
| **重置试聊** | confirm → 清空 messages + selection + 持久化 |
| **fixes** | §6.3.7 允许/禁止表；apply 前校验 |
| **Episode** | IDB 只引用 `messageIds`；正文在 session |

实现：`playgroundBoot.mjs` + 选段弹窗（与 D12 共用）。

## 试聊归档 Story（§6.3.8–§6.3.8.1 · D12）

Episode Promote **只写 Story**（章草稿 / plotLedger），不写卡。完整契约见 [`core-design-philosophy.md`](./core-design-philosophy.md) **§6.3.8**；Story 字段见 [`story-studio.md`](./story-studio.md) **「试聊归档写入」**。

| 项 | 契约 |
|----|------|
| **Episode IDB** | `chatEpisodeV1:card:{draftId}`；只存 `messageIds[]` 元数据 |
| **Promotion L0** | `promotionLogV1:card:{draftId}`；`kind: story_from_chat` |
| **MVU 快照** | Promote 时刻 `getMvuSnapshot()` → ledger `mvuSnapshot`；不回写卡 |
| **verbatim** | `formatChatTranscriptVerbatim`；格式见 §6.3.8.1 |
| **键名** | `draftId` = Story IDB 中的 `cardId`（同指） |

实现：`episodeStore.mjs` + `transcriptFormat.mjs` + Promote 弹窗（与 D15 共用选段）。

## 群像试聊（§5.3 · D2）

设计契约见 [`core-design-philosophy.md`](./core-design-philosophy.md) **§5.3**。

| 项 | Phase 1 目标 |
|----|----------------|
| **Continue** | 场景契约续写；非 `Continue as {charName}` |
| **焦点 NPC** | 配置抽屉可选；仅软提示 Continue/regenerate |
| **`{{char}}`** | 仍 = 场景标识；system 补充勿当唯一角色 |
| **多说话人** | `build.mjs` 前缀检测含 worldbook person 名 |
| **MVU** | cast 平等；Promote 快照 = 全 cast |

Continue 与焦点 NPC 按 §5.3 接在 `chatRuntime/prompt/build.mjs` 与 `playgroundBoot.mjs`。
