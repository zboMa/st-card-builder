/**
 * 世界书 Entry V2：草稿 normalize / upsert / ST·AI·runtime 边界
 * 业务层禁止持久化 comment；对外 JSON 键名仍为 comment 时仅经本模块转换。
 */

import { resolveEntryPosition } from './entryPosition.mjs';
import {
  WB_OWNER,
  kindToFamily,
  entryFamily,
  outlineTypeFromKind,
  outlineKindFromType,
  normalizeOutlineType,
  OUTLINE_TYPE_LABELS,
  getRegistryEntryById,
  getRegistryFixedSlot,
  matchRegistryImportByComment,
  matchDynamicImportByComment,
  isSystemEntry,
  isLegacyWorldbookDraft,
  stCommentForNovelKind,
  novelKindFromEntityCategory,
  novelOwnerSlotForKind,
  REGISTRY_FIXED_SLOTS,
  CORRUPTION_ARCHIVE_PREFIX,
  AFFECTION_ARCHIVE_PREFIX,
  CORRUPTION_RULES_COMMENT,
  CORRUPTION_GENERAL_ARCHIVE_COMMENT,
  AFFECTION_RULES_COMMENT,
  AFFECTION_GENERAL_ARCHIVE_COMMENT,
} from './worldbookRegistry.mjs';

export {
  kindToFamily,
  entryFamily,
  outlineTypeFromKind,
  normalizeOutlineType,
  OUTLINE_TYPE_LABELS,
  isSystemEntry,
  isLegacyWorldbookDraft,
  novelKindFromEntityCategory,
  novelOwnerSlotForKind,
  outlineKindFromType,
  matchDynamicImportByComment,
  CORRUPTION_RULES_COMMENT,
  CORRUPTION_ARCHIVE_PREFIX,
  CORRUPTION_GENERAL_ARCHIVE_COMMENT,
  AFFECTION_RULES_COMMENT,
  AFFECTION_ARCHIVE_PREFIX,
  AFFECTION_GENERAL_ARCHIVE_COMMENT,
  getRegistryFixedSlot,
  WB_OWNER,
};

export function newWorldbookEntryId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'wb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
}

function clampInt(value, fallback, min, max) {
  var v = parseInt(value, 10);
  if (isNaN(v)) return fallback;
  if (min !== undefined && v < min) return min;
  if (max !== undefined && v > max) return max;
  return v;
}

function normalizeStParams(entry, base) {
  base = base || {};
  return {
    content: String(entry.content != null ? entry.content : base.content || ''),
    keys: Array.isArray(entry.keys)
      ? entry.keys.filter(function(k) { return String(k || '').trim(); })
      : (base.keys || []),
    strategy: ['constant', 'selective', 'vectorized'].indexOf(entry.strategy) >= 0
      ? entry.strategy
      : (base.strategy || 'selective'),
    position: clampInt(entry.position, base.position != null ? base.position : 4, 0, 6),
    depth: clampInt(entry.depth, base.depth != null ? base.depth : 4, 0, 999),
    role: clampInt(entry.role, base.role != null ? base.role : 0, 0, 2),
    order: clampInt(entry.order, base.order != null ? base.order : 100, 0, 999),
    prob: clampInt(entry.prob, base.prob != null ? base.prob : 100, 1, 100),
    enabled: entry.enabled !== false,
  };
}

export function getDefaultWBEntryV2() {
  var id = newWorldbookEntryId();
  return {
    id: id,
    kind: 'user',
    owner: WB_OWNER.user,
    ownerSlot: id,
    displayName: '',
    content: '',
    keys: [],
    strategy: 'selective',
    position: 4,
    depth: 4,
    role: 0,
    order: 100,
    prob: 100,
    enabled: true,
  };
}

/**
 * @param {object} raw
 * @returns {object}
 */
