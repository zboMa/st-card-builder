import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultCardState } from '../src/lib/card-builder/state.mjs';
import { createCardStateMachine } from '../src/lib/card-builder/stateMachine.mjs';
import { createCardBuilderContext } from '../src/lib/card-builder/shared/context.mjs';

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
});
