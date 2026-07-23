import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLOUD_STATUS,
  resolveCardCloudStatus,
  cloudStatusLabel,
  resolveCardCloudQuickAction,
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

  it('contentRev 主判据：正文未变则 dirty 为 false', function() {
    var draft = { charName: 'A', charDesc: 'd', updatedAt: '11:00:00', contentRev: 'a1b2c3d4' };
    globalThis.localStorage.setItem(CARD_CLOUD_META_KEY, JSON.stringify({
      rev1: {
        cardId: 'rev1',
        onCloud: true,
        localSyncedAt: '10:00:00',
        syncedContentRev: 'a1b2c3d4',
        syncedBundleTouch: 0,
        bundleTouch: 0,
      },
    }));
    assert.equal(
      resolveCardCloudStatus(Object.assign({}, draft, { updatedAt: '99:99:99' }), getCardCloudMeta('rev1')),
      CLOUD_STATUS.CLOUD_SYNCED
    );
  });

  it('pendingUpload 在 markSynced 后清除；云 ISO 与本地时分秒不误判 dirty', function() {
    globalThis.localStorage.setItem(CARD_CLOUD_META_KEY, JSON.stringify({
      c2: {
        cardId: 'c2',
        onCloud: true,
        pendingUpload: true,
        localSyncedAt: '23:24:53',
        cloudUpdatedAt: '2026-07-22T15:24:53.000Z',
      },
    }));
    assert.equal(resolveCardCloudStatus({ updatedAt: '23:24:53' }, getCardCloudMeta('c2')), CLOUD_STATUS.CLOUD_DIRTY);
    markCardSynced('c2', '2026-07-22T15:24:53.000Z', '23:24:53', {
      contentRev: 'deadbeef',
      bundleTouch: 0,
    });
    var meta = getCardCloudMeta('c2');
    assert.equal(meta.pendingUpload, false);
    assert.equal(
      resolveCardCloudStatus({ updatedAt: '23:24:53', contentRev: 'deadbeef' }, meta),
      CLOUD_STATUS.CLOUD_SYNCED
    );
  });

  it('仅有 onCloud 标记、无 localSyncedAt 时视为未上云', function() {
    globalThis.localStorage.setItem(CARD_CLOUD_META_KEY, JSON.stringify({
      c3: {
        cardId: 'c3',
        onCloud: true,
        cloudUpdatedAt: '2026-01-01',
      },
    }));
    assert.equal(
      resolveCardCloudStatus({ updatedAt: '12:00:00' }, getCardCloudMeta('c3')),
      CLOUD_STATUS.LOCAL_ONLY
    );
  });

  it('labels', function() {
    assert.match(cloudStatusLabel(CLOUD_STATUS.LOCAL_ONLY), /未上云/);
    assert.match(cloudStatusLabel(CLOUD_STATUS.CLOUD_DIRTY), /未同步/);
    assert.match(cloudStatusLabel(CLOUD_STATUS.CLOUD_SYNCED), /已同步/);
  });

  it('云快捷按钮：未同步显示同步上云，已同步隐藏', function() {
    assert.deepEqual(resolveCardCloudQuickAction(CLOUD_STATUS.LOCAL_ONLY), {
      action: 'cloud-upload',
      label: '同步上云',
    });
    assert.deepEqual(resolveCardCloudQuickAction(CLOUD_STATUS.CLOUD_DIRTY), {
      action: 'cloud-upload',
      label: '同步上云',
    });
    assert.equal(resolveCardCloudQuickAction(CLOUD_STATUS.CLOUD_SYNCED), null);
  });

  it('mark local only + merge index', function() {
    markCardSynced('x', '1', '1');
    markCardLocalOnly('x');
    assert.equal(getCardCloudMeta('x').onCloud, false);
    mergeCloudIndexIntoMeta([{ id: 'y', updatedAt: '2026-01-01' }]);
    var yMeta = getCardCloudMeta('y');
    assert.equal(yMeta.cloudUpdatedAt, '2026-01-01');
    assert.notEqual(yMeta.onCloud, true);
    assert.equal(resolveCardCloudStatus({ updatedAt: '12:00:00' }, yMeta), CLOUD_STATUS.LOCAL_ONLY);
    assert.ok(localStorage.getItem(CARD_CLOUD_META_KEY));
  });

  it('同步基线对齐后，同 updatedAt 仍视为已同步', function() {
    markCardSynced('synced1', '11:30:45', '11:30:45');
    assert.equal(
      resolveCardCloudStatus({ updatedAt: '11:30:45' }, getCardCloudMeta('synced1')),
      CLOUD_STATUS.CLOUD_SYNCED
    );
  });
});