export function normalizeDraftEntry(raw) {
  raw = raw || {};
  if (String(raw.id || '').trim() && String(raw.kind || '').trim() && String(raw.owner || '').trim()) {
    var fixed = getRegistryFixedSlot(raw.owner, raw.ownerSlot);
    var displayName = String(raw.displayName || '').trim();
    if (!displayName && fixed) displayName = fixed.defaultDisplayName;
    if (!displayName) displayName = String(raw.displayName || '').trim();
    var stParams = normalizeStParams(raw, raw);
    var out = {
      id: String(raw.id).trim(),
      kind: String(raw.kind).trim(),
      owner: String(raw.owner).trim(),
      ownerSlot: String(raw.ownerSlot != null ? raw.ownerSlot : '').trim(),
      displayName: displayName,
    };
    Object.assign(out, stParams);
    if (raw.outlineType != null) out.outlineType = String(raw.outlineType);
    if (raw.outlineLinks != null) out.outlineLinks = Array.isArray(raw.outlineLinks) ? raw.outlineLinks.slice() : [];
    if (raw.outlineBlurb != null) out.outlineBlurb = String(raw.outlineBlurb);
    if (raw.job != null && String(raw.job).trim()) out.job = String(raw.job).trim();
    if (raw.group != null && String(raw.group).trim()) out.group = String(raw.group).trim();
    if (raw.reads != null && String(raw.reads).trim()) out.reads = String(raw.reads).trim();
    if (raw.preventRecursion === true) out.preventRecursion = true;
    if (raw.excludeRecursion === true) out.excludeRecursion = true;
    if (!out.ownerSlot && out.owner === WB_OWNER.user) out.ownerSlot = out.id;
    if (out.id === 'wb-mvu-varlist' || out.ownerSlot === 'mvu_varlist' || out.ownerSlot === 'varlist') {
      out.kind = 'mvu_varlist';
      out.owner = WB_OWNER.mvu;
      out.ownerSlot = 'varlist';
      if (!String(out.displayName || '').trim()) out.displayName = '变量列表';
    }
    return out;
  }
  return fromStImportEntry({
    comment: raw.comment || raw.displayName || '',
    content: raw.content,
    keys: raw.keys,
    strategy: raw.strategy,
    position: raw.position,
    depth: raw.depth,
    role: raw.role,
    order: raw.order,
    prob: raw.prob,
    enabled: raw.enabled,
  });
}

/**
 * 加载草稿：含 legacy 则整表清空
 * @returns {{ entries: object[], legacyCleared: boolean }}
 */
export function normalizeWorldbookEntriesForDraft(entries) {
  var list = Array.isArray(entries) ? entries : [];
  if (!list.length) return { entries: [], legacyCleared: false };
  if (isLegacyWorldbookDraft(list)) {
    return { entries: [], legacyCleared: true };
  }
  return {
    entries: list.map(function(e) { return normalizeDraftEntry(e); }),
    legacyCleared: false,
  };
}

function findEntryIndex(list, key) {
  key = key || {};
  if (key.id) {
    var id = String(key.id).trim();
    for (var i = 0; i < list.length; i++) {
      if (list[i] && String(list[i].id || '') === id) return i;
    }
  }
  if (key.owner && key.ownerSlot != null) {
    var o = String(key.owner);
    var slot = String(key.ownerSlot);
    for (var j = 0; j < list.length; j++) {
      if (list[j] && String(list[j].owner || '') === o && String(list[j].ownerSlot || '') === slot) return j;
    }
  }
  return -1;
}

/**
 * @param {object[]} entries
 * @param {object} patch ST 参数字段 + displayName 等
 * @param {{ id?: string, owner?: string, ownerSlot?: string }} key
 */
export function upsertWorldbookEntry(entries, patch, key) {
  var list = Array.isArray(entries) ? entries.slice() : [];
  patch = patch || {};
  key = key || {};
  var idx = findEntryIndex(list, key);
  var base = idx >= 0 ? list[idx] : null;
  if (!base) {
    var fixed = key.owner && key.ownerSlot != null ? getRegistryFixedSlot(key.owner, key.ownerSlot) : null;
    var kind = patch.kind || (fixed ? fixed.kind : 'user');
    var owner = patch.owner || key.owner || WB_OWNER.user;
    var ownerSlot = patch.ownerSlot != null ? String(patch.ownerSlot) : String(key.ownerSlot || '');
    var id = patch.id || (fixed ? fixed.id : newWorldbookEntryId());
    if (owner === WB_OWNER.user && !ownerSlot) ownerSlot = id;
    base = {
      id: id,
      kind: kind,
      owner: owner,
      ownerSlot: ownerSlot,
      displayName: patch.displayName || (fixed ? fixed.defaultDisplayName : ''),
      content: '',
      keys: [],
      strategy: 'selective',
      position: 4,
      depth: 4,
      role: 0,
      order: 100,
      prob: 100,
      enabled: true,
    };
  }
  var merged = normalizeDraftEntry(Object.assign({}, base, patch, {
    id: base.id,
    kind: patch.kind || base.kind,
    owner: patch.owner || base.owner,
    ownerSlot: patch.ownerSlot != null ? patch.ownerSlot : base.ownerSlot,
  }));
  if (isSystemEntry(merged)) {
    var reg = getRegistryFixedSlot(merged.owner, merged.ownerSlot);
    if (reg) merged.displayName = reg.defaultDisplayName;
  }
  if (idx >= 0) list[idx] = merged;
  else list.push(merged);
  return list;
}

