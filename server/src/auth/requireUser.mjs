/**
 * 统一鉴权：Session Cookie 或 Bearer
 */
import { resolveBearerToken } from './bearer.mjs';
import { getUserRegistry } from '../couch.mjs';

export async function resolveRequestUser(req) {
  if (req.session && req.session.user && req.session.user.id) {
    return req.session.user;
  }
  var hdr = String(req.headers.authorization || '');
  var m = /^Bearer\s+(.+)$/i.exec(hdr);
  if (!m) return null;
  return resolveBearerToken(m[1]);
}

export function requireUserFlexible(req, res, next) {
  resolveRequestUser(req).then(async function(user) {
    if (!user) return res.status(401).json({ error: 'unauthorized' });
    try {
      var reg = await getUserRegistry(user.id);
      if (reg && reg.disabled) {
        return res.status(403).json({ error: 'user_disabled' });
      }
    } catch (e) { /* ignore */ }
    req.user = user;
    next();
  }).catch(function(e) {
    console.error('[auth]', e);
    res.status(500).json({ error: 'auth_failed' });
  });
}
