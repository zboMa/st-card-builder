/**
 * 小说创作状态：normalize / id / 目录摘要 / 分支感知
 */

import { ensureBranches, resolveBranchChapters, resolveBranchOutline, syncBranchChaptersFromOutline } from './branch.mjs';
import { normalizeLedgerItem } from './plotLedger.mjs';

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

export function createEmptyFeedForward() {
  return { summary: '', openThreads: [], tension: 5, updatedAt: 0 };
}

export function createEmptyChapter(partial) {
  var p = partial || {};
  var ff = p.feedForward && typeof p.feedForward === 'object' ? p.feedForward : null;
  return {
    id: p.id || genStoryId('ch'),
    title: String(p.title != null ? p.title : '未命名章节'),
    summary: String(p.summary != null ? p.summary : ''),
    content: String(p.content != null ? p.content : ''),
    advancePrompt: String(p.advancePrompt != null ? p.advancePrompt : ''),
    order: typeof p.order === 'number' ? p.order : 0,
    branchId: String(p.branchId || ''),
    feedForward: {
      summary: String((ff && ff.summary) || ''),
      openThreads: Array.isArray(ff && ff.openThreads) ? ff.openThreads.map(String) : [],
      tension: typeof (ff && ff.tension) === 'number' ? ff.tension : 5,
      updatedAt: typeof (ff && ff.updatedAt) === 'number' ? ff.updatedAt : 0,
    },
    quality: p.quality && typeof p.quality === 'object' ? p.quality : null,
    checkpoints: Array.isArray(p.checkpoints) ? p.checkpoints.slice(0, 5) : [],
  };
}

export function createEmptyNovel(partial) {
  var p = partial || {};
  var now = Date.now();
  var mainId = p.mainBranchId || genStoryId('br');
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
      batchCount: 3,
      runFeedForward: true,
      runQuality: true,
      stopOnQualityFail: false,
    },
    branches: [
      {
        id: mainId,
        name: '主线',
        parentBranchId: '',
        forkChapterId: '',
        forkOrder: -1,
        direction: '',
        createdAt: now,
      },
    ],
    activeBranchId: mainId,
    plotLedger: [],
    wizard: {
      step: '',
      direction: '',
      approvedOutline: false,
    },
    /** 正式版本列表（切版/增版/发布写入；普通保存不写） */
    versions: [],
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

function normalizeOutlineItem(raw, idx, defaultBranchId) {
  var o = raw && typeof raw === 'object' ? raw : {};
  return {
    id: String(o.id || genStoryId('ol')),
    title: String(o.title != null ? o.title : ('第' + (idx + 1) + '章')),
    summary: String(o.summary != null ? o.summary : ''),
    order: typeof o.order === 'number' ? o.order : idx,
    branchId: String(o.branchId || defaultBranchId || ''),
  };
}

