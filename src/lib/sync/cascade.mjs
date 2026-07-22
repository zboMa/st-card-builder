/**
 * 删卡级联：本地由调用方清 LS/IDB；此处删云端完整关联
 */
import { cloudDeleteCard } from './cloudStore.mjs';
import { buildCardIndexFromDrafts } from './docIds.mjs';

export async function cascadeDeleteCardDocs(cardId, remainingDraftsMap) {
  var id = String(cardId || '').trim();
  if (!id) return;
  await cloudDeleteCard(id);
  if (remainingDraftsMap) {
    buildCardIndexFromDrafts(remainingDraftsMap);
  }
}
