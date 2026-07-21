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

export async function apiEmailRegister(payload) {
  var res = await apiFetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: payload && payload.email,
      password: payload && payload.password,
      inviteCode: payload && payload.inviteCode,
    }),
  });
  var body = await res.json().catch(function() { return {}; });
  if (!res.ok) throw new Error(body.message || body.error || 'register_failed');
  return body;
}

export async function apiEmailLogin(payload) {
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

export async function apiLogout() {
  await apiFetch('/api/auth/logout', { method: 'POST' });
}

export { discordLoginUrl, apiUrl, apiFetch };

export function discordLoginUrlForCurrentPage() {
  return discordLoginUrl(typeof location !== 'undefined' ? location.href : '');
}
