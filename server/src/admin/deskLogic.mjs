/**
 * 管理端纯逻辑：分页、分享拒绝原因、自审拦截、配额超限、菜单补父级。
 * 不连 Couch，供路由与测试共用。
 */

export var LIST_HARD_CAP = 2000;
export var INDEX_SCAN_CAP = 10000;

export var TASK_IDS = ['index.rebuild', 'token.purge', 'backup.periodic'];

export var BUILTIN_VIEWS = [
  'dashboard', 'users', 'cards', 'novels', 'shares', 'tokens', 'databases',
  'moderation', 'audit', 'system', 'roles', 'menus', 'oplog', 'loginlog',
  'params', 'dicts', 'invites', 'quota', 'files', 'tasks', 'backup',
];

export var BUILTIN_GROUPS = ['group-people', 'group-content', 'group-run'];

export function pageSlice(items, offset, limit) {
  var list = items || [];
  var off = Math.max(0, Number(offset) || 0);
  var lim = Math.min(100, Math.max(1, Number(limit) || 30));
  return {
    items: list.slice(off, off + lim),
    total: list.length,
    offset: off,
    limit: lim,
  };
}

export function capMeta(fetched, cap) {
  var n = Number(fetched) || 0;
  var c = Number(cap) || LIST_HARD_CAP;
  return { capped: n >= c, listedCap: c };
}

export function isExpiredAt(expiresAt, now) {
  if (!expiresAt) return false;
  var t = Date.parse(expiresAt);
  return Number.isFinite(t) && (now || Date.now()) > t;
}

/** 公开读取拒绝。口令错误由调用方单独判断，不在这里。 */
export function shareClosed(mapping, removed, now) {
  if (!mapping || mapping.enabled === false) {
    return { status: 404, error: 'not_found', why: 'stopped' };
  }
  if (isExpiredAt(mapping.expiresAt, now)) {
    return { status: 410, error: 'expired', why: 'expired' };
  }
  if (removed) return { status: 404, error: 'removed', why: 'removed' };
  return null;
}

export function selfApprovalBlocked(requestedBy, by, approve) {
  return !!(approve && requestedBy && by && String(requestedBy) === String(by));
}

export function defaultExpiresAt(days, now) {
  var n = Number(days);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date((now || Date.now()) + n * 86400000).toISOString();
}

var QUOTA_KEYS = [
  ['cardsOnCloud', '卡数'],
  ['cloudBytes', '容量'],
  ['activeShares', '分享'],
  ['bearerTokens', 'Token'],
  ['storyNovels', '小说'],
];

export function exceededLabels(usage, limits) {
  var out = [];
  var use = usage || {};
  var lim = limits || {};
  QUOTA_KEYS.forEach(function(pair) {
    var cap = lim[pair[0]];
    var used = Number(use[pair[0]]) || 0;
    if (Number.isFinite(cap) && used > cap) out.push(pair[1]);
  });
  return out;
}

export function bearerIdsForUser(docs, userId) {
  var uid = String(userId || '');
  return (docs || []).filter(function(d) {
    return d && String(d.userId || '') === uid;
  }).map(function(d) { return d.id || d._id; });
}

/**
 * 已有菜单只补一次父级，不改名称。
 * parentMigrated 之后，管理员把父级清空也保持为空。
 */
export function nextMenuParent(existing, seedParent) {
  if (!existing) return { create: true, parentId: seedParent || '' };
  if (existing.parentMigrated) return { update: false };
  return {
    update: true,
    parentId: seedParent || '',
    parentMigrated: true,
    name: existing.name,
  };
}

export function menuCanDelete(id) {
  var s = String(id || '');
  if (BUILTIN_VIEWS.indexOf(s) >= 0) return false;
  if (BUILTIN_GROUPS.indexOf(s) >= 0) return false;
  return true;
}

export function menuCanSave(doc) {
  if (!doc || !doc.id) return { ok: false, error: 'missing_menu_id' };
  var id = String(doc.id);
  var builtin = BUILTIN_VIEWS.indexOf(id) >= 0;
  var groupBuiltin = BUILTIN_GROUPS.indexOf(id) >= 0;
  if (builtin && doc.group) return { ok: false, error: 'builtin_view_not_group' };
  if (!doc.group && !builtin && !groupBuiltin) {
    return { ok: false, error: 'menu_without_page' };
  }
  if (doc.parentId && String(doc.parentId) === id) {
    return { ok: false, error: 'menu_parent_self' };
  }
  return { ok: true };
}

export function announcementVisible(text) {
  return String(text || '').trim().length > 0;
}
