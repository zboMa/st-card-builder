/**
 * 章节分支世界：从某章拉出平行线
 *
 * 模型：
 * - novel.branches[]：分支目录（含结局/选项文案/是否纳入发布）
 * - novel.activeBranchId
 * - chapter / outlineItem 带 branchId
 * - 子分支继承父线 forkOrder（含）及之前的章；其后为分支私有章
 */

import { genStoryId, createEmptyChapter } from './state.mjs';

export var MAIN_BRANCH_NAME = '主线';
export var BRANCH_KIND_PATH = 'path';
export var BRANCH_KIND_ENDING = 'ending';

export function createMainBranch(partial) {
  var p = partial || {};
  return normalizeBranch({
    id: p.id || genStoryId('br'),
    name: String(p.name != null ? p.name : MAIN_BRANCH_NAME),
    parentBranchId: '',
    forkChapterId: '',
    forkOrder: -1,
    direction: String(p.direction != null ? p.direction : ''),
    choiceLabel: String(p.choiceLabel != null ? p.choiceLabel : ''),
    choiceTeaser: String(p.choiceTeaser != null ? p.choiceTeaser : ''),
    kind: BRANCH_KIND_PATH,
    endingTitle: '',
    publishReady: p.publishReady !== false,
    createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
  });
}

export function normalizeBranch(raw) {
  var b = raw && typeof raw === 'object' ? raw : {};
  var kind = String(b.kind || BRANCH_KIND_PATH);
  if (kind !== BRANCH_KIND_ENDING) kind = BRANCH_KIND_PATH;
  return {
    id: String(b.id || genStoryId('br')),
    name: String(b.name != null ? b.name : '分支'),
    parentBranchId: String(b.parentBranchId || ''),
    forkChapterId: String(b.forkChapterId || ''),
    forkOrder: typeof b.forkOrder === 'number' ? b.forkOrder : -1,
    direction: String(b.direction != null ? b.direction : ''),
    choiceLabel: String(b.choiceLabel != null ? b.choiceLabel : ''),
    choiceTeaser: String(b.choiceTeaser != null ? b.choiceTeaser : ''),
    kind: kind,
    endingTitle: String(b.endingTitle != null ? b.endingTitle : ''),
    publishReady: b.publishReady !== false,
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
      var child = ancestry[depth + 1];
      var forkAt = child && typeof child.forkOrder === 'number' ? child.forkOrder : -1;
      owned.forEach(function(c) {
        var ord = typeof c.order === 'number' ? c.order : 0;
        if (ord <= forkAt) result.push(c);
      });
      inheritedUntil = forkAt;
    } else {
      owned.forEach(function(c) {
        var ord = typeof c.order === 'number' ? c.order : 0;
        if (br.forkOrder < 0 || ord > br.forkOrder) result.push(c);
      });
    }
  });

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
 * 某章之后的可选子支（读者选线 / 作者预览）
 * @param {{ onlyReady?: boolean }} [opts]
 */
export function getChoiceOptionsAfterChapter(novel, chapterId, parentBranchId, opts) {
  var n = ensureBranches(novel);
  var o = opts || {};
  var chId = String(chapterId || '');
  var parentId = String(parentBranchId || n.activeBranchId);
  if (!chId) return [];
  return n.branches.filter(function(b) {
    if (!b || b.parentBranchId !== parentId) return false;
    if (String(b.forkChapterId || '') !== chId) return false;
    if (o.onlyReady && !b.publishReady) return false;
    return true;
  }).map(function(b) {
    return {
      branchId: b.id,
      name: b.name,
      label: String(b.choiceLabel || b.name || '分支'),
      teaser: String(b.choiceTeaser || b.direction || ''),
      kind: b.kind,
      endingTitle: b.endingTitle,
      publishReady: !!b.publishReady,
    };
  });
}

/** 构建缩进树（用于作者 UI） */
export function buildBranchTree(novel) {
  var n = ensureBranches(novel);
  var byParent = {};
  n.branches.forEach(function(b) {
    var pid = b.parentBranchId || '';
    if (!byParent[pid]) byParent[pid] = [];
    byParent[pid].push(b);
  });
  Object.keys(byParent).forEach(function(k) {
    byParent[k].sort(function(a, b) { return (a.forkOrder || 0) - (b.forkOrder || 0) || a.createdAt - b.createdAt; });
  });
  var rows = [];
  function walk(parentId, depth) {
    (byParent[parentId] || []).forEach(function(b) {
      rows.push({ branch: b, depth: depth });
      walk(b.id, depth + 1);
    });
  }
  walk('', 0);
  // 若主线 parent 为空已覆盖；兼容孤儿
  n.branches.forEach(function(b) {
    if (rows.some(function(r) { return r.branch.id === b.id; })) return;
    rows.push({ branch: b, depth: 0 });
  });
  return rows;
}

