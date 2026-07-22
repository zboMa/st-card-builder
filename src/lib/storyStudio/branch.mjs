/**
 * 章节分支世界：从某章拉出平行线
 *
 * 模型：
 * - novel.branches[]：分支目录
 * - novel.activeBranchId
 * - chapter / outlineItem 带 branchId
 * - 子分支继承父线 forkOrder（含）及之前的章；其后为分支私有章
 */

import { genStoryId, createEmptyChapter } from './state.mjs';

export var MAIN_BRANCH_NAME = '主线';

export function createMainBranch(partial) {
  var p = partial || {};
  return {
    id: p.id || genStoryId('br'),
    name: String(p.name != null ? p.name : MAIN_BRANCH_NAME),
    parentBranchId: '',
    forkChapterId: '',
    forkOrder: -1,
    direction: String(p.direction != null ? p.direction : ''),
    createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
  };
}

export function normalizeBranch(raw) {
  var b = raw && typeof raw === 'object' ? raw : {};
  return {
    id: String(b.id || genStoryId('br')),
    name: String(b.name != null ? b.name : '分支'),
    parentBranchId: String(b.parentBranchId || ''),
    forkChapterId: String(b.forkChapterId || ''),
    forkOrder: typeof b.forkOrder === 'number' ? b.forkOrder : -1,
    direction: String(b.direction != null ? b.direction : ''),
    createdAt: typeof b.createdAt === 'number' ? b.createdAt : Date.now(),
  };
}

/** 确保至少有主线 */
export function ensureBranches(novel) {
  var n = novel && typeof novel === 'object' ? novel : {};
  if (!Array.isArray(n.branches) || !n.branches.length) {
    var main = createMainBranch({ name: MAIN_BRANCH_NAME });
    n.branches = [main];
    n.activeBranchId = main.id;
    (n.chapters || []).forEach(function(c) {
      if (c && !c.branchId) c.branchId = main.id;
    });
    (n.outline || []).forEach(function(o) {
      if (o && !o.branchId) o.branchId = main.id;
    });
    (n.plotLedger || []).forEach(function(item) {
      if (item && !item.branchId) item.branchId = main.id;
    });
  } else {
    n.branches = n.branches.map(normalizeBranch);
  }
  if (!n.activeBranchId || !n.branches.some(function(b) { return b.id === n.activeBranchId; })) {
    n.activeBranchId = n.branches[0].id;
  }
  return n;
}

export function getBranch(novel, branchId) {
  var n = ensureBranches(novel);
  var id = String(branchId || n.activeBranchId);
  return n.branches.find(function(b) { return b.id === id; }) || n.branches[0];
}

/** 从叶到根的分支链（含自身） */
export function branchAncestry(novel, branchId) {
  var n = ensureBranches(novel);
  var chain = [];
  var cur = getBranch(n, branchId);
  var guard = 0;
  while (cur && guard++ < 64) {
    chain.push(cur);
    if (!cur.parentBranchId) break;
    cur = n.branches.find(function(b) { return b.id === cur.parentBranchId; });
  }
  return chain;
}

/**
 * 解析某分支可见章节（继承 + 私有），按阅读顺序
 * @returns {object[]} chapters（引用原对象）
 */
export function resolveBranchChapters(novel, branchId) {
  var n = ensureBranches(novel);
  var branch = getBranch(n, branchId);
  var all = Array.isArray(n.chapters) ? n.chapters : [];
  var ancestry = branchAncestry(n, branch.id).reverse(); // 根→叶

  var result = [];
  var inheritedUntil = -1;

  ancestry.forEach(function(br, depth) {
    var isLeaf = depth === ancestry.length - 1;
    var owned = all
      .filter(function(c) { return c && c.branchId === br.id; })
      .slice()
      .sort(function(a, b) { return (a.order || 0) - (b.order || 0); });

    if (!isLeaf) {
      // 祖先：只取到「下一层 forkOrder」为止
      var child = ancestry[depth + 1];
      var forkAt = child && typeof child.forkOrder === 'number' ? child.forkOrder : -1;
      owned.forEach(function(c) {
        var ord = typeof c.order === 'number' ? c.order : 0;
        if (ord <= forkAt) result.push(c);
      });
      inheritedUntil = forkAt;
    } else {
      // 叶分支：fork 之后的私有章；若 forkOrder<0 则全部
      owned.forEach(function(c) {
        var ord = typeof c.order === 'number' ? c.order : 0;
        if (br.forkOrder < 0 || ord > br.forkOrder) result.push(c);
      });
    }
  });

  // 若叶分支尚无私有章，且需要继续写：不自动补，由 sync 负责
  void inheritedUntil;
  return result;
}

/** 解析某分支可见大纲 */
export function resolveBranchOutline(novel, branchId) {
  var n = ensureBranches(novel);
  var branch = getBranch(n, branchId);
  var all = Array.isArray(n.outline) ? n.outline : [];
  var ancestry = branchAncestry(n, branch.id).reverse();
  var result = [];

  ancestry.forEach(function(br, depth) {
    var isLeaf = depth === ancestry.length - 1;
    var owned = all
      .filter(function(o) { return o && o.branchId === br.id; })
      .slice()
      .sort(function(a, b) { return (a.order || 0) - (b.order || 0); });

    if (!isLeaf) {
      var child = ancestry[depth + 1];
      var forkAt = child && typeof child.forkOrder === 'number' ? child.forkOrder : -1;
      owned.forEach(function(o) {
        var ord = typeof o.order === 'number' ? o.order : 0;
        if (ord <= forkAt) result.push(o);
      });
    } else {
      owned.forEach(function(o) {
        var ord = typeof o.order === 'number' ? o.order : 0;
        if (br.forkOrder < 0 || ord > br.forkOrder) result.push(o);
      });
    }
  });
  return result;
}

