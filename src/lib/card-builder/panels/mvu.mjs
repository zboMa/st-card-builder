import { initVariableCardPanel } from '../../mvu/variableCardPanel.mjs';

export function registerMvu(ctx) {
  var bridge = initVariableCardPanel(ctx);
  ctx.panels.mvu = {
    bind: bridge.refresh,
    publish: bridge.refresh,
  };
}
