/**
 * 同步中心：待上云 / outbox / 跳转卡管理
 */
import {
  CLOUD_STATUS,
  readAllCardCloudMeta,
  resolveCardCloudStatus,
} from './cardCloudMeta.mjs';
import { peekOutbox } from './outbox.mjs';
import { isCloudEnabled } from './cloudStoreShared.mjs';
import { fetchCloudQuota, quotaUsageHtml } from './quotaClient.mjs';

export function countDirtyCloudCards(drafts) {
  drafts = drafts || {};
  var metaAll = readAllCardCloudMeta();
  var n = 0;
  Object.keys(drafts).forEach(function(id) {
    if (!id || (drafts[id] && drafts[id]._cloudStub)) return;
    var status = resolveCardCloudStatus(drafts[id], metaAll[id]);
    if (status !== CLOUD_STATUS.CLOUD_SYNCED) n += 1;
  });
  return n;
}

export function listDirtyCloudCardIds(drafts) {
  drafts = drafts || {};
  var metaAll = readAllCardCloudMeta();
  return Object.keys(drafts).filter(function(id) {
    if (!id || (drafts[id] && drafts[id]._cloudStub)) return false;
    var status = resolveCardCloudStatus(drafts[id], metaAll[id]);
    return status !== CLOUD_STATUS.CLOUD_SYNCED;
  });
}

export function getOutboxSummary() {
  var items = peekOutbox();
  var failed = items.filter(function(it) {
    return it && (it.failCount > 0 || it.lastError);
  }).length;
  return { total: items.length, failed: failed };
}

/**
 * @param {object} opts
 * @param {function(): object} opts.getDrafts
 */
export async function buildSyncCenterSnapshot(opts) {
  opts = opts || {};
  if (!isCloudEnabled()) {
    return { loggedIn: false, pendingUpload: 0, outbox: { total: 0, failed: 0 }, quotaText: '' };
  }
  var drafts = typeof opts.getDrafts === 'function' ? opts.getDrafts() : {};
  var pending = countDirtyCloudCards(drafts);
  var outbox = getOutboxSummary();
  var quota = await fetchCloudQuota(false);
  if (typeof window !== 'undefined') {
    window.__cloudPendingCount__ = pending;
  }
  return {
    loggedIn: true,
    pendingUpload: pending,
    outbox: outbox,
    quota: quota,
    quotaText: quotaUsageHtml(quota),
    summaryLine: '待上云 ' + pending + ' 张'
      + (outbox.total ? ' · 离线队列 ' + outbox.total + ' 条' : ''),
  };
}

export function navigateToCardManagerBatch() {
  try {
    location.hash = 'card-manager';
  } catch (e) { /* ignore */ }
}
