/**
 * 成人 · NSFW 口味（预设 + 丰满规范）
 * 扩展：在 presets.mjs 追加条目，并在 enrichment.mjs 补齐同 id 规范
 */
import { NSFW_FLAVOR_PRESETS } from './presets.mjs';
import {
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
} from './enrichment.mjs';

applyFlavorEnrichment(NSFW_FLAVOR_PRESETS);

export var NSFWFLAVOR_IDS = Object.keys(NSFW_FLAVOR_PRESETS);

export {
  NSFW_FLAVOR_PRESETS,
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
};
