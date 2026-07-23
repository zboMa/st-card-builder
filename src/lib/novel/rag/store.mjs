/**
 * 小说 RAG 索引 IndexedDB 存储（按 cardId）
 */
import { idbGetJson, idbSetJson, idbDeleteJson } from '../../idbStore.mjs';

export var RAG_INDEX_VERSION = 1;

/** @param {string} cardId */
export function novelRagKey(cardId) {
  var id = String(cardId || '').trim();
  if (!id) return '';
  return 'novelRagV1:card:' + id;
}

/** @returns {{ version: number, cardId: string, embedModel: string, dims: number, updatedAt: string, chunks: object[] }} */
export function emptyRagIndex(cardId) {
  return {
    version: RAG_INDEX_VERSION,
    cardId: String(cardId || ''),
    embedModel: '',
    dims: 0,
    updatedAt: '',
    chunks: [],
  };
}

export async function loadRagIndex(cardId) {
  var key = novelRagKey(cardId);
  if (!key) return emptyRagIndex(cardId);
  try {
    var data = await idbGetJson(key);
    if (!data || typeof data !== 'object') return emptyRagIndex(cardId);
    if (!Array.isArray(data.chunks)) data.chunks = [];
    return data;
  } catch (e) {
    return emptyRagIndex(cardId);
  }
}

export async function saveRagIndex(cardId, index) {
  var key = novelRagKey(cardId);
  if (!key) return false;
  var payload = index && typeof index === 'object' ? index : emptyRagIndex(cardId);
  payload.cardId = String(cardId || '');
  payload.version = RAG_INDEX_VERSION;
  payload.updatedAt = new Date().toISOString();
  await idbSetJson(key, payload);
  try {
    var revMod = await import('../../sync/contentRev.mjs');
    revMod.bumpCardBundleTouch(cardId);
  } catch (eRev) { /* ignore */ }
  return true;
}

export async function deleteRagIndex(cardId) {
  var key = novelRagKey(cardId);
  if (!key) return false;
  await idbDeleteJson(key);
  return true;
}