export function removeByOwner(entries, owner, ownerSlot) {
  var list = Array.isArray(entries) ? entries.slice() : [];
  var o = String(owner || '');
  if (!o) return list;
  if (ownerSlot == null) {
    return list.filter(function(e) { return !e || String(e.owner || '') !== o; });
  }
  var slot = String(ownerSlot);
  return list.filter(function(e) {
    return !e || String(e.owner || '') !== o || String(e.ownerSlot || '') !== slot;
  });
}

export function removeByOwnerPrefix(entries, owner, ownerSlotPrefix) {
  var list = Array.isArray(entries) ? entries.slice() : [];
  var o = String(owner || '');
  var p = String(ownerSlotPrefix || '');
  return list.filter(function(e) {
    if (!e || String(e.owner || '') !== o) return true;
    return String(e.ownerSlot || '').indexOf(p) !== 0;
  });
}

export function entryStComment(entry) {
  entry = entry || {};
  var fixed = getRegistryFixedSlot(entry.owner, entry.ownerSlot);
  if (fixed && fixed.stComment) return fixed.stComment;
  if (fixed && fixed.defaultDisplayName) return fixed.defaultDisplayName;
  if (String(entry.owner) === WB_OWNER.novel) {
    var name = String(entry.displayName || '').trim();
    if (entry.kind && entry.kind.indexOf('novel_') === 0) {
      if (entry.kind === 'novel_person' && name.indexOf('[小说人物]') !== 0 && name.indexOf('[人物]') !== 0) {
        return stCommentForNovelKind(entry.kind, name);
      }
      return stCommentForNovelKind(entry.kind, name.replace(/^\[小说\w+\]\s*/, ''));
    }
  }
  if (entry.kind === 'corruption_archive') {
    return String(entry.displayName || '').trim() || (CORRUPTION_ARCHIVE_PREFIX + entry.ownerSlot);
  }
  if (entry.kind === 'affection_archive') {
    return String(entry.displayName || '').trim() || (AFFECTION_ARCHIVE_PREFIX + entry.ownerSlot);
  }
  return String(entry.displayName || entry.comment || '').trim();
}

export function toStExportEntry(entry) {
  var e = normalizeDraftEntry(entry);
  var st = normalizeStParams(e, e);
  return {
    comment: entryStComment(e),
    content: st.content,
    keys: st.keys.slice(),
    strategy: st.strategy,
    position: st.position,
    depth: st.depth,
    role: st.role,
    order: st.order,
    prob: st.prob,
    enabled: st.enabled,
  };
}

function admissionExtras(stRow) {
  var ext = stRow.extensions && typeof stRow.extensions === 'object' ? stRow.extensions : {};
  var stcb = ext.stcb && typeof ext.stcb === 'object' ? ext.stcb : {};
  var extras = {};
  var job = stRow.job != null ? stRow.job : stcb.job;
  var reads = stRow.reads != null ? stRow.reads : stcb.reads;
  var group = stRow.group != null ? stRow.group : ext.group;
  if (job) extras.job = String(job);
  if (reads) extras.reads = String(reads);
  if (group) extras.group = String(group);
  if (stRow.preventRecursion === true || ext.prevent_recursion === true) extras.preventRecursion = true;
  if (stRow.excludeRecursion === true || ext.exclude_recursion === true) extras.excludeRecursion = true;
  return extras;
}

