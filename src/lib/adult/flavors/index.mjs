/**
 * 成人 · NSFW 口味（预设 + 丰满规范）
 * 扩展：在 presets/{group}.mjs 追加条目，并在 enrichment/{group}.mjs 补齐同 id 规范
 */
import { FLAVOR_GROUPS } from './groups.mjs';
import { NSFW_FLAVOR_PRESETS } from './presets/catalog.mjs';
import { NSFW_FLAVOR_ENRICHMENT } from './enrichment/catalog.mjs';
import { FLAVOR_SUMMARIES } from './summaries.mjs';
import { applySummaries } from '../../catalogSummaries.mjs';
import {
  NSFW_FLAVOR_DEFAULT_MIN_CHARS,
  FLAVOR_SHARED_DIMENSIONS,
  applyFlavorEnrichment,
  collectFlavorEnrichment,
  evaluateFlavorRichness,
  extractFlavorRichnessText,
  buildFlavorExpandSystemPrompt,
  buildFlavorExpandUserPrompt,
  compactCharCount,
} from './enrichment/logic.mjs';

applyFlavorEnrichment(NSFW_FLAVOR_PRESETS);
applySummaries(NSFW_FLAVOR_PRESETS, FLAVOR_SUMMARIES);

export var NSFWFLAVOR_IDS = Object.keys(NSFW_FLAVOR_PRESETS);

export {
  FLAVOR_GROUPS,
  NSFW_FLAVOR_PRESETS,
  FLAVOR_SUMMARIES,
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
