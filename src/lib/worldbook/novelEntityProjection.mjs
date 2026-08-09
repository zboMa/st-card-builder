/**
 * 小说实体 / 草稿 → 世界书 V2 投影（列表展示用，不替代 entity.category）
 */
import { kindToFamily, novelKindFromEntityCategory, novelOwnerSlotForKind, stCommentForNovelKind } from '../worldbook/worldbookRegistry.mjs';

export function novelKindFromDraftOrEntity(d) {
  d = d || {};
  if (d.kind) return d.kind;
  var cat = d.category || (d.type === 'person' ? 'character' : d.type) || 'setting';
  return novelKindFromEntityCategory(cat, d.type);
}

export function projectNovelWorldbookMeta(d) {
  d = d || {};
  var name = String(d.name || '').trim() || '未命名';
  var kind = novelKindFromDraftOrEntity(d);
  var family = kindToFamily(kind);
  var displayName = String(d.displayName || d.comment || '').trim();
  if (!displayName) displayName = stCommentForNovelKind(kind, name);
  return {
    kind: kind,
    family: family,
    displayName: displayName,
    ownerSlot: novelOwnerSlotForKind(kind, name),
  };
}

export { kindToFamily };
