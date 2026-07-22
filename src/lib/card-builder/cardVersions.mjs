/**
 * 角色卡版本列表：唯一草稿 + versions[] 快照
 * - 保存：只写草稿（调用方 persist）
 * - 切版 / 增版 / 发布：才写入 versions[]
 * - 发布：把当前草稿写入 versions 并 published=true，然后草稿自动小版本 +1
 * - 已发布条目不可变；草稿若坐在已发号上，commit 前自动 fork 到空号
 */
import { buildCardJSONFromDraft, buildDraftSnapshot } from './state.mjs';
import {
  normalizeCharacterVersion,
  parseCharacterVersion,
  bumpCharacterVersionMajor,
  bumpCharacterVersionMinor,
} from './cardRelease.mjs';

export function compareCharacterVersion(a, b) {
  var pa = parseCharacterVersion(a);
  var pb = parseCharacterVersion(b);
  if (pa.major !== pb.major) return pa.major - pb.major;
  return pa.minor - pb.minor;
}

export function ensureCardVersions(draft) {
  var d = draft && typeof draft === 'object' ? draft : {};
  if (!Array.isArray(d.versions)) d.versions = [];
  d.characterVersion = normalizeCharacterVersion(d.characterVersion);
  return d;
}

export function getMaxPublishedCharacterVersion(versions) {
  var max = null;
  (Array.isArray(versions) ? versions : []).forEach(function(v) {
    if (!v || !v.published) return;
    var ver = normalizeCharacterVersion(v.ver);
    if (max == null || compareCharacterVersion(ver, max) > 0) max = ver;
  });
  return max;
}

export function getMaxCharacterVersion(versions, draftVer) {
  var max = draftVer ? normalizeCharacterVersion(draftVer) : null;
  (Array.isArray(versions) ? versions : []).forEach(function(v) {
    if (!v || v.ver == null) return;
    var ver = normalizeCharacterVersion(v.ver);
    if (max == null || compareCharacterVersion(ver, max) > 0) max = ver;
  });
  return max;
}

function findVersionEntry(draft, ver) {
  var target = normalizeCharacterVersion(ver);
  for (var i = 0; i < (draft.versions || []).length; i++) {
    if (normalizeCharacterVersion(draft.versions[i].ver) === target) return draft.versions[i];
  }
  return null;
}

function versionExists(draft, ver) {
  return !!findVersionEntry(draft, ver);
}

/** 找一个不与列表冲突、且 > maxPub 的空版号 */
export function nextFreeCharacterVersion(draft, fromVer, which) {
  ensureCardVersions(draft);
  var maxPub = getMaxPublishedCharacterVersion(draft.versions);
  var next = which === 'major'
    ? bumpCharacterVersionMajor(fromVer)
    : bumpCharacterVersionMinor(fromVer);
  if (maxPub != null && compareCharacterVersion(next, maxPub) <= 0) {
    next = which === 'major'
      ? bumpCharacterVersionMajor(maxPub)
      : bumpCharacterVersionMinor(maxPub);
    while (compareCharacterVersion(next, maxPub) <= 0) {
      next = bumpCharacterVersionMinor(next);
    }
  }
  var guard = 0;
  while (guard++ < 80) {
    if (!versionExists(draft, next)) break;
    next = bumpCharacterVersionMinor(next);
    if (maxPub != null && compareCharacterVersion(next, maxPub) <= 0) {
      next = bumpCharacterVersionMinor(maxPub);
    }
  }
  return next;
}

/**
 * 从草稿打一份可进 versions 的快照（不含 versions 自身，避免嵌套膨胀）
 * 字段与 buildDraftSnapshot 对齐（altGreetings / NSFW / 正则等）
 */
export function buildCardVersionSnapshot(draft) {
  var d = draft && typeof draft === 'object' ? draft : {};
  var base = buildDraftSnapshot(d);
  delete base.versions;
  var json = buildCardJSONFromDraft(d);
  var ver = normalizeCharacterVersion(
    (json.data && json.data.character_version) || d.characterVersion || base.characterVersion
  );
  if (json.data) json.data.character_version = ver;
  base.characterVersion = ver;
  base.updatedAt = d.updatedAt || base.updatedAt || '';
  return {
    ver: ver,
    title: String((json.data && json.data.name) || json.name || d.charName || '未命名'),
    cardJson: json,
    draft: base,
  };
}

