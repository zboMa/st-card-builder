/**
 * 世界与限定（adult-config）注册。
 * 逻辑层保留 adultConfigPanel（AI / 目录 / 候选），状态层覆盖 DOM 方法，
 * Vue 通过 adultConfigBridge 读写。
 */
import { createAdultConfigShared } from './adultConfigShared.mjs';
import { attachAdultConfigPanel } from './adultConfigPanel.mjs';
import { attachAdultConfigState } from './adultConfigState.mjs';
import { installAdultConfigBridge } from './adultConfigBridge.mjs';

export function registerAdultConfig(ctx) {
  var panel = {};
  var s = createAdultConfigShared(ctx);
  attachAdultConfigPanel(ctx, s, panel);
  attachAdultConfigState(ctx, s, panel);
  ctx.panels.adultConfig = panel;
  installAdultConfigBridge(ctx, s, panel);
}
