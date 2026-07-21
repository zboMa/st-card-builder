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
  /** 管理端 Origin（无尾斜杠）；生产如 https://card-admin.taojiu.love */
  publicAdminUrl: env('PUBLIC_ADMIN_URL', '').replace(/\/$/, ''),
  /** 对外 API Origin（分享链接、插件、前端 OAuth 入口）；生产如 https://card-api.taojiu.love */
  publicApiUrl: env('PUBLIC_API_URL', '').replace(/\/$/, ''),
  sessionSecret: env('SESSION_SECRET', 'dev-insecure-session-secret'),
  cookieSecure: envBool('COOKIE_SECURE', false),
  /** Session Cookie Domain，如 .taojiu.love，使主站与管理端共用登录 */
  sessionCookieDomain: env('SESSION_COOKIE_DOMAIN', ''),
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
  /** 运维管理员（读写）：Discord 雪花 ID */
  adminDiscordIds: splitCsv(env('ADMIN_DISCORD_IDS', '')),
  /** 只读管理员：可看仪表盘/列表，不可禁用用户/停分享/吊销/备份 */
  adminReadonlyDiscordIds: splitCsv(env('ADMIN_READONLY_DISCORD_IDS', '')),
  /** 管理端触发逻辑备份（跑 scripts/backup-couch.sh） */
  backupEnabled: envBool('ADMIN_BACKUP_ENABLED', false),
  backupDir: env('ADMIN_BACKUP_DIR', ''),
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

function normalizeDiscordId(discordId) {
  return String(discordId || '').replace(/^discord_/, '');
}

export function isAdminDiscordId(discordId) {
  var id = normalizeDiscordId(discordId);
  if (!id) return false;
  return config.adminDiscordIds.indexOf(id) >= 0
    || config.adminReadonlyDiscordIds.indexOf(id) >= 0;
}

export function isOpsAdminDiscordId(discordId) {
  var id = normalizeDiscordId(discordId);
  if (!id) return false;
  return config.adminDiscordIds.indexOf(id) >= 0;
}

/**
 * @returns {'ops'|'readonly'|null}
 */
export function getAdminRole(user) {
  if (!user) return null;
  var id = user.provider === 'discord'
    ? user.discordId
    : (user.provider === 'dev' ? user.id : '');
  if (isOpsAdminDiscordId(id)) return 'ops';
  if (isAdminDiscordId(id)) return 'readonly';
  return null;
}

export function isAdminUser(user) {
  return getAdminRole(user) != null;
}

export function isOpsAdmin(user) {
  return getAdminRole(user) === 'ops';
}

export function corsAllowlist() {
  var base = [
    config.publicAppUrl,
    config.publicAdminUrl,
    'http://localhost:4321',
    'http://127.0.0.1:4321',
    'http://localhost:4322',
    'http://127.0.0.1:4322',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
  ];
  return base.concat(config.corsOrigins).filter(Boolean);
}
