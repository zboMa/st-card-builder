/**
 * 小说工坊成人/NTL：实体模板、质量门、分步推断、召回增强、互喂摘要、状态栏草案、口味预设
 * NSFW 与 NTL 解耦：可单独开，也可叠加
 *
 * 调色盘三层架构：
 *   第一层·角色核心调色盘（always）→ schema.mjs: persona_layers / tension_pairs / core_desire
 *   第二层·NSFW 口味（叠加）→ nsfwFlavorItems 多选（最多 5，首项为主调色盘）→ desire_palette / …
 *   第三层·NTL 禁忌层（可选叠加）→ ntlTabooType 预设 → 特定禁忌类别的张力引导
 */
import { UNMENTIONED } from './schema.mjs';
import {
  NSFW_FLAVOR_DEFAULT_MIN_CHARS,
  NSFW_FLAVOR_ENRICHMENT,
  FLAVOR_SHARED_DIMENSIONS,
  applyFlavorEnrichment,
  collectFlavorEnrichment,
  evaluateFlavorRichness,
  extractFlavorRichnessText,
  buildFlavorExpandSystemPrompt,
  buildFlavorExpandUserPrompt,
  compactCharCount,
} from './nsfwFlavorEnrichment.mjs';
import {
  NTL_TABOO_DEFAULT_MIN_CHARS,
  NTL_TABOO_ENRICHMENT,
  NTL_SHARED_DIMENSIONS,
  applyNtlTabooEnrichment,
  collectNtlEnrichment,
  evaluateNtlRichness,
  extractNtlRichnessText,
  buildNtlExpandSystemPrompt,
  buildNtlExpandUserPrompt,
  buildNtlTabooHintFromTypes,
} from './ntlTabooEnrichment.mjs';

export {
  NSFW_FLAVOR_DEFAULT_MIN_CHARS,
  NSFW_FLAVOR_ENRICHMENT,
  FLAVOR_SHARED_DIMENSIONS,
  collectFlavorEnrichment,
  evaluateFlavorRichness,
  extractFlavorRichnessText,
  buildFlavorExpandSystemPrompt,
  buildFlavorExpandUserPrompt,
  compactCharCount,
  NTL_TABOO_DEFAULT_MIN_CHARS,
  NTL_TABOO_ENRICHMENT,
  NTL_SHARED_DIMENSIONS,
  collectNtlEnrichment,
  evaluateNtlRichness,
  extractNtlRichnessText,
  buildNtlExpandSystemPrompt,
  buildNtlExpandUserPrompt,
  buildNtlTabooHintFromTypes,
};

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

/**
 * NSFW 口味预设：21 种，分三组
 *   情绪基调（8）：纯爱/甜蜜/日常/救赎/恣意/虐恋/暗黑/绝望
 *   关系动态（8）：调教/叛逆/温柔支配/臣服/狩猎/引导/沦陷/敌对
 *   特殊风味（5）：惩戒/羞耻/架空/本能/反差
 * 可多选最多 5 项；首项为主调色盘，其余叠加 focus/avoid 与用户 note
 */
