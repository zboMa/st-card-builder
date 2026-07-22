/**
 * 小说工坊成人/NTL：实体模板、质量门、模式开关（拆自 nsfwSupport）
 */
import { UNMENTIONED } from './schema.mjs';

/** 卡级 NSFW 口味最多叠加条数 */
export var MAX_NSFW_FLAVOR_ITEMS = 5;

/** NSFW 实体 kind */
export var NSFW_ENTITY_KINDS = ['rule', 'place', 'item', 'dynamic', 'taboo', 'consent'];

/** 需挂 attrs.adult 的非人物类型 */
export var ADULT_SIDE_TYPES = ['item', 'location', 'lore', 'faction'];

/** kind → 最低必填字段（丰满门槛） */
export var NSFW_KIND_REQUIREMENTS = {
  rule: ['rules', 'limits', 'consent'],
  place: ['atmosphere', 'triggers', 'limits'],
  item: ['playIdeas', 'triggers', 'limits'],
  dynamic: ['rules', 'playIdeas', 'atmosphere'],
  taboo: ['limits', 'rules'],
  consent: ['consent', 'limits', 'rules'],
};

/** 亲密向关系标签（成人模式骨架/关系补全） */
export var INTIMATE_REL_LABELS = [
  '暧昧', '恋人', '前任', '主从', '禁忌', '性张力', '单恋', '炮友', '师徒暧昧', '对立吸引',
];

/** RAG 成人召回附加词（拼到人名 query 后） */
export var ADULT_RAG_BOOST_TERMS = [
  '身体', '亲密', '情欲', '敏感', '禁忌', '床', '吻', '喘息', '赤裸', '欲望', '娇喘',
];

/** RAG NTL 召回附加词（禁忌张力向，与 NSFW 解耦） */
export var NTL_RAG_BOOST_TERMS = [
  '禁忌', '背德', '权力', '强迫', '掌控', '服从', '越界', '秘密', '胁迫', '不对等',
];

/** 占位判定 */
export function isPlaceholderText(s) {
  var t = String(s == null ? '' : s).trim();
  if (!t) return true;
  if (t === UNMENTIONED) return true;
  if (/^（?原文未提及）?$/.test(t)) return true;
  if (t === '未提及' || t === '无' || t === 'N/A') return true;
  return false;
}

function asStringList(v) {
  if (Array.isArray(v)) {
    return v.map(function(x) { return String(x || '').trim(); }).filter(Boolean);
  }
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
}

function fieldFilled(a, key) {
  var v = a[key];
  if (Array.isArray(v)) return v.length > 0;
  return !isPlaceholderText(v);
}

/** nsfw 实体空 attrs */
export function emptyNsfwEntityAttrs(kind) {
  var k = NSFW_ENTITY_KINDS.indexOf(kind) >= 0 ? kind : 'rule';
  return {
    kind: k,
    rules: [],
    limits: [],
    consent: '',
    triggers: [],
    atmosphere: '',
    playIdeas: [],
    relatedNames: [],
  };
}

/** 规范化 nsfw attrs（合并 AI 返回） */
export function normalizeNsfwEntityAttrs(raw) {
  var base = emptyNsfwEntityAttrs(raw && raw.kind);
  if (!raw || typeof raw !== 'object') return base;
  if (NSFW_ENTITY_KINDS.indexOf(raw.kind) >= 0) base.kind = raw.kind;
  ['rules', 'limits', 'triggers', 'playIdeas', 'relatedNames'].forEach(function(key) {
    var list = asStringList(raw[key]);
    if (list.length) base[key] = list;
  });
  if (raw.consent != null && !isPlaceholderText(raw.consent)) base.consent = String(raw.consent).trim();
  if (raw.atmosphere != null && !isPlaceholderText(raw.atmosphere)) {
    base.atmosphere = String(raw.atmosphere).trim();
  }
  return base;
}

