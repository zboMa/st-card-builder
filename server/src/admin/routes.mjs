/**
 * Admin API：仪表盘 / 用户 / 分享 / Token / Couch / 审计 / 备份
 */
import { Router } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { config, isAdminUser, isOpsAdmin, getAdminRole } from '../config.mjs';
import { couchHealth } from '../couch.mjs';
import {
  listUserRegistry,
  setUserDisabled,
  listShareMappings,
  deleteShareMapping,
  setShareEnabled,
  appendAdminAudit,
  listAdminAudit,
  listAuditByUser,
  getShareMapping,
  putShareMapping,
  countUserDatabases,
  revokeUserSyncAccess,
  ensureAdminDatabase,
  listDatabaseInfos,
  analyzeUserDatabases,
} from '../couch.mjs';
import {
  listBearerTokenDocs,
  revokeBearerByDocId,
  revokeBearersForUser,
  purgeExpiredBearerTokens,
  countBearersByUserIds,
} from '../auth/bearer.mjs';
import {
  PERMS,
  ALL_PERMS,
  listRoles,
  getRole,
  putRole,
  deleteRole,
  permsForUser,
  requirePerm,
} from '../auth/roles.mjs';
import { listMenus, putMenu, deleteMenu } from './menus.mjs';
import { listCardIndex, listNovelIndex, upsertCardIndex } from '../index/aggregate.mjs';
import {
  applyCardModeration,
  hardDeleteCard,
  exportCard,
  cardDetail,
  applyNovelModeration,
  hardDeleteNovel,
  userOverview,
} from './content.mjs';
import {
  createFlag,
  listFlags,
  resolveFlag,
  createApproval,
  listApprovals,
  decideApproval,
} from './moderation.mjs';
import { opLogMiddleware, listOpLog, listLoginLog } from '../audit/oplog.mjs';
import { PARAM_WHITELIST, listParams, setParam, deleteParam } from '../sysparams.mjs';
import { listDicts, putDict, deleteDict, listFiles, uploadFile, readFile, deleteFile, recordAdminFile, generateInvite, listInvites, revokeInvite } from './system.mjs';
import { listTasks, setTaskEnabled, runTaskById, seedTasks } from '../scheduler.mjs';
import { capMeta, LIST_HARD_CAP, INDEX_SCAN_CAP, exceededLabels } from './deskLogic.mjs';
import { runBackup, listBackupRuns } from '../backup.mjs';
import { getQuotaSnapshot, resolveUserTier } from '../quota/quotaService.mjs';
import { QUOTA_TIERS, tierLabel } from '../quota/quotaPolicy.mjs';
import { dailyTrends } from '../events.mjs';
import { hashAccountPassword, assertPasswordShape } from '../auth/password.mjs';
import { emailAuthLookupDocId } from '../auth/emailAuth.mjs';
import { getUserRegistry } from '../couch.mjs';

export var adminRouter = Router();

var __dirname = path.dirname(fileURLToPath(import.meta.url));
var SERVER_ROOT = path.resolve(__dirname, '../..');
var REPO_ROOT = path.resolve(SERVER_ROOT, '..');

function requireAdmin(req, res, next) {
  var user = req.session && req.session.user;
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isAdminUser(user)) return res.status(403).json({ error: 'forbidden', message: '非管理员' });
  req.adminRole = getAdminRole(user);
  next();
}

function requireOps(req, res, next) {
  if (!isOpsAdmin(req.session && req.session.user)) {
    return res.status(403).json({ error: 'readonly', message: '只读管理员无写权限' });
  }
  next();
}

function needReason(req, res) {
  var reason = String((req.body || {}).reason || '').trim();
  if (!reason) {
    res.status(400).json({ error: 'reason_required', message: '请填写原因' });
    return '';
  }
  return reason;
}

function paginate(list, req) {
  var limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
  var offset = Math.max(0, parseInt(String(req.query.offset || '0'), 10) || 0);
  var total = list.length;
  return {
    items: list.slice(offset, offset + limit),
    total: total,
    limit: limit,
    offset: offset,
  };
}

adminRouter.use(requireAdmin);
adminRouter.use(opLogMiddleware);

adminRouter.get('/me', async function(req, res) {
  var perms = [];
  try { perms = await permsForUser(req.session.user); } catch (e) { /* ignore */ }
  res.json({
    ok: true,
    user: req.session.user,
    isAdmin: true,
    adminRole: req.adminRole,
    perms: perms,
  });
});

adminRouter.get('/perms', function(req, res) {
  res.json({ ok: true, perms: ALL_PERMS });
});

adminRouter.get('/roles', async function(req, res) {
  try {
    var roles = await listRoles();
    res.json({ ok: true, roles: roles });
  } catch (e) {
    res.status(500).json({ error: 'roles_failed', message: String(e && e.message || e) });
  }
});

adminRouter.get('/roles/:id', async function(req, res) {
  try {
    var role = await getRole(String(req.params.id || '').trim());
    if (!role) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true, role: role });
  } catch (e) {
    res.status(500).json({ error: 'role_failed', message: String(e && e.message || e) });
  }
});

adminRouter.put('/roles/:id', requirePerm(PERMS.roleManage), async function(req, res) {
  try {
    var role = await putRole(Object.assign({}, req.body || {}, { id: String(req.params.id || '').trim() }));
    res.json({ ok: true, role: role });
  } catch (e) {
    res.status(500).json({ error: 'role_save_failed', message: String(e && e.message || e) });
  }
});

adminRouter.delete('/roles/:id', requirePerm(PERMS.roleManage), async function(req, res) {
  try {
    var out = await deleteRole(String(req.params.id || '').trim());
    res.json({ ok: true, deleted: out.ok });
  } catch (e) {
    var status = e && e.code === 'builtin_role' ? 400 : 500;
    res.status(status).json({ error: e && e.code || 'role_delete_failed', message: String(e && e.message || e) });
  }
});

adminRouter.get('/menus', async function(req, res) {
  try {
    var menus = await listMenus();
    res.json({ ok: true, menus: menus });
  } catch (e) {
    res.status(500).json({ error: 'menus_failed', message: String(e && e.message || e) });
  }
});

