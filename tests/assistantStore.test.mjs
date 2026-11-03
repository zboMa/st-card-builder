import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assistantStageStore,
  assistantStore,
  patchAssistantView,
  resetAssistantView,
} from '../src/lib/store/assistantStore.mjs';

describe('assistantStore', function() {
  beforeEach(function() {
    resetAssistantView();
  });

  it('routes pending fields to the stage store', function() {
    patchAssistantView({ pendingHint: 'thinking', pending: { summary: 'x' }, showAutoApplyButton: false });
    assert.equal(assistantStageStore.get().pendingHint, 'thinking');
    assert.equal(assistantStageStore.get().pending.summary, 'x');
    assert.equal(assistantStageStore.get().showAutoApplyButton, false);
    assert.equal(Object.prototype.hasOwnProperty.call(assistantStore.get(), 'pendingHint'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(assistantStore.get(), 'pending'), false);
  });

  it('keeps input and status in the UI store', function() {
    patchAssistantView({ input: 'hello', status: 'busy' });
    assert.equal(assistantStore.get().input, 'hello');
    assert.equal(assistantStore.get().status, 'busy');
    assert.equal(assistantStageStore.get().pendingHint, '');
  });
});
