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
  countUserDatabases,
  revokeUserSyncAccess,
  ensureAdminDatabase,
  listDatabaseInfos,
  analyzeUserDatabases,
} from '../couch.mjs';
import {
  listBearerTokenDocs,
  revokeBearerByDocId,
  purgeExpiredBearerTokens,
  countBearersByUserIds,
} from '../auth/bearer.mjs';

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

adminRouter.get('/me', function(req, res) {
  res.json({
    ok: true,
    user: req.session.user,
    isAdmin: true,
    adminRole: req.adminRole,
  });
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
    var users = await listUserRegistry(2000);
    if (q) {
      users = users.filter(function(u) {
        var blob = [u.userId, u.username, u.displayName, u.discordId].join(' ').toLowerCase();
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
      return Object.assign({}, u, {
        bearerCount: counts[u.userId] || 0,
        isOpsAdmin: !!(u.discordId && config.adminDiscordIds.indexOf(String(u.discordId)) >= 0),
        isReadonlyAdmin: !!(u.discordId && config.adminReadonlyDiscordIds.indexOf(String(u.discordId)) >= 0),
      });
    });
    res.json({ ok: true, users: page.items, total: page.total, limit: page.limit, offset: page.offset });
  } catch (e) {
    res.status(500).json({ error: 'users_failed', message: String(e && e.message || e) });
  }
});

adminRouter.post('/users/:userId/disable', requireOps, async function(req, res) {
  try {
    var userId = String(req.params.userId || '').trim();
    var disabled = !(req.body && req.body.disabled === false);
    await setUserDisabled(userId, disabled, req.session.user.id);
    if (disabled) {
      try { await revokeUserSyncAccess(userId); } catch (e) { /* ignore */ }
    }
    await appendAdminAudit({
      action: disabled ? 'user.disable' : 'user.enable',
      targetUserId: userId,
      by: req.session.user.id,
    });
    res.json({ ok: true, userId: userId, disabled: disabled });
  } catch (e) {
    res.status(500).json({ error: 'disable_failed', message: String(e && e.message || e) });
  }
});

adminRouter.get('/shares', async function(req, res) {
  try {
    var type = String(req.query.type || 'all');
    var status = String(req.query.status || 'all');
    var q = String(req.query.q || '').trim().toLowerCase();
    var shares = await listShareMappings(2000);
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
    res.json({ ok: true, shares: items, total: page.total, limit: page.limit, offset: page.offset });
  } catch (e) {
    res.status(500).json({ error: 'shares_failed', message: String(e && e.message || e) });
  }
});

/** 软停用 / 重新启用 */
adminRouter.post('/shares/:token/enabled', requireOps, async function(req, res) {
  try {
    var token = String(req.params.token || '').trim();
    var enabled = !!(req.body && req.body.enabled);
    var mapping = await setShareEnabled(token, enabled);
    await appendAdminAudit({
      action: enabled ? 'share.enable' : 'share.disable',
      token: token,
      by: req.session.user.id,
    });
    res.json({ ok: true, token: token, enabled: mapping.enabled !== false });
  } catch (e) {
    var status = e && e.statusCode === 404 ? 404 : 500;
    res.status(status).json({ error: 'share_toggle_failed', message: String(e && e.message || e) });
  }
});

/** 硬删除映射 */
adminRouter.delete('/shares/:token', requireOps, async function(req, res) {
  try {
    var token = String(req.params.token || '').trim();
    await deleteShareMapping(token);
    await appendAdminAudit({
      action: 'share.force_delete',
      token: token,
      by: req.session.user.id,
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
    var tokens = await listBearerTokenDocs(2000);
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
    res.json({ ok: true, tokens: page.items, total: page.total, limit: page.limit, offset: page.offset });
  } catch (e) {
    res.status(500).json({ error: 'tokens_failed', message: String(e && e.message || e) });
  }
});

adminRouter.delete('/tokens/:id', requireOps, async function(req, res) {
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

adminRouter.post('/tokens/purge-expired', requireOps, async function(req, res) {
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
    var rows = await listAdminAudit(500);
    if (action) rows = rows.filter(function(r) { return r && r.action === action; });
    if (by) {
      rows = rows.filter(function(r) {
        return String(r && r.by || '').toLowerCase().indexOf(by) >= 0;
      });
    }
    var page = paginate(rows, req);
    res.json({ ok: true, audit: page.items, total: page.total, limit: page.limit, offset: page.offset });
  } catch (e) {
    res.status(500).json({ error: 'audit_failed', message: String(e && e.message || e) });
  }
});

adminRouter.get('/audit/export', async function(req, res) {
  try {
    var rows = await listAdminAudit(1000);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="admin-audit.json"');
    res.send(JSON.stringify({ exportedAt: new Date().toISOString(), audit: rows }, null, 2));
  } catch (e) {
    res.status(500).json({ error: 'audit_export_failed', message: String(e && e.message || e) });
  }
});

adminRouter.post('/backup', requireOps, async function(req, res) {
  if (!config.backupEnabled) {
    return res.status(403).json({
      error: 'backup_disabled',
      message: '未开启 ADMIN_BACKUP_ENABLED；生产请在 .env 显式开启',
    });
  }
  var script = path.join(REPO_ROOT, 'scripts', 'backup-couch.sh');
  var outBase = config.backupDir
    || path.join(SERVER_ROOT, 'backups');
  var stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  var outDir = path.join(outBase, stamp);

  try {
    var result = await new Promise(function(resolve, reject) {
      var child = spawn('bash', [script, outDir], {
        cwd: REPO_ROOT,
        env: Object.assign({}, process.env, {
          ENV_FILE: path.join(SERVER_ROOT, '.env'),
          COUCHDB_URL: config.couch.url,
          COUCHDB_USER: config.couch.user,
          COUCHDB_PASSWORD: config.couch.password,
        }),
      });
      var stdout = '';
      var stderr = '';
      var settled = false;
      var timer = setTimeout(function() {
        try { child.kill('SIGKILL'); } catch (e) { /* ignore */ }
        if (!settled) {
          settled = true;
          reject(new Error('backup_timeout'));
        }
      }, 10 * 60 * 1000);
      child.stdout.on('data', function(d) { stdout += String(d); });
      child.stderr.on('data', function(d) { stderr += String(d); });
      child.on('error', function(err) {
        clearTimeout(timer);
        if (!settled) { settled = true; reject(err); }
      });
      child.on('close', function(code) {
        clearTimeout(timer);
        if (settled) return;
        settled = true;
        if (code === 0) resolve({ stdout: stdout, stderr: stderr });
        else reject(new Error(stderr || stdout || ('exit ' + code)));
      });
    });
    await appendAdminAudit({
      action: 'backup.run',
      outDir: outDir,
      by: req.session.user.id,
    });
    res.json({ ok: true, outDir: outDir, log: String(result.stdout || '').slice(-2000) });
  } catch (e) {
    console.error('[admin/backup]', e);
    res.status(500).json({ error: 'backup_failed', message: String(e && e.message || e) });
  }
});
