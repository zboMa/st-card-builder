/**
 * CouchDB 管理：一用户一库 + 同步账号
 */
import crypto from 'node:crypto';
import nano from 'nano';
import { config } from './config.mjs';

var admin = null;

export function getAdmin() {
  if (admin) return admin;
  var url = config.couch.url.replace(/^https?:\/\//, '');
  var protocol = config.couch.url.startsWith('https') ? 'https' : 'http';
  var authUrl = protocol + '://'
    + encodeURIComponent(config.couch.user) + ':'
    + encodeURIComponent(config.couch.password) + '@' + url;
  admin = nano(authUrl);
  return admin;
}

export function userDbName(userId) {
  var safe = String(userId || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 48);
  if (!safe) safe = 'anon';
  return 'userdb-stcb-' + safe;
}

export function couchUserName(userId) {
  return 'stcb_' + String(userId || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 40);
}

function randomPassword() {
  return crypto.randomBytes(24).toString('base64url');
}

async function ensureUsersDb() {
  var n = getAdmin();
  try {
    await n.db.create('_users');
  } catch (e) {
    if (!(e && (e.statusCode === 412 || e.errid === 'non_existent'))) {
      // 412 = already exists
      if (e && e.statusCode !== 412) {
        /* ignore race */
      }
    }
  }
}

/**
 * 确保用户库存在，并写入/轮换同步用 Couch 用户密码。
 * @returns {{ dbName: string, dbUrl: string, username: string, password: string }}
 */
export async function ensureUserDatabase(userId) {
  var n = getAdmin();
  var dbName = userDbName(userId);
  var username = couchUserName(userId);
  var password = randomPassword();

  try {
    await n.db.create(dbName);
  } catch (e) {
    if (!e || e.statusCode !== 412) throw e;
  }

  var db = n.use(dbName);
  try {
    await db.insert({
      admins: { names: [username], roles: [] },
      members: { names: [username], roles: [] },
    }, '_security');
  } catch (e) {
    console.warn('[couch] _security', e && e.message);
  }

  await ensureUsersDb();
  var users = n.use('_users');
  var userDocId = 'org.couchdb.user:' + username;
  var existing = null;
  try {
    existing = await users.get(userDocId);
  } catch (e) {
    if (!e || e.statusCode !== 404) throw e;
  }

  var doc = {
    _id: userDocId,
    name: username,
    type: 'user',
    roles: [],
    password: password,
  };
  if (existing && existing._rev) doc._rev = existing._rev;
  await users.insert(doc);

  return {
    dbName: dbName,
    dbUrl: config.couch.url + '/' + dbName,
    username: username,
    password: password,
  };
}

export async function couchHealth() {
  try {
    var info = await getAdmin().info();
    return { ok: true, version: info && info.version };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}
