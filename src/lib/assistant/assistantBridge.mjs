/**
 * Vue ⇄ AI 助手引擎的桥。
 *
 * - Vue 组件只调用 `assistantApi.*`，不直接碰 panelBoot 闭包。
 * - panelBoot 在 `initAssistantPanelMain` 末尾 `installAssistantBridge(...)`
 *   注入真实实现（send / stop / apply / retry …）。
 * - 视图数据走 `assistantStore`（由 panelBoot publish）。
 */

var impl = null;

export function installAssistantBridge(next) {
  impl = next || null;
}

export function isAssistantBridgeReady() {
  return !!impl;
}

function call(name, args) {
  if (!impl || typeof impl[name] !== 'function') return undefined;
  return impl[name].apply(null, args || []);
}

export const assistantApi = {
  setMode: function (mode) { return call('setMode', [mode]); },
  closeSheet: function () { return call('closeSheet'); },
  setInput: function (text) { return call('setInput', [text]); },
  primaryAction: function () { return call('primaryAction'); },
  clearSession: function () { return call('clearSession'); },
  undoLastBundle: function () { return call('undoLastBundle'); },
  applyPending: function () { return call('applyPending'); },
  rejectPending: function () { return call('rejectPending'); },
  enableAutoApply: function () { return call('enableAutoApply'); },
  quickInsert: function (index) { return call('quickInsert', [index]); },
  ragPreview: function () { return call('ragPreview'); },
  ragPreviewForMessage: function (index) { return call('ragPreviewForMessage', [index]); },
  openContext: function () { return call('openContext'); },
  closeRagModal: function () { return call('closeRagModal'); },
  closeContextModal: function () { return call('closeContextModal'); },
  retry: function () { return call('retry'); },
  reroll: function () { return call('reroll'); },
};
