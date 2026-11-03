/**
 * 世界书面板纯函数视图快照。
 */
import { getDefaultWBEntry, normalizeWBEntry } from '../state.mjs';
import {
  entryExportComment,
  isSystemEntry,
  wbEntryFamily,
  wbEntryTitle,
  wbKindLabelForEntry,
  wbTypeTagClass,
  wbTypeTagLabel,
} from '../../worldbook/worldbookUi.mjs';
import { isAdultDigestEntry, isMvuSystemEntry } from '../../worldbook/worldbookEntryBridge.mjs';

var POSITION_LABELS = [
  '角色定义之前',
  '角色定义之后',
  '示例消息之前',
  '示例消息之后',
  '按深度插入',
  '作者注释之前',
  '作者注释之后',
];

var STRATEGY_LABELS = {
  constant: '常驻',
  selective: '可选',
  vectorized: '向量化',
};

export function worldbookPositionLabel(position) {
  return POSITION_LABELS[Number(position)] || String(position);
}

export function worldbookStrategyLabel(strategy) {
  return STRATEGY_LABELS[strategy || 'selective'] || String(strategy || '可选');
}

export function worldbookRow(entry, index) {
  var normalized = normalizeWBEntry(entry);
  var title = wbEntryTitle(entry) || '(未命名)';
  var content = String(normalized.content || '');
  var preview = content.replace(/\s+/g, ' ').trim();
  if (preview.length > 80) preview = preview.slice(0, 80) + '…';
  var meta = '位置: ' + worldbookPositionLabel(normalized.position)
    + ' | 顺序: ' + normalized.order
    + ' | 深度: ' + normalized.depth
    + ' | 概率: ' + normalized.prob + '%';
  return {
    index: index,
    title: title,
    content: content,
    preview: preview,
    meta: meta,
    strategy: normalized.strategy,
    strategyLabel: worldbookStrategyLabel(normalized.strategy),
    strategyClass: normalized.strategy === 'constant'
      ? 'is-constant'
      : (normalized.strategy === 'vectorized' ? 'is-vectorized' : 'is-selective'),
    kindLabel: wbKindLabelForEntry(entry),
    typeClass: wbTypeTagClass(entry),
    typeLabel: wbTypeTagLabel(entry),
    isSkeleton: content.length < 60 || content.indexOf('待展开') >= 0,
    isSystem: isSystemEntry(entry),
    family: wbEntryFamily(entry),
  };
}

function familyAllowed(entry, family) {
  return family === 'all' || wbEntryFamily(entry) === family;
}

export function buildWorldbookRows(entries, family) {
  var rows = [];
  (entries || []).forEach(function(entry, index) {
    if (!familyAllowed(entry, family)) return;
    rows.push(worldbookRow(entry, index));
  });
  return rows;
}

function matchScope(entry, query, scopes) {
  var q = String(query || '').toLowerCase();
  if (!q) return null;
  var fields = [];
  if (scopes.title) fields.push({ key: '标题', text: wbEntryTitle(entry) });
  if (scopes.keys) fields.push({ key: '触发词', text: (entry.keys || []).join(', ') });
  if (scopes.content) fields.push({ key: '内容', text: String(entry.content || '') });
  var hitFields = fields.filter(function(field) {
    return String(field.text || '').toLowerCase().indexOf(q) >= 0;
  });
  if (!hitFields.length) return null;
  var content = String(entry.content || '');
  var at = content.toLowerCase().indexOf(q);
  var snippet = '';
  if (at >= 0) {
    var start = Math.max(0, at - 30);
    snippet = content.slice(start, Math.min(content.length, at + q.length + 70)).replace(/\s+/g, ' ');
    if (start > 0) snippet = '…' + snippet;
    if (at + q.length + 70 < content.length) snippet += '…';
  }
  return {
    fields: hitFields.map(function(field) { return field.key; }).join(' / '),
    snippet: snippet,
  };
}

export function buildWorldbookSearch(entries, query, scopes, family) {
  var scopesSafe = scopes || { title: true, keys: true, content: true };
  var hits = [];
  (entries || []).forEach(function(entry, index) {
    if (!familyAllowed(entry, family)) return;
    var match = matchScope(entry, query, scopesSafe);
    if (!match) return;
    hits.push({
      index: index,
      title: wbEntryTitle(entry) || '(未命名)',
      fields: match.fields,
      snippet: match.snippet,
    });
  });
  return hits;
}

export function buildWorldbookEditor(entry, isNew) {
  var e = normalizeWBEntry(entry || getDefaultWBEntry());
  return {
    isNew: !!isNew,
    titleReadOnly: isSystemEntry(entry || {}),
    displayName: String(e.displayName || wbEntryTitle(entry || {}) || ''),
    content: String(e.content || ''),
    keys: (e.keys || []).join(', '),
    job: String(e.job || ''),
    group: String(e.group || ''),
    reads: String(e.reads || ''),
    strategy: e.strategy || 'selective',
    position: String(e.position),
    role: String(e.role),
    depth: String(e.depth),
    order: String(e.order),
    prob: String(e.prob),
  };
}

export function buildWorldbookView(state, ui) {
  var s = state || {};
  var u = ui || {};
  var entries = Array.isArray(s.worldbookEntries) ? s.worldbookEntries : [];
  var scopes = {
    title: u.scopeTitle !== false,
    keys: u.scopeKeys !== false,
    content: u.scopeContent !== false,
  };
  var rows = buildWorldbookRows(entries, u.family || 'all');
  var hits = u.query ? buildWorldbookSearch(entries, u.query, scopes, u.family || 'all') : [];
  return {
    rows: rows,
    countText: rows.length + ' 条',
    searchHits: hits,
    searchCountText: u.query ? ('命中 ' + hits.length + ' 条') : '',
  };
}

export function organizePreview(entries, suggestions) {
  return (suggestions || []).map(function(item) {
    var e = (entries || [])[item.index] || {};
    return {
      index: item.index,
      title: wbEntryTitle(e) || '',
      position: worldbookPositionLabel(item.position),
      role: item.role === 0 ? '系统' : (item.role === 1 ? '用户' : '助手'),
      depth: item.depth,
      order: item.order,
      prob: item.prob,
      reason: String(item.reason || ''),
    };
  });
}

export function worldbookSkipOrganize(entry) {
  if (!entry) return true;
  return isSystemEntry(entry) || isMvuSystemEntry(entry) || isAdultDigestEntry(entry)
    || entry.kind === 'corruption_rules' || entry.kind === 'affection_rules';
}

export function worldbookEntryJson(entry) {
  return entryExportComment(entry);
}
