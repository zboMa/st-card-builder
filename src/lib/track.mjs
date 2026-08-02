/**
 * 轻量行为埋点：fire-and-forget 上报 /api/data/event
 * 仅登录会话内有效（带 session cookie）；失败静默。
 */
import { apiFetch } from './publicConfig.mjs';

export function track(name, extra) {
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    var body = {
      name: String(name || '').slice(0, 80),
      extra: extra && typeof extra === 'object' ? JSON.stringify(extra).slice(0, 2000) : String(extra || '').slice(0, 2000),
    };
    apiFetch('/api/data/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(function() { /* 静默 */ });
  } catch (e) { /* 静默 */ }
}

/** 页面视图埋点（主站 boot 调用） */
export function trackPageView(pageName) {
  try {
    if (typeof document !== 'undefined' && document.hidden) return;
    track('app.view', { page: String(pageName || '').slice(0, 80) });
  } catch (e) { /* 静默 */ }
}
