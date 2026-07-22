/**
 * 人物面板：渲染、绑定、扫描、扩展、档案编辑
 */
import { attachNovelCharactersRender } from './charactersRender.mjs';
import { attachNovelCharactersExpand } from './charactersExpand.mjs';
import { attachNovelCharactersScanBind } from './charactersScanBind.mjs';

export function registerCharacters(ctx) {
  var panel = {};
  attachNovelCharactersRender(ctx, panel);
  attachNovelCharactersExpand(ctx, panel);
  attachNovelCharactersScanBind(ctx, panel);
  ctx.panels.characters = panel;
}
