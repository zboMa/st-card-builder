/**
 * 状态栏设计：人数/预设模块/一对一视觉主题、预览 HTML、注入脚本与变量设计辅助
 * 「排版」= 完整视觉方案（结构+配色+质感），不再有独立样式步骤
 */

import {
  STATUS_BAR_DESIGNS,
  getDesignById,
  designsForCast,
  defaultDesignId,
  migrateDesignId,
  designCss,
  renderDesignHtml,
  escHtml,
} from './statusBarThemes/index.mjs';

export {
  STATUS_BAR_DESIGNS,
  getDesignById,
  designsForCast,
  defaultDesignId,
  migrateDesignId,
  designCss,
  renderDesignHtml,
};

/** @typedef {{ id: string, label: string, cast: 'single'|'multi', blurb?: string, accent?: string, hint?: string }} DesignDef */
/** @typedef {{ id: string, label: string, nsfw?: boolean, cast?: 'single'|'multi'|'both', group: 'scene'|'person'|'nsfw', hint?: string }} ModuleDef */
/** @typedef {{ id: string, label: string, cast: 'single'|'multi', nsfw?: boolean, modules: string[], hint?: string }} PresetDef */
/** @typedef {{ path: string, label: string, group?: string, sample?: string, role?: string, set?: 'global'|'protagonist'|'npc', meter?: boolean }} PathItem */
/** @typedef {{ name: string, aliases?: string[], identity?: string, source?: string, selected?: boolean }} CastCharacter */

/** 兼容旧名：LAYOUTS = 视觉主题（含 hint=blurb） */
export const STATUS_BAR_LAYOUTS = Object.freeze(
  STATUS_BAR_DESIGNS.map(function(d) {
    return { id: d.id, label: d.label, cast: d.cast, hint: d.blurb, blurb: d.blurb, accent: d.accent };
  })
);

/**
 * 薄兼容：旧 style 列表映射到 design（测试/旧存储可读）
 * getStyleById 实际返回 design 形
 */
export const STATUS_BAR_STYLES = STATUS_BAR_LAYOUTS;

export const STATUS_BAR_CAST_MODES = Object.freeze([
  { id: 'single', label: '单人', hint: '使用当前卡角色设定' },
  { id: 'multi', label: '多人', hint: '世界书人物条目自动加载；AI 识别可补充' },
]);

/** 旧模块 id → 新模块（normalizeDesign 迁移） */
const MODULE_ID_MIGRATE = Object.freeze({
  world_time_place: ['time_weather', 'location'],
  action_outfit: ['action', 'outfit'],
  memory_clue: ['memory_summary'],
  relation: ['affection', 'trust', 'relation_stage'],
});

/** 面板上的三类。NSFW 关时不渲染 nsfw 组。 */
export const STATUS_BAR_MODULE_GROUPS = Object.freeze([
  { id: 'scene', label: '场面' },
  { id: 'person', label: '人物' },
  { id: 'nsfw', label: 'NSFW' },
]);