function upsertVersionEntry(draft, snap, published) {
  ensureCardVersions(draft);
  var ver = normalizeCharacterVersion(snap.ver);
  var now = new Date().toISOString();
  var idx = -1;
  for (var i = 0; i < draft.versions.length; i++) {
    if (normalizeCharacterVersion(draft.versions[i].ver) === ver) {
      idx = i;
      break;
    }
  }
  var prev = idx >= 0 ? draft.versions[idx] : null;

  // 已发布条目不可变
  if (prev && prev.published) {
    return { entry: prev, wrote: false };
  }

  var entry = {
    ver: ver,
    title: snap.title,
    published: published === true ? true : (published === false ? false : !!(prev && prev.published)),
    publishedAt: null,
    updatedAt: now,
    snapshot: snap,
  };
  if (entry.published) {
    entry.publishedAt = Date.now();
  }
  if (idx >= 0) draft.versions[idx] = entry;
  else draft.versions.push(entry);
  draft.versions.sort(function(a, b) {
    return compareCharacterVersion(a.ver, b.ver);
  });
  return { entry: entry, wrote: true };
}

/**
 * 若当前草稿版号已占用且为已发，先 fork 到空号再写入（避免污染已发历史）
 */
function ensureWritableDraftVersion(draft, opts) {
  opts = opts || {};
  ensureCardVersions(draft);
  var cur = normalizeCharacterVersion(draft.characterVersion);
  var existing = findVersionEntry(draft, cur);
  if (existing && existing.published && opts.published !== true) {
    draft.characterVersion = nextFreeCharacterVersion(draft, cur, 'minor');
  }
}

/** 把当前草稿写入 versions[draft.characterVersion] */
export function commitCardDraftToVersions(draft, opts) {
  opts = opts || {};
  ensureCardVersions(draft);
  if (opts.published !== true) {
    ensureWritableDraftVersion(draft, opts);
  }
  var snap = buildCardVersionSnapshot(draft);
  snap.ver = normalizeCharacterVersion(draft.characterVersion);
  if (snap.draft) snap.draft.characterVersion = snap.ver;
  if (snap.cardJson && snap.cardJson.data) {
    snap.cardJson.data.character_version = snap.ver;
  }
  var up = upsertVersionEntry(draft, snap, opts.published === true ? true : (opts.published === false ? false : null));
  return up.entry;
}

/**
 * 增版：先把当前草稿写入 versions，再把草稿版号 +1（须 > 最大已发）
 * @param {'major'|'minor'} [which]
 */
export function bumpCardDraftVersion(draft, which) {
  ensureCardVersions(draft);
  commitCardDraftToVersions(draft, {});
  var next = nextFreeCharacterVersion(draft, draft.characterVersion, which === 'major' ? 'major' : 'minor');
  draft.characterVersion = next;
  draft.updatedAt = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  return { ok: true, ver: next };
}

export function applyCardVersionSnapshot(draft, snap) {
  if (!draft || !snap) return draft;
  var src = snap.draft && typeof snap.draft === 'object' ? snap.draft : snap;
  var fields = [
    'charName', 'wbName', 'charDesc', 'charTags', 'firstMes', 'altGreetings',
    'worldbookEntries', 'regexScripts', 'tavernHelperScripts', 'cardBuilderExtensions',
    'creatorNotes', 'avatarInIdb', 'avatarBase64', 'characterVersion',
    'nsfwEnabled', 'nsfwFlavor', 'nsfwFlavorItems',
    'eroticPostureItems', 'eroticSpeechItems',
    'ntlEnabled', 'ntlTabooTypes', 'ntlTabooItems',
    'worldviewPresetItems', 'adultWorldframe', 'adultWorldframeForced',
    'corruptionEnabled', 'corruptionPreset', 'corruptionCustomBrief',
    'corruptionExtraNotes', 'corruptionStageNames', 'corruptionSelectedNames',
    'corruptionDefaultFemaleOnly', 'corruptionSyncStatusBar',
  ];
  fields.forEach(function(k) {
    if (src[k] !== undefined) draft[k] = src[k];
  });

  // 兼容旧错误字段名
  if (src.altGreetings == null && Array.isArray(src.alternateGreetings)) {
    draft.altGreetings = src.alternateGreetings.slice();
  }

  if (snap.cardJson && snap.cardJson.data) {
    var data = snap.cardJson.data;
    if (data.name != null) draft.charName = data.name;
    if (data.description != null) draft.charDesc = data.description;
    if (data.first_mes != null) draft.firstMes = data.first_mes;
    if (data.creator_notes != null) draft.creatorNotes = data.creator_notes;
    if (Array.isArray(data.alternate_greetings)) draft.altGreetings = data.alternate_greetings.slice();
    if (Array.isArray(data.tags)) draft.charTags = data.tags.slice();
    if (data.character_version != null) {
      draft.characterVersion = normalizeCharacterVersion(data.character_version);
    }
    if (data.character_book && data.character_book.name) {
      draft.wbName = data.character_book.name;
    }
  }
  return draft;
}