/** 非人物通用成人维空模板（含世界观载体字段） */
export function emptyAdultAttrs() {
  return {
    eroticRole: '',
    atmosphere: '',
    triggers: [],
    limits: [],
    playIdeas: [],
    relatedPersons: [],
    vesselKind: '',
    worldframe: '',
    powerLogic: '',
    costOrRisk: '',
    socialCover: '',
    flavorHooks: [],
    ntlHooks: [],
    inferred: true,
    lastPass: '',
  };
}

/** 规范化 attrs.adult */
export function normalizeAdultAttrs(raw) {
  var base = emptyAdultAttrs();
  if (!raw || typeof raw !== 'object') return base;
  if (raw.eroticRole != null) base.eroticRole = String(raw.eroticRole).trim();
  if (raw.atmosphere != null) base.atmosphere = String(raw.atmosphere).trim();
  if (raw.vesselKind != null) base.vesselKind = String(raw.vesselKind).trim();
  if (raw.worldframe != null) base.worldframe = String(raw.worldframe).trim();
  if (raw.powerLogic != null) base.powerLogic = String(raw.powerLogic).trim();
  if (raw.costOrRisk != null) base.costOrRisk = String(raw.costOrRisk).trim();
  if (raw.socialCover != null) base.socialCover = String(raw.socialCover).trim();
  ['triggers', 'limits', 'playIdeas', 'relatedPersons', 'flavorHooks', 'ntlHooks'].forEach(function(key) {
    var list = asStringList(raw[key]);
    if (list.length) base[key] = list;
  });
  if (raw.inferred === false) base.inferred = false;
  else if (raw.inferred === true) base.inferred = true;
  if (raw.lastPass != null) base.lastPass = String(raw.lastPass).trim();
  return base;
}

/** 合并成人维：填空补全，不抹已有 Limits/角色 */
export function mergeAdultAttrs(prev, next) {
  var a = normalizeAdultAttrs(prev);
  var b = normalizeAdultAttrs(next);
  if (!isPlaceholderText(b.eroticRole)) a.eroticRole = b.eroticRole;
  if (!isPlaceholderText(b.atmosphere)) a.atmosphere = b.atmosphere;
  if (!isPlaceholderText(b.vesselKind)) a.vesselKind = b.vesselKind;
  if (!isPlaceholderText(b.worldframe)) a.worldframe = b.worldframe;
  if (!isPlaceholderText(b.powerLogic)) a.powerLogic = b.powerLogic;
  if (!isPlaceholderText(b.costOrRisk)) a.costOrRisk = b.costOrRisk;
  if (!isPlaceholderText(b.socialCover)) a.socialCover = b.socialCover;
  ['triggers', 'limits', 'playIdeas', 'relatedPersons', 'flavorHooks', 'ntlHooks'].forEach(function(key) {
    var seen = {};
    var out = [];
    (a[key] || []).concat(b[key] || []).forEach(function(x) {
      var s = String(x || '').trim();
      if (!s || seen[s]) return;
      seen[s] = true;
      out.push(s);
    });
    a[key] = out;
  });
  // 一旦出现原文证据标记，inferred=false 优先保留
  if (b.inferred === false) a.inferred = false;
  if (b.lastPass) a.lastPass = b.lastPass;
  return a;
}

/** attrs.adult 是否达到成人门槛（含载体厚度） */
export function isAdultAttrsFilled(adult) {
  var a = normalizeAdultAttrs(adult);
  var roleOk = !isPlaceholderText(a.eroticRole);
  var atmosOk = !isPlaceholderText(a.atmosphere);
  var ideasOk = (a.playIdeas && a.playIdeas.length) || (a.triggers && a.triggers.length);
  var limitsOk = a.limits && a.limits.length > 0;
  var logicOk = !isPlaceholderText(a.powerLogic);
  var vesselOk = !isPlaceholderText(a.vesselKind) || logicOk;
  var personOk = a.relatedPersons && a.relatedPersons.length > 0;
  var costOk = !isPlaceholderText(a.costOrRisk) || !isPlaceholderText(a.socialCover);
  return !!(roleOk && (atmosOk || ideasOk) && limitsOk && vesselOk && logicOk && (personOk || costOk));
}