/** 可组合模块（对齐 MVU；nsfw 需总开关，关则整组隐藏） */
export const STATUS_BAR_MODULES = Object.freeze([
  { id: 'time_weather', label: '时间天气', cast: 'both', group: 'scene', hint: '时间/日期/天气' },
  { id: 'location', label: '地点', cast: 'both', group: 'scene', hint: '当前位置/场景' },
  { id: 'emotion', label: '情绪', cast: 'both', group: 'scene', hint: '心情/张力' },
  { id: 'action', label: '行动', cast: 'both', group: 'scene', hint: '当前行动/行为' },
  { id: 'outfit', label: '着装', cast: 'both', group: 'scene', hint: '穿着/外观' },
  { id: 'event_chips', label: '事件芯片', cast: 'both', group: 'scene', hint: '短标签剧情事件' },
  { id: 'affection', label: '好感度', cast: 'both', group: 'person', hint: '好感数值' },
  { id: 'trust', label: '信任', cast: 'both', group: 'person', hint: '信任度' },
  { id: 'relation_stage', label: '关系阶段', cast: 'both', group: 'person', hint: '陌生/朋友/恋人等阶段' },
  { id: 'affection_stage', label: '亲密档位', cast: 'both', group: 'person', hint: '0-100 数值，档位映射见世界书「亲密关系总则」' },
  { id: 'attributes', label: '属性条', cast: 'both', group: 'person', hint: '体力/魔力' },
  { id: 'realm', label: '境界', cast: 'both', group: 'person', hint: '修为/境界' },
  { id: 'injury', label: '伤势', cast: 'both', group: 'person', hint: '伤势程度' },
  { id: 'sanity', label: '理智', cast: 'both', group: 'person', hint: '理智数值' },
  { id: 'items', label: '物品', cast: 'both', group: 'person', hint: '持有物/关键道具' },
  { id: 'money', label: '金钱', cast: 'both', group: 'person', hint: '金钱/资源' },
  { id: 'quest', label: '任务', cast: 'both', group: 'person', hint: '进行中任务/目标' },
  { id: 'memory_summary', label: '记忆摘要', cast: 'both', group: 'person', hint: '承诺/线索/阶段记忆' },
  { id: 'nsfw_vagina', label: '小穴', nsfw: true, cast: 'both', group: 'nsfw', hint: '私密状态描述' },
  { id: 'nsfw_breasts', label: '双乳', nsfw: true, cast: 'both', group: 'nsfw', hint: '胸部状态' },
  { id: 'nsfw_legs', label: '美腿', nsfw: true, cast: 'both', group: 'nsfw', hint: '腿部状态' },
  { id: 'nsfw_feet', label: '美脚', nsfw: true, cast: 'both', group: 'nsfw', hint: '足部状态' },
  { id: 'nsfw_anus', label: '屁穴', nsfw: true, cast: 'both', group: 'nsfw', hint: '后庭状态' },
  { id: 'nsfw_mouth', label: '口腔', nsfw: true, cast: 'both', group: 'nsfw', hint: '口腔/口部状态' },
  { id: 'nsfw_erogenous', label: '敏感带', nsfw: true, cast: 'both', group: 'nsfw', hint: '敏感点刺激' },
  { id: 'nsfw_uterus', label: '子宫', nsfw: true, cast: 'both', group: 'nsfw', hint: '子宫状态' },
  { id: 'nsfw_thoughts', label: '内心想法', nsfw: true, cast: 'both', group: 'nsfw', hint: '隐秘心声' },
  { id: 'nsfw_orgasm', label: '高潮/快感', nsfw: true, cast: 'both', group: 'nsfw', hint: '快感/高潮进度' },
  { id: 'nsfw_fluids', label: '体液', nsfw: true, cast: 'both', group: 'nsfw', hint: '体液状态' },
  { id: 'nsfw_exposure', label: '露出', nsfw: true, cast: 'both', group: 'nsfw', hint: '暴露/走光程度' },
  { id: 'nsfw_training', label: '调教标记', nsfw: true, cast: 'both', group: 'nsfw', hint: '调教/标记痕迹' },
  { id: 'nsfw_experience', label: '性经验摘要', nsfw: true, cast: 'both', group: 'nsfw', hint: '经验摘要' },
  { id: 'nsfw_act_state', label: '当前性行为状态', nsfw: true, cast: 'both', group: 'nsfw', hint: '正在进行的性行为' },
  { id: 'nsfw_pregnancy', label: '怀孕', nsfw: true, cast: 'both', group: 'nsfw', hint: '是否怀孕与孕期' },
  { id: 'corruption_stage', label: '恶堕进度', nsfw: true, cast: 'both', group: 'nsfw', hint: '0-100 数值，档位映射见世界书「恶堕进度总则」' },
]);

/** 日常/恋爱通用模块组 */
const MODS_DAILY = ['time_weather', 'location', 'emotion', 'action', 'outfit', 'affection', 'relation_stage', 'event_chips'];
const MODS_RPG = ['time_weather', 'location', 'attributes', 'action', 'outfit', 'items', 'money', 'quest', 'memory_summary', 'event_chips'];
const MODS_ROMANCE = ['time_weather', 'location', 'emotion', 'affection', 'trust', 'relation_stage', 'action', 'outfit', 'event_chips'];
const MODS_NSFW_CORE = [
  'nsfw_vagina', 'nsfw_breasts', 'nsfw_legs', 'nsfw_feet', 'nsfw_anus', 'nsfw_thoughts',
  'nsfw_mouth', 'nsfw_erogenous', 'nsfw_uterus', 'nsfw_orgasm', 'nsfw_fluids', 'nsfw_exposure',
  'nsfw_training', 'nsfw_experience', 'nsfw_act_state', 'nsfw_pregnancy',
];
/** 恶堕进度进 NTL / NTR / 亲密。主角写成 角色.恶堕进度，女角色写成 NPC.姓名.恶堕进度。 */
const MODS_CORRUPTION = ['corruption_stage'];
/** 纯爱线（亲密度）模块：进恋爱/亲密向预设 */
const MODS_AFFECTION = ['affection_stage'];
/** 多人基础模块（无配角摘要） */
const MODS_MULTI_BASE = ['time_weather', 'location', 'emotion', 'action', 'outfit', 'event_chips'];

