/**
 * 小说版本列表：唯一草稿 + versions[] 快照
 * displayVersion = characterVersion-novelVersion
 * 规则同卡侧：保存不写 versions；切版/增版/发布才写；发布后草稿 novelVersion 自动 +1
 */
import {
  normalizeCharacterVersion,
  normalizeNovelVersion,
  buildDisplayVersion,
  bumpNovelVersion,
  buildReleasePayload,
  RELEASE_SCHEMA_V2,
} from './version.mjs';
import { ensureBranches } from './branch.mjs';

export function parseDisplayVersion(display) {
  var s = String(display || '').trim();
  var m = s.match(/^(.+)-(\d+)$/);
  if (m) {
    return {
      characterVersion: normalizeCharacterVersion(m[1]),
      novelVersion: normalizeNovelVersion(m[2]),
      displayVersion: buildDisplayVersion(m[1], m[2]),
    };
  }
  return {
    characterVersion: normalizeCharacterVersion(s || '1.0'),
    novelVersion: '1',
    displayVersion: buildDisplayVersion(s || '1.0', '1'),
  };
}

export function compareDisplayVersion(a, b) {
  var pa = parseDisplayVersion(a);
  var pb = parseDisplayVersion(b);
  var ca = pa.characterVersion.match(/^(\d+)(?:\.(\d+))?/) || [0, 1, 0];
  var cb = pb.characterVersion.match(/^(\d+)(?:\.(\d+))?/) || [0, 1, 0];
  var majA = parseInt(ca[1], 10) || 0;
  var majB = parseInt(cb[1], 10) || 0;
  if (majA !== majB) return majA - majB;
  var minA = parseInt(ca[2], 10) || 0;
  var minB = parseInt(cb[2], 10) || 0;
  if (minA !== minB) return minA - minB;
  return (parseInt(pa.novelVersion, 10) || 0) - (parseInt(pb.novelVersion, 10) || 0);
}

export function ensureNovelVersions(novel) {
  var n = ensureBranches(novel && typeof novel === 'object' ? novel : {});
  if (!Array.isArray(n.versions)) n.versions = [];
  n.novelVersion = normalizeNovelVersion(n.novelVersion);
  return n;
}

export function getNovelDisplayVersion(novel, characterVersion) {
  return buildDisplayVersion(characterVersion, novel && novel.novelVersion);
}

export function getMaxPublishedDisplayVersion(versions) {
  var max = null;
  (Array.isArray(versions) ? versions : []).forEach(function(v) {
    if (!v || !v.published) return;
    var d = String(v.ver || v.displayVersion || '');
    if (!d) return;
    if (max == null || compareDisplayVersion(d, max) > 0) max = d;
  });
  return max;
}

export function buildNovelVersionSnapshot(novel, characterVersion) {
  var payload = buildReleasePayload(novel, characterVersion, {
    novelVersion: novel.novelVersion,
    filterReady: false,
  });
  return {
    ver: payload.displayVersion,
    displayVersion: payload.displayVersion,
    characterVersion: payload.characterVersion,
    novelVersion: payload.novelVersion,
    title: payload.title,
    release: payload,
    // 完整工作稿子集，切回可继续编辑
    working: {
      title: novel.title,
      novelVersion: novel.novelVersion,
      direction: novel.direction,
      wizard: novel.wizard ? Object.assign({}, novel.wizard) : null,
      graph: novel.graph,
      outline: Array.isArray(novel.outline) ? novel.outline.map(function(o) { return Object.assign({}, o); }) : [],
      chapters: Array.isArray(novel.chapters) ? novel.chapters.map(function(c) { return Object.assign({}, c); }) : [],
      branches: Array.isArray(novel.branches) ? novel.branches.map(function(b) { return Object.assign({}, b); }) : [],
      activeBranchId: novel.activeBranchId,
      ledger: Array.isArray(novel.ledger) ? novel.ledger.map(function(x) { return Object.assign({}, x); }) : [],
      writeSettings: novel.writeSettings ? Object.assign({}, novel.writeSettings) : null,
    },
  };
}

function upsertNovelVersion(novel, snap, published) {
  ensureNovelVersions(novel);
  var ver = String(snap.ver || snap.displayVersion);
  var now = new Date().toISOString();
  var idx = -1;
  for (var i = 0; i < novel.versions.length; i++) {
    if (String(novel.versions[i].ver) === ver) {
      idx = i;
      break;
    }
  }
  var prev = idx >= 0 ? novel.versions[idx] : null;
  var entry = {
    ver: ver,
    displayVersion: ver,
    title: snap.title,
    published: published != null ? !!published : !!(prev && prev.published),
    publishedAt: null,
    updatedAt: now,
    snapshot: snap,
  };
  if (entry.published) {
    entry.publishedAt = published ? Date.now() : ((prev && prev.publishedAt) || Date.now());
  }
  if (idx >= 0) novel.versions[idx] = entry;
  else novel.versions.push(entry);
  novel.versions.sort(function(a, b) {
    return compareDisplayVersion(a.ver, b.ver);
  });
  return entry;
}

export function commitNovelDraftToVersions(novel, characterVersion, opts) {
  opts = opts || {};
  ensureNovelVersions(novel);
  var snap = buildNovelVersionSnapshot(novel, characterVersion);
  return upsertNovelVersion(novel, snap, opts.published === true ? true : (opts.published === false ? false : null));
}

