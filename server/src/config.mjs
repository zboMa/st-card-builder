/**
 * 服务端环境配置
 */
function env(name, fallback) {
  var v = process.env[name];
  if (v == null || v === '') return fallback;
  return v;
}

function envBool(name, fallback) {
  var v = process.env[name];
  if (v == null || v === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(v));
}

function splitCsv(v) {
  return String(v || '')
    .split(',')
    .map(function(s) { return s.trim(); })
    .filter(Boolean);
}

export var config = {
  port: parseInt(env('PORT', '8787'), 10) || 8787,
  publicAppUrl: env('PUBLIC_APP_URL', 'http://localhost:4321').replace(/\/$/, ''),
  /** 对外 API Origin（分享链接、插件默认）；生产如 https://card-api.taojiu.love */
  publicApiUrl: env('PUBLIC_API_URL', '').replace(/\/$/, ''),
  sessionSecret: env('SESSION_SECRET', 'dev-insecure-session-secret'),
  cookieSecure: envBool('COOKIE_SECURE', false),
  couch: {
    url: env('COUCHDB_URL', 'http://127.0.0.1:5984').replace(/\/$/, ''),
    user: env('COUCHDB_USER', 'admin'),
    password: env('COUCHDB_PASSWORD', 'adminpass'),
  },
  discord: {
    clientId: env('DISCORD_CLIENT_ID', ''),
    clientSecret: env('DISCORD_CLIENT_SECRET', ''),
    redirectUri: env('DISCORD_REDIRECT_URI', 'http://localhost:8787/api/auth/discord/callback'),
    guildId: env('DISCORD_GUILD_ID', ''),
    requiredRoleIds: splitCsv(env('DISCORD_REQUIRED_ROLE_IDS', '')),
  },
  authEnforceDiscordMembership: envBool('AUTH_ENFORCE_DISCORD_MEMBERSHIP', false),
  devLoginEnabled: envBool('DEV_LOGIN_ENABLED', true),
  adminDiscordIds: splitCsv(env('ADMIN_DISCORD_IDS', '')),
  /** 额外 CORS 源（逗号分隔）；SillyTavern 等跨域插件用 */
  corsOrigins: splitCsv(env('CORS_ORIGINS', '')),
};

export function discordMembershipConfigReady() {
  return !!(config.discord.guildId && config.discord.requiredRoleIds.length);
}

export function canAcceptDiscordRegistration() {
  if (!config.authEnforceDiscordMembership) return true;
  return discordMembershipConfigReady();
}

export function isAdminDiscordId(discordId) {
  var id = String(discordId || '').replace(/^discord_/, '');
  if (!id) return false;
  return config.adminDiscordIds.indexOf(id) >= 0;
}

export function isAdminUser(user) {
  if (!user) return false;
  if (user.provider === 'discord' && user.discordId) {
    return isAdminDiscordId(user.discordId);
  }
  if (user.provider === 'dev' && isAdminDiscordId(user.id)) return true;
  return false;
}

export function corsAllowlist() {
  var base = [
    config.publicAppUrl,
    'http://localhost:4321',
    'http://127.0.0.1:4321',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
  ];
  return base.concat(config.corsOrigins).filter(Boolean);
}
