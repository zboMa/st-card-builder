/**
 * 小说分析面板：分片配置、RAG、骨架、丰满、关系、图谱
 */
import { attachNovelAnalyzeRender } from './analyzeRender.mjs';
import { attachNovelAnalyzeBind } from './analyzeBind.mjs';
import { attachNovelAnalyzeRun } from './analyzeRun.mjs';

export { novelCanonBlock, vesselOptsFromState, ENTITY_TYPE_ZH } from './analyzeShared.mjs';

export function registerAnalyze(ctx) {
  var panel = {};
  var graphRef = { cy: null };
  attachNovelAnalyzeRender(ctx, panel, graphRef);
  attachNovelAnalyzeBind(ctx, panel, graphRef);
  attachNovelAnalyzeRun(ctx, panel);
  ctx.panels.analyze = panel;
}
