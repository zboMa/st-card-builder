/**
 * 叙事 Memory：卷/弧摘要（千章 · Phase D+）
 * SoT：docs/architecture/story-scale.md §6.3
 */

import { genStoryId } from './state.mjs';
import { ensureChapterBodyLoaded } from './storyStorage.mjs';
import { collectFeedForwardsBefore } from './feedForward.mjs';

export var ARC_AUTO_EVERY = 50;

function ensureArcArrays(novel) {
  if (!Array.isArray(novel.arcSummaries)) novel.arcSummaries = [];
  if (!Array.isArray(novel.volumes)) novel.volumes = [];
}

export function arcCoversOrder(novel, order) {
  ensureArcArrays(novel);
  return novel.arcSummaries.some(function(a) {
    return a && typeof a.startOrder === 'number' && typeof a.endOrder === 'number'
      && order >= a.startOrder && order <= a.endOrder;
  });
}

/**
 * @param {object} novel
 * @param {number} startOrder
 * @param {number} endOrder
 * @param {string} summary
 */
export function upsertArcSummary(novel, startOrder, endOrder, summary) {
  ensureArcArrays(novel);
  var text = String(summary || '').trim();
  if (!text) return null;
  var existing = novel.arcSummaries.find(function(a) {
    return a && a.startOrder === startOrder && a.endOrder === endOrder;
  });
  if (existing) {
    existing.summary = text;
    existing.generatedAt = Date.now();
    return existing;
  }
  var item = {
    id: genStoryId('arc'),
    startOrder: startOrder,
    endOrder: endOrder,
    summary: text,
    generatedAt: Date.now(),
  };
  novel.arcSummaries.push(item);
  return item;
}

/**
 * @param {object} novel
 * @param {{ outlineIndex: number, title?: string }} opts
 */
export function markVolumeEnd(novel, opts) {
  opts = opts || {};
  ensureArcArrays(novel);
  var idx = Math.max(0, Number(opts.outlineIndex) || 0);
  var ol = (novel.outline || [])[idx];
  if (!ol) throw new Error('大纲条目不存在');
  var endOrder = typeof ol.order === 'number' ? ol.order : idx;
  var prevEnd = -1;
  novel.volumes.forEach(function(v) {
    if (v && typeof v.endOrder === 'number' && v.endOrder > prevEnd) prevEnd = v.endOrder;
  });
  var startOrder = prevEnd + 1;
  var vol = {
    id: genStoryId('vol'),
    title: String(opts.title || ol.title || ('第' + (novel.volumes.length + 1) + '卷')).trim(),
    startOrder: startOrder,
    endOrder: endOrder,
    arcSummary: '',
    createdAt: Date.now(),
  };
  novel.volumes.push(vol);
  return vol;
}

function bindArcToVolume(novel, vol, summary) {
  if (!vol) return;
  vol.arcSummary = String(summary || '').trim();
  upsertArcSummary(novel, vol.startOrder, vol.endOrder, summary);
}

/**
 * @param {object} deps { callAI, promptText }
 * @param {string} cardId
 * @param {object} novel
 * @param {number} startOrder
 * @param {number} endOrder
 */
export async function generateArcSummaryForRange(deps, cardId, novel, startOrder, endOrder) {
  var d = deps || {};
  var cid = String(cardId || novel.cardId || '');
  var chapters = (novel.chapters || []).filter(function(c) {
    return c && typeof c.order === 'number' && c.order >= startOrder && c.order <= endOrder;
  }).sort(function(a, b) { return a.order - b.order; });

  for (var i = 0; i < chapters.length; i++) {
    if (chapters[i].id) await ensureChapterBodyLoaded(cid, novel, chapters[i].id);
  }
  chapters = (novel.chapters || []).filter(function(c) {
    return c && typeof c.order === 'number' && c.order >= startOrder && c.order <= endOrder;
  }).sort(function(a, b) { return a.order - b.order; });

  var outlineBits = (novel.outline || []).filter(function(o) {
    return o && typeof o.order === 'number' && o.order >= startOrder && o.order <= endOrder;
  }).map(function(o) {
    return o.title + ' — ' + String(o.summary || '').slice(0, 120);
  }).join('\n');

  var feeds = collectFeedForwardsBefore(chapters, chapters.length).slice(-8).map(function(f) {
    return f.title + '：' + String(f.summary || '').slice(0, 80);
  }).join('\n');

  var user = '【小说】' + (novel.title || '') + '\n'
    + '【弧段】第 ' + (startOrder + 1) + '～' + (endOrder + 1) + ' 章（order ' + startOrder + '–' + endOrder + '）\n'
    + '【大纲摘要】\n' + (outlineBits || '（无）') + '\n'
    + '【章后记忆】\n' + (feeds || '（无）') + '\n'
    + '请输出 200～400 字弧段摘要（中文），概括冲突推进、人物变化与未收束伏笔；只输出摘要正文。';

  var system = d.promptText(
    'storyArcSummary',
    '你是长篇叙事编辑，擅长压缩弧段摘要。'
  );
  var text = await d.callAI(user, system);
  return String(text || '').trim();
}

/**
 * @param {object} deps
 * @param {string} cardId
 * @param {object} novel
 * @param {object} [vol] 可选卷界
 */
export async function runArcSummaryTask(deps, cardId, novel, vol) {
  var start = vol ? vol.startOrder : 0;
  var end = vol ? vol.endOrder : 0;
  if (vol == null) {
    var maxOrder = -1;
    (novel.chapters || []).forEach(function(c) {
      if (c && typeof c.order === 'number' && c.order > maxOrder) maxOrder = c.order;
    });
    end = maxOrder;
    start = Math.max(0, end - ARC_AUTO_EVERY + 1);
  }
  if (end < start) return '';
  if (arcCoversOrder(novel, end)) return '';
  var summary = await generateArcSummaryForRange(deps, cardId, novel, start, end);
  upsertArcSummary(novel, start, end, summary);
  if (vol) bindArcToVolume(novel, vol, summary);
  return summary;
}

/**
 * 写章后：每 ARC_AUTO_EVERY 章尝试自动生成弧摘要
 */
export async function maybeAutoArcAfterChapter(deps, cardId, novel, chapter) {
  if (!chapter || typeof chapter.order !== 'number') return;
  var end = chapter.order;
  if ((end + 1) % ARC_AUTO_EVERY !== 0) return;
  if (arcCoversOrder(novel, end)) return;
  await runArcSummaryTask(deps, cardId, novel, null);
}
