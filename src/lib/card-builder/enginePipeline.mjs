/**
 * AI 引擎生成管线：模式、大纲类型、配额与上下文拼装
 */
export var ENGINE_GEN_MODE_FULL = 'full';
export var ENGINE_GEN_MODE_SKELETON = 'skeleton';

export var OUTLINE_TYPES = [
  'worldview',
  'location',
  'faction',
  'person',
  'event',
  'item',
  'ability',
  'other',
];

export var OUTLINE_TYPE_LABELS = {
  worldview: '世界观/规则',
  location: '地点',
  faction: '势力',
  person: '人物',
  event: '事件',
  item: '物品',
  ability: '能力',
  other: '其他',
};

/** 默认类型配额（合计 13；可被总条数缩放） */
export var DEFAULT_OUTLINE_QUOTA = {
  worldview: 2,
  location: 2,
  faction: 2,
  person: 3,
  event: 2,
  item: 1,
  ability: 1,
  other: 0,
};

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

/**
 * 按总条数缩放默认配额，保证至少覆盖主要类型
 */
export function buildScaledQuota(totalSlots) {
  var total = clampSlotCount(totalSlots);
  var base = DEFAULT_OUTLINE_QUOTA;
  var baseSum = Object.keys(base).reduce(function(s, k) { return s + (base[k] || 0); }, 0) || 1;
  var out = {};
  var assigned = 0;
  var keys = OUTLINE_TYPES.filter(function(k) { return (base[k] || 0) > 0; });
  keys.forEach(function(k, idx) {
    if (idx === keys.length - 1) {
      out[k] = Math.max(1, total - assigned);
    } else {
      var n = Math.max(1, Math.round((base[k] / baseSum) * total));
      out[k] = n;
      assigned += n;
    }
  });
  // 修正溢出
  var sum = Object.keys(out).reduce(function(s, k) { return s + out[k]; }, 0);
  if (sum > total) {
    var over = sum - total;
    var shrinkOrder = ['other', 'ability', 'item', 'event', 'faction', 'location', 'person', 'worldview'];
    shrinkOrder.forEach(function(k) {
      if (over <= 0 || !out[k]) return;
      var cut = Math.min(over, Math.max(0, out[k] - 1));
      out[k] -= cut;
      over -= cut;
    });
  } else if (sum < total) {
    out.person = (out.person || 0) + (total - sum);
  }
  return out;
}

export function formatQuotaForPrompt(quota) {
  var q = quota || buildScaledQuota(13);
  return OUTLINE_TYPES.filter(function(t) { return (q[t] || 0) > 0; }).map(function(t) {
    return OUTLINE_TYPE_LABELS[t] + '×' + q[t];
  }).join('、');
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
  var blurb = String(raw.blurb || raw.content || raw.summary || '').trim();
  if (!blurb) blurb = '（待展开）';
  var keys = Array.isArray(raw.keys) ? raw.keys.map(String).filter(Boolean) : [];
  if (!keys.length) keys = [comment.replace(/^=+|\[.*?\]|=+$/g, '').trim().slice(0, 12)].filter(Boolean);
  var links = Array.isArray(raw.links) ? raw.links.map(String).filter(Boolean)
    : (Array.isArray(raw.related) ? raw.related.map(String).filter(Boolean) : []);
  var strategy = raw.strategy === 'constant' ? 'constant' : 'selective';
  return {
    type: type,
    comment: comment,
    blurb: blurb.slice(0, 120),
    keys: keys.slice(0, 6),
    links: links.slice(0, 8),
    strategy: strategy,
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
  var typeLabel = OUTLINE_TYPE_LABELS[slot.type] || slot.type;
  var comment = slot.comment;
  if (comment.indexOf('[') !== 0 && slot.type === 'person') {
    comment = '[小说人物] ' + comment.replace(/^\[.*?\]\s*/, '');
  }
  return {
    comment: comment,
    content: slot.blurb || '（待展开）',
    keys: (slot.keys || []).slice(),
    strategy: slot.strategy || 'selective',
    position: slot.type === 'worldview' ? 0 : 4,
    depth: 4,
    role: 0,
    order: (orderBase || 100) + (slot._i || 0),
    prob: 100,
    outlineType: slot.type,
    outlineLinks: (slot.links || []).slice(),
    outlineBlurb: slot.blurb || '',
  };
}

export function formatOutlineRef(slots) {
  if (!slots || !slots.length) return '';
  var lines = slots.map(function(s, i) {
    var lab = OUTLINE_TYPE_LABELS[s.type] || s.type;
    var link = (s.links && s.links.length) ? ('｜关联：' + s.links.join('、')) : '';
    return (i + 1) + '. [' + lab + '] ' + s.comment + ' — ' + (s.blurb || '') + link;
  });
  return '\n【世界书大纲（须遵守类型职责与关联，勿另起炉灶）】\n' + lines.join('\n');
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
    return '- ' + e.comment + '：' + String(e.content || '').replace(/\s+/g, ' ').slice(0, sliceLen);
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
    return e.comment + '↔' + (Array.isArray(e.outlineLinks) ? e.outlineLinks.join('/') : '');
  }).join('；');
}
