import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
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
import { shouldFetchAccountCloud } from '../src/lib/sync/syncCenter.mjs';

var root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('syncEngine helpers', function() {
  it('formatSyncCountdown', function() {
    assert.equal(formatSyncCountdown(0), '0:00');
    assert.equal(formatSyncCountdown(1000), '0:01');
    assert.equal(formatSyncCountdown(5 * 60 * 1000), '5:00');
    assert.equal(formatSyncCountdown(4 * 60 * 1000 + 32000), '4:32');
    assert.equal(formatSyncCountdown(null), '');
  });

  it('friendlySyncError maps auth / network', function() {
    assert.match(friendlySyncError(new Error('unauthorized')), /登录已失效/);
    assert.match(friendlySyncError(new Error('Failed to fetch')), /网络异常/);
  });

  it('computeShouldSkipSyncWhenClean：本地干净且已同步过才跳过', function() {
    assert.equal(computeShouldSkipSyncWhenClean({ skipIfClean: true }, { lastSyncAt: '2026-01-01', localDirty: false }), true);
    assert.equal(computeShouldSkipSyncWhenClean({ skipIfClean: true }, { lastSyncAt: '2026-01-01', localDirty: true }), false);
    assert.equal(computeShouldSkipSyncWhenClean({ skipIfClean: true }, { lastSyncAt: null, localDirty: false }), false);
    assert.equal(computeShouldSkipSyncWhenClean({ force: true, skipIfClean: true }, { lastSyncAt: '2026-01-01', localDirty: false }), false);
    assert.equal(computeShouldSkipSyncWhenClean({}, { lastSyncAt: '2026-01-01', localDirty: false }), false);
  });
});

describe('shouldFetchAccountCloud', function() {
  it('未登录或倒计时不拉配额和设备列表', function() {
    assert.equal(shouldFetchAccountCloud(false, 'login'), false);
    assert.equal(shouldFetchAccountCloud(false, 'sync'), false);
    assert.equal(shouldFetchAccountCloud(false, 'view'), false);
    assert.equal(shouldFetchAccountCloud(true, 'tick'), false);
    assert.equal(shouldFetchAccountCloud(true, 'boot'), false);
    assert.equal(shouldFetchAccountCloud(true, 'login'), true);
    assert.equal(shouldFetchAccountCloud(true, 'view'), true);
    assert.equal(shouldFetchAccountCloud(true, 'sync'), true);
  });

  it('账户页倒计时不调用云端附加刷新', function() {
    var boot = readFileSync(join(root, 'src/lib/sync/accountSyncPanelBoot.mjs'), 'utf8');
    var setSync = boot.slice(boot.indexOf('function setSyncLine'), boot.indexOf('function readLocalDraftsForSyncCenter'));
    assert.doesNotMatch(setSync, /refreshAccountPanelExtras/);
    assert.match(boot, /setInterval\(function\(\) \{ setSyncLine\(\); \}/);
    assert.match(boot, /if \(!sessionOpen\)/);
    assert.doesNotMatch(boot, /snap\.quota \|\| await fetchCloudQuota/);
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
