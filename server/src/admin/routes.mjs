/**
 * Admin API：总览 / 用户 / 分享 / 审计
 */
import { Router } from 'express';
import { config, isAdminUser } from '../config.mjs';
import { couchHealth } from '../couch.mjs';
import {
  listUserRegistry,
  setUserDisabled,
  listShareMappings,
  deleteShareMapping,
  appendAdminAudit,
  listAdminAudit,
  countUserDatabases,
  revokeUserSyncAccess,
  ensureAdminDatabase,
} from '../couch.mjs';

export var adminRouter = Router();

function requireAdmin(req, res, next) {
  var user = req.session && req.session.user;
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isAdminUser(user)) return res.status(403).json({ error: 'forbidden', message: '非管理员' });
  next();
}

adminRouter.use(requireAdmin);

adminRouter.get('/overview', async function(req, res) {
  try {
    await ensureAdminDatabase();
    var couch = await couchHealth();
    var users = await listUserRegistry(500);
    var shares = await listShareMappings(500);
    var disabled = users.filter(function(u) { return u && u.disabled; }).length;
    var activeShares = shares.filter(function(s) { return s && s.enabled !== false; }).length;
    var userDbCount = await countUserDatabases();
    res.json({
      ok: true,
      couch: couch,
      counts: {
        registryUsers: users.length,
        disabledUsers: disabled,
        shareMappings: shares.length,
        activeShares: activeShares,
        userDatabases: userDbCount,
      },
      flags: {
        devLoginEnabled: config.devLoginEnabled,
        enforceMembership: config.authEnforceDiscordMembership,
        adminIdsConfigured: config.adminDiscordIds.length,
        cookieSecure: config.cookieSecure,
      },
    });
  } catch (e) {
    console.error('[admin/overview]', e);
    res.status(500).json({ error: 'overview_failed', message: String(e && e.message || e) });
  }
});

adminRouter.get('/users', async function(req, res) {
  try {
    var q = String(req.query.q || '').trim().toLowerCase();
    var users = await listUserRegistry(500);
    if (q) {
      users = users.filter(function(u) {
        var blob = [u.userId, u.username, u.displayName, u.discordId].join(' ').toLowerCase();
        return blob.indexOf(q) >= 0;
      });
    }
    res.json({ ok: true, users: users });
  } catch (e) {
    res.status(500).json({ error: 'users_failed', message: String(e && e.message || e) });
  }
});

adminRouter.post('/users/:userId/disable', async function(req, res) {
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
    var shares = await listShareMappings(500);
    res.json({ ok: true, shares: shares });
  } catch (e) {
    res.status(500).json({ error: 'shares_failed', message: String(e && e.message || e) });
  }
});

adminRouter.delete('/shares/:token', async function(req, res) {
  try {
    var token = String(req.params.token || '').trim();
    await deleteShareMapping(token);
    await appendAdminAudit({
      action: 'share.force_stop',
      token: token,
      by: req.session.user.id,
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'share_stop_failed', message: String(e && e.message || e) });
  }
});

adminRouter.get('/audit', async function(req, res) {
  try {
    var rows = await listAdminAudit(100);
    res.json({ ok: true, audit: rows });
  } catch (e) {
    res.status(500).json({ error: 'audit_failed', message: String(e && e.message || e) });
  }
});

adminRouter.get('/me', function(req, res) {
  res.json({
    ok: true,
    user: req.session.user,
    isAdmin: true,
  });
});
