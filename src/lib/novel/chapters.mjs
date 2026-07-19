/**
 * 拆章：标题正则 / 空行密度 / 按字数切片；章节合并拆分调序
 */

import { uid } from '../utils.mjs';

var TITLE_RE = /(?=第[^\n]{0,20}[章节卷回部篇])|(?=Chapter\s+\d+)/i;

/** @param {string} text @param {{ mode?: string, chunkSize?: number }} opts */
export function splitIntoChapters(text, opts) {
  var raw = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!raw) return [];
  var mode = (opts && opts.mode) || 'title';
  // 允许较小切片（测试/短文）；默认 8000
  var chunkSize = Math.max(50, (opts && opts.chunkSize) || 8000);

  if (mode === 'size') {
    return chunkBySize(raw, chunkSize).map(function(t, i) {
      return makeChapter('切片 ' + (i + 1), t);
    });
  }

  if (mode === 'blank') {
    // 连续空行分段，过短段再合并到 chunkSize
    var parts = raw.split(/\n{2,}/).map(function(s) { return s.trim(); }).filter(Boolean);
    var merged = [];
    var buf = '';
    parts.forEach(function(p) {
      if (!buf) buf = p;
      else if ((buf + '\n\n' + p).length > chunkSize) {
        merged.push(buf);
        buf = p;
      } else buf += '\n\n' + p;
    });
    if (buf) merged.push(buf);
    return merged.map(function(t, i) {
      return makeChapter(guessTitle(t, i), t);
    });
  }

  // 默认：章节标题优先，超长章再按字数切
  var parts2 = raw.split(TITLE_RE);
  if (parts2.length <= 1) {
    return chunkBySize(raw, chunkSize).map(function(t, i) {
      return makeChapter('切片 ' + (i + 1), t);
    });
  }
  var out = [];
  parts2.forEach(function(p, i) {
    var t = p.trim();
    if (!t) return;
    if (t.length > chunkSize) {
      chunkBySize(t, chunkSize).forEach(function(sub, j) {
        out.push(makeChapter(guessTitle(sub, i) + (j ? ' (' + (j + 1) + ')' : ''), sub));
      });
    } else {
      out.push(makeChapter(guessTitle(t, i), t));
    }
  });
  return out;
}