adminRouter.put('/menus/:id', requirePerm(PERMS.menuManage), async function(req, res) {
  try {
    var menu = await putMenu(Object.assign({}, req.body || {}, { id: String(req.params.id || '').trim() }));
    res.json({ ok: true, menu: menu });
  } catch (e) {
    res.status(500).json({ error: 'menu_save_failed', message: String(e && e.message || e) });
  }
});

adminRouter.delete('/menus/:id', requirePerm(PERMS.menuManage), async function(req, res) {
  try {
    var out = await deleteMenu(String(req.params.id || '').trim());
    res.json({ ok: true, deleted: out.ok });
  } catch (e) {
    res.status(500).json({ error: 'menu_delete_failed', message: String(e && e.message || e) });
  }
});

adminRouter.get('/overview', async function(req, res) {
  try {
    await ensureAdminDatabase();
    var couch = await couchHealth();
    var users = await listUserRegistry(2000);
    var shares = await listShareMappings(2000);
    var tokens = await listBearerTokenDocs(2000);
    var disabled = users.filter(function(u) { return u && u.disabled; }).length;
    var activeShares = shares.filter(function(s) { return s && s.enabled !== false; }).length;
    var cardShares = shares.filter(function(s) { return s && s.type === 'card-share'; }).length;
    var novelShares = shares.filter(function(s) { return s && s.type === 'novel-share'; }).length;
    var activeTokens = tokens.filter(function(t) { return t && !t.expired; }).length;
    var userDbCount = await countUserDatabases();
    var dbAnalysis = null;
    try { dbAnalysis = await analyzeUserDatabases(); } catch (e) { /* ignore */ }
    res.json({
      ok: true,
      couch: couch,
      counts: {
        registryUsers: users.length,
        disabledUsers: disabled,
        shareMappings: shares.length,
        activeShares: activeShares,
        cardShares: cardShares,
        novelShares: novelShares,
        userDatabases: userDbCount,
        bearerTokens: tokens.length,
        activeBearerTokens: activeTokens,
        orphanUserDbs: dbAnalysis ? (dbAnalysis.orphans || []).length : null,
      },
      flags: {
        devLoginEnabled: config.devLoginEnabled,
        enforceMembership: config.authEnforceDiscordMembership,
        adminIdsConfigured: config.adminDiscordIds.length,
        readonlyAdminIdsConfigured: config.adminReadonlyDiscordIds.length,
        cookieSecure: config.cookieSecure,
        backupEnabled: config.backupEnabled,
        publicAppUrl: config.publicAppUrl,
        publicApiUrl: config.publicApiUrl || null,
      },
      adminRole: req.adminRole,
    });
  } catch (e) {
    console.error('[admin/overview]', e);
    res.status(500).json({ error: 'overview_failed', message: String(e && e.message || e) });
  }
});

adminRouter.get('/users', async function(req, res) {
  try {
    var q = String(req.query.q || '').trim().toLowerCase();
    var status = String(req.query.status || 'all');
    var rawUsers = await listUserRegistry(LIST_HARD_CAP);
    var userCap = capMeta(rawUsers.length, LIST_HARD_CAP);
    var users = rawUsers;
    if (q) {
      users = users.filter(function(u) {
        var blob = [u.userId, u.username, u.displayName, u.discordId, u.email, u.provider].join(' ').toLowerCase();
        return blob.indexOf(q) >= 0;
      });
    }
    if (status === 'disabled') users = users.filter(function(u) { return !!u.disabled; });
    if (status === 'active') users = users.filter(function(u) { return !u.disabled; });
    users.sort(function(a, b) {
      return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''));
    });
    var page = paginate(users, req);
    var counts = await countBearersByUserIds(page.items.map(function(u) { return u.userId; }));
    page.items = page.items.map(function(u) {
      var email = String(u.email || '').toLowerCase();
      var discordId = String(u.discordId || '');
      var isOps = !!(discordId && config.adminDiscordIds.indexOf(discordId) >= 0)
        || !!(email && config.adminEmails.indexOf(email) >= 0);
      var isRo = !!(discordId && config.adminReadonlyDiscordIds.indexOf(discordId) >= 0)
        || !!(email && config.adminReadonlyEmails.indexOf(email) >= 0);
      return Object.assign({}, u, {
        bearerCount: counts[u.userId] || 0,
        isOpsAdmin: isOps,
        isReadonlyAdmin: isRo && !isOps,
      });
    });
    var idx = await listCardIndex({ limit: INDEX_SCAN_CAP, offset: 0 });
    var cardCount = {};
    (idx.items || []).forEach(function(c) {
      if (!c || !c.userId) return;
      cardCount[c.userId] = (cardCount[c.userId] || 0) + 1;
    });
    page.items = page.items.map(function(u) {
      return Object.assign({}, u, { cardCount: cardCount[u.userId] || 0 });
    });
    res.json({
      ok: true,
      users: page.items,
      total: page.total,
      limit: page.limit,
      offset: page.offset,
      capped: userCap.capped,
      listedCap: userCap.listedCap,
    });
  } catch (e) {
    res.status(500).json({ error: 'users_failed', message: String(e && e.message || e) });
  }
});

adminRouter.post('/users/:userId/disable', requirePerm(PERMS.userDisable), async function(req, res) {
  try {
    var userId = String(req.params.userId || '').trim();
    var disabled = !(req.body && req.body.disabled === false);
    var reason = '';
    if (disabled) {
      reason = needReason(req, res);
      if (!reason) return;
    }
    await setUserDisabled(userId, disabled, req.session.user.id);
    var tokenRevoke = null;
    if (disabled) {
      try { await revokeUserSyncAccess(userId); } catch (e) { /* ignore */ }
      tokenRevoke = await revokeBearersForUser(userId);
    }
    await appendAdminAudit({
      action: disabled ? 'user.disable' : 'user.enable',
      targetUserId: userId,
      by: req.session.user.id,
      reason: reason,
    });
    res.json({
      ok: true,
      userId: userId,
      disabled: disabled,
      tokensRevoked: tokenRevoke ? tokenRevoke.revoked : 0,
      message: disabled ? '已禁用。下一次登录和同步会被拒绝；已经打开的主站要到下一次请求才失败。' : '已启用',
    });
  } catch (e) {
    res.status(500).json({ error: 'disable_failed', message: String(e && e.message || e) });
  }
});