export var NSFW_FLAVOR_PRESETS = {
  // ======== 第一组：情绪基调 ========
  vanilla: {
    group: '情绪基调',
    label: '纯爱向',
    description: '情感优先，温柔细腻，强调 consent 与 aftercare',
    palette: { temperature: '暖', texture: '棉布', primary_intensity_default: 0.5, accent_intensity_default: 0.6 },
    focus: ['emotional_depth', 'consent', 'aftercare', 'tenderness', 'trust'],
    avoid: ['强制', '羞辱', '血腥', '疼痛超出角色 Limits'],
  },
  sweet: {
    group: '情绪基调',
    label: '甜蜜向',
    description: '撒娇宠溺，互相确认爱意，每一下触碰都在说喜欢你',
    palette: { temperature: '暖甜', texture: '棉花糖', primary_intensity_default: 0.4, accent_intensity_default: 0.5 },
    focus: ['spoiling', 'affection', 'playful', 'mutual_adoration', 'giggling'],
    avoid: ['冷漠', '若即若离', '情感虐待', '欲擒故纵'],
  },
  slice_of_life: {
    group: '情绪基调',
    label: '日常向',
    description: '自然发生，松弛感，幽默，生活气息——不是每场性都需要特别的理由',
    palette: { temperature: '暖偏凉', texture: '棉麻', primary_intensity_default: 0.4, accent_intensity_default: 0.3 },
    focus: ['casual_intimacy', 'humor', 'comfort', 'familiarity', 'domestic'],
    avoid: ['过度戏剧化', '强行紧张', '脱离日常人设'],
  },
  healing: {
    group: '情绪基调',
    label: '救赎向',
    description: '互相治愈，创伤后重建信任，每一次触碰都在说「你可以放心」',
    palette: { temperature: '温→暖', texture: '温水', primary_intensity_default: 0.3, accent_intensity_default: 0.6 },
    focus: ['healing', 'trust_building', 'past_trauma', 'gentle_pacing', 'emotional_safety'],
    avoid: ['急于推进', '无视对方的退缩信号', '用性代替沟通'],
  },
  intense: {
    group: '情绪基调',
    label: '恣意向',
    description: '高密度情欲描写，身体反应与感官细节压倒一切',
    palette: { temperature: '炽热', texture: '丝绸', primary_intensity_default: 1.0, accent_intensity_default: 0.8 },
    focus: ['sensory_details', 'body_reactions', 'loss_of_control', 'overwhelm', 'climax_buildup'],
    avoid: ['油腻模板', '同义堆砌', '忽略心理层'],
  },
  angst: {
    group: '情绪基调',
    label: '虐恋向',
    description: '情感痛苦与身体的交织，救赎与宿命——痛并需要着',
    palette: { temperature: '冷→偶尔炽热', texture: '碎玻璃', primary_intensity_default: 0.7, accent_intensity_default: 0.9 },
    focus: ['emotional_pain', 'redemption', 'fate', 'self_destruction', 'healing_through_pain'],
    avoid: ['无代价的伤害', '美化暴力', '忽略情感后坐力'],
  },
  dark: {
    group: '情绪基调',
    label: '暗黑向',
    description: '道德模糊，胁迫氛围，情感撕裂，每一次接近都是心理代价',
    palette: { temperature: '冷', texture: '刀刃', primary_intensity_default: 0.9, accent_intensity_default: 0.7 },
    focus: ['moral_ambiguity', 'coercion_atmosphere', 'emotional_cost', 'guilt', 'powerlessness'],
    avoid: ['轻浮消解禁忌', '不经铺垫的转折', '美化伤害'],
  },
  despair: {
    group: '情绪基调',
    label: '绝望向',
    description: '深渊中的性——用身体确认自己还活着，自毁与最后的挣扎',
    palette: { temperature: '冰→短暂的烫', texture: '锈铁', primary_intensity_default: 0.8, accent_intensity_default: 0.9 },
    focus: ['existential_despair', 'self_destruction', 'last_resort', 'numbness_breaking', 'hollow_after'],
    avoid: ['浪漫化自毁', '忽略心理后果', '把绝望写成中二'],
  },

  // ======== 第二组：关系动态 ========
  domination: {
    group: '关系动态',
    label: '调教向',
    description: '权力交换，仪式感，渐进训练，心理转变',
    palette: { temperature: '温→热', texture: '皮革', primary_intensity_default: 0.8, accent_intensity_default: 0.5 },
    focus: ['power_exchange', 'rules', 'progression', 'psychological_transformation', 'ritual'],
    avoid: ['无铺垫直接硬来', '忽略安全词', '超出 Limits 的极端'],
  },
  brat: {
    group: '关系动态',
    label: '叛逆向',
    description: '表面反抗实则期待被压制——嘴硬身体诚实，每一次挑衅都是邀请',
    palette: { temperature: '热', texture: '磨砂皮', primary_intensity_default: 0.7, accent_intensity_default: 0.8 },
    focus: ['defiance', 'taming', 'sass_backfire', 'teasing', 'power_struggle_to_submission'],
    avoid: ['真的愤怒', '完全压制没有过程', '忽视 brat 的主动性魅力'],
  },
  gentle_dom: {
    group: '关系动态',
    label: '温柔支配',
    description: '以照顾之名行掌控之实——绑好绳子先问疼吗，命令用商量的语气',
    palette: { temperature: '恒温', texture: '绒面革', primary_intensity_default: 0.6, accent_intensity_default: 0.7 },
    focus: ['care_as_control', 'gentle_firmness', 'praise', 'safety', 'trust_based_power'],
    avoid: ['冷暴力', '羞辱', '命令式语气', '忽视被支配方的反馈'],
  },
  service: {
    group: '关系动态',
    label: '臣服向',
    description: '快感来自让对方满足——奉献、崇拜、以对方的愉悦为自己的成就',
    palette: { temperature: '暖', texture: '丝绒', primary_intensity_default: 0.5, accent_intensity_default: 0.8 },
    focus: ['devotion', 'worship', 'selfless_service', 'pleasure_in_giving', 'humility'],
    avoid: ['强迫服务', '自我否定', '把奉献写成无自尊'],
  },
  pursuit: {
    group: '关系动态',
    label: '狩猎向',
    description: '追逐与被追逐，猫鼠游戏，张力来自距离感——靠近一步退半步',
    palette: { temperature: '温→热→凉交替', texture: '羽毛', primary_intensity_default: 0.6, accent_intensity_default: 0.7 },
    focus: ['chase', 'tease', 'push_pull', 'anticipation', 'delayed_gratification'],
    avoid: ['直接扑倒', '省略追逐过程', '单方面追逐无互动'],
  },
  seduction: {
    group: '关系动态',
    label: '引导向',
    description: '引诱对方一步步堕落或觉醒——innocence 被侵蚀的过程比结果更迷人',
    palette: { temperature: '凉→渐热', texture: '薄纱', primary_intensity_default: 0.5, accent_intensity_default: 0.9 },
    focus: ['corruption', 'awakening', 'stepped_temptation', 'innocence_fading', 'point_of_no_return'],
    avoid: ['跳过快进', '对方毫无挣扎', '把引导写成单纯操纵'],
  },
  denial_surrender: {
    group: '关系动态',
    label: '沦陷向',
    description: '抗拒→动摇→崩溃→沉溺，完整的心理弧光——投降的那一秒值得一千字',
    palette: { temperature: '冷→爆热→温', texture: '融化的冰', primary_intensity_default: 0.6, accent_intensity_default: 0.9 },
    focus: ['resistance', 'crumbling', 'surrender', 'internal_conflict', 'relief_after_yielding'],
    avoid: ['直接放弃抵抗', '没有内心挣扎', '沉溺后没有情绪余波'],
  },
  enemies: {
    group: '关系动态',
    label: '敌对向',
    description: '明明该恨你却想要你——每一寸靠近都带着刀，亲密的暴力美学',
    palette: { temperature: '冷+灼热点', texture: '淬火的钢', primary_intensity_default: 0.9, accent_intensity_default: 0.8 },
    focus: ['hatred_and_desire', 'roughness', 'conflicted', 'verbal_hostility', 'reluctant_care'],
    avoid: ['突然变甜', '消解敌对张力', '暴力无上下文'],
  },

  // ======== 第三组：特殊风味 ========
  discipline: {
    group: '特殊风味',
    label: '惩戒向',
    description: '规则→违规→惩罚→安抚的完整闭环，仪式感与情感修复同等重要',
    palette: { temperature: '冷→温', texture: '竹', primary_intensity_default: 0.7, accent_intensity_default: 0.5 },
    focus: ['rules', 'transgression', 'punishment', 'atonement', 'comfort_after_punish'],
    avoid: ['只罚不安抚', '惩罚无规则前提下', '忽视事后情感'],
  },
  shame: {
    group: '特殊风味',
    label: '羞耻向',
    description: '暴露与羞辱心理——脸红的细节、躲闪的眼神、说不出口的话，比身体反应更重',
    palette: { temperature: '忽冷忽热', texture: '薄冰', primary_intensity_default: 0.6, accent_intensity_default: 0.8 },
    focus: ['embarrassment', 'exposure', 'blushing', 'verbal_teasing', 'shame_arousal_loop'],
    avoid: ['只羞辱不安抚', '践踏自尊无底线', '忽略羞耻后的情感需求'],
  },
  fantasy: {
    group: '特殊风味',
    label: '架空向',
    description: '非人/奇幻种族/吸血鬼/妖魔/异种族——设定驱动的情欲，借用设定特性创作独特体验',
    palette: { temperature: '变幻', texture: '星尘', primary_intensity_default: 0.5, accent_intensity_default: 0.7 },
    focus: ['species_specific_traits', 'worldbuilding_eroticism', 'non_human_bodies', 'magical_intimacy', 'otherness'],
    avoid: ['写成人形只换皮', '忽略种族设定', '把架空当成标签敷衍'],
  },
  primal: {
    group: '特殊风味',
    label: '本能向',
    description: '兽化/返祖/本能压制——理性退场，只剩冲动、气味、原始的占有与臣服',
    palette: { temperature: '原始的热', texture: '毛皮+汗', primary_intensity_default: 0.9, accent_intensity_default: 0.6 },
    focus: ['instinct', 'feral', 'scent_marking', 'raw_power', 'rationality_losing'],
    avoid: ['回归理性太快', '用社交规范约束', '写成普通野兽行为'],
  },
  contrast: {
    group: '特殊风味',
    label: '反差向',
    description: '表面人设与情欲表现强烈错位——清冷/端庄/强势外壳下的失控、乖顺或淫靡；张力来自「不该这样」',
    palette: { temperature: '冷外热内', texture: '西装内里的汗', primary_intensity_default: 0.7, accent_intensity_default: 0.85 },
    focus: ['persona_vs_desire', 'public_vs_private', 'reluctant_reveal', 'shameful_enjoyment', 'identity_crack'],
    avoid: ['无铺垫的突然崩人设', '把反差写成单纯双标脸谱', '忽略事后自我厌恶或沉溺'],
  },
};

