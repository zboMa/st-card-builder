/**
 * AI 引擎面板：register + 模块组装
 */
import { createAiEngineShared } from './aiEngineShared.mjs';
import { attachAiEnginePanel } from './aiEnginePanel.mjs';
import { attachAiEngineBind } from './aiEngineBind.mjs';

export function registerAiEngine(ctx) {
  var panel = {};
  var s = createAiEngineShared(ctx);
  attachAiEnginePanel(ctx, s, panel);
  attachAiEngineBind(ctx, s, panel);
  ctx.panels.aiEngine = panel;
}
