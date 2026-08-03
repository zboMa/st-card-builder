import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAdultSystemDigest,
  hasMeaningfulSystemDigest,
  upsertSystemDigestEntries,
  isSystemDigestComment,
  SYSTEM_DIGEST_PREFIX,
  SYSTEM_DIGEST_ORDER,
  mergeCorruptionConfigNote,
  stripCorruptionConfigNote,
  mergeAffectionConfigNote,
  stripAffectionConfigNote,
} from '../src/lib/adult/systemDigest.mjs';

var fullCfg = {
  nsfwEnabled: true,
  flavorItems: [{ id: 'domination', note: '安全词机制' }, { id: 'brat', note: '' }],
  postureItems: [{ id: 'face_missionary_intimate', note: '' }],
  speechItems: [{ id: 'soft_checkins', note: '禁幼' }],
  ntlEnabled: true,
  ntlTabooItems: [{ id: 'power_coercion', note: '' }, { id: 'blackmail', note: '保留反噬' }],
  worldviewPresetItems: [{ id: 'xianxia', note: '修仙为壳' }, { id: 'succubus', note: '' }],
  adultWorldframe: 'xianxia',
  corruptionEnabled: true,
  corruptionPreset: '5',
  corruptionStageNames: ['傲慢', '嫉妒', '愤怒'],
  corruptionExtraNotes: '保留清醒的自我认知',
};

test('buildAdultSystemDigest 全配置 → 6 条体系总纲（恶堕并入进度总则，不再独立成条）', function() {
  var es = buildAdultSystemDigest(fullCfg);
  assert.equal(es.length, 6);
  var comments = es.map(function(e) { return e.comment; });
  assert.deepEqual(comments, [
    '[成人体系]世界观',
    '[成人体系]载体框架',
    '[成人体系]NSFW口味',
    '[成人体系]姿势语言',
    '[成人体系]情趣话风',
    '[成人体系]NTL禁忌',
  ]);
  es.forEach(function(e) {
    assert.ok(isSystemDigestComment(e.comment));
    assert.equal(e.strategy, 'constant');
    assert.equal(e.position, 0);
    assert.equal(e.prob, 100);
    assert.ok(e.order >= 900 && e.order <= 950);
    assert.ok(String(e.content).length > 20);
  });
});

test('order 900 段按类目固定', function() {
  var es = buildAdultSystemDigest(fullCfg);
  var byC = Object.create(null);
  es.forEach(function(e) { byC[e.comment] = e.order; });
  assert.equal(byC['[成人体系]世界观'], SYSTEM_DIGEST_ORDER.worldview);
  assert.equal(byC['[成人体系]NSFW口味'], SYSTEM_DIGEST_ORDER.flavor);
  // 世界观（950）最先
  var orders = es.map(function(e) { return e.order; });
  assert.ok(orders[0] === Math.max.apply(null, orders));
});

test('内容含完整 description / writingGuide / avoid / 备注 / 覆盖要点', function() {
  var es = buildAdultSystemDigest(fullCfg);
  var flavor = es.find(function(e) { return e.comment === '[成人体系]NSFW口味'; });
  assert.ok(flavor.content.indexOf('调教向') >= 0, 'label');
  assert.ok(flavor.content.indexOf('安全词机制') >= 0, 'note');
  assert.ok(flavor.content.indexOf('主调色盘') >= 0, '主调色盘标记');
  assert.ok(flavor.content.indexOf('避免：') >= 0, 'avoid');
  var ntl = es.find(function(e) { return e.comment === '[成人体系]NTL禁忌'; });
  assert.ok(ntl.content.indexOf('权力胁迫') >= 0);
  assert.ok(ntl.content.indexOf('保留反噬') >= 0);
  var wv = es.find(function(e) { return e.comment === '[成人体系]世界观'; });
  assert.ok(wv.content.indexOf('主底盘：') >= 0 && wv.content.indexOf('叠加：') >= 0);
  var pos = es.find(function(e) { return e.comment === '[成人体系]姿势语言'; });
  assert.ok(pos.content.indexOf('覆盖要点：') >= 0, '姿势 mustCover 汇入');
  assert.ok(pos.content.indexOf('写法：') >= 0);
  assert.ok(pos.content.indexOf('避免：') >= 0);
  var vessel = es.find(function(e) { return e.comment === '[成人体系]载体框架'; });
  assert.ok(vessel.content.indexOf('载体种子（') >= 0, '载体种子');
  assert.ok(vessel.content.indexOf('禁语（') >= 0, '禁语 antiLexicon');
});

