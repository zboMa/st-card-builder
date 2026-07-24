/**
 * 小说工坊成人/NTL：分步推断、召回增强、口味/禁忌提示（拆自 nsfwSupport）
 */
import {
  NSFW_FLAVOR_PRESETS,
  NSFWFLAVOR_IDS,
  NSFW_FLAVOR_DEFAULT_MIN_CHARS,
  NSFW_FLAVOR_ENRICHMENT,
  FLAVOR_SHARED_DIMENSIONS,
  FLAVOR_GROUPS,
  collectFlavorEnrichment,
  evaluateFlavorRichness,
  extractFlavorRichnessText,
  buildFlavorExpandSystemPrompt,
  buildFlavorExpandUserPrompt,
  compactCharCount,
} from '../adult/flavors/index.mjs';
import {
  NTL_TABOO_TYPES,
  NTL_TABOO_IDS,
  NTL_TABOO_DEFAULT_MIN_CHARS,
  NTL_TABOO_ENRICHMENT,
  NTL_SHARED_DIMENSIONS,
  collectNtlEnrichment,
  evaluateNtlRichness,
  extractNtlRichnessText,
  buildNtlExpandSystemPrompt,
  buildNtlExpandUserPrompt,
  buildNtlTabooHintFromTypes,
  normalizeNtlTabooItems,
} from '../adult/ntl/index.mjs';
import {
  POSTURE_GROUPS,
  SPEECH_GROUPS,
  EROTIC_POSTURE_PRESETS,
  EROTIC_POSTURE_IDS,
  EROTIC_SPEECH_PRESETS,
  EROTIC_SPEECH_IDS,
  normalizeExpressionItems,
  buildPostureHintFromItems,
  buildSpeechHintFromItems,
  checkExpressionEntryQuality,
} from '../adult/expression/index.mjs';
import {
  STYLE_NSFW_SLICE,
  STYLE_ADULT_FALLBACK,
} from './contextBudgets.mjs';
import { truncateToTokens } from '../assistant/contextManager.mjs';
import {
  WORLDFRAMES,
  WORLDFRAME_IDS,
  VESSEL_KINDS,
  VESSEL_KIND_LABELS,
  VESSEL_DEFAULT_MIN_CHARS,
  inferWorldframe,
  collectVesselEnrichment,
  buildVesselHint,
  evaluateVesselRichness,
  buildVesselExpandSystemPrompt,
  buildVesselExpandUserPrompt,
  listVesselEntities,
  personMentionsVessels,
  formatVesselCanonBlock,
  buildStatusBarVesselDraftFromEntities,
  isVesselEntity,
} from '../adult/vessels/index.mjs';
import {
  MAX_NSFW_FLAVOR_ITEMS,
  INTIMATE_REL_LABELS,
  getAdultMode,
  getNtlMode,
  setAdultMode,
  setNtlMode,
  isPlaceholderText,
  normalizeNtlPersonAttrs,
  isNtlPersonFilled,
  isNsfwProfileFilled,
  isNsfwEntityFilled,
  isAdultAttrsFilled,
  entityNeedsAdultAttrs,
} from './nsfwSupportAttrs.mjs';

