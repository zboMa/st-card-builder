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
/** @typedef {{ id: string, label: string, nsfw?: boolean, cast?: 'single'|'multi'|'both', hint?: string }} ModuleDef */
/** @typedef {{ id: string, label: string, cast: 'single'|'multi', nsfw?: boolean, modules: string[], hint?: string }} PresetDef */
/** @typedef {{ path: string, label: string, group?: string, sample?: string, role?: string }} PathItem */
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
  { id: 'multi', label: '多人', hint: 'AI 识别世界书人物条目后勾选' },
]);

/** 旧模块 id → 新模块（normalizeDesign 迁移） */
const MODULE_ID_MIGRATE = Object.freeze({
  world_time_place: ['time_weather', 'location'],
  action_outfit: ['action', 'outfit'],
  memory_clue: ['memory_summary'],
  relation: ['affection', 'trust', 'relation_stage'],
});

/** 可组合模块（对齐 MVU；nsfw 需总开关，关则整组隐藏） */
export const STATUS_BAR_MODULES = Object.freeze([
  // —— 常规 ——
  { id: 'affection', label: '亲密度/好感', cast: 'both', hint: '好感/亲密度数值' },
  { id: 'trust', label: '信任', cast: 'both', hint: '信任度' },
  { id: 'relation_stage', label: '关系阶段', cast: 'both', hint: '陌生/朋友/恋人等阶段' },
  { id: 'corruption_stage', label: '恶堕进度', nsfw: true, cast: 'both', hint: '未触碰/动摇/越界/沉沦/彻底恶堕等阶段' },
  { id: 'emotion', label: '情绪', cast: 'both', hint: '心情/张力' },
  { id: 'action', label: '行动', cast: 'both', hint: '当前行动/行为' },
  { id: 'location', label: '地点', cast: 'both', hint: '当前位置/场景' },
  { id: 'outfit', label: '着装', cast: 'both', hint: '穿着/外观' },
  { id: 'items', label: '物品', cast: 'both', hint: '持有物/关键道具' },
  { id: 'money', label: '金钱', cast: 'both', hint: '金钱/资源' },
  { id: 'quest', label: '任务', cast: 'both', hint: '进行中任务/目标' },
  { id: 'memory_summary', label: '记忆摘要', cast: 'both', hint: '承诺/线索/阶段记忆' },
  { id: 'event_chips', label: '事件芯片', cast: 'both', hint: '短标签剧情事件' },
  // 配角摘要已移除：多人入选角色人人同套详字段（信息量一致）
  { id: 'attributes', label: '属性条', cast: 'both', hint: '体力/魔力/等级等' },
  { id: 'time_weather', label: '时间天气', cast: 'both', hint: '时间/日期/天气' },
  // —— NSFW ——
  { id: 'nsfw_vagina', label: '小穴', nsfw: true, cast: 'both', hint: '私密状态描述' },
  { id: 'nsfw_breasts', label: '双乳', nsfw: true, cast: 'both', hint: '胸部状态' },
  { id: 'nsfw_legs', label: '美腿', nsfw: true, cast: 'both', hint: '腿部状态' },
  { id: 'nsfw_feet', label: '美脚', nsfw: true, cast: 'both', hint: '足部状态' },
  { id: 'nsfw_anus', label: '屁穴', nsfw: true, cast: 'both', hint: '后庭状态' },
  { id: 'nsfw_thoughts', label: '内心想法', nsfw: true, cast: 'both', hint: '隐秘心声' },
  { id: 'nsfw_mouth', label: '口腔', nsfw: true, cast: 'both', hint: '口腔/口部状态' },
  { id: 'nsfw_erogenous', label: '敏感带', nsfw: true, cast: 'both', hint: '敏感点刺激' },
  { id: 'nsfw_orgasm', label: '高潮/快感', nsfw: true, cast: 'both', hint: '快感/高潮进度' },
  { id: 'nsfw_fluids', label: '体液', nsfw: true, cast: 'both', hint: '体液状态' },
  { id: 'nsfw_exposure', label: '露出', nsfw: true, cast: 'both', hint: '暴露/走光程度' },
  { id: 'nsfw_training', label: '调教标记', nsfw: true, cast: 'both', hint: '调教/标记痕迹' },
  { id: 'nsfw_experience', label: '性经验摘要', nsfw: true, cast: 'both', hint: '经验摘要' },
  { id: 'nsfw_act_state', label: '当前性行为状态', nsfw: true, cast: 'both', hint: '正在进行的性行为' },
]);

/** 日常/恋爱通用模块组 */
const MODS_DAILY = ['time_weather', 'location', 'emotion', 'action', 'outfit', 'affection', 'relation_stage', 'event_chips'];
const MODS_RPG = ['time_weather', 'location', 'attributes', 'action', 'outfit', 'items', 'money', 'quest', 'memory_summary', 'event_chips'];
const MODS_ROMANCE = ['time_weather', 'location', 'emotion', 'affection', 'trust', 'relation_stage', 'action', 'outfit', 'event_chips'];
const MODS_NSFW_CORE = [
  'nsfw_vagina', 'nsfw_breasts', 'nsfw_legs', 'nsfw_feet', 'nsfw_anus', 'nsfw_thoughts',
  'nsfw_mouth', 'nsfw_erogenous', 'nsfw_orgasm', 'nsfw_fluids', 'nsfw_exposure',
  'nsfw_training', 'nsfw_experience', 'nsfw_act_state', 'corruption_stage',
];
/** 多人基础模块（无配角摘要） */
const MODS_MULTI_BASE = ['time_weather', 'location', 'emotion', 'action', 'outfit', 'event_chips'];

