/**
 * 世界与限定面板的瞬时 UI 状态（不进入卡状态）。
 * 卡数据仍以 cardStore 为唯一真相源；这里只放 busy / 添加弹窗等视图态。
 */
import { atom } from 'nanostores';

export const adultUiStore = atom({
  busy: '',
  addModal: { open: false, kind: '' },
});

export function patchAdultUi(patch) {
  adultUiStore.set(Object.assign({}, adultUiStore.get(), patch || {}));
}

export function setAdultBusy(kind) {
  patchAdultUi({ busy: kind || '' });
}

export function openAdultAddModal(kind) {
  patchAdultUi({ addModal: { open: !!kind, kind: kind || '' } });
}

export function closeAdultAddModal() {
  patchAdultUi({ addModal: { open: false, kind: '' } });
}
