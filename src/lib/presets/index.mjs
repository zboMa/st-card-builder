/**
 * 制卡/引擎可选预设聚合
 * 扩展：新建 presets/<domain>/ 并在此 re-export
 */
export {
  WORLDVIEW_GROUPS,
  WORLDVIEW_PRESETS,
  WORLDVIEW_PRESET_MAP,
  WORLDVIEW_PRESET_IDS,
  MAX_WORLDVIEW_PRESET_ITEMS,
  WORLDVIEW_QUALITY_FLOOR,
  getWorldviewPreset,
  listWorldviewPresetsByGroup,
  normalizeWorldviewPresetItems,
  primaryWorldviewPresetId,
  buildWorldviewHint,
  buildWorldviewHintFromItems,
  composeWorldviewUserPrompt,
  checkWorldviewPresetQuality,
} from './worldviews/index.mjs';
