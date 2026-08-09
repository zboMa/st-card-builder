/**
 * 世界书 Entry V2：系统槽位 registry（kind / owner / ownerSlot / ST 导出 comment 模板）
 * 纯逻辑，Node 可直跑。
 */

export var CORRUPTION_RULES_COMMENT = '恶堕进度总则';
export var CORRUPTION_ARCHIVE_PREFIX = '恶堕档案·';
export var CORRUPTION_GENERAL_ARCHIVE_COMMENT = '恶堕档案·通用';
export var AFFECTION_RULES_COMMENT = '亲密关系总则';
export var AFFECTION_ARCHIVE_PREFIX = '亲密档案·';
export var AFFECTION_GENERAL_ARCHIVE_COMMENT = '亲密档案·通用';

export var SYSTEM_DIGEST_PREFIX = '[成人体系]';
export var NOVEL_STYLE_WB_COMMENT = '文风';

export var WB_OWNER = {
  mvu: 'mvu',
  adult: 'adult',
  corruption: 'corruption',
  affection: 'affection',
  novel: 'novel',
  aiEngine: 'aiEngine',
  user: 'user',
};

/** @typedef {'mvu'|'adult_digest'|'corruption'|'affection'|'novel'|'engine'|'user'} WbFamily */

var KIND_FAMILY = Object.create(null);

function regFamily(kind, family) {
  KIND_FAMILY[kind] = family;
}

regFamily('mvu_initvar', 'mvu');
regFamily('mvu_update_rules', 'mvu');
regFamily('mvu_update_format', 'mvu');
regFamily('adult_worldview', 'adult_digest');
regFamily('adult_vessel', 'adult_digest');
regFamily('adult_flavor', 'adult_digest');
regFamily('adult_posture', 'adult_digest');
regFamily('adult_speech', 'adult_digest');
regFamily('adult_ntl', 'adult_digest');
regFamily('corruption_rules', 'corruption');
regFamily('corruption_archive_general', 'corruption');
regFamily('corruption_archive', 'corruption');
regFamily('affection_rules', 'affection');
regFamily('affection_archive_general', 'affection');
regFamily('affection_archive', 'affection');
regFamily('novel_person', 'novel');
regFamily('novel_setting', 'novel');
regFamily('novel_relation', 'novel');
regFamily('novel_event', 'novel');
regFamily('novel_style', 'novel');
['worldview', 'location', 'faction', 'person', 'event', 'item', 'ability', 'other'].forEach(function(t) {
  regFamily('outline_' + t, 'engine');
});
regFamily('user', 'user');

export var OUTLINE_KINDS = [
  'outline_worldview',
  'outline_location',
  'outline_faction',
  'outline_person',
  'outline_event',
  'outline_item',
  'outline_ability',
  'outline_other',
];

/**
 * @typedef {object} RegistrySlotDef
 * @property {string} id stable registry id (fixed slots only)
 * @property {string} kind
 * @property {string} owner
 * @property {string} ownerSlot
 * @property {string} defaultDisplayName
 * @property {string} [stComment] exact ST export comment when fixed
 * @property {boolean} [titleEditable]
 * @property {boolean} [deletable]
 */