/** 正文里的模板块被模型写掉时，整段正文留在原条目上。 */
export function preserveLiveTemplate(original, next) {
  var blocks = String(original || '').match(/<%[\s\S]*?%>|\{\{[^{}]+\}\}/g) || [];
  if (!blocks.length) return { content: next, kept: false };
  var out = String(next || '');
  for (var i = 0; i < blocks.length; i++) {
    if (out.indexOf(blocks[i]) < 0) return { content: String(original || ''), kept: true };
  }
  return { content: out, kept: false };
}

export function fromStImportEntry(stRow) {
  stRow = stRow || {};
  if (typeof stRow.position === 'string' || (stRow.extensions && typeof stRow.extensions === 'object')) {
    stRow = Object.assign({}, stRow, { position: resolveEntryPosition(stRow) });
  }
  var comment = String(stRow.comment || '').trim();
  var reg = matchRegistryImportByComment(comment);
  var dyn = reg ? null : matchDynamicImportByComment(comment);
  var stParams = normalizeStParams(stRow, {});
  var extras = admissionExtras(stRow);
  if (reg) {
    return normalizeDraftEntry(Object.assign({
      id: reg.id,
      kind: reg.kind,
      owner: reg.owner,
      ownerSlot: reg.ownerSlot,
      displayName: reg.defaultDisplayName,
    }, stParams, extras));
  }
  if (dyn) {
    return normalizeDraftEntry(Object.assign({
      id: newWorldbookEntryId(),
      kind: dyn.kind,
      owner: dyn.owner,
      ownerSlot: dyn.ownerSlot,
      displayName: dyn.displayName || comment,
    }, stParams, extras));
  }
  var uid = newWorldbookEntryId();
  return normalizeDraftEntry(Object.assign({
    id: uid,
    kind: 'user',
    owner: WB_OWNER.user,
    ownerSlot: uid,
    displayName: comment,
  }, stParams, extras));
}

export function toAiJsonEntry(entry) {
  var e = normalizeDraftEntry(entry);
  var st = toStExportEntry(e);
  var out = {
    id: e.id,
    kind: e.kind,
    comment: st.comment,
    content: st.content,
    keys: st.keys,
    strategy: st.strategy,
    position: st.position,
    depth: st.depth,
    role: st.role,
    order: st.order,
    prob: st.prob,
    enabled: st.enabled,
  };
  var outlineType = String(e.outlineType || '').trim() || outlineTypeFromKind(e.kind);
  if (outlineType) out.type = outlineType;
  if (isSystemEntry(e)) {
    out._system = true;
  }
  return out;
}

export function aiCommentFromRow(row) {
  row = row || {};
  if (row.comment != null && String(row.comment).trim()) return String(row.comment).trim();
  return String(row.displayName || row.title || row.name || row.label || '').trim();
}

/** 统一 AI/助手 JSON 行：comment + content（含 blurb 回退） */
export function normalizeAiJsonRow(row) {
  row = row && typeof row === 'object' ? row : {};
  var comment = aiCommentFromRow(row);
  var content = row.content != null ? row.content : row.blurb;
  var out = Object.assign({}, row);
  if (comment) out.comment = comment;
  if (content != null && out.content == null) out.content = content;
  return out;
}

function classificationPatchFromAi(aiRow, base) {
  base = base || {};
  if (isSystemEntry(base)) return {};
  var outlineType = normalizeOutlineType(aiRow.type);
  if (!outlineType && aiRow.kind) outlineType = normalizeOutlineType(aiRow.kind);
  if (!outlineType) return {};
  var k = String(aiRow.kind || '');
  if (k && k.indexOf('outline_') !== 0 && k !== 'user' && k !== '') return {};
  return {
    kind: outlineKindFromType(outlineType),
    outlineType: outlineType,
  };
}