adminRouter.get('/shares', async function(req, res) {
  try {
    var type = String(req.query.type || 'all');
    var status = String(req.query.status || 'all');
    var q = String(req.query.q || '').trim().toLowerCase();
    var shareRaw = await listShareMappings(LIST_HARD_CAP);
    var shareCap = capMeta(shareRaw.length, LIST_HARD_CAP);
    var shares = shareRaw;
    if (type === 'card-share' || type === 'novel-share') {
      shares = shares.filter(function(s) { return s && s.type === type; });
    }
    if (status === 'active') shares = shares.filter(function(s) { return s && s.enabled !== false; });
    if (status === 'disabled') shares = shares.filter(function(s) { return s && s.enabled === false; });
    if (status === 'expired') {
      shares = shares.filter(function(s) {
        if (!s || !s.expiresAt) return false;
        var t = Date.parse(s.expiresAt);
        return Number.isFinite(t) && Date.now() > t;
      });
    }
    if (q) {
      shares = shares.filter(function(s) {
        var blob = [
          s.token, s.ownerUserId, s.titleHint, s.cardId, s.novelId,
          s.displayVersionHint, s.characterVersionHint,
        ].join(' ').toLowerCase();
        return blob.indexOf(q) >= 0;
      });
    }
    shares.sort(function(a, b) {
      return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''));
    });
    var page = paginate(shares, req);
    var items = page.items.map(function(s) {
      var expired = false;
      if (s.expiresAt) {
        var t = Date.parse(s.expiresAt);
        expired = Number.isFinite(t) && Date.now() > t;
      }
      return {
        token: s.token,
        type: s.type || 'share',
        enabled: s.enabled !== false,
        expired: expired,
        ownerUserId: s.ownerUserId || '',
        cardId: s.cardId || '',
        novelId: s.novelId || '',
        titleHint: s.titleHint || '',
        displayVersionHint: s.displayVersionHint || '',
        characterVersionHint: s.characterVersionHint || '',
        pngPublic: !!s.pngPublic,
        hasPassword: !!s.passwordHash,
        expiresAt: s.expiresAt || null,
        createdAt: s.createdAt || null,
        updatedAt: s.updatedAt || null,
      };
    });
    res.json({
      ok: true,
      shares: items,
      total: page.total,
      limit: page.limit,
      offset: page.offset,
      capped: shareCap.capped,
      listedCap: shareCap.listedCap,
    });
  } catch (e) {
    res.status(500).json({ error: 'shares_failed', message: String(e && e.message || e) });
  }
});

/** 软停用 / 重新启用 */
adminRouter.post('/shares/:token/enabled', requirePerm(PERMS.shareToggle), async function(req, res) {
  try {
    var token = String(req.params.token || '').trim();
    var enabled = !!(req.body && req.body.enabled);
    var reason = '';
    if (!enabled) {
      reason = needReason(req, res);
      if (!reason) return;
    }
    var before = await getShareMapping(token);
    var mapping = await setShareEnabled(token, enabled);
    await appendAdminAudit({
      action: enabled ? 'share.enable' : 'share.disable',
      token: token,
      targetUserId: before && before.ownerUserId,
      targetCardId: before && before.cardId,
      by: req.session.user.id,
      reason: reason,
    });
    res.json({ ok: true, token: token, enabled: mapping.enabled !== false });
  } catch (e) {
    var status = e && e.statusCode === 404 ? 404 : 500;
    res.status(status).json({ error: 'share_toggle_failed', message: String(e && e.message || e) });
  }
});

/** 硬删除映射 */
adminRouter.delete('/shares/:token', requirePerm(PERMS.shareDelete), async function(req, res) {
  try {
    var token = String(req.params.token || '').trim();
    var reason = needReason(req, res);
    if (!reason) return;
    var before = await getShareMapping(token);
    await deleteShareMapping(token);
    await appendAdminAudit({
      action: 'share.force_delete',
      token: token,
      targetUserId: before && before.ownerUserId,
      targetCardId: before && before.cardId,
      by: req.session.user.id,
      reason: reason,
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'share_delete_failed', message: String(e && e.message || e) });
  }
});

