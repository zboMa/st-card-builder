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

export var SHARES_DB = 'stcb-public-shares';

/** 公开分享映射库（仅服务端 admin 读写） */
export async function ensureSharesDatabase() {
  var n = getAdmin();
  try {
    await n.db.create(SHARES_DB);
  } catch (e) {
    if (!e || e.statusCode !== 412) throw e;
  }
  var db = n.use(SHARES_DB);
  try {
    await db.insert({
      admins: { names: [], roles: ['_admin'] },
      members: { names: [], roles: ['_admin'] },
    }, '_security');
  } catch (e) {
    /* ignore */
  }
  return db;
}

export function getUserDbAdmin(userId) {
  return getAdmin().use(userDbName(userId));
}

export function storyReleaseDocId(cardId, novelId) {
  return 'story/' + String(cardId || '').trim() + '/' + String(novelId || '').trim() + '/release';
}

export async function getShareMapping(token) {
  var db = await ensureSharesDatabase();
  try {
    return await db.get('share/' + String(token || '').trim());
  } catch (e) {
    if (e && e.statusCode === 404) return null;
    throw e;
  }
}

export async function putShareMapping(doc) {
  var db = await ensureSharesDatabase();
  var id = doc._id || ('share/' + doc.token);
  var next = Object.assign({}, doc, { _id: id });
  try {
    var existing = await db.get(id);
    next._rev = existing._rev;
  } catch (e) {
    if (!e || e.statusCode !== 404) throw e;
  }
  return db.insert(next);
}

export async function deleteShareMapping(token) {
  var db = await ensureSharesDatabase();
  var id = 'share/' + String(token || '').trim();
  try {
    var existing = await db.get(id);
    return db.destroy(id, existing._rev);
  } catch (e) {
    if (e && e.statusCode === 404) return null;
    throw e;
  }
}

export async function readOwnerRelease(ownerUserId, cardId, novelId) {
  var db = getUserDbAdmin(ownerUserId);
  try {
    return await db.get(storyReleaseDocId(cardId, novelId));
  } catch (e) {
    if (e && e.statusCode === 404) return null;
    throw e;
  }
}

export function cardReleaseDocId(cardId) {
  return 'card/' + String(cardId || '').trim() + '/release';
}

export function cardReleaseVersionDocId(cardId, characterVersion) {
  var ver = encodeURIComponent(String(characterVersion || '1.0').trim() || '1.0');
  return 'card/' + String(cardId || '').trim() + '/release/' + ver;
}

export async function readOwnerCardRelease(ownerUserId, cardId) {
  var db = getUserDbAdmin(ownerUserId);
  try {
    return await db.get(cardReleaseDocId(cardId));
  } catch (e) {
    if (e && e.statusCode === 404) return null;
    throw e;
  }
}

export async function readOwnerCardReleaseVersion(ownerUserId, cardId, characterVersion) {
  var db = getUserDbAdmin(ownerUserId);
  try {
    return await db.get(cardReleaseVersionDocId(cardId, characterVersion));
  } catch (e) {
    if (e && e.statusCode === 404) return null;
    throw e;
  }
}

export async function listOwnerCardReleaseVersions(ownerUserId, cardId) {
  var db = getUserDbAdmin(ownerUserId);
  var prefix = 'card/' + String(cardId || '').trim() + '/release/';
  var res = await db.list({
    include_docs: true,
    startkey: prefix,
    endkey: prefix + '\ufff0',
  });
  return (res.rows || [])
    .map(function(r) { return r.doc; })
    .filter(function(d) {
      return d && d.type === 'card-release' && d._id !== cardReleaseDocId(cardId);
    });
}

/**
 * 写入/更新卡 release（含可选 PNG base64 附件）
 * @param {object} releasePayload { characterVersion, title, publishedAt, cardJson, pngEnabled }
 * @param {string|null} pngBase64 原始 PNG base64（无 data: 前缀）
 */
export async function putOwnerCardRelease(ownerUserId, cardId, releasePayload, pngBase64) {
  var db = getUserDbAdmin(ownerUserId);
  var idCurrent = cardReleaseDocId(cardId);
  var ver = String(releasePayload.characterVersion || '1.0');
  var idVer = cardReleaseVersionDocId(cardId, ver);

  async function upsert(id) {
    var existing = null;
    try { existing = await db.get(id); } catch (e) {
      if (!e || e.statusCode !== 404) throw e;
    }
    var doc = {
      _id: id,
      type: 'card-release',
      cardId: String(cardId),
      characterVersion: ver,
      title: releasePayload.title,
      publishedAt: releasePayload.publishedAt,
      pngEnabled: !!releasePayload.pngEnabled,
      data: {
        cardJson: releasePayload.cardJson,
        title: releasePayload.title,
        characterVersion: ver,
        publishedAt: releasePayload.publishedAt,
      },
      updatedAt: new Date().toISOString(),
    };
    if (existing && existing._rev) doc._rev = existing._rev;
    if (existing && existing._attachments) doc._attachments = existing._attachments;
    var saved = await db.insert(doc);
    if (pngBase64) {
      var buf = Buffer.from(String(pngBase64).replace(/^data:image\/png;base64,/, ''), 'base64');
      await db.attachment.insert(id, 'card.png', buf, 'image/png', { rev: saved.rev });
    }
    return saved;
  }

  await upsert(idCurrent);
  await upsert(idVer);
  return { cardId: cardId, characterVersion: ver };
}

