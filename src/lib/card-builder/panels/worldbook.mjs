/**
 * 世界书面板 — 提取自 index.astro lines 2195–3342
 * 注册为 ctx.panels.worldbook；在 bind() 中挂载 DOM 事件与 window.__assistantWbAi__
 */
import { createWorldbookShared } from './worldbookShared.mjs';
import { attachWorldbookBind } from './worldbookBind.mjs';

export function registerWorldbook(ctx) {
  var panel = {};
  var s = createWorldbookShared(ctx);
  s.bindPanel(panel);
  attachWorldbookBind(ctx, s, panel);
  ctx.panels.worldbook = {
    renderEntriesList: s.renderEntriesList,
    renderSearchResults: s.renderWbSearchResults,
    renderOrganizePreview: s.renderOrganizePreview,
    generateTriggerKeysBatch: s.generateTriggerKeysBatch,
    applyTriggerKeySuggestions: s.applyTriggerKeySuggestions,
    openWbModal: s.openWbModal,
    closeWbModal: s.closeWbModal,
    resetWBForm: s.resetWBForm,
    bindModals: panel.bindModals,
  };
  // 注意：不要在此调用 bindModals()。browserApp.safeBind('worldbook', …) 会挂一次；
  // 若此处再调，保存/新建监听器会双绑 → 校验弹两遍、成功新增两条。
}
