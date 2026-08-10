/**
 * 策略矩阵：唯一判定入口
 */
import { getActionDef } from './catalog.mjs';
import { TIER, SCOPE_KIND, scopeKey } from './types.mjs';

function deny(reason, extra) {
  return Object.assign({
    allowed: false,
    enabled: false,
    visible: true,
    reason: reason || '不可用',
  }, extra || {});
}

function allow(extra) {
  return Object.assign({
    allowed: true,
    enabled: true,
    visible: true,
    reason: '',
  }, extra || {});
}

function scopesOverlap(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  var aKind = a.split(':')[0];
  var bKind = b.split(':')[0];
  if (aKind !== bKind) return false;
  if (a.endsWith(':*') || b.endsWith(':*')) return true;
  return false;
}

function actionScope(def, snap) {
  if (!def) return '';
  if (def.scopeKind === SCOPE_KIND.admin) return scopeKey(SCOPE_KIND.admin);
  if (def.scopeKind === SCOPE_KIND.card) return scopeKey(SCOPE_KIND.card, snap.currentCardId);
  if (def.scopeKind === SCOPE_KIND.story) return scopeKey(SCOPE_KIND.story, snap.currentStoryId);
  return '';
}

/**
 * @param {import('./types.mjs').ActionDef|object} def
 * @param {import('./types.mjs').EngineSnapshot} snap
 */
export function evaluateAction(def, snap) {
  var s = snap || {};
  var d = def || {};
  var gates = s.novelGates || {};

  if (d.requiresOps && !s.adminOps) {
    return deny('需要运维权限');
  }
  if (d.requiresBackupEnabled && !s.backupEnabled) {
    return deny('备份未启用');
  }
  if (d.requiresAi && !s.aiConfigured) {
    return deny('未配置 AI，请先到「AI 配置」选择模型');
  }
  if (d.requiresSource && !gates.hasSource) {
    return deny((gates.reasons && gates.reasons[0]) || '请先导入原始资料');
  }
  if (d.requiresExtract && !gates.canExtract) {
    return deny((gates.reasons && gates.reasons.join('；')) || '请先完成原始资料与拆章');
  }

  var myScope = actionScope(d, s);
  var leases = Array.isArray(s.leases) ? s.leases : [];
  var overlapping = leases.filter(function(L) {
    return scopesOverlap(myScope, L.scope);
  });

  var selfLease = overlapping.find(function(L) { return L.ownerActionId === d.id; });
  if (selfLease) {
    return deny(selfLease.label || d.busyLabel || '进行中…', {
      label: selfLease.label || d.busyLabel || '进行中…',
    });
  }

  var foreign = overlapping.filter(function(L) { return L.ownerActionId !== d.id; });
  if (!foreign.length) {
    return allow();
  }

  var hasHeavy = foreign.some(function(L) {
    return L.tier === TIER.heavy || L.tier === TIER.local_ai || !L.tier;
  });
  var hasAnyWrite = foreign.length > 0;

  if (d.tier === TIER.safe) {
    if (d.blockWhenScopeBusy && hasAnyWrite) {
      var busyWho = foreign[0];
      return deny('任务进行中：' + (busyWho.label || busyWho.ownerActionId || '请稍候'));
    }
    return allow();
  }

  if (d.tier === TIER.lifecycle && hasAnyWrite) {
    var who = foreign[0];
    return deny('任务进行中，请先在任务中心取消：' + (who.label || who.ownerActionId || '进行中任务'));
  }

  if ((d.tier === TIER.heavy || d.tier === TIER.local_ai) && hasHeavy) {
    var w = foreign[0];
    return deny('已有进行中的任务：' + (w.label || w.ownerActionId || '请稍候'));
  }

  return allow();
}

/**
 * @param {string} actionId
 * @param {import('./types.mjs').EngineSnapshot} snap
 */
export function evaluateById(actionId, snap) {
  var def = getActionDef(actionId);
  if (!def) return deny('未知操作：' + actionId);
  return evaluateAction(def, snap);
}

export { actionScope, scopesOverlap };
