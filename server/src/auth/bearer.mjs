/**
 * 插件 Bearer Token（存 stcb-admin）
 */
import crypto from 'node:crypto';
import { ensureAdminDatabase } from '../couch.mjs';

var TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

function tokenDocId(tokenHash) {
  return 'bearer/' + tokenHash;
}

function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

export async function issueBearerToken(user) {
  if (!user || !user.id) throw new Error('no_user');
  var raw = crypto.randomBytes(32).toString('base64url');
  var th = hashToken(raw);
  var db = await ensureAdminDatabase();
  var expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  await db.insert({
    _id: tokenDocId(th),
    type: 'bearer-token',
    userId: user.id,
    username: user.username || '',
    displayName: user.displayName || '',
    provider: user.provider || '',
    discordId: user.discordId || '',
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt,
  });
  return { token: raw, expiresAt: expiresAt };
}

export async function resolveBearerToken(raw) {
  var token = String(raw || '').trim();
  if (!token) return null;
  var db = await ensureAdminDatabase();
  try {
    var doc = await db.get(tokenDocId(hashToken(token)));
    if (!doc || doc.type !== 'bearer-token') return null;
    if (doc.expiresAt && Date.parse(doc.expiresAt) < Date.now()) return null;
    return {
      id: doc.userId,
      username: doc.username,
      displayName: doc.displayName,
      provider: doc.provider || 'discord',
      discordId: doc.discordId || '',
    };
  } catch (e) {
    if (e && e.statusCode === 404) return null;
    throw e;
  }
}

export async function revokeBearerToken(raw) {
  var token = String(raw || '').trim();
  if (!token) return;
  var db = await ensureAdminDatabase();
  var id = tokenDocId(hashToken(token));
  try {
    var doc = await db.get(id);
    await db.destroy(id, doc._rev);
  } catch (e) {
    if (!(e && e.statusCode === 404)) throw e;
  }
}