/** 单人/多人内置预设（题材尽量铺全） */
export const STATUS_BAR_PRESETS = Object.freeze([
  // —— 单人 ——
  { id: 'single_daily', cast: 'single', label: '日常陪伴', hint: '时间地点+情绪着装', modules: MODS_DAILY },
  { id: 'single_rpg', cast: 'single', label: '冒险 RPG', hint: '属性物品任务记忆', modules: MODS_RPG },
  { id: 'single_romance', cast: 'single', label: '恋爱向', hint: '好感信任关系阶段', modules: MODS_ROMANCE },
  { id: 'single_campus', cast: 'single', label: '校园日常', hint: '轻量校园追踪', modules: ['time_weather', 'location', 'emotion', 'action', 'outfit', 'items', 'affection', 'event_chips'] },
  { id: 'single_wuxia', cast: 'single', label: '武侠江湖', hint: '属性+物品+任务', modules: ['time_weather', 'location', 'attributes', 'action', 'outfit', 'items', 'quest', 'memory_summary', 'event_chips'] },
  { id: 'single_xianxia', cast: 'single', label: '仙侠修真', hint: '属性境界+记忆', modules: ['time_weather', 'location', 'attributes', 'action', 'outfit', 'items', 'quest', 'memory_summary', 'event_chips'] },
  { id: 'single_apocalypse', cast: 'single', label: '末日废土', hint: '属性资源生存', modules: ['time_weather', 'location', 'attributes', 'action', 'outfit', 'items', 'money', 'quest', 'memory_summary', 'event_chips'] },
  { id: 'single_court', cast: 'single', label: '古代宫廷', hint: '关系+记忆+事件', modules: ['time_weather', 'location', 'emotion', 'affection', 'trust', 'relation_stage', 'action', 'outfit', 'memory_summary', 'event_chips'] },
  { id: 'single_fantasy', cast: 'single', label: '西幻冒险', hint: '属性物品任务', modules: MODS_RPG },
  { id: 'single_urban', cast: 'single', label: '都市日常', hint: '时间地点情绪金钱', modules: ['time_weather', 'location', 'emotion', 'action', 'outfit', 'money', 'items', 'affection', 'event_chips'] },
  { id: 'single_scifi', cast: 'single', label: '科幻任务', hint: '属性物品任务', modules: ['time_weather', 'location', 'attributes', 'items', 'quest', 'memory_summary', 'event_chips', 'action'] },
  { id: 'single_cyber', cast: 'single', label: '赛博都市', hint: '属性金钱任务', modules: ['time_weather', 'location', 'attributes', 'action', 'outfit', 'items', 'money', 'quest', 'event_chips'] },
  { id: 'single_mystery', cast: 'single', label: '悬疑推理', hint: '记忆线索+事件', modules: ['time_weather', 'location', 'emotion', 'action', 'memory_summary', 'quest', 'event_chips', 'items'] },
  { id: 'single_military', cast: 'single', label: '军事行动', hint: '属性任务地点', modules: ['time_weather', 'location', 'attributes', 'action', 'outfit', 'items', 'quest', 'event_chips'] },
  { id: 'single_lovecraft', cast: 'single', label: '克苏鲁', hint: '理智向属性+记忆', modules: ['time_weather', 'location', 'attributes', 'emotion', 'action', 'memory_summary', 'event_chips', 'quest'] },
  { id: 'single_ntl', cast: 'single', label: 'NTL 亲密', nsfw: true, hint: '恋爱+内心身体', modules: MODS_ROMANCE.concat(['nsfw_thoughts', 'nsfw_breasts', 'nsfw_legs', 'nsfw_orgasm', 'nsfw_act_state', 'corruption_stage']) },
  { id: 'single_ntr', cast: 'single', label: 'NTR 张力', nsfw: true, hint: '关系张力+身体', modules: MODS_ROMANCE.concat(['nsfw_thoughts', 'nsfw_vagina', 'nsfw_breasts', 'nsfw_fluids', 'nsfw_act_state', 'corruption_stage']) },
  {
    id: 'single_nsfw', cast: 'single', label: '亲密 NSFW', nsfw: true, hint: '全身体模块',
    modules: MODS_ROMANCE.concat(MODS_NSFW_CORE),
  },
  // —— 多人（入选角色人人同套详字段）——
  { id: 'multi_party', cast: 'multi', label: '小队同行', hint: '全员同套+属性物品', modules: MODS_MULTI_BASE.concat(['attributes', 'items']) },
  { id: 'multi_harem', cast: 'multi', label: '群像恋爱', hint: '好感信任关系阶段', modules: MODS_MULTI_BASE.concat(['affection', 'trust', 'relation_stage']) },
  { id: 'multi_wuxia', cast: 'multi', label: '武侠群侠', hint: '属性物品任务', modules: MODS_MULTI_BASE.concat(['attributes', 'items', 'quest', 'memory_summary']) },
  { id: 'multi_xianxia', cast: 'multi', label: '仙侠同门', hint: '属性境界任务', modules: MODS_MULTI_BASE.concat(['attributes', 'items', 'quest', 'memory_summary']) },
  { id: 'multi_apocalypse', cast: 'multi', label: '末日小队', hint: '生存资源任务', modules: MODS_MULTI_BASE.concat(['attributes', 'items', 'money', 'quest']) },
  { id: 'multi_court', cast: 'multi', label: '宫廷群像', hint: '关系记忆事件', modules: MODS_MULTI_BASE.concat(['affection', 'trust', 'relation_stage', 'memory_summary']) },
  { id: 'multi_fantasy', cast: 'multi', label: '西幻队伍', hint: '属性任务金钱', modules: MODS_MULTI_BASE.concat(['attributes', 'items', 'quest', 'money']) },
  { id: 'multi_urban', cast: 'multi', label: '都市群像', hint: '情绪金钱物品', modules: MODS_MULTI_BASE.concat(['affection', 'money', 'items']) },
  { id: 'multi_scifi', cast: 'multi', label: '科幻编队', hint: '属性任务记忆', modules: MODS_MULTI_BASE.concat(['attributes', 'items', 'quest', 'memory_summary']) },
  { id: 'multi_cyber', cast: 'multi', label: '赛博团伙', hint: '属性金钱任务', modules: MODS_MULTI_BASE.concat(['attributes', 'money', 'quest', 'items']) },
  { id: 'multi_campus', cast: 'multi', label: '校园群像', hint: '情绪好感关系', modules: MODS_MULTI_BASE.concat(['affection', 'relation_stage', 'items']) },
  { id: 'multi_mystery', cast: 'multi', label: '悬疑群像', hint: '线索记忆任务', modules: MODS_MULTI_BASE.concat(['memory_summary', 'quest', 'items']) },
  { id: 'multi_military', cast: 'multi', label: '军事编队', hint: '属性物品任务', modules: MODS_MULTI_BASE.concat(['attributes', 'items', 'quest']) },
  { id: 'multi_lovecraft', cast: 'multi', label: '克苏鲁调查', hint: '理智记忆任务', modules: MODS_MULTI_BASE.concat(['attributes', 'memory_summary', 'quest']) },
  { id: 'multi_rpg', cast: 'multi', label: '多人冒险', hint: '属性物品任务', modules: MODS_MULTI_BASE.concat(['attributes', 'items', 'quest', 'memory_summary', 'money']) },
  {
    id: 'multi_ntl', cast: 'multi', label: 'NTL 群像', hint: '全员同套亲密模块', nsfw: true,
    modules: MODS_MULTI_BASE.concat(['affection', 'trust', 'relation_stage', 'nsfw_thoughts', 'nsfw_breasts', 'nsfw_legs', 'nsfw_orgasm', 'corruption_stage']),
  },
  {
    id: 'multi_ntr', cast: 'multi', label: 'NTR 张力', hint: '关系张力+内心', nsfw: true,
    modules: MODS_MULTI_BASE.concat(['affection', 'trust', 'relation_stage', 'nsfw_thoughts', 'nsfw_vagina', 'nsfw_breasts', 'nsfw_act_state', 'corruption_stage']),
  },
  {
    id: 'multi_nsfw', cast: 'multi', label: '群像 NSFW', hint: '主详+身体模块', nsfw: true,
    modules: MODS_MULTI_BASE.concat(['affection', 'relation_stage']).concat(MODS_NSFW_CORE),
  },
]);