/** Fixed registry slots (dynamic slots use same kind + ownerSlot pattern without fixed id) */
export var REGISTRY_FIXED_SLOTS = [
  {
    id: 'wb-mvu-initvar',
    kind: 'mvu_initvar',
    owner: WB_OWNER.mvu,
    ownerSlot: 'initvar',
    defaultDisplayName: '变量初始化',
    stComment: '[initvar]变量初始化勿开',
    titleEditable: false,
    deletable: false,
  },
  {
    id: 'wb-mvu-update-rules',
    kind: 'mvu_update_rules',
    owner: WB_OWNER.mvu,
    ownerSlot: 'update_rules',
    defaultDisplayName: '变量更新规则',
    stComment: '[mvu_update]变量更新规则',
    titleEditable: false,
    deletable: false,
  },
  {
    id: 'wb-mvu-update-format',
    kind: 'mvu_update_format',
    owner: WB_OWNER.mvu,
    ownerSlot: 'update_format',
    defaultDisplayName: '变量输出格式',
    stComment: '[mvu_update]变量输出格式',
    titleEditable: false,
    deletable: false,
  },
  {
    id: 'wb-adult-worldview',
    kind: 'adult_worldview',
    owner: WB_OWNER.adult,
    ownerSlot: 'worldview',
    defaultDisplayName: '成人体系 · 世界观',
    stComment: SYSTEM_DIGEST_PREFIX + '世界观',
    titleEditable: false,
    deletable: false,
  },
  {
    id: 'wb-adult-vessel',
    kind: 'adult_vessel',
    owner: WB_OWNER.adult,
    ownerSlot: 'vessel',
    defaultDisplayName: '成人体系 · 载体框架',
    stComment: SYSTEM_DIGEST_PREFIX + '载体框架',
    titleEditable: false,
    deletable: false,
  },
  {
    id: 'wb-adult-flavor',
    kind: 'adult_flavor',
    owner: WB_OWNER.adult,
    ownerSlot: 'flavor',
    defaultDisplayName: '成人体系 · NSFW口味',
    stComment: SYSTEM_DIGEST_PREFIX + 'NSFW口味',
    titleEditable: false,
    deletable: false,
  },
  {
    id: 'wb-adult-posture',
    kind: 'adult_posture',
    owner: WB_OWNER.adult,
    ownerSlot: 'posture',
    defaultDisplayName: '成人体系 · 姿势语言',
    stComment: SYSTEM_DIGEST_PREFIX + '姿势语言',
    titleEditable: false,
    deletable: false,
  },
  {
    id: 'wb-adult-speech',
    kind: 'adult_speech',
    owner: WB_OWNER.adult,
    ownerSlot: 'speech',
    defaultDisplayName: '成人体系 · 情趣话风',
    stComment: SYSTEM_DIGEST_PREFIX + '情趣话风',
    titleEditable: false,
    deletable: false,
  },
  {
    id: 'wb-adult-ntl',
    kind: 'adult_ntl',
    owner: WB_OWNER.adult,
    ownerSlot: 'ntl',
    defaultDisplayName: '成人体系 · NTL禁忌',
    stComment: SYSTEM_DIGEST_PREFIX + 'NTL禁忌',
    titleEditable: false,
    deletable: false,
  },
  {
    id: 'wb-corruption-rules',
    kind: 'corruption_rules',
    owner: WB_OWNER.corruption,
    ownerSlot: 'rules',
    defaultDisplayName: CORRUPTION_RULES_COMMENT,
    stComment: CORRUPTION_RULES_COMMENT,
    titleEditable: false,
    deletable: false,
  },
  {
    id: 'wb-corruption-general',
    kind: 'corruption_archive_general',
    owner: WB_OWNER.corruption,
    ownerSlot: 'general',
    defaultDisplayName: CORRUPTION_GENERAL_ARCHIVE_COMMENT,
    stComment: CORRUPTION_GENERAL_ARCHIVE_COMMENT,
    titleEditable: false,
    deletable: false,
  },
  {
    id: 'wb-affection-rules',
    kind: 'affection_rules',
    owner: WB_OWNER.affection,
    ownerSlot: 'rules',
    defaultDisplayName: AFFECTION_RULES_COMMENT,
    stComment: AFFECTION_RULES_COMMENT,
    titleEditable: false,
    deletable: false,
  },
  {
    id: 'wb-affection-general',
    kind: 'affection_archive_general',
    owner: WB_OWNER.affection,
    ownerSlot: 'general',
    defaultDisplayName: AFFECTION_GENERAL_ARCHIVE_COMMENT,
    stComment: AFFECTION_GENERAL_ARCHIVE_COMMENT,
    titleEditable: false,
    deletable: false,
  },
  {
    id: 'wb-novel-style',
    kind: 'novel_style',
    owner: WB_OWNER.novel,
    ownerSlot: 'style',
    defaultDisplayName: NOVEL_STYLE_WB_COMMENT,
    stComment: NOVEL_STYLE_WB_COMMENT,
    titleEditable: false,
    deletable: false,
  },
];

var _byId = Object.create(null);
var _byOwnerSlot = Object.create(null);
var _importExact = Object.create(null);

REGISTRY_FIXED_SLOTS.forEach(function(slot) {
  _byId[slot.id] = slot;
  _byOwnerSlot[slot.owner + '\0' + slot.ownerSlot] = slot;
  if (slot.stComment) _importExact[String(slot.stComment).trim()] = slot;
});

_importExact[CORRUPTION_RULES_COMMENT] = _byId['wb-corruption-rules'];
_importExact[CORRUPTION_GENERAL_ARCHIVE_COMMENT] = _byId['wb-corruption-general'];
_importExact[AFFECTION_RULES_COMMENT] = _byId['wb-affection-rules'];
_importExact[AFFECTION_GENERAL_ARCHIVE_COMMENT] = _byId['wb-affection-general'];
_importExact[NOVEL_STYLE_WB_COMMENT] = _byId['wb-novel-style'];

