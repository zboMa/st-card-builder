/**
 * OAuth return_to 校验（前后端语义一致；服务端权威）
 */
export function originOf(url) {
  try {
    return new URL(String(url || '')).origin;
  } catch (e) {
    return '';
  }
}

export function buildReturnToAllowlist(cfg) {
  var list = [
    cfg && cfg.publicAppUrl,
    cfg && cfg.publicAdminUrl,
    'http://localhost:4321',
    'http://127.0.0.1:4321',
    'http://localhost:4322',
    'http://127.0.0.1:4322',
  ];
  return list
    .map(function(s) { return String(s || '').replace(/\/$/, ''); })
    .filter(Boolean)
    .filter(function(s, i, arr) { return arr.indexOf(s) === i; });
}

/**
 * @param {string} raw
 * @param {string[]} allowOrigins full origins like https://card.taojiu.love
 * @returns {string|null} safe absolute URL or null
 */
export function sanitizeReturnTo(raw, allowOrigins) {
  var s = String(raw || '').trim();
  if (!s || s.length > 2048) return null;
  var u;
  try {
    u = new URL(s);
  } catch (e) {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (u.username || u.password) return null;
  var allow = (allowOrigins || []).map(function(o) { return String(o || '').replace(/\/$/, ''); });
  if (allow.indexOf(u.origin) < 0) return null;
  return u.origin + u.pathname + u.search + u.hash;
}
