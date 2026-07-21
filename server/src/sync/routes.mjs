/**
 * 同步凭证：返回用户专属 Couch 库复制凭据
 */
import { Router } from 'express';
import { ensureUserDatabase, getUserRegistry, upsertUserRegistry } from '../couch.mjs';

export var syncRouter = Router();

function requireUser(req, res, next) {
  if (!req.session || !req.session.user || !req.session.user.id) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

syncRouter.get('/credentials', requireUser, async function(req, res) {
  try {
    var user = req.session.user;
    var reg = await getUserRegistry(user.id);
    if (reg && reg.disabled) {
      return res.status(403).json({ error: 'user_disabled', message: '账号已被禁用同步' });
    }
    try { await upsertUserRegistry(user); } catch (e) { /* ignore */ }
    var cred = await ensureUserDatabase(user.id);
    res.json({
      ok: true,
      dbName: cred.dbName,
      dbUrl: cred.dbUrl,
      username: cred.username,
      password: cred.password,
      syncIntervalMs: 5 * 60 * 1000,
      secretsDocId: 'secrets/ai-config',
      indexDocId: 'meta/card-index',
    });
  } catch (e) {
    console.error('[sync/credentials]', e);
    res.status(500).json({ error: 'credentials_failed', message: String(e && e.message || e) });
  }
});