/** 该类型在成人模式下是否需要 adult 维 */
export function entityNeedsAdultAttrs(ent) {
  if (!ent || !ent.type) return false;
  return ADULT_SIDE_TYPES.indexOf(ent.type) >= 0 || ent.type === 'event';
}

/** NTL 人物 attrs.ntl 空模板 */
export function emptyNtlPersonAttrs() {
  return {
    powerDynamic: '',
    tabooThemes: [],
    coercionHint: '',
    moralConflict: '',
    secrets: [],
    dominantRole: '',     // 主导方/被主导方
    emotionalCost: '',    // 情绪代价
    inferred: true,
    lastPass: '',
  };
}

export function normalizeNtlPersonAttrs(raw) {
  var base = emptyNtlPersonAttrs();
  if (!raw || typeof raw !== 'object') return base;
  if (raw.powerDynamic != null) base.powerDynamic = String(raw.powerDynamic).trim();
  if (raw.coercionHint != null) base.coercionHint = String(raw.coercionHint).trim();
  if (raw.moralConflict != null) base.moralConflict = String(raw.moralConflict).trim();
  if (raw.dominantRole != null) base.dominantRole = String(raw.dominantRole).trim();
  if (raw.emotionalCost != null) base.emotionalCost = String(raw.emotionalCost).trim();
  ['tabooThemes', 'secrets'].forEach(function(key) {
    var list = asStringList(raw[key]);
    if (list.length) base[key] = list;
  });
  if (raw.inferred === false) base.inferred = false;
  else if (raw.inferred === true) base.inferred = true;
  if (raw.lastPass != null) base.lastPass = String(raw.lastPass).trim();
  return base;
}

export function mergeNtlPersonAttrs(prev, next) {
  var a = normalizeNtlPersonAttrs(prev);
  var b = normalizeNtlPersonAttrs(next);
  if (!isPlaceholderText(b.powerDynamic)) a.powerDynamic = b.powerDynamic;
  if (!isPlaceholderText(b.coercionHint)) a.coercionHint = b.coercionHint;
  if (!isPlaceholderText(b.moralConflict)) a.moralConflict = b.moralConflict;
  if (!isPlaceholderText(b.dominantRole)) a.dominantRole = b.dominantRole;
  if (!isPlaceholderText(b.emotionalCost)) a.emotionalCost = b.emotionalCost;
  ['tabooThemes', 'secrets'].forEach(function(key) {
    var seen = {};
    var out = [];
    (a[key] || []).concat(b[key] || []).forEach(function(x) {
      var s = String(x || '').trim();
      if (!s || seen[s]) return;
      seen[s] = true;
      out.push(s);
    });
    a[key] = out;
  });
  if (b.inferred === false) a.inferred = false;
  if (b.lastPass) a.lastPass = b.lastPass;
  return a;
}

export function isNtlPersonFilled(personEntity) {
  if (!personEntity || !personEntity.attrs) return false;
  var ntl = normalizeNtlPersonAttrs(personEntity.attrs.ntl);
  var dynamicOk = !isPlaceholderText(ntl.powerDynamic);
  var themesOk = ntl.tabooThemes && ntl.tabooThemes.length > 0;
  var coercionOk = !isPlaceholderText(ntl.coercionHint);
  var conflictOk = !isPlaceholderText(ntl.moralConflict);
  return !!(dynamicOk && (themesOk || coercionOk || conflictOk));
}

/** 人物 NSFW 推断元数据 */
export function emptyNsfwMeta() {
  return { inferred: true, confidence: 0.4, lastPass: '' };
}

export function normalizeNsfwMeta(raw) {
  var base = emptyNsfwMeta();
  if (!raw || typeof raw !== 'object') return base;
  if (raw.inferred === false) base.inferred = false;
  else if (raw.inferred === true) base.inferred = true;
  if (typeof raw.confidence === 'number' && !isNaN(raw.confidence)) {
    base.confidence = Math.max(0, Math.min(1, raw.confidence));
  }
  if (raw.lastPass != null) base.lastPass = String(raw.lastPass).trim();
  return base;
}

