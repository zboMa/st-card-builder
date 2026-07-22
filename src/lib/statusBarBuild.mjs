/** 状态栏：路径解析 / 预览 / 脚本拼装（拆自 statusBar） */
import {
  normalizePathItem,
  isCustomDesign,
  CUSTOM_DESIGN_ID,
  getPresetById,
  resolveModuleFlags,
  STATUS_BAR_REGEX_NAME,
  STATUS_BAR_SCRIPT_NAME,
  getDesignById,
  defaultDesignId,
  migrateDesignId,
  designCss,
  renderDesignHtml,
} from './statusBarCatalog.mjs';
import { escHtml } from './statusBarThemes/index.mjs';

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
