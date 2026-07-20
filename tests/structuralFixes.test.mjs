/**
 * 结构性修复：suggest/force worldframe、兼容 shim 副作用、持久化字段并集契约
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  setAdultWorldframe,
  suggestAdultWorldframe,
  resolveWorldframe,
  setNsfwFlavor,
  setNsfwFlavorItems,
  getNsfwFlavorItems,
  NSFW_FLAVOR_PRESETS,
} from '../src/lib/novel/nsfwSupport.mjs';
import { createDefaultNovelState } from '../src/lib/novel/state.mjs';
import { NSFW_FLAVOR_PRESETS as viaShimPresets } from '../src/lib/novel/nsfwFlavorEnrichment.mjs';
import { NTL_TABOO_TYPES as viaNtlShim } from '../src/lib/novel/ntlTabooEnrichment.mjs';
import { buildWorldviewHint, getWorldviewPreset } from '../src/lib/presets/worldviews/index.mjs';

var __dirname = path.dirname(fileURLToPath(import.meta.url));

/** AI 配置并集字段（与 browserApp.saveAIConfig 对齐，供契约测试） */
var AI_CONFIG_UNION_KEYS = [
  'url', 'key', 'model', 'debug', 'tagContextChars',
  'embeddingModel', 'embeddingApiUrl', 'embeddingApiKey', 'novelRag',
  'presetList', 'worldviewPresetId', 'worldviewPresetItems',
  'nsfwEnabled', 'nsfwFlavor', 'nsfwFlavorItems', 'eroticPostureItems', 'eroticSpeechItems',
  'ntlEnabled', 'ntlTabooTypes', 'ntlTabooItems',
  'corruptionEnabled', 'corruptionPreset', 'corruptionCustomBrief',
  'corruptionStageNames', 'corruptionSelectedNames',
  'corruptionDefaultFemaleOnly', 'corruptionSyncStatusBar',
  'adultWorldframe', 'adultWorldframeForced',
];

describe('structuralFixes', function() {
  it('suggestAdultWorldframe 不设 forced；set 才强制', function() {
    var s = createDefaultNovelState();
    suggestAdultWorldframe(s, 'xianxia');
    assert.equal(s.adultWorldframe, 'xianxia');
    assert.equal(s.adultWorldframeForced, '');
    assert.equal(s.adultWorldframeSource, 'suggest');
    var r = resolveWorldframe(s);
    assert.equal(r.id, 'xianxia');

    setAdultWorldframe(s, 'modern_ability');
    assert.equal(s.adultWorldframeForced, 'modern_ability');
    assert.equal(s.adultWorldframeSource, 'forced');

    // 已 forced 时 suggest 不得覆盖
    suggestAdultWorldframe(s, 'xianxia');
    assert.equal(s.adultWorldframeForced, 'modern_ability');
    assert.equal(s.adultWorldframe, 'modern_ability');
  });

  it('setNsfwFlavor 会清 note；多选应用 setNsfwFlavorItems 保留', function() {
    var s = createDefaultNovelState();
    var ids = Object.keys(NSFW_FLAVOR_PRESETS);
    assert.ok(ids.length >= 2);
    setNsfwFlavorItems(s, [
      { id: ids[0], note: '保留备注A' },
      { id: ids[1], note: '保留备注B' },
    ]);
    var before = getNsfwFlavorItems(s);
    assert.equal(before[0].note, '保留备注A');
    // 旧 API 会把主口味 note 置空——证明 source.render 不该再调它
    setNsfwFlavor(s, ids[0]);
    var after = getNsfwFlavorItems(s);
    assert.equal(after[0].id, ids[0]);
    assert.equal(after[0].note, '');
  });

  it('兼容 shim 经 index 带 mustCover 副作用', function() {
    var id = Object.keys(viaShimPresets)[0];
    assert.ok(Array.isArray(viaShimPresets[id].mustCover) && viaShimPresets[id].mustCover.length >= 1);
    var ntlId = Object.keys(viaNtlShim)[0];
    assert.ok(Array.isArray(viaNtlShim[ntlId].mustCover) && viaNtlShim[ntlId].mustCover.length >= 1);
  });

  it('世界观 mapsToWorldframe 指向已知框架；hint 可用于世界书阶段', function() {
    var p = getWorldviewPreset('xianxia');
    assert.ok(p && p.mapsToWorldframe);
    var hint = buildWorldviewHint('xianxia', { stage: 'worldbook' });
    assert.ok(hint.includes('世界书骨架') || hint.includes('必写维度'));
  });

  it('AI 配置并集契约含 worldview 与 adultWorldframe 与恶堕', function() {
    assert.ok(AI_CONFIG_UNION_KEYS.indexOf('worldviewPresetId') >= 0);
    assert.ok(AI_CONFIG_UNION_KEYS.indexOf('worldviewPresetItems') >= 0);
    assert.ok(AI_CONFIG_UNION_KEYS.indexOf('adultWorldframe') >= 0);
    assert.ok(AI_CONFIG_UNION_KEYS.indexOf('adultWorldframeForced') >= 0);
    assert.ok(AI_CONFIG_UNION_KEYS.indexOf('corruptionEnabled') >= 0);
    var src = fs.readFileSync(path.join(__dirname, '../src/lib/card-builder/browserApp.mjs'), 'utf8');
    AI_CONFIG_UNION_KEYS.forEach(function(k) {
      assert.ok(src.indexOf(k) >= 0, 'browserApp missing key ' + k);
    });
    assert.ok(src.indexOf('__persistAiConfig__') >= 0);
    var eng = fs.readFileSync(path.join(__dirname, '../src/lib/card-builder/panels/aiEngine.mjs'), 'utf8');
    assert.ok(eng.indexOf('function persistAiConfig') >= 0);
    assert.ok(eng.indexOf('世界书按钮由 worldbook.bind 独占') >= 0);
    var srcPanel = fs.readFileSync(path.join(__dirname, '../src/lib/novel/panels/source.mjs'), 'utf8');
    assert.ok(srcPanel.indexOf('setNsfwFlavor') < 0);
  });
});
