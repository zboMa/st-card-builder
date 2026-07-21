/**
 * 删卡时级联清理 Pouch 文档（补齐 RAG / storyStudio / release）
 */
import {
  cardDocId,
  avatarDocId,
  novelDocId,
  ragDocId,
  storyCatalogDocId,
  storyNovelDocId,
  storyActiveDocId,
  storyReleaseDocId,
  buildCardIndexFromDrafts,
} from './docIds.mjs';
import { removeDoc, putDoc, getDoc } from './pouch.mjs';
import { catalogNovelsList } from './storyMirror.mjs';

export async function cascadeDeleteCardDocs(cardId, remainingDraftsMap) {
  var id = String(cardId || '').trim();
  if (!id) return;

  var catalog = await getDoc(storyCatalogDocId(id));
  var novels = catalogNovelsList(catalog);

  var ids = [
    cardDocId(id),
    avatarDocId(id, 'full'),
    avatarDocId(id, 'thumb'),
    novelDocId(id),
    ragDocId(id),
    storyCatalogDocId(id),
    storyActiveDocId(id),
  ];
  if (Array.isArray(novels)) {
    novels.forEach(function(n) {
      var nid = n && (n.id || n.novelId);
      if (nid) {
        ids.push(storyNovelDocId(id, nid));
        ids.push(storyReleaseDocId(id, nid));
      }
    });
  }

  for (var i = 0; i < ids.length; i++) {
    try { await removeDoc(ids[i]); } catch (e) { /* ignore */ }
  }

  if (remainingDraftsMap) {
    await putDoc(buildCardIndexFromDrafts(remainingDraftsMap));
  }
}
