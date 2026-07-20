/**
 * 世界观预设：多选组合、厚度底线、分组注入
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WORLDVIEW_GROUPS,
  WORLDVIEW_PRESETS,
  WORLDVIEW_PRESET_IDS,
  WORLDVIEW_PRESET_MAP,
  MAX_WORLDVIEW_PRESET_ITEMS,
  WORLDVIEW_QUALITY_FLOOR,
  getWorldviewPreset,
  listWorldviewPresetsByGroup,
  buildWorldviewHint,
  buildWorldviewHintFromItems,
  normalizeWorldviewPresetItems,
  primaryWorldviewPresetId,
  composeWorldviewUserPrompt,
  checkWorldviewPresetQuality,
} from '../src/lib/presets/worldviews/index.mjs';
import {
  WORLDVIEW_PRESET_IDS as REEXPORT_IDS,
  buildWorldviewHint as reexportHint,
  buildWorldviewHintFromItems as reexportFromItems,
  MAX_WORLDVIEW_PRESET_ITEMS as REEXPORT_MAX,
} from '../src/lib/presets/index.mjs';
import { WORLDFRAME_IDS } from '../src/lib/adult/vessels/index.mjs';

describe('worldviewPresets', function() {
  it('至少 70 项且 id 唯一，达到厚度底线', function() {
    assert.ok(WORLDVIEW_PRESETS.length >= 70, 'expected >=70, got ' + WORLDVIEW_PRESETS.length);
    assert.equal(WORLDVIEW_PRESET_IDS.length, WORLDVIEW_PRESETS.length);
    var seen = Object.create(null);
    WORLDVIEW_PRESETS.forEach(function(p) {
      assert.ok(p.id, 'preset missing id');
      assert.ok(!seen[p.id], 'duplicate id: ' + p.id);
      seen[p.id] = true;
      assert.ok(p.label, p.id + ' missing label');
      assert.ok(p.group, p.id + ' missing group');
      var issues = checkWorldviewPresetQuality(p);
      assert.deepEqual(issues, [], p.id + ' quality: ' + issues.join(','));
      assert.ok(WORLDFRAME_IDS.indexOf(p.mapsToWorldframe) >= 0, p.id + ' bad frame ' + p.mapsToWorldframe);
    });
  });

  it('分组完整且 UI 列表非空', function() {
    assert.ok(WORLDVIEW_GROUPS.length >= 4);
    var groups = listWorldviewPresetsByGroup();
    assert.ok(groups.length >= 4);
    var total = groups.reduce(function(n, g) { return n + g.items.length; }, 0);
    assert.equal(total, WORLDVIEW_PRESETS.length);
    groups.forEach(function(g) {
      assert.ok(g.label);
      assert.ok(g.items.length > 0, 'empty group ' + g.id);
    });
  });

  it('关键项与扩展组合项存在', function() {
    ['xianxia', 'matriarchy', 'corruption_realm', 'succubus',
      'zhiguai_shanhai', 'modern_xianxia_hidden', 'folk_haunt', 'yaomeng_spirits',
      'blood_moon_era', 'card_world', 'tentacle_abyss_civ',
    ].forEach(function(id) {
      var p = getWorldviewPreset(id);
      assert.ok(p, 'missing preset ' + id);
      assert.equal(WORLDVIEW_PRESET_MAP[id], p);
    });
  });

  it('多选规范化：有序去重、上限、旧 id 兼容', function() {
    assert.equal(MAX_WORLDVIEW_PRESET_ITEMS, 3);
    var items = normalizeWorldviewPresetItems([
      { id: 'succubus', note: '隐秘' },
      { id: 'xianxia', note: '' },
      { id: 'succubus', note: '重复应丢' },
      { id: 'modern_urban', note: '' },
      { id: 'wuxia', note: '超限' },
    ]);
    assert.equal(items.length, 3);
    assert.equal(items[0].id, 'succubus');
    assert.equal(items[0].note, '隐秘');
    assert.equal(primaryWorldviewPresetId(items), 'succubus');
    var fromLegacy = normalizeWorldviewPresetItems([], 'matriarchy');
    assert.equal(fromLegacy[0].id, 'matriarchy');
    assert.deepEqual(normalizeWorldviewPresetItems([{ id: 'nope' }]), []);
  });

  it('buildWorldviewHintFromItems 组合含主次与两边厚度', function() {
    var combo = buildWorldviewHintFromItems([
      { id: 'xianxia', note: '底盘' },
      { id: 'succubus', note: '隐世血脉' },
    ], { stage: 'worldbook' });
    assert.ok(combo.includes('世界观预设组合'));
    assert.ok(combo.includes('主世界观'));
    assert.ok(combo.includes('修仙'));
    assert.ok(combo.includes('魅魔'));
    assert.ok(combo.includes('底盘'));
    assert.ok(combo.includes('隐世血脉'));
    assert.ok(combo.includes('组合法则') || combo.includes('飞地'));
    assert.ok(combo.includes('世界书骨架'));
    // 单条仍完整
    var single = buildWorldviewHint('xianxia', { stage: 'char' });
    assert.ok(single.includes('必写维度'));
    assert.ok(single.includes('【角色】'));
    assert.ok(single.length > 200);
  });

  it('buildWorldviewHint 分阶段注入非空', function() {
    var all = buildWorldviewHint('xianxia', { stage: 'all' });
    var char = buildWorldviewHint('xianxia', { stage: 'char' });
    var wb = buildWorldviewHint('xianxia', { stage: 'worldbook' });
    var greet = buildWorldviewHint('xianxia', { stage: 'greeting' });
    assert.ok(all.includes('修仙'));
    assert.ok(all.includes('必写维度'));
    assert.ok(char.includes('【角色】'));
    assert.ok(wb.includes('世界书骨架'));
    assert.ok(greet.includes('【开场白】'));
    assert.equal(buildWorldviewHint(''), '');
    assert.equal(buildWorldviewHint('no-such-preset'), '');
  });

  it('用户额外要求可叠加且优先声明', function() {
    var hint = buildWorldviewHint('xianxia', {
      stage: 'char',
      userExtra: '她是散修，仇家是合欢宗',
    });
    assert.ok(hint.includes('用户额外要求'));
    assert.ok(hint.includes('散修'));
    var composed = composeWorldviewUserPrompt('xianxia', '冷淡护短', 'char');
    assert.ok(composed.includes('冷淡护短'));
    assert.ok(composed.includes('修仙'));
    var onlyPreset = composeWorldviewUserPrompt('xianxia', '', 'char');
    assert.ok(onlyPreset.includes('请按下列世界观预设生成'));
    var composedItems = composeWorldviewUserPrompt(
      [{ id: 'modern_urban' }, { id: 'xianxia' }],
      '都市修真',
      'char'
    );
    assert.ok(composedItems.includes('都市修真'));
    assert.ok(composedItems.includes('现代') || composedItems.includes('修仙'));
  });

  it('质量底线常量合理且 re-export 可用', function() {
    assert.ok(WORLDVIEW_QUALITY_FLOOR.description >= 140);
    assert.ok(WORLDVIEW_QUALITY_FLOOR.writingGuide >= 200);
    assert.equal(REEXPORT_IDS.length, WORLDVIEW_PRESET_IDS.length);
    assert.equal(REEXPORT_MAX, 3);
    assert.ok(reexportHint('matriarchy').length > 200);
    assert.ok(reexportFromItems([{ id: 'succubus' }, { id: 'xianxia' }]).includes('组合'));
  });
});
