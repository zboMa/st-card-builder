/**
 * 成人 · NTL 禁忌层（类型 + 丰满规范）
 * 扩展：在 types/{group}.mjs 追加条目，并在 enrichment/{group}.mjs 补齐同 id 规范
 */
import { NTL_GROUPS, NTL_GROUP_IDS } from './groups.mjs';
import { NTL_TABOO_TYPES } from './types/catalog.mjs';
import { NTL_TABOO_ENRICHMENT } from './enrichment/catalog.mjs';
import {
  NTL_TABOO_DEFAULT_MIN_CHARS,
  NTL_SHARED_DIMENSIONS,
  applyNtlTabooEnrichment,
  collectNtlEnrichment,
  evaluateNtlRichness,
  extractNtlRichnessText,
  buildNtlExpandSystemPrompt,
  buildNtlExpandUserPrompt,
  buildNtlTabooHintFromTypes,
  normalizeNtlTabooItems,
} from './enrichment/logic.mjs';

applyNtlTabooEnrichment(NTL_TABOO_TYPES);

export var NTL_TABOO_IDS = Object.keys(NTL_TABOO_TYPES);

export {
  NTL_GROUPS,
  NTL_GROUP_IDS,
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
