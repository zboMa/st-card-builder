/**
 * 系统操作日志（sys-oplog）+ 登录日志（sys-login）
 * 管理端写操作经中间件自动记录；登录在 auth 路由记录。
 */
import { ensureAdminDatabase } from '../couch.mjs';

function forcePut(db, doc) {
  return db.insert(doc).then(function() { return true; }, function(e) {
    if (!e || e.statusCode !== 409) throw e;
    return db.get(doc._id).then(function(ex) {
      return db.insert(Object.assign({}, doc, { _rev: ex._rev })).then(function() { return true; });
    }, function(e2) {
      if (e2 && e2.statusCode === 404) return db.insert(doc).then(function() { return true; });
      throw e2;
    });
  });
}

function newId(db, prefix) {
  return db.get(prefix).then(function() { return null; }, function(e) {
    if (e && e.statusCode === 404) return prefix;
    throw e;
  });
}

export async function appendOpLog(entry) {
  try {
    var db = await ensureAdminDatabase();
    var id = 'sys-oplog/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    var doc = Object.assign({
      _id: id,
      type: 'sys-oplog',
      at: new Date().toISOString(),
    }, entry || {});
    await db.insert(doc);
    return doc;
  } catch (e) {
    console.warn('[oplog]', e);
    return null;
  }
}

export async function listOpLog(opts) {
  opts = opts || {};
  var db = await ensureAdminDatabase();
  var limit = Math.min(500, Math.max(1, Number(opts.limit) || 200));
  var res = await db.list({ include_docs: true, startkey: 'sys-oplog/', endkey: 'sys-oplog/\ufff0', descending: true, limit: limit });
  var rows = (res.rows || []).map(function(r) { return r.doc; }).filter(Boolean);
  if (opts.who) rows = rows.filter(function(r) { return String(r.who || '').indexOf(opts.who) >= 0; });
  if (opts.action) rows = rows.filter(function(r) { return String(r.action || '').indexOf(opts.action) >= 0; });
  return rows;
}

export async function appendLoginLog(entry) {
  try {
    var db = await ensureAdminDatabase();
    var id = 'sys-login/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    var doc = Object.assign({
      _id: id,
      type: 'sys-login',
      at: new Date().toISOString(),
    }, entry || {});
    await db.insert(doc);
    return doc;
  } catch (e) {
    console.warn('[loginlog]', e);
    return null;
  }
}

export async function listLoginLog(opts) {
  opts = opts || {};
  var db = await ensureAdminDatabase();
  var limit = Math.min(500, Math.max(1, Number(opts.limit) || 200));
  var res = await db.list({ include_docs: true, startkey: 'sys-login/', endkey: 'sys-login/\ufff0', descending: true, limit: limit });
  var rows = (res.rows || []).map(function(r) { return r.doc; }).filter(Boolean);
  if (opts.who) rows = rows.filter(function(r) { return String(r.who || '').indexOf(opts.who) >= 0; });
  return rows;
}

/** 管理端写操作自动记录中间件（挂在 requireAdmin 之后） */
export function opLogMiddleware(req, res, next) {
  res.on('finish', function() {
    if (req.method === 'GET' || req.method === 'HEAD') return;
    if (!req.session || !req.session.user) return;
    appendOpLog({
      who: req.session.user.id,
      method: req.method,
      action: req.baseUrl + (req.path || ''),
      ip: req.ip,
      ua: String(req.headers['user-agent'] || '').slice(0, 300),
      status: res.statusCode,
    });
  });
  next();
}
