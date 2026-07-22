/**
 * 小说分享 API 客户端
 */

export async function apiCreateNovelShare(payload) {
  var res = await fetch('/api/share/novels', {
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
    err.data = data;
    throw err;
  }
  return data;
}

/** 重置 token 或设置过期：body 可含 resetToken / expiresInDays / expiresAt */
export async function apiUpdateNovelShare(payload) {
  return apiCreateNovelShare(payload);
}

export async function apiFetchSharedNovel(token, version) {
  var path = '/api/share/novels/' + encodeURIComponent(token);
  if (version) path += '/versions/' + encodeURIComponent(version);
  var res = await fetch(path, {
    method: 'GET',
    credentials: 'omit',
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

export async function apiDeleteNovelShare(token) {
  var res = await fetch('/api/share/novels/' + encodeURIComponent(token), {
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

export function buildLocalShareUrl(token, version) {
  var origin = '';
  try {
    if (typeof location !== 'undefined' && location && location.origin) {
      origin = location.origin;
    }
  } catch (e) { /* ignore */ }
  var base = origin + '/#share/' + encodeURIComponent(token);
  if (version) return base + '/v/' + encodeURIComponent(version);
  return base;
}

/** @returns {{ token: string, version: string }} */
export function parseShareTokenFromHash(hash) {
  var h = String(hash || '').replace(/^#/, '');
  var m = /^share\/([^/?#]+)(?:\/v\/([^/?#]+))?/.exec(h);
  if (!m) return { token: '', version: '' };
  return {
    token: decodeURIComponent(m[1]),
    version: m[2] ? decodeURIComponent(m[2]) : '',
  };
}