export async function getOwnerCardPng(ownerUserId, cardId, characterVersion) {
  var db = getUserDbAdmin(ownerUserId);
  var id = characterVersion
    ? cardReleaseVersionDocId(cardId, characterVersion)
    : cardReleaseDocId(cardId);
  try {
    var body = await db.attachment.get(id, 'card.png');
    return Buffer.isBuffer(body) ? body : Buffer.from(body);
  } catch (e) {
    if (e && e.statusCode === 404) return null;
    throw e;
  }
}

export var ADMIN_DB = 'stcb-admin';

export async function ensureAdminDatabase() {
  var n = getAdmin();
  try {
    await n.db.create(ADMIN_DB);
  } catch (e) {
    if (!e || e.statusCode !== 412) throw e;
  }
  var db = n.use(ADMIN_DB);
  try {
    await db.insert({
      admins: { names: [], roles: ['_admin'] },
      members: { names: [], roles: ['_admin'] },
    }, '_security');
  } catch (e) { /* ignore */ }
  return db;
}

export function registryUserDocId(userId) {
  return 'user/' + String(userId || '').trim();
}

export async function upsertUserRegistry(user, extra) {
  if (!user || !user.id) return null;
  var db = await ensureAdminDatabase();
  var id = registryUserDocId(user.id);
  var existing = null;
  try { existing = await db.get(id); } catch (e) {
    if (!e || e.statusCode !== 404) throw e;
  }
  var doc = Object.assign({}, existing || {}, {
    _id: id,
    type: 'user-registry',
    userId: user.id,
    username: user.username || '',
    displayName: user.displayName || '',
    provider: user.provider || '',
    discordId: user.discordId || '',
    updatedAt: new Date().toISOString(),
  }, extra || {});
  if (!existing) doc.createdAt = new Date().toISOString();
  if (existing && existing.disabled) doc.disabled = true;
  if (existing && existing._rev) doc._rev = existing._rev;
  if (!Object.prototype.hasOwnProperty.call(doc, 'disabled')) doc.disabled = false;
  return db.insert(doc);
}

export async function getUserRegistry(userId) {
  var db = await ensureAdminDatabase();
  try {
    return await db.get(registryUserDocId(userId));
  } catch (e) {
    if (e && e.statusCode === 404) return null;
    throw e;
  }
}

export async function setUserDisabled(userId, disabled, byAdmin) {
  var db = await ensureAdminDatabase();
  var id = registryUserDocId(userId);
  var existing = null;
  try { existing = await db.get(id); } catch (e) {
    if (!e || e.statusCode !== 404) throw e;
  }
  var doc = Object.assign({}, existing || {
    _id: id,
    type: 'user-registry',
    userId: String(userId),
    createdAt: new Date().toISOString(),
  }, {
    disabled: !!disabled,
    disabledAt: disabled ? new Date().toISOString() : null,
    disabledBy: byAdmin || null,
    updatedAt: new Date().toISOString(),
  });
  if (existing && existing._rev) doc._rev = existing._rev;
  return db.insert(doc);
}

export async function listUserRegistry(limit) {
  var db = await ensureAdminDatabase();
  var res = await db.list({
    include_docs: true,
    startkey: 'user/',
    endkey: 'user/\ufff0',
    limit: limit || 500,
  });
  return (res.rows || []).map(function(r) { return r.doc; }).filter(Boolean);
}

export async function listShareMappings(limit) {
  var db = await ensureSharesDatabase();
  var res = await db.list({
    include_docs: true,
    startkey: 'share/',
    endkey: 'share/\ufff0',
    limit: limit || 500,
  });
  return (res.rows || []).map(function(r) { return r.doc; }).filter(Boolean);
}

export async function appendAdminAudit(entry) {
  var db = await ensureAdminDatabase();
  var id = 'audit/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  return db.insert(Object.assign({
    _id: id,
    type: 'admin-audit',
    at: new Date().toISOString(),
  }, entry || {}));
}

export async function listAdminAudit(limit) {
  var db = await ensureAdminDatabase();
  var res = await db.list({
    include_docs: true,
    startkey: 'audit/',
    endkey: 'audit/\ufff0',
    descending: true,
    limit: limit || 100,
  });
  return (res.rows || []).map(function(r) { return r.doc; }).filter(Boolean);
}

export async function countUserDatabases() {
  var n = getAdmin();
  var list = await n.db.list();
  var users = (list || []).filter(function(name) {
    return String(name).indexOf('userdb-stcb-') === 0;
  });
  return users.length;
}

/** 轮换用户 Couch 密码以踢掉现有复制会话 */
export async function revokeUserSyncAccess(userId) {
  return ensureUserDatabase(userId);
}