/**
 * 从当前分支的某章（可见列表中的下标或 chapterId）开新分支
 * @param {object} novel
 * @param {{ fromChapterId?: string, fromOrder?: number, name?: string, direction?: string }} opts
 */
export function forkBranchFromChapter(novel, opts) {
  var n = ensureBranches(novel);
  var o = opts || {};
  var parent = getBranch(n, n.activeBranchId);
  var visible = resolveBranchChapters(n, parent.id);
  var fromOrder = typeof o.fromOrder === 'number' ? o.fromOrder : -1;
  var fromChapterId = String(o.fromChapterId || '');
  var forkCh = null;

  if (fromChapterId) {
    forkCh = visible.find(function(c) { return c.id === fromChapterId; });
  } else if (fromOrder >= 0) {
    forkCh = visible.find(function(c) { return (c.order === fromOrder) || visible.indexOf(c) === fromOrder; });
    if (!forkCh && visible[fromOrder]) forkCh = visible[fromOrder];
  }
  if (!forkCh && visible.length) forkCh = visible[visible.length - 1];
  if (!forkCh) {
    throw new Error('没有可用于分支的章节');
  }

  // forkOrder 使用「可见序列中的全局阅读序号」更直观：用可见下标
  var visIdx = visible.findIndex(function(c) { return c.id === forkCh.id; });
  var forkOrder = visIdx >= 0 ? visIdx : (typeof forkCh.order === 'number' ? forkCh.order : 0);

  var child = normalizeBranch({
    id: genStoryId('br'),
    name: String(o.name || ('分支·' + (forkCh.title || ('第' + (forkOrder + 1) + '章')))).slice(0, 40),
    parentBranchId: parent.id,
    forkChapterId: forkCh.id,
    forkOrder: forkOrder,
    direction: String(o.direction || ''),
    createdAt: Date.now(),
  });

  n.branches.push(child);
  n.activeBranchId = child.id;

  // 为子分支准备下一章空位（大纲+章），不复制父线后续
  var nextOrder = forkOrder + 1;
  var nextTitle = '第' + (nextOrder + 1) + '章';
  n.outline.push({
    id: genStoryId('ol'),
    title: nextTitle,
    summary: child.direction ? ('【分支】' + child.direction) : '',
    order: nextOrder,
    branchId: child.id,
  });
  n.chapters.push(createEmptyChapter({
    title: nextTitle,
    summary: child.direction ? ('【分支】' + child.direction) : '',
    order: nextOrder,
    branchId: child.id,
    advancePrompt: child.direction || '',
  }));

  n.updatedAt = Date.now();
  return { novel: n, branch: child, forkChapter: forkCh };
}

export function setActiveBranch(novel, branchId) {
  var n = ensureBranches(novel);
  var id = String(branchId || '');
  if (!n.branches.some(function(b) { return b.id === id; })) {
    throw new Error('分支不存在');
  }
  n.activeBranchId = id;
  n.updatedAt = Date.now();
  return n;
}

/** 账本按分支过滤（含祖先共享条目：planted 在 fork 前的） */
export function resolveBranchLedger(novel, branchId) {
  var n = ensureBranches(novel);
  var branch = getBranch(n, branchId);
  var ledger = Array.isArray(n.plotLedger) ? n.plotLedger : [];
  var ancestryIds = branchAncestry(n, branch.id).map(function(b) { return b.id; });
  return ledger.filter(function(item) {
    if (!item) return false;
    var bid = item.branchId || (n.branches[0] && n.branches[0].id);
    return ancestryIds.indexOf(bid) >= 0;
  });
}

/**
 * 同步：保证当前分支在 fork 之后至少有大纲/章节对齐
 * 仅处理叶分支私有部分；父线章节不改
 */
export function syncBranchChaptersFromOutline(novel, branchId) {
  var n = ensureBranches(novel);
  var branch = getBranch(n, branchId);
  var outlineOwned = (n.outline || [])
    .filter(function(o) { return o && o.branchId === branch.id; })
    .slice()
    .sort(function(a, b) { return (a.order || 0) - (b.order || 0); });

  var byOrder = {};
  (n.chapters || []).forEach(function(c) {
    if (c && c.branchId === branch.id) byOrder[c.order] = c;
  });

  outlineOwned.forEach(function(o) {
    var existing = byOrder[o.order];
    if (existing) {
      if (!existing.title) existing.title = o.title;
      if (!existing.summary) existing.summary = o.summary;
    } else {
      n.chapters.push(createEmptyChapter({
        title: o.title,
        summary: o.summary,
        order: o.order,
        branchId: branch.id,
      }));
    }
  });
  n.updatedAt = Date.now();
  return n;
}

export function branchBrief(novel, branchId) {
  var b = getBranch(novel, branchId);
  if (!b) return '';
  var parts = ['分支：' + b.name];
  if (b.parentBranchId) parts.push('自第' + (b.forkOrder + 1) + '章分叉');
  if (b.direction) parts.push('方向：' + b.direction);
  return parts.join(' · ');
}
