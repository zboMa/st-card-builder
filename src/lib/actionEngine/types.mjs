/**
 * Action Engine 类型约定（JSDoc）
 *
 * @typedef {'lifecycle'|'heavy'|'local_ai'|'safe'} ActionTier
 * @typedef {'card'|'story'|'admin'|'none'} ScopeKind
 *
 * @typedef {object} ActionDef
 * @property {string} id
 * @property {ActionTier} tier
 * @property {ScopeKind} scopeKind
 * @property {boolean} [requiresAi]
 * @property {boolean} [requiresSource]  小说工坊：需有源文
 * @property {boolean} [requiresExtract] 小说工坊：需源文+章节
 * @property {boolean} [requiresOps]      管理端 ops
 * @property {boolean} [requiresBackupEnabled]
 * @property {string} [busyLabel]
 * @property {string} [label]
 * @property {string} [gateTipId]        绑定 gate tip 元素
 *
 * @typedef {object} ScopeLease
 * @property {string} scope           如 card:abc / story:x / admin:global
 * @property {string} ownerActionId
 * @property {string} [label]
 * @property {ActionTier} [tier]
 *
 * @typedef {object} ActionViewState
 * @property {boolean} allowed
 * @property {boolean} enabled
 * @property {boolean} visible
 * @property {string} reason
 * @property {string} [label]
 *
 * @typedef {object} EngineSnapshot
 * @property {string} currentCardId
 * @property {string} currentStoryId
 * @property {boolean} aiConfigured
 * @property {boolean} adminOps
 * @property {boolean} backupEnabled
 * @property {{ hasSource?: boolean, hasChapters?: boolean, canExtract?: boolean, reasons?: string[] }} novelGates
 * @property {ScopeLease[]} leases
 * @property {{ id: string, type: string, status: string, target?: string }[]} activeTasks
 */

export var TIER = Object.freeze({
  lifecycle: 'lifecycle',
  heavy: 'heavy',
  local_ai: 'local_ai',
  safe: 'safe',
});

export var SCOPE_KIND = Object.freeze({
  card: 'card',
  story: 'story',
  admin: 'admin',
  none: 'none',
});

export function ActionDeniedError(reason, actionId) {
  var err = new Error(reason || '操作被拒绝');
  err.name = 'ActionDeniedError';
  err.actionId = actionId || '';
  err.reason = reason || '操作被拒绝';
  return err;
}

export function isActionDeniedError(err) {
  return !!(err && (err.name === 'ActionDeniedError' || err.isActionDenied));
}

export function scopeKey(kind, id) {
  if (kind === SCOPE_KIND.admin) return 'admin:global';
  if (kind === SCOPE_KIND.none || !kind) return '';
  var sid = String(id || '').trim();
  if (!sid) return kind + ':*';
  return kind + ':' + sid;
}

export function scopeKindOfKey(key) {
  var k = String(key || '');
  if (k.indexOf('card:') === 0) return SCOPE_KIND.card;
  if (k.indexOf('story:') === 0) return SCOPE_KIND.story;
  if (k.indexOf('admin:') === 0) return SCOPE_KIND.admin;
  return SCOPE_KIND.none;
}