adminRouter.get('/tokens', async function(req, res) {
  try {
    var status = String(req.query.status || 'all');
    var q = String(req.query.q || '').trim().toLowerCase();
    var tokenRaw = await listBearerTokenDocs(LIST_HARD_CAP);
    var tokenCap = capMeta(tokenRaw.length, LIST_HARD_CAP);
    var tokens = tokenRaw;
    if (status === 'active') tokens = tokens.filter(function(t) { return !t.expired; });
    if (status === 'expired') tokens = tokens.filter(function(t) { return t.expired; });
    if (q) {
      tokens = tokens.filter(function(t) {
        var blob = [t.userId, t.username, t.displayName, t.discordId, t.id].join(' ').toLowerCase();
        return blob.indexOf(q) >= 0;
      });
    }
    tokens.sort(function(a, b) {
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
    var page = paginate(tokens, req);
    res.json({
      ok: true,
      tokens: page.items,
      total: page.total,
      limit: page.limit,
      offset: page.offset,
      capped: tokenCap.capped,
      listedCap: tokenCap.listedCap,
    });
  } catch (e) {
    res.status(500).json({ error: 'tokens_failed', message: String(e && e.message || e) });
  }
});

adminRouter.delete('/tokens/:id', requirePerm(PERMS.tokenRevoke), async function(req, res) {
  try {
    var id = decodeURIComponent(String(req.params.id || '').trim());
    if (id.indexOf('bearer/') !== 0) id = 'bearer/' + id;
    await revokeBearerByDocId(id);
    await appendAdminAudit({
      action: 'token.revoke',
      tokenId: id,
      by: req.session.user.id,
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'token_revoke_failed', message: String(e && e.message || e) });
  }
});

adminRouter.post('/tokens/purge-expired', requirePerm(PERMS.tokenPurge), async function(req, res) {
  try {
    var result = await purgeExpiredBearerTokens();
    await appendAdminAudit({
      action: 'token.purge_expired',
      purged: result.purged,
      by: req.session.user.id,
    });
    res.json({ ok: true, purged: result.purged });
  } catch (e) {
    res.status(500).json({ error: 'purge_failed', message: String(e && e.message || e) });
  }
});

adminRouter.get('/databases', async function(req, res) {
  try {
    var dbs = await listDatabaseInfos();
    var analysis = await analyzeUserDatabases();
    res.json({ ok: true, databases: dbs, analysis: analysis });
  } catch (e) {
    res.status(500).json({ error: 'databases_failed', message: String(e && e.message || e) });
  }
});

adminRouter.get('/audit', async function(req, res) {
  try {
    var action = String(req.query.action || '').trim();
    var by = String(req.query.by || '').trim().toLowerCase();
    var targetUserId = String(req.query.targetUserId || '').trim();
    var rows = targetUserId
      ? await listAuditByUser(targetUserId, 200)
      : await listAdminAudit(LIST_HARD_CAP);
    var cap = capMeta(targetUserId ? rows.length : rows.length, targetUserId ? 200 : LIST_HARD_CAP);
    if (action) rows = rows.filter(function(r) { return r && r.action === action; });
    if (by) {
      rows = rows.filter(function(r) {
        return String(r && r.by || '').toLowerCase().indexOf(by) >= 0;
      });
    }
    var page = paginate(rows, req);
    res.json({
      ok: true,
      audit: page.items,
      total: page.total,
      limit: page.limit,
      offset: page.offset,
      capped: !targetUserId && cap.capped,
      listedCap: cap.listedCap,
    });
  } catch (e) {
    res.status(500).json({ error: 'audit_failed', message: String(e && e.message || e) });
  }
});

adminRouter.get('/audit/export', async function(req, res) {
  try {
    var action = String(req.query.action || '').trim();
    var by = String(req.query.by || '').trim().toLowerCase();
    var targetUserId = String(req.query.targetUserId || '').trim();
    var rows = targetUserId ? await listAuditByUser(targetUserId, 200) : await listAdminAudit(LIST_HARD_CAP);
    if (action) rows = rows.filter(function(r) { return r && r.action === action; });
    if (by) rows = rows.filter(function(r) { return String(r && r.by || '').toLowerCase().indexOf(by) >= 0; });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="admin-audit.json"');
    res.send(JSON.stringify({ exportedAt: new Date().toISOString(), audit: rows }, null, 2));
  } catch (e) {
    res.status(500).json({ error: 'audit_export_failed', message: String(e && e.message || e) });
  }
});

adminRouter.post('/backup', requirePerm(PERMS.backupRun), async function(req, res) {
  try {
    var out = await runBackup(req.session.user.id);
    res.json(out);
  } catch (e) {
    var status = e && e.message === 'backup_disabled' ? 403 : 500;
    res.status(status).json({ error: e && e.message === 'backup_disabled' ? 'backup_disabled' : 'backup_failed', message: String(e && e.message || e) });
  }
});

adminRouter.get('/backups', async function(req, res) {
  try {
    var runs = await listBackupRuns();
    res.json({ ok: true, backups: runs });
  } catch (e) {
    res.status(500).json({ error: 'backups_failed', message: String(e && e.message || e) });
  }
});

/** 邀请码管理 */
adminRouter.post('/invites', requirePerm(PERMS.inviteManage), async function(req, res) {
  try {
    var codes = await generateInvite(Object.assign({}, req.body || {}, { by: req.session.user.id }));
    res.json({ ok: true, codes: codes.map(function(c) { return c.code; }) });
  } catch (e) {
    res.status(500).json({ error: 'invite_generate_failed', message: String(e && e.message || e) });
  }
});

adminRouter.get('/invites', async function(req, res) {
  try {
    var invites = await listInvites();
    res.json({ ok: true, invites: invites });
  } catch (e) {
    res.status(500).json({ error: 'invites_failed', message: String(e && e.message || e) });
  }
});

adminRouter.post('/invites/:code/revoke', requirePerm(PERMS.inviteManage), async function(req, res) {
  try {
    var inv = await revokeInvite(String(req.params.code || ''));
    res.json({ ok: true, invite: inv });
  } catch (e) {
    var status = e && e.statusCode === 404 ? 404 : 500;
    res.status(status).json({ error: 'invite_revoke_failed', message: String(e && e.message || e) });
  }
});

/** 系统监控：服务器资源 + Couch 健康 */
adminRouter.get('/system-status', async function(req, res) {
  try {
    var os = await import('node:os');
    var mem = os.totalmem();
    res.json({
      ok: true,
      status: {
        uptimeSec: Math.round(process.uptime()),
        node: process.version,
        cpus: os.cpus().length,
        loadavg: os.loadavg(),
        totalMem: mem,
        freeMem: os.freemem(),
        memUsedPct: mem ? Math.round((mem - os.freemem()) / mem * 100) : 0,
        platform: process.platform,
        couch: await couchHealth(),
      },
    });
  } catch (e) {
    res.status(500).json({ error: 'system_status_failed', message: String(e && e.message || e) });
  }
});

/** 配额概览：与主站同步中心同一份快照。一次拉分享和 Token，避免按人重复扫全表。 */
adminRouter.get('/quota/users', async function(req, res) {
  try {
    var tierQ = String(req.query.tier || 'all');
    var overOnly = String(req.query.over || '') === '1';
    var raw = await listUserRegistry(LIST_HARD_CAP);
    var userCap = capMeta(raw.length, LIST_HARD_CAP);
    var shares = await listShareMappings(LIST_HARD_CAP);
    var now = Date.now();
    var shareCount = {};
    (shares || []).forEach(function(m) {
      if (!m || m.enabled === false) return;
      if (m.expiresAt && Date.parse(m.expiresAt) < now) return;
      var uid = String(m.ownerUserId || '');
      shareCount[uid] = (shareCount[uid] || 0) + 1;
    });
    var tokens = await listBearerTokenDocs(LIST_HARD_CAP);
    var tokenCount = {};
    (tokens || []).forEach(function(t) {
      if (!t || t.expired) return;
      tokenCount[t.userId] = (tokenCount[t.userId] || 0) + 1;
    });
    var rows = [];
    for (var i = 0; i < raw.length; i++) {
      var u = raw[i];
      var snap = await getQuotaSnapshot({
        id: u.userId,
        email: u.email,
        discordId: u.discordId,
        provider: u.provider || (u.email ? 'email' : 'discord'),
      }, {
        activeShares: shareCount[u.userId] || 0,
        bearerTokens: tokenCount[u.userId] || 0,
      });
      var exceeded = exceededLabels(snap.usage, snap.limits);
      if (tierQ !== 'all' && snap.tier !== tierQ) continue;
      if (overOnly && !exceeded.length) continue;
      rows.push({
        userId: u.userId,
        displayName: u.displayName || u.username || u.email || u.userId,
        tier: snap.tier,
        tierLabel: snap.tierLabel,
        usage: snap.usage,
        limits: snap.limits,
        exceeded: exceeded,
        tierLocked: !!(snap.tier === 'admin' && getAdminRole({
          provider: u.provider || (u.email ? 'email' : 'discord'),
          email: u.email,
          discordId: u.discordId,
          id: u.userId,
        })),
      });
    }
    var page = paginate(rows, req);
    res.json({
      ok: true,
      users: page.items,
      total: page.total,
      capped: userCap.capped,
      listedCap: userCap.listedCap,
      limit: page.limit,
      offset: page.offset,
    });
  } catch (e) {
    res.status(500).json({ error: 'quota_users_failed', message: String(e && e.message || e) });
  }
});

adminRouter.post('/users/:userId/quota', requirePerm(PERMS.quotaManage), async function(req, res) {
  try {
    var userId = String(req.params.userId || '').trim();
    var tier = String((req.body || {}).tier || '');
    if (tier !== QUOTA_TIERS.REGISTERED && tier !== QUOTA_TIERS.MEMBER && tier !== QUOTA_TIERS.ADMIN) {
      return res.status(400).json({ error: 'bad_tier', message: '档位只能是 registered、member、admin' });
    }
    var reg = await getUserRegistry(userId);
    if (!reg) return res.status(404).json({ error: 'not_found' });
    var locked = getAdminRole({
      provider: reg.provider || (reg.email ? 'email' : 'discord'),
      email: reg.email,
      discordId: reg.discordId,
      id: userId,
    });
    if (locked) {
      return res.status(409).json({
        error: 'tier_locked',
        message: '这个账号在环境变量管理员名单里，配额固定为管理员档，改档不会生效。',
      });
    }
    reg.quotaTier = tier;
    reg.updatedAt = new Date().toISOString();
    var db = await ensureAdminDatabase();
    await db.insert(reg);
    var snap = await getQuotaSnapshot({ id: userId, email: reg.email, provider: reg.provider || 'email' });
    await appendAdminAudit({
      action: 'user.quota',
      targetUserId: userId,
      by: req.session.user.id,
      reason: tier,
    });
    res.json({ ok: true, tier: snap.tier, usage: snap.usage, limits: snap.limits });
  } catch (e) {
    res.status(500).json({ error: 'quota_set_failed', message: String(e && e.message || e) });
  }
});

adminRouter.post('/users/:userId/roles', requirePerm(PERMS.userManage), async function(req, res) {
  try {
    var userId = String(req.params.userId || '').trim();
    var roles = Array.isArray((req.body || {}).roles) ? req.body.roles.map(function(r) { return String(r); }) : [];
    var reg = await getUserRegistry(userId);
    if (!reg) return res.status(404).json({ error: 'not_found' });
    reg.roles = roles;
    reg.updatedAt = new Date().toISOString();
    var db = await ensureAdminDatabase();
    await db.insert(reg);
    await appendAdminAudit({
      action: 'user.roles',
      targetUserId: userId,
      by: req.session.user.id,
      reason: roles.join(','),
    });
    res.json({ ok: true, roles: roles });
  } catch (e) {
    res.status(500).json({ error: 'roles_set_failed', message: String(e && e.message || e) });
  }
});

adminRouter.get('/tasks', async function(req, res) {
  try {
    await seedTasks();
    var tasks = await listTasks();
    res.json({ ok: true, tasks: tasks, handlers: ['index.rebuild', 'token.purge', 'backup.periodic'] });
  } catch (e) {
    res.status(500).json({ error: 'tasks_failed', message: String(e && e.message || e) });
  }
});

adminRouter.post('/tasks/:id/enabled', requirePerm(PERMS.taskManage), async function(req, res) {
  try {
    var doc = await setTaskEnabled(req.params.id, !!((req.body || {}).enabled));
    res.json({ ok: true, task: doc });
  } catch (e) {
    var status = e && e.statusCode === 404 ? 404 : 500;
    res.status(status).json({ error: 'task_toggle_failed', message: String(e && e.message || e) });
  }
});

adminRouter.post('/tasks/:id/run', requirePerm(PERMS.taskTrigger), async function(req, res) {
  try {
    var result = await runTaskById(req.params.id);
    res.json({ ok: true, run: result });
  } catch (e) {
    var status = e && e.statusCode === 404 ? 404 : 500;
    res.status(status).json({ error: 'task_run_failed', message: String(e && e.message || e) });
  }
});

adminRouter.post('/shares/:token/clear-password', requirePerm(PERMS.shareToggle), async function(req, res) {
  try {
    var token = String(req.params.token || '').trim();
    var mapping = await getShareMapping(token);
    if (!mapping) return res.status(404).json({ error: 'not_found' });
    mapping.passwordHash = null;
    mapping.updatedAt = new Date().toISOString();
    await putShareMapping(mapping);
    await appendAdminAudit({
      action: 'share.clear_password',
      token: token,
      targetUserId: mapping.ownerUserId,
      by: req.session.user.id,
    });
    res.json({ ok: true, hasPassword: false });
  } catch (e) {
    res.status(500).json({ error: 'clear_password_failed', message: String(e && e.message || e) });
  }
});

/** 趋势报表：按日事件 / 注册 / 新卡 */
adminRouter.get('/reports/trends', async function(req, res) {
  try {
    var trends = await dailyTrends(Number(req.query.days) || 30);
    res.json({ ok: true, trends: trends });
  } catch (e) {
    res.status(500).json({ error: 'trends_failed', message: String(e && e.message || e) });
  }
});

function matchText(blob, q) {
  if (!q) return true;
  return String(blob || '').toLowerCase().indexOf(q) >= 0;
}

/** 卡列表：索引驱动 + 内存筛选 */
adminRouter.get('/cards', async function(req, res) {
  try {
    var q = String(req.query.q || '').trim().toLowerCase();
    var nsfw = String(req.query.nsfw || 'all');
    var status = String(req.query.status || 'all');
    var userId = String(req.query.userId || '').trim();
    var scanned = await listCardIndex({
      userId: userId || null,
      limit: INDEX_SCAN_CAP,
      offset: 0,
    });
    var cardCap = capMeta((scanned.items || []).length, INDEX_SCAN_CAP);
    var items = (scanned.items || []).filter(function(c) {
      if (!matchText(c.charName + ' ' + c.cardId + ' ' + c.userId, q)) return false;
      if (nsfw === 'yes' && !c.nsfw) return false;
      if (nsfw === 'no' && c.nsfw) return false;
      if (status === 'removed' && !(c.moderated && c.moderated.status === 'removed')) return false;
      if (status === 'active' && c.moderated && c.moderated.status === 'removed') return false;
      return true;
    });
    var page = paginate(items, req);
    res.json({
      ok: true,
      cards: page.items,
      total: page.total,
      limit: page.limit,
      offset: page.offset,
      capped: cardCap.capped,
      listedCap: cardCap.listedCap,
    });
  } catch (e) {
    res.status(500).json({ error: 'cards_failed', message: String(e && e.message || e) });
  }
});

/** 卡详情 */
adminRouter.get('/cards/:userId/:cardId', async function(req, res) {
  try {
    var detail = await cardDetail(req.params.userId, req.params.cardId);
    if (!detail) return res.status(404).json({ error: 'not_found' });
    var shares = await listShareMappings(LIST_HARD_CAP);
    detail.shares = (shares || []).filter(function(s) {
      return s && s.ownerUserId === req.params.userId && s.cardId === req.params.cardId && !s.novelId;
    }).map(function(s) {
      return {
        token: s.token,
        type: s.type,
        enabled: s.enabled !== false,
        expired: !!(s.expiresAt && Date.parse(s.expiresAt) < Date.now()),
        expiresAt: s.expiresAt || null,
        hasPassword: !!s.passwordHash,
        pngPublic: !!s.pngPublic,
      };
    });
    var approvals = await listApprovals('pending');
    detail.pendingDelete = (approvals || []).some(function(a) {
      return a && a.action === 'delete-card' && a.target && a.target.userId === req.params.userId && a.target.cardId === req.params.cardId;
    });
    detail.audit = (await listAuditByUser(req.params.userId, 40)).filter(function(r) {
      return r && r.targetCardId === req.params.cardId;
    });
    res.json({ ok: true, detail: detail });
  } catch (e) {
    res.status(500).json({ error: 'card_failed', message: String(e && e.message || e) });
  }
});

/** 卡导出 */
adminRouter.get('/cards/:userId/:cardId/export', requirePerm(PERMS.cardExport), async function(req, res) {
  try {
    var out = await exportCard(req.params.userId, req.params.cardId);
    if (!out) return res.status(404).json({ error: 'not_found' });
    try {
      await recordAdminFile({
        name: (out.charName || req.params.cardId) + '.json',
        source: 'export',
        by: req.session.user.id,
        contentType: 'application/json',
        text: JSON.stringify(out),
      });
    } catch (eFile) { /* 导出本身已成功 */ }
    res.json({ ok: true, card: out });
  } catch (e) {
    res.status(500).json({ error: 'card_export_failed', message: String(e && e.message || e) });
  }
});

/** 卡下架（软） */
adminRouter.post('/cards/:userId/:cardId/reindex', requirePerm(PERMS.cardRead), async function(req, res) {
  try {
    await upsertCardIndex(req.params.userId, req.params.cardId);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'reindex_failed', message: String(e && e.message || e) });
  }
});

