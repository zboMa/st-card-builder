/**
 * 有界大纲续写上下文（千章 · Phase B）
 * SoT：docs/architecture/story-scale.md §6.1
 */

import { getActiveOutline, getActiveChapters } from './state.mjs';
import { graphBriefFromNovel } from './prompts.mjs';
import { branchBrief } from './branch.mjs';
import { collectFeedForwardsBefore } from './feedForward.mjs';

export var OUTLINE_NEAR_WINDOW = 15;
export var OUTLINE_RAG_MAX = 20;

function arcSummaryForOrder(novel, order) {
  var arcs = Array.isArray(novel.arcSummaries) ? novel.arcSummaries : [];
  var hit = arcs.find(function(a) {
    return a && typeof a.startOrder === 'number' && typeof a.endOrder === 'number'
      && order >= a.startOrder && order <= a.endOrder;
  });
  if (hit && hit.summary) return String(hit.summary).trim();
  var vols = Array.isArray(novel.volumes) ? novel.volumes : [];
  var vol = vols.find(function(v) {
    return v && typeof v.startOrder === 'number' && typeof v.endOrder === 'number'
      && order >= v.startOrder && order <= v.endOrder;
  });
  if (vol && vol.arcSummary) return String(vol.arcSummary).trim();
  return '';
}

function tokenRough(s) {
  return Math.ceil(String(s || '').length / 2);
}

/** 简易 BM25 风格：按 direction 关键词在大纲索引里捞相关摘要 */
function retrieveOutlineSnippets(outline, direction, excludeIds, maxItems) {
  var dir = String(direction || '').trim();
  if (!dir || !outline.length) return [];
  var terms = dir.split(/[\s,，、；;]+/).map(function(t) { return t.trim(); }).filter(function(t) { return t.length >= 2; });
  if (!terms.length) return [];

  var ex = excludeIds || {};
  var scored = [];
  outline.forEach(function(o, idx) {
    if (!o || ex[o.id]) return;
    var text = (o.title || '') + ' ' + (o.summary || '');
    var score = 0;
    terms.forEach(function(term) {
      if (text.indexOf(term) >= 0) score += 1;
    });
    if (score > 0) scored.push({ o: o, idx: idx, score: score });
  });
  scored.sort(function(a, b) { return b.score - a.score || a.idx - b.idx; });
  return scored.slice(0, maxItems).map(function(x) { return x.o; });
}

/**
 * @param {object} novel
 * @param {{
 *   mode: 'segment'|'continue'|'branch',
 *   direction?: string,
 *   branchId?: string,
 *   extraHint?: string,
 *   maxTokens?: number,
 * }} opts
 */
export function assembleOutlineContext(novel, opts) {
  var o = opts || {};
  var mode = o.mode || 'segment';
  var branchId = o.branchId || (novel && novel.activeBranchId) || '';
  var direction = String(o.direction || (novel && novel.wizard && novel.wizard.direction) || '').trim();
  var visible = getActiveOutline(novel);
  var chapters = getActiveChapters(novel);
  var maxTok = typeof o.maxTokens === 'number' ? o.maxTokens : 6000;

  var segmentHint = mode === 'continue'
    ? '在已有大纲之后续写 3～5 章。'
    : '生成完整分段大纲，约 8～12 章。';
  if (mode === 'branch') {
    segmentHint = '这是分支世界的续写大纲，请按分支方向续写 3～6 章，承接分叉前剧情但走向不同。';
  }
  var extra = String(o.extraHint || '').trim();
  if (extra) segmentHint += '\n额外要求：' + extra;

  var feeds = collectFeedForwardsBefore(chapters, chapters.length);
  var feedBrief = feeds.slice(0, 6).map(function(f) {
    return (f.order + 1) + '. ' + f.title + ' — ' + String(f.summary || '').slice(0, 100);
  }).join('\n');

  var existingOutline = '';
  if (mode === 'continue' || mode === 'branch') {
    var cursor = visible.length;
    var start = Math.max(0, cursor - OUTLINE_NEAR_WINDOW);
    var end = Math.min(visible.length, cursor + OUTLINE_NEAR_WINDOW);
    var nearLines = [];
    for (var i = start; i < end; i++) {
      var ol = visible[i];
      nearLines.push((i + 1) + '. ' + ol.title + ' — ' + String(ol.summary || '').slice(0, 200));
    }
    var parts = [];
    if (nearLines.length) parts.push('【近邻大纲】\n' + nearLines.join('\n'));

    var arcOrder = visible.length ? visible[visible.length - 1].order : 0;
    var arc = arcSummaryForOrder(novel, arcOrder);
    if (arc) parts.push('【当前弧/卷摘要】\n' + arc);

    var nearIds = {};
    visible.slice(start, end).forEach(function(ol) { if (ol && ol.id) nearIds[ol.id] = true; });
    var retrieved = retrieveOutlineSnippets(
      novel.outline || [],
      direction,
      nearIds,
      OUTLINE_RAG_MAX
    );
    if (retrieved.length) {
      parts.push('【相关历史大纲摘要】\n' + retrieved.map(function(ol, ri) {
        return (ri + 1) + '. ' + ol.title + ' — ' + String(ol.summary || '').slice(0, 120);
      }).join('\n'));
    }
    existingOutline = parts.join('\n\n');
  } else if (visible.length) {
    existingOutline = visible.map(function(ol, idx) {
      return (idx + 1) + '. ' + ol.title + ' — ' + String(ol.summary || '').slice(0, 200);
    }).join('\n');
  }

  // 硬上限：截断 existingOutline
  while (existingOutline && tokenRough(existingOutline) > maxTok * 0.55) {
    existingOutline = existingOutline.slice(0, Math.floor(existingOutline.length * 0.85));
    var lastNl = existingOutline.lastIndexOf('\n');
    if (lastNl > 0) existingOutline = existingOutline.slice(0, lastNl);
    existingOutline += '\n…（已截断）';
    break;
  }

  return {
    title: novel.title,
    direction: direction,
    branchHint: branchBrief(novel, branchId),
    graphBrief: graphBriefFromNovel(novel),
    existingOutline: existingOutline,
    feedForwardBrief: feedBrief,
    segmentHint: segmentHint,
  };
}
