/**
 * 分享逻辑纯函数（服务端单测）
 */
export function sanitizeReleaseDoc(doc) {
  if (!doc) return null;
  var data = doc.data && typeof doc.data === 'object' ? doc.data : doc;
  return {
    title: String(data.title || doc.title || '未命名小说'),
    displayVersion: String(doc.displayVersion || data.displayVersion || ''),
    characterVersion: String(doc.characterVersion || data.characterVersion || ''),
    novelVersion: String(doc.novelVersion || data.novelVersion || ''),
    publishedAt: typeof doc.publishedAt === 'number'
      ? doc.publishedAt
      : (typeof data.publishedAt === 'number' ? data.publishedAt : null),
    outline: Array.isArray(data.outline) ? data.outline : [],
    chapters: Array.isArray(data.chapters) ? data.chapters : [],
  };
}

export function buildShareDocId(token) {
  return 'share/' + String(token || '').trim();
}