function chunkBySize(text, size) {
  var chunks = [];
  for (var i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
  return chunks;
}

function guessTitle(text, index) {
  var first = String(text || '').split('\n').find(function(l) { return l.trim(); }) || '';
  first = first.trim().slice(0, 40);
  if (/^第.{0,20}[章节卷回部篇]/.test(first) || /^Chapter\s+\d+/i.test(first)) return first;
  return first || ('章节 ' + (index + 1));
}

export function makeChapter(title, text) {
  return {
    id: uid('ch'),
    title: String(title || '未命名'),
    text: String(text || ''),
    enabled: true,
    selected: false,
  };
}

/** 合并选中章节（按当前顺序） */
export function mergeChapters(chapters, ids) {
  var idSet = {};
  (ids || []).forEach(function(id) { idSet[id] = true; });
  var list = (chapters || []).slice();
  var firstIdx = -1;
  var texts = [];
  var titles = [];
  for (var i = 0; i < list.length; i++) {
    if (!idSet[list[i].id]) continue;
    if (firstIdx < 0) firstIdx = i;
    texts.push(list[i].text);
    titles.push(list[i].title);
  }
  if (firstIdx < 0 || texts.length < 2) return list;
  var merged = makeChapter(titles[0] + ' +' + (titles.length - 1), texts.join('\n\n'));
  var remove = {};
  ids.forEach(function(id) { remove[id] = true; });
  var next = list.filter(function(c) { return !remove[c.id]; });
  next.splice(Math.min(firstIdx, next.length), 0, merged);
  return next;
}

/** 在 offset 处拆分单章 */
export function splitChapterAt(chapters, id, offset) {
  var list = (chapters || []).slice();
  var idx = list.findIndex(function(c) { return c.id === id; });
  if (idx < 0) return list;
  var ch = list[idx];
  var off = Math.max(1, Math.min(Number(offset) || 0, ch.text.length - 1));
  var a = makeChapter(ch.title, ch.text.slice(0, off));
  var b = makeChapter(ch.title + ' (续)', ch.text.slice(off));
  a.enabled = ch.enabled;
  b.enabled = ch.enabled;
  list.splice(idx, 1, a, b);
  return list;
}

export function renameChapter(chapters, id, title) {
  return (chapters || []).map(function(c) {
    if (c.id !== id) return c;
    return Object.assign({}, c, { title: String(title || c.title) });
  });
}

export function moveChapter(chapters, id, dir) {
  var list = (chapters || []).slice();
  var idx = list.findIndex(function(c) { return c.id === id; });
  if (idx < 0) return list;
  var j = dir < 0 ? idx - 1 : idx + 1;
  if (j < 0 || j >= list.length) return list;
  var tmp = list[idx];
  list[idx] = list[j];
  list[j] = tmp;
  return list;
}

export function setChapterEnabled(chapters, id, enabled) {
  return (chapters || []).map(function(c) {
    if (c.id !== id) return c;
    return Object.assign({}, c, { enabled: !!enabled });
  });
}

/** 仅启用章节文本拼接 */
export function joinEnabledChapters(chapters) {
  return (chapters || [])
    .filter(function(c) { return c.enabled !== false; })
    .map(function(c) { return c.text; })
    .join('\n\n');
}

export function exportSelectedChapters(chapters, ids) {
  var idSet = {};
  (ids || []).forEach(function(id) { idSet[id] = true; });
  var picked = (chapters || []).filter(function(c) { return idSet[c.id]; });
  if (!picked.length) picked = (chapters || []).filter(function(c) { return c.selected; });
  return picked.map(function(c) {
    return '## ' + c.title + '\n\n' + c.text;
  }).join('\n\n---\n\n');
}

/** 有文本的启用章（空章不计，保证预估与实际一致） */
function enabledChaptersWithText(chapters) {
  return (chapters || []).filter(function(ch) {
    return ch.enabled !== false && String(ch.text || '');
  });
}

/** 跨章片内章节分隔 */
var SHARD_CHAPTER_SEP = '\n\n---\n\n';

/** 片内单章正文（标题 + 文本） */
function formatShardChapter(ch) {
  return '## ' + (ch.title || '') + '\n\n' + String(ch.text || '');
}

/**
 * 按字数跨章 packing：按正文长度贪心拼入，将超预算则开新片；单章超长则章内切开
 * 预估与真实抽取共用本函数
 * @returns {Array<{ chapterId: string, chapterTitle: string, part: number, text: string }>}
 */
export function buildChapterShards(chapters, chunkSize) {
  var size = Math.max(1, Number(chunkSize) || 8000);
  var shards = [];
  var buf = [];
  var bufChars = 0; // 缓冲区内正文总字数（不含标题/分隔符）

  function flushBuf() {
    if (!buf.length) return;
    var title = buf.length === 1
      ? (buf[0].title || '')
      : ((buf[0].title || '') + ' … ' + (buf[buf.length - 1].title || ''));
    shards.push({
      chapterId: buf.map(function(c) { return c.id; }).join(','),
      chapterTitle: title,
      part: 1,
      text: buf.map(formatShardChapter).join(SHARD_CHAPTER_SEP),
    });
    buf = [];
    bufChars = 0;
  }

  enabledChaptersWithText(chapters).forEach(function(ch) {
    var text = String(ch.text || '');
    var tlen = text.length;
    // 单章超预算：先冲刷缓冲，再按字数切开（不跨章）
    if (tlen > size) {
      flushBuf();
      var part = 0;
      for (var i = 0; i < tlen; i += size) {
        part += 1;
        shards.push({
          chapterId: ch.id,
          chapterTitle: ch.title || '',
          part: part,
          text: text.slice(i, i + size),
        });
      }
      return;
    }
    if (!buf.length) {
      buf.push(ch);
      bufChars = tlen;
      return;
    }
    if (bufChars + tlen > size) {
      flushBuf();
      buf.push(ch);
      bufChars = tlen;
    } else {
      buf.push(ch);
      bufChars += tlen;
    }
  });
  flushBuf();
  return shards;
}

/**
 * 按章节数分片：每 N 个有文本启用章合并为一次请求
 * @returns {Array<{ chapterId: string, chapterTitle: string, part: number, text: string }>}
 */
export function buildChapterGroupShards(chapters, chaptersPerShard) {
  var n = Math.max(1, Math.floor(Number(chaptersPerShard) || 1));
  var list = enabledChaptersWithText(chapters);
  var shards = [];
  for (var i = 0; i < list.length; i += n) {
    var group = list.slice(i, i + n);
    var title = group.length === 1
      ? (group[0].title || '')
      : ((group[0].title || '') + ' … ' + (group[group.length - 1].title || ''));
    shards.push({
      chapterId: group.map(function(c) { return c.id; }).join(','),
      chapterTitle: title,
      part: 1,
      text: group.map(function(c) {
        return '## ' + (c.title || '') + '\n\n' + String(c.text || '');
      }).join('\n\n---\n\n'),
    });
  }
  return shards;
}

/**
 * 统一分片入口（预估与真实抽取共用）
 * @param {Array} chapters
 * @param {{ mode?: 'chars'|'chapters', chunkSize?: number, chaptersPerShard?: number }} opts
 */
export function buildExtractShards(chapters, opts) {
  var o = opts || {};
  if (o.mode === 'chapters') {
    return buildChapterGroupShards(chapters, o.chaptersPerShard);
  }
  return buildChapterShards(chapters, o.chunkSize);
}

/** 预估 AI 调用次数（与 buildExtractShards 片数一致） */
export function estimateExtractCalls(chapters, opts) {
  return buildExtractShards(chapters, opts).length;
}

/**
 * 启用章指纹：用于判断 RAG 索引是否过期
 * @param {Array} chapters
 * @returns {string}
 */
export function chaptersSourceFingerprint(chapters) {
  var enabled = (chapters || []).filter(function(c) { return c && c.enabled !== false; });
  return enabled.map(function(c) {
    var body = String(c.text || '');
    return String(c.id || '') + '\t' + String(c.title || '') + '\t' + body.length
      + '\t' + body.slice(0, 24) + '\t' + body.slice(-24);
  }).join('\n');
}

/**
 * 角色设定 / 开场白：按字数上限或前 N 启用章截取原文
 * @param {Array} chapters
 * @param {{ mode?: 'chars'|'chapters', charLimit?: number, chapterCount?: number }} opts
 * @returns {{ text: string, charCount: number, chapterCount: number, mode: string }}
 */
export function buildSetupCorpus(chapters, opts) {
  var o = opts || {};
  var mode = o.mode === 'chapters' ? 'chapters' : 'chars';
  var enabled = enabledChaptersWithText(chapters);

  if (mode === 'chapters') {
    var n = Math.max(1, Math.floor(Number(o.chapterCount) || 1));
    var take = enabled.slice(0, n);
    var textCh = take.map(function(c) {
      return '## ' + (c.title || '') + '\n\n' + String(c.text || '');
    }).join('\n\n');
    return {
      text: textCh,
      charCount: textCh.length,
      chapterCount: take.length,
      mode: mode,
    };
  }

  // 字数上限按正文累计（不含标题开销）；下限 1 便于测试与极短截取
  var limit = Math.max(1, Math.floor(Number(o.charLimit) || 16000));
  var parts = [];
  var used = 0;
  var chCount = 0;
  for (var i = 0; i < enabled.length && used < limit; i++) {
    var ch = enabled[i];
    var body = String(ch.text || '');
    var remain = limit - used;
    var slice = body.slice(0, remain);
    parts.push('## ' + (ch.title || '') + '\n\n' + slice);
    used += slice.length;
    chCount += 1;
    if (slice.length < body.length) break;
  }
  var text = parts.join('\n\n');
  return {
    text: text,
    charCount: text.length,
    bodyCharCount: used,
    chapterCount: chCount,
    mode: mode,
  };
}

/** @deprecated 兼容：等价于按字数分片预估 */
export function estimateShardCalls(chapters, chunkSize) {
  return estimateExtractCalls(chapters, { mode: 'chars', chunkSize: chunkSize });
}
