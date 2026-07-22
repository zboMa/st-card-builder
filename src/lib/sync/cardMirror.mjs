/**
 * 卡相关云端保存（替代 Pouch 镜像）
 */
import {
  cloudSaveCard,
  cloudSaveNovel,
  cloudSaveRag,
  cloudSaveCardBundle,
} from './cloudStore.mjs';
import { buildCardIndexFromDrafts } from './docIds.mjs';
import * as api from './cloudApi.mjs';
import { enqueueOutbox } from './outbox.mjs';
import { isCloudEnabled } from './cloudStore.mjs';

export async function mirrorCardDraftToPouch(cardId, draft) {
  return cloudSaveCard(cardId, draft);
}

export async function mirrorCardIndexFromDraftsMap(draftsMap) {
  return buildCardIndexFromDrafts(draftsMap || {});
}

export async function mirrorNovelWorkshopToPouch(cardId, bucket) {
  return cloudSaveNovel(cardId, bucket);
}

export async function mirrorRagToPouch(cardId, rag) {
  return cloudSaveRag(cardId, rag);
}

/** 发布快照：仍主要由 share API 写服务端；此处同步工作侧 release 文档到用户库 */
export async function mirrorCardReleaseToPouch(cardId, release) {
  var id = String(cardId || '').trim();
  if (!id || !release) return;
  var doc = {
    _id: 'card/' + id + '/release',
    type: 'card-release',
    cardId: id,
    characterVersion: String(release.characterVersion || '1.0'),
    title: release.title,
    publishedAt: release.publishedAt,
    pngEnabled: !!release.pngEnabled,
    data: release,
    updatedAt: new Date().toISOString(),
  };
  if (!isCloudEnabled()) {
    enqueueOutbox({
      op: 'putDoc',
      body: doc,
      dedupeKey: 'putDoc:' + doc._id,
    });
    return;
  }
  try {
    await api.putCloudDoc(doc, { force: true });
    var ver = encodeURIComponent(String(release.characterVersion || '1.0'));
    await api.putCloudDoc(Object.assign({}, doc, {
      _id: 'card/' + id + '/release/' + ver,
    }), { force: true });
  } catch (e) {
    enqueueOutbox({
      op: 'putDoc',
      body: doc,
      dedupeKey: 'putDoc:' + doc._id,
    });
  }
}

export async function pushFullCardBundle(cardId) {
  return cloudSaveCardBundle(cardId);
}
