/**
 * 成人 · NTL 禁忌层（类型 + 丰满规范）
 * 扩展：在 types.mjs 追加条目，并在 enrichment.mjs 补齐同 id 规范
 */
import { NTL_TABOO_TYPES } from './types.mjs';
import {
  NTL_TABOO_DEFAULT_MIN_CHARS,
  NTL_TABOO_ENRICHMENT,
  NTL_SHARED_DIMENSIONS,
  applyNtlTabooEnrichment,
  collectNtlEnrichment,
  evaluateNtlRichness,
  extractNtlRichnessText,
  buildNtlExpandSystemPrompt,
  buildNtlExpandUserPrompt,
  buildNtlTabooHintFromTypes,
  normalizeNtlTabooItems,
} from './enrichment.mjs';

applyNtlTabooEnrichment(NTL_TABOO_TYPES);

export var NTL_TABOO_IDS = Object.keys(NTL_TABOO_TYPES);

export {
  NTL_TABOO_TYPES,
  NTL_TABOO_DEFAULT_MIN_CHARS,
  NTL_TABOO_ENRICHMENT,
  NTL_SHARED_DIMENSIONS,
  applyNtlTabooEnrichment,
  collectNtlEnrichment,
  evaluateNtlRichness,
  extractNtlRichnessText,
  buildNtlExpandSystemPrompt,
  buildNtlExpandUserPrompt,
  buildNtlTabooHintFromTypes,
  normalizeNtlTabooItems,
};
