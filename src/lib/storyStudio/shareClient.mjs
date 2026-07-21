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

export async function apiFetchSharedNovel(token) {
  var res = await fetch('/api/share/novels/' + encodeURIComponent(token), {
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

export function buildLocalShareUrl(token) {
  var origin = '';
  try {
    if (typeof location !== 'undefined' && location && location.origin) {
      origin = location.origin;
    }
  } catch (e) { /* ignore */ }
  return origin + '/#share/' + encodeURIComponent(token);
}

export function parseShareTokenFromHash(hash) {
  var h = String(hash || '').replace(/^#/, '');
  var m = /^share\/([^/?#]+)/.exec(h);
  return m ? decodeURIComponent(m[1]) : '';
}
