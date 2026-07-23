/**
 * 云端配额档位与上限（SoT：docs/systems/quota.md）
 */
export var QUOTA_TIERS = {
  REGISTERED: 'registered',
  MEMBER: 'member',
  ADMIN: 'admin',
};

var MB = 1024 * 1024;

/** @param {string} tier */
export function limitsForTier(tier) {
  if (tier === QUOTA_TIERS.ADMIN) {
    return {
      cardsOnCloud: Infinity,
      cloudBytes: Infinity,
      activeShares: Infinity,
      storyNovels: Infinity,
      bearerTokens: Infinity,
      batchUploadMax: Infinity,
    };
  }
  if (tier === QUOTA_TIERS.MEMBER) {
    return {
      cardsOnCloud: 50,
      cloudBytes: 5 * 1024 * MB,
      activeShares: 20,
      storyNovels: 30,
      bearerTokens: 10,
      batchUploadMax: 20,
    };
  }
  return {
    cardsOnCloud: 10,
    cloudBytes: 500 * MB,
    activeShares: 3,
    storyNovels: 5,
    bearerTokens: 3,
    batchUploadMax: 5,
  };
}

export function tierLabel(tier) {
  if (tier === QUOTA_TIERS.MEMBER) return '会员';
  if (tier === QUOTA_TIERS.ADMIN) return '管理员';
  return '注册基础';
}

export function formatBytes(n) {
  var v = Number(n) || 0;
  if (!Number.isFinite(v) || v < 0) return '0 B';
  if (v >= 1024 * MB) return (v / (1024 * MB)).toFixed(1) + ' GB';
  if (v >= MB) return (v / MB).toFixed(1) + ' MB';
  if (v >= 1024) return (v / 1024).toFixed(1) + ' KB';
  return Math.round(v) + ' B';
}