export const STATUS_BAR_MODES = Object.freeze([
  { id: 'mvu', label: 'MVU 变量模式（读取 stat_data）' },
  { id: 'text', label: '纯文本模式（解析 AI 输出标签）' },
]);

export const STATUS_BAR_SCRIPT_NAME = '[状态栏]前端展示';
export const STATUS_BAR_REGEX_NAME = '[美化]状态栏展示';
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
  return STATUS_BAR_PRESETS.find(function(p) { return p.id === id; }) || STATUS_BAR_PRESETS[0];
}

/** @param {string} id */
export function getModuleById(id) {
  return STATUS_BAR_MODULES.find(function(m) { return m.id === id; }) || null;
}

/** @param {'single'|'multi'} cast */
export function presetsForCast(cast) {
  return STATUS_BAR_PRESETS.filter(function(p) { return p.cast === cast; });
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

/**
 * 「只识别女角色」规则文案（写入识别提示词）
 * @param {boolean} femaleOnly
 */
export function describeFemaleOnlyRule(femaleOnly) {
  if (!femaleOnly) {
    return '5. 性别不限：男女及其他可识别人物均可列入。\n';
  }
  return '5. 【只识别女角色】仅输出女性/可作女主或女配追踪的人物；排除明确男性、纯雄性生物；性别不明且明显男性化的跳过；主角若为男性可仅作参考不强制列入。\n';
}

/**
 * 规范化路径项
 * @param {any} raw
 * @returns {PathItem}
 */
export function normalizePathItem(raw) {
  var path = String((raw && (raw.path || raw.name || raw.key)) || '').trim().replace(/^stat_data\./, '');
  var label = String((raw && (raw.label || raw.title || raw.description)) || path.split('.').pop() || '字段').trim();
  var group = String((raw && (raw.group || raw.section)) || '状态').trim() || '状态';
  var sample = raw && raw.sample != null ? String(raw.sample) : guessSample(path, raw && raw.type);
  var role = raw && raw.role != null ? String(raw.role) : '';
  var item = { path: path, label: label, group: group, sample: sample };
  if (role) item.role = role;
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
export function pathsFromMvuDesign(design, opts) {
  var vars = design && Array.isArray(design.variables) ? design.variables : [];
  var limit = (opts && opts.limit) || 48;
  var mainName = opts && opts.mainName ? String(opts.mainName) : '';
  return vars.slice(0, limit).map(function(v) {
    var path = String((v && (v.path || v.name)) || '').trim();
    var parts = path.split('.');
    var role = '';
    if (parts[0] === 'NPC' && parts[1]) role = parts[1];
    else if (mainName && (parts[0] === '角色' || parts[0] === mainName)) role = mainName || '主视角';
    return normalizePathItem({
      path: path,
      label: v && (v.description || v.label) ? String(v.description || v.label).slice(0, 24) : parts[parts.length - 1],
      group: parts.length > 1 ? parts[0] : '状态',
      type: v && v.type,
      sample: v && v.default != null ? String(v.default) : undefined,
      role: role,
    });
  }).filter(function(p) { return p.path; });
}

/**
 * 规范化人物项（selected 默认 true，支持取消勾选持久化）
 * @param {any} raw
 * @returns {CastCharacter|null}
 */
export function normalizeCastCharacter(raw) {
  var name = String((raw && (raw.name || raw.title || raw.comment)) || '').trim();
  if (!name) return null;
  return {
    name: name,
    aliases: Array.isArray(raw.aliases) ? raw.aliases.map(String) : [],
    identity: String((raw && (raw.identity || raw.role || raw.summary)) || '').slice(0, 120),
    source: String((raw && raw.source) || ''),
    selected: raw && raw.selected === false ? false : true,
  };
}

/**
 * 视觉方案 CSS（兼容旧 styleCss 名）
 * @param {string} styleOrDesignId
 */
export function styleCss(styleOrDesignId) {
  return designCss(migrateDesignId(styleOrDesignId, styleOrDesignId));
}

/**
 * 解析 design id（人数不匹配时回落默认）
 * @param {string|undefined} designId
 * @param {string} castMode
 * @param {string|undefined} [styleId]
 */
function resolveDesignId(designId, castMode, styleId) {
  var raw = designId || styleId || '';
  if (isCustomDesign(raw)) return CUSTOM_DESIGN_ID;
  var id = migrateDesignId(raw || defaultDesignId(castMode), styleId);
  var design = getDesignById(id);
  if (design.cast !== castMode) return defaultDesignId(castMode);
  return design.id;
}

/**
 * 自定义排版：把 AI 输出的 body 转为可注入片段（data-zb-path 占位）
 * @param {string} bodyHtml
 */
export function normalizeCustomBodyForSnippet(bodyHtml) {
  return String(bodyHtml || '').replace(
    /(<span[^>]*\bdata-zb-path="[^"]+"[^>]*>)[\s\S]*?(<\/span>)/gi,
    '$1—$2'
  );
}

/**
 * 自定义排版完整预览文档
 * @param {{ customCss?: string, customBodyHtml?: string, castMode?: string, title?: string }} opts
 */
export function buildCustomLayoutDocument(opts) {
  var css = String((opts && opts.customCss) || '');
  var body = String((opts && opts.customBodyHtml) || '');
  var castMode = (opts && opts.castMode) || 'single';
  if (!body.trim()) {
    body = '<div class="zb-custom-empty"><p>尚未生成自定义排版，请在左侧填写描述并点击「生成排版」。</p></div>';
    if (!css.trim()) {
      css = '.zb-custom-empty{color:#94a3b8;padding:24px;text-align:center;font-size:14px;}';
    }
  }
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><style>'
    + css
    + 'body{margin:0;padding:16px;background:#020617}</style></head><body>'
    + '<div class="zb-root" data-zb-design="' + escAttr(CUSTOM_DESIGN_ID)
    + '" data-zb-cast="' + escAttr(castMode) + '">' + body + '</div>'
    + '</body></html>';
}

/**
 * 自定义排版注入片段
 * @param {{ customCss?: string, customBodyHtml?: string, castMode?: string, mode?: string }} opts
 */
export function buildCustomLayoutSnippet(opts) {
  var css = String((opts && opts.customCss) || '');
  var body = normalizeCustomBodyForSnippet((opts && opts.customBodyHtml) || '');
  var castMode = (opts && opts.castMode) || 'single';
  var mode = (opts && opts.mode) || 'mvu';
  if (!body.trim()) {
    body = '<div class="zb-custom-empty">（自定义排版未生成）</div>';
  }
  return '<style id="zb-style">' + css + '</style>'
    + '<div class="zb-root" id="zb-status-root" data-zb-design="' + escAttr(CUSTOM_DESIGN_ID)
    + '" data-zb-mode="' + escAttr(mode) + '" data-zb-cast="' + escAttr(castMode) + '">'
    + body + '</div>';
}

/**
 * 用样本值渲染预览 HTML（一对一视觉主题）
 * @param {{ designId?: string, styleId?: string, layoutId?: string, paths: PathItem[], title?: string, values?: Record<string,string>, castMode?: string, characters?: CastCharacter[], mainName?: string }} opts
 */
export function buildPreviewHtml(opts) {
  var castMode = (opts && opts.castMode) || 'single';
  var designId = resolveDesignId(
    (opts && (opts.designId || opts.layoutId)) || '',
    castMode,
    opts && opts.styleId
  );
  if (isCustomDesign(designId)) {
    return buildCustomLayoutDocument({
      customCss: opts && opts.customCss,
      customBodyHtml: opts && opts.customBodyHtml,
      castMode: castMode,
      title: opts && opts.title,
    });
  }
  var paths = Array.isArray(opts && opts.paths) ? opts.paths.map(normalizePathItem) : [];
  var values = (opts && opts.values) || {};
  var title = String((opts && opts.title) || 'STATUS');
  var characters = Array.isArray(opts && opts.characters) ? opts.characters : [];
  var mainName = String((opts && opts.mainName) || (characters[0] && characters[0].name) || '');
  var css = designCss(designId);
  function valueFn(p) {
    return values[p.path] != null ? String(values[p.path]) : (p.sample || '—');
  }
  var body = renderDesignHtml({
    designId: designId,
    paths: paths,
    title: title,
    castMode: castMode,
    characters: characters,
    mainName: mainName,
    valueFn: valueFn,
    rawValueHtml: false,
  });
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' + css + 'body{margin:0;padding:16px;background:#020617}</style></head><body>'
    + '<div class="zb-root" data-zb-design="' + escAttr(designId) + '" data-zb-style="' + escAttr(designId)
    + '" data-zb-layout="' + escAttr(designId) + '" data-zb-cast="' + escAttr(castMode) + '">' + body + '</div>'
    + '</body></html>';
}

/**
 * 生成可注入的状态栏片段 HTML
 * @param {{ designId?: string, styleId?: string, layoutId?: string, paths: PathItem[], title?: string, mode?: string, castMode?: string, characters?: CastCharacter[], mainName?: string }} opts
 */
export function buildStatusBarSnippet(opts) {
  var castMode = (opts && opts.castMode) || 'single';
  var designId = resolveDesignId(
    (opts && (opts.designId || opts.layoutId)) || '',
    castMode,
    opts && opts.styleId
  );
  if (isCustomDesign(designId)) {
    return buildCustomLayoutSnippet({
      customCss: opts && opts.customCss,
      customBodyHtml: opts && opts.customBodyHtml,
      castMode: castMode,
      mode: (opts && opts.mode) || 'mvu',
    });
  }
  var mode = (opts && opts.mode) || 'mvu';
  var paths = Array.isArray(opts && opts.paths) ? opts.paths.map(normalizePathItem) : [];
  var title = String((opts && opts.title) || 'STATUS');
  var characters = Array.isArray(opts && opts.characters) ? opts.characters : [];
  var mainName = String((opts && opts.mainName) || (characters[0] && characters[0].name) || '');
  var css = designCss(designId);
  function valueFn(p) {
    if (mode === 'text') {
      return '<span class="zb-value" data-zb-tag="' + escAttr(p.path) + '">—</span>';
    }
    return '<span class="zb-value" data-zb-path="' + escAttr(p.path) + '">—</span>';
  }
  var body = renderDesignHtml({
    designId: designId,
    paths: paths,
    title: title,
    castMode: castMode,
    characters: characters,
    mainName: mainName,
    valueFn: valueFn,
    rawValueHtml: true,
  });
  return '<style id="zb-style">' + css + '</style>'
    + '<div class="zb-root" id="zb-status-root" data-zb-design="' + escAttr(designId)
    + '" data-zb-style="' + escAttr(designId) + '" data-zb-layout="' + escAttr(designId)
    + '" data-zb-mode="' + escAttr(mode) + '" data-zb-cast="' + escAttr(castMode) + '">'
    + body + '</div>';
}

/**
 * 酒馆助手常规脚本：监听 MVU 更新并刷新 data-zb-path
 * @param {{ snippetHtml: string, mode: string }} opts
 */
export function buildTavernHelperScript(opts) {
  var snippet = String((opts && opts.snippetHtml) || '');
  var mode = (opts && opts.mode) || 'mvu';
  var lit = JSON.stringify(snippet);
  return [
    '/* 状态栏前端展示 — 由卡片构建器生成 */',
    '(async function () {',
    '  const SNIPPET = ' + lit + ';',
    '  const MODE = ' + JSON.stringify(mode) + ';',
    '  const ROOT_ID = "zb-status-host";',
    '  function ensureHost() {',
    '    let host = document.getElementById(ROOT_ID);',
    '    if (!host) {',
    '      host = document.createElement("div");',
    '      host.id = ROOT_ID;',
    '      host.style.cssText = "position:sticky;top:0;z-index:20;padding:8px;pointer-events:none;";',
    '      const shebang = document.querySelector("#chat") || document.body;',
    '      shebang.prepend(host);',
    '    }',
    '    host.innerHTML = SNIPPET;',
    '    return host;',
    '  }',
    '  function readStat(path) {',
    '    try {',
    '      if (typeof Mvu !== "undefined" && Mvu.getMvuData) {',
    '        const data = Mvu.getMvuData({ type: "message", message_id: "latest" }) || Mvu.getMvuData();',
    '        const stat = (data && (data.stat_data || data.statData)) || data || {};',
    '        return path.split(".").reduce((o, k) => (o == null ? o : o[k]), stat);',
    '      }',
    '    } catch (e) {}',
    '    return undefined;',
    '  }',
    '  function refresh() {',
    '    const host = ensureHost();',
    '    if (MODE !== "mvu") return;',
    '    host.querySelectorAll("[data-zb-path]").forEach((el) => {',
    '      const path = el.getAttribute("data-zb-path");',
    '      const v = readStat(path);',
    '      el.textContent = v == null || v === "" ? "—" : String(v);',
    '    });',
    '  }',
    '  ensureHost();',
    '  refresh();',
    '  try {',
    '    if (typeof eventOn === "function" && typeof tavern_events !== "undefined") {',
    '      eventOn(tavern_events.CHARACTER_MESSAGE_RENDERED, refresh);',
    '      eventOn(tavern_events.USER_MESSAGE_RENDERED, refresh);',
    '    }',
    '    if (typeof eventOn === "function" && typeof Mvu !== "undefined" && Mvu.events && Mvu.events.VARIABLE_UPDATE_ENDED) {',
    '      eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, refresh);',
    '    }',
    '  } catch (e) {}',
    '})();',
  ].join('\n');
}

/**
 * 纯文本模式：正则把 <StatusBar>...</StatusBar> 美化为 HTML
 * @param {{ snippetHtml: string }} opts
 */
export function buildStatusBarRegex(opts) {
  var snippet = String((opts && opts.snippetHtml) || '');
  var replace = snippet
    .replace(/\$/g, '$$')
    .replace(/\[data-zb-tag="([^"]+)"\][\s\S]*?<\/span>/g, function(_, tag) {
      return '[data-zb-tag="' + tag + '">$1</span>';
    });
  return {
    id: 'statusbar_display',
    scriptName: STATUS_BAR_REGEX_NAME,
    findRegex: '<StatusBar>([\\s\\S]*?)</StatusBar>',
    replaceString: replace || '<div class="zb-root">$1</div>',
    trimStrings: [],
    placement: [2],
    disabled: false,
    markdownOnly: true,
    promptOnly: false,
    runOnEdit: true,
    substituteRegex: false,
    minDepth: null,
    maxDepth: null,
  };
}

/**
 * 设计对象持久化形状
 * @param {any} partial
 */
export function normalizeDesign(partial) {
  var p = partial || {};
  var castMode = p.castMode === 'multi' ? 'multi' : 'single';
  var presetId = p.presetId || (castMode === 'multi' ? 'multi_party' : 'single_daily');
  if (!getPresetById(presetId) || getPresetById(presetId).cast !== castMode) {
    presetId = castMode === 'multi' ? 'multi_party' : 'single_daily';
  }
  var nsfw = !!p.nsfw;
  var moduleFlags = resolveModuleFlags(presetId, p.moduleFlags || p.modules, nsfw);
  var characters = Array.isArray(p.characters)
    ? p.characters.map(normalizeCastCharacter).filter(Boolean)
    : [];
  var mainName = String(p.mainName || '').trim();
  if (castMode === 'multi' && !mainName && characters.length) {
    var firstSel = characters.find(function(c) { return c.selected !== false; });
    mainName = (firstSel || characters[0]).name;
  }
  // designId 优先；兼容旧 layoutId/styleId 并 migrate
  var designId = resolveDesignId(
    p.designId || p.layoutId || p.layout,
    castMode,
    p.styleId || p.style
  );
  return {
    mode: p.mode === 'text' ? 'text' : 'mvu',
    castMode: castMode,
    presetId: presetId,
    nsfw: nsfw,
    femaleOnly: p.femaleOnly !== false, // 默认只识别女角色
    moduleFlags: moduleFlags,
    characters: characters,
    mainName: mainName,
    designId: designId,
    // 兼容旧字段：layoutId/styleId 均写为同一 design
    styleId: designId,
    layoutId: designId,
    extra: String(p.extra || ''),
    customPrompt: String(p.customPrompt || ''),
    customBaseDesignId: String(p.customBaseDesignId || ''),
    customCss: String(p.customCss || ''),
    customBodyHtml: String(p.customBodyHtml || ''),
    paths: Array.isArray(p.paths) ? p.paths.map(normalizePathItem).filter(function(x) { return x.path; }) : [],
    snippetHtml: String(p.snippetHtml || ''),
    helperScript: String(p.helperScript || ''),
    updatedAt: p.updatedAt || new Date().toISOString(),
  };
}

/**
 * 按开启模块生成预览占位路径（设计态联动；不依赖已生成 paths 缓存）
 * 多人：入选每人生成相同模块字段（信息量一致），世界/任务/事件仍各一份
 * @param {{ castMode?: string, mainName?: string, moduleFlags?: Record<string, boolean>, characters?: CastCharacter[] }} opts
 * @returns {PathItem[]}
 */
export function buildPlaceholderPaths(opts) {
  var o = opts || {};
  var castMode = o.castMode === 'multi' ? 'multi' : 'single';
  var flags = o.moduleFlags || {};
  var main = String(o.mainName || '角色').trim() || '角色';
  var base = [];

  function push(path, label, group, sample, role) {
    base.push(normalizePathItem({ path: path, label: label, group: group, sample: sample, role: role || '' }));
  }

  // 世界 / 任务 / 事件：全局一份
  if (flags.time_weather) {
    push('世界.当前时间', '时间', '世界', '08:30');
    push('世界.天气', '天气', '世界', '晴');
  }
  if (flags.location) push('世界.当前地点', '地点', '世界', '咖啡馆');
  if (flags.quest) push('任务.当前', '任务', '任务', '调查线索');
  if (flags.event_chips) push('事件.标签', '事件', '事件', '同行');

  // 入选角色名单：多人按勾选全员；单人仅主名
  var names = [];
  if (castMode === 'multi') {
    var chars = Array.isArray(o.characters) ? o.characters : [];
    names = chars
      .filter(function(c) { return c && c.selected !== false && String(c.name || '').trim(); })
      .map(function(c) { return String(c.name).trim(); });
    if (!names.length) names = [main];
  } else {
    names = [main];
  }

  var nsfwMap = [
    ['nsfw_thoughts', '内心', '隐秘心声'],
    ['nsfw_breasts', '双乳', '柔软'],
    ['nsfw_vagina', '小穴', '湿润'],
    ['nsfw_legs', '美腿', '修长'],
    ['nsfw_feet', '美脚', '轻颤'],
    ['nsfw_anus', '屁穴', '紧致'],
    ['nsfw_mouth', '口腔', '微张'],
    ['nsfw_erogenous', '敏感带', '发烫'],
    ['nsfw_orgasm', '快感', '62'],
    ['nsfw_fluids', '体液', '微量'],
    ['nsfw_exposure', '露出', '低'],
    ['nsfw_training', '调教', '无'],
    ['nsfw_experience', '性经验', '摘要'],
    ['nsfw_act_state', '性行为', '无'],
  ];

  /** 为单名角色写入与开启模块一一对应的同套字段 */
  function pushCharFields(name) {
    var prefix = castMode === 'multi' ? ('NPC.' + name) : '角色';
    var role = castMode === 'multi' ? name : name;
    var group = castMode === 'multi' ? 'NPC' : '角色';

    if (flags.emotion) push(prefix + '.情绪', '情绪', group, '平静', role);
    if (flags.action) push(prefix + '.行动', '行动', group, '闲聊', role);
    if (flags.outfit) push(prefix + '.着装', '着装', group, '便装', role);
    if (flags.affection) push(prefix + '.好感度', '好感', group, '42', role);
    if (flags.trust) push(prefix + '.信任', '信任', group, '30', role);
    if (flags.relation_stage) push(prefix + '.关系阶段', '关系', group, '熟人', role);
    if (flags.corruption_stage) push(prefix + '.恶堕进度', '恶堕进度', '亲密', '未触碰', role);
    if (flags.attributes) {
      push(prefix + '.体力', '体力', '属性', '78', role);
      push(prefix + '.魔力', '魔力', '属性', '55', role);
    }
    if (flags.items) push(prefix + '.物品', '物品', group, '钥匙扣', role);
    if (flags.money) push(prefix + '.金钱', '金钱', group, '320', role);
    if (flags.memory_summary) push(prefix + '.记忆', '记忆', group, '初遇约定', role);

    nsfwMap.forEach(function(row) {
      if (!flags[row[0]]) return;
      push(prefix + '.' + row[1], row[1], '亲密', row[2], role);
    });
  }

  names.forEach(pushCharFields);

  if (!base.length) {
    push('世界.当前时间', '时间', '世界', '08:30');
    names.forEach(function(name) {
      var prefix = castMode === 'multi' ? ('NPC.' + name) : '角色';
      push(prefix + '.情绪', '情绪', castMode === 'multi' ? 'NPC' : '角色', '平静', name);
    });
  }
  return base;
}

/** AI 路径规划（兼容旧调用） */
export const STATUS_BAR_PATHS_PROMPT =
  '你是 SillyTavern 状态栏设计师。根据角色与配置，规划状态栏要展示的变量路径。\n'
  + '{{charBlock}}\n'
  + '模式：{{mode}}\n视觉方案：{{design}}\n'
  + '额外要求：{{extra}}\n'
  + '已有 MVU 路径（可复用）：{{mvuPaths}}\n'
  + '规则：\n'
  + '1. 只输出 JSON，不要解释。\n'
  + '2. 格式：{ "paths": [ { "path":"世界.当前时间", "label":"时间", "group":"世界", "sample":"08:00" } ], "title":"STATUS" }\n'
  + '3. path 用点分路径；数量 6~16 个；group 便于分组布局。\n'
  + '4. MVU 模式优先复用已有路径；没有则设计合理新路径。\n'
  + '5. 纯文本模式 path 用作标签名（如 HP、Mood）。\n';

/** 从世界书识别人物条目 */
export const STATUS_BAR_CHAR_SCAN_PROMPT =
  '你是 SillyTavern 世界书人物识别器。根据世界书条目列表，找出可作为状态栏追踪对象的人物。\n'
  + '{{wbBlock}}\n'
  + '当前卡主角（可作参考）：{{charName}}\n'
  + '规则：\n'
  + '1. 只输出 JSON，不要解释。\n'
  + '2. 格式：{ "characters": [ { "name":"姓名", "aliases":[], "identity":"一句话身份", "source":"来源条目标题" } ] }\n'
  + '3. 优先条目标题/内容像角色卡、人物档案、配角的；忽略纯地点/势力/规则。\n'
  + '4. 最多 12 人；name 用最常用称呼。\n'
  + '{{femaleOnlyRule}}';

/** 状态栏驱动的整套 MVU 变量设计（覆盖写入） */
export const STATUS_BAR_MVU_DESIGN_PROMPT =
  '你是 SillyTavern MVU 变量系统设计专家。请根据状态栏配置设计完整变量 JSON。'
  + '不要输出 zod/YAML/解释；本地会组装注入产物。\n\n'
  + '{{charBlock}}\n'
  + '人数模式：{{castMode}}\n'
  + '默认高亮（可选）：{{mainName}}\n'
  + '入选人物：{{castList}}\n'
  + '视觉排版：{{design}}（变量先于排版生成，此处仅作参考）\n'
  + '开启模块：\n{{moduleBlock}}\n'
  + 'NSFW：{{nsfw}}\n'
  + '额外要求：{{extra}}\n'
  + '\n【设计原则】\n'
  + '1. 只为开启的模块生成对应变量；NSFW=否时禁止身体私密字段；禁止「配角摘要」类冗余路径。\n'
  + '2. 单人：路径可用「角色.字段」或「世界.字段」。\n'
  + '3. 多人：世界/任务/事件各一份；入选名单中【每一个人】都必须用 NPC.姓名.字段 生成与开启模块一一对应的【完整同套】详字段；信息量人人相等，禁止只给主视角建详、禁止给其他人建精简/摘要块。\n'
  + '4. 变量须可被剧情更新；单人约 16~40；多人随人数增加（每人同套模块字段）。\n'
  + '5. type 仅 string/number/boolean/enum/array/object；enum 必给 options。\n'
  + '6. check 为数组，说明更新条件。\n'
  + '\n【输出】仅 JSON：\n'
  + '{ "summary":"摘要", "variables":[ { "path":"世界.当前时间", "type":"string", "default":"08:00", "description":"时间", "check":["推进时间时更新"] } ] }\n';

/** 自定义排版 AI 提示（基于变量 + MVU 规则生成 HTML/CSS） */
export const STATUS_BAR_CUSTOM_LAYOUT_PROMPT =
  '你是 SillyTavern 状态栏前端排版工程师。根据已生成的 MVU 变量与用户需求，输出可注入的 HTML 结构与 CSS。\n\n'
  + '{{charBlock}}\n'
  + '人数模式：{{castMode}}\n'
  + '主视角：{{mainName}}\n'
  + '入选人物：{{castList}}\n'
  + 'NSFW：{{nsfw}}\n'
  + '开启模块：\n{{moduleBlock}}\n\n'
  + '【变量路径（必须全部可见，禁止硬截断）】\n{{pathBlock}}\n\n'
  + '{{baseBlock}}\n'
  + '{{previousBlock}}\n'
  + '【用户排版要求】\n{{userPrompt}}\n\n'
  + '【MVU 绑定规则】\n'
  + '1. 每个变量值用 <span class="zb-value" data-zb-path="完整路径">示例值</span> 绑定；示例值取自 path 的 sample。\n'
  + '2. 多人：每个 NPC 字段路径形如 NPC.姓名.字段；世界/任务/事件全局一份。\n'
  + '3. CSS 类名建议 zb-custom- 前缀，避免污染全局；勿用外部 CDN。\n'
  + '4. 禁止 <script>；禁止内联 onclick；结构须响应式（窄屏可读）。\n'
  + '5. 若提供基准主题，可在其结构/气质上按用户要求改造，但须重写 CSS/HTML 输出。\n'
  + '6. 若提供当前排版，在其基础上按新要求迭代修改。\n\n'
  + '【输出】仅 JSON，不要解释：\n'
  + '{ "css": "/* 完整 CSS */", "bodyHtml": "<div class=\\"zb-custom-root\\">...</div>" }\n';

function escAttr(s) {
  return escHtml(s).replace(/'/g, '&#39;');
}
