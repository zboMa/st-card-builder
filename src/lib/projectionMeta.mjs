/**
 * 投影链 meta 字段（§3.8 · D16）
 */

export var LINK_STATUSES = ['linked', 'detached'];
export var SOURCE_REF_TYPES = ['entity', 'storyNode', 'card', 'manual'];

export function defaultProjectionMeta(partial) {
  var p = partial && typeof partial === 'object' ? partial : {};
  var linkStatus = String(p.linkStatus || 'linked');
  if (LINK_STATUSES.indexOf(linkStatus) < 0) linkStatus = 'linked';
  var out = {
    linkStatus: linkStatus,
    projectionDirty: !!p.projectionDirty,
  };
  if (p.sourceRef && typeof p.sourceRef === 'object' && p.sourceRef.type) {
    out.sourceRef = {
      type: String(p.sourceRef.type),
      id: p.sourceRef.id != null ? String(p.sourceRef.id) : '',
      novelId: p.sourceRef.novelId != null ? String(p.sourceRef.novelId) : undefined,
      entryId: p.sourceRef.entryId != null ? String(p.sourceRef.entryId) : undefined,
      charSlot: p.sourceRef.charSlot != null ? String(p.sourceRef.charSlot) : undefined,
    };
  }
  if (p.promotedAt) out.promotedAt = String(p.promotedAt);
  return out;
}

/** Promote 时写入 linked 投影 */
export function projectionMetaForPromote(sourceRef) {
  return defaultProjectionMeta({
    sourceRef: sourceRef,
    linkStatus: 'linked',
    projectionDirty: false,
    promotedAt: new Date().toISOString(),
  });
}

/** 手改 worldbook 正文（非身份键） */
export function markProjectionDirty(entry) {
  if (!entry || typeof entry !== 'object') return entry;
  entry.projectionDirty = true;
  if (!entry.linkStatus) entry.linkStatus = 'linked';
  return entry;
}

/** 破坏性编辑 / 用户 detach */
export function detachProjection(entry) {
  if (!entry || typeof entry !== 'object') return entry;
  entry.linkStatus = 'detached';
  entry.sourceRef = undefined;
  entry.projectionDirty = false;
  return entry;
}

/** 是否改了身份键 */
export function isIdentityKeyChange(oldEntry, patch) {
  if (!patch || typeof patch !== 'object') return false;
  var fields = ['displayName', 'ownerSlot', 'kind'];
  for (var i = 0; i < fields.length; i++) {
    var k = fields[i];
    if (patch[k] != null && String(patch[k]) !== String(oldEntry[k] || '')) return true;
  }
  if (patch.comment != null && oldEntry.displayName != null) {
    var oldName = String(oldEntry.displayName || '');
    if (String(patch.comment) !== oldName && !String(patch.comment).includes(oldName)) {
      return false;
    }
  }
  return false;
}

export function mergeProjectionOntoEntry(entry, meta) {
  var e = entry && typeof entry === 'object' ? entry : {};
  var m = defaultProjectionMeta(meta);
  if (m.sourceRef) e.sourceRef = m.sourceRef;
  if (m.linkStatus) e.linkStatus = m.linkStatus;
  e.projectionDirty = !!m.projectionDirty;
  if (m.promotedAt) e.promotedAt = m.promotedAt;
  return e;
}

export function stripProjectionMeta(entry) {
  if (!entry || typeof entry !== 'object') return entry;
  var copy = Object.assign({}, entry);
  delete copy.sourceRef;
  delete copy.linkStatus;
  delete copy.projectionDirty;
  delete copy.promotedAt;
  return copy;
}
