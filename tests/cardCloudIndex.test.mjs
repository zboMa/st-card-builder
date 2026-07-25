import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  CARD_INDEX_STATUS,
  getCardCloudIndexState,
  shouldBlockImplicitCardCreate,
  resetCardCloudIndexForTests,
  setCardCloudIndexStatusForTests,
  markCardCloudIndexReady,
} from '../src/lib/sync/cardCloudIndex.mjs';

describe('cardCloudIndex gate', function() {
  beforeEach(function() {
    resetCardCloudIndexForTests();
  });

  afterEach(function() {
    resetCardCloudIndexForTests();
  });

  it('pending + empty drafts blocks implicit create', function() {
    setCardCloudIndexStatusForTests(CARD_INDEX_STATUS.pending);
    assert.equal(shouldBlockImplicitCardCreate({}), true);
    assert.equal(shouldBlockImplicitCardCreate({ a: { charName: 'x' } }), false);
  });

  it('ready / error / disabled / idle do not block', function() {
    setCardCloudIndexStatusForTests(CARD_INDEX_STATUS.ready);
    assert.equal(shouldBlockImplicitCardCreate({}), false);
    setCardCloudIndexStatusForTests(CARD_INDEX_STATUS.error);
    assert.equal(shouldBlockImplicitCardCreate({}), false);
    setCardCloudIndexStatusForTests(CARD_INDEX_STATUS.disabled);
    assert.equal(shouldBlockImplicitCardCreate({}), false);
    setCardCloudIndexStatusForTests(CARD_INDEX_STATUS.idle);
    assert.equal(shouldBlockImplicitCardCreate({}), false);
  });

  it('markCardCloudIndexReady updates state', function() {
    setCardCloudIndexStatusForTests(CARD_INDEX_STATUS.pending);
    markCardCloudIndexReady();
    assert.equal(getCardCloudIndexState().status, CARD_INDEX_STATUS.ready);
  });
});
