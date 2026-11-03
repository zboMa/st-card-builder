/**
 * 小说原始资料面板纯函数视图快照。
 */
import { DEFAULT_EXPAND_BUDGET } from '../recall.mjs';

export function sourceFileSummary(state) {
  var s = state || {};
  if (!s.fileText || !s.fileMeta) return null;
  return {
    name: String(s.fileMeta.name || ''),
    length: String(s.fileText || '').length,
  };
}

export function sourceStats(gates) {
  var g = gates || {};
  return [
    { text: g.sourceLen ? (g.sourceLen + ' 字') : '等待导入文本' },
    { text: '章节 ' + (g.enabledChapterCount || 0) + '/' + (g.chapterCount || 0) },
    { text: '人物 ' + (g.characterCount || 0) },
    { text: '世界书草稿 ' + (g.wbEntryCount || 0) },
  ];
}

export function buildSourceView(state, gates, ui) {
  var s = state || {};
  var u = ui || {};
  return {
    sourceText: String(s.sourceText || ''),
    contextText: String(s.contextText || ''),
    narrativeMode: String(s.narrativeMode || 'story'),
    concurrency: String(s.concurrency || 3),
    expandBudget: String(s.expandBudget || DEFAULT_EXPAND_BUDGET),
    strictQuality: s.strictQuality === true,
    file: sourceFileSummary(s),
    stats: sourceStats(gates),
    status: String(u.status || ''),
    dragging: u.dragging === true,
  };
}
