/**
 * 世界书面板：注册共享逻辑 + Vue 桥。
 */
import { createWorldbookShared } from './worldbookShared.mjs';
import { attachWorldbookBridge } from './worldbookBridge.mjs';

export function registerWorldbook(ctx) {
  var panel = {};
  var s = createWorldbookShared(ctx);
  s.bindPanel(panel);
  var bridge = attachWorldbookBridge(ctx, s, panel);
  ctx.panels.worldbook = {
    renderEntriesList: s.renderEntriesList,
    renderSearchResults: s.renderWbSearchResults,
    renderOrganizePreview: s.renderOrganizePreview,
    generateTriggerKeysBatch: s.generateTriggerKeysBatch,
    applyTriggerKeySuggestions: s.applyTriggerKeySuggestions,
    openWbModal: s.openWbModal,
    closeWbModal: s.closeWbModal,
    resetWBForm: s.resetWBForm,
    bindModals: bridge.bind,
  };
}