/** 从文风文本抽出 NSFW 指令段（供人物丰满注入） */
export function extractStyleNsfwSection(styleText) {
  var t = String(styleText || '');
  if (!t.trim()) return '';
  var m = t.match(/##\s*NSFW\s*文风指令([\s\S]*?)(?=\n##\s|$)/i);
  if (m && m[1] && m[1].trim()) {
    return '\n【文风 NSFW 指令（人物描写须对齐）】\n' + truncateToTokens(m[1].trim(), STYLE_NSFW_SLICE);
  }
  var m2 = t.match(/##\s*NTL\s*文风指令([\s\S]*?)(?=\n##\s|$)/i);
  if (m2 && m2[1] && m2[1].trim()) {
    return '\n【文风 NTL 指令（禁忌张力须对齐）】\n' + truncateToTokens(m2[1].trim(), STYLE_NSFW_SLICE);
  }
  if (/情欲|身体描写|敏感|NSFW|禁忌|NTL/i.test(t)) {
    return '\n【文风片段（含成人向）】\n' + truncateToTokens(t, STYLE_ADULT_FALLBACK);
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
      + '\n- item/location/lore/faction：附 attrs.adult={eroticRole,atmosphere,vesselKind,worldframe,powerLogic,costOrRisk,socialCover,triggers[],limits[],playIdeas[],relatedPersons[],flavorHooks[],ntlHooks[],inferred,lastPass:"skeleton"}。'
      + '\n- 必须挖 type=nsfw（kind=rule|place|item|dynamic|taboo|consent），attrs 按 kind 填最低字段，并尽量补 powerLogic/costOrRisk。'
      + '\n- 亲密边/亲密 event.attrs.intimate=true。'
      + '\n- 成人载体须贴合世界观语汇（法器/异能/咒物等），禁止错位玩具清单。';
  }
  if (p === 'relations') {
    return common
      + '\n【本步·关系】优先补亲密边（' + INTIMATE_REL_LABELS.join('/') + '）；'
      + 'attrs 可含 intimacy/power/taboo；边两端人物若 NSFW 空洞，在 evidence 旁用短注暗示张力（丰满步会写全）。'
      + '\n可补「人物—载体」使用/被施加/契约边。';
  }
  if (p === 'extract') {
    return common
      + '\n【本步·世界书抽取】必须抽 category=nsfw；普通 item/location/setting 也尽量带完整 attrs.adult（含 powerLogic）；'
      + '可补充完善已有条目的成人维与世界观载体，勿重复空壳。';
  }
  if (p === 'expand') {
    return common
      + '\n【本步·扩展】据召回原文与已有档案修订 NSFW/adult/载体机制；无原文则据已有字段与世界观语汇推断补全。';
  }
  // enrich 默认
  return common
    + '\n【本步·丰满】'
    + '\n- person：写满 NSFW_information；attrs.nsfwMeta.lastPass="enrich"；有原文证据则 inferred=false；'
    + '须点名与已有成人载体（法器/异能/场所等）的互动。'
    + '\n- type=nsfw：按 kind 填满 rules/limits/consent/triggers/atmosphere/playIdeas/relatedNames，并写 powerLogic/costOrRisk。'
    + '\n- item/location/lore/faction：写满 attrs.adult（机制/代价/伪装/人物挂钩），content 含【成人向用法】长文。'
    + '\n- 参考提示中的【已有人物/NSFW/条目成人向/世界观载体】摘要，保持 XP 与 Limits 一致。';
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
    + '\n须写出可 RP 的张力机制与情绪代价；禁止儿童性化（礼法成年制度可写，情欲仅限已完成设定成年礼的成人）；勿空喊「很禁忌」。'
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
  if (getAdultMode(state) || getNtlMode(state)) {
    parts.push(buildVesselHintForState(state, { phase: phase }));
  }
  return parts.join('');
}

/**
 * 从 state 组装世界观载体 hint
 * @param {object} state
 * @param {{ phase?: string, intro?: string }} [opts]
 */
export function buildVesselHintForState(state, opts) {
  opts = opts || {};
  if (!state || (!getAdultMode(state) && !getNtlMode(state))) return '';
  var inferred = resolveWorldframe(state);
  return buildVesselHint({
    enabled: true,
    worldframe: inferred.id,
    flavorItems: getAdultMode(state) ? getNsfwFlavorItems(state) : [],
    ntlItems: getNtlMode(state) ? getNtlTabooItems(state) : [],
    intro: opts.intro || '（仅世界书管道：物化口味/NTL，勿写入主角 Description）',
  });
}

/** 读取或推断并缓存 adultWorldframe */
export function resolveWorldframe(state, opts) {
  opts = opts || {};
  if (!state) return inferWorldframe({});
  if (!opts.recompute && state.adultWorldframe && WORLDFRAMES[state.adultWorldframe]) {
    return {
      id: state.adultWorldframe,
      label: WORLDFRAMES[state.adultWorldframe].label,
      confidence: state.adultWorldframeConfidence != null ? state.adultWorldframeConfidence : 0.7,
      source: state.adultWorldframeForced ? 'forced' : 'cached',
    };
  }
  var result = inferWorldframe({
    forced: opts.forced || state.adultWorldframeForced || '',
    contextText: state.contextText,
    entities: state.entities,
    worldbookEntries: (state.wbEntries || []).map(function(e) {
      return {
        comment: e.comment || ('[小说' + (e.category || 'setting') + '] ' + e.name),
        content: e.content || '',
        category: e.category,
        name: e.name,
      };
    }),
  });
  state.adultWorldframe = result.id;
  state.adultWorldframeConfidence = result.confidence;
  state.adultWorldframeSource = result.source;
  return result;
}

export function setAdultWorldframe(state, frameId) {
  if (!state) return null;
  var id = String(frameId || '').trim();
  if (id && WORLDFRAMES[id]) {
    state.adultWorldframe = id;
    state.adultWorldframeForced = id;
    state.adultWorldframeConfidence = 1;
    state.adultWorldframeSource = 'forced';
    return resolveWorldframe(state);
  }
  state.adultWorldframeForced = '';
  return resolveWorldframe(state, { recompute: true });
}

/**
 * 建议世界观框架（不强制）：卡侧自动推断 / 预设弱联动用。
 * 若已有 adultWorldframeForced，则不改动。
 */
export function suggestAdultWorldframe(state, frameId) {
  if (!state) return null;
  if (state.adultWorldframeForced) return resolveWorldframe(state);
  var id = String(frameId || '').trim();
  if (id && WORLDFRAMES[id]) {
    state.adultWorldframe = id;
    state.adultWorldframeForced = '';
    state.adultWorldframeSource = 'suggest';
    if (state.adultWorldframeConfidence == null || state.adultWorldframeConfidence < 0.5) {
      state.adultWorldframeConfidence = 0.6;
    }
  }
  return resolveWorldframe(state);
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
 * NTL 禁忌类型管理（多选 + 每项 note）
 */
export function getNtlTabooItems(state) {
  if (!state) return [];
  return normalizeNtlTabooItems(state.ntlTabooItems, state.ntlTabooTypes, NTL_TABOO_IDS);
}

export function getNtlTabooTypes(state) {
  return getNtlTabooItems(state).map(function(it) { return it.id; });
}

export function setNtlTabooItems(state, items) {
  var next = normalizeNtlTabooItems(items, [], NTL_TABOO_IDS);
  state.ntlTabooItems = next.map(function(it) {
    return { id: it.id, note: it.note || '' };
  });
  state.ntlTabooTypes = next.map(function(it) { return it.id; });
  return getNtlTabooItems(state);
}

export function setNtlTabooTypes(state, types) {
  var curNotes = Object.create(null);
  getNtlTabooItems(state).forEach(function(it) { curNotes[it.id] = it.note || ''; });
  var list = Array.isArray(types) ? types.filter(function(t) { return NTL_TABOO_IDS.indexOf(t) >= 0; }) : [];
  return setNtlTabooItems(state, list.map(function(id) {
    return { id: id, note: curNotes[id] || '' };
  }));
}

export function addNtlTabooType(state, type) {
  var list = getNtlTabooItems(state);
  if (NTL_TABOO_IDS.indexOf(type) >= 0 && !list.some(function(it) { return it.id === type; })) {
    list.push({ id: type, note: '' });
    setNtlTabooItems(state, list);
  }
  return getNtlTabooTypes(state);
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
 * 构建 NTL 禁忌类型注入块：必写维度 + 指南 + 用户 note + 硬约束
 */
export function buildNtlTabooHint(state) {
  if (!getNtlMode(state)) return '';
  var items = getNtlTabooItems(state);
  if (!items.length) return '';
  return buildNtlTabooHintFromTypes(items, { tabooTypes: NTL_TABOO_TYPES });
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
