import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLOUD_STATUS,
  resolveCardCloudStatus,
  cloudStatusLabel,
  markCardSynced,
  markCardLocalOnly,
  getCardCloudMeta,
  CARD_CLOUD_META_KEY,
  mergeCloudIndexIntoMeta,
} from '../src/lib/sync/cardCloudMeta.mjs';

function mockStorage() {
  var map = {};
  return {
    getItem: function(k) { return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null; },
    setItem: function(k, v) { map[k] = String(v); },
    removeItem: function(k) { delete map[k]; },
  };
}

describe('cardCloudMeta', function() {
  var prev;
  beforeEach(function() {
    prev = globalThis.localStorage;
    globalThis.localStorage = mockStorage();
  });
  afterEach(function() {
    globalThis.localStorage = prev;
  });

  it('三态判定', function() {
    assert.equal(resolveCardCloudStatus({ updatedAt: 'a' }, null), CLOUD_STATUS.LOCAL_ONLY);
    assert.equal(resolveCardCloudStatus({ _cloudStub: true }, { onCloud: true }), CLOUD_STATUS.CLOUD_DIRTY);
    markCardSynced('c1', 't1', 't1');
    assert.equal(resolveCardCloudStatus({ updatedAt: 't1' }, getCardCloudMeta('c1')), CLOUD_STATUS.CLOUD_SYNCED);
    assert.equal(resolveCardCloudStatus({ updatedAt: 't2' }, getCardCloudMeta('c1')), CLOUD_STATUS.CLOUD_DIRTY);
  });

  it('labels', function() {
    assert.match(cloudStatusLabel(CLOUD_STATUS.LOCAL_ONLY), /未上云/);
    assert.match(cloudStatusLabel(CLOUD_STATUS.CLOUD_DIRTY), /未同步/);
    assert.match(cloudStatusLabel(CLOUD_STATUS.CLOUD_SYNCED), /已同步/);
  });

  it('mark local only + merge index', function() {
    markCardSynced('x', '1', '1');
    markCardLocalOnly('x');
    assert.equal(getCardCloudMeta('x').onCloud, false);
    mergeCloudIndexIntoMeta([{ id: 'y', updatedAt: '2026-01-01' }]);
    assert.equal(getCardCloudMeta('y').onCloud, true);
    assert.ok(localStorage.getItem(CARD_CLOUD_META_KEY));
  });
});
