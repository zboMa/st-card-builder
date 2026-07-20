/**
 * 表达层：姿势语言 + 情趣话风（多选、不占口味槽）
 */
import { POSTURE_GROUPS, SPEECH_GROUPS } from './groups.mjs';
import { EROTIC_POSTURE_PRESETS, EROTIC_POSTURE_IDS } from './postures/catalog.mjs';
import { EROTIC_SPEECH_PRESETS, EROTIC_SPEECH_IDS } from './speech/catalog.mjs';
import {
  EXPRESSION_DESC_MIN,
  EXPRESSION_DESC_MAX,
  EXPRESSION_GUIDE_MIN,
  EXPRESSION_GUIDE_MAX,
  EXPRESSION_SUMMARY_MIN,
  EXPRESSION_SUMMARY_MAX,
  normalizeExpressionItems,
  getPreset,
  buildExpressionHintFromItems,
  checkExpressionEntryQuality,
} from './logic.mjs';

export function buildPostureHintFromItems(items, opts) {
  return buildExpressionHintFromItems(items, EROTIC_POSTURE_PRESETS, Object.assign({ kind: 'posture' }, opts || {}));
}

export function buildSpeechHintFromItems(items, opts) {
  return buildExpressionHintFromItems(items, EROTIC_SPEECH_PRESETS, Object.assign({ kind: 'speech' }, opts || {}));
}

export {
  POSTURE_GROUPS,
  SPEECH_GROUPS,
  EROTIC_POSTURE_PRESETS,
  EROTIC_POSTURE_IDS,
  EROTIC_SPEECH_PRESETS,
  EROTIC_SPEECH_IDS,
  EXPRESSION_DESC_MIN,
  EXPRESSION_DESC_MAX,
  EXPRESSION_GUIDE_MIN,
  EXPRESSION_GUIDE_MAX,
  EXPRESSION_SUMMARY_MIN,
  EXPRESSION_SUMMARY_MAX,
  normalizeExpressionItems,
  getPreset,
  buildExpressionHintFromItems,
  checkExpressionEntryQuality,
};
