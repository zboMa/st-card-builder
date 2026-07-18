/**
 * 小说工坊成人/NTL：实体模板、质量门、分步推断、召回增强、互喂摘要、状态栏草案
 * NSFW 与 NTL 解耦：可单独开，也可叠加
 */
import { UNMENTIONED } from './schema.mjs';

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

/** 非人物通用成人维空模板 */
export function emptyAdultAttrs() {
  return {
    eroticRole: '',
    atmosphere: '',
    triggers: [],
    limits: [],
    playIdeas: [],
    relatedPersons: [],
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
  ['triggers', 'limits', 'playIdeas', 'relatedPersons'].forEach(function(key) {
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
  ['triggers', 'limits', 'playIdeas', 'relatedPersons'].forEach(function(key) {
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

/** attrs.adult 是否达到成人门槛 */
export function isAdultAttrsFilled(adult) {
  var a = normalizeAdultAttrs(adult);
  var roleOk = !isPlaceholderText(a.eroticRole);
  var atmosOk = !isPlaceholderText(a.atmosphere);
  var ideasOk = (a.playIdeas && a.playIdeas.length) || (a.triggers && a.triggers.length);
  var limitsOk = a.limits && a.limits.length > 0;
  return !!(roleOk && (atmosOk || ideasOk) && limitsOk);
}

/** 该类型在成人模式下是否需要 adult 维 */
export function entityNeedsAdultAttrs(ent) {
  if (!ent || !ent.type) return false;
  return ADULT_SIDE_TYPES.indexOf(ent.type) >= 0;
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
  var bodyOk = n.body && !isPlaceholderText(n.body.overall);
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
 * 同步全局 NSFW 到兼容旧字段（唯一入口在原始资料·全局配置）
 * @param {object} state
 * @param {boolean} on
 */
export function setAdultMode(state, on) {
  var v = !!on;
  state.adultMode = v;
  state.analyzeIncludeAdult = v;
  state.includeAdult = v;
  state.styleIncludeNSFW = v;
  return v;
}

/** 读取 NSFW（兼容旧桶仅有分开关） */
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

/** 成人维 → 可并入世界书 content 的短段 */
export function formatAdultAttrsForContent(adult) {
  var a = normalizeAdultAttrs(adult);
  if (!isAdultAttrsFilled(a) && isPlaceholderText(a.eroticRole) && !(a.playIdeas || []).length) {
    return '';
  }
  var lines = ['【成人向用法】'];
  if (!isPlaceholderText(a.eroticRole)) lines.push('角色定位：' + a.eroticRole);
  if (!isPlaceholderText(a.atmosphere)) lines.push('氛围：' + a.atmosphere);
  if (a.triggers && a.triggers.length) lines.push('触发：' + a.triggers.slice(0, 8).join('、'));
  if (a.playIdeas && a.playIdeas.length) lines.push('玩法：' + a.playIdeas.slice(0, 8).join('、'));
  if (a.limits && a.limits.length) lines.push('界限：' + a.limits.slice(0, 8).join('、'));
  if (a.relatedPersons && a.relatedPersons.length) {
    lines.push('相关人物：' + a.relatedPersons.slice(0, 6).join('、'));
  }
  return lines.length > 1 ? lines.join('\n') : '';
}

/** 从实体库摘人物 NSFW 摘要（文风互喂） */
export function formatPersonNsfwDigest(entities, maxChars) {
  var budget = maxChars || 2500;
  var lines = ['【已有人物 NSFW 摘要（文风须对齐尺度与禁忌）】'];
  var used = lines[0].length;
  (entities || []).filter(function(e) { return e && e.type === 'person'; }).forEach(function(e) {
    var n = e.attrs && e.attrs.profile && e.attrs.profile.NSFW_information;
    if (!n) return;
    var kinks = [].concat(n.Kinks || [], n.xp_kinks || []).slice(0, 6).join('、');
    var limits = (n.Limits || []).slice(0, 6).join('、');
    var meta = e.attrs && e.attrs.nsfwMeta ? normalizeNsfwMeta(e.attrs.nsfwMeta) : null;
    var line = '- ' + e.name
      + (n.sexual_personality && !isPlaceholderText(n.sexual_personality)
        ? ' | 情欲性格:' + String(n.sexual_personality).slice(0, 40) : '')
      + (kinks ? ' | XP:' + kinks : '')
      + (limits ? ' | Limits:' + limits : '')
      + (meta && meta.inferred ? ' | 推断' : '');
    if (used + line.length > budget) return;
    lines.push(line);
    used += line.length;
  });
  if (lines.length < 2) return '';
  return '\n' + lines.join('\n');
}

/** 从实体库摘 nsfw 条目摘要 */
export function formatNsfwEntityDigest(entities, maxChars) {
  var budget = maxChars || 2000;
  var lines = ['【已有 NSFW 世界设定】'];
  var used = lines[0].length;
  (entities || []).filter(function(e) { return e && e.type === 'nsfw'; }).forEach(function(e) {
    var a = normalizeNsfwEntityAttrs(e.attrs || {});
    var line = '- [' + a.kind + '] ' + e.name
      + (e.summary ? ': ' + String(e.summary).slice(0, 60) : '')
      + (a.limits && a.limits.length ? ' | 禁:' + a.limits.slice(0, 3).join('/') : '');
    if (used + line.length > budget) return;
    lines.push(line);
    used += line.length;
  });
  if (lines.length < 2) return '';
  return '\n' + lines.join('\n');
}

/** 物品/地点/设定等 attrs.adult 摘要 */
export function formatAdultSideDigest(entities, maxChars) {
  var budget = maxChars || 2000;
  var lines = ['【已有条目成人向用法（item/location/lore/faction）】'];
  var used = lines[0].length;
  (entities || []).filter(function(e) {
    return entityNeedsAdultAttrs(e) && e.attrs && e.attrs.adult;
  }).forEach(function(e) {
    var a = normalizeAdultAttrs(e.attrs.adult);
    if (isPlaceholderText(a.eroticRole) && !(a.playIdeas || []).length) return;
    var line = '- [' + e.type + '] ' + e.name
      + (a.eroticRole ? ': ' + String(a.eroticRole).slice(0, 50) : '')
      + (a.limits && a.limits.length ? ' | 禁:' + a.limits.slice(0, 3).join('/') : '');
    if (used + line.length > budget) return;
    lines.push(line);
    used += line.length;
  });
  if (lines.length < 2) return '';
  return '\n' + lines.join('\n');
}

/** 合并成人相关摘要块（丰满/文风注入） */
export function buildAdultContextDigests(entities, maxChars) {
  var budget = maxChars || 5000;
  var parts = [
    formatPersonNsfwDigest(entities, Math.floor(budget * 0.4)),
    formatNsfwEntityDigest(entities, Math.floor(budget * 0.3)),
    formatAdultSideDigest(entities, Math.floor(budget * 0.3)),
  ].filter(Boolean);
  return parts.join('');
}

/** 从文风文本抽出 NSFW 指令段（供人物丰满注入） */
export function extractStyleNsfwSection(styleText) {
  var t = String(styleText || '');
  if (!t.trim()) return '';
  var m = t.match(/##\s*NSFW\s*文风指令([\s\S]*?)(?=\n##\s|$)/i);
  if (m && m[1] && m[1].trim()) {
    return '\n【文风 NSFW 指令（人物描写须对齐）】\n' + m[1].trim().slice(0, 3000);
  }
  if (/情欲|身体描写|敏感|NSFW/i.test(t)) {
    return '\n【文风片段（含成人向）】\n' + t.slice(0, 1500);
  }
  return '';
}

/**
 * 分步推断规则（骨架/丰满/关系/抽取）
 * @param {'skeleton'|'enrich'|'relations'|'extract'|'expand'} [phase]
 */
export function buildAdultProgressiveHint(phase) {
  var p = phase || 'enrich';
  var common = '\n【成人模式·分步推断】'
    + '\n优先级：①原文明确事实 ②已有实体/关系互证 ③据性格/外貌/身份/氛围合理虚构。'
    + '\n原文未写成人细节时也须产出可 RP 的草稿，禁止整块「原文未提及」或留空；'
    + '后续步骤会用新信息修订（保留 Limits/已证实事实，覆盖占位）。'
    + '\nLimits/禁忌优先于色情细节；勿编造与原文矛盾的硬剧情。';

  if (p === 'skeleton') {
    return common
      + '\n【本步·骨架】'
      + '\n- person：尽量附 attrs.profile.NSFW_information 初稿 + attrs.nsfwMeta:{inferred,confidence,lastPass:"skeleton"}；'
      + '至少填 body.overall、sexual_personality、Kinks/xp_kinks、Limits（可全推断）。'
      + '\n- item/location/lore/faction：附 attrs.adult={eroticRole,atmosphere,triggers[],limits[],playIdeas[],relatedPersons[],inferred,lastPass:"skeleton"}。'
      + '\n- 必须挖 type=nsfw（kind=rule|place|item|dynamic|taboo|consent），attrs 按 kind 填最低字段。'
      + '\n- 亲密边/亲密 event.attrs.intimate=true。';
  }
  if (p === 'relations') {
    return common
      + '\n【本步·关系】优先补亲密边（' + INTIMATE_REL_LABELS.join('/') + '）；'
      + 'attrs 可含 intimacy/power/taboo；边两端人物若 NSFW 空洞，在 evidence 旁用短注暗示张力（丰满步会写全）。';
  }
  if (p === 'extract') {
    return common
      + '\n【本步·世界书抽取】必须抽 category=nsfw；普通 item/location/setting 也尽量带 attrs.adult；'
      + '可补充完善已有条目的成人维，勿重复空壳。';
  }
  if (p === 'expand') {
    return common
      + '\n【本步·扩展】据召回原文与已有档案修订 NSFW/adult；无原文则据已有字段推断补全。';
  }
  // enrich 默认
  return common
    + '\n【本步·丰满】'
    + '\n- person：写满 NSFW_information；attrs.nsfwMeta.lastPass="enrich"；有原文证据则 inferred=false。'
    + '\n- type=nsfw：按 kind 填满 rules/limits/consent/triggers/atmosphere/playIdeas/relatedNames。'
    + '\n- item/location/lore/faction：写满 attrs.adult，content 可含【成人向用法】指引。'
    + '\n- 参考提示中的【已有人物/NSFW/条目成人向】摘要，保持 XP 与 Limits 一致。';
}

/** 成人模式通用附加块（兼容旧调用；默认 enrich 口径） */
export function buildAdultAnalyzeHintBlock(phase) {
  return buildAdultProgressiveHint(phase || 'enrich')
    + '\n【关系标签参考】' + INTIMATE_REL_LABELS.join('/');
}

/**
 * NTL（禁忌张力）提示块：与 NSFW 解耦，可单独开或叠加
 * @param {'skeleton'|'enrich'|'relations'|'extract'|'expand'|'style'} [phase]
 */
export function buildNtlHintBlock(phase) {
  var p = phase || 'enrich';
  var common = '\n【NTL 模式·禁忌张力（18+，与 NSFW 解耦可叠加）】'
    + '\n覆盖：权力不对等、背德/越界关系、强迫或胁迫氛围、精神操控、秘密与道德冲突、服从/掌控动态。'
    + '\n须写出可 RP 的张力机制与情绪代价；禁止涉及未成年人；勿空喊「很禁忌」。'
    + '\n可与 NSFW 叠加：有身体描写时仍须尊重人物 Limits；NTL 侧重关系与心理张力。';
  if (p === 'skeleton') {
    return common
      + '\n【本步·骨架】关系边优先挖权力差/禁忌/胁迫张力；'
      + 'person/summary 可点明禁忌坐标；lore/faction 可注潜规则；event 可标道德冲突。'
      + '\n可选 attrs.ntl={ powerDynamic, tabooThemes[], coercionHint, moralConflict, secrets[] }。';
  }
  if (p === 'relations') {
    return common
      + '\n【本步·关系】补全掌控/服从/背德/禁忌吸引等边；attrs 填 intimacy/power/taboo 及张力说明。';
  }
  if (p === 'extract' || p === 'expand') {
    return common
      + '\n【本步·世界书】条目 content 写清禁忌规则、越界代价、谁掌控局面；可附 attrs.ntl。';
  }
  if (p === 'style') {
    return common
      + '\n【本步·文风】另开「## NTL 文风指令」：压迫感节奏、服从/反抗语气、秘密与越界描写粒度、禁用轻浮消解禁忌。';
  }
  return common
    + '\n【本步·丰满/扩展】写清权力结构、禁忌主题、道德冲突与秘密；'
    + '可选 attrs.ntl；与 NSFW 并存时 Limits 仍优先。';
}

/**
 * 按全局开关组装 NSFW/NTL 提示块
 * @param {object} state
 * @param {string} [phase]
 */
export function buildModeHintBlocks(state, phase) {
  var parts = [];
  if (getAdultMode(state)) parts.push(buildAdultProgressiveHint(phase));
  if (getNtlMode(state)) parts.push(buildNtlHintBlock(phase));
  return parts.join('');
}

/** 丰满队列优先级：人物 NSFW → nsfw 实体 → 缺 adult 的条目 → 其他 */
export function adultEnrichPriority(ent) {
  if (!ent) return 9;
  if (ent.type === 'person') {
    var prof = ent.attrs && ent.attrs.profile;
    return isNsfwProfileFilled(prof) ? 3 : 0;
  }
  if (ent.type === 'nsfw') return isNsfwEntityFilled(ent) ? 3 : 1;
  if (entityNeedsAdultAttrs(ent)) {
    return isAdultAttrsFilled(ent.attrs && ent.attrs.adult) ? 3 : 2;
  }
  return 4;
}

/**
 * 附录1 NSFW → 状态栏身体变量草案（不自动写入，供确认）
 * @returns {{ paths: { path: string, label: string, value: string }[], note: string }}
 */
export function buildStatusBarNsfwDraftFromEntities(entities, charName) {
  var persons = (entities || []).filter(function(e) { return e && e.type === 'person'; });
  var ent = null;
  if (charName) {
    var want = String(charName).trim().toLowerCase();
    ent = persons.find(function(e) {
      return String(e.name || '').toLowerCase() === want
        || (e.aliases || []).some(function(a) { return String(a).toLowerCase() === want; });
    }) || null;
  }
  if (!ent) ent = persons[0] || null;
  if (!ent || !ent.attrs || !ent.attrs.profile) {
    return { paths: [], note: '无可用人物档案（需已丰满且含 NSFW_information）' };
  }
  var n = ent.attrs.profile.NSFW_information || {};
  var body = n.body || {};
  var paths = [];
  function add(path, label, value) {
    var v = String(value == null ? '' : value).trim();
    if (!v || isPlaceholderText(v)) return;
    paths.push({ path: path, label: label, value: v.slice(0, 200) });
  }
  add('stat.nsfw_breasts', '双乳', body.breasts);
  add('stat.nsfw_vagina', '小穴', body.genitals);
  add('stat.nsfw_body', '身体总览', body.overall);
  add('stat.nsfw_waist', '腰臀', body.waist_hips);
  add('stat.nsfw_other', '其他特征', body.other_features);
  add('stat.nsfw_personality', '情欲性格', n.sexual_personality);
  add('stat.nsfw_contrast', '反差', n.contrast);
  add('stat.nsfw_inner', '内心', n.inner_erotic_thoughts);
  if (Array.isArray(n.erogenous_zones) && n.erogenous_zones.length) {
    add('stat.nsfw_erogenous', '敏感带', n.erogenous_zones.slice(0, 8).join('、'));
  }
  if (Array.isArray(n.Kinks) && n.Kinks.length) {
    add('stat.nsfw_kinks', '性癖', n.Kinks.slice(0, 8).join('、'));
  } else if (Array.isArray(n.xp_kinks) && n.xp_kinks.length) {
    add('stat.nsfw_kinks', '性癖', n.xp_kinks.slice(0, 8).join('、'));
  }
  if (Array.isArray(n.Limits) && n.Limits.length) {
    add('stat.nsfw_limits', '界限', n.Limits.slice(0, 8).join('、'));
  }
  var srt = n.Sex_related_traits || {};
  add('stat.nsfw_experience', '性经验', srt.experiences);
  add('stat.nsfw_role', '性角色', srt.sexual_role);
  return {
    paths: paths,
    note: paths.length
      ? ('来自人物「' + ent.name + '」· ' + paths.length + ' 条草案（需在状态栏确认后写入）')
      : 'NSFW 字段多为占位，请先丰满人物',
    characterName: ent.name,
  };
}
