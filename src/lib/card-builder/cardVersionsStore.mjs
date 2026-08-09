/**
 * 角色卡版本表（与 cardDraftsV1 分库）
 */
import { idbGetJson, idbSetJson } from '../idbStore.mjs';
import { crc32 } from '../utils.mjs';

export var VERSIONS_STORE_SCHEMA = 1;

function storeKey(cardId) {
  return 'cardVersionsV1:' + String(cardId || '').trim();
}

function emptyStore() {
  return { schema: VERSIONS_STORE_SCHEMA, entries: [] };
}

export async function loadCardVersionsStore(cardId) {
  var id = String(cardId || '').trim();
  if (!id) return emptyStore();
  var raw = await idbGetJson(storeKey(id)).catch(function() { return null; });
  if (!raw || typeof raw !== 'object') return emptyStore();
  return {
    schema: VERSIONS_STORE_SCHEMA,
    entries: Array.isArray(raw.entries) ? raw.entries : [],
  };
}

export async function saveCardVersionsStore(cardId, store) {
  var id = String(cardId || '').trim();
  if (!id) return false;
  var next = {
    schema: VERSIONS_STORE_SCHEMA,
    entries: Array.isArray(store && store.entries) ? store.entries : [],
  };
  await idbSetJson(storeKey(id), next);
  try {
    var rev = computeVersionsManifestRev(next.entries);
    var metaMod = await import('../sync/cardCloudMeta.mjs');
    metaMod.touchLocalManifestRevs(id, { localVersionsManifestRev: rev });
  } catch (eMeta) { /* ignore */ }
  return true;
}

/** manifest 指纹：ver + snapshotRev 排序后 CRC */
export function computeVersionsManifestRev(entries) {
  var list = (Array.isArray(entries) ? entries : []).map(function(e) {
    return String(e.ver || '') + ':' + String(e.snapshotRev || '');
  }).sort();
  var bytes = new TextEncoder().encode(JSON.stringify(list));
  return crc32(bytes).toString(16).padStart(8, '0');
}

export function buildVersionsManifest(entries) {
  var es = Array.isArray(entries) ? entries : [];
  return {
    schema: VERSIONS_STORE_SCHEMA,
    manifestRev: computeVersionsManifestRev(es),
    items: es.map(function(e) {
      return {
        ver: e.ver,
        snapshotRev: e.snapshotRev,
        title: e.title,
        published: !!e.published,
        updatedAt: e.updatedAt || null,
        avatarId: e.avatarRef && e.avatarRef.avatarId ? e.avatarRef.avatarId : '',
      };
    }),
  };
}
