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
  /** Discord 雪花 ID 列表（不含 discord_ 前缀） */
  adminDiscordIds: splitCsv(env('ADMIN_DISCORD_IDS', '')),
};

/** enforce 开启且 Guild/Role 未配置 → 拒绝所有正式 Discord 注册 */
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
  // 开发：dev 用户若在白名单写了同名 id 也可（一般不配）
  if (user.provider === 'dev' && isAdminDiscordId(user.id)) return true;
  return false;
}