/** 一份题材（无人数前缀）。single_* / multi_* 在 normalize 时收成同一 id，写入同一份 moduleFlags。 */
export const STATUS_BAR_PRESETS = Object.freeze([
  { id: 'daily', label: '日常', hint: '时间地点+情绪着装', modules: MODS_DAILY },
  { id: 'adventure', label: '冒险', hint: '属性物品任务记忆', modules: MODS_RPG.concat(['injury']) },
  { id: 'romance', label: '恋爱', hint: '好感信任关系阶段', modules: MODS_ROMANCE.concat(MODS_AFFECTION) },
  { id: 'campus', label: '校园', hint: '轻量校园追踪', modules: ['time_weather', 'location', 'emotion', 'action', 'outfit', 'items', 'affection', 'event_chips'] },
  { id: 'wuxia', label: '武侠', hint: '属性+物品+任务', modules: ['time_weather', 'location', 'attributes', 'realm', 'action', 'outfit', 'items', 'quest', 'memory_summary', 'event_chips'] },
  { id: 'xianxia', label: '仙侠', hint: '属性境界+记忆', modules: ['time_weather', 'location', 'attributes', 'realm', 'action', 'outfit', 'items', 'quest', 'memory_summary', 'event_chips'] },
  { id: 'apocalypse', label: '末日', hint: '属性资源生存', modules: ['time_weather', 'location', 'attributes', 'injury', 'action', 'outfit', 'items', 'money', 'quest', 'memory_summary', 'event_chips'] },
  { id: 'court', label: '宫廷', hint: '关系+记忆+事件', modules: ['time_weather', 'location', 'emotion', 'affection', 'trust', 'relation_stage', 'action', 'outfit', 'memory_summary', 'event_chips'] },
  { id: 'fantasy', label: '西幻', hint: '属性物品任务', modules: MODS_RPG },
  { id: 'urban', label: '都市', hint: '时间地点情绪金钱', modules: ['time_weather', 'location', 'emotion', 'action', 'outfit', 'money', 'items', 'affection', 'event_chips'] },
  { id: 'scifi', label: '科幻', hint: '属性物品任务', modules: ['time_weather', 'location', 'attributes', 'items', 'quest', 'memory_summary', 'event_chips', 'action'] },
  { id: 'cyber', label: '赛博', hint: '属性金钱任务', modules: ['time_weather', 'location', 'attributes', 'action', 'outfit', 'items', 'money', 'quest', 'event_chips'] },
  { id: 'mystery', label: '悬疑', hint: '记忆线索+事件', modules: ['time_weather', 'location', 'emotion', 'action', 'memory_summary', 'quest', 'event_chips', 'items'] },
  { id: 'military', label: '军事', hint: '属性任务地点', modules: ['time_weather', 'location', 'attributes', 'injury', 'action', 'outfit', 'items', 'quest', 'event_chips'] },
  { id: 'lovecraft', label: '克苏鲁', hint: '理智向属性+记忆', modules: ['time_weather', 'location', 'attributes', 'sanity', 'emotion', 'action', 'memory_summary', 'event_chips', 'quest'] },
  {
    id: 'ntl', label: 'NTL', nsfw: true, hint: '恋爱+内心身体+恶堕',
    modules: MODS_ROMANCE.concat(MODS_AFFECTION).concat(MODS_CORRUPTION).concat(['nsfw_thoughts', 'nsfw_breasts', 'nsfw_legs', 'nsfw_orgasm', 'nsfw_act_state']),
  },
  {
    id: 'ntr', label: 'NTR', nsfw: true, hint: '关系张力+身体+恶堕',
    modules: MODS_ROMANCE.concat(MODS_AFFECTION).concat(MODS_CORRUPTION).concat(['nsfw_thoughts', 'nsfw_vagina', 'nsfw_breasts', 'nsfw_fluids', 'nsfw_act_state']),
  },
  {
    id: 'intimate', label: '亲密', nsfw: true, hint: '全身体模块',
    modules: MODS_ROMANCE.concat(MODS_AFFECTION).concat(MODS_CORRUPTION).concat(MODS_NSFW_CORE),
  },
]);

