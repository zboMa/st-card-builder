/**
 * 登录失败锁定（auth-lock/{email}）
 * 阈值/时长通过 sys-param 覆盖（auth.loginFailLock）。
 */
import { ensureAdminDatabase } from '../couch.mjs';
import { getParam } from '../sysparams.mjs';

var MAX_FAILS = 5;
var LOCK_MS = 15 * 60 * 1000;

function getOrNull(db, id) {
  return db.get(String(id || '')).then(function(d) { return d; }, function(e) {
    if (e && e.statusCode === 404) return null;
    throw e;
  });
}

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

async function lockConfig() {
  var raw = await getParam('auth.loginFailLock').catch(function() { return null; });
  if (!raw) return { enabled: false };
  try {
    var cfg = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return {
      enabled: cfg.enabled !== false,
      maxFails: Number(cfg.maxFails) || MAX_FAILS,
      lockMs: Number(cfg.lockMs) || LOCK_MS,
    };
  } catch (e) {
    return { enabled: false };
  }
}

export async function checkLock(email) {
  var cfg = await lockConfig();
  if (!cfg.enabled) return { locked: false };
  var db = await ensureAdminDatabase();
  var doc = await getOrNull(db, 'auth-lock/' + String(email || '').toLowerCase());
  if (!doc) return { locked: false };
  var until = Date.parse(doc.lockedUntil || '');
  if (Number.isFinite(until) && until > Date.now()) {
    return { locked: true, until: new Date(until).toISOString(), remainingSec: Math.round((until - Date.now()) / 1000) };
  }
  if (Number.isFinite(until) && until <= Date.now()) {
    await clearFails(email);
  }
  return { locked: false };
}

export async function recordFail(email) {
  var cfg = await lockConfig();
  if (!cfg.enabled) return;
  var db = await ensureAdminDatabase();
  var key = String(email || '').toLowerCase();
  var doc = await getOrNull(db, 'auth-lock/' + key);
  var fails = (doc && doc.fails) || 0;
  fails += 1;
  var lockedUntil = fails >= cfg.maxFails ? new Date(Date.now() + cfg.lockMs).toISOString() : (doc && doc.lockedUntil) || null;
  var next = {
    _id: 'auth-lock/' + key,
    type: 'auth-lock',
    email: key,
    fails: fails,
    lastFailAt: new Date().toISOString(),
    lockedUntil: lockedUntil,
  };
  if (doc) next._rev = doc._rev;
  await forcePut(db, next);
  return { fails: fails, locked: !!lockedUntil };
}

export async function clearFails(email) {
  var db = await ensureAdminDatabase();
  var doc = await getOrNull(db, 'auth-lock/' + String(email || '').toLowerCase());
  if (!doc) return;
  await db.destroy(doc._id, doc._rev);
}
