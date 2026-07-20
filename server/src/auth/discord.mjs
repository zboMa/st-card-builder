/**
 * Discord OAuth helpers
 */
import { config } from '../config.mjs';

var DISCORD_API = 'https://discord.com/api/v10';

export function discordAuthUrl(state) {
  var q = new URLSearchParams({
    client_id: config.discord.clientId,
    redirect_uri: config.discord.redirectUri,
    response_type: 'code',
    scope: 'identify guilds.members.read',
    state: state || '',
  });
  return 'https://discord.com/api/oauth2/authorize?' + q.toString();
}

export async function exchangeDiscordCode(code) {
  var body = new URLSearchParams({
    client_id: config.discord.clientId,
    client_secret: config.discord.clientSecret,
    grant_type: 'authorization_code',
    code: String(code || ''),
    redirect_uri: config.discord.redirectUri,
  });
  var res = await fetch(DISCORD_API + '/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body,
  });
  if (!res.ok) {
    var t = await res.text();
    throw new Error('discord_token_failed:' + res.status + ':' + t.slice(0, 200));
  }
  return res.json();
}

export async function fetchDiscordMe(accessToken) {
  var res = await fetch(DISCORD_API + '/users/@me', {
    headers: { Authorization: 'Bearer ' + accessToken },
  });
  if (!res.ok) throw new Error('discord_me_failed:' + res.status);
  return res.json();
}

/** 当前用户在指定 Guild 的成员信息（含 roles） */
export async function fetchGuildMember(accessToken, guildId) {
  if (!guildId) return null;
  var res = await fetch(
    DISCORD_API + '/users/@me/guilds/' + encodeURIComponent(guildId) + '/member',
    { headers: { Authorization: 'Bearer ' + accessToken } }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('discord_member_failed:' + res.status);
  return res.json();
}

export function discordConfigured() {
  return !!(config.discord.clientId && config.discord.clientSecret);
}
