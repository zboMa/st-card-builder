/**
 * 章后 Feed-forward：摘要 / 开放线 / 张力 / 伏笔建议
 */

/**
 * @param {string} text
 * @returns {{ summary: string, openThreads: string[], tension: number, foreshadows: { title: string, note: string, action: string }[] }}
 */
export function parseFeedForwardAiText(text) {
  var empty = { summary: '', openThreads: [], tension: 5, foreshadows: [] };
  var raw = String(text || '').trim();
  if (!raw) return empty;
  var jsonStr = raw;
  var fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) jsonStr = fence[1].trim();
  var start = jsonStr.indexOf('{');
  var end = jsonStr.lastIndexOf('}');
  if (start >= 0 && end > start) jsonStr = jsonStr.slice(start, end + 1);
  try {
    var obj = JSON.parse(jsonStr);
    if (!obj || typeof obj !== 'object') return empty;
    var threads = obj.openThreads || obj.open_threads || obj.threads || [];
    if (!Array.isArray(threads)) threads = String(threads).split(/[；;|]/).map(function(s) { return s.trim(); }).filter(Boolean);
    var fores = obj.foreshadows || obj.hooks || obj.ledger || [];
    if (!Array.isArray(fores)) fores = [];
    var tension = Number(obj.tension != null ? obj.tension : (obj.tensionScore != null ? obj.tensionScore : 5));
    if (!Number.isFinite(tension)) tension = 5;
    tension = Math.max(1, Math.min(10, Math.round(tension)));
    return {
      summary: String(obj.summary || obj.recap || '').trim(),
      openThreads: threads.map(function(t) { return String(t).trim(); }).filter(Boolean).slice(0, 8),
      tension: tension,
      foreshadows: fores.map(function(f) {
        if (typeof f === 'string') return { title: f, note: '', action: 'plant' };
        return {
          title: String((f && (f.title || f.name)) || '').trim(),
          note: String((f && (f.note || f.desc || f.detail)) || '').trim(),
          action: String((f && f.action) || 'plant').toLowerCase(),
        };
      }).filter(function(x) { return x.title; }).slice(0, 6),
    };
  } catch (e) {
    // 非 JSON：取前 400 字当摘要
    return {
      summary: raw.slice(0, 400),
      openThreads: [],
      tension: 5,
      foreshadows: [],
    };
  }
}

/**
 * @param {object} chapter
 * @param {object} ff parseFeedForwardAiText 结果
 */
export function applyFeedForwardToChapter(chapter, ff) {
  var ch = chapter && typeof chapter === 'object' ? chapter : {};
  var f = ff || {};
  ch.feedForward = {
    summary: String(f.summary || ''),
    openThreads: Array.isArray(f.openThreads) ? f.openThreads.slice() : [],
    tension: typeof f.tension === 'number' ? f.tension : 5,
    updatedAt: Date.now(),
  };
  if (f.summary && !String(ch.summary || '').trim()) {
    ch.summary = f.summary;
  }
  return ch;
}

/** 从近到远收集已写章的 feed-forward（不含当前 idx） */
export function collectFeedForwardsBefore(chapters, beforeIndex) {
  var list = Array.isArray(chapters) ? chapters : [];
  var idx = Math.max(0, Number(beforeIndex) || 0);
  var out = [];
  for (var i = idx - 1; i >= 0; i--) {
    var c = list[i];
    if (!c) continue;
    var ff = c.feedForward && typeof c.feedForward === 'object' ? c.feedForward : null;
    var summary = (ff && ff.summary) || c.summary || '';
    if (!summary && !String(c.content || '').trim()) continue;
    out.push({
      order: typeof c.order === 'number' ? c.order : i,
      title: c.title || '',
      summary: summary || String(c.content || '').slice(0, 200),
      openThreads: (ff && Array.isArray(ff.openThreads)) ? ff.openThreads : [],
      tension: ff && ff.tension != null ? ff.tension : '',
    });
  }
  return out;
}

export function buildFeedForwardUserPrompt(vars) {
  var v = vars || {};
  var parts = [];
  parts.push('【小说标题】' + (v.title || ''));
  parts.push('【本章标题】' + (v.chapterTitle || ''));
  if (v.chapterSummary) parts.push('【本章摘要】' + v.chapterSummary);
  parts.push('【本章正文】\n' + String(v.content || '').slice(0, 6000));
  if (v.ledgerBrief) parts.push('【已有伏笔】\n' + v.ledgerBrief);
  parts.push('请输出 JSON：{ "summary":"120～220字章后摘要", "openThreads":["未收束线索"], "tension":1～10, "foreshadows":[{"title":"伏笔名","note":"说明","action":"plant|pay|drop"}] }');
  parts.push('只输出 JSON。');
  return parts.join('\n');
}
