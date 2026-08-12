/**
 * 流式 TXT 导出（千章 · Phase D）
 */

import { normalizeNovel, getActiveChapters, getActiveOutline } from './state.mjs';
import { getBranch } from './branch.mjs';
import { ensureChapterBodyLoaded } from './storyStorage.mjs';

function chapterBlock(ch, idx, includeSummaryFallback) {
  var title = String(ch.title || ('第' + (idx + 1) + '章')).trim();
  var parts = [title, ''];
  var body = String(ch.content || '').trim();
  if (!body && includeSummaryFallback !== false) {
    var sum = String(ch.summary || '').trim();
    if (sum) body = '【摘要】\n' + sum;
  }
  parts.push(body || '（暂无正文）');
  parts.push('');
  parts.push('——');
  parts.push('');
  return parts.join('\n');
}

/**
 * @param {string} cardId
 * @param {object} novel
 * @param {{ branchId?: string, includeSummaryFallback?: boolean }} [opts]
 * @yields {string}
 */
export async function* iterNovelTxtChunks(cardId, novel, opts) {
  var options = opts || {};
  var n = normalizeNovel(novel);
  var cid = String(cardId || n.cardId || '');

  var header = [n.title || '未命名小说'];
  var br = getBranch(n, options.branchId || n.activeBranchId);
  if (br && br.name) {
    header.push('（分支：' + br.name + (br.direction ? ' · ' + br.direction : '') + '）');
  }
  header.push('', '——', '');
  yield header.join('\n');

  var view = options.branchId
    ? Object.assign({}, n, { activeBranchId: options.branchId })
    : n;
  var chapters = getActiveChapters(view);
  if (!chapters.length) {
    var outline = getActiveOutline(view);
    chapters = outline.map(function(o, i) {
      return { id: o.id, title: o.title, summary: o.summary, content: '', order: i };
    });
  }

  for (var i = 0; i < chapters.length; i++) {
    var ch = chapters[i];
    if (ch && ch.id && cid) {
      await ensureChapterBodyLoaded(cid, view, ch.id);
      ch = getActiveChapters(view).find(function(c) { return c && c.id === chapters[i].id; }) || ch;
    }
    yield chapterBlock(ch, i, options.includeSummaryFallback);
  }
}

/** @param {string} cardId @param {object} novel @param {object} [opts] */
export async function novelToTxtStream(cardId, novel, opts) {
  var parts = [];
  for await (var chunk of iterNovelTxtChunks(cardId, novel, opts)) {
    parts.push(chunk);
  }
  return parts.join('').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
