/**
 * 世界书面板：register + 模块组装
 */
import { attachNovelWorldbookRender } from './worldbookRender.mjs';
import { attachNovelWorldbookAi } from './worldbookAi.mjs';

export { normalizeNameList, formatPriorWbExtractRef, mergeWbExtractEntry } from './worldbookExtractUtil.mjs';

export function registerWorldbook(ctx) {
  var panel = {};
  attachNovelWorldbookRender(ctx, panel);
  attachNovelWorldbookAi(ctx, panel);
  ctx.panels.worldbook = panel;
}
