/**
 * 通用 IndexedDB 存储（JSON + Blob）
 * 供头像高清图、小说工坊大文本等超出 localStorage 配额的数据
 */

export const IDB_DB_NAME = 'st-card-builder';
export const IDB_DB_VERSION = 1;
export const IDB_STORE_JSON = 'json';
export const IDB_STORE_BLOB = 'blob';

/** 小说桶键（与 novelBucketKey / localStorage 迁移对齐） */
export function idbNovelKey(cardId) {
  var id = String(cardId || '').trim();
  if (!id) return '';
  return 'novelWorkshopV3:card:' + id;
}

/** 头像高清 Blob 键 */
export function idbAvatarFullKey(draftId) {
  return 'avatar:full:' + String(draftId || '').trim();
}

/** 头像封面缩略图 Blob 键 */
export function idbAvatarThumbKey(draftId) {
  return 'avatar:thumb:' + String(draftId || '').trim();
}

var dbPromise = null;

function isIdbAvailable() {
  return typeof indexedDB !== 'undefined';
}

/** 打开数据库（单例） */
export function openIdbDatabase() {
  if (!isIdbAvailable()) {
    return Promise.reject(new Error('indexedDB_unavailable'));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise(function(resolve, reject) {
    var req = indexedDB.open(IDB_DB_NAME, IDB_DB_VERSION);
    req.onupgradeneeded = function(ev) {
      var db = ev.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE_JSON)) {
        db.createObjectStore(IDB_STORE_JSON, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(IDB_STORE_BLOB)) {
        db.createObjectStore(IDB_STORE_BLOB, { keyPath: 'key' });
      }
    };
    req.onsuccess = function() { resolve(req.result); };
    req.onerror = function() {
      dbPromise = null;
      reject(req.error || new Error('idb_open_failed'));
    };
  });
  return dbPromise;
}

function runTx(storeName, mode, fn) {
  return openIdbDatabase().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(storeName, mode);
      var store = tx.objectStore(storeName);
      var out;
      try {
        out = fn(store);
      } catch (err) {
        reject(err);
        return;
      }
      tx.oncomplete = function() { resolve(out); };
      tx.onerror = function() { reject(tx.error || new Error('idb_tx_failed')); };
      tx.onabort = function() { reject(tx.error || new Error('idb_tx_aborted')); };
    });
  });
}

/** 读取 JSON 文档 */
export async function idbGetJson(key) {
  if (!key) return null;
  return runTx(IDB_STORE_JSON, 'readonly', function(store) {
    return new Promise(function(resolve, reject) {
      var req = store.get(key);
      req.onsuccess = function() {
        var row = req.result;
        resolve(row && row.data !== undefined ? row.data : null);
      };
      req.onerror = function() { reject(req.error); };
    });
  });
}

/** 写入 JSON 文档 */
export async function idbSetJson(key, data) {
  if (!key) return false;
  return runTx(IDB_STORE_JSON, 'readwrite', function(store) {
    return new Promise(function(resolve, reject) {
      var req = store.put({ key: key, data: data, updatedAt: Date.now() });
      req.onsuccess = function() { resolve(true); };
      req.onerror = function() { reject(req.error); };
    });
  });
}

/** 删除 JSON 键 */
export async function idbDeleteJson(key) {
  if (!key) return false;
  return runTx(IDB_STORE_JSON, 'readwrite', function(store) {
    return new Promise(function(resolve, reject) {
      var req = store.delete(key);
      req.onsuccess = function() { resolve(true); };
      req.onerror = function() { reject(req.error); };
    });
  });
}

/** 读取 Blob */
export async function idbGetBlob(key) {
  if (!key) return null;
  return runTx(IDB_STORE_BLOB, 'readonly', function(store) {
    return new Promise(function(resolve, reject) {
      var req = store.get(key);
      req.onsuccess = function() {
        var row = req.result;
        if (!row || !row.blob) {
          resolve(null);
          return;
        }
        resolve({ blob: row.blob, mime: row.mime || 'application/octet-stream' });
      };
      req.onerror = function() { reject(req.error); };
    });
  });
}

/** 写入 Blob */
export async function idbSetBlob(key, blob, mime) {
  if (!key || !blob) return false;
  return runTx(IDB_STORE_BLOB, 'readwrite', function(store) {
    return new Promise(function(resolve, reject) {
      var req = store.put({
        key: key,
        blob: blob,
        mime: mime || blob.type || 'application/octet-stream',
        updatedAt: Date.now(),
      });
      req.onsuccess = function() { resolve(true); };
      req.onerror = function() { reject(req.error); };
    });
  });
}

/** 删除 Blob 键 */
export async function idbDeleteBlob(key) {
  if (!key) return false;
  return runTx(IDB_STORE_BLOB, 'readwrite', function(store) {
    return new Promise(function(resolve, reject) {
      var req = store.delete(key);
      req.onsuccess = function() { resolve(true); };
      req.onerror = function() { reject(req.error); };
    });
  });
}

/** 同时删除 JSON / Blob（按同一 key） */
export async function idbDeleteAll(key) {
  await Promise.all([idbDeleteJson(key), idbDeleteBlob(key)]);
  return true;
}

/** 复制 JSON 记录 */
export async function idbCopyJson(fromKey, toKey) {
  if (!fromKey || !toKey || fromKey === toKey) return false;
  var data = await idbGetJson(fromKey);
  if (data === null) return false;
  await idbSetJson(toKey, data);
  return true;
}

/** 复制 Blob 记录 */
export async function idbCopyBlob(fromKey, toKey) {
  if (!fromKey || !toKey || fromKey === toKey) return false;
  var rec = await idbGetBlob(fromKey);
  if (!rec) return false;
  await idbSetBlob(toKey, rec.blob, rec.mime);
  return true;
}

/** Blob → data URL（浏览器） */
export function blobToDataUrl(blob) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function() { resolve(String(reader.result || '')); };
    reader.onerror = function() { reject(reader.error || new Error('read_blob_failed')); };
    reader.readAsDataURL(blob);
  });
}
