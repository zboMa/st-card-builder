/**
 * 核心模块单测：卡进度、试聊选段、Promotion L0
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  createPromotionLogEntry,
  normalizePromotionLogList,
  PROMOTION_LOG_CAP,
} from '../src/lib/promotionLog.mjs';
import {
  formatChatTranscriptVerbatim,
  pickMessagesByIds,
  transcriptDigestFromMessages,
} from '../src/lib/chatRuntime/transcriptFormat.mjs';
import {
  validateChatFeedbackFix,
  validateChatFeedbackFixes,
} from '../src/lib/assistant/chatFeedbackValidate.mjs';
import { computeCardProgress } from '../src/lib/card-builder/cardProgress.mjs';
import { worldbookToRelationGraph } from '../src/lib/card-builder/cardRelationGraph.mjs';

describe('promotionLog', function() {
  it('normalizePromotionLogList 过滤无效项', function() {
    assert.equal(normalizePromotionLogList([null, { id: 'a' }, {}]).length, 1);
  });

  it('createPromotionLogEntry 带 cardId/kind', function() {
    var row = createPromotionLogEntry({ cardId: 'c1', kind: 'story_from_chat', summary: 'x' });
    assert.equal(row.cardId, 'c1');
    assert.equal(row.kind, 'story_from_chat');
    assert.ok(row.id);
    assert.ok(typeof row.at === 'number');
  });

  it('PROMOTION_LOG_CAP 为 200', function() {
    assert.equal(PROMOTION_LOG_CAP, 200);
  });
});

describe('transcriptFormat', function() {
  it('verbatim 含 Episode 头与角色标签', function() {
    var text = formatChatTranscriptVerbatim([
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '嗯' },
    ], { userName: '玩家', sceneName: '酒馆', episodeId: 'ep1', date: '2026-08-12' });
    assert.match(text, /Episode: ep1/);
    assert.match(text, /【玩家】/);
    assert.match(text, /【酒馆】/);
  });

  it('pickMessagesByIds 保序并统计 skipped', function() {
    var all = [{ id: 'a', role: 'user', content: '1' }, { id: 'b', role: 'assistant', content: '2' }];
    var r = pickMessagesByIds(all, ['b', 'missing', 'a']);
    assert.deepEqual(r.messages.map(function(m) { return m.id; }), ['b', 'a']);
    assert.equal(r.skipped, 1);
  });

  it('transcriptDigestFromMessages 截断', function() {
    var long = transcriptDigestFromMessages([{ role: 'user', content: 'x'.repeat(300) }], 50);
    assert.ok(long.length <= 50);
  });
});

describe('chatFeedbackValidate', function() {
  it('拒绝 MVU 写入与 transcript 灌 worldbook', function() {
    assert.equal(validateChatFeedbackFix({ tool: 'upsert_mvu_variables', args: {} }).ok, false);
    assert.equal(validateChatFeedbackFix({
      tool: 'create_worldbook_entry',
      args: { entry: { content: '本局对话摘要' } },
    }).ok, false);
  });

  it('允许带 target 的 worldbook fix', function() {
    assert.equal(validateChatFeedbackFix({
      tool: 'update_worldbook_entry',
      args: { index: 0, patch: { content: '改' } },
    }).ok, true);
  });

  it('validateChatFeedbackFixes 遇错即停', function() {
    var r = validateChatFeedbackFixes([
      { tool: 'update_character_fields', args: { fields: {} } },
      { tool: 'get_character_fields', args: {} },
    ]);
    assert.equal(r.length, 2);
    assert.equal(r[0].ok, true);
    assert.equal(r[1].ok, false);
  });
});

describe('cardProgress', function() {
  it('无契约且无人物 → prepare', function() {
    var p = computeCardProgress({ charName: '', charDesc: '', worldbookEntries: [] }, {});
    assert.equal(p.phase, 'prepare');
    assert.ok(p.blockers.length > 0);
  });

  it('有契约与人物但未试聊 → playtest 建议', function() {
    var p = computeCardProgress({
      charName: '测试场景',
      charDesc: '一段足够长的场景契约描述'.repeat(5),
      worldbookEntries: [{ comment: '[小说人物] 甲', content: '人物', keys: ['甲'] }],
    }, {});
    assert.equal(p.phase, 'playtest');
    assert.ok(p.suggestions.some(function(s) { return s.id === 'playtest'; }));
  });
});

describe('cardRelationGraph', function() {
  it('worldbook 人物 → 节点与共触发边', function() {
    var kg = worldbookToRelationGraph([
      { id: '1', comment: '[小说人物] 甲', content: '甲', keys: ['甲', '队'] },
      { id: '2', comment: '[小说人物] 乙', content: '乙', keys: ['乙', '队'] },
    ]);
    assert.equal(kg.nodes.length, 2);
    assert.ok(kg.edges.length >= 1);
    assert.equal(kg.edges[0].rel, '共触发');
  });

  it('sceneName 为 hub 连所有人物（卡司边）', function() {
    var kg = worldbookToRelationGraph([
      { id: '1', comment: '[小说人物] 甲', content: '甲', keys: ['甲'] },
      { id: '2', comment: '[小说人物] 乙', content: '乙', keys: ['乙'] },
    ], { sceneName: '灵溪宗' });
    assert.equal(kg.nodes.length, 3);
    assert.ok(kg.edges.some(function(e) { return e.rel === '卡司'; }));
    assert.equal(kg.edges.filter(function(e) { return e.rel === '卡司'; }).length, 2);
  });
});