export function fromAiJsonEntry(aiRow, defaults) {
  defaults = defaults || {};
  aiRow = normalizeAiJsonRow(aiRow || {});
  var displayName = aiCommentFromRow(aiRow);
  var stParams = normalizeStParams(aiRow, {});
  var classPatch = classificationPatchFromAi(aiRow, defaults);
  var entry;
  if (defaults.id && defaults.owner) {
    entry = normalizeDraftEntry(Object.assign({}, defaults, stParams, classPatch, {
      displayName: isSystemEntry(defaults) ? defaults.displayName : displayName,
    }));
  } else {
    var uid = newWorldbookEntryId();
    entry = normalizeDraftEntry(Object.assign({
      id: uid,
      kind: classPatch.kind || defaults.kind || 'user',
      owner: defaults.owner || WB_OWNER.user,
      ownerSlot: defaults.ownerSlot || uid,
      displayName: displayName,
    }, stParams, classPatch));
  }
  var kept = preserveLiveTemplate(defaults.content, entry.content);
  if (kept.kept) entry.content = kept.content;
  if (defaults.job && !entry.job) entry.job = defaults.job;
  if (defaults.group && !entry.group) entry.group = defaults.group;
  if (defaults.reads && !entry.reads) entry.reads = defaults.reads;
  return entry;
}

export function toRuntimeEntry(entry) {
  return toStExportEntry(entry);
}

export function entryDisplayLabel(entry) {
  var e = entry && entry.kind ? entry : normalizeDraftEntry(entry);
  var dn = String(e.displayName || '').trim();
  if (dn) return dn;
  var fixed = getRegistryFixedSlot(e.owner, e.ownerSlot);
  if (fixed) return fixed.defaultDisplayName;
  var fromContent = String(e.content || '').replace(/\s+/g, ' ').trim();
  if (fromContent) {
    return fromContent.length > 56 ? fromContent.slice(0, 56) + '\u2026' : fromContent;
  }
  if (e.keys && e.keys.length && String(e.keys[0] || '').trim()) {
    return String(e.keys[0]).trim();
  }
  return '未命名条目';
}

/** 从 registry 固定槽构建 patch（供 systemDigest / MVU 写口） */
export function patchForRegistrySlot(owner, ownerSlot, stFields) {
  var fixed = getRegistryFixedSlot(owner, ownerSlot);
  if (!fixed) return null;
  stFields = stFields || {};
  return Object.assign({
    id: fixed.id,
    kind: fixed.kind,
    owner: fixed.owner,
    ownerSlot: fixed.ownerSlot,
    displayName: fixed.defaultDisplayName,
  }, normalizeStParams(stFields, stFields));
}

export function buildUserEntryPatch(displayName, stFields) {
  var uid = newWorldbookEntryId();
  stFields = stFields || {};
  return Object.assign({
    id: uid,
    kind: 'user',
    owner: WB_OWNER.user,
    ownerSlot: uid,
    displayName: String(displayName || '').trim(),
  }, normalizeStParams(stFields, stFields));
}

export function buildNovelEntryPatch(kind, name, stFields) {
  stFields = stFields || {};
  var k = kind || 'novel_setting';
  var n = String(name || '').trim() || '未命名';
  var slot = novelOwnerSlotForKind(k, n);
  var display = stCommentForNovelKind(k, n);
  var patch = Object.assign({
    id: newWorldbookEntryId(),
    kind: k,
    owner: WB_OWNER.novel,
    ownerSlot: slot,
    displayName: display,
  }, normalizeStParams(stFields, stFields));
  if (k === 'novel_person') patch.job = String(stFields.job || '').trim() || '身份与经历';
  else if (stFields.job) patch.job = String(stFields.job).trim();
  return patch;
}

export function buildCorruptionArchivePatch(charName, stFields) {
  var name = String(charName || '').trim() || '未命名';
  return Object.assign({
    id: newWorldbookEntryId(),
    kind: 'corruption_archive',
    owner: WB_OWNER.corruption,
    ownerSlot: name,
    displayName: '恶堕档案·' + name,
  }, normalizeStParams(stFields || {}, stFields || {}));
}

export function buildAffectionArchivePatch(charName, stFields) {
  var name = String(charName || '').trim() || '未命名';
  return Object.assign({
    id: newWorldbookEntryId(),
    kind: 'affection_archive',
    owner: WB_OWNER.affection,
    ownerSlot: name,
    displayName: '亲密档案·' + name,
  }, normalizeStParams(stFields || {}, stFields || {}));
}

