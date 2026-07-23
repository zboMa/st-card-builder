/**
 * 云端配额客户端 + 校验
 */
import { cloudGet } from './cloudApi.mjs';

var cached = null;
var cachedAt = 0;
var CACHE_MS = 15000;

export async function fetchCloudQuota(force) {
  if (!force && cached && (Date.now() - cachedAt) < CACHE_MS) return cached;
  try {
    var res = await cloudGet('/api/data/quota');
    cached = res && res.quota ? res.quota : null;
    cachedAt = Date.now();
    return cached;
  } catch (e) {
    return null;
  }
}

export function invalidateQuotaCache() {
  cached = null;
  cachedAt = 0;
}

export function formatQuotaBar(used, limit) {
  if (!Number.isFinite(limit) || limit === Infinity) return '不限';
  if (!limit) return String(used || 0);
  var pct = Math.min(100, Math.round((Number(used) || 0) / limit * 100));
  return (used || 0) + ' / ' + limit + '（' + pct + '%）';
}

/**
 * @param {'upload_bundle'|'create_share'|'batch_upload'} action
 * @param {object} [ctx]
 */
export async function ensureCloudQuota(action, ctx) {
  ctx = ctx || {};
  var q = await fetchCloudQuota(true);
  if (!q || !q.limits) return { ok: true };
  var lim = q.limits;
  var use = q.usage || {};

  if (action === 'batch_upload') {
    var n = Number(ctx.count) || 0;
    if (n > lim.batchUploadMax) {
      return {
        ok: false,
        message: '单次批量上云最多 ' + lim.batchUploadMax + ' 张（当前 ' + n + ' 张）',
        quota: q,
      };
    }
  }

  if (action === 'create_share' && use.activeShares >= lim.activeShares) {
    return {
      ok: false,
      message: '活跃分享已达上限 ' + lim.activeShares + ' 个',
      quota: q,
    };
  }

  if (action === 'upload_bundle' && ctx.isNewCard && use.cardsOnCloud >= lim.cardsOnCloud) {
    return {
      ok: false,
      message: '云端卡数量已达上限 ' + lim.cardsOnCloud + ' 张',
      quota: q,
    };
  }

  return { ok: true, quota: q };
}

export function quotaUsageHtml(quota) {
  if (!quota) return '';
  var lim = quota.limits || {};
  var use = quota.usage || {};
  var lines = [];
  lines.push('档位：' + (quota.tierLabel || quota.tier || '—'));
  if (Number.isFinite(lim.cardsOnCloud)) {
    lines.push('云端卡：' + formatQuotaBar(use.cardsOnCloud, lim.cardsOnCloud));
  }
  if (Number.isFinite(lim.cloudBytes)) {
    var mb = (use.cloudBytes / (1024 * 1024)).toFixed(1);
    var limMb = (lim.cloudBytes / (1024 * 1024)).toFixed(0);
    lines.push('云容量：' + mb + ' / ' + limMb + ' MB');
  }
  if (Number.isFinite(lim.activeShares)) {
    lines.push('活跃分享：' + formatQuotaBar(use.activeShares, lim.activeShares));
  }
  if (Number.isFinite(lim.bearerTokens)) {
    lines.push('登录设备：' + formatQuotaBar(use.bearerTokens, lim.bearerTokens));
  }
  return lines.join('\n');
}