adminRouter.post('/cards/:userId/:cardId/disable', requirePerm(PERMS.cardDisable), async function(req, res) {
  try {
    var reason = needReason(req, res);
    if (!reason) return;
    var out = await applyCardModeration(req.params.userId, req.params.cardId, {
      status: 'removed',
      by: req.session.user.id,
      reason: reason,
    });
    res.json(out);
  } catch (e) {
    var status = e && e.statusCode === 404 ? 404 : 500;
    res.status(status).json({ error: 'card_disable_failed', message: String(e && e.message || e) });
  }
});

/** 卡恢复 */
adminRouter.post('/cards/:userId/:cardId/restore', requirePerm(PERMS.cardDisable), async function(req, res) {
  try {
    var out = await applyCardModeration(req.params.userId, req.params.cardId, { by: req.session.user.id });
    res.json(out);
  } catch (e) {
    var status2 = e && e.statusCode === 404 ? 404 : 500;
    res.status(status2).json({ error: 'card_restore_failed', message: String(e && e.message || e) });
  }
});

/** 卡硬删除（危险：改走审批流，需 moderation.approve 审批通过后执行） */
adminRouter.delete('/cards/:userId/:cardId', requirePerm(PERMS.cardDelete), async function(req, res) {
  try {
    var reason = needReason(req, res);
    if (!reason) return;
    var approval = await createApproval({
      action: 'delete-card',
      target: { userId: req.params.userId, cardId: req.params.cardId },
      reason: reason,
      by: req.session.user.id,
    });
    res.json({ ok: true, pending: true, approval: approval });
  } catch (e) {
    res.status(500).json({ error: 'card_approval_failed', message: String(e && e.message || e) });
  }
});

