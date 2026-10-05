/**
 * OpenAI 兼容 /embeddings 客户端
 */
import { runWithAutoRetry } from '../autoRetry.mjs';

export var DEFAULT_EMBED_MODEL = 'text-embedding-3-small';

/**
 * @param {{ apiUrl: string, apiKey?: string, model?: string, texts: string[], signal?: AbortSignal }} opts
 * @returns {Promise<number[][]>}
 */
export async function fetchEmbeddings(opts) {
  opts = opts || {};
  var base = String(opts.apiUrl || '').replace(/\/$/, '');
  if (!base) throw new Error('未配置 API 地址');
  var texts = (opts.texts || []).map(function(t) { return String(t || '').slice(0, 8000); });
  if (!texts.length) return [];
  var headers = { 'Content-Type': 'application/json' };
  if (opts.apiKey) headers.Authorization = 'Bearer ' + opts.apiKey;
  var res = await fetch(base + '/embeddings', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      model: opts.model || DEFAULT_EMBED_MODEL,
      input: texts,
    }),
    signal: opts.signal,
  });
  if (!res.ok) {
    var errText = '';
    try { errText = await res.text(); } catch (e) { /* ignore */ }
    throw new Error('embeddings 失败 ' + res.status + (errText ? ': ' + errText.slice(0, 200) : ''));
  }
  var json = await res.json();
  var data = Array.isArray(json.data) ? json.data.slice() : [];
  data.sort(function(a, b) { return (a.index || 0) - (b.index || 0); });
  return data.map(function(row) {
    return Array.isArray(row.embedding) ? row.embedding : [];
  });
}

/**
 * 分批 embedding
 * @param {{ apiUrl: string, apiKey?: string, model?: string, texts: string[], batchSize?: number, signal?: AbortSignal, onProgress?: (done: number, total: number) => void }} opts
 */
export async function fetchEmbeddingsBatched(opts) {
  opts = opts || {};
  var texts = opts.texts || [];
  var batch = Math.max(1, Math.min(64, opts.batchSize || 32));
  var batchCount = Math.max(1, Math.ceil(texts.length / batch));
  var out = [];
  var batchNo = 0;
  for (var i = 0; i < texts.length; i += batch) {
    if (opts.signal && opts.signal.aborted) throw new DOMException('已取消', 'AbortError');
    batchNo++;
    var part = texts.slice(i, i + batch);
    var vecs;
    try {
      vecs = await runWithAutoRetry(function() {
        return fetchEmbeddings({
          apiUrl: opts.apiUrl,
          apiKey: opts.apiKey,
          model: opts.model,
          texts: part,
          signal: opts.signal,
        });
      }, {
        signal: opts.signal,
        onRetry: function(n, err) {
          if (typeof opts.onBatch !== 'function') return;
          opts.onBatch({
            batchNo: batchNo,
            batchCount: batchCount,
            count: part.length,
            done: i,
            total: texts.length,
            vectors: 0,
            error: String(err && (err.message || err)),
            retrying: true,
            attempt: n,
          });
        },
      });
    } catch (e) {
      if (e && e.name === 'AbortError') throw e;
      if (opts.signal && opts.signal.aborted) throw e;
      if (typeof opts.onBatch === 'function') {
        opts.onBatch({
          batchNo: batchNo,
          batchCount: batchCount,
          count: part.length,
          done: i,
          total: texts.length,
          vectors: 0,
          error: String(e && (e.message || e)),
          retrying: false,
          attempt: 0,
        });
      }
      throw e;
    }
    out = out.concat(vecs);
    var done = Math.min(texts.length, i + part.length);
    if (typeof opts.onBatch === 'function') {
      opts.onBatch({
        batchNo: batchNo,
        batchCount: batchCount,
        count: part.length,
        done: done,
        total: texts.length,
        vectors: vecs.length,
        error: '',
        retrying: false,
        attempt: 0,
      });
    }
    if (typeof opts.onProgress === 'function') opts.onProgress(done, texts.length);
  }
  return out;
}
