/** @deprecated 请改从 `enrichment/logic.mjs` / `enrichment/catalog.mjs` 或 `index.mjs` 导入；本文件仅兼容旧路径 */
export { NTL_TABOO_ENRICHMENT } from './enrichment/catalog.mjs';
export {
  NTL_TABOO_DEFAULT_MIN_CHARS,
  NTL_SHARED_DIMENSIONS,
  applyNtlTabooEnrichment,
  collectNtlEnrichment,
  compactNtlCharCount,
  extractNtlRichnessText,
  evaluateNtlRichness,
  buildNtlExpandSystemPrompt,
  buildNtlExpandUserPrompt,
  normalizeNtlTabooItems,
  buildNtlTabooHintFromTypes,
} from './enrichment/logic.mjs';
