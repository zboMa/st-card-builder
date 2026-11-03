/**
 * 世界书面板派生 UI 快照；权威数据仍是 cardStore.worldbookEntries。
 */
import { atom } from 'nanostores';

export function emptyWorldbookEdit() {
  return {
    isNew: false,
    index: -1,
    error: '',
    editor: null,
  };
}

export const worldbookStore = atom({
  query: '',
  scopeTitle: true,
  scopeKeys: true,
  scopeContent: true,
  family: 'all',
  rows: [],
  countText: '0 条',
  tokenText: '',
  tokenTitle: '',
  searchHits: [],
  searchCountText: '',
  modal: '',
  edit: emptyWorldbookEdit(),
  single: { prompt: '', includeCharData: false, includeOtherEntries: true, busy: false },
  organize: { busy: false, status: '', statusKind: '', preview: [], suggestions: [] },
  keygen: { busy: false, status: '', statusKind: '' },
});

export function patchWorldbook(patch) {
  worldbookStore.set(Object.assign({}, worldbookStore.get(), patch || {}));
}

export function patchWorldbookEditor(patch) {
  var cur = worldbookStore.get().edit || emptyWorldbookEdit();
  patchWorldbook({ edit: Object.assign({}, cur, patch || {}) });
}
