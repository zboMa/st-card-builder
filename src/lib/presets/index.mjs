/**
 * 制卡/引擎可选预设聚合
 * 扩展：新建 presets/<domain>/ 并在此 re-export
 */
export {
  WORLDVIEW_GROUPS,
  WORLDVIEW_PRESETS,
  WORLDVIEW_PRESET_MAP,
  WORLDVIEW_PRESET_IDS,
  getWorldviewPreset,
  listWorldviewPresetsByGroup,
  buildWorldviewHint,
  composeWorldviewUserPrompt,
} from './worldviews/index.mjs';
