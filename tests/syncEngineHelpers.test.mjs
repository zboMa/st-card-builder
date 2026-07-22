import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatSyncCountdown,
  friendlySyncError,
  computeShouldSkipSyncWhenClean,
} from '../src/lib/sync/syncEngine.mjs';
import {
  markLocalDirty,
  clearLocalDirty,
  isLocalDirty,
  resetLocalDirtyForTests,
} from '../src/lib/sync/localDirty.mjs';

describe('syncEngine helpers', function() {
  it('formatSyncCountdown', function() {
    assert.equal(formatSyncCountdown(0), '0:00');
    assert.equal(formatSyncCountdown(1000), '0:01');
    assert.equal(formatSyncCountdown(5 * 60 * 1000), '5:00');
    assert.equal(formatSyncCountdown(4 * 60 * 1000 + 32000), '4:32');
    assert.equal(formatSyncCountdown(null), '');
  });

  it('friendlySyncError maps pouch/events failure', function() {
    var msg = friendlySyncError(new Error('Class extends value #<Object> is not a constructor or null'));
    assert.match(msg, /本地同步组件/);
    assert.match(friendlySyncError(new Error('unauthorized')), /登录已失效/);
  });

  it('computeShouldSkipSyncWhenClean：本地干净且已同步过才跳过', function() {
    assert.equal(computeShouldSkipSyncWhenClean({ skipIfClean: true }, { lastSyncAt: '2026-01-01', localDirty: false }), true);
    assert.equal(computeShouldSkipSyncWhenClean({ skipIfClean: true }, { lastSyncAt: '2026-01-01', localDirty: true }), false);
    assert.equal(computeShouldSkipSyncWhenClean({ skipIfClean: true }, { lastSyncAt: null, localDirty: false }), false);
    assert.equal(computeShouldSkipSyncWhenClean({ force: true, skipIfClean: true }, { lastSyncAt: '2026-01-01', localDirty: false }), false);
    assert.equal(computeShouldSkipSyncWhenClean({}, { lastSyncAt: '2026-01-01', localDirty: false }), false);
  });
});

describe('localDirty', function() {
  it('mark / clear', function() {
    resetLocalDirtyForTests(false);
    assert.equal(isLocalDirty(), false);
    markLocalDirty();
    assert.equal(isLocalDirty(), true);
    clearLocalDirty();
    assert.equal(isLocalDirty(), false);
  });
});
