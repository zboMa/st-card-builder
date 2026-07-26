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
import { createDefaultCardState } from '../src/lib/card-builder/state.mjs';
import { createCardStateMachine } from '../src/lib/card-builder/stateMachine.mjs';
import {
  resetDraftsStoreForTests,
  writeDraftsMapSync,
  getDraftsMapSync,
} from '../src/lib/draftsStore.mjs';

function mockStorage() {
  var map = {};
  return {
    getItem: function(k) { return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null; },
    setItem: function(k, v) { map[k] = String(v); },
    removeItem: function(k) { delete map[k]; },
  };
}

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

describe('saveDraft no parallel empty card', function() {
  var prevLs;

  beforeEach(function() {
    prevLs = globalThis.localStorage;
    globalThis.localStorage = mockStorage();
    resetCardCloudIndexForTests();
    setCardCloudIndexStatusForTests(CARD_INDEX_STATUS.ready);
    resetDraftsStoreForTests();
  });

  afterEach(function() {
    globalThis.localStorage = prevLs;
    resetCardCloudIndexForTests();
    resetDraftsStoreForTests();
  });

  it('does not genId when drafts already have cards but draftId empty', function() {
    writeDraftsMapSync({
      cloud1: { draftId: 'cloud1', charName: '云端卡', _cloudStub: true },
    });
    var state = createDefaultCardState();
    assert.equal(state.draftId, '');
    var sm = createCardStateMachine(state);
    state.charName = '误触';
    var result = sm.saveDraft();
    assert.equal(result.deferred, true);
    assert.equal(result.reason, 'no_current_draft');
    assert.equal(state.draftId, '');
    var map = getDraftsMapSync();
    assert.equal(Object.keys(map).length, 1);
    assert.ok(map.cloud1);
  });

  it('explicit createBlank then save still works with existing cards', function() {
    writeDraftsMapSync({
      cloud1: { draftId: 'cloud1', charName: '云端卡', _cloudStub: true },
    });
    var state = createDefaultCardState();
    var sm = createCardStateMachine(state);
    sm.createBlank();
    assert.ok(state.draftId);
    state.charName = '新建';
    var result = sm.saveDraft();
    assert.equal(result.saved, true);
    var map = getDraftsMapSync();
    assert.equal(Object.keys(map).length, 2);
    assert.equal(map[state.draftId].charName, '新建');
  });
});
