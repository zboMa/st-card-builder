/**
 * 向量相似度检索
 */

/** 余弦相似度；零向量返回 0 */
export function cosineSimilarity(a, b) {
  if (!a || !b || !a.length || a.length !== b.length) return 0;
  var dot = 0;
  var na = 0;
  var nb = 0;
  for (var i = 0; i < a.length; i++) {
    var x = a[i] || 0;
    var y = b[i] || 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * @param {number[]} queryVec
 * @param {Array<{ id?: string, embedding?: number[], text?: string }>} chunks
 * @param {{ topK?: number }} [opts]
 */
export function vectorSearchChunks(queryVec, chunks, opts) {
  opts = opts || {};
  var topK = Math.max(1, Math.min(64, opts.topK || 24));
  if (!queryVec || !queryVec.length) return [];
  var scored = [];
  (chunks || []).forEach(function(c) {
    if (!c || !Array.isArray(c.embedding) || !c.embedding.length) return;
    var score = cosineSimilarity(queryVec, c.embedding);
    if (score <= 0) return;
    scored.push({
      id: c.id,
      chapterId: c.chapterId,
      chapterTitle: c.chapterTitle,
      chapterIndex: c.chapterIndex,
      start: c.start,
      end: c.end,
      text: c.text,
      score: score,
      source: 'vector',
    });
  });
  scored.sort(function(a, b) { return b.score - a.score; });
  return scored.slice(0, topK);
}
