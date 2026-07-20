/**
 * catalog summary 契约：20–40 字；挂载到口味/NTL/世界观/框架
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NSFW_FLAVOR_PRESETS, NSFWFLAVOR_IDS } from '../src/lib/adult/flavors/index.mjs';
import { NTL_TABOO_TYPES, NTL_TABOO_IDS } from '../src/lib/adult/ntl/index.mjs';
import {
  EROTIC_POSTURE_PRESETS,
  EROTIC_SPEECH_PRESETS,
} from '../src/lib/adult/expression/index.mjs';
import { WORLDVIEW_PRESETS } from '../src/lib/presets/worldviews/index.mjs';
import { WORLDFRAMES, WORLDFRAME_IDS } from '../src/lib/adult/vessels/index.mjs';
import { buildCatalogOverviewText } from '../src/lib/catalogSummaries.mjs';

function assertSummary(id, s) {
  assert.ok(s, id + ' missing summary');
  assert.ok(s.length >= 20 && s.length <= 40, id + ' summary len ' + s.length + '「' + s + '」');
}

describe('catalogSummaries', function() {
  it('口味每条 summary 20–40', function() {
    NSFWFLAVOR_IDS.forEach(function(id) {
      assertSummary(id, NSFW_FLAVOR_PRESETS[id].summary);
    });
  });
  it('NTL 每条 summary 20–40', function() {
    NTL_TABOO_IDS.forEach(function(id) {
      assertSummary(id, NTL_TABOO_TYPES[id].summary);
    });
  });
  it('世界观每条 summary 20–40', function() {
    WORLDVIEW_PRESETS.forEach(function(p) {
      assertSummary(p.id, p.summary);
    });
  });
  it('框架每条 summary 20–40', function() {
    WORLDFRAME_IDS.forEach(function(id) {
      assertSummary(id, WORLDFRAMES[id].summary);
    });
  });
  it('buildCatalogOverviewText 含关键区', function() {
    var t = buildCatalogOverviewText({
      flavors: NSFW_FLAVOR_PRESETS,
      postures: EROTIC_POSTURE_PRESETS,
      speeches: EROTIC_SPEECH_PRESETS,
      ntl: NTL_TABOO_TYPES,
      worldframes: WORLDFRAMES,
      worldviews: WORLDVIEW_PRESETS,
    });
    assert.ok(t.includes('口味'));
    assert.ok(t.includes('姿势语言'));
    assert.ok(t.includes('情趣话风'));
    assert.ok(t.includes('NTL'));
    assert.ok(t.includes('世界观框架'));
    assert.ok(t.includes('vanilla'));
    assert.ok(t.includes(Object.keys(EROTIC_POSTURE_PRESETS)[0]));
    assert.ok(t.includes('age_gap'));
  });
});
