/**
 * 兼容出口：丰满规范已拆至 enrichment/
 */
export {
  NSFW_FLAVOR_DEFAULT_MIN_CHARS,
  NSFW_FLAVOR_ENRICHMENT,
  FLAVOR_SHARED_DIMENSIONS,
  applyFlavorEnrichment,
  collectFlavorEnrichment,
  evaluateFlavorRichness,
  extractFlavorRichnessText,
  buildFlavorExpandSystemPrompt,
  buildFlavorExpandUserPrompt,
  compactCharCount,
} from './enrichment/logic.mjs';
