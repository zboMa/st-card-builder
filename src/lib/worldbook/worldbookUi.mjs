/**
 * 世界书 UI 共享：V2 条目展示/筛选（面板 import 本模块，勿直接读 entry.comment）
 */
import {
  entryDisplayLabel,
  entryExportComment,
  isSystemEntry,
  isMvuSystemEntry,
  isAdultDigestEntry,
  entryFamily,
  OUTLINE_TYPE_LABELS,
  outlineTypeFromKind,
  normalizeOutlineType,
  getRegistryFixedSlot,
  WB_OWNER,
} from './worldbookEntryBridge.mjs';

export {
  entryDisplayLabel,
  entryExportComment,
  isSystemEntry,
  entryFamily,
};

export function wbEntryTitle(entry) {
  return entryDisplayLabel(entry);
}

export function wbEntrySearchHaystack(entry) {
  entry = entry || {};
  var parts = [
    wbEntryTitle(entry),
    entryExportComment(entry),
    (entry.keys || []).join(' '),
    String(entry.content || ''),
    String(entry.kind || ''),
    String(entry.owner || ''),
  ];
  return parts.join(' ').toLowerCase();
}

export function wbEntryFamily(entry) {
  return entryFamily(entry);
}

export function wbEntryTitleReadOnly(entry) {
  return isSystemEntry(entry);
}

export function wbOrganizeSkipEntry(entry) {
  if (!entry) return false;
  if (isSystemEntry(entry)) return true;
  if (isMvuSystemEntry(entry)) return true;
  if (isAdultDigestEntry(entry)) return true;
  if (entry.kind === 'corruption_rules' || entry.kind === 'affection_rules') return true;
  return false;
}

export function wbFamilyLabel(family) {
  var map = {
    mvu: 'MVU',
    adult_digest: '成人总纲',
    corruption: '恶堕',
    affection: '纯爱',
    novel: '小说',
    engine: 'AI 引擎',
    user: '用户',
  };
  return map[String(family || '')] || family || '用户';
}

export function wbKindLabel(kind) {
  return String(kind || 'user').replace(/^outline_/, '大纲·').replace(/^novel_/, '小说·').replace(/^adult_/, '').replace(/^mvu_/, 'MVU·');
}

export function wbKindLabelForEntry(entry) {
  entry = entry || {};
  var t = String(entry.outlineType || '').trim() || outlineTypeFromKind(entry.kind);
  if (t && OUTLINE_TYPE_LABELS[t]) return OUTLINE_TYPE_LABELS[t];
  var k = String(entry.kind || '').trim();
  if (!k || k === 'user') return '';
  return wbKindLabel(k);
}

/** outline 分类键（CSS 修饰符） */
export function wbOutlineTypeKey(entry) {
  entry = entry || {};
  var t = String(entry.outlineType || '').trim() || outlineTypeFromKind(entry.kind);
  return normalizeOutlineType(t) || '';
}

export function wbTypeTagLabel(entry) {
  entry = entry || {};
  var key = wbOutlineTypeKey(entry);
  if (key && OUTLINE_TYPE_LABELS[key]) return OUTLINE_TYPE_LABELS[key];
  var fixed = getRegistryFixedSlot(entry.owner, entry.ownerSlot);
  if (fixed && fixed.defaultDisplayName) return fixed.defaultDisplayName;
  if (entry.id === 'wb-mvu-varlist' || String(entry.ownerSlot || '') === 'mvu_varlist') return '变量列表';
  return wbKindLabelForEntry(entry);
}

export function wbTypeTagClass(entry) {
  entry = entry || {};
  var key = wbOutlineTypeKey(entry);
  if (key) return 'wb-type-tag wb-type--' + key;
  var k = String(entry.kind || '').trim();
  if (k.indexOf('mvu_') === 0
    || entry.id === 'wb-mvu-varlist'
    || String(entry.ownerSlot || '') === 'mvu_varlist'
    || String(entry.ownerSlot || '') === 'varlist') {
    return 'wb-type-tag wb-type--mvu';
  }
  if (k.indexOf('novel_') === 0) return 'wb-type-tag wb-type--novel';
  if (k.indexOf('adult_') === 0) return 'wb-type-tag wb-type--adult';
  if (k === 'corruption_rules' || k === 'corruption_archive' || k === 'affection_rules' || k === 'affection_archive') {
    return 'wb-type-tag wb-type--system-lore';
  }
  return '';
}