/** 旧 presetId（含人数前缀）→ 无前缀题材。multi_party 对到日常。 */
const PRESET_ID_ALIAS = Object.freeze({
  rpg: 'adventure',
  harem: 'romance',
  nsfw: 'intimate',
  party: 'daily',
});

/**
 * @param {string} [id]
 * @returns {string}
 */
export function migratePresetId(id) {
  var raw = String(id || '').trim();
  if (!raw || raw === 'multi_party') return 'daily';
  var stripped = raw.replace(/^(single_|multi_)/, '');
  var mapped = PRESET_ID_ALIAS[stripped] || stripped;
  if (STATUS_BAR_PRESETS.some(function(p) { return p.id === mapped; })) return mapped;
  return 'daily';
}

export const STATUS_BAR_MODES = Object.freeze([
  { id: 'mvu', label: 'MVU 变量模式（读取 stat_data）' },
  { id: 'text', label: '纯文本模式（解析 AI 输出标签）' },
]);

export const STATUS_BAR_SCRIPT_NAME = '[状态栏]前端展示';
export const STATUS_BAR_REGEX_NAME = '[美化]状态栏展示';
/** ST/MVU 社区约定：模型输出该占位符，由正则替换为 HTML 状态栏 */
export const STATUS_BAR_PLACEHOLDER = '<StatusPlaceHolderImpl/>';
export const STATUS_BAR_EXT_KEY = 'zmer_statusbar_design';

/** 自定义排版（AI 生成 HTML/CSS，非 statusBarThemes 主题文件） */
export const CUSTOM_DESIGN_ID = 'custom';

/** @param {string} [id] */
export function isCustomDesign(id) {
  return id === CUSTOM_DESIGN_ID;
}

/** 自定义排版元数据（layoutsForCast 追加项） */
export function customDesignMeta(cast) {
  return {
    id: CUSTOM_DESIGN_ID,
    label: '自定义',
    cast: cast === 'multi' ? 'multi' : 'single',
    hint: 'AI 按描述生成排版',
    blurb: 'AI 按描述生成排版',
    accent: '#a855f7',
    family: 'custom',
  };
}

/** @param {string} id —— 兼容旧 styleId，映射到 design */
export function getStyleById(id) {
  var d = getDesignById(migrateDesignId(id, id));
  return { id: d.id, label: d.label, hint: d.blurb, blurb: d.blurb, cast: d.cast, accent: d.accent };
}

/** 旧 layout id → design id */
export function migrateLayoutId(id) {
  return migrateDesignId(id);
}

/** @param {string} id */
export function getLayoutById(id) {
  var d = getDesignById(id);
  return { id: d.id, label: d.label, cast: d.cast, hint: d.blurb, blurb: d.blurb, accent: d.accent };
}

/** @param {'single'|'multi'} cast */
export function layoutsForCast(cast) {
  var list = designsForCast(cast).map(function(d) {
    return { id: d.id, label: d.label, cast: d.cast, hint: d.blurb, blurb: d.blurb, accent: d.accent };
  });
  list.push(customDesignMeta(cast));
  return list;
}

/** 解析设计元数据（含自定义） */
export function getDesignMeta(id, castMode) {
  if (isCustomDesign(id)) return customDesignMeta(castMode);
  return getDesignById(id);
}

/** 人数模式下的默认视觉方案 */
export function defaultLayoutId(cast) {
  return defaultDesignId(cast);
}

/** @param {string} id */
export function getPresetById(id) {
  var mid = migratePresetId(id);
  return STATUS_BAR_PRESETS.find(function(p) { return p.id === mid; }) || STATUS_BAR_PRESETS[0];
}

/** @param {string} id */
export function getModuleById(id) {
  return STATUS_BAR_MODULES.find(function(m) { return m.id === id; }) || null;
}

