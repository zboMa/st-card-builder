/**
 * NSFW 口味多选：反差向、规范化、迁移、提示词拼装
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  NSFW_FLAVOR_PRESETS,
  NSFWFLAVOR_IDS,
  MAX_NSFW_FLAVOR_ITEMS,
  normalizeNsfwFlavorItems,
  getNsfwFlavor,
  getNsfwFlavorItems,
  setNsfwFlavor,
  setNsfwFlavorItems,
  buildNsfwFlavorHintFromItems,
  buildNsfwFlavorHint,
  buildPaletteGuidanceBlock,
  setAdultMode,
} from '../src/lib/novel/nsfwSupport.mjs';
import { createDefaultNovelState, hydrateNovelState } from '../src/lib/novel/state.mjs';
import { createDefaultCardState, buildDraftSnapshot } from '../src/lib/card-builder/state.mjs';

describe('nsfw flavor items', function() {
  it('含反差向预设，且最多 5 项', function() {
    assert.ok(NSFW_FLAVOR_PRESETS.contrast);
    assert.equal(NSFW_FLAVOR_PRESETS.contrast.label, '反差向');
    assert.equal(NSFW_FLAVOR_PRESETS.contrast.group, '特殊风味');
    assert.ok(NSFWFLAVOR_IDS.indexOf('contrast') >= 0);
    assert.equal(MAX_NSFW_FLAVOR_ITEMS, 5);
    assert.ok(NSFWFLAVOR_IDS.length >= 60, 'got ' + NSFWFLAVOR_IDS.length);
  });

  it('normalize：去重、截断、旧字段迁移', function() {
    var migrated = normalizeNsfwFlavorItems([], 'vanilla');
    assert.deepEqual(migrated, [{ id: 'vanilla', note: '' }]);

    var multi = normalizeNsfwFlavorItems([
      { id: 'vanilla', note: '温柔' },
      { id: 'contrast', note: '清冷崩坏' },
      { id: 'vanilla', note: '重复忽略' },
      { id: 'nope', note: 'x' },
      { id: 'dark' },
      { id: 'angst' },
      { id: 'intense' },
      { id: 'sweet' },
    ], '');
    assert.equal(multi.length, 5);
    assert.equal(multi[0].id, 'vanilla');
    assert.equal(multi[0].note, '温柔');
    assert.equal(multi[1].id, 'contrast');
    assert.ok(multi.every(function(it) { return it.id !== 'nope' && it.id !== 'sweet'; }));
  });

  it('state 读写同步主字段 nsfwFlavor', function() {
    var s = createDefaultNovelState();
    setAdultMode(s, true);
    setNsfwFlavorItems(s, [
      { id: 'contrast', note: '外表冷淡' },
      { id: 'domination', note: '' },
    ]);
    assert.equal(getNsfwFlavor(s), 'contrast');
    assert.equal(getNsfwFlavorItems(s).length, 2);
    assert.equal(s.nsfwFlavor, 'contrast');

    setNsfwFlavor(s, 'dark');
    assert.equal(getNsfwFlavor(s), 'dark');
    assert.equal(getNsfwFlavorItems(s)[0].id, 'dark');
  });

  it('hydrate 旧桶仅 nsfwFlavor 时迁入 items', function() {
    var h = hydrateNovelState({ nsfwFlavor: 'angst', adultMode: true });
    assert.equal(h.nsfwFlavor, 'angst');
    assert.equal(h.nsfwFlavorItems.length, 1);
    assert.equal(h.nsfwFlavorItems[0].id, 'angst');
  });

  it('提示词合并多口味与 note', function() {
    var hint = buildNsfwFlavorHintFromItems([
      { id: 'contrast', note: '制服下失控' },
      { id: 'vanilla', note: '' },
    ]);
    assert.match(hint, /口味组合/);
    assert.match(hint, /反差向/);
    assert.match(hint, /制服下失控/);
    assert.match(hint, /纯爱向/);
    assert.match(hint, /主调色盘/);
    assert.match(hint, /重点标签|必写维度/);
    assert.match(hint, /丰满硬约束/);

    var s = createDefaultNovelState();
    setAdultMode(s, true);
    setNsfwFlavorItems(s, [{ id: 'contrast', note: 'x' }]);
    var single = buildNsfwFlavorHint(s);
    assert.match(single, /反差向/);
    assert.match(single, /用户补充：x/);
    assert.match(single, /必写维度/);
  });

  it('主角调色盘可关闭成人层', function() {
    var s = createDefaultNovelState();
    setAdultMode(s, true);
    setNsfwFlavorItems(s, [{ id: 'contrast', note: '' }]);
    var protag = buildPaletteGuidanceBlock(s, { includeAdult: false });
    assert.doesNotMatch(protag, /欲望调色盘|反差向/);
    var wb = buildPaletteGuidanceBlock(s);
    assert.match(wb, /欲望调色盘/);
    assert.match(wb, /反差向/);
  });

  it('卡草稿快照保留 flavorItems', function() {
    var st = createDefaultCardState();
    st.nsfwEnabled = true;
    st.nsfwFlavorItems = [
      { id: 'contrast', note: 'a' },
      { id: 'dark', note: 'b' },
    ];
    st.eroticPostureItems = [
      { id: 'cowgirl', note: 'posture note' },
    ];
    st.eroticSpeechItems = [
      { id: 'dirty_talk', note: 'speech note' },
    ];
    st.nsfwFlavor = 'contrast';
    var snap = buildDraftSnapshot(st);
    assert.equal(snap.nsfwFlavor, 'contrast');
    assert.equal(snap.nsfwFlavorItems.length, 2);
    assert.equal(snap.nsfwFlavorItems[1].note, 'b');
    assert.equal(snap.eroticPostureItems.length, 1);
    assert.equal(snap.eroticPostureItems[0].note, 'posture note');
    assert.equal(snap.eroticSpeechItems.length, 1);
    assert.equal(snap.eroticSpeechItems[0].note, 'speech note');
  });
});
