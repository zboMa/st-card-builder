/**
 * 混合检索：关键词 ∪ 向量 → RRF 合并
 */
import { keywordSearchChapters } from './keywordSearch.mjs';
import { vectorSearchChunks } from './vectorSearch.mjs';
import { fetchEmbeddings } from './embedClient.mjs';
import { loadRagIndex } from './store.mjs';
import { truncateSnippetsByTokenBudget } from '../../assistant/contextManager.mjs';

var RRF_K = 60;

/**
 * Reciprocal Rank Fusion
 * @param {Array<Array<object>>} rankedLists
 */
export function rrfMerge(rankedLists, opts) {
  opts = opts || {};
  var k = opts.k != null ? opts.k : RRF_K;
  var scores = {};
  var items = {};
  (rankedLists || []).forEach(function(list) {
    (list || []).forEach(function(item, rank) {
      var key = item.id || (item.chapterId + ':' + item.start + ':' + String(item.text || '').slice(0, 40));
      scores[key] = (scores[key] || 0) + 1 / (k + rank + 1);
      if (!items[key]) items[key] = item;
    });
  });
  return Object.keys(scores).map(function(key) {
    return Object.assign({}, items[key], { rrf: scores[key] });
  }).sort(function(a, b) { return b.rrf - a.rrf; });
}

/** 按 token 预算截断片段列表（tiktoken） */
export function truncateByBudget(snippets, budget) {
  var cap = budget != null ? Math.max(1, budget) : 12000;
  if (budget == null) cap = Math.max(200, cap);
  var cut = truncateSnippetsByTokenBudget(snippets, cap, { minRemain: 24 });
  return {
    snippets: cut.snippets,
    totalTokens: cut.totalTokens,
    /** @deprecated 兼容：数值为 token */
    totalChars: cut.totalTokens,
    truncated: cut.truncated,
  };
}

/**
 * @param {{
 *   chapters: object[],
 *   query: string,
 *   cardId?: string,
 *   budget?: number,
 *   topK?: number,
 *   apiUrl?: string,
 *   apiKey?: string,
 *   embedModel?: string,
 *   signal?: AbortSignal,
 *   index?: object|null,
 * }} opts
 */
export async function hybridSearch(opts) {
  opts = opts || {};
  var query = String(opts.query || '').trim();
  var budget = opts.budget != null ? opts.budget : 12000;
  var topK = opts.topK || 24;
  var kw = keywordSearchChapters(opts.chapters, query, {
    budget: budget * 2,
    windowChars: 160,
    extraTerms: opts.extraTerms,
  });

  var vecHits = [];
  var usedVector = false;
  var embedError = '';
  var index = opts.index != null ? opts.index : null;
  try {
    if (!index && opts.cardId) index = await loadRagIndex(opts.cardId);
    var chunks = index && Array.isArray(index.chunks) ? index.chunks : [];
    var hasEmbed = chunks.some(function(c) { return c && Array.isArray(c.embedding) && c.embedding.length; });
    if (hasEmbed && opts.apiUrl && query) {
      var qVecs = await fetchEmbeddings({
        apiUrl: opts.apiUrl,
        apiKey: opts.apiKey,
        model: opts.embedModel || index.embedModel,
        texts: [query],
        signal: opts.signal,
      });
      if (qVecs[0] && qVecs[0].length) {
        vecHits = vectorSearchChunks(qVecs[0], chunks, { topK: topK });
        usedVector = true;
      }
    }
  } catch (e) {
    embedError = e && e.message ? e.message : String(e);
  }

  var merged = rrfMerge([kw, vecHits]);
  var cut = truncateByBudget(merged, budget);
  var body = cut.snippets.map(function(s, i) {
    var title = s.chapterTitle || ('章' + ((s.chapterIndex || 0) + 1));
    return '【片段' + (i + 1) + '｜' + title + '】\n' + s.text;
  }).join('\n\n');

  var indexChunkCount = index && Array.isArray(index.chunks) ? index.chunks.length : 0;

  return {
    body: body,
    snippets: cut.snippets,
    totalChars: cut.totalChars,
    truncated: cut.truncated,
    keywordCount: kw.length,
    vectorCount: vecHits.length,
    usedVector: usedVector,
    embedError: embedError,
    mode: usedVector ? 'hybrid' : 'keyword',
    indexChunkCount: indexChunkCount,
    entityBoost: !!opts.entityBoost,
  };
}