/**
 * 发布用：收集 publishReady 支及其祖先，裁剪 chapters/outline
 */
export function filterNovelForPublish(novel) {
  var n = ensureBranches(JSON.parse(JSON.stringify(novel || {})));
  var mainId = n.branches[0] && n.branches[0].id;
  (n.chapters || []).forEach(function(c) {
    if (c && !c.branchId) c.branchId = mainId;
  });
  (n.outline || []).forEach(function(o) {
    if (o && !o.branchId) o.branchId = mainId;
  });
  var readyIds = {};
  n.branches.forEach(function(b) {
    if (b.publishReady) readyIds[b.id] = true;
  });
  // 祖先必须带上
  Object.keys(readyIds).forEach(function(id) {
    branchAncestry(n, id).forEach(function(b) { readyIds[b.id] = true; });
  });
  if (!Object.keys(readyIds).length && n.branches[0]) {
    readyIds[n.branches[0].id] = true;
  }
  n.branches = n.branches.filter(function(b) { return readyIds[b.id]; });
  n.chapters = (n.chapters || []).filter(function(c) { return c && readyIds[c.branchId]; });
  n.outline = (n.outline || []).filter(function(o) { return o && readyIds[o.branchId]; });
  n.plotLedger = (n.plotLedger || []).filter(function(item) {
    return !item || !item.branchId || readyIds[item.branchId];
  });
  if (!readyIds[n.activeBranchId]) n.activeBranchId = n.branches[0] && n.branches[0].id;
  n.publishedBranchIds = n.branches.map(function(b) { return b.id; });
  return n;
}

/** 增版前校验 */
export function validatePublishReady(novel) {
  var n = ensureBranches(novel);
  var issues = [];
  var ready = n.branches.filter(function(b) { return b.publishReady; });
  if (!ready.length) issues.push('至少勾选一条纳入发布的分支');
  ready.forEach(function(b) {
    var chs = resolveBranchChapters(n, b.id);
    var hasBody = chs.some(function(c) { return String(c.content || '').trim() || String(c.summary || '').trim(); });
    if (!hasBody) issues.push('分支「' + b.name + '」尚无正文或摘要');
    if (b.kind === BRANCH_KIND_ENDING && !String(b.endingTitle || '').trim()) {
      issues.push('结局支「' + b.name + '」建议填写结局标题');
    }
  });
  return { ok: issues.length === 0, issues: issues };
}

/**
 * 从当前分支的某章开新分支
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

  var visIdx = visible.findIndex(function(c) { return c.id === forkCh.id; });
  var forkOrder = visIdx >= 0 ? visIdx : (typeof forkCh.order === 'number' ? forkCh.order : 0);

  var child = normalizeBranch({
    id: genStoryId('br'),
    name: String(o.name || ('分支·' + (forkCh.title || ('第' + (forkOrder + 1) + '章')))).slice(0, 40),
    parentBranchId: parent.id,
    forkChapterId: forkCh.id,
    forkOrder: forkOrder,
    direction: String(o.direction || ''),
    choiceLabel: String(o.choiceLabel || o.name || ''),
    choiceTeaser: String(o.choiceTeaser || o.direction || ''),
    kind: o.kind === BRANCH_KIND_ENDING ? BRANCH_KIND_ENDING : BRANCH_KIND_PATH,
    endingTitle: String(o.endingTitle || ''),
    publishReady: o.publishReady !== false,
    createdAt: Date.now(),
  });

  n.branches.push(child);
  n.activeBranchId = child.id;

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

export function patchBranch(novel, branchId, patch) {
  var n = ensureBranches(novel);
  var b = n.branches.find(function(x) { return x.id === branchId; });
  if (!b) throw new Error('分支不存在');
  var p = patch || {};
  if (p.name != null) b.name = String(p.name).slice(0, 40);
  if (p.direction != null) b.direction = String(p.direction);
  if (p.choiceLabel != null) b.choiceLabel = String(p.choiceLabel);
  if (p.choiceTeaser != null) b.choiceTeaser = String(p.choiceTeaser);
  if (p.kind != null) b.kind = p.kind === BRANCH_KIND_ENDING ? BRANCH_KIND_ENDING : BRANCH_KIND_PATH;
  if (p.endingTitle != null) b.endingTitle = String(p.endingTitle);
  if (p.publishReady != null) b.publishReady = !!p.publishReady;
  n.updatedAt = Date.now();
  return n;
}

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
  if (b.kind === BRANCH_KIND_ENDING) parts.push('结局');
  if (b.direction) parts.push('方向：' + b.direction);
  return parts.join(' · ');
}

/** 根分支（主线） */
export function getRootBranch(novel) {
  var n = ensureBranches(novel);
  return n.branches.find(function(b) { return !b.parentBranchId; }) || n.branches[0];
}
