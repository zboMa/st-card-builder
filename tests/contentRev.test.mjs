import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDraftContentRev,
  attachContentRevToDraft,
  bumpCardBundleTouch,
  collectSyncBaseline,
} from '../src/lib/sync/contentRev.mjs';
import {
  CARD_CLOUD_META_KEY,
  markCardSynced,
  resolveCardCloudStatus,
  CLOUD_STATUS,
  getCardCloudMeta,
} from '../src/lib/sync/cardCloudMeta.mjs';

function mockStorage() {
  var map = {};
  return {
    getItem: function(k) { return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null; },
    setItem: function(k, v) { map[k] = String(v); },
    removeItem: function(k) { delete map[k]; },
  };
}

describe('contentRev', function() {
  it('相同正文得相同 rev；改 charName 则变', function() {
    var a = { charName: 'A', charDesc: 'x', updatedAt: '1' };
    var b = { charName: 'A', charDesc: 'x', updatedAt: '2' };
    var c = { charName: 'B', charDesc: 'x', updatedAt: '1' };
    assert.equal(computeDraftContentRev(a), computeDraftContentRev(b));
    assert.notEqual(computeDraftContentRev(a), computeDraftContentRev(c));
  });

  it('attachContentRevToDraft 写入十六进制 rev', function() {
    var out = attachContentRevToDraft({ charName: 'Z' });
    assert.match(out.contentRev, /^[0-9a-f]{8}$/);
  });

  it('bundleTouch 递增并参与 dirty 判定', function() {
    globalThis.localStorage = mockStorage();
    var draft = attachContentRevToDraft({ charName: 'X', updatedAt: '12:00:00' });
    markCardSynced('b1', '12:00:00', '12:00:00', collectSyncBaseline(draft, null));
    assert.equal(resolveCardCloudStatus(draft, getCardCloudMeta('b1')), CLOUD_STATUS.CLOUD_SYNCED);
    bumpCardBundleTouch('b1');
    assert.equal(resolveCardCloudStatus(draft, getCardCloudMeta('b1')), CLOUD_STATUS.CLOUD_DIRTY);
    globalThis.localStorage = undefined;
  });

  it('contentRev 基线下 updatedAt 不同仍视为已同步', function() {
    globalThis.localStorage = mockStorage();
    var draft = attachContentRevToDraft({ charName: 'Y', updatedAt: '10:00:00' });
    markCardSynced('c1', 'iso-time', '10:00:00', collectSyncBaseline(draft, null));
    var same = attachContentRevToDraft(Object.assign({}, draft, { updatedAt: '99:99:99' }));
    assert.equal(resolveCardCloudStatus(same, getCardCloudMeta('c1')), CLOUD_STATUS.CLOUD_SYNCED);
    globalThis.localStorage = undefined;
  });
});
