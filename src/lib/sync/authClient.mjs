/**
 * 账户 / 同步 UI 桥
 */
export async function apiDevLogin(username) {
  var res = await fetch('/api/auth/dev-login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username }),
  });
  var body = await res.json().catch(function() { return {}; });
  if (!res.ok) throw new Error(body.message || body.error || 'dev_login_failed');
  return body;
}

export async function apiLogout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
}

export function discordLoginUrl() {
  return '/api/auth/discord';
}
