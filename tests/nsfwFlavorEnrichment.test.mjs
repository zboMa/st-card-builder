/**
 * NSFW 口味丰满规范与门禁
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  NSFW_FLAVOR_PRESETS,
  NSFWFLAVOR_IDS,
  buildNsfwFlavorHintFromItems,
  collectFlavorEnrichment,
  evaluateFlavorRichness,
  setAdultMode,
  setNsfwFlavorItems,
  buildNsfwFlavorHint,
  buildPaletteGuidanceBlock,
} from '../src/lib/novel/nsfwSupport.mjs';
import {
  NSFW_FLAVOR_ENRICHMENT,
  NSFW_FLAVOR_DEFAULT_MIN_CHARS,
  FLAVOR_SHARED_DIMENSIONS,
  buildFlavorExpandSystemPrompt,
} from '../src/lib/novel/nsfwFlavorEnrichment.mjs';
import { createDefaultNovelState } from '../src/lib/novel/state.mjs';

describe('nsfw flavor enrichment', function() {
  it('全部 21 口味均有丰满字段', function() {
    assert.equal(NSFWFLAVOR_IDS.length, 21);
    NSFWFLAVOR_IDS.forEach(function(id) {
      var f = NSFW_FLAVOR_PRESETS[id];
      var en = NSFW_FLAVOR_ENRICHMENT[id];
      assert.ok(en, id + ' 缺 enrichment');
      assert.ok(Array.isArray(f.mustCover) && f.mustCover.length >= 3, id + ' mustCover');
      assert.ok(String(f.writingGuide || '').length > 20, id + ' writingGuide');
      assert.ok(Array.isArray(f.antiPatterns) && f.antiPatterns.length >= 2, id + ' antiPatterns');
      assert.ok(f.densityHint >= NSFW_FLAVOR_DEFAULT_MIN_CHARS, id + ' densityHint');
    });
    assert.equal(FLAVOR_SHARED_DIMENSIONS.length, 5);
  });

  it('加厚 hint 含必写维度与硬约束', function() {
    var hint = buildNsfwFlavorHintFromItems([
      { id: 'contrast', note: '制服裂缝' },
      { id: 'vanilla', note: '' },
    ]);
    assert.match(hint, /丰满写作规范/);
    assert.match(hint, /必写维度/);
    assert.match(hint, /心理动机与自我叙事/);
    assert.match(hint, /反差向/);
    assert.match(hint, /制服裂缝/);
    assert.match(hint, /写作指南/);
    assert.match(hint, /丰满硬约束/);
    assert.match(hint, /≥\d+字/);
  });

  it('collect 合并密度取最大', function() {
    var c = collectFlavorEnrichment(
      [{ id: 'sweet' }, { id: 'intense' }],
      NSFW_FLAVOR_PRESETS
    );
    assert.ok(c.densityHint >= NSFW_FLAVOR_PRESETS.intense.densityHint);
    assert.ok(c.mustCover.length >= 3);
    assert.ok(c.writingGuides.length >= 2);
  });

  it('门禁：薄稿失败，丰满稿通过', function() {
    var items = [{ id: 'contrast', note: '' }];
    var thin = evaluateFlavorRichness('反差。', items, { presets: NSFW_FLAVOR_PRESETS });
    assert.equal(thin.ok, false);
    assert.ok(thin.weakDimensions.length);

    var rich = {
      NSFW_information: {
        body: '体温偏凉，紧张时耳尖发红，呼吸变浅。',
        sexual_psychology: {
          core_desire: '渴望在失控中被看穿',
          core_fear: '害怕公开人设崩塌',
          shame_sources: ['被发现私下的乖顺'],
          desire_expression: '外壳裂开后的沉溺',
          arousal_signature: '越羞耻越兴奋',
          fantasy_vs_reality: '幻想被按住，现实仍端着',
          attachment_after: '事后自我厌恶又想再来',
        },
        Limits: ['公开场合暴露', '无安全词的强制'],
        aftercare: '需要独处十分钟再拥抱确认',
        contrast: '公开清冷，私下失控与反差外壳崩裂',
        inner_erotic_thoughts: '不该这样却停不下来的心理与自我叙事',
        relationship_dynamic: '关系距离在权力与依赖间摇摆，信任脆弱',
        consent: '边界清晰，可拒绝，安全信号明确',
      },
    };
    // pad to density
    rich.NSFW_information.detail = '感官细节与身体反应连续写出：颤抖、喘息、触感、温度变化。'.repeat(8);
    var ok = evaluateFlavorRichness(rich, items, { presets: NSFW_FLAVOR_PRESETS });
    assert.equal(ok.ok, true, ok.weakDimensions.join('；'));
  });

  it('扩写系统提示含必写维度', function() {
    var sys = buildFlavorExpandSystemPrompt([{ id: 'dark' }], { presets: NSFW_FLAVOR_PRESETS });
    assert.match(sys, /扩写编辑/);
    assert.match(sys, /暗黑/);
    assert.match(sys, /必写维度/);
  });

  it('state hint / palette 注入丰满要求', function() {
    var s = createDefaultNovelState();
    setAdultMode(s, true);
    setNsfwFlavorItems(s, [{ id: 'domination', note: '皮革仪式' }]);
    var hint = buildNsfwFlavorHint(s);
    assert.match(hint, /调教向/);
    assert.match(hint, /必写维度/);
    var pal = buildPaletteGuidanceBlock(s);
    assert.match(pal, /必写维度/);
    assert.match(pal, /≥\d+字/);
  });
});