/** 题材不再按人数拆分；参数保留以免旧调用崩。 */
export function presetsForCast() {
  return STATUS_BAR_PRESETS.slice();
}

/** 常规 / NSFW 模块列表 */
export function modulesByGroup(nsfwEnabled) {
  return STATUS_BAR_MODULES.filter(function(m) {
    if (m.nsfw) return !!nsfwEnabled;
    return true;
  });
}

/**
 * 把旧模块 flags 迁到新 id（丢弃已移除的配角摘要）
 * @param {Record<string, boolean>|null|undefined} raw
 */
export function migrateModuleFlags(raw) {
  var out = {};
  if (!raw || typeof raw !== 'object') return out;
  Object.keys(raw).forEach(function(k) {
    if (k === 'support_summary') return; // 已移除，不迁移
    var mapped = MODULE_ID_MIGRATE[k];
    if (mapped) {
      mapped.forEach(function(id) { out[id] = !!raw[k]; });
      return;
    }
    if (getModuleById(k)) out[k] = !!raw[k];
  });
  return out;
}

/**
 * 按预设返回默认模块开关；nsfw=false 时关闭 NSFW 模块
 * @param {string} presetId
 * @param {boolean} [nsfwEnabled]
 * @returns {Record<string, boolean>}
 */
export function defaultModuleFlags(presetId, nsfwEnabled) {
  var preset = getPresetById(presetId);
  var on = {};
  STATUS_BAR_MODULES.forEach(function(m) { on[m.id] = false; });
  (preset.modules || []).forEach(function(id) {
    var mod = getModuleById(id);
    if (!mod) return;
    if (mod.nsfw && !nsfwEnabled) return;
    on[id] = true;
  });
  return on;
}

/**
 * 合并预设默认与用户临时覆盖
 * @param {string} presetId
 * @param {Record<string, boolean>|null|undefined} overrides
 * @param {boolean} nsfwEnabled
 */
export function resolveModuleFlags(presetId, overrides, nsfwEnabled) {
  var flags = defaultModuleFlags(presetId, nsfwEnabled);
  var ov = migrateModuleFlags(overrides);
  Object.keys(ov).forEach(function(k) {
    if (!getModuleById(k)) return;
    flags[k] = !!ov[k];
  });
  // NSFW 总关时强制关掉 NSFW 模块
  if (!nsfwEnabled) {
    STATUS_BAR_MODULES.forEach(function(m) {
      if (m.nsfw) flags[m.id] = false;
    });
  }
  return flags;
}

/** 当前开启的模块列表文案（供 AI 提示） */
export function describeEnabledModules(flags) {
  return STATUS_BAR_MODULES
    .filter(function(m) { return flags && flags[m.id]; })
    .map(function(m) { return m.label + (m.nsfw ? '(NSFW)' : '') + '：' + (m.hint || ''); })
    .join('\n') || '（无）';
}

/** 未开启模块 → 禁止生成的路径提示（供 MVU 设计提示词） */
var MODULE_FORBIDDEN_PATH_HINT = Object.freeze({
  time_weather: '世界.当前时间 / 世界.天气 / 世界.时间',
  location: '世界.当前地点 / 世界.地点',
  quest: '任务.当前 / 任务.*',
  event_chips: '事件.标签 / 事件.*',
  emotion: '*.情绪',
  action: '*.行动',
  outfit: '*.着装',
  affection: '*.好感度 / *.好感',
  trust: '*.信任',
  relation_stage: '*.关系阶段',
  corruption_stage: '*.恶堕进度 / *.恶堕',
  affection_stage: '*.亲密度',
  realm: '*.境界',
  injury: '*.伤势',
  sanity: '*.理智',
  attributes: '*.体力 / *.魔力 / *.生命',
  items: '*.物品',
  money: '*.金钱',
  memory_summary: '*.记忆',
  nsfw_thoughts: '*.内心',
  nsfw_breasts: '*.双乳',
  nsfw_vagina: '*.小穴 / *.私处',
  nsfw_legs: '*.美腿',
  nsfw_feet: '*.美脚',
  nsfw_anus: '*.屁穴',
  nsfw_mouth: '*.口腔',
  nsfw_erogenous: '*.敏感带 / *.敏感',
  nsfw_orgasm: '*.快感 / *.高潮',
  nsfw_fluids: '*.体液',
  nsfw_exposure: '*.露出',
  nsfw_training: '*.调教',
  nsfw_experience: '*.性经验',
  nsfw_act_state: '*.性行为',
  nsfw_uterus: '*.子宫',
  nsfw_pregnancy: '*.怀孕',
});

