/**
 * 角色卡分享 API 客户端（构建器）
 */

export async function apiPublishCard(payload) {
  var res = await fetch('/api/share/cards/publish', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  var data = await res.json().catch(function() { return {}; });
  if (!res.ok) {
    var err = new Error(data.message || data.error || ('HTTP ' + res.status));
    err.status = res.status;
    err.code = data.error;
    throw err;
  }
  return data;
}

export async function apiCreateCardShare(payload) {
  var res = await fetch('/api/share/cards', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  var data = await res.json().catch(function() { return {}; });
  if (!res.ok) {
    var err = new Error(data.message || data.error || ('HTTP ' + res.status));
    err.status = res.status;
    err.code = data.error;
    throw err;
  }
  return data;
}

export async function apiDeleteCardShare(token) {
  var res = await fetch('/api/share/cards/' + encodeURIComponent(token), {
    method: 'DELETE',
    credentials: 'include',
  });
  var data = await res.json().catch(function() { return {}; });
  if (!res.ok) {
    var err = new Error(data.message || data.error || ('HTTP ' + res.status));
    err.status = res.status;
    err.code = data.error;
    throw err;
  }
  return data;
}

var SHARE_META_KEY = 'st_v3_card_share_meta';

export function loadCardShareMeta() {
  try {
    return JSON.parse(localStorage.getItem(SHARE_META_KEY) || '{}') || {};
  } catch (e) {
    return {};
  }
}

export function saveCardShareMeta(map) {
  try {
    localStorage.setItem(SHARE_META_KEY, JSON.stringify(map || {}));
  } catch (e) { /* ignore */ }
}

export function getCardShareMeta(cardId) {
  var all = loadCardShareMeta();
  return all[String(cardId)] || null;
}

export function setCardShareMeta(cardId, meta) {
  var all = loadCardShareMeta();
  all[String(cardId)] = Object.assign({}, all[String(cardId)] || {}, meta || {});
  saveCardShareMeta(all);
  return all[String(cardId)];
}

export function clearCardShareToken(cardId) {
  var all = loadCardShareMeta();
  var cur = all[String(cardId)];
  if (!cur) return;
  cur.token = '';
  cur.infoUrl = '';
  cur.pngUrl = null;
  cur.pngPublic = false;
  cur.hasPassword = false;
  all[String(cardId)] = cur;
  saveCardShareMeta(all);
}

/** 从信息链接或裸 token 解析分享 token */
export function parseCardShareToken(input) {
  var s = String(input || '').trim();
  if (!s) return '';
  var m = s.match(/\/api\/share\/cards\/([^/?#]+)/i);
  if (m) return decodeURIComponent(m[1]);
  if (/^[A-Za-z0-9_-]{10,}$/.test(s)) return s;
  return '';
}
