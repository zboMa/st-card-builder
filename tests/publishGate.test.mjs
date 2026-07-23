import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPublishGate, isCardCloudDirty } from '../src/lib/card-builder/publishGate.mjs';
import { CLOUD_STATUS, markCardSynced, resolveCardCloudStatus } from '../src/lib/sync/cardCloudMeta.mjs';

function mockStorage() {
  var map = {};
  return {
    getItem: function(k) { return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null; },
    setItem: function(k, v) { map[k] = String(v); },
    removeItem: function(k) { delete map[k]; },
  };
}

describe('publishGate', function() {
  it('cloud dirty 产生 warning', function() {
    var gate = buildPublishGate({
      charName: 'A',
      charDesc: '足够长的描述文本用于通过检查门槛至少四十个字符以上',
      firstMes: 'hi',
      hasAvatar: true,
      worldbookCount: 1,
      cloudDirty: true,
    }, 'publish');
    assert.ok(gate.warning >= 1);
    assert.equal(gate.canPublish, true);
    assert.match(gate.items.find(function(x) { return x.id === 'cloud_dirty'; }).message, /同步上云/);
  });

  it('isCardCloudDirty 与 meta', function() {
    globalThis.localStorage = mockStorage();
    var draft = { charName: 'X', contentRev: 'abc', updatedAt: '1' };
    markCardSynced('d1', '1', '1', { contentRev: 'zzz', bundleTouch: 0 });
    assert.equal(isCardCloudDirty(draft, 'd1'), true);
    globalThis.localStorage = undefined;
  });
});
