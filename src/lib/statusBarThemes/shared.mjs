/**
 * 状态栏主题共享逻辑（仅工具 / 分类 / 迁移映射）
 * 禁止：通用美化骨架、cell/gutter/attrBox 等样式组件
 */

/** 旧 layout / style / multi id → 新 design id */
export const DESIGN_MIGRATE = Object.freeze({
  // 旧 layout
  hero_sheet: 'sheet_attr',
  dual_rail: 'form_sections',
  attr_grid: 'sheet_attr',
  info_cards: 'romance_glow',
  progress_ladder: 'scifi_console',
  fold_blocks: 'form_sections',
  chip_detail: 'neon_monitor',
  hud_strip: 'scifi_console',
  bento_tiles: 'romance_glow',
  compact_groups: 'form_sections',
  meter_board: 'sheet_attr',
  multi_switch: 'multi_frost_blue',
  multi_side_cast: 'multi_snow_glass',
  multi_hierarchy: 'multi_scrapbook',
  multi_fold_cast: 'multi_oz_green',
  multi_cast_hud: 'multi_romance_glass',
  grouped: 'form_sections',
  list: 'form_sections',
  grid: 'romance_glow',
  dashboard: 'scifi_console',
  multi_bar: 'multi_frost_blue',
  // 旧多人主题 → 新美学族
  multi_pill_sheet: 'multi_frost_blue',
  multi_cast_nested: 'multi_scrapbook',
  multi_tab_sections: 'multi_romance_glass',
  multi_side_panel: 'multi_snow_glass',
  multi_fold_elegant: 'multi_oz_green',
  // 旧 style 近似映射 → 对应 family 单人版
  modern_glass: 'sheet_attr',
  urban: 'neon_monitor',
  wuxia: 'form_sections',
  xianxia: 'xianxia_scroll',
  ink: 'ink_paper',
  court: 'xianxia_scroll',
  western_fantasy: 'sheet_attr',
  dark_fantasy: 'scifi_console',
  apocalypse: 'neon_monitor',
  cyberpunk: 'neon_monitor',
  scifi: 'scifi_console',
  romance: 'romance_glow',
  ntl: 'romance_glow',
  ntr: 'romance_glow',
  campus: 'romance_glow',
  mystery: 'ink_paper',
  military: 'scifi_console',
  lovecraft: 'ink_paper',
  neumorphism: 'frost_blue',
  material: 'sheet_attr',
  pixel: 'scifi_console',
  steampunk: 'mahogany_dossier',
  zen: 'ink_paper',
  bento: 'scrapbook',
  fui: 'scifi_console',
  glass_plus: 'frost_blue',
  custom: 'sheet_attr',
  frost: 'frost_blue',
  sweet: 'sweet_pink',
  scrap: 'scrapbook',
  snow: 'snow_glass',
  oz: 'oz_green',
  lavender: 'soft_lavender',
  mahogany: 'mahogany_dossier',
});

