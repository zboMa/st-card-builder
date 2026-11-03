/**
 * 酒馆脚本：瞬时 UI 状态（列表选择 + 编辑器草稿）。
 */
import { atom } from 'nanostores';

export function emptyTavernEditor() {
  return {
    id: '',
    name: '',
    type: 'script',
    enabled: true,
    info: '',
    content: '',
    buttonEnabled: true,
    buttonJson: '[]',
    dataJson: '{}',
  };
}

export const tavernScriptsStore = atom({
  selectedId: '',
  editor: emptyTavernEditor(),
  liveHint: '',
  liveHintKind: '',
  status: '',
  statusKind: '',
});

export function patchTavernScriptsUi(patch) {
  tavernScriptsStore.set(Object.assign({}, tavernScriptsStore.get(), patch || {}));
}

export function patchTavernEditor(patch) {
  var cur = tavernScriptsStore.get().editor || emptyTavernEditor();
  patchTavernScriptsUi({ editor: Object.assign({}, cur, patch || {}) });
}

export function setTavernLiveHint(text, kind) {
  patchTavernScriptsUi({
    liveHint: String(text || ''),
    liveHintKind: kind || '',
  });
}

export function setTavernStatus(text, kind) {
  patchTavernScriptsUi({
    status: String(text || ''),
    statusKind: kind || '',
  });
}
