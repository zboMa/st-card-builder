/**
 * 正则面板瞬时 UI 状态（列表选中 + 编辑草稿 + 测试弹窗）。
 */
import { atom } from 'nanostores';
import { PLACEMENT_AI } from '../regexScripts.mjs';

export function emptyRegexEditor() {
  return {
    id: '',
    scriptName: '',
    findRegex: '',
    replaceString: '',
    placement: [PLACEMENT_AI],
    disabled: false,
    markdownOnly: false,
    promptOnly: false,
    runOnEdit: true,
    substituteRegex: false,
    minDepth: '',
    maxDepth: '',
  };
}

export const regexStore = atom({
  selectedId: '',
  editor: emptyRegexEditor(),
  liveHint: '',
  liveHintKind: '',
  status: '',
  statusKind: '',
  testOpen: false,
  testTip: '使用当前选中条目',
  testInput: '',
  testOutput: '',
  testError: '',
});

export function patchRegexUi(patch) {
  regexStore.set(Object.assign({}, regexStore.get(), patch || {}));
}

export function patchRegexEditor(patch) {
  var cur = regexStore.get().editor || emptyRegexEditor();
  patchRegexUi({ editor: Object.assign({}, cur, patch || {}) });
}

export function setRegexPlacement(placement, enabled) {
  var cur = regexStore.get().editor || emptyRegexEditor();
  var set = Array.isArray(cur.placement) ? cur.placement.slice() : [];
  var idx = set.indexOf(placement);
  if (enabled && idx < 0) set.push(placement);
  if (!enabled && idx >= 0) set.splice(idx, 1);
  patchRegexEditor({ placement: set });
}

export function setRegexLiveHint(text, kind) {
  patchRegexUi({
    liveHint: String(text || ''),
    liveHintKind: kind || '',
  });
}

export function setRegexStatus(text, kind) {
  patchRegexUi({
    status: String(text || ''),
    statusKind: kind || '',
  });
}
