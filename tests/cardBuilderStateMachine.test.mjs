import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultCardState } from '../src/lib/card-builder/state.mjs';
import { createCardStateMachine } from '../src/lib/card-builder/stateMachine.mjs';
import { createCardBuilderContext } from '../src/lib/card-builder/shared/context.mjs';
import { getDraftsMapSync, resetDraftsStoreForTests } from '../src/lib/draftsStore.mjs';

describe('card-builder stateMachine exposes state', function() {
  it('sm.state 与 createDefaultCardState 为同一引用', function() {
    var state = createDefaultCardState();
    state.charName = 'Ada';
    var sm = createCardStateMachine(state);
    assert.ok(sm.state, 'sm.state must exist');
    assert.equal(sm.state, state);
    assert.equal(sm.state.charName, 'Ada');
    assert.ok(Array.isArray(sm.state.charTags));
  });

  it('createCardBuilderContext 能读到 charTags / nsfwEnabled', function() {
    var state = createDefaultCardState();
    var sm = createCardStateMachine(state);
    var ctx = createCardBuilderContext(sm);
    assert.equal(ctx.state, state);
    assert.ok(Array.isArray(ctx.state.charTags));
    assert.equal(typeof ctx.state.nsfwEnabled, 'boolean');
    assert.ok(Array.isArray(ctx.state.eroticPostureItems));
    assert.ok(Array.isArray(ctx.state.eroticSpeechItems));
  });

  it('内容未变时 saveDraft 不刷新 updatedAt', function() {
    var prevStorage = globalThis.localStorage;
    var map = {};
    globalThis.localStorage = {
      getItem: function(k) { return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null; },
      setItem: function(k, v) { map[k] = String(v); },
      removeItem: function(k) { delete map[k]; },
    };
    resetDraftsStoreForTests();
    try {
      var state = createDefaultCardState();
      state.draftId = 'draft_test';
      state.charName = '测试';
      var sm = createCardStateMachine(state);
      var first = sm.saveDraft();
      assert.ok(first.saved);
      var stamped = state.updatedAt;
      assert.ok(stamped);
      var again = sm.saveDraft();
      assert.equal(again.unchanged, true);
      assert.equal(state.updatedAt, stamped);
      state.charName = '测试改';
      var changed = sm.saveDraft();
      assert.notEqual(changed.unchanged, true);
      assert.ok(changed.saved);
      var stored = getDraftsMapSync();
      assert.equal(stored.draft_test.charName, '测试改');
      assert.equal(JSON.parse(map['st_v3_builder_drafts']).draft_test.charName, '测试改');
    } finally {
      resetDraftsStoreForTests();
      globalThis.localStorage = prevStorage;
    }
  });
});