applyFlavorEnrichment(NSFW_FLAVOR_PRESETS);

export var NSFWFLAVOR_IDS = Object.keys(NSFW_FLAVOR_PRESETS);

/** NTL 禁忌类型：不只是"背德/权力差"，而是具体的禁忌方向（含百破） */
export var NTL_TABOO_TYPES = {
  age_gap: { label: '年龄差', description: '成熟度不对等带来的自然张力' },
  status_gap: { label: '身份差', description: '师生/医患/僧俗/上下级等身份边界' },
  emotional_forbidden: { label: '情感禁忌', description: '爱上不该爱的人：朋友伴侣/仇人之子/已故之人的影子' },
  moral_conflict: { label: '道德冲突', description: '明知被利用但无法自拔/明知是错但停不下来' },
  situational: { label: '情境禁忌', description: '公共场所/危险环境下的亲密，刺激来自场景而非关系' },
  power_coercion: { label: '权力胁迫', description: '直接的权力压迫与服从（原 NTL 核心）' },
  secret_affair: { label: '隐秘关系', description: '不能公开的地下关系，偷情/瞒着所有人' },
  redemption_captor: { label: '俘获/救赎', description: '敌对关系中被对方吸引（斯德哥尔摩/反向救赎）' },
  yuri_destruction: {
    label: '百破',
    description: '百合破坏：原有或潜在的女女亲密/爱恋被介入、瓦解、侵占或自我崩解；张力来自「本可完整的百合被撕开」',
  },
};

