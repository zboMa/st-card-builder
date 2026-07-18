/**
 * 章节切块：固定窗口 + 重叠，供 RAG 索引
 */
export var DEFAULT_CHUNK_SIZE = 600;
export var DEFAULT_CHUNK_OVERLAP = 80;

/**
 * @param {Array<{ id?: string, title?: string, text?: string, enabled?: boolean }>} chapters
 * @param {{ chunkSize?: number, overlap?: number }} [opts]
 * @returns {Array<{ id: string, chapterId: string, chapterTitle: string, chapterIndex: number, start: number, end: number, text: string }>}
 */
export function chunkChapters(chapters, opts) {
  opts = opts || {};
  var size = Math.max(200, Math.floor(opts.chunkSize || DEFAULT_CHUNK_SIZE));
  var overlap = Math.max(0, Math.min(size - 50, Math.floor(opts.overlap != null ? opts.overlap : DEFAULT_CHUNK_OVERLAP)));
  var out = [];
  var n = 0;
  (chapters || []).forEach(function(ch, chapterIndex) {
    if (!ch || ch.enabled === false) return;
    var text = String(ch.text || '');
    if (!text.trim()) return;
    var start = 0;
    while (start < text.length) {
      var end = Math.min(text.length, start + size);
      var slice = text.slice(start, end);
      if (slice.trim()) {
        out.push({
          id: 'chk_' + (ch.id || chapterIndex) + '_' + n,
          chapterId: String(ch.id || ''),
          chapterTitle: String(ch.title || ''),
          chapterIndex: chapterIndex,
          start: start,
          end: end,
          text: slice,
        });
        n++;
      }
      if (end >= text.length) break;
      start = Math.max(0, end - overlap);
    }
  });
  return out;
}
