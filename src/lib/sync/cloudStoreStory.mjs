/**
 * 云端存储：Story Studio 独立同步（拆自 cloudStore）
 */
import * as api from './cloudApi.mjs';
import { idbSetJson } from '../idbStore.mjs';
import { storyChapterKey } from '../storyStudio/idb.mjs';
import { buildCloudSyncPack } from '../storyStudio/storyStorage.mjs';
import { catalogNovelsList } from './docIds.mjs';
import { withCloudOrOutbox, isCloudEnabled } from './cloudStoreShared.mjs';

async function uploadStoryChapterShards(cardId, novelId, chapters) {
  var list = Array.isArray(chapters) ? chapters : [];
  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    if (!item || !item.id || !item.body) continue;
    await withCloudOrOutbox('putStoryChapter', function() {
      return api.putStoryChapter(cardId, novelId, item.id, item.body);
    }, {
      op: 'putStoryChapter',
      cardId: cardId,
      body: { novelId: novelId, chapterId: item.id, data: item.body },
      dedupeKey: 'putStoryChapter:' + cardId + ':' + novelId + ':' + item.id,
    });
  }
}

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
  var pack = buildCloudSyncPack(novel);
  await withCloudOrOutbox('putStoryNovel', function() {
    return api.putStoryNovel(id, pack.manifest);
  }, {
    op: 'putStoryNovel',
    cardId: id,
    body: { data: pack.manifest },
    dedupeKey: 'putStoryNovel:' + id + ':' + novel.id,
  });
  await uploadStoryChapterShards(id, novel.id, pack.chapters);
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
  var mod = await import('../storyStudio/storyStorage.mjs');
  await mod.saveNovelDocument(id, nid, data);
  return mod.loadNovelDocument(id, nid);
}

/** 拉单章 Body 并写入本地分片 */
export async function pullStoryChapterToLocal(cardId, novelId, chapterId) {
  var id = String(cardId || '').trim();
  var nid = String(novelId || '').trim();
  var chId = String(chapterId || '').trim();
  if (!id || !nid || !chId || !isCloudEnabled()) return null;
  var res = await api.getStoryChapter(id, nid, chId);
  var data = res && (res.data != null ? res.data : null);
  if (!data) return null;
  var key = storyChapterKey(id, nid, chId);
  if (key) await idbSetJson(key, data);
  return data;
}
