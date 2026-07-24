/**
 * 上下文预算常量（单位：tiktoken tokens，非字符）
 * 成人联动 / 分析 prior / 扩写等：单次相关附加块合计建议 ≤ CONTEXT_HARD_CAP
 * 截断与累计请用 assistant/contextManager（countTokens / truncateToTokens / createTokenBudgetAccumulator）
 */

/** 硬顶：单次成人相关附加上下文（tokens） */
export var CONTEXT_HARD_CAP = 50000;

/** 成人 Canon 主块默认预算 */
export var ADULT_CANON_BUDGET = 40000;

/** 旧 digest API 默认 */
export var ADULT_DIGEST_DEFAULT = 16000;

/** 人物 NSFW 字段摘录 */
export var FIELD_PERSON_NSFW = 500;
/** 人物 NTL 字段摘录 */
export var FIELD_PERSON_NTL = 400;
/** 通用 summary / eroticRole 等 */
export var FIELD_SUMMARY = 400;
/** RAG/实体单行摘要 */
export var FIELD_ENTITY_LINE = 600;

/** 文风 NSFW 段 */
export var STYLE_NSFW_SLICE = 12000;
export var STYLE_ADULT_FALLBACK = 8000;

/** 恶堕 */
export var CORRUPTION_WB_CHARS = 24000;
export var CORRUPTION_BRIEF_CHARS = 4000;
export var CORRUPTION_EXPAND_WB = 20000;
export var CORRUPTION_SIBLING_PER = 1500;
export var CORRUPTION_SIBLING_BUDGET = 12000;

/** 口味/NTL 扩写 prompt */
export var EXPAND_CTX_CHARS = 20000;
export var EXPAND_BODY_CHARS = 40000;

/** RAG 实体注入 */
export var RAG_ENTITY_BUDGET = 12000;

/** 分析 prior */
export var PRIOR_ENTITIES_BUDGET = 16000;
export var PRIOR_ENTITIES_SUMMARY = 300;
export var PRIOR_RELATIONS_BUDGET = 10000;
export var PRIOR_REL_EVIDENCE = 200;
export var PRIOR_WB_EXTRACT_PER = 600;
export var PRIOR_CHAR_NOTE = 300;
export var PRIOR_CHARS_BUDGET = 12000;
export var PRIOR_WB_REF_BUDGET = 16000;
export var PRIOR_WB_REF_PER = 600;
export var PRIOR_GRAPH_BUDGET = 10000;
export var ENTITY_SUMMARY_STORE = 400;

/** 设定/开场 */
export var SETUP_ENTITY_SUMMARY = 800;

/** 卡侧世界书主角参考 */
export var CARD_CHAR_REF = 2000;
/** 卡侧世界书骨架条摘录 */
export var CARD_WB_SKELETON_PER = 400;

/** 骨架 prior */
export var SKELETON_ENTITIES = 16000;
export var SKELETON_RELATIONS = 10000;

/** XP/Limits 列表条数 */
export var LIST_KINKS = 16;
export var LIST_LIMITS = 16;
export var LIST_TABOO = 12;

export function clampBudget(n, fallback, hardCap) {
  var v = Math.floor(Number(n));
  if (!v || v < 1000) v = fallback != null ? fallback : ADULT_CANON_BUDGET;
  var cap = hardCap != null ? hardCap : CONTEXT_HARD_CAP;
  return Math.min(cap, Math.max(1000, v));
}