test('部分启用：仅 NSFW 无 NTL/世界观/载体', function() {
  var es = buildAdultSystemDigest({
    nsfwEnabled: true,
    flavorItems: [{ id: 'domination', note: '' }],
  });
  var comments = es.map(function(e) { return e.comment; });
  assert.ok(comments.indexOf('[成人体系]NSFW口味') >= 0);
  assert.ok(comments.indexOf('[成人体系]NTL禁忌') < 0);
  assert.ok(comments.indexOf('[成人体系]世界观') < 0);
  assert.ok(comments.indexOf('[成人体系]载体框架') < 0);
});

test('载体 generic（未识别）不生成', function() {
  var es = buildAdultSystemDigest({
    nsfwEnabled: true,
    flavorItems: [{ id: 'domination', note: '' }],
    adultWorldframe: 'generic',
  });
  assert.equal(es.some(function(e) { return e.comment === '[成人体系]载体框架'; }), false);
});

test('空/无效配置 → 空数组', function() {
  assert.deepEqual(buildAdultSystemDigest({}), []);
  assert.deepEqual(buildAdultSystemDigest({ nsfwEnabled: false }), []);
  assert.deepEqual(buildAdultSystemDigest(null), []);
});

test('hasMeaningfulSystemDigest 判断', function() {
  assert.equal(hasMeaningfulSystemDigest({ nsfwEnabled: true, flavorItems: [] }), false);
  assert.equal(hasMeaningfulSystemDigest({ nsfwEnabled: true, flavorItems: [{ id: 'x' }] }), true);
  assert.equal(hasMeaningfulSystemDigest({ worldviewPresetItems: [{ id: 'x' }] }), true);
  assert.equal(hasMeaningfulSystemDigest({ ntlEnabled: true, ntlTabooItems: [{ id: 'x' }] }), true);
  assert.equal(hasMeaningfulSystemDigest({ adultWorldframe: 'xianxia' }), true);
  // 仅恶堕 → 不产生 [成人体系] 条目（靠进度总则带出）
  assert.equal(hasMeaningfulSystemDigest({ nsfwEnabled: true, corruptionEnabled: true }), false);
  assert.equal(hasMeaningfulSystemDigest({ nsfwEnabled: true, corruptionEnabled: true, adultWorldframe: 'generic' }), false);
  assert.equal(hasMeaningfulSystemDigest(null), false);
});

test('isSystemDigestComment 前缀判定', function() {
  assert.equal(isSystemDigestComment('[成人体系]世界观'), true);
  assert.equal(isSystemDigestComment('[成人体系]'), true);
  assert.equal(isSystemDigestComment('世界观'), false);
  assert.equal(isSystemDigestComment('[小说人物] 甲'), false);
  assert.equal(isSystemDigestComment(''), false);
});

test('upsertSystemDigestEntries：新条目插入系统锚点前', function() {
  var base = [
    { comment: '普通条目', content: 'a' },
    { comment: '恶堕进度总则', content: 'b' },
    { comment: '[小说人物] 甲', content: 'c' },
  ];
  var es = buildAdultSystemDigest(fullCfg);
  var out = upsertSystemDigestEntries(base, es);
  // 锚点：恶堕进度总则之前（index 1）
  var idx = out.findIndex(function(e) { return e.comment === '恶堕进度总则'; });
  var before = out.slice(0, idx).map(function(e) { return e.comment; });
  assert.ok(before.indexOf('[成人体系]世界观') >= 0);
  // 普通条目仍在前
  assert.equal(out[0].comment, '普通条目');
  // 无锚点时插到最前
  var out2 = upsertSystemDigestEntries([{ comment: '普通', content: 'x' }], es);
  assert.equal(out2[0].comment, '[成人体系]世界观');
  assert.equal(out2[out2.length - 1].comment, '普通');
});

test('upsertSystemDigestEntries：已存在更新内容/策略，普通条目保持最前', function() {
  var base = [
    { comment: '普通', content: 'x' },
    { comment: '[成人体系]世界观', content: '旧', order: 950, strategy: 'selective' },
    { comment: '恶堕进度总则', content: 'y' },
  ];
  var es = buildAdultSystemDigest(fullCfg);
  var out = upsertSystemDigestEntries(base, es);
  var wv = out.find(function(e) { return e.comment === '[成人体系]世界观'; });
  var expect = es.find(function(e) { return e.comment === '[成人体系]世界观'; });
  assert.ok(wv, '已有条目保留');
  assert.equal(wv.content.length, expect.content.length, '内容被更新为编译产物');
  assert.equal(wv.strategy, 'constant', '策略被覆盖为 constant');
  assert.equal(out[0].comment, '普通', '普通条目保持最前');
  // 体系条目集中且靠前（都在恶堕进度总则之前）
  var gzIdx = out.findIndex(function(e) { return e.comment === '恶堕进度总则'; });
  assert.ok(out.slice(0, gzIdx).some(function(e) { return isSystemDigestComment(e.comment); }));
});

