/**
 * 世界观成人载体：推断、丰满门禁、错位语汇、Canon 段
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  inferWorldframe,
  collectVesselEnrichment,
  buildVesselHint,
  evaluateVesselRichness,
  formatVesselCanonBlock,
  personMentionsVessels,
  WORLDFRAMES,
  VESSEL_SHARED_DIMENSIONS,
  FLAVOR_VESSEL_OVERLAYS,
  NTL_VESSEL_OVERLAYS,
} from '../src/lib/novel/adultWorldVessels.mjs';
import {
  emptyAdultAttrs,
  normalizeAdultAttrs,
  isAdultAttrsFilled,
  buildModeHintBlocks,
  setAdultMode,
  setNtlMode,
  setNsfwFlavorItems,
  setNtlTabooItems,
  resolveWorldframe,
  buildAdultCanonDigest,
} from '../src/lib/novel/nsfwSupport.mjs';
import { createDefaultNovelState } from '../src/lib/novel/state.mjs';

describe('adultWorldVessels', function() {
  it('推断修仙与现代异能', function() {
    var x = inferWorldframe({
      contextText: '宗门内修仙者争夺灵石，筑基期弟子暗修双修功法与法器',
    });
    assert.equal(x.id, 'xianxia');
    var m = inferWorldframe({
      contextText: '能力者协会对 S 级异能者发放抑制剂与精神力评级手环',
    });
    assert.equal(m.id, 'modern_ability');
  });

  it('强制覆盖框架', function() {
    var r = inferWorldframe({
      forced: 'campus',
      contextText: '宗门修仙灵力法器',
    });
    assert.equal(r.id, 'campus');
    assert.equal(r.source, 'forced');
  });

  it('载体 hint 含必写维度与丰满硬约束', function() {
    var hint = buildVesselHint({
      worldframe: 'xianxia',
      flavorItems: [{ id: 'domination' }],
      ntlItems: [{ id: 'yuri_destruction', note: '拆原纽带' }],
    });
    assert.match(hint, /世界观成人载体·丰满写作规范/);
    assert.match(hint, /修仙/);
    assert.match(hint, /必写维度/);
    assert.match(hint, /丰满硬约束/);
    assert.match(hint, /powerLogic/);
    assert.match(hint, /法器|双修|禁制/);
    assert.ok(VESSEL_SHARED_DIMENSIONS.length >= 5);
    assert.ok(FLAVOR_VESSEL_OVERLAYS.domination);
    assert.ok(NTL_VESSEL_OVERLAYS.yuri_destruction);
  });

  it('门禁：薄稿失败，丰满修仙载体通过', function() {
    var opts = {
      worldframe: 'xianxia',
      flavorItems: [{ id: 'domination' }],
    };
    var thin = evaluateVesselRichness('很涩的法器。', opts);
    assert.equal(thin.ok, false);

    var rich = {
      type: 'item',
      name: '镇魂锁',
      content: (
        '【成人向用法】镇魂锁以本命灵力驱动：神识注入锁环后可循经脉游走，'
        + '逐步收紧禁制。公开伪装为镇派法器；私下用于双修驯服。'
        + '代价是道心反噬与灵力空虚；Limits 禁止对筑基以下使用、禁止不可逆锁死神识。'
        + '相关人物秦月持有，用以驯服弟子。'
      ).repeat(2),
      attrs: {
        adult: {
          vesselKind: 'artifact',
          worldframe: 'xianxia',
          eroticRole: '驯服用本命法器',
          powerLogic: '神识注入锁环，循经脉收紧禁制',
          costOrRisk: '道心反噬、灵力空虚、走火风险',
          socialCover: '镇派护法法器',
          triggers: ['神识注入', '双修阵启动'],
          limits: ['筑基以下禁用', '禁止不可逆锁死神识'],
          playIdeas: ['锁脉驯服', '阵眼共鸣'],
          relatedPersons: ['秦月'],
          flavorHooks: ['domination'],
        },
      },
    };
    var ok = evaluateVesselRichness(rich, opts);
    assert.equal(ok.ok, true, ok.weakDimensions.join('；'));
  });

  it('错位语汇失败', function() {
    var bad = evaluateVesselRichness({
      content: '修仙世界里她拿出跳蛋和震动棒，用灵力驱动跳蛋。'.repeat(20)
        + '机制是灵力，代价是道心，伪装是法器，Limits 禁止外传，相关秦月。',
      attrs: {
        adult: {
          vesselKind: 'artifact',
          powerLogic: '灵力驱动',
          costOrRisk: '道心',
          socialCover: '法器',
          limits: ['禁止外传'],
          relatedPersons: ['秦月'],
        },
      },
    }, { worldframe: 'xianxia' });
    assert.equal(bad.ok, false);
    assert.ok(bad.weakDimensions.some(function(w) { return /错位/.test(w); }));
  });

  it('attrs.adult 厚度门槛', function() {
    var thin = emptyAdultAttrs();
    thin.eroticRole = '道具';
    thin.atmosphere = '暧昧';
    thin.limits = ['无'];
    assert.equal(isAdultAttrsFilled(thin), false);
    var full = normalizeAdultAttrs({
      eroticRole: '双修法器',
      atmosphere: '灵力潮热',
      vesselKind: 'artifact',
      powerLogic: '灵力注入',
      costOrRisk: '走火',
      socialCover: '本命剑穗',
      triggers: ['运功'],
      limits: ['禁不可逆'],
      playIdeas: ['锁脉'],
      relatedPersons: ['甲'],
    });
    assert.equal(isAdultAttrsFilled(full), true);
  });

  it('Canon 含载体段；mode hint 注入载体', function() {
    var digest = buildAdultCanonDigest({
      entities: [{
        type: 'item',
        name: '合欢铃',
        content: '双修时以灵力催响',
        attrs: {
          adult: {
            vesselKind: 'artifact',
            eroticRole: '双修信物',
            powerLogic: '灵力催响同步神识',
            costOrRisk: '情丝反噬',
            relatedPersons: ['乙'],
            limits: ['禁外人'],
            playIdeas: ['同频'],
          },
        },
      }],
      worldframeLabel: '修仙/仙侠',
      budget: 8000,
    });
    assert.match(digest, /世界观成人载体/);
    assert.match(digest, /合欢铃/);

    var s = createDefaultNovelState();
    setAdultMode(s, true);
    setNsfwFlavorItems(s, [{ id: 'contrast' }]);
    s.contextText = '异能协会与抑制剂';
    resolveWorldframe(s, { recompute: true });
    var blocks = buildModeHintBlocks(s, 'enrich');
    assert.match(blocks, /世界观成人载体/);
  });

  it('人物提及载体软门禁', function() {
    var vessels = [{ name: '镇魂锁' }, { name: '合欢丹' }];
    assert.equal(personMentionsVessels('她佩戴镇魂锁进入密室', vessels).ok, true);
    assert.equal(personMentionsVessels('她只是很紧张', vessels).missing, true);
    assert.equal(personMentionsVessels('无载体时', []).ok, true);
  });

  it('collect 合并口味与 NTL 覆盖', function() {
    var c = collectVesselEnrichment({
      worldframe: 'modern_ability',
      flavorItems: [{ id: 'dark' }],
      ntlIds: ['power_coercion'],
    });
    assert.equal(c.worldframe, 'modern_ability');
    assert.ok(c.mustCover.length >= 5);
    assert.ok(c.antiLexicon.some(function(w) { return w === '灵石'; }));
    assert.ok(WORLDFRAMES.modern_ability);
  });

  it('formatVesselCanonBlock', function() {
    var block = formatVesselCanonBlock([{
      type: 'nsfw',
      name: '抑制项圈条例',
      content: '协会发放',
      attrs: {
        kind: 'rule',
        powerLogic: '权限芯片锁定精神力',
        costOrRisk: '日志留痕',
        relatedNames: ['丙'],
        limits: ['禁私改'],
      },
    }], { worldframeLabel: '现代异能' });
    assert.match(block, /抑制项圈/);
    assert.match(block, /现代异能/);
  });

  it('state resolveWorldframe 缓存与强制', function() {
    var s = createDefaultNovelState();
    setAdultMode(s, true);
    setNtlMode(s, true);
    setNtlTabooItems(s, [{ id: 'yuri_destruction', note: '残片' }]);
    s.contextText = '校园社团教室宿舍';
    var a = resolveWorldframe(s, { recompute: true });
    assert.equal(a.id, 'campus');
    var b = resolveWorldframe(s);
    assert.equal(b.id, 'campus');
    assert.equal(b.source, 'cached');
  });
});