/** 小说列表：索引驱动 */
adminRouter.get('/novels', async function(req, res) {
  try {
    var q = String(req.query.q || '').trim().toLowerCase();
    var status = String(req.query.status || 'all');
    var userId = String(req.query.userId || '').trim();
    var scanned = await listNovelIndex({
      userId: userId || null,
      limit: INDEX_SCAN_CAP,
      offset: 0,
    });
    var novelCap = capMeta((scanned.items || []).length, INDEX_SCAN_CAP);
    var items = (scanned.items || []).filter(function(n) {
      if (!matchText(n.title + ' ' + n.novelId + ' ' + n.cardId + ' ' + n.userId, q)) return false;
      if (status === 'removed' && !(n.moderated && n.moderated.status === 'removed')) return false;
      if (status === 'active' && n.moderated && n.moderated.status === 'removed') return false;
      return true;
    });
    var page = paginate(items, req);
    res.json({
      ok: true,
      novels: page.items,
      total: page.total,
      limit: page.limit,
      offset: page.offset,
      capped: novelCap.capped,
      listedCap: novelCap.listedCap,
    });
  } catch (e) {
    res.status(500).json({ error: 'novels_failed', message: String(e && e.message || e) });
  }
});

/** 小说处置：下架 / 恢复 / 删除 */
adminRouter.post('/novels/:userId/:cardId/:novelId/disable', requirePerm(PERMS.novelDisable), async function(req, res) {
  try {
    var reason = needReason(req, res);
    if (!reason) return;
    var out = await applyNovelModeration(req.params.userId, req.params.cardId, req.params.novelId, {
      status: 'removed',
      by: req.session.user.id,
      reason: reason,
    });
    res.json(out);
  } catch (e) {
    var status = e && e.statusCode === 404 ? 404 : 500;
    res.status(status).json({ error: 'novel_disable_failed', message: String(e && e.message || e) });
  }
});

