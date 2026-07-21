/**
 * 小说创作状态：normalize / id / 目录摘要
 */

export var STORY_VIEWS = [
  'story-manage',
  'story-graph',
  'story-outline',
  'story-write',
  'story-read',
];

export function genStoryId(prefix) {
  var p = String(prefix || 'story');
  return p + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export function createEmptyGraph() {
  return { nodes: [], edges: [], updatedAt: '' };
}

export function createEmptyChapter(partial) {
  var p = partial || {};
  return {
    id: p.id || genStoryId('ch'),
    title: String(p.title != null ? p.title : '未命名章节'),
    summary: String(p.summary != null ? p.summary : ''),
    content: String(p.content != null ? p.content : ''),
    advancePrompt: String(p.advancePrompt != null ? p.advancePrompt : ''),
    order: typeof p.order === 'number' ? p.order : 0,
  };
}

export function createEmptyNovel(partial) {
  var p = partial || {};
  var now = Date.now();
  return {
    id: p.id || genStoryId('novel'),
    title: String(p.title != null ? p.title : '未命名小说'),
    createdAt: typeof p.createdAt === 'number' ? p.createdAt : now,
    updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : now,
    cardId: String(p.cardId || ''),
    /** 小说自身版本后缀；完整版号 = character_version + '-' + novelVersion */
    novelVersion: String(p.novelVersion != null ? p.novelVersion : '1'),
    /** 当前已发布（release）的完整版号；无则空 */
    publishedDisplayVersion: String(p.publishedDisplayVersion != null ? p.publishedDisplayVersion : ''),
    publishedAt: typeof p.publishedAt === 'number' ? p.publishedAt : 0,
    shareToken: String(p.shareToken != null ? p.shareToken : ''),
    graph: createEmptyGraph(),
    outline: [],
    chapters: [],
    bookmarks: [],
    readState: {
      chapterId: '',
      mode: 'swipe',
      pageIndex: 0,
    },
    writeSettings: {
      syncMvuStatusBar: false,
      autoContinue: false,
    },
  };
}

function normalizeNode(raw, idx) {
  var n = raw && typeof raw === 'object' ? raw : {};
  var type = String(n.type || 'character');
  if (type !== 'character' && type !== 'location' && type !== 'other') type = 'other';
  return {
    id: String(n.id || genStoryId('node')),
    type: type,
    name: String(n.name != null ? n.name : ('节点' + (idx + 1))),
    note: String(n.note != null ? n.note : ''),
  };
}

function normalizeEdge(raw, idx) {
  var e = raw && typeof raw === 'object' ? raw : {};
  return {
    id: String(e.id || genStoryId('edge')),
    from: String(e.from || ''),
    to: String(e.to || ''),
    label: String(e.label != null ? e.label : '关系'),
  };
}

function normalizeOutlineItem(raw, idx) {
  var o = raw && typeof raw === 'object' ? raw : {};
  return {
    id: String(o.id || genStoryId('ol')),
    title: String(o.title != null ? o.title : ('第' + (idx + 1) + '章')),
    summary: String(o.summary != null ? o.summary : ''),
    order: typeof o.order === 'number' ? o.order : idx,
  };
}

function normalizeChapter(raw, idx) {
  var c = raw && typeof raw === 'object' ? raw : {};
  return createEmptyChapter({
    id: c.id,
    title: c.title,
    summary: c.summary,
    content: c.content,
    advancePrompt: c.advancePrompt,
    order: typeof c.order === 'number' ? c.order : idx,
  });
}

function normalizeBookmark(raw) {
  var b = raw && typeof raw === 'object' ? raw : {};
  return {
    id: String(b.id || genStoryId('bm')),
    chapterId: String(b.chapterId || ''),
    note: String(b.note != null ? b.note : ''),
    createdAt: typeof b.createdAt === 'number' ? b.createdAt : Date.now(),
  };
}

/** 合并/清洗持久化小说文档 */
export function normalizeNovel(raw) {
  var base = createEmptyNovel();
  if (!raw || typeof raw !== 'object') return base;
  var graphRaw = raw.graph && typeof raw.graph === 'object' ? raw.graph : {};
  var readRaw = raw.readState && typeof raw.readState === 'object' ? raw.readState : {};
  var writeRaw = raw.writeSettings && typeof raw.writeSettings === 'object' ? raw.writeSettings : {};
  var mode = String(readRaw.mode || 'swipe');
  if (mode !== 'swipe' && mode !== 'page') mode = 'swipe';

  var outline = Array.isArray(raw.outline) ? raw.outline.map(normalizeOutlineItem) : [];
  outline.sort(function(a, b) { return a.order - b.order; });
  outline.forEach(function(o, i) { o.order = i; });

  var chapters = Array.isArray(raw.chapters) ? raw.chapters.map(normalizeChapter) : [];
  chapters.sort(function(a, b) { return a.order - b.order; });
  chapters.forEach(function(c, i) { c.order = i; });

  var novelVersion = String(raw.novelVersion != null ? raw.novelVersion : base.novelVersion).trim() || '1';

  return {
    id: String(raw.id || base.id),
    title: String(raw.title != null ? raw.title : base.title) || '未命名小说',
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : base.createdAt,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : base.updatedAt,
    cardId: String(raw.cardId || ''),
    novelVersion: novelVersion,
    publishedDisplayVersion: String(
      raw.publishedDisplayVersion != null ? raw.publishedDisplayVersion : base.publishedDisplayVersion
    ),
    publishedAt: typeof raw.publishedAt === 'number' ? raw.publishedAt : base.publishedAt,
    shareToken: String(raw.shareToken != null ? raw.shareToken : ''),
    graph: {
      nodes: Array.isArray(graphRaw.nodes) ? graphRaw.nodes.map(normalizeNode) : [],
      edges: Array.isArray(graphRaw.edges) ? graphRaw.edges.map(normalizeEdge) : [],
      updatedAt: String(graphRaw.updatedAt || ''),
    },
    outline: outline,
    chapters: chapters,
    bookmarks: Array.isArray(raw.bookmarks) ? raw.bookmarks.map(normalizeBookmark) : [],
    readState: {
      chapterId: String(readRaw.chapterId || ''),
      mode: mode,
      pageIndex: typeof readRaw.pageIndex === 'number' ? Math.max(0, readRaw.pageIndex) : 0,
    },
    writeSettings: {
      syncMvuStatusBar: !!writeRaw.syncMvuStatusBar,
      autoContinue: !!writeRaw.autoContinue,
    },
  };
}

/** 目录条目摘要 */
export function toCatalogEntry(novel) {
  var n = normalizeNovel(novel);
  return {
    id: n.id,
    title: n.title,
    updatedAt: n.updatedAt,
    chapterCount: n.chapters.length,
    outlineCount: n.outline.length,
    novelVersion: n.novelVersion,
    publishedDisplayVersion: n.publishedDisplayVersion,
    shareToken: n.shareToken || '',
  };
}

export function upsertCatalogEntry(list, novel) {
  var entry = toCatalogEntry(novel);
  var arr = Array.isArray(list) ? list.slice() : [];
  var idx = arr.findIndex(function(x) { return x && x.id === entry.id; });
  if (idx >= 0) arr[idx] = Object.assign({}, arr[idx], entry);
  else arr.unshift(entry);
  arr.sort(function(a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
  return arr;
}

export function removeCatalogEntry(list, novelId) {
  var id = String(novelId || '');
  return (Array.isArray(list) ? list : []).filter(function(x) { return x && x.id !== id; });
}

/** 从某大纲索引起废弃后续（含该索引） */
export function discardOutlineFrom(novel, fromIndex) {
  var n = normalizeNovel(novel);
  var i = Math.max(0, Number(fromIndex) || 0);
  n.outline = n.outline.filter(function(_, idx) { return idx < i; });
  n.outline.forEach(function(o, idx) { o.order = idx; });
  // 同步裁剪超出大纲的章节正文（按 order）
  n.chapters = n.chapters.filter(function(c) { return c.order < i; });
  n.chapters.forEach(function(c, idx) { c.order = idx; });
  n.updatedAt = Date.now();
  return n;
}

/** 确保章节数组与大纲对齐（缺章则补空章） */
export function syncChaptersFromOutline(novel) {
  var n = normalizeNovel(novel);
  var byOrder = {};
  n.chapters.forEach(function(c) { byOrder[c.order] = c; });
  n.chapters = n.outline.map(function(o, idx) {
    var existing = byOrder[idx];
    if (existing) {
      return createEmptyChapter({
        id: existing.id,
        title: existing.title || o.title,
        summary: existing.summary || o.summary,
        content: existing.content,
        advancePrompt: existing.advancePrompt,
        order: idx,
      });
    }
    return createEmptyChapter({
      title: o.title,
      summary: o.summary,
      order: idx,
    });
  });
  n.updatedAt = Date.now();
  return n;
}