export function bumpNovelDraftVersion(novel, characterVersion) {
  ensureNovelVersions(novel);
  commitNovelDraftToVersions(novel, characterVersion, {});
  var maxPub = getMaxPublishedDisplayVersion(novel.versions);
  var nextNovelVer = bumpNovelVersion(novel.novelVersion);
  var nextDisplay = buildDisplayVersion(characterVersion, nextNovelVer);
  if (maxPub != null && compareDisplayVersion(nextDisplay, maxPub) <= 0) {
    var parsed = parseDisplayVersion(maxPub);
    nextNovelVer = bumpNovelVersion(parsed.novelVersion);
    nextDisplay = buildDisplayVersion(characterVersion, nextNovelVer);
    var guard = 0;
    while (compareDisplayVersion(nextDisplay, maxPub) <= 0 && guard++ < 50) {
      nextNovelVer = bumpNovelVersion(nextNovelVer);
      nextDisplay = buildDisplayVersion(characterVersion, nextNovelVer);
    }
  }
  novel.novelVersion = nextNovelVer;
  novel.updatedAt = new Date().toISOString();
  return { ok: true, ver: nextDisplay, novelVersion: nextNovelVer };
}

export function applyNovelVersionSnapshot(novel, snap) {
  if (!novel || !snap) return novel;
  var w = snap.working || {};
  if (w.title != null) novel.title = w.title;
  if (w.novelVersion != null) novel.novelVersion = w.novelVersion;
  else if (snap.novelVersion != null) novel.novelVersion = snap.novelVersion;
  if (w.direction !== undefined) novel.direction = w.direction;
  if (w.wizard !== undefined) novel.wizard = w.wizard;
  if (w.graph !== undefined) novel.graph = w.graph;
  if (w.outline) novel.outline = w.outline;
  if (w.chapters) novel.chapters = w.chapters;
  if (w.branches) novel.branches = w.branches;
  if (w.activeBranchId) novel.activeBranchId = w.activeBranchId;
  if (w.ledger) novel.ledger = w.ledger;
  if (w.writeSettings) novel.writeSettings = w.writeSettings;
  // 若 working 缺失，从 release 回填可见内容
  if ((!w.chapters || !w.chapters.length) && snap.release) {
    var r = snap.release;
    if (Array.isArray(r.outline)) novel.outline = r.outline.map(function(o) { return Object.assign({}, o); });
    if (Array.isArray(r.chapters)) novel.chapters = r.chapters.map(function(c) { return Object.assign({}, c); });
    if (Array.isArray(r.branches)) novel.branches = r.branches.map(function(b) { return Object.assign({}, b); });
    if (r.activeBranchId) novel.activeBranchId = r.activeBranchId;
    if (r.novelVersion) novel.novelVersion = r.novelVersion;
    if (r.title) novel.title = r.title;
  }
  return ensureBranches(novel);
}

export function switchNovelDraftVersion(novel, characterVersion, targetVer) {
  ensureNovelVersions(novel);
  var target = String(targetVer || '');
  var entry = novel.versions.find(function(v) {
    return String(v.ver) === target || String(v.displayVersion) === target;
  });
  if (!entry || !entry.snapshot) return { ok: false, error: 'version_not_found' };
  commitNovelDraftToVersions(novel, characterVersion, {});
  applyNovelVersionSnapshot(novel, entry.snapshot);
  novel.updatedAt = new Date().toISOString();
  return { ok: true, ver: target, entry: entry };
}

/**
 * 发布：抬升 novelVersion 直至 display > 最大已发，写入 published，
 * 然后草稿 novelVersion 再 +1
 */
export function publishNovelDraft(novel, characterVersion) {
  ensureNovelVersions(novel);
  var maxPub = getMaxPublishedDisplayVersion(novel.versions);
  var publishNovelVer = normalizeNovelVersion(novel.novelVersion);
  var publishDisplay = buildDisplayVersion(characterVersion, publishNovelVer);
  if (maxPub != null && compareDisplayVersion(publishDisplay, maxPub) <= 0) {
    var parsed = parseDisplayVersion(maxPub);
    publishNovelVer = bumpNovelVersion(parsed.novelVersion);
    publishDisplay = buildDisplayVersion(characterVersion, publishNovelVer);
    var g = 0;
    while (compareDisplayVersion(publishDisplay, maxPub) <= 0 && g++ < 50) {
      publishNovelVer = bumpNovelVersion(publishNovelVer);
      publishDisplay = buildDisplayVersion(characterVersion, publishNovelVer);
    }
  }
  novel.novelVersion = publishNovelVer;
  var entry = commitNovelDraftToVersions(novel, characterVersion, { published: true });
  novel.publishedDisplayVersion = publishDisplay;
  novel.publishedAt = entry.publishedAt;
  // 自动增版
  novel.novelVersion = bumpNovelVersion(publishNovelVer);
  novel.updatedAt = new Date().toISOString();
  return {
    ok: true,
    publishedVer: publishDisplay,
    draftVer: buildDisplayVersion(characterVersion, novel.novelVersion),
    entry: entry,
    release: entry.snapshot.release,
    title: entry.title,
  };
}

export function listNovelVersions(novel) {
  ensureNovelVersions(novel);
  return novel.versions.slice().sort(function(a, b) {
    return compareDisplayVersion(b.ver, a.ver);
  });
}

export { buildDisplayVersion, bumpNovelVersion, RELEASE_SCHEMA_V2 };
