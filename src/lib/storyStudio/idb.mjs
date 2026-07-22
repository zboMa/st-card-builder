/**
 * 小说创作 IndexedDB 键与读写（复用 st-card-builder json store）
 */

import {
  idbGetJson,
  idbSetJson,
  idbDeleteJson,
} from '../idbStore.mjs';

export var STORY_STUDIO_PREFIX = 'storyStudioV1';

/** 单部小说：storyStudioV1:card:{cardId}:{novelId} */
export function storyNovelKey(cardId, novelId) {
  var c = String(cardId || '').trim();
  var n = String(novelId || '').trim();
  if (!c || !n) return '';
  return STORY_STUDIO_PREFIX + ':card:' + c + ':' + n;
}

/** 某卡的小说目录：storyStudioV1:catalog:card:{cardId} */
export function storyCatalogKey(cardId) {
  var c = String(cardId || '').trim();
  if (!c) return '';
  return STORY_STUDIO_PREFIX + ':catalog:card:' + c;
}

/** 当前打开的小说 id：storyStudioV1:active:card:{cardId} */
export function storyActiveKey(cardId) {
  var c = String(cardId || '').trim();
  if (!c) return '';
  return STORY_STUDIO_PREFIX + ':active:card:' + c;
}

export async function loadCatalog(cardId) {
  var key = storyCatalogKey(cardId);
  if (!key) return [];
  var raw = await idbGetJson(key);
  return Array.isArray(raw) ? raw : [];
}

export async function saveCatalog(cardId, list) {
  var key = storyCatalogKey(cardId);
  if (!key) return false;
  await idbSetJson(key, Array.isArray(list) ? list : []);
  return true;
}

export async function loadNovel(cardId, novelId) {
  var key = storyNovelKey(cardId, novelId);
  if (!key) return null;
  return idbGetJson(key);
}

export async function saveNovel(cardId, novelId, data) {
  var key = storyNovelKey(cardId, novelId);
  if (!key) return false;
  await idbSetJson(key, data);
  return true;
}

export async function deleteNovel(cardId, novelId) {
  var key = storyNovelKey(cardId, novelId);
  if (!key) return false;
  await idbDeleteJson(key);
  return true;
}

export async function loadActiveNovelId(cardId) {
  var key = storyActiveKey(cardId);
  if (!key) return '';
  var raw = await idbGetJson(key);
  return raw && typeof raw === 'object' && raw.novelId
    ? String(raw.novelId)
    : (typeof raw === 'string' ? raw : '');
}

export async function saveActiveNovelId(cardId, novelId) {
  var key = storyActiveKey(cardId);
  if (!key) return false;
  await idbSetJson(key, { novelId: String(novelId || ''), updatedAt: Date.now() });
  return true;
}

/** 已发布快照：storyStudioV1:release:card:{cardId}:{novelId} */
export function storyReleaseKey(cardId, novelId) {
  var c = String(cardId || '').trim();
  var n = String(novelId || '').trim();
  if (!c || !n) return '';
  return STORY_STUDIO_PREFIX + ':release:card:' + c + ':' + n;
}

export async function loadRelease(cardId, novelId) {
  var key = storyReleaseKey(cardId, novelId);
  if (!key) return null;
  return idbGetJson(key);
}

export async function saveRelease(cardId, novelId, data) {
  var key = storyReleaseKey(cardId, novelId);
  if (!key) return false;
  await idbSetJson(key, data);
  return true;
}

export async function deleteRelease(cardId, novelId) {
  var key = storyReleaseKey(cardId, novelId);
  if (!key) return false;
  await idbDeleteJson(key);
  return true;
}

/** 删除某卡下全部写出的小说（本地 IDB） */
export async function deleteAllStoriesForCard(cardId) {
  var c = String(cardId || '').trim();
  if (!c) return false;
  var catalog = await loadCatalog(c);
  for (var i = 0; i < catalog.length; i++) {
    var nid = catalog[i] && (catalog[i].id || catalog[i].novelId);
    if (!nid) continue;
    try { await deleteNovel(c, nid); } catch (e) { /* ignore */ }
    try { await deleteRelease(c, nid); } catch (e) { /* ignore */ }
  }
  try { await idbDeleteJson(storyCatalogKey(c)); } catch (e) { /* ignore */ }
  try { await idbDeleteJson(storyActiveKey(c)); } catch (e) { /* ignore */ }
  return true;
}
