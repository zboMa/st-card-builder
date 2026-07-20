/**
 * 世界观框架目录（现有 + 扩展 + 第二波）
 */
import { FRAMES as EXISTING_FRAMES, ENRICHMENT as EXISTING_ENRICHMENT } from './existing.mjs';
import { FRAMES as EXTENDED_FRAMES, ENRICHMENT as EXTENDED_ENRICHMENT } from './extended.mjs';
import { FRAMES as WAVE2_FRAMES, ENRICHMENT as WAVE2_ENRICHMENT } from './wave2.mjs';

export var WORLDFRAMES = Object.assign({}, EXISTING_FRAMES, EXTENDED_FRAMES, WAVE2_FRAMES);

export var WORLDFRAME_IDS = Object.keys(WORLDFRAMES);

export var WORLDFRAME_VESSEL_ENRICHMENT = Object.assign(
  {},
  EXISTING_ENRICHMENT,
  EXTENDED_ENRICHMENT,
  WAVE2_ENRICHMENT
);
