/**
 * 角色卡版本列表：工作稿 + cardVersionsV1 分库
 * 切版 / 增版 / 发布 → commit；autosave 不写 versions
 */
import { buildCardJSONFromDraft } from './state.mjs';
import {
  normalizeCharacterVersion,
  parseCharacterVersion,
  bumpCharacterVersionMajor,
  bumpCharacterVersionMinor,
} from './cardRelease.mjs';
import { avatarRefForDraft } from './cardAvatarGallery.mjs';
import {
  loadCardVersionsStore,
  saveCardVersionsStore,
  computeVersionsManifestRev,
} from './cardVersionsStore.mjs';
import { buildVersionSnapshotEntry, computeVersionSnapshotRev } from './versionSnapshot.mjs';

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

export async function hydrateDraftVersions(cardId, draft) {
  ensureCardVersions(draft);
  var store = await loadCardVersionsStore(cardId);
  draft.versions = store.entries.slice();
  return draft.versions;
}

export async function persistDraftVersions(cardId, draft) {
  ensureCardVersions(draft);
  await saveCardVersionsStore(cardId, { entries: draft.versions });
  return computeVersionsManifestRev(draft.versions);
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

export function buildCardVersionSnapshot(draft) {
  var d = draft && typeof draft === 'object' ? draft : {};
  var json = buildCardJSONFromDraft(d);
  var ver = normalizeCharacterVersion(
    (json.data && json.data.character_version) || d.characterVersion || '1.0'
  );
  if (json.data) json.data.character_version = ver;
  return {
    ver: ver,
    title: String((json.data && json.data.name) || json.name || d.charName || '未命名'),
    cardJson: json,
    avatarRef: avatarRefForDraft(d.activeAvatarId),
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
  if (prev && prev.published) {
    return { entry: prev, wrote: false };
  }
  var entry = buildVersionSnapshotEntry(snap, {
    published: published === true ? true : (published === false ? false : !!(prev && prev.published)),
    publishedAt: published === true ? Date.now() : (prev && prev.publishedAt),
    updatedAt: now,
  });
  if (entry.published && !entry.publishedAt) entry.publishedAt = Date.now();
  if (idx >= 0) draft.versions[idx] = entry;
  else draft.versions.push(entry);
  draft.versions.sort(function(a, b) {
    return compareCharacterVersion(a.ver, b.ver);
  });
  return { entry: entry, wrote: true };
}

function ensureWritableDraftVersion(draft, opts) {
  opts = opts || {};
  ensureCardVersions(draft);
  var cur = normalizeCharacterVersion(draft.characterVersion);
  var existing = findVersionEntry(draft, cur);
  if (existing && existing.published && opts.published !== true) {
    draft.characterVersion = nextFreeCharacterVersion(draft, cur, 'minor');
  }
}

export function commitCardDraftToVersions(draft, opts) {
  opts = opts || {};
  ensureCardVersions(draft);
  if (opts.published !== true) {
    ensureWritableDraftVersion(draft, opts);
  }
  var snap = buildCardVersionSnapshot(draft);
  snap.ver = normalizeCharacterVersion(draft.characterVersion);
  if (snap.cardJson && snap.cardJson.data) {
    snap.cardJson.data.character_version = snap.ver;
  }
  var up = upsertVersionEntry(draft, snap, opts.published === true ? true : (opts.published === false ? false : null));
  return up.entry;
}

export function bumpCardDraftVersion(draft, which) {
  ensureCardVersions(draft);
  commitCardDraftToVersions(draft, {});
  var next = nextFreeCharacterVersion(draft, draft.characterVersion, which === 'major' ? 'major' : 'minor');
  draft.characterVersion = next;
  draft.updatedAt = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  return { ok: true, ver: next };
}

export function applyCardVersionEntry(draft, entry) {
  if (!draft || !entry) return draft;
  var data = entry.cardJson && entry.cardJson.data ? entry.cardJson.data : null;
  if (data) {
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
    draft.worldbookEntries = rebuildWbFromCardJson(entry.cardJson);
    if (data.extensions && typeof data.extensions === 'object') {
      var ext = data.extensions;
      draft.cardBuilderExtensions = Object.assign({}, ext);
      if (Array.isArray(ext.regex_scripts)) draft.regexScripts = ext.regex_scripts.slice();
      else draft.regexScripts = [];
      if (ext.tavern_helper && Array.isArray(ext.tavern_helper.scripts)) {
        draft.tavernHelperScripts = ext.tavern_helper.scripts.slice();
      } else {
        draft.tavernHelperScripts = [];
      }
    }
  }
  if (entry.avatarRef && entry.avatarRef.avatarId) {
    draft.activeAvatarId = String(entry.avatarRef.avatarId);
  }
  return draft;
}

function rebuildWbFromCardJson(cardJson) {
  var fe = cardJson.data && cardJson.data.character_book && cardJson.data.character_book.entries;
  if (!Array.isArray(fe)) return [];
  return fe.map(function(e, i) {
    return {
      comment: e.comment,
      content: e.content,
      keys: e.keys || [],
      strategy: e.constant ? 'constant' : (e.selective ? 'selective' : 'selective'),
      enabled: e.enabled !== false,
      order: e.insertion_order || 100,
      position: e.extensions && e.extensions.position != null ? e.extensions.position : 0,
      depth: e.extensions && e.extensions.depth != null ? e.extensions.depth : 4,
      role: e.extensions && e.extensions.role != null ? e.extensions.role : 0,
      prob: e.extensions && e.extensions.probability != null ? e.extensions.probability : 100,
    };
  });
}

export function switchCardDraftVersion(draft, targetVer) {
  ensureCardVersions(draft);
  var target = normalizeCharacterVersion(targetVer);
  var entry = findVersionEntry(draft, target);
  if (!entry || !entry.cardJson) {
    return { ok: false, error: 'version_not_found' };
  }
  commitCardDraftToVersions(draft, {});
  applyCardVersionEntry(draft, entry);
  draft.characterVersion = target;
  draft.updatedAt = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  return { ok: true, ver: target, entry: entry };
}

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
    var snap = buildCardVersionSnapshot(draft);
    snap.ver = normalizeCharacterVersion(draft.characterVersion);
    if (snap.cardJson && snap.cardJson.data) snap.cardJson.data.character_version = snap.ver;
    var up = upsertVersionEntry(draft, snap, true);
    if (up.wrote) {
      entry = up.entry;
      publishVer = entry.ver;
      break;
    }
    publishVer = bumpCharacterVersionMinor(publishVer);
    draft.characterVersion = publishVer;
  }
  if (!entry) return { ok: false, error: 'publish_failed' };
  var publishedVer = publishVer;
  var draftVer = nextFreeCharacterVersion(draft, publishedVer, 'minor');
  draft.characterVersion = draftVer;
  draft.updatedAt = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  return {
    ok: true,
    publishedVer: publishedVer,
    draftVer: draftVer,
    entry: entry,
    cardJson: entry.cardJson,
    title: entry.title,
  };
}

export function listCardVersions(draft) {
  ensureCardVersions(draft);
  return draft.versions.slice().sort(function(a, b) {
    return compareCharacterVersion(b.ver, a.ver);
  });
}

/** 已发布版本引用的 avatarId（删除卡面门禁） */
export function publishedAvatarIds(draft) {
  var ids = [];
  (draft.versions || []).forEach(function(v) {
    if (!v || !v.published || !v.avatarRef || !v.avatarRef.avatarId) return;
    ids.push(String(v.avatarRef.avatarId));
  });
  return ids;
}

export { computeVersionSnapshotRev };
