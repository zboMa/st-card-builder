/** 本地「曾登录」标记：无标记时不探测 /api/auth/status，避免离线进页弹连接失败 */
var AUTH_SESSION_HINT_KEY = 'st_v3_auth_session_hint';

export function hasAuthSessionHint() {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(AUTH_SESSION_HINT_KEY) === '1';
  } catch (e) {
    return false;
  }
}

export function setAuthSessionHint(on) {
  if (typeof localStorage === 'undefined') return;
  try {
    if (on) localStorage.setItem(AUTH_SESSION_HINT_KEY, '1');
    else localStorage.removeItem(AUTH_SESSION_HINT_KEY);
  } catch (e) { /* ignore */ }
}
