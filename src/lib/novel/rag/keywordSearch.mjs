/**
 * 关键词检索：query 分词 + 章内窗口命中（多词 OR + 覆盖度打分）
 */
import { buildMatchTerms, findNameHits, sampleHitsByCoverage } from '../recall.mjs';

/** 中文虚词 / 问句成分，用于拆句 */
var CJK_SPLIT_RE = /(?:的|了|和|与|及|在|是|有|被|把|将|对|从|到|向|给|让|吗|呢|吧|啊|呀|么|着|过|这|那|什么|怎么|如何|谁|哪|请问|能不能|可不可以|一下|一个|第一次|第二次|第三次|场景|时候|情况|关系|之间|为何|为什么|怎样|什么时候|什么地方|那里|这里|他们|她们|我们|你们|那个|这个|那个|那些|这些)/;

/** 单独命中价值低的泛化词（拆句时仍保留，排序时靠后） */
var GENERIC_TERMS = {
  '什么': 1, '怎么': 1, '如何': 1, '为什么': 1, '请问': 1,
  '可以': 1, '能不能': 1, '怎样': 1, '一个': 1, '一下': 1,
  '场景': 1, '时候': 1, '情况': 1, '关系': 1, '之间': 1,
  '主角': 1, '女主': 1, '男主': 1, '第一次': 1, '第二次': 1,
  '那里': 1, '这里': 1, '他们': 1, '她们': 1, '我们': 1, '你们': 1,
};

function isGenericTerm(term) {
  return !!GENERIC_TERMS[String(term || '').trim()];
}

/** 将长中文短语拆成可检索子词 */
export function expandCjkPhrase(text) {
  var src = String(text || '').trim();
  if (!src) return [];
  var out = [];
  function add(t) {
    var s = String(t || '').trim();
    if (s.length < 2) return;
    if (out.indexOf(s) < 0) out.push(s);
  }
  src.split(CJK_SPLIT_RE).forEach(function(part) {
    part = part.trim();
    if (!part) return;
    if (part.length <= 6) {
      add(part);
      return;
    }
    add(part.slice(0, 6));
    for (var i = 0; i <= part.length - 2; i++) {
      add(part.slice(i, i + 2));
    }
  });
  return out;
}

/** 从用户问题抽出匹配词（中英数字 + 中文拆句 + 空白/标点切分） */
export function extractQueryTerms(query) {
  var q = String(query || '').trim();
  if (!q) return [];
  var terms = [];
  function add(t, opts) {
    opts = opts || {};
    var s = String(t || '').trim();
    if (s.length < 2) return;
    if (terms.indexOf(s) >= 0) return;
    terms.push(s);
  }
  // CJK / 字母数字连续块
  var re = /[\u4e00-\u9fff]{2,}|[A-Za-z0-9_]{2,}/g;
  var m;
  while ((m = re.exec(q)) !== null) {
    var block = m[0];
    if (/^[\u4e00-\u9fff]+$/.test(block) && block.length > 4) {
      expandCjkPhrase(block).forEach(add);
    } else {
      add(block);
    }
  }
  q.split(/[\s,，、.。!！?？;；:：]+/).forEach(function(part) {
    part = part.trim();
    if (!part || part.length < 2) return;
    if (/^[\u4e00-\u9fff]+$/.test(part) && part.length > 4) {
      expandCjkPhrase(part).forEach(add);
    } else {
      add(part);
    }
  });
  return terms.sort(function(a, b) {
    var ga = isGenericTerm(a) ? 1 : 0;
    var gb = isGenericTerm(b) ? 1 : 0;
    if (ga !== gb) return ga - gb;
    return b.length - a.length;
  }).slice(0, 24);
}

/**
 * 多词 OR 检索：窗口内命中词越多，score 越高
 * @returns {Array<{ chapterId: string, chapterTitle: string, chapterIndex: number, start: number, end: number, text: string, score: number, matchedTerms?: string[] }>}
 */
export function findQueryTermHits(chapters, terms, windowChars) {
  var win = windowChars != null ? windowChars : 160;
  var list = (terms || []).filter(function(t) { return String(t || '').trim().length >= 2; });
  if (!list.length) return [];
  var hits = [];
  (chapters || []).forEach(function(ch, chapterIndex) {
    if (ch.enabled === false) return;
    var text = String(ch.text || '');
    if (!text) return;
    var events = [];
    list.forEach(function(term) {
      var from = 0;
      while (from < text.length) {
        var at = text.indexOf(term, from);
        if (at < 0) break;
        events.push({ pos: at, len: term.length, term: term });
        from = at + Math.max(1, term.length);
      }
    });
    if (!events.length) return;
    events.sort(function(a, b) { return a.pos - b.pos; });
    var ranges = [];
    events.forEach(function(ev) {
      var start = Math.max(0, ev.pos - win);
      var end = Math.min(text.length, ev.pos + ev.len + win);
      var last = ranges[ranges.length - 1];
      if (last && start <= last.end + 40) {
        last.end = Math.max(last.end, end);
        last.terms[ev.term] = (last.terms[ev.term] || 0) + 1;
        last.hits += 1;
      } else {
        var termsMap = {};
        termsMap[ev.term] = 1;
        ranges.push({ start: start, end: end, terms: termsMap, hits: 1 });
      }
    });
    ranges.forEach(function(r) {
      var matched = Object.keys(r.terms);
      hits.push({
        chapterId: ch.id,
        chapterTitle: ch.title || '',
        chapterIndex: chapterIndex,
        start: r.start,
        end: r.end,
        text: text.slice(r.start, r.end),
        score: r.hits + matched.length * 2,
        matchedTerms: matched,
      });
    });
  });
  hits.sort(function(a, b) { return b.score - a.score; });
  return hits;
}

/**
 * @returns {Array<{ id: string, chapterId: string, chapterTitle: string, chapterIndex: number, start: number, end: number, text: string, score: number, source: string }>}
 */
export function keywordSearchChapters(chapters, query, opts) {
  opts = opts || {};
  var terms = extractQueryTerms(query);
  (opts.extraTerms || []).forEach(function(t) {
    var s = String(t || '').trim();
    if (s.length >= 2 && terms.indexOf(s) < 0) terms.unshift(s);
  });
  if (!terms.length) return [];
  var win = opts.windowChars != null ? opts.windowChars : 160;
  var hits = findQueryTermHits(chapters, terms, win);
  // 单专名短 query 仍走 findNameHits，保持人名召回行为
  if (!hits.length && terms.length <= 2) {
    hits = findNameHits(chapters, terms[0], terms.slice(1), win);
  }
  var budget = opts.budget != null ? opts.budget : 20000;
  var sampled = sampleHitsByCoverage(hits, budget);
  return sampled.snippets.map(function(s, i) {
    return {
      id: 'kw_' + (s.chapterId || i) + '_' + s.start,
      chapterId: s.chapterId,
      chapterTitle: s.chapterTitle,
      chapterIndex: s.chapterIndex,
      start: s.start,
      end: s.end,
      text: s.text,
      score: s.score || 1,
      source: 'keyword',
    };
  });
}

export { buildMatchTerms };
