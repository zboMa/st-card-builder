/**
 * 删卡级联：绑卡套件始终删；Story 写出小说由 deleteStories 决定
 */
import { cloudDeleteCard } from './cloudStore.mjs';
import { buildCardIndexFromDrafts } from './docIds.mjs';

/**
 * @param {string} cardId
 * @param {object} [remainingDraftsMap]
 * @param {{ deleteStories?: boolean }} [opts]
 */
export async function cascadeDeleteCardDocs(cardId, remainingDraftsMap, opts) {
  opts = opts || {};
  var id = String(cardId || '').trim();
  if (!id) return;
  await cloudDeleteCard(id, { deleteStories: !!opts.deleteStories });
  if (remainingDraftsMap) {
    buildCardIndexFromDrafts(remainingDraftsMap);
  }
}
