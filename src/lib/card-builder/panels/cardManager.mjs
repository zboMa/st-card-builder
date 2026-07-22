/**
 * 卡片管理面板：register + 模块组装
 */

import { createCardManagerShared } from './cardManagerShared.mjs';
import { attachCardManagerRender } from './cardManagerRender.mjs';
import { attachCardManagerCrud } from './cardManagerCrud.mjs';
import { attachCardManagerPublishShare } from './cardManagerPublishShare.mjs';
import { attachCardManagerCloud } from './cardManagerCloud.mjs';
import { attachCardManagerExport } from './cardManagerExport.mjs';
import { attachCardManagerBind } from './cardManagerBind.mjs';

export function registerCardManager(ctx) {
  var panel = {};
  var s = createCardManagerShared(ctx);
  s.bindPanel(panel);
  attachCardManagerRender(ctx, s, panel);
  attachCardManagerCrud(ctx, s, panel);
  attachCardManagerPublishShare(ctx, s, panel);
  attachCardManagerCloud(ctx, s, panel);
  attachCardManagerExport(ctx, s, panel);
  attachCardManagerBind(ctx, s, panel);
  ctx.panels.cardManager = panel;
  return panel;
}
