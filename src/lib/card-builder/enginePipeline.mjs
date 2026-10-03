/**
 * AI 引擎生成管线：模式、大纲类型、配额与上下文拼装
 */
import {
  buildEngineOutlinePatch,
  normalizeDraftEntry,
  entryExportComment,
} from '../worldbook/worldbookEntryBridge.mjs';
import { OUTLINE_TYPES, OUTLINE_TYPE_LABELS } from '../worldbook/worldbookRegistry.mjs';

export { OUTLINE_TYPES, OUTLINE_TYPE_LABELS };

export var ENGINE_GEN_MODE_FULL = 'full';
export var ENGINE_GEN_MODE_SKELETON = 'skeleton';

export function normalizeEngineGenMode(mode) {
  var m = String(mode || '').trim();
  if (m === ENGINE_GEN_MODE_SKELETON) return ENGINE_GEN_MODE_SKELETON;
  return ENGINE_GEN_MODE_FULL;
}

export function clampSlotCount(n) {
  var v = Math.floor(Number(n) || 0);
  if (v < 1) return 6;
  if (v > 30) return 30;
  return v;
}

var CARD_SNAPSHOT_KEYS = [
  'charName', 'wbName', 'charDesc', 'creatorNotes', 'charTags',
  'firstMes', 'altGreetings', 'worldbookEntries',
  'regexScripts', 'tavernHelperScripts',
];

/** 生成前记下整张卡。失败或取消时用 restoreCardDraft 写回。 */
export function snapshotCardDraft(state) {
  var snap = {};
  CARD_SNAPSHOT_KEYS.forEach(function(key) {
    if (!state || state[key] == null) return;
    snap[key] = JSON.parse(JSON.stringify(state[key]));
  });
  return snap;
}

export function restoreCardDraft(state, snap) {
  if (!state || !snap) return state;
  Object.keys(snap).forEach(function(key) {
    state[key] = JSON.parse(JSON.stringify(snap[key]));
  });
  return state;
}

/** 已有标题或正文时，生成前必须由作者点一次替换。 */
export function worldbookReplaceNeedsConfirm(entries) {
  return (entries || []).some(function(entry) {
    if (!entry) return false;
    return !!(String(entry.content || '').trim() || String(entry.displayName || entry.comment || '').trim());
  });
}

export function normalizeOutlineSlot(raw, index) {
  if (!raw || typeof raw !== 'object') return null;
  var type = String(raw.type || raw.category || 'other').trim().toLowerCase();
  if (OUTLINE_TYPES.indexOf(type) < 0) {
    // 中文/别名兜底
    var map = {
      '世界观': 'worldview', '规则': 'worldview', '设定': 'worldview',
      '地点': 'location', '场所': 'location',
      '势力': 'faction', '组织': 'faction',
      '人物': 'person', '角色': 'person', 'npc': 'person',
      '事件': 'event', '剧情': 'event',
      '物品': 'item', '道具': 'item', '载体': 'item',
      '能力': 'ability', '功法': 'ability', '异能': 'ability',
    };
    type = map[type] || map[String(raw.type || '')] || 'other';
  }
  var comment = String(raw.comment || raw.title || raw.name || '').trim();
  if (!comment) comment = (OUTLINE_TYPE_LABELS[type] || '条目') + (index + 1);
  var job = String(raw.job != null ? raw.job : '').trim();
  var blurb = String(raw.blurb || raw.summary || '').trim();
  if (!job && raw.content) job = String(raw.content).trim();
  if (!blurb) blurb = '（待展开）';
  var strategy = raw.strategy === 'constant' ? 'constant' : (raw.strategy === 'vectorized' ? 'vectorized' : 'selective');
  var keys = Array.isArray(raw.keys) ? raw.keys.map(String).filter(Boolean) : [];
  if (!keys.length && strategy !== 'constant') {
    keys = [comment.replace(/^=+|\[.*?\]|=+$/g, '').trim().slice(0, 12)].filter(Boolean);
  }
  var links = Array.isArray(raw.links) ? raw.links.map(String).filter(Boolean)
    : (Array.isArray(raw.related) ? raw.related.map(String).filter(Boolean) : []);
  return {
    type: type,
    comment: comment,
    blurb: blurb.slice(0, 120),
    keys: keys.slice(0, 6),
    links: links.slice(0, 8),
    strategy: strategy,
    job: job,
    group: String(raw.group || '').trim(),
    reads: String(raw.reads || '').trim(),
    enabled: raw.enabled !== false,
    position: raw.position != null && raw.position !== '' ? raw.position : null,
  };
}

