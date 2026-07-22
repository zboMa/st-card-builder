/**
 * 读者选线：路径解析 / 本地进度 / 从分享复制为可编辑稿
 */

import {
  ensureBranches,
  getRootBranch,
  getBranch,
  resolveBranchChapters,
  getChoiceOptionsAfterChapter,
  BRANCH_KIND_ENDING,
} from './branch.mjs';
import { normalizeNovel, genStoryId, createEmptyNovel } from './state.mjs';

export function isTreeRelease(novel) {
  return !!(novel && Array.isArray(novel.branches) && novel.branches.length);
}

/** @param {string} token @param {string} [version] 钉版本时与 latest 进度隔离 */
export function playStorageKey(token, version) {
  var t = String(token || '');
  var v = String(version || '').trim();
  if (v) return 'st_v3_share_play_v1:' + t + ':v:' + encodeURIComponent(v);
  return 'st_v3_share_play_v1:' + t;
}

function parsePlayRaw(raw) {
  if (!raw) return null;
  var obj = JSON.parse(raw);
  if (!obj || typeof obj !== 'object') return null;
  return {
    currentBranchId: String(obj.currentBranchId || ''),
    chapterId: String(obj.chapterId || ''),
    choices: Array.isArray(obj.choices) ? obj.choices : [],
  };
}

/** 有钉版本时先读 versioned key，再回退到旧 token-only key */
export function loadPlayState(token, version) {
  try {
    var v = String(version || '').trim();
    var raw = localStorage.getItem(playStorageKey(token, v));
    if (!raw && v) raw = localStorage.getItem(playStorageKey(token));
    return parsePlayRaw(raw);
  } catch (e) {
    return null;
  }
}

export function savePlayState(token, state, version) {
  try {
    localStorage.setItem(playStorageKey(token, version), JSON.stringify({
      currentBranchId: state.currentBranchId || '',
      chapterId: state.chapterId || '',
      choices: Array.isArray(state.choices) ? state.choices : [],
      updatedAt: Date.now(),
    }));
  } catch (e) { /* ignore */ }
}

export function clearPlayState(token, version) {
  try { localStorage.removeItem(playStorageKey(token, version)); } catch (e) { /* ignore */ }
}

/**
 * 初始化或修复读者进度
 */
export function initPlayState(novel, saved) {
  var n = ensureBranches(novel);
  var root = getRootBranch(n);
  var branchId = (saved && saved.currentBranchId) || root.id;
  if (!n.branches.some(function(b) { return b.id === branchId; })) branchId = root.id;
  var chapters = resolveBranchChapters(n, branchId);
  var chapterId = saved && saved.chapterId;
  if (!chapters.some(function(c) { return c.id === chapterId; })) {
    chapterId = chapters[0] && chapters[0].id || '';
  }
  return {
    currentBranchId: branchId,
    chapterId: chapterId,
    choices: (saved && saved.choices) || [],
  };
}

export function pathChapters(novel, branchId) {
  return resolveBranchChapters(ensureBranches(novel), branchId);
}

export function chapterIndexOnPath(novel, branchId, chapterId) {
  var list = pathChapters(novel, branchId);
  return list.findIndex(function(c) { return c.id === chapterId; });
}

/**
 * 当前章后的选线选项（仅发布稿通常已是 ready 子集；仍可 onlyReady）
 */
export function choicesAtChapter(novel, branchId, chapterId) {
  return getChoiceOptionsAfterChapter(novel, chapterId, branchId, { onlyReady: true });
}

export function isEndingBranch(novel, branchId) {
  var b = getBranch(novel, branchId);
  return !!(b && b.kind === BRANCH_KIND_ENDING);
}

export function endingInfo(novel, branchId) {
  var b = getBranch(novel, branchId);
  if (!b) return null;
  if (b.kind !== BRANCH_KIND_ENDING) return null;
  return {
    title: String(b.endingTitle || b.name || '结局'),
    name: b.name,
    teaser: b.choiceTeaser || b.direction || '',
  };
}

/**
 * 将公开分享稿转为可编辑本地小说（新 id，清分享字段）
 */
export function sharedNovelToEditableDraft(shared, opts) {
  var o = opts || {};
  var src = shared && typeof shared === 'object' ? shared : {};
  var titleBase = String(src.title || '未命名小说').trim() || '未命名小说';
  var title = o.title || (titleBase + '（副本）');
  var draft = normalizeNovel({
    id: genStoryId('novel'),
    title: title,
    cardId: String(o.cardId || ''),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    novelVersion: '1',
    publishedDisplayVersion: '',
    publishedAt: 0,
    shareToken: '',
    graph: src.graph || { nodes: [], edges: [], updatedAt: '' },
    outline: Array.isArray(src.outline) ? src.outline : [],
    chapters: Array.isArray(src.chapters) ? src.chapters : [],
    bookmarks: [],
    readState: { chapterId: '', mode: 'swipe', pageIndex: 0 },
    writeSettings: {},
    branches: Array.isArray(src.branches) ? src.branches : undefined,
    activeBranchId: src.activeBranchId || '',
    plotLedger: Array.isArray(src.plotLedger) ? src.plotLedger : [],
    wizard: { step: '', direction: '', approvedOutline: true },
  });

  // 无 branches 的旧线性稿：归入主线
  if (!Array.isArray(src.branches) || !src.branches.length) {
    var empty = createEmptyNovel({ title: title, cardId: o.cardId });
    draft.branches = empty.branches;
    draft.activeBranchId = empty.activeBranchId;
    var mainId = empty.activeBranchId;
    draft.chapters.forEach(function(c, i) {
      c.branchId = mainId;
      c.order = typeof c.order === 'number' ? c.order : i;
    });
    draft.outline.forEach(function(ol, i) {
      ol.branchId = mainId;
      ol.order = typeof ol.order === 'number' ? ol.order : i;
    });
  }

  // 副本默认全部可再编辑发布
  (draft.branches || []).forEach(function(b) {
    b.publishReady = true;
  });
  return draft;
}
