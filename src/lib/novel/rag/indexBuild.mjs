/**
 * 构建 / 刷新小说 RAG 索引
 */
import { chunkChapters } from './chunker.mjs';
import { fetchEmbeddingsBatched, DEFAULT_EMBED_MODEL } from './embedClient.mjs';
import { emptyRagIndex, saveRagIndex } from './store.mjs';

/**
 * @param {{
 *   cardId: string,
 *   chapters: object[],
 *   apiUrl: string,
 *   apiKey?: string,
 *   embedModel?: string,
 *   signal?: AbortSignal,
 *   onProgress?: (ratio: number, label: string) => void,
 *   keywordOnly?: boolean,
 * }} opts
 */
export async function buildNovelRagIndex(opts) {
  opts = opts || {};
  var cardId = String(opts.cardId || '').trim();
  if (!cardId) throw new Error('缺少 cardId');
  var chunks = chunkChapters(opts.chapters || []);
  if (!chunks.length) throw new Error('无启用章节可建索引');

  var index = emptyRagIndex(cardId);
  index.embedModel = opts.embedModel || DEFAULT_EMBED_MODEL;

  if (opts.keywordOnly || !opts.apiUrl) {
    index.chunks = chunks.map(function(c) {
      return Object.assign({}, c, { embedding: [] });
    });
    index.dims = 0;
    await saveRagIndex(cardId, index);
    if (typeof opts.onProgress === 'function') opts.onProgress(1, '仅关键词索引');
    return { index: index, mode: 'keyword', chunkCount: chunks.length };
  }

  if (typeof opts.onProgress === 'function') opts.onProgress(0.05, '切块完成 ' + chunks.length);
  var texts = chunks.map(function(c) { return c.text; });
  var vectors = await fetchEmbeddingsBatched({
    apiUrl: opts.apiUrl,
    apiKey: opts.apiKey,
    model: index.embedModel,
    texts: texts,
    signal: opts.signal,
    onProgress: function(done, total) {
      if (typeof opts.onProgress === 'function') {
        opts.onProgress(0.05 + 0.9 * (done / total), '向量 ' + done + '/' + total);
      }
    },
  });

  index.chunks = chunks.map(function(c, i) {
    return Object.assign({}, c, { embedding: vectors[i] || [] });
  });
  index.dims = (vectors[0] && vectors[0].length) || 0;
  await saveRagIndex(cardId, index);
  if (typeof opts.onProgress === 'function') opts.onProgress(1, '索引就绪');
  return { index: index, mode: 'vector', chunkCount: chunks.length, dims: index.dims };
}
