/**
 * 世界观预设：可扩展目录、分组、注入 hint
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WORLDVIEW_GROUPS,
  WORLDVIEW_PRESETS,
  WORLDVIEW_PRESET_IDS,
  WORLDVIEW_PRESET_MAP,
  getWorldviewPreset,
  listWorldviewPresetsByGroup,
  buildWorldviewHint,
  composeWorldviewUserPrompt,
} from '../src/lib/presets/worldviews/index.mjs';
import {
  WORLDVIEW_PRESET_IDS as REEXPORT_IDS,
  buildWorldviewHint as reexportHint,
} from '../src/lib/presets/index.mjs';

describe('worldviewPresets', function() {
  it('至少 30 项且 id 唯一', function() {
    assert.ok(WORLDVIEW_PRESETS.length >= 30, 'expected >=30, got ' + WORLDVIEW_PRESETS.length);
    assert.equal(WORLDVIEW_PRESET_IDS.length, WORLDVIEW_PRESETS.length);
    var seen = Object.create(null);
    WORLDVIEW_PRESETS.forEach(function(p) {
      assert.ok(p.id, 'preset missing id');
      assert.ok(!seen[p.id], 'duplicate id: ' + p.id);
      seen[p.id] = true;
      assert.ok(p.label, p.id + ' missing label');
      assert.ok(p.group, p.id + ' missing group');
      assert.ok(Array.isArray(p.lexicon) && p.lexicon.length >= 3, p.id + ' lexicon too short');
      assert.ok(Array.isArray(p.mustCover) && p.mustCover.length >= 3, p.id + ' mustCover too short');
      assert.ok(p.writingGuide, p.id + ' missing writingGuide');
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

  it('修仙/女尊/恶堕/魅魔等关键项存在', function() {
    ['xianxia', 'matriarchy', 'corruption_realm', 'succubus'].forEach(function(id) {
      var p = getWorldviewPreset(id);
      assert.ok(p, 'missing preset ' + id);
      assert.equal(WORLDVIEW_PRESET_MAP[id], p);
    });
    assert.ok(getWorldviewPreset('matriarchy').label.includes('女尊')
      || (getWorldviewPreset('matriarchy').description || '').includes('女尊'));
    assert.ok(getWorldviewPreset('corruption_realm').label.includes('恶堕')
      || (getWorldviewPreset('corruption_realm').description || '').includes('恶堕'));
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
  });

  it('presets/index 聚合 re-export', function() {
    assert.equal(REEXPORT_IDS.length, WORLDVIEW_PRESET_IDS.length);
    assert.ok(reexportHint('matriarchy').length > 20);
  });
});
