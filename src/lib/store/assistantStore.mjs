/**
 * 右栏 AI 助手的 UI 状态（Nanostores）。
 *
 * 权威消息在 `assistantMessageStore.mjs`；本 store 只保存输入、状态、
 * 弹窗等非消息视图，`assistantStageStore` 保存 pending 相关字段。
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
    tokenLabel: '',
    tokenTitle: '',
    ragPreviewBusy: false,
    quickChips: [],
    sheetOpen: false,
    ragModal: { open: false, meta: '', body: '' },
    contextModal: { open: false, meta: '', sections: [], activeId: '' },
  };
}

export function defaultAssistantStage() {
  return {
    pendingHint: '',
    pending: null,
    showAutoApplyButton: true,
  };
}

export const assistantStore = atom(defaultAssistantView());
export const assistantStageStore = atom(defaultAssistantStage());

var STAGE_KEYS = ['pendingHint', 'pending', 'showAutoApplyButton'];

export function patchAssistantStage(patch) {
  assistantStageStore.set(Object.assign({}, assistantStageStore.get(), patch || {}));
}

export function patchAssistantView(patch) {
  var changes = patch || {};
  var next = Object.assign({}, assistantStore.get(), changes);
  var stagePatch = {};
  var uiChanged = false;
  STAGE_KEYS.forEach(function(key) {
    if (Object.prototype.hasOwnProperty.call(changes, key)) stagePatch[key] = changes[key];
    if (!Object.prototype.hasOwnProperty.call(next, key)) return;
    delete next[key];
  });
  Object.keys(changes).forEach(function(key) {
    if (STAGE_KEYS.indexOf(key) < 0) uiChanged = true;
  });
  if (uiChanged) assistantStore.set(next);
  if (Object.keys(stagePatch).length) patchAssistantStage(stagePatch);
}

export function getAssistantView() {
  return assistantStore.get();
}

export function resetAssistantView() {
  assistantStore.set(defaultAssistantView());
  assistantStageStore.set(defaultAssistantStage());
}
