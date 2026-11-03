import { initStatusBarPanel } from '../../statusBar/panelBoot.mjs';

export function registerStatusBar(ctx) {
  var bridge = initStatusBarPanel(ctx);
  ctx.panels.statusBar = {
    bind: bridge.refresh,
    publish: bridge.refresh,
  };
}
