/**
 * 快照组装：leases = engine scopes ∪ taskCenter 派生
 */
import { getActionDef, TASK_TYPE_TO_ACTION } from './catalog.mjs';
import { SCOPE_KIND, scopeKey, TIER } from './types.mjs';

/**
 * @param {object} opts
 * @param {() => string} [opts.getCardId]
 * @param {() => string} [opts.getStoryId]
 * @param {() => boolean} [opts.getAiConfigured]
 * @param {() => boolean} [opts.getAdminOps]
 * @param {() => boolean} [opts.getBackupEnabled]
 * @param {() => object} [opts.getNovelGates]
 * @param {() => object|null} [opts.getTaskCenter]
 * @param {Map<string, object>} opts.leasesByOwner
 */
export function buildSnapshot(opts) {
  var o = opts || {};
  var cardId = typeof o.getCardId === 'function' ? String(o.getCardId() || '').trim() : '';
  var storyId = typeof o.getStoryId === 'function' ? String(o.getStoryId() || '').trim() : '';
  var aiConfigured = typeof o.getAiConfigured === 'function' ? !!o.getAiConfigured() : true;
  var adminOps = typeof o.getAdminOps === 'function' ? !!o.getAdminOps() : false;
  var backupEnabled = typeof o.getBackupEnabled === 'function' ? !!o.getBackupEnabled() : false;
  var novelGates = typeof o.getNovelGates === 'function' ? (o.getNovelGates() || {}) : {};

  /** @type {import('./types.mjs').ScopeLease[]} */
  var leases = [];
  var seen = Object.create(null);

  function addLease(lease) {
    if (!lease || !lease.scope || !lease.ownerActionId) return;
    var key = lease.ownerActionId + '|' + lease.scope;
    if (seen[key]) return;
    seen[key] = 1;
    leases.push(lease);
  }

  if (o.leasesByOwner && typeof o.leasesByOwner.forEach === 'function') {
    o.leasesByOwner.forEach(function(lease) {
      addLease(lease);
    });
  }

  var activeTasks = [];
  var center = typeof o.getTaskCenter === 'function' ? o.getTaskCenter() : null;
  if (center && typeof center.snapshot === 'function') {
    var tsnap = center.snapshot();
    (tsnap.tasks || []).forEach(function(t) {
      if (!t || (t.status !== 'queued' && t.status !== 'running')) return;
      activeTasks.push({
        id: t.id,
        type: t.type,
        status: t.status,
        target: t.target || '',
      });
      var actionId = TASK_TYPE_TO_ACTION[t.type];
      if (!actionId) {
        // 未知任务：按 target / 默认挂 card
        actionId = 'card.assistant.react';
      }
      var def = getActionDef(actionId);
      var kind = def ? def.scopeKind : SCOPE_KIND.card;
      var sid = '';
      if (kind === SCOPE_KIND.story) sid = storyId;
      else if (kind === SCOPE_KIND.card) sid = cardId;
      var scope = scopeKey(kind, sid);
      // target 若带 card:/story: 前缀可覆盖
      var tgt = String(t.target || '');
      if (tgt.indexOf('card:') === 0 || tgt.indexOf('story:') === 0 || tgt.indexOf('admin:') === 0) {
        scope = tgt;
      }
      addLease({
        scope: scope,
        ownerActionId: actionId,
        label: t.title || (def && def.busyLabel) || t.typeLabel || t.type,
        tier: (def && def.tier) || TIER.local_ai,
      });
    });
  }

  return {
    currentCardId: cardId,
    currentStoryId: storyId,
    aiConfigured: aiConfigured,
    adminOps: adminOps,
    backupEnabled: backupEnabled,
    novelGates: novelGates,
    leases: leases,
    activeTasks: activeTasks,
  };
}
