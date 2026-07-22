/**
 * 云端存储：Story Studio 独立同步（拆自 cloudStore）
 */
import * as api from './cloudApi.mjs';
import { idbSetJson } from '../idbStore.mjs';
import { catalogNovelsList } from './docIds.mjs';
import { withCloudOrOutbox, isCloudEnabled } from './cloudStoreShared.mjs';

export async function cloudSaveStoryCatalog(cardId, catalog) {
  var id = String(cardId || '').trim();
  var list = catalogNovelsList(catalog);
  return withCloudOrOutbox('putStoryCatalog', function() {
    return api.putStoryCatalog(id, list);
  }, {
    op: 'putStoryCatalog',
    cardId: id,
    body: { data: list },
    dedupeKey: 'putStoryCatalog:' + id,
  });
}

export async function cloudSaveStoryNovel(cardId, novel) {
  var id = String(cardId || '').trim();
  if (!novel || !novel.id) return;
  return withCloudOrOutbox('putStoryNovel', function() {
    return api.putStoryNovel(id, novel);
  }, {
    op: 'putStoryNovel',
    cardId: id,
    body: { data: novel },
    dedupeKey: 'putStoryNovel:' + id + ':' + novel.id,
  });
}

export async function cloudSaveStoryActive(cardId, novelId) {
  var id = String(cardId || '').trim();
  return withCloudOrOutbox('putStoryActive', function() {
    return api.putStoryActive(id, novelId);
  }, {
    op: 'putStoryActive',
    cardId: id,
    body: { novelId: novelId },
    dedupeKey: 'putStoryActive:' + id,
  });
}

export async function cloudSaveStoryRelease(cardId, novelId, release) {
  var id = String(cardId || '').trim();
  var nid = String(novelId || '').trim();
  return withCloudOrOutbox('putStoryRelease', function() {
    return api.putStoryRelease(id, nid, release);
  }, {
    op: 'putStoryRelease',
    cardId: id,
    body: { novelId: nid, data: release },
    dedupeKey: 'putStoryRelease:' + id + ':' + nid,
  });
}

export async function cloudRemoveStoryNovel(cardId, novelId) {
  var id = String(cardId || '').trim();
  var nid = String(novelId || '').trim();
  return withCloudOrOutbox('deleteStoryNovel', function() {
    return api.deleteStoryNovel(id, nid);
  }, {
    op: 'deleteStoryNovel',
    cardId: id,
    body: { novelId: nid },
    dedupeKey: 'deleteStoryNovel:' + id + ':' + nid,
  });
}
export async function pullStoryCatalogToLocal(cardId) {
  var id = String(cardId || '').trim();
  if (!id || !isCloudEnabled()) return null;
  var res = await api.getStoryCatalog(id);
  var list = Array.isArray(res && res.data) ? res.data : catalogNovelsList(res && res.doc);
  await idbSetJson('storyStudioV1:catalog:card:' + id, list);
  try {
    var activeRes = await api.getStoryActive(id);
    if (activeRes && activeRes.data) {
      await idbSetJson('storyStudioV1:active:card:' + id, activeRes.data);
    }
  } catch (e) { /* optional */ }
  return list;
}

/**
 * Story 独立：拉单部小说工作稿
 */
export async function pullStoryNovelToLocal(cardId, novelId) {
  var id = String(cardId || '').trim();
  var nid = String(novelId || '').trim();
  if (!id || !nid || !isCloudEnabled()) return null;
  var res = await api.getStoryNovel(id, nid);
  var data = res && (res.data != null ? res.data : null);
  if (!data) return null;
  await idbSetJson('storyStudioV1:card:' + id + ':' + nid, data);
  return data;
}