export function normalizeOutlineSlots(rawList, expectedCount) {
  var list = Array.isArray(rawList) ? rawList : [];
  if (!list.length && rawList && Array.isArray(rawList.slots)) list = rawList.slots;
  if (!list.length && rawList && Array.isArray(rawList.entries)) list = rawList.entries;
  var out = [];
  var seen = Object.create(null);
  list.forEach(function(raw, i) {
    var slot = normalizeOutlineSlot(raw, i);
    if (!slot) return;
    var key = slot.comment.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    out.push(slot);
  });
  var need = clampSlotCount(expectedCount || out.length || 6);
  return out.slice(0, need);
}

export function slotToWorldbookEntry(slot, orderBase) {
  var displayName = String(slot.comment || '').trim();
  if (displayName.indexOf('[') !== 0 && slot.type === 'person') {
    displayName = '[小说人物] ' + displayName.replace(/^\[.*?\]\s*/, '');
  }
  var slotId = slot._slotId || ('outline-' + String(slot.type || 'other') + '-' + (slot._i != null ? slot._i : displayName));
  var patch = buildEngineOutlinePatch(slotId, slot.type, displayName, {
    content: slot.blurb || '（待展开）',
    keys: (slot.keys || []).slice(),
    strategy: slot.strategy || 'selective',
    position: slot.position != null ? slot.position : (slot.strategy === 'constant' ? 0 : 1),
    job: slot.job || '',
    group: slot.group || '',
    reads: slot.reads || '',
    enabled: slot.enabled !== false,
    depth: 4,
    role: 0,
    order: (orderBase || 100) + (slot._i || 0),
    prob: 100,
    outlineType: slot.type,
    outlineLinks: (slot.links || []).slice(),
    outlineBlurb: slot.blurb || '',
  });
  return normalizeDraftEntry(patch);
}

export function formatOutlineRef(slots) {
  if (!slots || !slots.length) return '';
  var lines = slots.map(function(s, i) {
    var lab = OUTLINE_TYPE_LABELS[s.type] || s.type || '条目';
    var link = (s.links && s.links.length) ? ('｜关联：' + s.links.join('、')) : '';
    var job = s.job ? ('｜职责：' + s.job) : '';
    return (i + 1) + '. [' + lab + '] ' + s.comment + job + link;
  });
  return '\n【世界书大纲（须遵守各条职责与关联，勿另起炉灶）】\n' + lines.join('\n');
}

export function formatEnrichedEntriesRef(entries, opts) {
  opts = opts || {};
  var max = Math.max(4, Math.floor(Number(opts.maxEntries) || 12));
  var sliceLen = Math.max(80, Math.floor(Number(opts.perEntryChars) || 220));
  var list = (entries || []).filter(function(e) {
    return e && String(e.content || '').replace(/\s+/g, '').length >= 60
      && String(e.content || '').indexOf('待展开') < 0;
  }).slice(-max);
  if (!list.length) return '';
  var lines = list.map(function(e) {
    return '- ' + entryExportComment(e) + '：' + String(e.content || '').replace(/\s+/g, ' ').slice(0, sliceLen);
  });
  return '\n【已丰满世界书摘要（须与之互洽，可引用，勿矛盾）】\n' + lines.join('\n');
}

export function isSkeletonEntry(entry) {
  if (!entry) return true;
  var c = String(entry.content || '');
  if (c.indexOf('待展开') >= 0) return true;
  return c.replace(/\s+/g, '').length < 60;
}

export function buildCrossLinkDigest(entries) {
  var list = (entries || []).filter(function(e) { return e && !isSkeletonEntry(e); });
  if (list.length < 2) return '';
  return list.map(function(e) {
    return entryExportComment(e) + '↔' + (Array.isArray(e.outlineLinks) ? e.outlineLinks.join('/') : '');
  }).join('；');
}
