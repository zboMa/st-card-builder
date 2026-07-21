/**
 * 卡草稿 → Pouch 镜像（多端备份写路径）
 */
import {
  cardDocId,
  buildCardIndexFromDrafts,
  novelDocId,
  ragDocId,
  cardReleaseDocId,
  cardReleaseVersionDocId,
} from './docIds.mjs';
import { putDoc } from './pouch.mjs';

export async function mirrorCardDraftToPouch(cardId, draft) {
  var id = String(cardId || '').trim();
  if (!id || !draft) return;
  await putDoc({
    _id: cardDocId(id),
    type: 'card',
    cardId: id,
    data: draft,
    updatedAt: (draft && draft.updatedAt) || new Date().toISOString(),
  });
}

export async function mirrorCardIndexFromDraftsMap(draftsMap) {
  await putDoc(buildCardIndexFromDrafts(draftsMap || {}));
}

export async function mirrorNovelWorkshopToPouch(cardId, bucket) {
  var id = String(cardId || '').trim();
  if (!id || !bucket) return;
  await putDoc({
    _id: novelDocId(id),
    type: 'novel',
    cardId: id,
    data: bucket.data != null ? bucket.data : bucket,
    updatedAt: bucket.updatedAt || new Date().toISOString(),
  });
}

export async function mirrorRagToPouch(cardId, rag) {
  var id = String(cardId || '').trim();
  if (!id || !rag) return;
  await putDoc({
    _id: ragDocId(id),
    type: 'rag',
    cardId: id,
    data: rag.data != null ? rag.data : rag,
    updatedAt: rag.updatedAt || new Date().toISOString(),
  });
}

/** 写入当前 release + 版本历史（不含 PNG 附件；PNG 由服务端接口写入） */
export async function mirrorCardReleaseToPouch(cardId, release) {
  var id = String(cardId || '').trim();
  if (!id || !release) return;
  var ver = String(release.characterVersion || '1.0');
  var doc = {
    type: 'card-release',
    cardId: id,
    characterVersion: ver,
    title: release.title,
    publishedAt: release.publishedAt,
    pngEnabled: !!release.pngEnabled,
    data: release,
    updatedAt: new Date().toISOString(),
  };
  await putDoc(Object.assign({ _id: cardReleaseDocId(id) }, doc));
  await putDoc(Object.assign({ _id: cardReleaseVersionDocId(id, ver) }, doc));
}
