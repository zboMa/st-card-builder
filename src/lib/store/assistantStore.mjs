/**
 * 右栏 AI 助手面板的视图快照（Nanostores）。
 *
 * 注意：这是「视图快照」，不是权威数据。
 * 权威数据（uiMessages / pending / busy / 会话）仍在
 * `src/lib/assistant/panelBoot.mjs` 的闭包里；本 store 只服务 Vue 渲染，
 * 随时可由 `publishAssistantView()` 重建。
 */
import { atom } from 'nanostores';

export function defaultAssistantView() {
  return {
    mode: 'assistant',
    busy: false,
    canSend: false,
    status: '',
    input: '',
    focusNonce: 0,
    messages: [],
    pendingHint: '',
    pending: null,
    showAutoApplyButton: true,
    tokenLabel: '',
    tokenTitle: '',
    ragPreviewBusy: false,
    quickChips: [],
    sheetOpen: false,
    ragModal: { open: false, meta: '', body: '' },
    contextModal: { open: false, meta: '', sections: [], activeId: '' },
  };
}

export const assistantStore = atom(defaultAssistantView());

export function patchAssistantView(patch) {
  assistantStore.set(Object.assign({}, assistantStore.get(), patch || {}));
}

export function getAssistantView() {
  return assistantStore.get();
}

export function resetAssistantView() {
  assistantStore.set(defaultAssistantView());
}
