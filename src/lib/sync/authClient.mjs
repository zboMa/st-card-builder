/**
 * 账户 / 同步 UI 桥
 */
import { apiFetch, apiUrl, discordLoginUrl } from '../publicConfig.mjs';

export async function apiDevLogin(username) {
  var res = await apiFetch('/api/auth/dev-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username }),
  });
  var body = await res.json().catch(function() { return {}; });
  if (!res.ok) throw new Error(body.message || body.error || 'dev_login_failed');
  return body;
}

export async function apiLogout() {
  await apiFetch('/api/auth/logout', { method: 'POST' });
}

export { discordLoginUrl, apiUrl, apiFetch };

export function discordLoginUrlForCurrentPage() {
  return discordLoginUrl(typeof location !== 'undefined' ? location.href : '');
}
