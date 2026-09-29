/**
 * 管理端客户端：仪表盘 / 用户 / 分享 / Token / Couch / 审计 / 系统
 */
import {
  apiFetch,
  apiUrl,
  discordLoginUrl,
  getPublicAppUrl,
} from '../publicConfig.mjs';

import { appFeedback } from '../ui/appMessage.mjs';

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
  perms: [],
  view: 'dashboard',
  usersOffset: 0,
  cardsOffset: 0,
  novelsOffset: 0,
  sharesOffset: 0,
  tokensOffset: 0,
  auditOffset: 0,
  modTab: 'flags',
  pageSize: 30,
};

function isOps() {
  return state.role === 'ops';
}

/** 是否拥有权限点（供动态按钮显隐 / disabled 用） */
function hasPerm(perm) {
  return Array.isArray(state.perms) && state.perms.indexOf(perm) >= 0;
}

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

function askReason(title, label) {
  return new Promise(function(resolve) {
    var dlg = $('adminReasonDialog');
    var form = $('adminReasonForm');
    var text = $('adminReasonText');
    var heading = $('adminReasonTitle');
    var cancel = $('adminReasonCancel');
    if (!dlg || !form || !text) {
      resolve('');
      return;
    }
    if (heading) heading.textContent = title || '填写原因';
    var lab = form.querySelector('label');
    if (lab) lab.lastChild.textContent = label || '原因';
    text.value = '';
    dlg.hidden = false;
    text.focus();
    function finish(value) {
      dlg.hidden = true;
      form.removeEventListener('submit', onSubmit);
      if (cancel) cancel.removeEventListener('click', onCancel);
      resolve(value);
    }
    function onSubmit(e) {
      e.preventDefault();
      var v = String(text.value || '').trim();
      if (!v) return;
      finish(v);
    }
    function onCancel() { finish(''); }
    form.addEventListener('submit', onSubmit);
    if (cancel) cancel.addEventListener('click', onCancel);
  });
}

function setStatus(msg) {
  var el = $('adminStatus');
  if (el) el.textContent = '';
  var text = String(msg || '').trim();
  if (!text) return;
  appFeedback(null, { message: text, level: 'info', channel: 'toast' });
}


export { state, api, $, escapeHtml, fmtBytes, fmtTime, setBanner, setStatus, isOps, hasPerm, apiEmailLogin, askReason };