export function kindToFamily(kind) {
  var k = String(kind || '').trim();
  if (k.indexOf('outline_') === 0) {
    throw new Error('kindToFamily: outline_* 须用 entryFamily(entry)（依赖 owner）');
  }
  return KIND_FAMILY[k] || 'user';
}

/**
 * 侧栏分组 / 筛选唯一真相：outline_* 由 owner 区分 engine vs user
 * @param {object} entry
 * @returns {import('./worldbookRegistry.mjs').WbFamily|string}
 */
export function entryFamily(entry) {
  if (!entry || typeof entry !== 'object') return 'user';
  var kind = String(entry.kind || '').trim();
  if (!kind) return 'user';
  if (kind.indexOf('outline_') === 0) {
    return String(entry.owner || '') === WB_OWNER.aiEngine ? 'engine' : 'user';
  }
  return KIND_FAMILY[kind] || 'user';
}

export function outlineTypeFromKind(kind) {
  var k = String(kind || '');
  if (k.indexOf('outline_') !== 0) return '';
  return k.slice('outline_'.length);
}

/** 与 enginePipeline.OUTLINE_TYPES 一致 */
export var OUTLINE_TYPES = [
  'worldview', 'location', 'faction', 'person', 'event', 'item', 'ability', 'other',
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

export function normalizeOutlineType(raw) {
  var t = String(raw || '').trim().toLowerCase();
  if (t.indexOf('outline_') === 0) t = t.slice('outline_'.length);
  if (OUTLINE_TYPES.indexOf(t) >= 0) return t;
  return '';
}

export function listKindsByFamily(family) {
  var f = String(family || '').trim();
  return Object.keys(KIND_FAMILY).filter(function(k) { return KIND_FAMILY[k] === f; });
}

export function getRegistryEntryById(id) {
  return _byId[String(id || '').trim()] || null;
}

export function getRegistryFixedSlot(owner, ownerSlot) {
  return _byOwnerSlot[String(owner || '') + '\0' + String(ownerSlot || '')] || null;
}

export function isSystemOwner(owner) {
  var o = String(owner || '').trim();
  if (!o || o === WB_OWNER.user) return false;
  return true;
}

export function isSystemEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  return isSystemOwner(entry.owner);
}

/** 小说 entity category → draft kind */
export function novelKindFromEntityCategory(category, entityType) {
  var cat = String(category || '').trim().toLowerCase();
  var type = String(entityType || '').trim().toLowerCase();
  if (cat === 'character' || type === 'person') return 'novel_person';
  if (cat === 'relation') return 'novel_relation';
  if (cat === 'event' || type === 'event') return 'novel_event';
  if (cat === 'style') return 'novel_style';
  return 'novel_setting';
}

export function novelOwnerSlotForKind(kind, name) {
  var n = String(name || '').trim() || '未命名';
  var k = String(kind || '');
  if (k === 'novel_person') return n;
  if (k === 'novel_style') return 'style';
  if (k === 'novel_setting') return 'setting::' + n;
  if (k === 'novel_relation') return 'relation::' + n;
  if (k === 'novel_event') return 'event::' + n;
  return 'setting::' + n;
}

export function stCommentForNovelKind(kind, displayName) {
  var name = String(displayName || '').trim();
  var k = String(kind || '');
  if (k === 'novel_person') return '[小说人物] ' + name;
  if (k === 'novel_style') return NOVEL_STYLE_WB_COMMENT;
  if (k === 'novel_setting') return '[小说setting] ' + name;
  if (k === 'novel_relation') return '[小说relation] ' + name;
  if (k === 'novel_event') return '[小说event] ' + name;
  return name;
}

export function outlineKindFromType(outlineType) {
  var t = String(outlineType || 'other').trim();
  if (['worldview', 'location', 'faction', 'person', 'event', 'item', 'ability', 'other'].indexOf(t) < 0) {
    t = 'other';
  }
  return 'outline_' + t;
}

/**
 * ST 导入：按 comment 识别固定系统槽（不反推动态 archive 以外的复杂逻辑）
 * @returns {RegistrySlotDef|null}
 */
