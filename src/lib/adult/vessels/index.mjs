/**
 * 成人 · 世界观载体（World Vessels）
 * 口味 / NTL × 世界观语汇 → 物品 / 能力 / 场所 / 规则 / 组织等可物化设定
 */
export {
  VESSEL_DEFAULT_MIN_CHARS,
  VESSEL_KINDS,
  VESSEL_KIND_LABELS,
  VESSEL_SHARED_DIMENSIONS,
} from './kinds.mjs';

export {
  WORLDFRAMES,
  WORLDFRAME_IDS,
  WORLDFRAME_VESSEL_ENRICHMENT,
} from './frames/catalog.mjs';

export { FLAVOR_VESSEL_OVERLAYS } from './overlays/flavor.mjs';
export { NTL_VESSEL_OVERLAYS, NTL_OVERLAY_ALIASES } from './overlays/ntl.mjs';

export {
  inferWorldframe,
  collectVesselEnrichment,
  buildVesselHint,
  extractVesselRichnessText,
  evaluateVesselRichness,
  buildVesselExpandSystemPrompt,
  buildVesselExpandUserPrompt,
  isVesselEntity,
  listVesselEntities,
  personMentionsVessels,
  formatVesselCanonBlock,
  buildStatusBarVesselDraftFromEntities,
} from './logic.mjs';
