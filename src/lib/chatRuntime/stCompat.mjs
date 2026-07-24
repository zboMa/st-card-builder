/**
 * SillyTavern 行为对标版本与差异说明（试聊运行时）
 */

/** 本引擎对照的 ST 版本 */
export var ST_PARITY_VERSION = '1.18.0';

/**
 * 与 ST 1.18.0 的已知简化 / 差异（不能 100% 对标处）
 * @type {string[]}
 */
export var ST_PARITY_DIFFS = [
  'vectorized 策略一期按 selective 子串/正则匹配处理，不做向量召回。',
  '世界书递归仅轻量一轮（已激活 content 并入扫描缓冲后再扫 delayUntilRecursion=false 且未 prevent 的条目），非 ST 完整递归栈。',
  'group 仅保留同名组内 groupOverride 或最高 groupWeight 一条，未模拟 ST 的加权随机抽组。',
  '非 @D 插入槽简化为 before/after Char、EM、AN 文本块拼接，未接入 ST 完整 Prompt Manager 槽位图。',
  '世界书扫描缓冲预算为 budgetTokens（tiktoken）；发送上下文由 contextManager（200k / 60% / 80%）整体压缩。未实现 ST sticky / cooldown / timed effects。',
  '正则管道覆盖 placement / markdownOnly / promptOnly / minDepth/maxDepth；未实现 substituteRegex 宏展开与 trimStrings 全链路。',
  'buildChatCompletionMessages 为实用组装顺序，非 ST 1.18 Prompt Manager 逐块等价。',
];