applyNtlTabooEnrichment(NTL_TABOO_TYPES);

export var NTL_TABOO_IDS = Object.keys(NTL_TABOO_TYPES);

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

/** 从实体库摘人物 NTL 摘要（文风互喂） */
export function formatPersonNtlDigest(entities, maxChars) {
  var budget = maxChars || 2000;
  var lines = ['【已有人物 NTL 摘要（禁忌张力须对齐）】'];
  var used = lines[0].length;
  (entities || []).filter(function(e) { return e && e.type === 'person'; }).forEach(function(e) {
    var ntl = normalizeNtlPersonAttrs(e.attrs && e.attrs.ntl);
    if (isPlaceholderText(ntl.powerDynamic) && !ntl.tabooThemes.length) return;
    var line = '- ' + e.name
      + (ntl.powerDynamic && !isPlaceholderText(ntl.powerDynamic)
        ? ' | 权力动态:' + String(ntl.powerDynamic).slice(0, 40) : '')
      + (ntl.tabooThemes.length ? ' | 禁忌:' + ntl.tabooThemes.slice(0, 4).join('/') : '')
      + (ntl.coercionHint && !isPlaceholderText(ntl.coercionHint)
        ? ' | 胁迫:' + String(ntl.coercionHint).slice(0, 30) : '')
      + (ntl.dominantRole ? ' | 角色:' + ntl.dominantRole : '')
      + (ntl.inferred ? ' | 推断' : '');
    if (used + line.length > budget) return;
    lines.push(line);
    used += line.length;
  });
  if (lines.length < 2) return '';
  return '\n' + lines.join('\n');
}

