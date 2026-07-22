/**
 * 分享逻辑纯函数（服务端单测 + routes 共用）
 */
export function sanitizeReleaseDoc(doc) {
  if (!doc) return null;
  var data = doc.data && typeof doc.data === 'object' ? doc.data : doc;
  var branches = Array.isArray(data.branches) ? data.branches.map(function(b) {
    if (!b || typeof b !== 'object') return null;
    return {
      id: String(b.id || ''),
      name: String(b.name != null ? b.name : '分支'),
      parentBranchId: String(b.parentBranchId || ''),
      forkChapterId: String(b.forkChapterId || ''),
      forkOrder: typeof b.forkOrder === 'number' ? b.forkOrder : -1,
      direction: String(b.direction || ''),
      choiceLabel: String(b.choiceLabel || ''),
      choiceTeaser: String(b.choiceTeaser || ''),
      kind: b.kind === 'ending' ? 'ending' : 'path',
      endingTitle: String(b.endingTitle || ''),
      publishReady: true,
    };
  }).filter(Boolean) : [];
  var chapters = Array.isArray(data.chapters) ? data.chapters.map(function(c, i) {
    if (!c || typeof c !== 'object') return null;
    return {
      id: String(c.id || ''),
      title: String(c.title != null ? c.title : ''),
      summary: String(c.summary != null ? c.summary : ''),
      content: String(c.content != null ? c.content : ''),
      order: typeof c.order === 'number' ? c.order : i,
      branchId: String(c.branchId || ''),
    };
  }).filter(Boolean) : [];
  var outline = Array.isArray(data.outline) ? data.outline.map(function(o, i) {
    if (!o || typeof o !== 'object') return null;
    return {
      id: String(o.id || ''),
      title: String(o.title != null ? o.title : ''),
      summary: String(o.summary != null ? o.summary : ''),
      order: typeof o.order === 'number' ? o.order : i,
      branchId: String(o.branchId || ''),
    };
  }).filter(Boolean) : [];
  var schemaVersion = Number(data.schemaVersion || doc.schemaVersion || (branches.length ? 2 : 1)) || 1;
  return {
    title: String(data.title || doc.title || '未命名小说'),
    displayVersion: String(doc.displayVersion || data.displayVersion || ''),
    characterVersion: String(doc.characterVersion || data.characterVersion || ''),
    novelVersion: String(doc.novelVersion || data.novelVersion || ''),
    publishedAt: typeof doc.publishedAt === 'number'
      ? doc.publishedAt
      : (typeof data.publishedAt === 'number' ? data.publishedAt : null),
    schemaVersion: schemaVersion,
    branches: branches,
    activeBranchId: String(data.activeBranchId || ''),
    publishedBranchIds: Array.isArray(data.publishedBranchIds)
      ? data.publishedBranchIds.map(String)
      : branches.map(function(b) { return b.id; }),
    outline: outline,
    chapters: chapters,
  };
}

export function buildShareDocId(token) {
  return 'share/' + String(token || '').trim();
}
