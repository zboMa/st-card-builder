/**
 * 提示词配置 · 目录只读浏览契约
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildPromptCatalogBrowser,
  PROMPT_CATALOG_TAB_META,
  CATALOG_STANDARD_SECTIONS,
} from '../src/lib/promptCatalogBrowser.mjs';

describe('promptCatalogBrowser', function() {
  it('含扩展规范与目录类 Tab 元数据', function() {
    assert.ok(PROMPT_CATALOG_TAB_META.length >= 9);
    assert.ok(CATALOG_STANDARD_SECTIONS.length >= 5);
    var ids = PROMPT_CATALOG_TAB_META.map(function(t) { return t.id; });
    assert.ok(ids.indexOf('__catalog_flavor__') >= 0);
    assert.ok(ids.indexOf('__catalog_posture__') >= 0);
    assert.ok(ids.indexOf('__catalog_speech__') >= 0);
    assert.ok(ids.indexOf('__catalog_ntl__') >= 0);
    assert.ok(ids.indexOf('__catalog_corruption__') >= 0);
    assert.ok(ids.indexOf('__catalog_worldview__') >= 0);
  });

  it('buildPromptCatalogBrowser 产出齐全且条目有正文', function() {
    var data = buildPromptCatalogBrowser();
    assert.equal(data.tabMeta.length, PROMPT_CATALOG_TAB_META.length);
    var flavor = data.sections.flavor;
    var posture = data.sections.posture;
    var speech = data.sections.speech;
    var ntl = data.sections.ntl;
    var corruption = data.sections.corruption;
    var wv = data.sections.worldview;
    var vf = data.sections.vesselFlavor;
    var vn = data.sections.vesselNtl;
    var st = data.sections.standards;
    assert.ok(flavor.items.length >= 60);
    assert.ok(posture.items.length >= 70);
    assert.ok(speech.items.length >= 70);
    assert.ok(ntl.items.length >= 35);
    assert.equal(corruption.items.length, 3);
    assert.ok(wv.items.length >= 70);
    assert.ok(vf.items.length >= 60);
    assert.ok(vn.items.length >= 35);
    assert.ok(st.items.length >= 5);

    var sample = flavor.items.find(function(x) { return x.id === 'vanilla'; }) || flavor.items[0];
    assert.ok(sample.description.length >= 300);
    assert.ok(sample.writingGuide.length >= 350);

    var age = ntl.items.find(function(x) { return x.id === 'age_gap'; });
    assert.ok(age);
    assert.ok(age.description.includes('成年礼'));
    assert.ok(age.description.includes('禁止儿童性化'));
    assert.ok(age.writingGuide.includes('不得以历史早婚'));

    var corr = corruption.items.find(function(x) { return x.id === '5'; });
    assert.ok(corr);
    assert.ok(corr.description.includes('禁止儿童性化'));
    assert.ok(corr.mustCover.length >= 6);
  });
});
