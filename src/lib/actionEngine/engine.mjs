/**
 * createActionEngine — 统一注册 / 判定 / apply / beginScope
 */
import { createRegistry } from './registry.mjs';
import { buildSnapshot } from './snapshot.mjs';
import { evaluateAction, evaluateById } from './policy.mjs';
import { applyViewToEl, applyNovelGateBanners, applyTip } from './apply.mjs';
import { getActionDef, ACTION_CATALOG } from './catalog.mjs';
import { ActionDeniedError, scopeKey, TIER } from './types.mjs';

/**
 * @param {object} [options]
 * @param {() => string} [options.getCardId]
 * @param {() => string} [options.getStoryId]
 * @param {() => boolean} [options.getAiConfigured]
 * @param {() => boolean} [options.getAdminOps]
 * @param {() => boolean} [options.getBackupEnabled]
 * @param {() => object} [options.getNovelGates]
 * @param {() => object|null} [options.getTaskCenter]
 * @param {boolean} [options.applyNovelGates]
 */
export function createActionEngine(options) {
  var opts = options || {};
  var registry = createRegistry();
  /** @type {Map<string, import('./types.mjs').ScopeLease>} */
  var leasesByOwner = new Map();
  var lastSnap = null;
  var listeners = [];

  function providers() {
    return {
      getCardId: opts.getCardId,
      getStoryId: opts.getStoryId,
      getAiConfigured: opts.getAiConfigured,
      getAdminOps: opts.getAdminOps,
      getBackupEnabled: opts.getBackupEnabled,
      getNovelGates: opts.getNovelGates,
      getTaskCenter: opts.getTaskCenter,
      leasesByOwner: leasesByOwner,
    };
  }

  function getSnapshot() {
    lastSnap = buildSnapshot(providers());
    return lastSnap;
  }

  function evaluate(actionId) {
    var def = getActionDef(actionId) || (registry.get(actionId) && registry.get(actionId).def);
    var snap = getSnapshot();
    if (def) return evaluateAction(def, snap);
    return evaluateById(actionId, snap);
  }

  function assertAllowed(actionId) {
    var view = evaluate(actionId);
    if (!view.allowed || view.enabled === false) {
      throw ActionDeniedError(view.reason || '操作被拒绝', actionId);
    }
    return view;
  }

  function beginScope(meta) {
    var m = meta || {};
    var ownerActionId = m.ownerActionId || m.id;
    if (!ownerActionId) throw new Error('beginScope: 缺少 ownerActionId');
    var def = getActionDef(ownerActionId);
    var snap = getSnapshot();
    var scope = m.scope;
    if (!scope && def) {
      if (def.scopeKind === 'admin') scope = scopeKey('admin');
      else if (def.scopeKind === 'card') scope = scopeKey('card', snap.currentCardId);
      else if (def.scopeKind === 'story') scope = scopeKey('story', snap.currentStoryId);
    }
    if (!scope) scope = scopeKey('card', snap.currentCardId);
    leasesByOwner.set(ownerActionId, {
      scope: scope,
      ownerActionId: ownerActionId,
      label: m.label || (def && def.busyLabel) || (def && def.label) || '进行中…',
      tier: m.tier || (def && def.tier) || TIER.heavy,
    });
    refresh();
    return ownerActionId;
  }

  function endScope(ownerActionId) {
    if (!ownerActionId) return;
    leasesByOwner.delete(ownerActionId);
    refresh();
  }

  function applyAll(snap) {
    var s = snap || getSnapshot();
    if (opts.applyNovelGates !== false && s.novelGates) {
      applyNovelGateBanners(s.novelGates);
    }
    registry.all().forEach(function(entry) {
      var id = entry.id;
      var def = getActionDef(id) || entry.def || { id: id, tier: entry.tier || TIER.safe, scopeKind: entry.scopeKind || 'none' };
      var view = evaluateAction(def, s);
      if (typeof entry.onView === 'function') {
        try { entry.onView(view, s); } catch (e) { console.warn('[actionEngine] onView', id, e); }
      }
      registry.resolveEls(entry).forEach(function(el) {
        applyViewToEl(el, view);
      });
    });
    // AI tip 条
    var aiTip = s.aiConfigured ? '' : '未配置 AI，请先到「AI 配置」选择模型';
    applyTip('novelSetupAiTip', aiTip);
    applyTip('novelGreetAiTip', aiTip);

    listeners.forEach(function(fn) {
      try { fn(s); } catch (e) { console.warn('[actionEngine] listener', e); }
    });
  }

  function refresh() {
    var snap = getSnapshot();
    applyAll(snap);
    return snap;
  }

  /**
   * @param {object} entry
   */
  function register(entry) {
    var e = entry || {};
    if (!e.id) throw new Error('register: 缺少 id');
    var def = getActionDef(e.id);
    if (def) e.def = def;
    if (e.elId && typeof document !== 'undefined') {
      var el = document.getElementById(e.elId);
      if (el) e.el = el;
    }
    registry.register(e);
    return e.id;
  }

  function registerMany(list) {
    (list || []).forEach(function(e) { register(e); });
  }

  /**
   * assert → 可选 autoScope → fn → endScope
   * @param {string} actionId
   * @param {(ctx: { signal?: AbortSignal }) => Promise<any>|any} fn
   * @param {{ autoScope?: boolean, label?: string, scope?: string }} [runOpts]
   */
  async function run(actionId, fn, runOpts) {
    var ro = runOpts || {};
    assertAllowed(actionId);
    var auto = ro.autoScope !== false;
    if (auto) beginScope({ ownerActionId: actionId, label: ro.label, scope: ro.scope });
    try {
      return await fn({});
    } finally {
      if (auto) endScope(actionId);
    }
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') return function() {};
    listeners.push(fn);
    return function() {
      listeners = listeners.filter(function(x) { return x !== fn; });
    };
  }

  function setProviders(next) {
    Object.keys(next || {}).forEach(function(k) {
      opts[k] = next[k];
    });
  }

  return {
    ACTION_CATALOG: ACTION_CATALOG,
    register: register,
    registerMany: registerMany,
    unregister: function(id) { registry.unregister(id); },
    beginScope: beginScope,
    endScope: endScope,
    refresh: refresh,
    evaluate: evaluate,
    assertAllowed: assertAllowed,
    run: run,
    getSnapshot: getSnapshot,
    subscribe: subscribe,
    setProviders: setProviders,
    /** 列表项等动态控件：按 selector 临时判定 */
    applySelector: function(actionId, selector) {
      var view = evaluate(actionId);
      if (typeof document === 'undefined') return view;
      document.querySelectorAll(selector).forEach(function(el) {
        applyViewToEl(el, view);
      });
      return view;
    },
    isDeniedError: function(err) {
      return !!(err && err.name === 'ActionDeniedError');
    },
  };
}
