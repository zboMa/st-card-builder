/**
 * PouchDB 本地库封装（浏览器）
 * 底层仍用 IndexedDB adapter；业务统一走文档模型以便 Couch 复制。
 */
import {
  DOC,
  cardDocId,
  shouldReplicateDocId,
} from './docIds.mjs';
import { markLocalDirty } from './localDirty.mjs';

var localDb = null;
var PouchDBCtor = null;

export async function loadPouchDB() {
  if (PouchDBCtor) return PouchDBCtor;
  if (typeof window === 'undefined') {
    throw new Error('pouch_browser_only');
  }
  var mod = await import('pouchdb-browser');
  PouchDBCtor = mod.default || mod;
  return PouchDBCtor;
}

export async function getLocalDb() {
  if (localDb) return localDb;
  var PouchDB = await loadPouchDB();
  localDb = new PouchDB('stcb-pouch-v1');
  return localDb;
}

export async function resetLocalDbForTests() {
  if (!localDb) return;
  try { await localDb.destroy(); } catch (e) { /* ignore */ }
  localDb = null;
}

export async function putDoc(doc, opts) {
  opts = opts || {};
  var db = await getLocalDb();
  var id = doc._id;
  if (!id) throw new Error('missing_id');
  try {
    var existing = await db.get(id);
    doc = Object.assign({}, doc, { _rev: existing._rev });
  } catch (e) {
    if (!e || e.status !== 404) throw e;
  }
  var res = await db.put(doc);
  if (!opts.skipDirty) markLocalDirty();
  return res;
}

export async function getDoc(id) {
  var db = await getLocalDb();
  try {
    return await db.get(id);
  } catch (e) {
    if (e && e.status === 404) return null;
    throw e;
  }
}

export async function removeDoc(id, opts) {
  opts = opts || {};
  var db = await getLocalDb();
  try {
    var doc = await db.get(id);
    var res = await db.remove(doc);
    if (!opts.skipDirty) markLocalDirty();
    return res;
  } catch (e) {
    if (e && e.status === 404) return null;
    throw e;
  }
}

export async function getCardIndex() {
  var doc = await getDoc(DOC.cardIndex);
  return doc && Array.isArray(doc.cards) ? doc.cards : [];
}

export async function putCardDraft(cardId, draft) {
  var id = cardDocId(cardId);
  return putDoc(Object.assign({
    _id: id,
    type: 'card',
    cardId: String(cardId),
    data: draft,
    updatedAt: (draft && draft.updatedAt) || new Date().toISOString(),
  }));
}

export async function getCardDraft(cardId) {
  var doc = await getDoc(cardDocId(cardId));
  return doc && doc.data ? doc.data : null;
}

/**
 * 与远端同步（双向）
 * @param {{ dbUrl: string, username: string, password: string, includeSecrets?: boolean }} cred
 */
export async function replicateWithRemote(cred, opts) {
  opts = opts || {};
  var db = await getLocalDb();
  var PouchDB = await loadPouchDB();
  var remoteUrl = String(cred.dbUrl || '');
  // 注入 basic auth
  var u = new URL(remoteUrl);
  u.username = cred.username || '';
  u.password = cred.password || '';
  var remote = new PouchDB(u.toString(), { skip_setup: true });

  var includeSecrets = !!(cred.includeSecrets || opts.includeSecrets);
  var filter = function(doc) {
    return shouldReplicateDocId(doc._id, includeSecrets);
  };

  var push = db.replicate.to(remote, {
    live: false,
    retry: false,
    filter: filter,
  });
  var pull = db.replicate.from(remote, {
    live: false,
    retry: false,
    filter: filter,
  });

  function wait(rep) {
    return new Promise(function(resolve, reject) {
      rep.on('complete', resolve);
      rep.on('error', reject);
    });
  }

  var out = {
    push: await wait(push),
    pull: await wait(pull),
  };
  try { await remote.close(); } catch (e) { /* ignore */ }
  return out;
}
