import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DOC,
  cardDocId,
  avatarDocId,
  novelDocId,
  storyNovelDocId,
  buildCardIndexFromDrafts,
  catalogNovelsList,
} from '../src/data/docIds.mjs';

describe('data docIds', function() {
  it('DOC 常量稳定', function() {
    assert.equal(DOC.cardIndex, 'meta/card-index');
    assert.equal(DOC.aiSecrets, 'secrets/ai-config');
  });

  it('资源 ID', function() {
    assert.equal(cardDocId('abc'), 'card/abc');
    assert.equal(avatarDocId('abc', 'thumb'), 'avatar/abc/thumb');
    assert.equal(novelDocId('abc'), 'novel/abc');
    assert.equal(storyNovelDocId('c1', 'n1'), 'story/c1/n1');
  });

  it('buildCardIndexFromDrafts', function() {
    var idx = buildCardIndexFromDrafts({
      a: { charName: 'A', updatedAt: '2026-01-02' },
      b: { charName: 'B', updatedAt: '2026-01-03', avatarInIdb: true },
    });
    assert.equal(idx._id, 'meta/card-index');
    assert.equal(idx.cards.length, 2);
    assert.equal(idx.cards[0].id, 'b');
    assert.equal(idx.cards[0].avatarInIdb, true);
  });

  it('catalogNovelsList 兼容形态', function() {
    assert.deepEqual(catalogNovelsList([{ id: '1' }]), [{ id: '1' }]);
    assert.deepEqual(catalogNovelsList({ novels: [{ id: '2' }] }), [{ id: '2' }]);
    assert.deepEqual(catalogNovelsList({ data: [{ id: '3' }] }), [{ id: '3' }]);
    assert.deepEqual(catalogNovelsList(null), []);
  });
});
