/**
 * 公开分享：目标已下架或卡文档已不在时拒绝读取。
 */
import { getUserDoc } from '../data/userDocs.mjs';
import { cardDocId, storyNovelDocId } from '../data/docIds.mjs';
import { isRemoved } from '../admin/content.mjs';

export async function targetRemoved(mapping) {
  if (!mapping || !mapping.ownerUserId || !mapping.cardId) return true;
  var card = await getUserDoc(mapping.ownerUserId, cardDocId(mapping.cardId));
  if (!card || isRemoved(card)) return true;
  if (mapping.novelId || mapping.type === 'novel-share') {
    var novel = await getUserDoc(
      mapping.ownerUserId,
      storyNovelDocId(mapping.cardId, mapping.novelId)
    );
    if (!novel || isRemoved(novel)) return true;
  }
  return false;
}
