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
import { buildCatalogOverviewText, buildCatalogIndexText, buildAdultCatalogData, isCatalogRelevantText } from '../src/lib/catalogSummaries.mjs';

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
  it('表达层每条 summary 12–28', function() {
    Object.keys(EROTIC_POSTURE_PRESETS).forEach(function(id) {
      assert.ok(EROTIC_POSTURE_PRESETS[id].summary, id + ' posture missing summary');
      assert.ok(EROTIC_POSTURE_PRESETS[id].summary.length >= 12
        && EROTIC_POSTURE_PRESETS[id].summary.length <= 28,
        id + ' posture summary len ' + EROTIC_POSTURE_PRESETS[id].summary.length);
    });
    Object.keys(EROTIC_SPEECH_PRESETS).forEach(function(id) {
      assert.ok(EROTIC_SPEECH_PRESETS[id].summary, id + ' speech missing summary');
      assert.ok(EROTIC_SPEECH_PRESETS[id].summary.length >= 12
        && EROTIC_SPEECH_PRESETS[id].summary.length <= 28,
        id + ' speech summary len ' + EROTIC_SPEECH_PRESETS[id].summary.length);
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

  it('buildAdultCatalogData 分组与中文标签', function() {
    var d = buildAdultCatalogData({
      flavors: NSFW_FLAVOR_PRESETS,
      postures: EROTIC_POSTURE_PRESETS,
      speeches: EROTIC_SPEECH_PRESETS,
      ntl: NTL_TABOO_TYPES,
      worldframes: WORLDFRAMES,
      worldviews: WORLDVIEW_PRESETS,
    });
    assert.ok(Array.isArray(d.flavors) && d.flavors.length > 0);
    assert.ok(Array.isArray(d.postures) && d.postures.length > 0);
    assert.ok(Array.isArray(d.speeches) && d.speeches.length > 0);
    // NTL 分组用中文标签
    var bondGroup = d.ntl.find(function(g) { return g.group === '纽带禁忌'; });
    assert.ok(bondGroup, 'NTL 应有中文分组「纽带禁忌」');
    assert.ok(bondGroup.items.some(function(it) { return it.id === 'age_gap'; }));
    // 世界观分组用中文标签且覆盖全部条目
    var oriental = d.worldviews.find(function(g) { return g.group === '东方玄幻'; });
    assert.ok(oriental, '世界观应有中文分组「东方玄幻」');
    var wvTotal = d.worldviews.reduce(function(n, g) { return n + g.items.length; }, 0);
    assert.equal(wvTotal, WORLDVIEW_PRESETS.length);
    // 框架平铺且跳过 generic
    assert.ok(d.worldframes.every(function(w) { return w.id !== 'generic'; }));
    // 每项必含 id/label/summary
    d.flavors.forEach(function(g) {
      g.items.forEach(function(it) {
        assert.ok(it.id && it.label != null && it.summary != null, 'flavor item 缺字段: ' + (it && it.id));
      });
    });
  });

  it('buildCatalogIndexText 紧凑且指向 get_adult_catalog', function() {
    var t = buildCatalogIndexText({
      flavors: NSFW_FLAVOR_PRESETS,
      postures: EROTIC_POSTURE_PRESETS,
      speeches: EROTIC_SPEECH_PRESETS,
      ntl: NTL_TABOO_TYPES,
      worldframes: WORLDFRAMES,
      worldviews: WORLDVIEW_PRESETS,
    });
    assert.ok(t.includes('get_adult_catalog'), '索引应指向 get_adult_catalog');
    assert.ok(t.includes('口味 NSFW'));
    assert.ok(t.includes('NTL 禁忌'));
    assert.ok(t.includes('世界观预设'));
    // 紧凑：远小于全量概览
    var full = buildCatalogOverviewText({
      flavors: NSFW_FLAVOR_PRESETS,
      postures: EROTIC_POSTURE_PRESETS,
      speeches: EROTIC_SPEECH_PRESETS,
      ntl: NTL_TABOO_TYPES,
      worldframes: WORLDFRAMES,
      worldviews: WORLDVIEW_PRESETS,
    });
    assert.ok(t.length * 8 < full.length, '索引应显著小于全量概览: idx=' + t.length + ' full=' + full.length);
  });

  it('isCatalogRelevantText 命中目录关键词', function() {
    assert.ok(isCatalogRelevantText('帮我配一张重口世界观卡'));
    assert.ok(isCatalogRelevantText('推荐搭配口味和 NTL'));
    assert.ok(!isCatalogRelevantText('检查一下世界书'));
    assert.ok(!isCatalogRelevantText(''));
    assert.ok(!isCatalogRelevantText('帮我润色开场白'));
  });
});
