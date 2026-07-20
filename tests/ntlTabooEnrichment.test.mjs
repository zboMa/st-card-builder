/**
 * NTL 禁忌丰满规范 + 百破
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  NTL_TABOO_TYPES,
  NTL_TABOO_IDS,
  buildNtlTabooHint,
  buildNtlTabooHintFromTypes,
  collectNtlEnrichment,
  evaluateNtlRichness,
  setNtlMode,
  setNtlTabooTypes,
  buildPaletteGuidanceBlock,
} from '../src/lib/novel/nsfwSupport.mjs';
import {
  NTL_TABOO_ENRICHMENT,
  NTL_TABOO_DEFAULT_MIN_CHARS,
  NTL_SHARED_DIMENSIONS,
  buildNtlExpandSystemPrompt,
} from '../src/lib/novel/ntlTabooEnrichment.mjs';
import { createDefaultNovelState } from '../src/lib/novel/state.mjs';

describe('ntl taboo enrichment', function() {
  it('含百破且共 25 类，均有丰满字段与分组', function() {
    assert.equal(NTL_TABOO_IDS.length, 25);
    assert.ok(NTL_TABOO_TYPES.yuri_destruction);
    assert.equal(NTL_TABOO_TYPES.yuri_destruction.label, '百破');
    assert.match(NTL_TABOO_TYPES.yuri_destruction.description, /百合破坏/);
    assert.equal(NTL_TABOO_TYPES.yuri_destruction.group, 'rupture');
    assert.equal(NTL_TABOO_TYPES.power_coercion.group, 'coercion');
    assert.equal(NTL_TABOO_TYPES.age_gap.group, 'bond');
    assert.match(NTL_TABOO_TYPES.age_gap.description, /成年礼/);
    assert.match(NTL_TABOO_TYPES.age_gap.description, /禁止儿童性化/);
    assert.match(NTL_TABOO_TYPES.age_gap.writingGuide, /不得以历史早婚/);
    assert.equal(NTL_SHARED_DIMENSIONS.length, 5);

    NTL_TABOO_IDS.forEach(function(id) {
      var t = NTL_TABOO_TYPES[id];
      var en = NTL_TABOO_ENRICHMENT[id];
      assert.ok(en, id + ' 缺 enrichment');
      assert.ok(t.group, id + ' 缺 group');
      assert.ok(Array.isArray(t.mustCover) && t.mustCover.length >= 3, id + ' mustCover');
      assert.ok(Array.isArray(en.mustCover) && en.mustCover.length >= 3, id + ' en.mustCover');
      assert.ok(String(t.writingGuide || '').length > 20, id + ' writingGuide');
      assert.ok(Array.isArray(t.antiPatterns) && t.antiPatterns.length >= 2, id + ' antiPatterns');
      assert.ok(Array.isArray(en.signals) && en.signals.length >= 1, id + ' signals');
      assert.ok(t.densityHint >= NTL_TABOO_DEFAULT_MIN_CHARS, id + ' densityHint');
    });
  });

  it('加厚 hint 含必写维度与百破写法', function() {
    var hint = buildNtlTabooHintFromTypes(['yuri_destruction', 'power_coercion'], {
      tabooTypes: NTL_TABOO_TYPES,
    });
    assert.match(hint, /丰满写作规范/);
    assert.match(hint, /百破/);
    assert.match(hint, /百合/);
    assert.match(hint, /权力胁迫/);
    assert.match(hint, /必写维度/);
    assert.match(hint, /丰满硬约束/);
    assert.match(hint, /≥\d+字/);
  });

  it('门禁：薄稿失败，丰满稿通过', function() {
    var types = ['yuri_destruction'];
    var thin = evaluateNtlRichness('很禁忌。', types, { tabooTypes: NTL_TABOO_TYPES });
    assert.equal(thin.ok, false);

    var rich = {
      attrs: {
        ntl: {
          powerDynamic: '介入者掌控资源与情感话语权，原百合双方权力不对等被撕开',
          tabooThemes: ['百合破坏', '介入侵占'],
          coercionHint: '以「更懂你」为诱因逐步瓦解原纽带',
          moralConflict: '明知拆散原爱恋仍沉溺禁忌快感与悔恨',
          dominantRole: '介入者',
          emotionalCost: '事后罪疚与刺激并存，反复合理化',
          secrets: ['对局外人隐瞒原百合关系残片'],
        },
      },
      content: ('原女女纽带被介入撕开：心理账、秘密暴露风险、破坏后的关系残片与余波。').repeat(10),
    };
    var ok = evaluateNtlRichness(rich, types, { tabooTypes: NTL_TABOO_TYPES });
    assert.equal(ok.ok, true, ok.weakDimensions.join('；'));
  });

  it('state hint / palette 注入 NTL 丰满要求', function() {
    var s = createDefaultNovelState();
    setNtlMode(s, true);
    setNtlTabooTypes(s, ['yuri_destruction']);
    var hint = buildNtlTabooHint(s);
    assert.match(hint, /百破/);
    assert.match(hint, /必写维度/);
    var pal = buildPaletteGuidanceBlock(s);
    assert.match(pal, /百破|百合破坏/);
    assert.match(pal, /NTL 相关正文/);
  });

  it('collect 与 expand 系统提示', function() {
    var c = collectNtlEnrichment(['yuri_destruction'], NTL_TABOO_TYPES);
    assert.ok(c.mustCover.some(function(m) { return /百合|纽带|破坏/.test(m); }));
    var sys = buildNtlExpandSystemPrompt(['yuri_destruction'], { tabooTypes: NTL_TABOO_TYPES });
    assert.match(sys, /百破/);
    assert.match(sys, /必写维度/);
  });
});