export function mergeNsfwMeta(prev, next) {
  var a = normalizeNsfwMeta(prev);
  var b = normalizeNsfwMeta(next);
  if (b.inferred === false) a.inferred = false;
  if (typeof b.confidence === 'number') {
    a.confidence = Math.max(a.confidence, b.confidence);
  }
  if (b.lastPass) a.lastPass = b.lastPass;
  return a;
}

/** 人物 NSFW_information 是否达到成人丰满门槛 */
export function isNsfwProfileFilled(profile) {
  var n = profile && profile.NSFW_information;
  if (!n || typeof n !== 'object') return false;
  var body = n.body || {};
  var bodyOk = Object.keys(body).some(function(key) {
    return !isPlaceholderText(body[key]);
  });
  var personalityOk = !isPlaceholderText(n.sexual_personality);
  var kinks = (Array.isArray(n.Kinks) && n.Kinks.length)
    || (Array.isArray(n.xp_kinks) && n.xp_kinks.length);
  var limitsOk = Array.isArray(n.Limits) && n.Limits.length > 0;
  return !!(bodyOk && personalityOk && kinks && limitsOk);
}

/** nsfw 实体是否达到成人丰满门槛（按 kind 最低字段） */
export function isNsfwEntityFilled(ent) {
  if (!ent || ent.type !== 'nsfw') return false;
  var content = String(ent.content || '').trim();
  if (content.length < 120) return false;
  var a = normalizeNsfwEntityAttrs(ent.attrs || {});
  var req = NSFW_KIND_REQUIREMENTS[a.kind] || NSFW_KIND_REQUIREMENTS.rule;
  var hit = 0;
  req.forEach(function(key) {
    if (fieldFilled(a, key)) hit++;
  });
  // 至少满足 kind 要求中的 2 项，或旧门槛（rules/limits/consent 任一）
  if (hit >= 2) return true;
  return !!(fieldFilled(a, 'rules') || fieldFilled(a, 'limits') || fieldFilled(a, 'consent'));
}

/**
 * 同步全局 NSFW（adultMode 为唯一主字段；legacy 字段仅旧桶兼容读取）
 * @param {object} state
 * @param {boolean} on
 */
export function setAdultMode(state, on) {
  state.adultMode = !!on;
  return state.adultMode;
}

/** 读取 NSFW（兼容旧桶仅有 legacy 字段） */
export function getAdultMode(state) {
  if (!state) return false;
  if (state.adultMode != null) return !!state.adultMode;
  return !!(state.analyzeIncludeAdult || state.includeAdult || state.styleIncludeNSFW);
}

/** 读取 NTL（禁忌张力层） */
export function getNtlMode(state) {
  return !!(state && state.ntlMode);
}

/** 设置 NTL（与 NSFW 解耦） */
export function setNtlMode(state, on) {
  if (!state) return false;
  state.ntlMode = !!on;
  return state.ntlMode;
}

/**
 * 召回 query 增强：可叠 NSFW + NTL
 * @param {string} baseQuery
 * @param {boolean} adultMode
 * @param {boolean} [ntlMode]
 */
export function boostAdultSearchQuery(baseQuery, adultMode, ntlMode) {
  var q = String(baseQuery || '').trim();
  var extras = [];
  if (adultMode) extras = extras.concat(ADULT_RAG_BOOST_TERMS.slice(0, 6));
  if (ntlMode) extras = extras.concat(NTL_RAG_BOOST_TERMS.slice(0, 5));
  if (!extras.length) return q;
  var boost = extras.join(' ');
  return q ? (q + ' ' + boost) : boost;
}

/** 提示词注入用的模式标志行 */
export function buildContentModeFlags(state) {
  var adult = getAdultMode(state);
  var ntl = getNtlMode(state);
  return '\nAdultMode/NSFW: ' + adult
    + '\nIncludeAdult: ' + adult
    + '\nNtlMode: ' + ntl;
}
