/**
 * 面板侧便捷：取全局引擎 / begin·end / assert
 */
import { ActionDeniedError } from './types.mjs';

export function getActionEngine() {
  if (typeof window === 'undefined') return null;
  return window.__actionEngine__ || null;
}

function toastDenied(reason) {
  if (typeof window === 'undefined' || !reason) return;
  try {
    if (window.__novelWorkshop__ && window.__novelWorkshop__.showToast) {
      window.__novelWorkshop__.showToast({ message: reason, level: 'warn' });
      return;
    }
  } catch (e) { /* ignore */ }
  try {
    var host = document.getElementById('appToastHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'appToastHost';
      host.className = 'app-toast-host';
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    var toast = document.createElement('div');
    toast.className = 'app-toast is-warn';
    toast.textContent = reason;
    host.appendChild(toast);
    setTimeout(function() {
      toast.classList.add('is-leaving');
      setTimeout(function() { toast.remove(); }, 280);
    }, 3200);
  } catch (e2) { /* ignore */ }
}

export function engineRefresh() {
  var eng = getActionEngine();
  if (eng) eng.refresh();
}

export function engineBegin(actionId, meta) {
  var eng = getActionEngine();
  if (!eng) return;
  eng.beginScope(Object.assign({ ownerActionId: actionId }, meta || {}));
}

export function engineEnd(actionId) {
  var eng = getActionEngine();
  if (!eng) return;
  eng.endScope(actionId);
}

/**
 * @param {string} actionId
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function engineTryAllowed(actionId, opts) {
  var eng = getActionEngine();
  if (!eng) return { ok: true };
  var view = eng.evaluate(actionId);
  if (!view.allowed || view.enabled === false) {
    var reason = view.reason || '操作被拒绝';
    if (!opts || opts.toast !== false) toastDenied(reason);
    return { ok: false, reason: reason };
  }
  return { ok: true };
}

export function engineAssert(actionId) {
  var eng = getActionEngine();
  if (!eng) return;
  try {
    eng.assertAllowed(actionId);
  } catch (err) {
    toastDenied(err.reason || err.message);
    throw err;
  }
}

export function denyOrThrow(actionId) {
  var r = engineTryAllowed(actionId);
  if (!r.ok) throw ActionDeniedError(r.reason, actionId);
  return r;
}

/**
 * 包装异步：assert + begin + finally end
 * （若已走 aiTaskCenter，lease 会双源去重，仍建议 begin 以便无 task 时也锁）
 */
export async function withActionScope(actionId, fn, meta) {
  var eng = getActionEngine();
  if (eng) {
    eng.assertAllowed(actionId);
    eng.beginScope(Object.assign({ ownerActionId: actionId }, meta || {}));
  }
  try {
    return await fn();
  } finally {
    if (eng) eng.endScope(actionId);
  }
}
