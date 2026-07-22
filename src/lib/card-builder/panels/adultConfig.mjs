/**
 * 世界与限定面板：世界观预设 + 载体框架 + NSFW / NTL / 恶堕
 * NSFW 段不注入主角 Description / 开场白生成；预设喂给 AI 引擎。
 */
import { createAdultConfigShared } from './adultConfigShared.mjs';
import { attachAdultConfigPanel } from './adultConfigPanel.mjs';
import { attachAdultConfigBind } from './adultConfigBind.mjs';

export function registerAdultConfig(ctx) {
  var panel = {};
  var s = createAdultConfigShared(ctx);
  attachAdultConfigPanel(ctx, s, panel);
  attachAdultConfigBind(ctx, s, panel);
  ctx.panels.adultConfig = panel;
}
