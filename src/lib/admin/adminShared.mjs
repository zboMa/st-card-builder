/**
 * 管理端客户端：仪表盘 / 用户 / 分享 / Token / Couch / 审计 / 系统
 */
import {
  apiFetch,
  apiUrl,
  discordLoginUrl,
  getPublicAppUrl,
} from '../publicConfig.mjs';

async function apiEmailLogin(payload) {
  var res = await apiFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: payload && payload.email,
      password: payload && payload.password,
    }),
  });
  var body = await res.json().catch(function() { return {}; });
  if (!res.ok) throw new Error(body.message || body.error || 'login_failed');
  return body;
}

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtBytes(n) {
  var v = Number(n) || 0;
  if (v < 1024) return v + ' B';
  if (v < 1024 * 1024) return (v / 1024).toFixed(1) + ' KB';
  if (v < 1024 * 1024 * 1024) return (v / (1024 * 1024)).toFixed(1) + ' MB';
  return (v / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function fmtTime(s) {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString('zh-CN', { hour12: false });
  } catch (e) {
    return String(s);
  }
}

var state = {
  role: null,
  user: null,
  view: 'dashboard',
  usersOffset: 0,
  sharesOffset: 0,
  tokensOffset: 0,
  auditOffset: 0,
  pageSize: 30,
};

async function api(path, opts) {
  var res = await apiFetch(path, opts || {});
  var ct = res.headers.get('content-type') || '';
  var data = ct.indexOf('json') >= 0
    ? await res.json().catch(function() { return {}; })
    : await res.text();
  if (!res.ok) {
    var msg = (data && data.message) || (data && data.error) || ('HTTP ' + res.status);
    var err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function setBanner(msg, kind) {
  var el = $('adminBanner');
  if (!el) return;
  if (!msg) {
    el.hidden = true;
    el.textContent = '';
    el.className = 'admin-banner';
    return;
  }
  el.hidden = false;
  el.textContent = msg;
  el.className = 'admin-banner' + (kind ? ' admin-banner--' + kind : '');
}

function setStatus(msg) {
  var el = $('adminStatus');
  if (el) el.textContent = msg || '';
}

function isOps() {
  return state.role === 'ops';
}


export { state, api, $, escapeHtml, fmtBytes, fmtTime, setBanner, setStatus, isOps, apiEmailLogin };
