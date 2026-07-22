/**
 * 小说版号：displayVersion = {character_version}-{novelVersion}
 * 仅用户主动增版；不用时间/同步时间当版本。
 * schemaVersion 2：带 branches 的树状发布快照
 */

import { ensureBranches, filterNovelForPublish, normalizeBranch } from './branch.mjs';

export var RELEASE_SCHEMA_V2 = 2;

export function normalizeCharacterVersion(raw) {
  var s = String(raw == null ? '' : raw).trim();
  return s || '1.0';
}

export function normalizeNovelVersion(raw) {
  var s = String(raw == null ? '' : raw).trim();
  if (!s) return '1';
  return s;
}

/** 完整展示版号：卡版本-小说版本，如 1.2-3 */
export function buildDisplayVersion(characterVersion, novelVersion) {
  return normalizeCharacterVersion(characterVersion) + '-' + normalizeNovelVersion(novelVersion);
}

/**
 * 主动增版：整数后缀 +1；非纯数字则规范为 1 再 +1（得到 2）
 * @returns {string}
 */
export function bumpNovelVersion(current) {
  var s = normalizeNovelVersion(current);
  if (/^\d+$/.test(s)) {
    return String(parseInt(s, 10) + 1);
  }
  var n = parseInt(s, 10);
  if (Number.isFinite(n) && n > 0) return String(n + 1);
  return '2';
}

function mapOutline(list) {
  return (Array.isArray(list) ? list : []).map(function(o, i) {
    return {
      id: String(o && o.id || ''),
      title: String(o && o.title != null ? o.title : ''),
      summary: String(o && o.summary != null ? o.summary : ''),
      order: typeof (o && o.order) === 'number' ? o.order : i,
      branchId: String(o && o.branchId || ''),
    };
  });
}

function mapChapters(list) {
  return (Array.isArray(list) ? list : []).map(function(c, i) {
    return {
      id: String(c && c.id || ''),
      title: String(c && c.title != null ? c.title : ''),
      summary: String(c && c.summary != null ? c.summary : ''),
      content: String(c && c.content != null ? c.content : ''),
      order: typeof (c && c.order) === 'number' ? c.order : i,
      branchId: String(c && c.branchId || ''),
    };
  });
}

function mapBranches(list) {
  return (Array.isArray(list) ? list : []).map(function(b) {
    var nb = normalizeBranch(b);
    return {
      id: nb.id,
      name: nb.name,
      parentBranchId: nb.parentBranchId,
      forkChapterId: nb.forkChapterId,
      forkOrder: nb.forkOrder,
      direction: nb.direction,
      choiceLabel: nb.choiceLabel,
      choiceTeaser: nb.choiceTeaser,
      kind: nb.kind,
      endingTitle: nb.endingTitle,
      publishReady: true,
    };
  });
}

/**
 * 从工作稿打一份可分享的 release 快照（不含书签/写作设置等）
 * @param {object} novel
 * @param {string} characterVersion
 * @param {{ novelVersion?: string, publishedAt?: number, filterReady?: boolean }} [opts]
 */
export function buildReleasePayload(novel, characterVersion, opts) {
  opts = opts || {};
  var filterReady = opts.filterReady !== false;
  var source = filterReady ? filterNovelForPublish(novel) : ensureBranches(novel);
  var n = source && typeof source === 'object' ? source : {};
  var charVer = normalizeCharacterVersion(characterVersion);
  var novelVer = normalizeNovelVersion(
    opts.novelVersion != null ? opts.novelVersion : n.novelVersion
  );
  var displayVersion = buildDisplayVersion(charVer, novelVer);
  var publishedAt = typeof opts.publishedAt === 'number' ? opts.publishedAt : Date.now();

  var branches = mapBranches(n.branches);
  var rootId = (branches.find(function(b) { return !b.parentBranchId; }) || branches[0] || {}).id || '';

  return {
    type: 'story-release',
    schemaVersion: RELEASE_SCHEMA_V2,
    cardId: String(n.cardId || ''),
    novelId: String(n.id || ''),
    title: String(n.title != null ? n.title : '未命名小说'),
    characterVersion: charVer,
    novelVersion: novelVer,
    displayVersion: displayVersion,
    publishedAt: publishedAt,
    branches: branches,
    activeBranchId: String(n.activeBranchId || rootId),
    publishedBranchIds: Array.isArray(n.publishedBranchIds)
      ? n.publishedBranchIds.map(String)
      : branches.map(function(b) { return b.id; }),
    outline: mapOutline(n.outline),
    chapters: mapChapters(n.chapters),
  };
}

/** 公开 API 返回体（再剥一层） */
export function sanitizeReleaseForPublic(release) {
  var r = release && typeof release === 'object' ? release : {};
  var data = r.data && typeof r.data === 'object' ? r.data : r;
  var branches = Array.isArray(data.branches) ? mapBranches(data.branches) : [];
  var chapters = mapChapters(data.chapters);
  // 旧稿无 branchId：不伪造 branches，让读者走线性模式
  var schemaVersion = Number(data.schemaVersion || r.schemaVersion || (branches.length ? RELEASE_SCHEMA_V2 : 1)) || 1;
  return {
    title: String(data.title || r.title || '未命名小说'),
    displayVersion: String(r.displayVersion || data.displayVersion || ''),
    characterVersion: String(r.characterVersion || data.characterVersion || ''),
    novelVersion: String(r.novelVersion || data.novelVersion || ''),
    publishedAt: typeof r.publishedAt === 'number'
      ? r.publishedAt
      : (typeof data.publishedAt === 'number' ? data.publishedAt : null),
    schemaVersion: schemaVersion,
    branches: branches,
    activeBranchId: String(data.activeBranchId || ''),
    publishedBranchIds: Array.isArray(data.publishedBranchIds)
      ? data.publishedBranchIds.map(String)
      : branches.map(function(b) { return b.id; }),
    outline: mapOutline(data.outline),
    chapters: chapters,
  };
}
