/**
 * 角色卡管理面板的列表视图状态（Nanostores）。
 * 注意：这是「视图快照」，权威数据仍在 cardState() / draftsStore；
 * 本 store 只服务卡管理面板渲染，随时可由 render() 重建。
 */
import { atom } from 'nanostores';

export function defaultCardListState() {
  return {
    cards: [],
    totalCount: 0,
    empty: true,
    filteredEmpty: false,
    query: '',
    allTags: [],
    selectedTags: [],
    tagPopupOpen: false,
    exportModalOpen: false,
    exportCheck: {
      items: [],
      critical: 0,
      warning: 0,
      ok: true,
      summary: '',
      summaryText: '',
      canExportPng: false,
    },
    cloudLoggedIn: false,
  };
}

export const cardListStore = atom(defaultCardListState());

export function setCardList(patch) {
  cardListStore.set(Object.assign({}, cardListStore.get(), patch || {}));
}

export function getCardList() {
  return cardListStore.get();
}

export function resetCardList() {
  cardListStore.set(defaultCardListState());
}