/**
 * 切到历史版本：先提交当前草稿到 versions，再加载目标快照到草稿
 */
export function switchCardDraftVersion(draft, targetVer) {
  ensureCardVersions(draft);
  var target = normalizeCharacterVersion(targetVer);
  var entry = findVersionEntry(draft, target);
  if (!entry || !entry.snapshot) {
    return { ok: false, error: 'version_not_found' };
  }
  commitCardDraftToVersions(draft, {});
  applyCardVersionSnapshot(draft, entry.snapshot);
  draft.characterVersion = target;
  draft.updatedAt = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  return { ok: true, ver: target, entry: entry };
}

/**
 * 发布：确保版号 > 最大已发（否则抬升），写入 versions 并 published，
 * 然后草稿自动小版本 +1（仅草稿，不写 versions）
 */
export function publishCardDraft(draft) {
  ensureCardVersions(draft);
  var maxPub = getMaxPublishedCharacterVersion(draft.versions);
  var cur = normalizeCharacterVersion(draft.characterVersion);
  var publishVer = cur;
  if (maxPub != null && compareCharacterVersion(publishVer, maxPub) <= 0) {
    publishVer = bumpCharacterVersionMinor(maxPub);
    while (compareCharacterVersion(publishVer, maxPub) <= 0) {
      publishVer = bumpCharacterVersionMinor(publishVer);
    }
  }
  // 若同号未发条目存在可覆盖；若已发则继续抬号
  var guard = 0;
  while (guard++ < 50) {
    var slot = findVersionEntry(draft, publishVer);
    if (!slot || !slot.published) break;
    publishVer = bumpCharacterVersionMinor(publishVer);
  }
  draft.characterVersion = publishVer;
  var entry = null;
  var guardPub = 0;
  while (guardPub++ < 50) {
    var up = (function() {
      var snap = buildCardVersionSnapshot(draft);
      snap.ver = normalizeCharacterVersion(draft.characterVersion);
      if (snap.draft) snap.draft.characterVersion = snap.ver;
      if (snap.cardJson && snap.cardJson.data) snap.cardJson.data.character_version = snap.ver;
      return upsertVersionEntry(draft, snap, true);
    })();
    if (up.wrote) {
      entry = up.entry;
      publishVer = entry.ver;
      break;
    }
    publishVer = bumpCharacterVersionMinor(publishVer);
    draft.characterVersion = publishVer;
  }
  if (!entry) {
    return { ok: false, error: 'publish_failed' };
  }
  var publishedVer = publishVer;
  var draftVer = nextFreeCharacterVersion(draft, publishedVer, 'minor');
  draft.characterVersion = draftVer;
  draft.updatedAt = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  return {
    ok: true,
    publishedVer: publishedVer,
    draftVer: draftVer,
    entry: entry,
    cardJson: entry.snapshot && entry.snapshot.cardJson,
    title: entry.title,
  };
}

export function listCardVersions(draft) {
  ensureCardVersions(draft);
  return draft.versions.slice().sort(function(a, b) {
    return compareCharacterVersion(b.ver, a.ver);
  });
}
