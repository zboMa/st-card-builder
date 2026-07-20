import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DOC,
  SYNC_INTERVAL_MS,
  cardDocId,
  novelDocId,
  storyNovelDocId,
  shouldReplicateDocId,
  buildCardIndexFromDrafts,
} from '../src/lib/sync/docIds.mjs';

describe('sync docIds', function() {
  it('间隔为 5 分钟', function() {
    assert.equal(SYNC_INTERVAL_MS, 5 * 60 * 1000);
  });

  it('文档 id 约定', function() {
    assert.equal(DOC.cardIndex, 'meta/card-index');
    assert.equal(DOC.aiSecrets, 'secrets/ai-config');
    assert.equal(cardDocId('draft_1'), 'card/draft_1');
    assert.equal(novelDocId('draft_1'), 'novel/draft_1');
    assert.equal(storyNovelDocId('c1', 'n1'), 'story/c1/n1');
  });

  it('secrets 默认不同步', function() {
    assert.equal(shouldReplicateDocId('card/x', false), true);
    assert.equal(shouldReplicateDocId('secrets/ai-config', false), false);
    assert.equal(shouldReplicateDocId('secrets/ai-config', true), true);
  });

  it('buildCardIndexFromDrafts', function() {
    var idx = buildCardIndexFromDrafts({
      a: { charName: '甲', updatedAt: '2026-01-02' },
      b: { charName: '乙', updatedAt: '2026-01-03' },
    });
    assert.equal(idx._id, DOC.cardIndex);
    assert.equal(idx.cards.length, 2);
    assert.equal(idx.cards[0].id, 'b');
  });
});
