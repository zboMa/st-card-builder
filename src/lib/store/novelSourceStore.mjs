/**
 * 小说原始资料面板的派生 UI 快照（权威状态仍在 novel sm.state）。
 */
import { atom } from 'nanostores';

export function emptyNovelSourceView() {
  return {
    sourceText: '',
    contextText: '',
    narrativeMode: 'story',
    concurrency: '3',
    expandBudget: '12000',
    strictQuality: false,
    file: null,
    stats: [{ text: '等待导入文本' }],
    status: '',
    dragging: false,
  };
}

export const novelSourceStore = atom(emptyNovelSourceView());

export function patchNovelSource(patch) {
  novelSourceStore.set(Object.assign({}, novelSourceStore.get(), patch || {}));
}