function normalizeChapter(raw, idx, defaultBranchId) {
  var c = raw && typeof raw === 'object' ? raw : {};
  return createEmptyChapter({
    id: c.id,
    title: c.title,
    summary: c.summary,
    content: c.content,
    advancePrompt: c.advancePrompt,
    order: typeof c.order === 'number' ? c.order : idx,
    branchId: c.branchId || defaultBranchId,
    feedForward: c.feedForward,
    quality: c.quality,
    checkpoints: c.checkpoints,
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

function normalizeWriteSettings(raw) {
  var writeRaw = raw && typeof raw === 'object' ? raw : {};
  return {
    syncMvuStatusBar: !!writeRaw.syncMvuStatusBar,
    autoContinue: !!writeRaw.autoContinue,
    batchCount: Math.max(1, Math.min(20, Math.floor(Number(writeRaw.batchCount) || 3))),
    runFeedForward: writeRaw.runFeedForward !== false,
    runQuality: writeRaw.runQuality !== false,
    stopOnQualityFail: !!writeRaw.stopOnQualityFail,
  };
}

/** 合并/清洗持久化小说文档 */
export function normalizeNovel(raw) {
  var base = createEmptyNovel();
  if (!raw || typeof raw !== 'object') return base;
  var graphRaw = raw.graph && typeof raw.graph === 'object' ? raw.graph : {};
  var readRaw = raw.readState && typeof raw.readState === 'object' ? raw.readState : {};
  var mode = String(readRaw.mode || 'swipe');
  if (mode !== 'swipe' && mode !== 'page') mode = 'swipe';

  var novelVersion = String(raw.novelVersion != null ? raw.novelVersion : base.novelVersion).trim() || '1';

  var n = {
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
    outline: [],
    chapters: [],
    bookmarks: Array.isArray(raw.bookmarks) ? raw.bookmarks.map(normalizeBookmark) : [],
    readState: {
      chapterId: String(readRaw.chapterId || ''),
      mode: mode,
      pageIndex: typeof readRaw.pageIndex === 'number' ? Math.max(0, readRaw.pageIndex) : 0,
    },
    writeSettings: normalizeWriteSettings(raw.writeSettings),
    branches: Array.isArray(raw.branches) ? raw.branches.slice() : base.branches.slice(),
    activeBranchId: String(raw.activeBranchId || ''),
    plotLedger: Array.isArray(raw.plotLedger) ? raw.plotLedger.map(normalizeLedgerItem) : [],
    wizard: {
      step: String((raw.wizard && raw.wizard.step) || ''),
      direction: String((raw.wizard && raw.wizard.direction) || ''),
      approvedOutline: !!(raw.wizard && raw.wizard.approvedOutline),
    },
    versions: Array.isArray(raw.versions) ? raw.versions.slice() : [],
  };

  ensureBranches(n);
  var mainId = n.branches[0].id;

  var outline = Array.isArray(raw.outline)
    ? raw.outline.map(function(o, i) { return normalizeOutlineItem(o, i, mainId); })
    : [];
  outline.sort(function(a, b) { return a.order - b.order; });
  n.outline = outline;

  var chapters = Array.isArray(raw.chapters)
    ? raw.chapters.map(function(c, i) { return normalizeChapter(c, i, mainId); })
    : [];
  chapters.sort(function(a, b) { return a.order - b.order; });
  n.chapters = chapters;

  // 旧数据：无 branchId 的章/大纲归主线
  n.outline.forEach(function(o) { if (!o.branchId) o.branchId = mainId; });
  n.chapters.forEach(function(c) { if (!c.branchId) c.branchId = mainId; });
  n.plotLedger.forEach(function(item) { if (!item.branchId) item.branchId = mainId; });

  // 仅主线重排为 0..n-1；子分支保留绝对 order（相对 forkOrder）
  var mainOl = n.outline.filter(function(o) { return o.branchId === mainId; })
    .sort(function(a, b) { return a.order - b.order; });
  mainOl.forEach(function(o, i) { o.order = i; });
  var mainCh = n.chapters.filter(function(c) { return c.branchId === mainId; })
    .sort(function(a, b) { return a.order - b.order; });
  mainCh.forEach(function(c, i) { c.order = i; });

  return n;
}

/** 目录条目摘要 */
export function toCatalogEntry(novel) {
  var n = normalizeNovel(novel);
  var visible = resolveBranchChapters(n, n.activeBranchId);
  return {
    id: n.id,
    title: n.title,
    updatedAt: n.updatedAt,
    chapterCount: visible.length,
    outlineCount: resolveBranchOutline(n, n.activeBranchId).length,
    novelVersion: n.novelVersion,
    publishedDisplayVersion: n.publishedDisplayVersion,
    shareToken: n.shareToken || '',
    branchCount: (n.branches || []).length,
    activeBranchId: n.activeBranchId,
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

/**
 * 从某大纲索引起废弃后续（含该索引）——仅作用于当前活动分支的可见范围
 */
export function discardOutlineFrom(novel, fromIndex) {
  var n = normalizeNovel(novel);
  var i = Math.max(0, Number(fromIndex) || 0);
  var branchId = n.activeBranchId;
  var visibleOl = resolveBranchOutline(n, branchId);
  var keepIds = {};
  visibleOl.forEach(function(o, idx) {
    if (idx < i) keepIds[o.id] = true;
  });

  // 删除当前分支上 fromIndex 及之后的私有大纲；父线继承章不动
  var branch = (n.branches || []).find(function(b) { return b.id === branchId; });
  var forkOrder = branch && typeof branch.forkOrder === 'number' ? branch.forkOrder : -1;

  n.outline = (n.outline || []).filter(function(o) {
    if (!o) return false;
    if (o.branchId !== branchId) return true;
    if (forkOrder >= 0 && o.order <= forkOrder) return true;
    // 可见列表中的下标：用 keepIds
    return !!keepIds[o.id];
  });

  var visibleCh = resolveBranchChapters(n, branchId);
  var keepCh = {};
  visibleCh.forEach(function(c, idx) {
    if (idx < i) keepCh[c.id] = true;
  });
  n.chapters = (n.chapters || []).filter(function(c) {
    if (!c) return false;
    if (c.branchId !== branchId) return true;
    if (forkOrder >= 0 && c.order <= forkOrder) return true;
    return !!keepCh[c.id];
  });

  n.updatedAt = Date.now();
  return n;
}

/**
 * 确保当前分支章节与大纲对齐（缺章则补空章）
 * 主线：全量按大纲；子分支：仅同步本分支私有大纲
 */
export function syncChaptersFromOutline(novel) {
  var n = normalizeNovel(novel);
  var branchId = n.activeBranchId;
  var branch = (n.branches || []).find(function(b) { return b.id === branchId; });
  var isMain = !branch || !branch.parentBranchId;

  if (!isMain) {
    return syncBranchChaptersFromOutline(n, branchId);
  }

  var outline = resolveBranchOutline(n, branchId);
  var byOrder = {};
  n.chapters.forEach(function(c) {
    if (c.branchId === branchId) byOrder[c.order] = c;
  });
  // 重建主线章节：保留已有 id/正文
  var mainChapters = outline.map(function(o, idx) {
    var existing = byOrder[idx] || byOrder[o.order];
    if (existing) {
      return createEmptyChapter({
        id: existing.id,
        title: existing.title || o.title,
        summary: existing.summary || o.summary,
        content: existing.content,
        advancePrompt: existing.advancePrompt,
        order: idx,
        branchId: branchId,
        feedForward: existing.feedForward,
        quality: existing.quality,
        checkpoints: existing.checkpoints,
      });
    }
    return createEmptyChapter({
      title: o.title,
      summary: o.summary,
      order: idx,
      branchId: branchId,
    });
  });
  // 保留其他分支的章节
  var other = n.chapters.filter(function(c) { return c.branchId && c.branchId !== branchId; });
  n.chapters = mainChapters.concat(other);
  // 主线大纲 order 重整
  outline.forEach(function(o, idx) { o.order = idx; });
  n.updatedAt = Date.now();
  return n;
}

/** 当前活动分支可见章节 */
export function getActiveChapters(novel) {
  var n = normalizeNovel(novel);
  return resolveBranchChapters(n, n.activeBranchId);
}

/** 当前活动分支可见大纲 */
export function getActiveOutline(novel) {
  var n = normalizeNovel(novel);
  return resolveBranchOutline(n, n.activeBranchId);
}