/**
 * @param {Record<string, boolean>} flags
 * @param {{ castMode?: string, nsfwEnabled?: boolean }} [opts]
 */
export function describeForbiddenModules(flags, opts) {
  var o = opts || {};
  var nsfwOn = !!o.nsfwEnabled;
  var f = flags || {};
  var lines = [];
  STATUS_BAR_MODULES.forEach(function(m) {
    var forcedOff = m.nsfw && !nsfwOn;
    var off = forcedOff || !f[m.id];
    if (!off) return;
    var hint = MODULE_FORBIDDEN_PATH_HINT[m.id] || '';
    var reason = forcedOff ? '（NSFW 总开关关闭）' : '（未勾选）';
    lines.push('- ' + m.label + ' `' + m.id + '`' + reason
      + (hint ? '：不得出现路径 ' + hint : ''));
  });
  lines.push('- 配角摘要 / 精简块 / 仅某人专用的额外亲密字段');
  return lines.join('\n') || '（无）';
}

/**
 * 「只识别女角色」规则文案（写入识别提示词）
 * @param {boolean} femaleOnly
 */
export function describeFemaleOnlyRule(femaleOnly) {
  if (!femaleOnly) {
    return '5. 性别不限：男女及其他可识别人物均可列入。\n';
  }
  return '6. 【只识别女角色】仅输出女性人物；排除明确男性。当前卡角色本人仍然不要输出。\n';
}

/**
 * 规范化路径项
 * @param {any} raw
 * @returns {PathItem}
 */
var METER_LEAF_RE = /(好感度|信任|恶堕进度|亲密度|体力|魔力|金钱|快感|理智)$/;

/** @param {string} path @param {string} [type] */
export function pathIsMeter(path, type) {
  if (String(type || '') === 'number') return true;
  var leaf = String(path || '').split('.').pop() || '';
  return METER_LEAF_RE.test(leaf);
}

/** @param {string} path @param {string} [explicit] */
export function pathSetOf(path, explicit) {
  if (explicit === 'global' || explicit === 'protagonist' || explicit === 'npc') return explicit;
  var p = String(path || '');
  if (p.indexOf('NPC.') === 0) return 'npc';
  if (p.indexOf('角色.') === 0) return 'protagonist';
  return 'global';
}

export function normalizePathItem(raw) {
  var path = String((raw && (raw.path || raw.name || raw.key)) || '').trim().replace(/^stat_data\./, '');
  var label = String((raw && (raw.label || raw.title || raw.description)) || path.split('.').pop() || '字段').trim();
  var group = String((raw && (raw.group || raw.section)) || '状态').trim() || '状态';
  var sample = raw && raw.sample != null ? String(raw.sample) : guessSample(path, raw && raw.type);
  var role = raw && raw.role != null ? String(raw.role) : '';
  var set = pathSetOf(path, raw && raw.set);
  var item = { path: path, label: label, group: group, sample: sample, set: set };
  if (role) item.role = role;
  if (raw && raw.meter === true || pathIsMeter(path, raw && raw.type)) item.meter = true;
  return item;
}

function guessSample(path, type) {
  var p = String(path || '');
  var t = String(type || '');
  if (t === 'number' || /好感|金钱|血|hp|mp|等级|进度|信任|亲密度/i.test(p)) return '72';
  if (t === 'boolean') return '是';
  if (/时间|时刻/i.test(p)) return '08:30';
  if (/天气/i.test(p)) return '晴';
  if (/地点|位置|场景/i.test(p)) return '咖啡馆';
  if (/情绪|心情/i.test(p)) return '平静';
  if (/着装|衣着|穿着/i.test(p)) return '便装';
  if (/行动|行为/i.test(p)) return '闲聊';
  if (/关系阶段|阶段/i.test(p)) return '熟人';
  return '—';
}

/**
 * 从 MVU design.variables 提取展示路径
 * @param {any} design
 * @param {{ limit?: number, mainName?: string }} [opts]
 * @returns {PathItem[]}
 */
