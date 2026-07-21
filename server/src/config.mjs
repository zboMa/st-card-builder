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
  /**
   * 浏览器可达的 Couch Origin/前缀（无尾斜杠）。
   * 生产例：https://card-api.taojiu.love/couch（Nginx 反代到本机 5984）
   * 留空时：若有 PUBLIC_API_URL → `{PUBLIC_API_URL}/couch`；否则回退 COUCHDB_URL（仅本机调试）。
   */
  publicCouchUrl: (function() {
    var explicit = env('PUBLIC_COUCH_URL', '').replace(/\/$/, '');
    if (explicit) return explicit;
    var api = env('PUBLIC_API_URL', '').replace(/\/$/, '');
    if (api) return api + '/couch';
    return env('COUCHDB_URL', 'http://127.0.0.1:5984').replace(/\/$/, '');
  })(),
  discord: {
    clientId: env('DISCORD_CLIENT_ID', ''),
    clientSecret: env('DISCORD_CLIENT_SECRET', ''),
    redirectUri: env('DISCORD_REDIRECT_URI', 'http://localhost:8787/api/auth/discord/callback'),
    guildId: env('DISCORD_GUILD_ID', ''),
    requiredRoleIds: splitCsv(env('DISCORD_REQUIRED_ROLE_IDS', '')),
  },
  authEnforceDiscordMembership: envBool('AUTH_ENFORCE_DISCORD_MEMBERSHIP', false),
  /** 是否在 UI 展示 Discord 登录（路由仍可用，便于运维恢复） */
  discordLoginEnabled: envBool('AUTH_DISCORD_LOGIN_ENABLED', true),
  /** 邮箱注册/登录 */
  emailAuthEnabled: envBool('AUTH_EMAIL_ENABLED', false),
  /**
   * 注册邀请码（逗号分隔）。也兼容单值 INVITE_CODE。
   * 未配置任何邀请码时拒绝注册（登录仍可用）。
   */
  inviteCodes: (function() {
    var multi = splitCsv(env('INVITE_CODES', ''));
    if (multi.length) return multi;
    var one = String(env('INVITE_CODE', '') || '').trim();
    return one ? [one] : [];
  })(),
  devLoginEnabled: envBool('DEV_LOGIN_ENABLED', true),
  /** 运维管理员（读写）：Discord 雪花 ID */
  adminDiscordIds: splitCsv(env('ADMIN_DISCORD_IDS', '')),
  /** 只读管理员：可看仪表盘/列表，不可禁用用户/停分享/吊销/备份 */
  adminReadonlyDiscordIds: splitCsv(env('ADMIN_READONLY_DISCORD_IDS', '')),
  /** 运维管理员：邮箱（小写比较） */
  adminEmails: splitCsv(env('ADMIN_EMAILS', '')).map(function(e) { return e.toLowerCase(); }),
  /** 只读管理员：邮箱 */
  adminReadonlyEmails: splitCsv(env('ADMIN_READONLY_EMAILS', '')).map(function(e) { return e.toLowerCase(); }),
  /** 管理端触发逻辑备份（跑 scripts/backup-couch.sh） */
  backupEnabled: envBool('ADMIN_BACKUP_ENABLED', false),
  backupDir: env('ADMIN_BACKUP_DIR', ''),
  /** 额外 CORS 源（逗号分隔）；SillyTavern 等跨域插件用。含 `*` 表示放行任意 Origin（credentials 下反射请求 Origin，不是字面 ACAO:*） */
  corsOrigins: splitCsv(env('CORS_ORIGINS', '')),
};

/** CORS_ORIGINS 含 `*` 时放行任意浏览器 Origin */
export function corsAllowAll() {
  return config.corsOrigins.indexOf('*') >= 0;
}

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

function normalizeAdminEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isOpsAdminEmail(email) {
  var e = normalizeAdminEmail(email);
  if (!e) return false;
  return config.adminEmails.indexOf(e) >= 0;
}

export function isAdminEmail(email) {
  var e = normalizeAdminEmail(email);
  if (!e) return false;
  return config.adminEmails.indexOf(e) >= 0
    || config.adminReadonlyEmails.indexOf(e) >= 0;
}

/**
 * @returns {'ops'|'readonly'|null}
 */
export function getAdminRole(user) {
  if (!user) return null;
  if (user.provider === 'email') {
    var email = normalizeAdminEmail(user.email);
    if (isOpsAdminEmail(email)) return 'ops';
    if (isAdminEmail(email)) return 'readonly';
    return null;
  }
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
  return base
    .concat(config.corsOrigins)
    .filter(function(o) { return o && o !== '*'; });
}

/**
 * 是否允许该浏览器 Origin 跨域（含 credentials）。
 * @param {string} [origin]
 * @param {{ allowAll?: boolean, allowlist?: string[] }} [opts] 测试可注入
 * @returns {boolean}
 */
export function isCorsOriginAllowed(origin, opts) {
  opts = opts || {};
  if (!origin) return true;
  var allowAll = opts.allowAll != null ? !!opts.allowAll : corsAllowAll();
  if (allowAll) return true;
  var list = opts.allowlist || corsAllowlist();
  if (list.indexOf(origin) >= 0) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return true;
  return false;
}
