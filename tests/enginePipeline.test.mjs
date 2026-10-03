import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ENGINE_GEN_MODE_FULL,
  ENGINE_GEN_MODE_SKELETON,
  normalizeEngineGenMode,
  clampSlotCount,
  normalizeOutlineSlot,
  normalizeOutlineSlots,
  slotToWorldbookEntry,
  formatOutlineRef,
  formatEnrichedEntriesRef,
  isSkeletonEntry,
  snapshotCardDraft,
  restoreCardDraft,
  worldbookReplaceNeedsConfirm,
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

  it('两人加一条禁令不会被补上物品或能力', function() {
    var slots = normalizeOutlineSlots([
      { comment: '甲', job: '在场的人', strategy: 'selective', keys: ['甲'] },
      { comment: '乙', job: '在场的人', strategy: 'selective', keys: ['乙'] },
      { comment: '不许替用户行动', job: '禁令', strategy: 'constant', keys: [] },
    ], 10);
    assert.equal(slots.length, 3);
    assert.ok(slots.every(function(s) { return s.type !== 'item' && s.type !== 'ability'; }));
    assert.equal(slots[2].strategy, 'constant');
    assert.equal(slots[2].keys.length, 0);
    var ban = slotToWorldbookEntry(slots[2], 100);
    assert.equal(ban.job, '禁令');
    assert.equal(ban.position, 0);
    assert.equal(ban.content, '（待展开）');
    assert.doesNotMatch(DEFAULT_PROMPTS.wbOutline, /人物×|世界观×|配额/);
    assert.doesNotMatch(DEFAULT_PROMPTS.greetingGen, /固定 2|altGreetings 固定/);
  });

  it('已有世界书要先确认，失败能写回快照', function() {
    assert.equal(worldbookReplaceNeedsConfirm([]), false);
    assert.equal(worldbookReplaceNeedsConfirm([{ content: '旧规则' }]), true);
    var state = {
      charName: '旧名',
      worldbookEntries: [{ content: '旧规则' }],
      regexScripts: [{ id: 'r1' }],
      tavernHelperScripts: [{ name: 's1' }],
    };
    var snap = snapshotCardDraft(state);
    state.charName = '新名';
    state.worldbookEntries = [];
    state.regexScripts = [];
    restoreCardDraft(state, snap);
    assert.equal(state.charName, '旧名');
    assert.equal(state.worldbookEntries[0].content, '旧规则');
    assert.equal(state.regexScripts[0].id, 'r1');
    assert.equal(state.tavernHelperScripts[0].name, 's1');
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
