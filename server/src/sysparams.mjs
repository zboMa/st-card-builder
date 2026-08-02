/**
 * 运行时参数（sys-param，白名单键，env 仍为权威）
 * 数据模型见 docs/systems/admin.md。
 */
import { ensureAdminDatabase } from './couch.mjs';

export var PARAM_WHITELIST = [
  'announcement.topbar',
  'auth.loginFailLock',
  'share.defaultExpireDays',
];

function getOrNull(db, id) {
  return db.get(String(id || '')).then(function(d) { return d; }, function(e) {
    if (e && e.statusCode === 404) return null;
    throw e;
  });
}

function isWhitelisted(key) {
  return PARAM_WHITELIST.indexOf(String(key || '')) >= 0;
}

export async function getParam(key) {
  if (!isWhitelisted(key)) return null;
  var db = await ensureAdminDatabase();
  var doc = await getOrNull(db, 'sys-param/' + key);
  return doc && doc.value;
}

export async function listParams() {
  var db = await ensureAdminDatabase();
  var res = await db.list({ include_docs: true, startkey: 'sys-param/', endkey: 'sys-param/\ufff0' });
  return (res.rows || []).map(function(r) { return r.doc; }).filter(Boolean);
}

export async function setParam(p) {
  if (!p || !isWhitelisted(p.key)) {
    var err = new Error('param_not_whitelisted');
    err.code = 'param_not_whitelisted';
    throw err;
  }
  var db = await ensureAdminDatabase();
  var existing = await getOrNull(db, 'sys-param/' + p.key);
  var doc = {
    _id: 'sys-param/' + p.key,
    type: 'sys-param',
    key: p.key,
    value: String(p.value == null ? '' : p.value),
    updatedBy: p.by || '',
    updatedAt: new Date().toISOString(),
  };
  if (existing) { doc.createdAt = existing.createdAt; doc._rev = existing._rev; }
  else doc.createdAt = doc.updatedAt;
  await db.insert(doc);
  return doc;
}

export async function deleteParam(key) {
  var db = await ensureAdminDatabase();
  var doc = await getOrNull(db, 'sys-param/' + String(key || ''));
  if (doc) await db.destroy(doc._id, doc._rev);
  return { ok: true };
}
