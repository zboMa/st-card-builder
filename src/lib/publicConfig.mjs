/**
 * 前端公开配置（Astro 构建时 PUBLIC_* 注入；本地开发可相对路径）
 */
function stripSlash(s) {
  return String(s || '').replace(/\/$/, '');
}

function readEnv(name) {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name] != null) {
      return String(import.meta.env[name] || '').trim();
    }
  } catch (e) { /* ignore */ }
  return '';
}

/** API Origin；空字符串表示同源相对路径（本地 Astro 代理） */
export function getPublicApiUrl() {
  return stripSlash(readEnv('PUBLIC_API_URL'));
}

export function getPublicAppUrl() {
  return stripSlash(readEnv('PUBLIC_APP_URL')) || (typeof location !== 'undefined' ? location.origin : '');
}

export function getPublicAdminUrl() {
  return stripSlash(readEnv('PUBLIC_ADMIN_URL'));
}

/** 拼绝对或相对 API 路径 */
export function apiUrl(path) {
  var p = String(path || '');
  if (!p) p = '/';
  if (p.charAt(0) !== '/') p = '/' + p;
  var base = getPublicApiUrl();
  return base ? base + p : p;
}

/**
 * Discord 登录入口：跳到 API，再由服务端 302 到 discord.com/oauth2/authorize
 * @param {string} [returnTo] 登录成功后回跳；默认当前页
 */
export function discordLoginUrl(returnTo) {
  var back = returnTo;
  if (!back && typeof location !== 'undefined') back = location.href;
  var q = new URLSearchParams();
  if (back) q.set('return_to', back);
  var qs = q.toString();
  return apiUrl('/api/auth/discord') + (qs ? ('?' + qs) : '');
}

export async function apiFetch(path, opts) {
  opts = opts || {};
  var headers = Object.assign({}, opts.headers || {});
  var init = Object.assign({ credentials: 'include' }, opts, { headers: headers });
  return fetch(apiUrl(path), init);
}
