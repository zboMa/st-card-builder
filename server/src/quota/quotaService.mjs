/**
 * 用户配额：用量聚合 + 校验
 */
import { getAdminRole } from '../config.mjs';
import { getUserRegistry, listShareMappings } from '../couch.mjs';
import { countBearersByUserIds } from '../auth/bearer.mjs';
import {
  getCardIndexDoc,
  listUserDocsByPrefix,
} from '../data/userDocs.mjs';
import { catalogNovelsList } from '../data/docIds.mjs';
import { limitsForTier, QUOTA_TIERS, tierLabel } from './quotaPolicy.mjs';
import { estimateBundleBytes } from './draftContentRev.mjs';

function isShareActive(mapping) {
  if (!mapping || mapping.enabled === false) return false;
  if (mapping.expiresAt) {
    var t = Date.parse(mapping.expiresAt);
    if (Number.isFinite(t) && Date.now() > t) return false;
  }
  return true;
}

export async function resolveUserTier(user) {
  if (!user || !user.id) return QUOTA_TIERS.REGISTERED;
  if (getAdminRole(user)) return QUOTA_TIERS.ADMIN;
  var reg = null;
  try { reg = await getUserRegistry(user.id); } catch (e) { /* ignore */ }
  var tier = reg && reg.quotaTier;
  if (tier === QUOTA_TIERS.MEMBER || tier === QUOTA_TIERS.ADMIN) return tier;
  return QUOTA_TIERS.REGISTERED;
}

export async function countActiveSharesForUser(userId) {
  var uid = String(userId || '');
  var list = await listShareMappings(3000);
  var n = 0;
  (list || []).forEach(function(m) {
    if (!m || String(m.ownerUserId || '') !== uid) return;
    if (isShareActive(m)) n += 1;
  });
  return n;
}

export async function countStoryNovelsForUser(userId) {
  var uid = String(userId || '');
  var total = 0;
  try {
    var rows = await listUserDocsByPrefix(uid, 'story/', { includeDocs: true });
    (rows || []).forEach(function(r) {
      var doc = r.doc || r;
      if (!doc || doc.type !== 'story-catalog') return;
      total += catalogNovelsList(doc).length;
    });
  } catch (e) { /* ignore */ }
  return total;
}

export async function computeCloudBytesFromIndex(userId, idx) {
  idx = idx || await getCardIndexDoc(userId);
  var cards = (idx && idx.cards) || [];
  var sum = 0;
  cards.forEach(function(c) {
    sum += Number(c && c.bundleBytes) || 0;
  });
  return sum;
}

export async function getQuotaSnapshot(user, opts) {
  opts = opts || {};
  var tier = await resolveUserTier(user);
  var limits = limitsForTier(tier);
  var idx = await getCardIndexDoc(user.id);
  var cardsOnCloud = ((idx && idx.cards) || []).length;
  var cloudBytes = await computeCloudBytesFromIndex(user.id, idx);
  var activeShares = await countActiveSharesForUser(user.id);
  var storyNovels = await countStoryNovelsForUser(user.id);
  var bearerCounts = await countBearersByUserIds([user.id]);
  var bearerTokens = bearerCounts[user.id] || 0;

  var usage = {
    cardsOnCloud: cardsOnCloud,
    cloudBytes: cloudBytes,
    activeShares: activeShares,
    storyNovels: storyNovels,
    bearerTokens: bearerTokens,
  };

  var warnings = [];
  function warnIf(key, label) {
    var lim = limits[key];
    var used = usage[key];
    if (!Number.isFinite(lim) || used <= lim * 0.85) return;
    if (used >= lim) warnings.push(label + '已达上限');
    else warnings.push(label + '已用 ' + Math.round(used / lim * 100) + '%');
  }
  warnIf('cardsOnCloud', '云端卡数量');
  warnIf('cloudBytes', '云端容量');
  warnIf('activeShares', '活跃分享');
  warnIf('storyNovels', 'Story 小说');
  warnIf('bearerTokens', '登录设备');

  return {
    tier: tier,
    tierLabel: tierLabel(tier),
    limits: limits,
    usage: usage,
    warnings: warnings,
  };
}

function quotaError(code, message, detail) {
  var err = new Error(message || code);
  err.code = code;
  err.statusCode = 413;
  err.quota = detail || null;
  return err;
}

/**
 * @param {object} user
 * @param {'upload_bundle'|'create_share'|'story_novel'|'issue_bearer'|'batch_upload'} action
 * @param {object} [ctx]
 */
export async function assertQuota(user, action, ctx) {
  ctx = ctx || {};
  var snap = await getQuotaSnapshot(user);
  var lim = snap.limits;
  var use = snap.usage;

  if (action === 'upload_bundle') {
    var idx = await getCardIndexDoc(user.id);
    var cards = (idx && idx.cards) || [];
    var cardId = String(ctx.cardId || '');
    var isNew = cardId && !cards.some(function(c) { return c && c.id === cardId; });
    var addBytes = Number(ctx.addBytes) || 0;
    var prevBytes = 0;
    if (cardId) {
      cards.forEach(function(c) {
        if (c && c.id === cardId) prevBytes = Number(c.bundleBytes) || 0;
      });
    }
    var nextBytes = use.cloudBytes - prevBytes + addBytes;
    if (isNew && use.cardsOnCloud >= lim.cardsOnCloud) {
      throw quotaError('quota_cards', '云端卡数量已达上限（' + lim.cardsOnCloud + '）', snap);
    }
    if (nextBytes > lim.cloudBytes) {
      throw quotaError('quota_bytes', '云端容量将超出上限', Object.assign({}, snap, {
        projectedBytes: nextBytes,
      }));
    }
    return snap;
  }

  if (action === 'create_share') {
    if (use.activeShares >= lim.activeShares) {
      throw quotaError('quota_shares', '活跃分享数已达上限（' + lim.activeShares + '）', snap);
    }
    return snap;
  }

  if (action === 'story_novel') {
    if (use.storyNovels >= lim.storyNovels) {
      throw quotaError('quota_story', 'Story 小说数已达上限（' + lim.storyNovels + '）', snap);
    }
    return snap;
  }

  if (action === 'issue_bearer') {
    if (use.bearerTokens >= lim.bearerTokens) {
      throw quotaError('quota_bearer', '登录设备数已达上限（' + lim.bearerTokens + '）', snap);
    }
    return snap;
  }

  if (action === 'batch_upload') {
    var n = Number(ctx.count) || 0;
    if (n > lim.batchUploadMax) {
      throw quotaError('quota_batch', '单次批量上云最多 ' + lim.batchUploadMax + ' 张', snap);
    }
    return snap;
  }

  return snap;
}

export { estimateBundleBytes };
