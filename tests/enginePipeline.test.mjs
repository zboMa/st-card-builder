import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ENGINE_GEN_MODE_FULL,
  ENGINE_GEN_MODE_SKELETON,
  normalizeEngineGenMode,
  clampSlotCount,
  buildScaledQuota,
  formatQuotaForPrompt,
  normalizeOutlineSlot,
  normalizeOutlineSlots,
  slotToWorldbookEntry,
  formatOutlineRef,
  formatEnrichedEntriesRef,
  isSkeletonEntry,
  DEFAULT_OUTLINE_QUOTA,
} from '../src/lib/card-builder/enginePipeline.mjs';
import { DEFAULT_PROMPTS } from '../src/lib/promptCanon.mjs';
import { PROMPT_META } from '../src/lib/promptStore.mjs';

describe('enginePipeline', function() {
  it('默认生成模式为完整生成', function() {
    assert.equal(normalizeEngineGenMode(''), ENGINE_GEN_MODE_FULL);
    assert.equal(normalizeEngineGenMode('full'), ENGINE_GEN_MODE_FULL);
    assert.equal(normalizeEngineGenMode('skeleton'), ENGINE_GEN_MODE_SKELETON);
    assert.equal(normalizeEngineGenMode('weird'), ENGINE_GEN_MODE_FULL);
  });

  it('clampSlotCount 限制在 1～30', function() {
    assert.equal(clampSlotCount(0), 6);
    assert.equal(clampSlotCount(10), 10);
    assert.equal(clampSlotCount(99), 30);
  });

  it('buildScaledQuota 总和等于目标条数且覆盖主类型', function() {
    var q10 = buildScaledQuota(10);
    var sum10 = Object.keys(q10).reduce(function(s, k) { return s + q10[k]; }, 0);
    assert.equal(sum10, 10);
    assert.ok(q10.person >= 1);
    assert.ok(q10.worldview >= 1);
    assert.ok(q10.location >= 1);

    var q13 = buildScaledQuota(13);
    var sum13 = Object.keys(q13).reduce(function(s, k) { return s + q13[k]; }, 0);
    assert.equal(sum13, 13);

    var baseSum = Object.keys(DEFAULT_OUTLINE_QUOTA).reduce(function(s, k) {
      return s + DEFAULT_OUTLINE_QUOTA[k];
    }, 0);
    assert.equal(baseSum, 13);
  });

  it('formatQuotaForPrompt 可读', function() {
    var text = formatQuotaForPrompt(buildScaledQuota(10));
    assert.ok(text.indexOf('人物') >= 0);
    assert.ok(text.indexOf('×') >= 0);
  });

  it('normalizeOutlineSlots 去重并截断', function() {
    var slots = normalizeOutlineSlots({
      slots: [
        { type: 'person', comment: '[小说人物] 阿岚', blurb: '女主盟友', keys: ['阿岚'], links: ['青城'] },
        { type: '地点', comment: '青城', blurb: '主城', keys: ['青城'] },
        { type: 'person', comment: '[小说人物] 阿岚', blurb: '重复应丢' },
        { type: '未知', comment: '杂项', blurb: 'x' },
      ],
    }, 3);
    assert.equal(slots.length, 3);
    assert.equal(slots[0].type, 'person');
    assert.equal(slots[1].type, 'location');
    assert.equal(slots[2].type, 'other');
    assert.ok(slots[0].links.indexOf('青城') >= 0);
  });

  it('slotToWorldbookEntry 写入 outline 元数据', function() {
    var slot = normalizeOutlineSlot({
      type: 'item',
      comment: '锁链戒',
      blurb: '情欲契约信物',
      keys: ['锁链戒'],
      links: ['阿岚'],
    }, 0);
    var entry = slotToWorldbookEntry(slot, 100);
    assert.equal(entry.outlineType, 'item');
    assert.deepEqual(entry.outlineLinks, ['阿岚']);
    assert.ok(isSkeletonEntry(entry));
  });

  it('formatOutlineRef / formatEnrichedEntriesRef', function() {
    var slots = normalizeOutlineSlots([
      { type: 'faction', comment: '黑市行会', blurb: '地下交易网', links: ['锁链戒'] },
    ], 1);
    var ref = formatOutlineRef(slots);
    assert.ok(ref.indexOf('黑市行会') >= 0);
    assert.ok(ref.indexOf('势力') >= 0);

    var rich = formatEnrichedEntriesRef([
      {
        comment: '黑市行会',
        content: '这是一段足够长的设定文字用于通过骨架判定，需要超过六十个非空白字符才能进入已丰满摘要列表，因此继续补充描述直到长度足够为止ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      },
      { comment: '短条目', content: '待展开' },
    ]);
    assert.ok(rich.indexOf('黑市行会') >= 0);
    assert.ok(rich.indexOf('短条目') < 0);
  });

  it('promptCanon / PROMPT_META 含大纲·丰满·交叉', function() {
    ['wbOutline', 'wbEnrichFromOutline', 'wbCrossLink'].forEach(function(id) {
      assert.ok(DEFAULT_PROMPTS[id], 'missing DEFAULT_PROMPTS.' + id);
      assert.ok(PROMPT_META.some(function(m) { return m.id === id; }), 'missing PROMPT_META ' + id);
    });
  });
});