test('upsertSystemDigestEntries：受控前缀条目不受影响', function() {
  var base = [{ comment: '[mvu_update]变量更新规则', content: 'a' }, { comment: '[initvar]变量初始化勿开', content: 'b' }];
  var out = upsertSystemDigestEntries(base, buildAdultSystemDigest(fullCfg));
  assert.equal(out.length, 6 + 2);
  assert.ok(isSystemDigestComment(out[0].comment), '体系条目插到系统受控区最前');
  var rest = out.map(function(e) { return e.comment; });
  assert.ok(rest.indexOf('[mvu_update]变量更新规则') >= 0);
  assert.ok(rest.indexOf('[initvar]变量初始化勿开') >= 0);
});

test('mergeCorruptionConfigNote：把恶堕配置摘要并入进度总则（幂等）', function() {
  var rules = [{ comment: '恶堕进度总则', content: '【恶堕进度总则】\n阶段表：\n1. 傲慢' }];
  var out = mergeCorruptionConfigNote(rules, fullCfg);
  assert.ok(out[0].content.indexOf('【恶堕配置摘要】') >= 0);
  assert.ok(out[0].content.indexOf('傲慢 → 嫉妒 → 愤怒') >= 0);
  assert.ok(out[0].content.indexOf('保留清醒的自我认知') >= 0);
  assert.equal(out.length, 1, '不新建条目');
  var again = mergeCorruptionConfigNote(out, fullCfg);
  assert.equal(again[0].content, out[0].content, '幂等：重复调用不叠加');
  // 未启用恶堕 → 不产生摘要
  assert.deepEqual(mergeCorruptionConfigNote(rules, { nsfwEnabled: true }), rules);
  // 无进度总则条目 → 宁缺勿动，不新建
  assert.deepEqual(mergeCorruptionConfigNote([{ comment: '普通', content: 'x' }], fullCfg).length, 1);
});

test('stripCorruptionConfigNote：移除恶堕配置摘要（对称回退）', function() {
  var rules = [{ comment: '恶堕进度总则', content: '【恶堕进度总则】\n阶段表：\n1. 傲慢' }];
  var merged = mergeCorruptionConfigNote(rules, fullCfg);
  var stripped = stripCorruptionConfigNote(merged);
  assert.equal(stripped[0].content, rules[0].content);
  assert.ok(stripped[0].content.indexOf('【恶堕配置摘要】') < 0);
  assert.deepEqual(stripCorruptionConfigNote([{ comment: '普通', content: 'x' }]).length, 1);
});

test('mergeAffectionConfigNote：纯爱配置摘要并入亲密关系总则（幂等，不单独成条目）', function() {
  var rules = [{ comment: '亲密关系总则', content: '【亲密关系总则】\n档位映射表：\n1. 陌生' }];
  var affCfg = {
    affectionEnabled: true,
    affectionPreset: '6',
    affectionStageNames: ['陌生', '相识', '亲近', '信赖', '亲密', '灵魂伴侣'],
    affectionCustomBrief: '欢喜冤家',
    affectionExtraNotes: '告白时机前不得越界',
  };
  var out = mergeAffectionConfigNote(rules, affCfg);
  assert.ok(out[0].content.indexOf('【亲密度配置摘要】') >= 0);
  assert.ok(out[0].content.indexOf('陌生 → 相识 → 亲近') >= 0);
  assert.ok(out[0].content.indexOf('欢喜冤家') >= 0);
  assert.equal(out.length, 1, '不新建条目');
  var again = mergeAffectionConfigNote(out, affCfg);
  assert.equal(again[0].content, out[0].content, '幂等：重复调用不叠加');
  // 未启用纯爱 → 不产生摘要
  assert.deepEqual(mergeAffectionConfigNote(rules, { affectionEnabled: false }), rules);
  // 无亲密关系总则条目 → 宁缺勿动，不新建
  assert.deepEqual(mergeAffectionConfigNote([{ comment: '普通', content: 'x' }], affCfg).length, 1);
});

test('stripAffectionConfigNote：移除纯爱配置摘要（对称回退）', function() {
  var rules = [{ comment: '亲密关系总则', content: '【亲密关系总则】\n档位映射表：\n1. 陌生' }];
  var affCfg = { affectionEnabled: true, affectionPreset: '6', affectionStageNames: ['陌生', '相识'] };
  var merged = mergeAffectionConfigNote(rules, affCfg);
  var stripped = stripAffectionConfigNote(merged);
  assert.equal(stripped[0].content, rules[0].content);
  assert.ok(stripped[0].content.indexOf('【亲密度配置摘要】') < 0);
  assert.deepEqual(stripAffectionConfigNote([{ comment: '普通', content: 'x' }]).length, 1);
});
