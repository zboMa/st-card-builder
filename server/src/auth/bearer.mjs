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

/** 管理端：列出 Bearer（不含明文） */
export async function listBearerTokenDocs(limit) {
  var db = await ensureAdminDatabase();
  var res = await db.list({
    include_docs: true,
    startkey: 'bearer/',
    endkey: 'bearer/\ufff0',
    limit: limit || 500,
  });
  var now = Date.now();
  return (res.rows || []).map(function(r) {
    var d = r.doc;
    if (!d || d.type !== 'bearer-token') return null;
    var expired = !!(d.expiresAt && Date.parse(d.expiresAt) < now);
    return {
      id: d._id,
      userId: d.userId || '',
      username: d.username || '',
      displayName: d.displayName || '',
      discordId: d.discordId || '',
      createdAt: d.createdAt || null,
      expiresAt: d.expiresAt || null,
      expired: expired,
    };
  }).filter(Boolean);
}

export async function revokeBearerByDocId(docId) {
  var id = String(docId || '').trim();
  if (id.indexOf('bearer/') !== 0) throw new Error('invalid_token_id');
  var db = await ensureAdminDatabase();
  var doc = await db.get(id);
  await db.destroy(id, doc._rev);
  return { ok: true, id: id };
}

export async function purgeExpiredBearerTokens() {
  var list = await listBearerTokenDocs(2000);
  var n = 0;
  for (var i = 0; i < list.length; i++) {
    if (!list[i].expired) continue;
    try {
      await revokeBearerByDocId(list[i].id);
      n += 1;
    } catch (e) { /* ignore */ }
  }
  return { purged: n };
}

export async function listBearerTokensForUser(userId) {
  var uid = String(userId || '');
  var list = await listBearerTokenDocs(500);
  return list.filter(function(t) {
    return t && String(t.userId || '') === uid && !t.expired;
  });
}

export async function countBearersByUserIds(userIds) {
  var set = {};
  (userIds || []).forEach(function(id) { set[String(id)] = 0; });
  var list = await listBearerTokenDocs(2000);
  list.forEach(function(t) {
    if (t.expired) return;
    var uid = String(t.userId || '');
    if (Object.prototype.hasOwnProperty.call(set, uid)) set[uid] += 1;
    else if (!userIds || !userIds.length) set[uid] = (set[uid] || 0) + 1;
  });
  return set;
}