/** @param {string} s */
export function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** @param {string} s */
export function escAttr(s) {
  return escHtml(s).replace(/'/g, '&#39;');
}

/** @param {string} s */
export function stripTags(s) {
  return String(s || '').replace(/<[^>]+>/g, '');
}

/** @param {string} sample */
export function guessPct(sample) {
  var n = parseFloat(String(sample || '').replace(/[^\d.]/g, ''));
  if (!isFinite(n)) return 55;
  if (n <= 1) return Math.round(n * 100);
  if (n <= 100) return Math.round(n);
  return Math.min(100, Math.round(n % 100) || 60);
}

/** 路径语义分类 */
export function classifyPath(p) {
  var s = ((p && p.label) || '') + ' ' + ((p && p.path) || '') + ' ' + ((p && p.group) || '');
  if (/时间|天气|地点|位置|场景|日期/i.test(s)) return 'meta';
  if (/好感|信任|亲密度|体力|魔力|生命|理智|金钱|等级|进度|快感|高潮|hp|mp|san/i.test(s)) return 'meter';
  if (/内心|双乳|小穴|美腿|美脚|屁穴|口腔|敏感|体液|露出|调教|性经验|性行为|亲密/i.test(s)) return 'nsfw';
  if (/物品|道具|任务|事件|记忆|线索/i.test(s)) return 'items';
  if (/情绪|心情|行动|着装|关系|阶段|状态/i.test(s)) return 'narrative';
  return 'attr';
}

/** 拆桶：meta / meters / narrative / nsfw / items / attr */
export function bucketPaths(paths) {
  var meta = [];
  var meters = [];
  var narrative = [];
  var nsfw = [];
  var items = [];
  var attr = [];
  (paths || []).forEach(function(p) {
    var k = classifyPath(p);
    if (k === 'meta') meta.push(p);
    else if (k === 'meter') meters.push(p);
    else if (k === 'narrative') narrative.push(p);
    else if (k === 'nsfw') nsfw.push(p);
    else if (k === 'items') items.push(p);
    else attr.push(p);
  });
  return { meta: meta, meters: meters, narrative: narrative, nsfw: nsfw, items: items, attr: attr };
}

/** 世界级：无 role，且 meta 或 group∈{世界,任务,事件}（对齐 softmonLayout.worldPaths） */
export function worldScopedPaths(all) {
  return (all || []).filter(function(p) {
    if (p.role) return false;
    return classifyPath(p) === 'meta' || /^(世界|任务|事件)/.test(p.group || '');
  });
}

/** 指定角色路径 */
export function rolePaths(all, name) {
  return (all || []).filter(function(p) { return p.role === name; });
}

/** 全局任务/事件（无 role；classify 多在 items） */
export function globalQuestEventPaths(all) {
  return (all || []).filter(function(p) {
    if (p.role) return false;
    return /事件|任务/.test((p.label || '') + (p.path || '') + (p.group || ''));
  });
}

/**
 * 清晰分桶：bucketPaths + questEvents / bag（物品记忆等非任务事件）
 * 主题应从此取任务事件，勿在 narrative 里硬匹配
 */
export function displayBuckets(paths) {
  var b = bucketPaths(paths);
  var questEvents = [];
  var bag = [];
  (b.items || []).forEach(function(p) {
    var s = (p.label || '') + (p.path || '') + (p.group || '');
    if (/任务|事件/.test(s)) questEvents.push(p);
    else bag.push(p);
  });
  return {
    meta: b.meta,
    meters: b.meters,
    narrative: b.narrative,
    nsfw: b.nsfw,
    items: b.items,
    attr: b.attr,
    questEvents: questEvents,
    bag: bag,
  };
}

/**
 * 角色卡字段：条形 meters + 明细 detail（全量、无截断、尽量无重复）
 * @returns {{ meters: any[], detail: any[], nsfw: any[], buckets: object }}
 */
export function roleFieldLists(paths) {
  var b = bucketPaths(paths);
  var meters = b.meters.length ? b.meters : b.attr;
  var detail = b.narrative.concat(b.items).concat(b.nsfw);
  if (b.meters.length) detail = detail.concat(b.attr);
  return { meters: meters, detail: detail, nsfw: b.nsfw, buckets: b };
}

/**
 * 未进入任何分区的 path → 供 overflow / 属性区兜底
 * @param {any[]} allPaths
 * @param {any[]} usedPaths
 */
export function ensureCoverage(allPaths, usedPaths) {
  var used = Object.create(null);
  (usedPaths || []).forEach(function(p) {
    if (!p) return;
    if (p.path) used['p:' + p.path] = true;
    used['l:' + String(p.label || '') + '\0' + String(p.group || '')] = true;
  });
  return (allPaths || []).filter(function(p) {
    if (!p) return false;
    if (p.path && used['p:' + p.path]) return false;
    return !used['l:' + String(p.label || '') + '\0' + String(p.group || '')];
  });
}

/**
 * 预览 HTML 中未出现的 path.label（验收用）
 * @param {any[]} paths
 * @param {string} html
 */
export function orphanPaths(paths, html) {
  var h = String(html || '');
  return (paths || []).filter(function(p) {
    var lab = String((p && p.label) || '');
    if (!lab) return false;
    return h.indexOf(lab) < 0 && h.indexOf(escHtml(lab)) < 0;
  });
}

/**
 * 世界 meta 行：带 label，避免只拼 sample 导致 orphan
 * @param {any[]} metaPaths
 * @param {{ plain: Function }} ctx
 * @param {string} [sep]
 */
export function formatMetaLine(metaPaths, ctx, sep) {
  return (metaPaths || []).map(function(p) {
    var v = ctx.plain(p);
    if (!v && v !== 0) return '';
    return String(p.label || '') + ' ' + v;
  }).filter(Boolean).join(sep || ' · ');
}

/**
 * 全局任务/事件区 HTML（主题传入 wrapClass 套皮）
 * @param {any[]} all
 * @param {{ val: Function }} ctx
 * @param {string} [wrapClass]
 */
export function questEventSectionHtml(all, ctx, wrapClass) {
  var list = globalQuestEventPaths(all);
  if (!list.length) return '';
  var w = wrapClass || 'zb-qe';
  return '<div class="' + w + '"><div class="' + w + '-h">任务 / 事件</div><div class="' + w + '-rail">'
    + list.map(function(p) {
      return '<span class="' + w + '-chip"><b>' + escHtml(p.label) + '</b> ' + ctx.val(p) + '</span>';
    }).join('') + '</div></div>';
}

/** 多人：只保留主视角相关路径 */
export function filterMainPaths(paths, main) {
  var mainPaths = (paths || []).filter(function(p) {
    if (!p.role) return /^(世界|任务|事件|角色)/.test(p.group || '') || p.group === main || !p.group;
    return p.role === main || p.role === '主视角';
  });
  if (!mainPaths.length) mainPaths = (paths || []).slice(0, Math.min(12, (paths || []).length));
  return mainPaths;
}

/**
 * @param {Function} valueFn
 * @param {boolean} [rawValueHtml]
 */
export function makeCtx(valueFn, rawValueHtml) {
  function plain(p) {
    return rawValueHtml ? stripTags(valueFn(p)) : String(valueFn(p));
  }
  function val(p) {
    var v = valueFn(p);
    return rawValueHtml ? v : '<span class="zb-value">' + escHtml(v) + '</span>';
  }
  return { plain: plain, val: val };
}

/**
 * 旧 layout/style id → 新 design id
 * @param {string} [oldLayoutId]
 * @param {string} [oldStyleId]
 * @param {string[]} [knownIds] 当前已注册主题 id（由 index 传入）
 * @param {string} [fallback] 无匹配时回落
 */
export function migrateDesignId(oldLayoutId, oldStyleId, knownIds, fallback) {
  var known = knownIds || [];
  function isKnown(id) {
    return known.indexOf(id) >= 0;
  }
  var a = String(oldLayoutId || '');
  if (isKnown(a)) return a;
  if (DESIGN_MIGRATE[a]) return DESIGN_MIGRATE[a];
  var b = String(oldStyleId || '');
  if (isKnown(b)) return b;
  if (DESIGN_MIGRATE[b]) return DESIGN_MIGRATE[b];
  return a || fallback || 'sheet_attr';
}
