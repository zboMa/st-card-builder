/**
 * 角色卡版本列表：唯一草稿 + versions[] 快照
 * - 保存：只写草稿（调用方 persist）
 * - 切版 / 增版 / 发布：才写入 versions[]
 * - 发布：把当前草稿写入 versions 并 published=true，然后草稿自动小版本 +1
 */
import { buildCardJSONFromDraft } from './state.mjs';
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

/** 从草稿打一份可进 versions 的快照（不含 versions 自身，避免嵌套膨胀） */
export function buildCardVersionSnapshot(draft) {
  var d = draft && typeof draft === 'object' ? draft : {};
  var json = buildCardJSONFromDraft(d);
  var ver = normalizeCharacterVersion(
    (json.data && json.data.character_version) || d.characterVersion
  );
  if (json.data) json.data.character_version = ver;
  return {
    ver: ver,
    title: String((json.data && json.data.name) || json.name || d.charName || '未命名'),
    cardJson: json,
    // 保留关键草稿字段，便于切回后继续编辑（头像等）
    charName: d.charName,
    charDesc: d.charDesc,
    charTags: Array.isArray(d.charTags) ? d.charTags.slice() : [],
    firstMes: d.firstMes,
    alternateGreetings: Array.isArray(d.alternateGreetings) ? d.alternateGreetings.slice() : [],
    worldbookEntries: Array.isArray(d.worldbookEntries) ? d.worldbookEntries.map(function(e) {
      return e && typeof e === 'object' ? Object.assign({}, e) : e;
    }) : [],
    creatorNotes: d.creatorNotes,
    systemPrompt: d.systemPrompt,
    postHistoryInstructions: d.postHistoryInstructions,
    characterVersion: ver,
    avatarInIdb: !!d.avatarInIdb,
    avatarBase64: d.avatarBase64 || '',
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
  var entry = {
    ver: ver,
    title: snap.title,
    published: published != null ? !!published : !!(prev && prev.published),
    publishedAt: null,
    updatedAt: now,
    snapshot: snap,
  };
  if (entry.published) {
    entry.publishedAt = (prev && prev.published && prev.publishedAt) || Date.now();
    if (published) entry.publishedAt = Date.now();
  }
  if (idx >= 0) draft.versions[idx] = entry;
  else draft.versions.push(entry);
  draft.versions.sort(function(a, b) {
    return compareCharacterVersion(a.ver, b.ver);
  });
  return entry;
}

/** 把当前草稿写入 versions[draft.characterVersion]（默认不改 published，除非 opts.published） */
export function commitCardDraftToVersions(draft, opts) {
  opts = opts || {};
  ensureCardVersions(draft);
  var snap = buildCardVersionSnapshot(draft);
  return upsertVersionEntry(draft, snap, opts.published === true ? true : (opts.published === false ? false : null));
}

/**
 * 增版：先把当前草稿写入 versions，再把草稿版号 +1（须 > 最大已发）
 * @param {'major'|'minor'} [which]
 */
export function bumpCardDraftVersion(draft, which) {
  ensureCardVersions(draft);
  commitCardDraftToVersions(draft, {});
  var maxPub = getMaxPublishedCharacterVersion(draft.versions);
  var next = which === 'major'
    ? bumpCharacterVersionMajor(draft.characterVersion)
    : bumpCharacterVersionMinor(draft.characterVersion);
  if (maxPub != null && compareCharacterVersion(next, maxPub) <= 0) {
    next = which === 'major'
      ? bumpCharacterVersionMajor(maxPub)
      : bumpCharacterVersionMinor(maxPub);
    while (compareCharacterVersion(next, maxPub) <= 0) {
      next = bumpCharacterVersionMinor(next);
    }
  }
  // 若 next 已存在于列表，继续小步前进
  var guard = 0;
  while (guard++ < 50) {
    var exists = draft.versions.some(function(v) {
      return normalizeCharacterVersion(v.ver) === next;
    });
    if (!exists) break;
    next = bumpCharacterVersionMinor(next);
    if (maxPub != null && compareCharacterVersion(next, maxPub) <= 0) {
      next = bumpCharacterVersionMinor(maxPub);
    }
  }
  draft.characterVersion = next;
  draft.updatedAt = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  return { ok: true, ver: next };
}

/**
 * 切到历史版本：先提交当前草稿到 versions，再加载目标快照到草稿
 */
export function switchCardDraftVersion(draft, targetVer) {
  ensureCardVersions(draft);
  var target = normalizeCharacterVersion(targetVer);
  var entry = draft.versions.find(function(v) {
    return normalizeCharacterVersion(v.ver) === target;
  });
  if (!entry || !entry.snapshot) {
    return { ok: false, error: 'version_not_found' };
  }
  commitCardDraftToVersions(draft, {});
  applyCardVersionSnapshot(draft, entry.snapshot);
  draft.characterVersion = target;
  draft.updatedAt = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  return { ok: true, ver: target, entry: entry };
}

export function applyCardVersionSnapshot(draft, snap) {
  if (!draft || !snap) return draft;
  var fields = [
    'charName', 'charDesc', 'charTags', 'firstMes', 'alternateGreetings',
    'worldbookEntries', 'creatorNotes', 'systemPrompt', 'postHistoryInstructions',
    'avatarInIdb', 'avatarBase64', 'characterVersion',
  ];
  fields.forEach(function(k) {
    if (snap[k] !== undefined) draft[k] = snap[k];
  });
  if (snap.cardJson && snap.cardJson.data) {
    // cardJson 为权威补充
    var data = snap.cardJson.data;
    if (data.name != null) draft.charName = data.name;
    if (data.description != null) draft.charDesc = data.description;
    if (data.first_mes != null) draft.firstMes = data.first_mes;
    if (data.character_version != null) draft.characterVersion = normalizeCharacterVersion(data.character_version);
  }
  return draft;
}

/**
 * 发布：确保版号 > 最大已发（否则抬升），写入 versions 并 published，
 * 然后草稿自动小版本 +1（仅草稿，不写 versions）
 * @returns {{ ok: true, publishedVer: string, draftVer: string, entry: object, cardJson: object, title: string }}
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
  draft.characterVersion = publishVer;
  var entry = commitCardDraftToVersions(draft, { published: true });
  var publishedVer = publishVer;
  // 自动增版：草稿跳到下一小版本，等待下次切版/增版/发布再进列表
  var draftVer = bumpCharacterVersionMinor(publishedVer);
  draft.characterVersion = draftVer;
  draft.updatedAt = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  return {
    ok: true,
    publishedVer: publishedVer,
    draftVer: draftVer,
    entry: entry,
    cardJson: entry.snapshot.cardJson,
    title: entry.title,
  };
}

export function listCardVersions(draft) {
  ensureCardVersions(draft);
  return draft.versions.slice().sort(function(a, b) {
    return compareCharacterVersion(b.ver, a.ver);
  });
}

export {
  normalizeCharacterVersion,
  bumpCharacterVersionMajor,
  bumpCharacterVersionMinor,
};
