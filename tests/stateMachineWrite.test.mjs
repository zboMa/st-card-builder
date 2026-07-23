import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultCardState } from '../src/lib/card-builder/state.mjs';
import { createCardStateMachine } from '../src/lib/card-builder/stateMachine.mjs';

function mockStorage() {
  var map = {};
  return {
    getItem: function(k) { return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null; },
    setItem: function(k, v) { map[k] = String(v); },
    removeItem: function(k) { delete map[k]; },
  };
}

describe('stateMachine writeDraftsMap', function() {
  it('writeDraftsMap 与 patchDraftRecord', function() {
    var prev = globalThis.localStorage;
    globalThis.localStorage = mockStorage();
    try {
      var state = createDefaultCardState();
      state.draftId = 'd1';
      state.charName = 'A';
      var sm = createCardStateMachine(state);
      sm.saveDraft();
      var patched = sm.patchDraftRecord('d1', { charName: 'B' }, { notify: false });
      assert.equal(patched.ok, true);
      assert.equal(sm.getAllDrafts().d1.charName, 'B');
      assert.equal(state.charName, 'B');
      var all = sm.getAllDrafts();
      all.d2 = { charName: 'C', updatedAt: '1' };
      var w = sm.writeDraftsMap(all, { notify: false });
      assert.equal(w.ok, true);
      assert.equal(sm.getAllDrafts().d2.charName, 'C');
    } finally {
      globalThis.localStorage = prev;
    }
  });
});
