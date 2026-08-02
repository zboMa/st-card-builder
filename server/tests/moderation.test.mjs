import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isRemoved } from '../src/admin/content.mjs';

describe('moderation: 下架判定', function() {
  it('isRemoved', function() {
    assert.equal(isRemoved(null), false);
    assert.equal(isRemoved({}), false);
    assert.equal(isRemoved({ moderation: { status: 'pending' } }), false);
    assert.equal(isRemoved({ moderation: { status: 'removed' } }), true);
  });
});