export function buildEngineOutlinePatch(slotId, outlineType, displayName, stFields) {
  stFields = stFields || {};
  var kind = outlineKindFromType(outlineType);
  var ot = String(outlineType || stFields.outlineType || '').trim();
  return Object.assign({
    id: newWorldbookEntryId(),
    kind: kind,
    owner: WB_OWNER.aiEngine,
    ownerSlot: String(slotId || newWorldbookEntryId()),
    displayName: String(displayName || '').trim(),
    outlineType: ot,
    outlineLinks: Array.isArray(stFields.outlineLinks) ? stFields.outlineLinks.slice() : [],
    outlineBlurb: stFields.outlineBlurb != null ? String(stFields.outlineBlurb) : '',
    job: stFields.job != null ? String(stFields.job) : '',
    group: stFields.group != null ? String(stFields.group) : '',
    reads: stFields.reads != null ? String(stFields.reads) : '',
  }, normalizeStParams(stFields, stFields));
}

export function findEntriesByOwner(entries, owner, kindFilter) {
  var o = String(owner || '');
  return (Array.isArray(entries) ? entries : []).filter(function(e) {
    if (!e || String(e.owner || '') !== o) return false;
    if (kindFilter && String(e.kind || '') !== kindFilter) return false;
    return true;
  });
}

export function getEntryByOwnerSlot(entries, owner, ownerSlot) {
  var idx = findEntryIndex(Array.isArray(entries) ? entries : [], { owner: owner, ownerSlot: ownerSlot });
  if (idx < 0) return null;
  return entries[idx];
}

export function listRegistryFixedSlots() {
  return REGISTRY_FIXED_SLOTS.slice();
}

export function upsertManyByOwner(entries, patches) {
  var list = Array.isArray(entries) ? entries.slice() : [];
  (patches || []).forEach(function(p) {
    if (!p || !p.owner) return;
    list = upsertWorldbookEntry(list, p, { owner: p.owner, ownerSlot: p.ownerSlot, id: p.id });
  });
  return list;
}

/** 成人体系 digest upsert：按 adult ownerSlot 合并，新条插在首个系统锚点前 */
export function upsertAdultDigestEntries(entries, digestPatches) {
  var list = Array.isArray(entries) ? entries.slice() : [];
  var patches = digestPatches || [];
  patches.forEach(function(p) {
    if (!p || p.owner !== WB_OWNER.adult) return;
    list = upsertWorldbookEntry(list, p, { owner: p.owner, ownerSlot: p.ownerSlot, id: p.id });
  });
  return list;
}

export function stripEntriesByOwnerKind(entries, owner, kind) {
  return (Array.isArray(entries) ? entries : []).filter(function(e) {
    if (!e) return false;
    if (String(e.owner || '') !== owner) return true;
    if (kind && String(e.kind || '') === kind) return false;
    if (!kind) return false;
    return true;
  });
}

export function isAdultDigestEntry(entry) {
  return entry && String(entry.owner || '') === WB_OWNER.adult;
}

export function isNovelPersonEntry(entry) {
  return entry && entry.kind === 'novel_person';
}

export function isCorruptionRulesEntry(entry) {
  return entry && entry.kind === 'corruption_rules';
}

export function isCorruptionArchiveEntry(entry) {
  return entry && (entry.kind === 'corruption_archive' || entry.kind === 'corruption_archive_general');
}

export function isAffectionRulesEntry(entry) {
  return entry && entry.kind === 'affection_rules';
}

export function isAffectionArchiveEntry(entry) {
  return entry && (entry.kind === 'affection_archive' || entry.kind === 'affection_archive_general');
}

export function isMvuSystemEntry(entry) {
  return entry && String(entry.owner || '') === WB_OWNER.mvu;
}

export function isEngineOutlineEntry(entry) {
  return entry && String(entry.owner || '') === WB_OWNER.aiEngine;
}

/** @deprecated bridge 内 ST 导出用；测试/过渡可读 comment */
export function entryExportComment(entry) {
  return entryStComment(entry);
}

/** 助手 / AI 交叉引用：按 ST 导出 comment 定位条目 */
export function findEntryIndexByExportComment(entries, comment) {
  var c = String(comment || '').trim();
  if (!c) return -1;
  var list = Array.isArray(entries) ? entries : [];
  for (var i = 0; i < list.length; i++) {
    if (entryExportComment(list[i]) === c) return i;
  }
  return -1;
}
