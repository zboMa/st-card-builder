/**
 * 人物 AI 扩展：仅按人名/别名匹配原文召回，禁止无过滤塞全书
 * 默认预算 30000 字；超预算按首现 / 共现密度 / 分散章节抽样
 */

export var DEFAULT_EXPAND_BUDGET = 30000;
export var DEFAULT_WINDOW = 180;

/**
 * @param {string} name
 * @param {string[]} [aliases]
 * @returns {string[]} 去重后的匹配词（长词优先）
 */
export function buildMatchTerms(name, aliases) {
  var terms = [];
  function add(t) {
    var s = String(t || '').trim();
    if (s.length >= 1 && terms.indexOf(s) < 0) terms.push(s);
  }
  add(name);
  (aliases || []).forEach(add);
  // 从 Nickname 字符串拆分
  terms.slice().forEach(function(t) {
    t.split(/[,，、／/|;；\s]+/).forEach(add);
  });
  return terms.sort(function(a, b) { return b.length - a.length; });
}

/**
 * 在章节中按词匹配，带前后文窗口
 * @returns {Array<{ chapterId: string, chapterTitle: string, chapterIndex: number, start: number, end: number, text: string, score: number }>}
 */
export function findNameHits(chapters, name, aliases, windowChars) {
  var win = windowChars != null ? windowChars : DEFAULT_WINDOW;
  var terms = buildMatchTerms(name, aliases);
  if (!terms.length) return [];
  var hits = [];
  (chapters || []).forEach(function(ch, chapterIndex) {
    if (ch.enabled === false) return;
    var text = String(ch.text || '');
    if (!text) return;
    var foundAt = [];
    terms.forEach(function(term) {
      var from = 0;
      while (from < text.length) {
        var at = text.indexOf(term, from);
        if (at < 0) break;
        foundAt.push(at);
        from = at + Math.max(1, term.length);
      }
    });
    if (!foundAt.length) return;
    foundAt.sort(function(a, b) { return a - b; });
    // 合并邻近命中窗口
    var ranges = [];
    foundAt.forEach(function(pos) {
      var start = Math.max(0, pos - win);
      var end = Math.min(text.length, pos + win);
      var last = ranges[ranges.length - 1];
      if (last && start <= last.end + 40) {
        last.end = Math.max(last.end, end);
        last.hits += 1;
      } else {
        ranges.push({ start: start, end: end, hits: 1 });
      }
    });
    ranges.forEach(function(r) {
      hits.push({
        chapterId: ch.id,
        chapterTitle: ch.title || '',
        chapterIndex: chapterIndex,
        start: r.start,
        end: r.end,
        text: text.slice(r.start, r.end),
        score: r.hits,
      });
    });
  });
  return hits;
}

/**
 * 覆盖度抽样：保留首现章、高共现、分散章节，直到不超过预算
 * @param {ReturnType<typeof findNameHits>} hits
 * @param {number} budget
 */
export function sampleHitsByCoverage(hits, budget) {
  // 尊重调用方预算；仅保证下限避免 0
  var cap = Math.max(200, budget || DEFAULT_EXPAND_BUDGET);
  var list = (hits || []).slice();
  if (!list.length) return { snippets: [], totalChars: 0, truncated: false, hitCount: 0 };

  // 按章节统计共现
  var byChapter = {};
  list.forEach(function(h) {
    byChapter[h.chapterId] = (byChapter[h.chapterId] || 0) + h.score;
  });

  // 排序：首现章优先 → 共现高 → 章节分散（章号间隔）
  var firstChapter = Math.min.apply(null, list.map(function(h) { return h.chapterIndex; }));
  list.sort(function(a, b) {
    var aFirst = a.chapterIndex === firstChapter ? 0 : 1;
    var bFirst = b.chapterIndex === firstChapter ? 0 : 1;
    if (aFirst !== bFirst) return aFirst - bFirst;
    var dens = (byChapter[b.chapterId] || 0) - (byChapter[a.chapterId] || 0);
    if (dens) return dens;
    return a.chapterIndex - b.chapterIndex;
  });

  // 轮询各章，保证分散
  var chapterBuckets = {};
  list.forEach(function(h) {
    if (!chapterBuckets[h.chapterId]) chapterBuckets[h.chapterId] = [];
    chapterBuckets[h.chapterId].push(h);
  });
  var chapterIds = Object.keys(chapterBuckets);
  var roundRobin = [];
  var maxLen = 0;
  chapterIds.forEach(function(id) {
    maxLen = Math.max(maxLen, chapterBuckets[id].length);
  });
  for (var r = 0; r < maxLen; r++) {
    chapterIds.forEach(function(id) {
      if (chapterBuckets[id][r]) roundRobin.push(chapterBuckets[id][r]);
    });
  }

  var picked = [];
  var total = 0;
  var used = {};
  var full = false;
  for (var i = 0; i < roundRobin.length && !full; i++) {
    var h = roundRobin[i];
    var key = h.chapterId + ':' + h.start;
    if (used[key]) continue;
    var len = h.text.length;
    if (total >= cap) break;
    if (total + len > cap) {
      // 截断以贴预算；剩余过短则结束
      var remain = cap - total;
      if (remain > 120) {
        used[key] = true;
        picked.push(Object.assign({}, h, { text: h.text.slice(0, remain) }));
        total += remain;
      }
      full = true;
      break;
    }
    used[key] = true;
    picked.push(h);
    total += len;
  }

  return {
    snippets: picked,
    totalChars: total,
    truncated: total >= cap || picked.length < list.length,
    hitCount: list.length,
  };
}

/** 组装送入模型的召回正文（带章节标注） */
export function buildRecallPayload(chapters, name, aliases, budget, windowChars) {
  var hits = findNameHits(chapters, name, aliases, windowChars);
  var sampled = sampleHitsByCoverage(hits, budget);
  var body = sampled.snippets.map(function(s, i) {
    return '【片段' + (i + 1) + '｜' + (s.chapterTitle || ('章' + (s.chapterIndex + 1))) + '】\n' + s.text;
  }).join('\n\n');
  return {
    body: body,
    totalChars: sampled.totalChars,
    truncated: sampled.truncated,
    hitCount: sampled.hitCount,
    snippetCount: sampled.snippets.length,
    terms: buildMatchTerms(name, aliases),
  };
}