adminRouter.post('/novels/:userId/:cardId/:novelId/restore', requirePerm(PERMS.novelDisable), async function(req, res) {
  try {
    var out = await applyNovelModeration(req.params.userId, req.params.cardId, req.params.novelId, { by: req.session.user.id });
    res.json(out);
  } catch (e) {
    var status2 = e && e.statusCode === 404 ? 404 : 500;
    res.status(status2).json({ error: 'novel_restore_failed', message: String(e && e.message || e) });
  }
});

adminRouter.delete('/novels/:userId/:cardId/:novelId', requirePerm(PERMS.novelDelete), async function(req, res) {
  try {
    var reason = needReason(req, res);
    if (!reason) return;
    var approval = await createApproval({
      action: 'delete-novel',
      target: { userId: req.params.userId, cardId: req.params.cardId, novelId: req.params.novelId },
      reason: reason,
      by: req.session.user.id,
    });
    res.json({ ok: true, pending: true, approval: approval });
  } catch (e) {
    res.status(500).json({ error: 'novel_approval_failed', message: String(e && e.message || e) });
  }
});

/** 审核合规：举报队列 */
adminRouter.get('/moderation/flags', async function(req, res) {
  try {
    var flags = await listFlags(String(req.query.status || 'all'), String(req.query.targetType || 'all'));
    res.json({ ok: true, flags: flags, total: flags.length });
  } catch (e) {
    res.status(500).json({ error: 'flags_failed', message: String(e && e.message || e) });
  }
});

adminRouter.post('/moderation/flags/:id/resolve', requirePerm(PERMS.modReview), async function(req, res) {
  try {
    var out = await resolveFlag(req.params.id, {
      action: String((req.body || {}).action || 'ignore'),
      by: req.session.user.id,
      reason: String((req.body || {}).reason || ''),
    });
    res.json(out);
  } catch (e) {
    var status = e && e.statusCode === 404 ? 404 : 500;
    res.status(status).json({ error: 'flag_resolve_failed', message: String(e && e.message || e) });
  }
});

/** 审核合规：审批队列 */
adminRouter.get('/moderation/approvals', async function(req, res) {  try {
    var approvals = await listApprovals(String(req.query.status || 'all'));
    res.json({ ok: true, approvals: approvals, total: approvals.length });
  } catch (e) {
    res.status(500).json({ error: 'approvals_failed', message: String(e && e.message || e) });
  }
});

adminRouter.post('/moderation/approvals/:id/decide', requirePerm(PERMS.modApprove), async function(req, res) {
  try {
    var out = await decideApproval(req.params.id, {
      approve: (req.body || {}).approve === true,
      by: req.session.user.id,
    });
    res.json(out);
  } catch (e) {
    var status = e && (e.statusCode === 404 || e.statusCode === 409 || e.statusCode === 403) ? e.statusCode : 500;
    res.status(status).json({ error: e && e.message || 'approval_decide_failed', message: String(e && e.message || e) });
  }
});

/** 管理员重置邮箱用户密码 */
adminRouter.post('/users/:userId/password', requirePerm(PERMS.userManage), async function(req, res) {
  try {
    var userId = String(req.params.userId || '').trim();
    var reg = await getUserRegistry(userId);
    if (!reg || !reg.email) {
      return res.status(400).json({ error: 'no_email_account', message: '该用户不是邮箱账号' });
    }
    var password;
    try {
      password = assertPasswordShape(String((req.body || {}).password || ''));
    } catch (e) {
      return res.status(400).json({ error: e.code || 'password_invalid', message: e.messageZh || '密码不符合要求' });
    }
    var packed = await hashAccountPassword(password);
    var db = await ensureAdminDatabase();
    var authId = emailAuthLookupDocId(reg.email);
    var authDoc = await db.get(authId);
    await db.insert(Object.assign({}, authDoc, {
      passwordHash: packed,
      updatedAt: new Date().toISOString(),
      passwordChangedBy: req.session.user.id,
    }));
    await appendAdminAudit({ action: 'user.password_reset', targetUserId: userId, by: req.session.user.id });
    res.json({ ok: true, userId: userId });
  } catch (e) {
    if (e && e.statusCode === 404) {
      return res.status(400).json({ error: 'no_email_auth_doc', message: '未找到该用户的邮箱认证记录' });
    }
    res.status(500).json({ error: 'password_reset_failed', message: String(e && e.message || e) });
  }
});

