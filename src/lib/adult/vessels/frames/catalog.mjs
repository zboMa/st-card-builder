/**
 * 世界观框架目录（现有 + 扩展 + 第二波 + 第三波 + 第四波）
 */
import { FRAMES as EXISTING_FRAMES, ENRICHMENT as EXISTING_ENRICHMENT } from './existing.mjs';
import { FRAMES as EXTENDED_FRAMES, ENRICHMENT as EXTENDED_ENRICHMENT } from './extended.mjs';
import { FRAMES as WAVE2_FRAMES, ENRICHMENT as WAVE2_ENRICHMENT } from './wave2.mjs';
import { FRAMES as WAVE3_FRAMES, ENRICHMENT as WAVE3_ENRICHMENT } from './wave3.mjs';
import { FRAMES as WAVE4_FRAMES, ENRICHMENT as WAVE4_ENRICHMENT } from './wave4.mjs';
import { FRAMES as WAVE5_FRAMES, ENRICHMENT as WAVE5_ENRICHMENT } from './wave5.mjs';
import { FRAMES as WAVE6_FRAMES, ENRICHMENT as WAVE6_ENRICHMENT } from './wave6.mjs';
import { WORLDFRAME_SUMMARIES } from './summaries.mjs';
import { applySummaries } from '../../../catalogSummaries.mjs';

export var WORLDFRAMES = applySummaries(
  Object.assign({}, EXISTING_FRAMES, EXTENDED_FRAMES, WAVE2_FRAMES, WAVE3_FRAMES, WAVE4_FRAMES, WAVE5_FRAMES, WAVE6_FRAMES),
  WORLDFRAME_SUMMARIES
);

export var WORLDFRAME_IDS = Object.keys(WORLDFRAMES);

export var WORLDFRAME_VESSEL_ENRICHMENT = Object.assign(
  {},
  EXISTING_ENRICHMENT,
  EXTENDED_ENRICHMENT,
  WAVE2_ENRICHMENT,
  WAVE3_ENRICHMENT,
  WAVE4_ENRICHMENT,
  WAVE5_ENRICHMENT,
  WAVE6_ENRICHMENT
);

export { WORLDFRAME_SUMMARIES };
