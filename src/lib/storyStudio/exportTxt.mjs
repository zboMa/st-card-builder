/**
 * 小说 TXT 导出
 */

import { normalizeNovel, getActiveChapters, getActiveOutline } from './state.mjs';
import { getBranch } from './branch.mjs';

/**
 * @param {object} novel
 * @param {{ includeSummaryFallback?: boolean, branchId?: string }} [opts]
 * @returns {string}
 */
export function novelToTxt(novel, opts) {
  var options = opts || {};
  var n = normalizeNovel(novel);
  var lines = [];
  lines.push(n.title || '未命名小说');
  var br = getBranch(n, options.branchId || n.activeBranchId);
  if (br && br.name) {
    lines.push('（分支：' + br.name + (br.direction ? ' · ' + br.direction : '') + '）');
  }
  lines.push('');
  lines.push('——');
  lines.push('');

  var chapters = options.branchId
    ? getActiveChapters(Object.assign({}, n, { activeBranchId: options.branchId }))
    : getActiveChapters(n);
  if (!chapters.length) {
    var outline = options.branchId
      ? getActiveOutline(Object.assign({}, n, { activeBranchId: options.branchId }))
      : getActiveOutline(n);
    chapters = outline.map(function(o, i) {
      return { title: o.title, summary: o.summary, content: '', order: i };
    });
  }

  chapters.forEach(function(ch, idx) {
    var title = String(ch.title || ('第' + (idx + 1) + '章')).trim();
    lines.push(title);
    lines.push('');
    var body = String(ch.content || '').trim();
    if (!body && options.includeSummaryFallback !== false) {
      var sum = String(ch.summary || '').trim();
      if (sum) body = '【摘要】\n' + sum;
    }
    if (body) {
      lines.push(body);
    } else {
      lines.push('（暂无正文）');
    }
    lines.push('');
    lines.push('——');
    lines.push('');
  });

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/** 生成安全文件名 */
export function novelTxtFilename(novel) {
  var n = normalizeNovel(novel);
  var name = String(n.title || 'novel')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80);
  return (name || 'novel') + '.txt';
}

/**
 * 浏览器下载 TXT（Node 测试可跳过）
 * @returns {{ filename: string, text: string }|null}
 */
export function downloadNovelTxt(novel) {
  var text = novelToTxt(novel);
  var filename = novelTxtFilename(novel);
  if (typeof document === 'undefined' || typeof Blob === 'undefined') {
    return { filename: filename, text: text };
  }
  var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function() { URL.revokeObjectURL(url); }, 1500);
  return { filename: filename, text: text };
}
