/**
 * 数据字典（dict/{type}）+ 后台文件（file/）
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ensureAdminDatabase } from '../couch.mjs';

var __dirname = path.dirname(fileURLToPath(import.meta.url));
var SERVER_ROOT = path.resolve(__dirname, '..', '..');
export var FILE_DIR = path.join(SERVER_ROOT, 'admin-files');

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

// ---------- 字典 ----------
export async function listDicts() {
  var db = await ensureAdminDatabase();
  var res = await db.list({ include_docs: true, startkey: 'dict/', endkey: 'dict/\ufff0' });
  return (res.rows || []).map(function(r) { return r.doc; }).filter(Boolean);
}

export async function putDict(d) {
  if (!d || !d.type) throw new Error('missing_dict_type');
  var db = await ensureAdminDatabase();
  var existing = await getOrNull(db, 'dict/' + d.type);
  var doc = {
    _id: 'dict/' + d.type,
    type: 'dict',
    dictType: String(d.type),
    label: String(d.label || d.type),
    items: Array.isArray(d.items) ? d.items.map(function(i) {
      return typeof i === 'string' ? { value: i, label: i } : { value: String(i.value), label: String(i.label || i.value) };
    }) : [],
    updatedAt: new Date().toISOString(),
  };
  if (existing) { doc.createdAt = existing.createdAt; doc._rev = existing._rev; }
  else doc.createdAt = doc.updatedAt;
  await db.insert(doc);
  return doc;
}

export async function deleteDict(type) {
  var db = await ensureAdminDatabase();
  var doc = await getOrNull(db, 'dict/' + String(type || ''));
  if (doc) await db.destroy(doc._id, doc._rev);
  return { ok: true };
}

// ---------- 文件 ----------
export async function listFiles() {
  var db = await ensureAdminDatabase();
  var res = await db.list({ include_docs: true, startkey: 'file/', endkey: 'file/\ufff0' });
  return (res.rows || []).map(function(r) { return r.doc; }).filter(Boolean);
}

export async function recordAdminFile(f) {
  if (!f || !f.name) throw new Error('invalid_file');
  var buf = Buffer.isBuffer(f.buffer)
    ? f.buffer
    : Buffer.from(String(f.text != null ? f.text : f.base64 || ''), f.text != null ? 'utf8' : 'base64');
  return writeAdminFile(f, buf);
}

export async function uploadFile(f) {
  if (!f || !f.name || !f.base64) throw new Error('invalid_file');
  var buf = Buffer.from(String(f.base64 || ''), 'base64');
  return writeAdminFile(f, buf);
}

async function writeAdminFile(f, buf) {
  var maxBytes = 15 * 1024 * 1024;
  if (buf.length > maxBytes) throw new Error('file_too_large');
  var id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  try { fs.mkdirSync(FILE_DIR, { recursive: true }); } catch (e) { /* ignore */ }
  var filePath = path.join(FILE_DIR, id);
  fs.writeFileSync(filePath, buf);
  var db = await ensureAdminDatabase();
  var doc = {
    _id: 'file/' + id,
    type: 'file',
    id: id,
    name: String(f.name).slice(0, 200),
    contentType: String(f.contentType || 'application/octet-stream'),
    size: buf.length,
    source: String(f.source || 'upload'),
    uploadedBy: f.by || '',
    uploadedAt: new Date().toISOString(),
  };
  await db.insert(doc);
  return doc;
}

export async function readFile(id) {
  var db = await ensureAdminDatabase();
  var doc = await getOrNull(db, 'file/' + String(id || ''));
  if (!doc) return null;
  var filePath = path.join(FILE_DIR, String(id));
  if (!fs.existsSync(filePath)) return null;
  return { doc: doc, buffer: fs.readFileSync(filePath) };
}

export async function deleteFile(id) {
  var db = await ensureAdminDatabase();
  var doc = await getOrNull(db, 'file/' + String(id || ''));
  if (doc) await db.destroy(doc._id, doc._rev);
  try {
    var filePath = path.join(FILE_DIR, String(id || ''));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) { /* ignore */ }
  return { ok: true };
}

// ---------- 邀请码 ----------
export async function generateInvite(o) {
  o = o || {};
  var db = await ensureAdminDatabase();
  var count = Math.max(1, Math.min(100, Number(o.count) || 1));
  var out = [];
  for (var i = 0; i < count; i++) {
    var code = '';
    while (code.length < 8) {
      code += Math.random().toString(36).slice(2);
    }
    code = code.slice(0, 8).toUpperCase();
    var id = 'invite/' + code;
    var existing = await getOrNull(db, id);
    if (existing) { i--; continue; }
    var doc = {
      _id: id,
      type: 'invite',
      code: code,
      note: String(o.note || ''),
      status: 'valid', // valid | used | revoked
      createdBy: o.by || '',
      createdAt: new Date().toISOString(),
      expiresAt: o.expiresInDays ? new Date(Date.now() + Number(o.expiresInDays) * 24 * 3600 * 1000).toISOString() : null,
      usedBy: null,
      usedAt: null,
    };
    await db.insert(doc);
    out.push(doc);
  }
  return out;
}

export async function listInvites() {
  var db = await ensureAdminDatabase();
  var res = await db.list({ include_docs: true, startkey: 'invite/', endkey: 'invite/\ufff0' });
  return (res.rows || []).map(function(r) { return r.doc; }).filter(Boolean);
}

export async function revokeInvite(code) {
  var db = await ensureAdminDatabase();
  var doc = await getOrNull(db, 'invite/' + String(code || '').toUpperCase());
  if (!doc) throw Object.assign(new Error('invite_not_found'), { statusCode: 404 });
  doc.status = 'revoked';
  doc._rev = null;
  delete doc._rev;
  await forcePut(db, doc);
  return doc;
}

/** 注册用：校验邀请码（env 之外额外接受库内有效码） */
export async function getValidInvite(code) {
  var db = await ensureAdminDatabase();
  var doc = await getOrNull(db, 'invite/' + String(code || '').trim().toUpperCase());
  if (!doc || doc.status !== 'valid') return null;
  if (doc.expiresAt && Date.parse(doc.expiresAt) < Date.now()) return null;
  return doc;
}

export async function consumeInvite(code, userId) {
  var db = await ensureAdminDatabase();
  var doc = await getOrNull(db, 'invite/' + String(code || '').trim().toUpperCase());
  if (!doc) return null;
  doc.status = 'used';
  doc.usedBy = userId || '';
  doc.usedAt = new Date().toISOString();
  delete doc._rev;
  await forcePut(db, doc);
  return doc;
}
