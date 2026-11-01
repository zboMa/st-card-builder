/**
 * 角色设定：瞬时 UI 状态（视图快照），卡片数据仍以 cardStore 为唯一真相源。
 */
import { atom } from 'nanostores';

export const characterUiStore = atom({
  versionBaseline: '1.0',
  tokenTick: 0,
  tagBusy: false,
  avatar: {
    mainUrl: '',
    items: [],
    count: 0,
    max: 20,
    full: false,
    loading: false,
    hasDraft: false,
    emptyText: '请先选择或新建角色卡',
  },
  avatarGen: {
    open: false,
    meta: '',
    prompt: '',
    negative: '',
    showNegative: false,
    status: '',
    statusKind: '',
    images: [],
    busyPrompt: false,
    busyRun: false,
  },
});

export function patchCharacterUi(patch) {
  characterUiStore.set(Object.assign({}, characterUiStore.get(), patch || {}));
}

export function patchAvatar(patch) {
  var cur = characterUiStore.get().avatar || {};
  patchCharacterUi({ avatar: Object.assign({}, cur, patch || {}) });
}

export function patchAvatarGen(patch) {
  var cur = characterUiStore.get().avatarGen || {};
  patchCharacterUi({ avatarGen: Object.assign({}, cur, patch || {}) });
}

export function setVersionBaseline(value) {
  patchCharacterUi({ versionBaseline: String(value || '1.0') });
}

export function bumpTokenTick() {
  patchCharacterUi({ tokenTick: (characterUiStore.get().tokenTick || 0) + 1 });
}

export function setTagBusy(value) {
  patchCharacterUi({ tagBusy: !!value });
}