/** 合并成人相关摘要块（丰满/文风注入）；ntlMode 时包含 NTL 人物摘要 */
export function buildAdultContextDigests(entities, maxChars, ntlMode) {
  var budget = maxChars || 5000;
  var ntlBudget = ntlMode ? Math.floor(budget * 0.2) : 0;
  var mainBudget = budget - ntlBudget;
  var parts = [
    formatPersonNsfwDigest(entities, Math.floor(mainBudget * 0.4)),
    formatNsfwEntityDigest(entities, Math.floor(mainBudget * 0.25)),
    formatAdultSideDigest(entities, Math.floor(mainBudget * 0.25)),
    ntlMode ? formatPersonNtlDigest(entities, ntlBudget) : null,
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
      + '\nperson.attrs.ntl={ powerDynamic, tabooThemes[], coercionHint, moralConflict, secrets[], dominantRole, emotionalCost, inferred, lastPass:"skeleton" }。';
  }
  if (p === 'relations') {
    return common
      + '\n【本步·关系】补全掌控/服从/背德/禁忌吸引等边；attrs 填 intimacy/power/taboo 及张力说明。'
      + '\n同时回写关联人物能 attrs.ntl（至少填 powerDynamic 与 tabooThemes）。';
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
    + 'person.attrs.ntl 填满 powerDynamic/coercionHint/moralConflict/dominantRole/emotionalCost/secrets；'
    + '与 NSFW 并存时 Limits 仍优先。';
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

/** 丰满队列优先级：人物 NSFW → nsfw 实体 → 缺 adult 的条目 → 缺 NTL 的人物 → 其他 */
export function adultEnrichPriority(ent, ntlMode) {
  if (!ent) return 9;
  if (ent.type === 'person') {
    var prof = ent.attrs && ent.attrs.profile;
    var nsfwOk = isNsfwProfileFilled(prof);
    var ntlNeeded = ntlMode && !isNtlPersonFilled(ent);
    if (!nsfwOk) return 0;      // 最优先：缺 NSFW
    if (ntlNeeded) return 1;    // 次优先：缺 NTL
    return 3;
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

/**
 * 附录 attrs.ntl → 状态栏禁忌张力变量草案（不自动写入）
 * @returns {{ paths: { path: string, label: string, value: string }[], note: string, characterName?: string }}
 */
export function buildStatusBarNtlDraftFromEntities(entities, charName) {
  var persons = (entities || []).filter(function(e) { return e && e.type === 'person'; });
  var ent = null;
  if (charName) {
    var want = String(charName).trim().toLowerCase();
    ent = persons.find(function(e) {
      return String(e.name || '').toLowerCase() === want
        || (e.aliases || []).some(function(a) { return String(a).toLowerCase() === want; });
    }) || null;
  }
  if (!ent) {
    ent = persons.find(function(e) { return isNtlPersonFilled(e); }) || persons[0] || null;
  }
  if (!ent || !ent.attrs || !ent.attrs.ntl) {
    return { paths: [], note: '无可用人物 NTL 档案（需已丰满且含 attrs.ntl）' };
  }
  var n = normalizeNtlPersonAttrs(ent.attrs.ntl);
  var paths = [];
  function add(path, label, value) {
    var v = String(value == null ? '' : value).trim();
    if (!v || isPlaceholderText(v)) return;
    paths.push({ path: path, label: label, value: v.slice(0, 200) });
  }
  add('stat.ntl_power', '权力动态', n.powerDynamic);
  add('stat.ntl_coercion', '胁迫提示', n.coercionHint);
  add('stat.ntl_moral', '道德冲突', n.moralConflict);
  add('stat.ntl_role', '主导角色', n.dominantRole);
  add('stat.ntl_cost', '情绪代价', n.emotionalCost);
  if (Array.isArray(n.tabooThemes) && n.tabooThemes.length) {
    add('stat.ntl_themes', '禁忌主题', n.tabooThemes.slice(0, 8).join('、'));
  }
  if (Array.isArray(n.secrets) && n.secrets.length) {
    add('stat.ntl_secrets', '秘密', n.secrets.slice(0, 8).join('、'));
  }
  return {
    paths: paths,
    note: paths.length
      ? ('来自人物「' + ent.name + '」NTL · ' + paths.length + ' 条草案（需在状态栏确认后写入）')
      : 'NTL 字段多为占位，请先丰满人物禁忌维',
    characterName: ent.name,
  };
}

/**
 * 规范化口味列表：[{ id, note }]，去重、校验、截断至 MAX；
 * 若列表空且有旧版单字段 nsfwFlavor，则迁移为一项。
 */
export function normalizeNsfwFlavorItems(rawItems, legacyFlavorId) {
  var out = [];
  var seen = Object.create(null);
  var list = Array.isArray(rawItems) ? rawItems : [];
  list.forEach(function(it) {
    if (!it) return;
    var id = typeof it === 'string' ? it : String(it.id || '').trim();
    if (!id || NSFWFLAVOR_IDS.indexOf(id) < 0 || seen[id]) return;
    seen[id] = true;
    var note = typeof it === 'string' ? '' : String(it.note == null ? '' : it.note).trim();
    out.push({ id: id, note: note });
  });
  if (!out.length) {
    var legacy = String(legacyFlavorId || '').trim();
    if (legacy && NSFWFLAVOR_IDS.indexOf(legacy) >= 0) {
      out.push({ id: legacy, note: '' });
    }
  }
  if (out.length > MAX_NSFW_FLAVOR_ITEMS) out = out.slice(0, MAX_NSFW_FLAVOR_ITEMS);
  return out;
}

/** 主口味 id（首项），兼容旧单字段读取 */
export function getNsfwFlavor(state) {
  var items = getNsfwFlavorItems(state);
  if (items.length) return items[0].id;
  return (state && state.nsfwFlavor) || '';
}

export function getNsfwFlavorItems(state) {
  if (!state) return [];
  return normalizeNsfwFlavorItems(state.nsfwFlavorItems, state.nsfwFlavor);
}

/** 写入口味列表，并同步主字段 nsfwFlavor = 首项 id */
export function setNsfwFlavorItems(state, items) {
  var next = normalizeNsfwFlavorItems(items, '');
  state.nsfwFlavorItems = next.map(function(it) {
    return { id: it.id, note: it.note || '' };
  });
  state.nsfwFlavor = next.length ? next[0].id : '';
  return getNsfwFlavorItems(state);
}

/** 兼容旧 API：设为主口味（若已在列表中则移到首位，否则替换为单项） */
export function setNsfwFlavor(state, flavorId) {
  var id = NSFWFLAVOR_IDS.indexOf(flavorId) >= 0 ? flavorId : '';
  if (!id) {
    state.nsfwFlavorItems = [];
    state.nsfwFlavor = '';
    return '';
  }
  var cur = getNsfwFlavorItems(state).filter(function(it) { return it.id !== id; });
  cur.unshift({ id: id, note: '' });
  setNsfwFlavorItems(state, cur);
  return state.nsfwFlavor;
}

/** 获取指定口味的调色盘参数，无口味时返回 null */
export function getFlavorPalette(flavorId) {
  var f = NSFW_FLAVOR_PRESETS[flavorId];
  return f ? f.palette : null;
}

/**
 * NTL 禁忌类型管理（多选）
 */
export function getNtlTabooTypes(state) {
  return (state && Array.isArray(state.ntlTabooTypes)) ? state.ntlTabooTypes.slice() : [];
}

export function setNtlTabooTypes(state, types) {
  var list = Array.isArray(types) ? types.filter(function(t) { return NTL_TABOO_IDS.indexOf(t) >= 0; }) : [];
  state.ntlTabooTypes = list;
  return list.slice();
}

export function addNtlTabooType(state, type) {
  var list = getNtlTabooTypes(state);
  if (NTL_TABOO_IDS.indexOf(type) >= 0 && list.indexOf(type) < 0) {
    list.push(type);
    state.ntlTabooTypes = list;
  }
  return list.slice();
}

/**
 * 由口味条目列表构建注入块（供卡侧 / 小说侧共用）
 * 对齐恶堕：必写维度 + 写作指南 + 反模式 + 密度硬约束
 * @param {Array<{id:string,note?:string}>} items
 * @param {{ presets?: object, intro?: string, footer?: string }} [opts]
 */
export function buildNsfwFlavorHintFromItems(items, opts) {
  opts = opts || {};
  var presets = opts.presets || NSFW_FLAVOR_PRESETS;
  var list = normalizeNsfwFlavorItems(items, '');
  if (!list.length) return '';

  var focusSeen = Object.create(null);
  var avoidSeen = Object.create(null);
  var focusAll = [];
  var avoidAll = [];
  var lines = [];
  var collected = collectFlavorEnrichment(list, presets);

  if (list.length === 1) {
    var f0 = presets[list[0].id];
    if (!f0) return '';
    lines.push('\n【NSFW 口味·' + f0.label + '·丰满写作规范】');
  } else {
    lines.push('\n【NSFW 口味组合·丰满写作规范】（首项为主调色盘）');
  }
  if (opts.intro) lines.push(opts.intro);

  list.forEach(function(it, idx) {
    var f = presets[it.id];
    if (!f) return;
    var notePart = it.note ? ('；用户补充：' + it.note) : '';
    lines.push((idx + 1) + '. ' + f.label + '：' + f.description + notePart
      + (idx === 0 ? '（主调色盘）' : '（叠加）'));
    if (f.writingGuide) lines.push('   写法：' + f.writingGuide);
    (f.focus || []).forEach(function(x) {
      if (!focusSeen[x]) { focusSeen[x] = true; focusAll.push(x); }
    });
    (f.avoid || []).forEach(function(x) {
      if (!avoidSeen[x]) { avoidSeen[x] = true; avoidAll.push(x); }
    });
  });

  var primary = presets[list[0].id];
  if (primary && primary.palette) {
    var p = primary.palette;
    lines.push('主调色盘参考：温度=' + p.temperature + ' | 触感=' + p.texture
      + ' | 主色强度=' + p.primary_intensity_default + ' | 对比色强度=' + p.accent_intensity_default);
  }

  lines.push('【必写维度·须写透】');
  FLAVOR_SHARED_DIMENSIONS.forEach(function(dim, i) {
    lines.push((i + 1) + ') ' + dim.label);
  });
  collected.mustCover.forEach(function(lab) {
    lines.push('- ' + lab);
  });

  if (collected.writingGuides.length) {
    lines.push('【写作指南】');
    collected.writingGuides.forEach(function(g) { lines.push('- ' + g); });
  }
  if (focusAll.length) lines.push('重点标签：' + focusAll.join(' / '));
  var avoidMerged = avoidAll.concat(collected.antiPatterns || []);
  if (avoidMerged.length) lines.push('禁止/避免：' + avoidMerged.join(' / '));
  lines.push('【丰满硬约束】成人相关正文去空白后≥' + collected.densityHint
    + '字；禁止提纲、空话、（待填充）、标签堆砌、一笔带过；须落到具体心理、身体反应、关系动态、边界与事后余波。');
  if (opts.footer) lines.push(opts.footer);
  return lines.join('\n');
}

/**
 * 构建 NSFW 口味注入块：告诉 AI 按什么风格/重点写 NSFW 内容
 */
export function buildNsfwFlavorHint(state) {
  if (!getAdultMode(state)) return '';
  return buildNsfwFlavorHintFromItems(getNsfwFlavorItems(state));
}

/**
 * 构建 NTL 禁忌类型注入块：必写维度 + 指南 + 硬约束（对齐口味丰满）
 */
export function buildNtlTabooHint(state) {
  if (!getNtlMode(state)) return '';
  var types = getNtlTabooTypes(state);
  if (!types.length) return '';
  return buildNtlTabooHintFromTypes(types, { tabooTypes: NTL_TABOO_TYPES });
}

/**
 * 构建调色盘引导块（角色核心层 + NSFW 口味层），注入到人物生成/扩展 prompt
 * @param {{ includeAdult?: boolean }} [opts] includeAdult=false 时仅核心层（主角管道）
 */
export function buildPaletteGuidanceBlock(state, opts) {
  opts = opts || {};
  var includeAdult = opts.includeAdult !== false;
  var parts = [];
  parts.push('\n【调色盘生成引导】');
  parts.push('不要列属性清单。用「调色盘」方式塑造人物：');
  parts.push('1. persona_layers：写五层——陌生人看到什么/朋友看到什么/亲密者看到什么/压力下露出什么/自己不愿承认什么。');
  parts.push('2. tension_pairs：至少一对内在矛盾（例如「掌控欲 vs 对被抛弃的恐惧」→ 用制造依赖来确保对方不离开）。每对写清 trait_a、trait_b、resolution（这两股力如何共存）。');
  parts.push('3. core_desire：一句话。角色最根本要什么（被认可/被需要/自由/安全/复仇/归属/遗忘）。');

  var items = includeAdult && getAdultMode(state) ? getNsfwFlavorItems(state) : [];
  if (items.length) {
    var collected = collectFlavorEnrichment(items, NSFW_FLAVOR_PRESETS);
    var labels = items.map(function(it) {
      var f = NSFW_FLAVOR_PRESETS[it.id];
      var base = f ? (f.label + '（' + f.description + '）') : it.id;
      return it.note ? (base + '｜补充：' + it.note) : base;
    });
    var primary = NSFW_FLAVOR_PRESETS[items[0].id];
    parts.push('4. NSFW 部分用「欲望调色盘」而非 Kinks 清单：');
    parts.push('  - desire_palette：primary_hue（情欲主色）+ accent_hue（对比色）+ temperature + texture。同一张 Kinks 牌在不同调色盘下读起来完全不同。');
    parts.push('  - forbidden_tint：明明想要但不愿承认的东西——这是最迷人的部分。');
    parts.push('  - 口味组合（首项为主）：' + labels.join(' + '));
    if (primary) {
      parts.push('  - 主调色盘：温度=' + primary.palette.temperature + '，触感=' + primary.palette.texture);
    }
    parts.push('  - 必写维度：' + FLAVOR_SHARED_DIMENSIONS.map(function(d) { return d.label; }).concat(collected.mustCover).join('；'));
    parts.push('  - 成人相关正文≥' + collected.densityHint + '字；禁止提纲/空话/待填充。');
    parts.push('  - sexual_psychology：core_desire/core_fear/shame_sources/desire_expression/arousal_signature/fantasy_vs_reality/attachment_after 全部写满。');
    parts.push('  - situational_modulation：同一个人在不同场景下欲望表现不同。safe=intensity低/charged=intensity高/semi_public=克制暗流/post_conflict=粗暴确认/first_time=紧张试探。');
    parts.push('  - aftercare：亲密后需要什么（拥抱/独处/语言确认/清洁）；对关系是拉近还是推远。');
  }

  if (includeAdult && getNtlMode(state)) {
    var tabooTypes = getNtlTabooTypes(state);
    var ntlCollected = collectNtlEnrichment(tabooTypes, NTL_TABOO_TYPES);
    parts.push('5. NTL 禁忌层：');
    if (tabooTypes.length) {
      tabooTypes.forEach(function(t) {
        var info = NTL_TABOO_TYPES[t];
        if (info) {
          parts.push('  - ' + info.label + '：' + info.description);
          if (info.writingGuide) parts.push('    写法：' + info.writingGuide);
        }
      });
    }
    parts.push('  - 必写维度：' + NTL_SHARED_DIMENSIONS.map(function(d) { return d.label; }).concat(ntlCollected.mustCover).join('；'));
    parts.push('  - NTL 相关正文≥' + (ntlCollected.densityHint || NTL_TABOO_DEFAULT_MIN_CHARS) + '字；禁止提纲/空话/待填充。');
    parts.push('  - 写到 person.attrs.ntl 的完整字段（powerDynamic/coercionHint/moralConflict/dominantRole/emotionalCost/secrets/tabooThemes）。');
    parts.push('  - 禁忌的核心不在「做了什么」而在「做了之后的感受」——罪恶感/刺激/理性化/偶尔无所谓/反复。');
  }
  return parts.join('\n');
}

/**
 * 构建 NTL 增强提示块（替代/增强原 buildNtlHintBlock，含禁忌类型选择）
 */
export function buildNtlEnhancedHintBlock(state, phase) {
  var base = buildNtlHintBlock(phase || 'enrich');
  if (!getNtlMode(state)) return '';
  var taboo = buildNtlTabooHint(state);
  return base + (taboo || '');
}
