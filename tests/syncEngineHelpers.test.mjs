import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatSyncCountdown,
  friendlySyncError,
} from '../src/lib/sync/syncEngine.mjs';

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
});