/** 用户档案：卡 / 小说 / 分享 / token 一览 */
adminRouter.get('/users/:userId/overview', async function(req, res) {  try {
    var ov = await userOverview(req.params.userId);
    var reg = await getUserRegistry(req.params.userId);
    ov.registry = reg ? {
      displayName: reg.displayName || '',
      username: reg.username || '',
      email: reg.email || '',
      discordId: reg.discordId || '',
      provider: reg.provider || '',
      disabled: !!reg.disabled,
      quotaTier: reg.quotaTier || '',
      roles: Array.isArray(reg.roles) ? reg.roles : [],
    } : null;
    ov.tierLocked = !!(reg && getAdminRole({
      provider: reg.provider || (reg.email ? 'email' : 'discord'),
      email: reg.email,
      discordId: reg.discordId,
      id: req.params.userId,
    }));
    try {
      ov.quota = await getQuotaSnapshot({
        id: req.params.userId,
        email: reg && reg.email,
        discordId: reg && reg.discordId,
        provider: (reg && reg.provider) || (reg && reg.email ? 'email' : 'discord'),
      });
    } catch (eQ) { ov.quota = null; }
    ov.audit = await listAuditByUser(req.params.userId, 30);
    var shares = await listShareMappings(LIST_HARD_CAP);
    ov.shares = (shares || []).filter(function(s) { return s && s.ownerUserId === req.params.userId; })
      .map(function(s) {
        var expired = false;
        if (s.expiresAt) {
          var t = Date.parse(s.expiresAt);
          expired = Number.isFinite(t) && Date.now() > t;
        }
        return { token: s.token, type: s.type || 'share', enabled: s.enabled !== false, expired: expired };
      });
    var tokens = await listBearerTokenDocs(LIST_HARD_CAP);
    ov.tokens = (tokens || []).filter(function(t) { return t.userId === req.params.userId; });
    var novelPage = await listNovelIndex({ userId: req.params.userId, limit: 500, offset: 0 });
    ov.stories = novelPage.items || [];
    res.json({ ok: true, overview: ov });
  } catch (e) {
    res.status(500).json({ error: 'user_overview_failed', message: String(e && e.message || e) });
  }
});

/** 操作日志 */
adminRouter.get('/oplog', async function(req, res) {
  try {
    var rows = await listOpLog({
      who: String(req.query.who || ''),
      action: String(req.query.action || ''),
      limit: Number(req.query.limit) || 200,
    });
    res.json({ ok: true, logs: rows, total: rows.length });
  } catch (e) {
    res.status(500).json({ error: 'oplog_failed', message: String(e && e.message || e) });
  }
});

/** 登录日志 */
adminRouter.get('/loginlog', async function(req, res) {
  try {
    var rows = await listLoginLog({ who: String(req.query.who || ''), limit: Number(req.query.limit) || 200 });
    res.json({ ok: true, logs: rows, total: rows.length });
  } catch (e) {
    res.status(500).json({ error: 'loginlog_failed', message: String(e && e.message || e) });
  }
});

/** 参数管理 */
adminRouter.get('/params', async function(req, res) {
  try {
    var params = await listParams();
    var present = {};
    params.forEach(function(p) { present[p.key] = true; });
    var all = PARAM_WHITELIST.map(function(key) {
      var found = params.find(function(p) { return p.key === key; });
      return found || { _id: 'sys-param/' + key, type: 'sys-param', key: key, value: null };
    });
    res.json({ ok: true, params: all });
  } catch (e) {
    res.status(500).json({ error: 'params_failed', message: String(e && e.message || e) });
  }
});

adminRouter.put('/params/:key', requirePerm(PERMS.paramManage), async function(req, res) {
  try {
    var p = await setParam({
      key: String(req.params.key || '').trim(),
      value: (req.body || {}).value,
      by: req.session.user.id,
    });
    res.json({ ok: true, param: p });
  } catch (e) {
    var status = e && e.code === 'param_not_whitelisted' ? 400 : 500;
    res.status(status).json({ error: e && e.code || 'param_failed', message: String(e && e.message || e) });
  }
});

adminRouter.delete('/params/:key', requirePerm(PERMS.paramManage), async function(req, res) {
  try {
    await deleteParam(String(req.params.key || ''));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'param_delete_failed', message: String(e && e.message || e) });
  }
});

/** 数据字典 */
adminRouter.get('/dicts', async function(req, res) {
  try {
    var dicts = await listDicts();
    res.json({ ok: true, dicts: dicts });
  } catch (e) {
    res.status(500).json({ error: 'dicts_failed', message: String(e && e.message || e) });
  }
});

adminRouter.put('/dicts/:type', requirePerm(PERMS.dictManage), async function(req, res) {
  try {
    var dict = await putDict(Object.assign({}, req.body || {}, { type: String(req.params.type || '').trim() }));
    res.json({ ok: true, dict: dict });
  } catch (e) {
    res.status(500).json({ error: 'dict_save_failed', message: String(e && e.message || e) });
  }
});

adminRouter.delete('/dicts/:type', requirePerm(PERMS.dictManage), async function(req, res) {
  try {
    await deleteDict(String(req.params.type || '').trim());
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'dict_delete_failed', message: String(e && e.message || e) });
  }
});

/** 文件管理 */
adminRouter.get('/files', async function(req, res) {
  try {
    var files = await listFiles();
    res.json({ ok: true, files: files });
  } catch (e) {
    res.status(500).json({ error: 'files_failed', message: String(e && e.message || e) });
  }
});

adminRouter.post('/files', requirePerm(PERMS.fileManage), async function(req, res) {
  try {
    var file = await uploadFile(Object.assign({}, req.body || {}, { by: req.session.user.id }));
    res.json({ ok: true, file: file });
  } catch (e) {
    var status = e && e.message === 'file_too_large' ? 413 : 400;
    res.status(status).json({ error: e && e.message || 'file_upload_failed', message: String(e && e.message || e) });
  }
});

adminRouter.get('/files/:id/download', async function(req, res) {
  try {
    var out = await readFile(String(req.params.id || '').trim());
    if (!out) return res.status(404).json({ error: 'not_found' });
    res.setHeader('Content-Type', out.doc.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="' + encodeURIComponent(out.doc.name || out.doc.id) + '"');
    res.send(out.buffer);
  } catch (e) {
    res.status(500).json({ error: 'file_read_failed', message: String(e && e.message || e) });
  }
});

adminRouter.delete('/files/:id', requirePerm(PERMS.fileManage), async function(req, res) {
  try {
    await deleteFile(String(req.params.id || '').trim());
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'file_delete_failed', message: String(e && e.message || e) });
  }
});
