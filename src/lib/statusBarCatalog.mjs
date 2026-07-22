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
  'nsfw_training', 'nsfw_experience', 'nsfw_act_state',
];
/** 恶堕进度默认只进多人预设（绑世界书人物）；单人预设不挂主角「角色.恶堕进度」 */
const MODS_CORRUPTION = ['corruption_stage'];
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
  { id: 'single_ntl', cast: 'single', label: 'NTL 亲密', nsfw: true, hint: '恋爱+内心身体', modules: MODS_ROMANCE.concat(['nsfw_thoughts', 'nsfw_breasts', 'nsfw_legs', 'nsfw_orgasm', 'nsfw_act_state']) },
  { id: 'single_ntr', cast: 'single', label: 'NTR 张力', nsfw: true, hint: '关系张力+身体', modules: MODS_ROMANCE.concat(['nsfw_thoughts', 'nsfw_vagina', 'nsfw_breasts', 'nsfw_fluids', 'nsfw_act_state']) },
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
    modules: MODS_MULTI_BASE.concat(['affection', 'trust', 'relation_stage', 'nsfw_thoughts', 'nsfw_breasts', 'nsfw_legs', 'nsfw_orgasm']).concat(MODS_CORRUPTION),
  },
  {
    id: 'multi_ntr', cast: 'multi', label: 'NTR 张力', hint: '关系张力+内心', nsfw: true,
    modules: MODS_MULTI_BASE.concat(['affection', 'trust', 'relation_stage', 'nsfw_thoughts', 'nsfw_vagina', 'nsfw_breasts', 'nsfw_act_state']).concat(MODS_CORRUPTION),
  },
  {
    id: 'multi_nsfw', cast: 'multi', label: '群像 NSFW', hint: '主详+身体模块', nsfw: true,
    modules: MODS_MULTI_BASE.concat(['affection', 'relation_stage']).concat(MODS_NSFW_CORE).concat(MODS_CORRUPTION),
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