export function matchRegistryImportByComment(comment) {
  var c = String(comment || '').trim();
  if (!c) return null;
  if (_importExact[c]) return _importExact[c];
  if (c.indexOf(SYSTEM_DIGEST_PREFIX) === 0) {
    var suffix = c.slice(SYSTEM_DIGEST_PREFIX.length);
    var map = {
      世界观: 'worldview',
      载体框架: 'vessel',
      NSFW口味: 'flavor',
      姿势语言: 'posture',
      情趣话风: 'speech',
      NTL禁忌: 'ntl',
    };
    if (map[suffix]) return getRegistryFixedSlot(WB_OWNER.adult, map[suffix]);
  }
  if (c.indexOf('[initvar]') === 0) return getRegistryFixedSlot(WB_OWNER.mvu, 'initvar');
  if (c === '[mvu_update]变量更新规则') return getRegistryFixedSlot(WB_OWNER.mvu, 'update_rules');
  if (c === '[mvu_update]变量输出格式') return getRegistryFixedSlot(WB_OWNER.mvu, 'update_format');
  if (c.indexOf('[mvu_update]') === 0 && c.indexOf('输出格式') >= 0) {
    return getRegistryFixedSlot(WB_OWNER.mvu, 'update_format');
  }
  if (c.indexOf('[mvu_update]') === 0) return getRegistryFixedSlot(WB_OWNER.mvu, 'update_rules');
  return null;
}

/** @returns {{ kind: string, owner: string, ownerSlot: string, displayName: string }|null} */
export function matchDynamicImportByComment(comment) {
  var c = String(comment || '').trim();
  if (!c) return null;
  if (c === CORRUPTION_RULES_COMMENT) {
    return { kind: 'corruption_rules', owner: WB_OWNER.corruption, ownerSlot: 'rules', displayName: c };
  }
  if (c === CORRUPTION_GENERAL_ARCHIVE_COMMENT) {
    return {
      kind: 'corruption_archive_general',
      owner: WB_OWNER.corruption,
      ownerSlot: 'general',
      displayName: c,
    };
  }
  if (c.indexOf(CORRUPTION_ARCHIVE_PREFIX) === 0) {
    var cn = c.slice(CORRUPTION_ARCHIVE_PREFIX.length).trim();
    return {
      kind: 'corruption_archive',
      owner: WB_OWNER.corruption,
      ownerSlot: cn || '未命名',
      displayName: c,
    };
  }
  if (c === AFFECTION_RULES_COMMENT) {
    return { kind: 'affection_rules', owner: WB_OWNER.affection, ownerSlot: 'rules', displayName: c };
  }
  if (c === AFFECTION_GENERAL_ARCHIVE_COMMENT) {
    return {
      kind: 'affection_archive_general',
      owner: WB_OWNER.affection,
      ownerSlot: 'general',
      displayName: c,
    };
  }
  if (c.indexOf(AFFECTION_ARCHIVE_PREFIX) === 0) {
    var an = c.slice(AFFECTION_ARCHIVE_PREFIX.length).trim();
    return {
      kind: 'affection_archive',
      owner: WB_OWNER.affection,
      ownerSlot: an || '未命名',
      displayName: c,
    };
  }
  var mPerson = c.match(/^\[(?:小说)?人物\]\s*(.+)$/);
  if (mPerson) {
    var pn = String(mPerson[1] || '').trim();
    return { kind: 'novel_person', owner: WB_OWNER.novel, ownerSlot: pn, displayName: c };
  }
  var mNovel = c.match(/^\[小说(\w+)\]\s*(.+)$/);
  if (mNovel) {
    var cat = String(mNovel[1] || 'setting').toLowerCase();
    var nn = String(mNovel[2] || '').trim();
    var kind = novelKindFromEntityCategory(cat, cat === 'event' ? 'event' : '');
    return {
      kind: kind,
      owner: WB_OWNER.novel,
      ownerSlot: novelOwnerSlotForKind(kind, nn),
      displayName: c,
    };
  }
  if (c === NOVEL_STYLE_WB_COMMENT) {
    return { kind: 'novel_style', owner: WB_OWNER.novel, ownerSlot: 'style', displayName: c };
  }
  return null;
}

export function isLegacyWorldbookDraft(entries) {
  var list = Array.isArray(entries) ? entries : [];
  if (!list.length) return false;
  for (var i = 0; i < list.length; i++) {
    var e = list[i];
    if (!e || typeof e !== 'object') continue;
    if (!String(e.id || '').trim() || !String(e.kind || '').trim() || !String(e.owner || '').trim()) {
      return true;
    }
  }
  return false;
}
