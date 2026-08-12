/** 状态栏：路径解析 / 预览 / 脚本拼装（拆自 statusBar） */
import {
  normalizePathItem,
  isCustomDesign,
  CUSTOM_DESIGN_ID,
  getPresetById,
  resolveModuleFlags,
  STATUS_BAR_REGEX_NAME,
  STATUS_BAR_SCRIPT_NAME,
  STATUS_BAR_PLACEHOLDER,
  getDesignById,
  defaultDesignId,
  migrateDesignId,
  designCss,
  renderDesignHtml,
} from './statusBarCatalog.mjs';
import { escHtml } from './statusBarThemes/index.mjs';
import {
  isPersonWorldbookEntry,
  personNameFromWorldbookEntry,
} from './novel/sync.mjs';

export function collectPersonCharactersFromWorldbook(entries, opts) {
  var o = opts || {};
  var exclude = String(o.excludeName || '').trim();
  var seen = Object.create(null);
  var out = [];
  (entries || []).forEach(function(e) {
    if (!e || !isPersonWorldbookEntry(e)) return;
    var name = personNameFromWorldbookEntry(e);
    if (!name || seen[name]) return;
    if (exclude && name === exclude) return;
    seen[name] = true;
    var identity = String(e.content || '').trim().split(/\n/)[0].slice(0, 120);
    var c = normalizeCastCharacter({
      name: name,
      identity: identity,
      aliases: Array.isArray(e.keys) ? e.keys : [],
      selected: true,
      source: 'worldbook',
    });
    if (c) out.push(c);
  });
  var merge = Array.isArray(o.merge) ? o.merge : [];
  merge.forEach(function(raw) {
    var c = normalizeCastCharacter(raw);
    if (!c || !c.name || seen[c.name]) return;
    seen[c.name] = true;
    out.push(c);
  });
  return out;
}

/** @param {any[]} entries @param {string} name */
export function findWorldbookPersonEntry(entries, name) {
  var target = String(name || '').trim();
  if (!target) return null;
  for (var i = 0; i < (entries || []).length; i++) {
    var e = entries[i];
    if (!e || !isPersonWorldbookEntry(e)) continue;
    if (personNameFromWorldbookEntry(e) === target) return e;
  }
  return null;
}

/**
 * 多人：当前卡角色名始终在入选列表首位且 selected=true
 * @param {import('./statusBarBuild.mjs').CastCharacter[]} characters
 * @param {{ name?: string, desc?: string, firstMes?: string }} card
 */
export function ensureCardProtagonistInCast(characters, card) {
  var list = Array.isArray(characters) ? characters.slice() : [];
  var cardName = String((card && card.name) || '').trim();
  if (!cardName) return list;
  var identity = String((card && card.desc) || '').trim().split(/\n/)[0].slice(0, 120);
  var idx = list.findIndex(function(c) { return c && c.name === cardName; });
  if (idx >= 0) {
    var cur = Object.assign({}, list[idx], { selected: true });
    if (!cur.identity && identity) cur.identity = identity;
    if (!cur.source) cur.source = 'card';
    list.splice(idx, 1);
    list.unshift(cur);
    return list;
  }
  var added = normalizeCastCharacter({
    name: cardName,
    identity: identity || '（角色设定）',
    selected: true,
    source: 'card',
  });
  if (added) list.unshift(added);
  return list;
}

/**
 * MVU / 自定义排版：入选人物档案（平等格式，不分主配）
 * @param {{ castMode?: string, selected?: import('./statusBarBuild.mjs').CastCharacter[], card?: { name?: string, desc?: string, firstMes?: string }, worldbookEntries?: any[] }} opts
 */
export function buildCastProfileBlock(opts) {
  var o = opts || {};
  var castMode = o.castMode === 'multi' ? 'multi' : 'single';
  var card = o.card || {};
  var cardName = String(card.name || '').trim();
  var selected = Array.isArray(o.selected) ? o.selected.filter(function(c) {
    return c && c.selected !== false && String(c.name || '').trim();
  }) : [];
  if (castMode === 'single' && cardName) {
    selected = [normalizeCastCharacter({ name: cardName, selected: true })].filter(Boolean);
  }
  if (!selected.length) return '（暂无入选人物）';

  var wbIndex = Object.create(null);
  (o.worldbookEntries || []).forEach(function(e) {
    if (!e || !isPersonWorldbookEntry(e)) return;
    var n = personNameFromWorldbookEntry(e);
    if (n && !wbIndex[n]) wbIndex[n] = e;
  });

  var lines = [
    '【入选人物档案】',
    '以下 ' + selected.length + ' 人为状态栏追踪对象；为每人生成相同 variables 字段集（path 仅姓名段不同，禁止因档案长短减字段）。',
  ];

  selected.forEach(function(c) {
    var name = String(c.name || '').trim();
    if (!name) return;
    lines.push('');
    lines.push('■ ' + name);
    if (name === cardName && (card.desc || card.firstMes)) {
      if (card.desc) lines.push('描述：' + String(card.desc));
      if (card.firstMes) lines.push('开场白：' + String(card.firstMes));
    } else {
      var entry = wbIndex[name];
      var content = entry ? String(entry.content || '').trim() : '';
      if (content) {
        lines.push('档案：' + content);
      } else if (c.identity) {
        lines.push('档案：' + String(c.identity));
        lines.push('（无独立世界书人物条目；variables 字段仍须与同套 path 一致）');
      } else {
        lines.push('档案：（暂无正文；variables 字段仍须与同套 path 一致）');
      }
    }
  });
  return lines.join('\n');
}

export function pathsFromMvuDesign(design, opts) {
  var vars = design && Array.isArray(design.variables) ? design.variables : [];
  var o = opts || {};
  var slice = vars;
  if (typeof o.limit === 'number' && o.limit > 0) {
    slice = vars.slice(0, o.limit);
  }
  var mainName = o.mainName ? String(o.mainName) : '';
  return slice.map(function(v) {
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

function buildStatusBarMvuRefreshScript() {
  return [
    '<script type="module">',
    '(async function(){',
    '  function readStat(path){',
    '    try{',
    '      if(typeof Mvu!=="undefined"&&Mvu.getMvuData){',
    '        const data=Mvu.getMvuData({type:"message",message_id:"latest"})||Mvu.getMvuData();',
    '        const stat=(data&&(data.stat_data||data.statData))||data||{};',
    '        return String(path||"").split(".").reduce(function(o,k){return o==null?o:o[k];},stat);',
    '      }',
    '    }catch(e){}',
    '    return undefined;',
    '  }',
    '  function refresh(root){',
    '    if(!root)return;',
    '    root.querySelectorAll("[data-zb-path]").forEach(function(el){',
    '      var path=el.getAttribute("data-zb-path");',
    '      var v=readStat(path);',
    '      el.textContent=(v==null||v==="")?"—":String(v);',
    '    });',
    '  }',
    '  async function boot(){',
    '    if(typeof waitGlobalInitialized==="function"){try{await waitGlobalInitialized("Mvu");}catch(e){}}',
    '    var root=document.querySelector(".zb-root")||document.body;',
    '    refresh(root);',
    '    if(typeof eventOn==="function"&&typeof Mvu!=="undefined"&&Mvu.events&&Mvu.events.VARIABLE_UPDATE_ENDED){',
    '      eventOn(Mvu.events.VARIABLE_UPDATE_ENDED,function(){refresh(root);});',
    '    }',
    '  }',
    '  if(typeof errorCatched==="function")errorCatched(boot);else boot();',
    '})();',
    '</script>',
  ].join('');
}

/**
 * MVU 正则替换用完整 HTML 文档（```html 围栏内）
 * @param {string} snippetHtml
 */
export function buildStatusBarRegexHtmlDocument(snippetHtml) {
  var snippet = String(snippetHtml || '').trim();
  return '<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n</head>\n<body>\n'
    + snippet + '\n' + buildStatusBarMvuRefreshScript() + '\n</body>\n</html>';
}

export function formatStatusBarRegexReplace(doc) {
  return '```html\n' + String(doc || '') + '\n```';
}

function baseStatusBarRegexFields(replaceString) {
  return {
    id: 'statusbar_display',
    scriptName: STATUS_BAR_REGEX_NAME,
    replaceString: replaceString,
    trimStrings: [],
    placement: [2],
    disabled: false,
    markdownOnly: true,
    promptOnly: false,
    runOnEdit: true,
    substituteRegex: 0,
    minDepth: null,
    maxDepth: null,
  };
}

/**
 * MVU：匹配 <StatusPlaceHolderImpl/> → ```html 状态栏（与变量正则同级）
 * 纯文本：匹配 <StatusBar>...</StatusBar>
 * @param {{ snippetHtml: string, mode?: string }} opts
 */
export function buildStatusBarRegex(opts) {
  opts = opts || {};
  var snippet = String(opts.snippetHtml || '');
  var mode = opts.mode || 'mvu';
  if (mode === 'text') {
    var replaceText = snippet
      .replace(/\$/g, '$$')
      .replace(/\[data-zb-tag="([^"]+)"\][\s\S]*?<\/span>/g, function(_, tag) {
        return '[data-zb-tag="' + tag + '">$1</span>';
      });
    return Object.assign({}, baseStatusBarRegexFields(replaceText || '<div class="zb-root">$1</div>'), {
      findRegex: '<StatusBar>([\\s\\S]*?)</StatusBar>',
    });
  }
  var doc = buildStatusBarRegexHtmlDocument(snippet);
  var replace = formatStatusBarRegexReplace(doc).replace(/\$/g, '$$');
  return Object.assign({}, baseStatusBarRegexFields(replace), {
    findRegex: STATUS_BAR_PLACEHOLDER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  });
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
    stage: Number(p.stage) >= 1 && Number(p.stage) <= 4 ? Number(p.stage) : 1,
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
    if (flags.corruption_stage) push(prefix + '.恶堕进度', '恶堕进度', '亲密', '0', role);
    if (flags.affection_stage) push(prefix + '.亲密度', '亲密度', '亲密', '30', role);
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

/**
 * MVU 设计提示词：与 buildPlaceholderPaths 同规则的 path 布局说明（非强制校验，供模型对齐）
 * @param {{ castMode?: string, mainName?: string, moduleFlags?: Record<string, boolean>, characters?: import('./statusBarBuild.mjs').CastCharacter[] }} opts
 * @returns {string}
 */
export function describeMvuPathLayoutSpec(opts) {
  var o = opts || {};
  var castMode = o.castMode === 'multi' ? 'multi' : 'single';
  var main = String(o.mainName || '角色').trim() || '角色';
  var chars = Array.isArray(o.characters) ? o.characters : [];
  var names = castMode === 'multi'
    ? chars.filter(function(c) { return c && c.selected !== false && String(c.name || '').trim(); })
      .map(function(c) { return String(c.name).trim(); })
    : [main];
  if (castMode === 'multi' && !names.length) names = [main];

  var paths = buildPlaceholderPaths({
    castMode: castMode,
    mainName: main,
    moduleFlags: o.moduleFlags || {},
    characters: castMode === 'multi' ? chars : [{ name: main, selected: true }],
  });
  if (!paths.length) return '（按开启模块生成 path；暂无占位）';

  var globalPaths = paths.filter(function(p) { return !p.role; });
  var lines = ['【路径布局规格】（与预览占位一致；variables 的 path 须按此展开）'];

  if (castMode === 'single') {
    lines.push('单人：全局字段用「世界.* / 任务.* / 事件.*」；角色字段用「角色.字段名」。');
    if (globalPaths.length) {
      lines.push('全局 path 示例：' + globalPaths.map(function(p) { return p.path; }).join('、'));
    }
    var rolePaths = paths.filter(function(p) { return p.role === main || (p.path || '').indexOf('角色.') === 0; });
    if (rolePaths.length) {
      lines.push('角色 path 示例：' + rolePaths.map(function(p) { return p.path; }).join('、'));
    }
    return lines.join('\n');
  }

  lines.push('多人：世界 / 任务 / 事件各一份（无 NPC 前缀）；每位【入选人物】各复制完整同套 NPC 字段，禁止主详配简。');
  if (globalPaths.length) {
    lines.push('全局（各 1 条）：' + globalPaths.map(function(p) { return p.path; }).join('、'));
  }

  var first = names[0];
  var templatePaths = paths.filter(function(p) { return p.role === first; });
  if (templatePaths.length) {
    var suffixes = templatePaths.map(function(p) {
      var parts = String(p.path || '').split('.');
      return parts.length >= 3 ? parts.slice(2).join('.') : parts[parts.length - 1];
    });
    lines.push('每人须具备的字段后缀（共 ' + suffixes.length + ' 个，入选 ' + names.length + ' 人须人人齐全）：'
      + suffixes.join('、'));
    lines.push('path 模式：NPC.{姓名}.' + suffixes[0] + '（将 {姓名} 替换为入选名单中的每一个名字，不得遗漏）');
  }

  var exampleLines = [];
  names.slice(0, Math.min(names.length, 4)).forEach(function(name) {
    var list = paths.filter(function(p) { return p.role === name; }).map(function(p) { return p.path; });
    if (list.length) exampleLines.push(name + ' → ' + list.join('、'));
  });
  if (exampleLines.length) {
    lines.push('完整示例：\n' + exampleLines.join('\n'));
  }
  if (names.length > 4) {
    lines.push('（另有 ' + (names.length - 4) + ' 人，须与上列同后缀集合完整复制）');
  }
  lines.push('输出前自检：除全局 path 外，每个入选姓名的 variables 条数相同、字段后缀集合一致。');
  return lines.join('\n');
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
  + '默认高亮（可选，仅影响排版展示）：{{mainName}}\n'
  + '入选人物：{{castList}}\n'
  + '视觉排版：{{design}}（变量先于排版生成，此处仅作参考）\n'
  + '开启模块（仅允许为这些项设计 variables）：\n{{moduleBlock}}\n'
  + '禁止模块（不得出现下列路径或同义字段）：\n{{forbiddenModuleBlock}}\n'
  + 'NSFW：{{nsfw}}\n'
  + '额外要求：{{extra}}\n\n'
  + '{{pathLayoutSpec}}\n\n'
  + '\n【设计原则】\n'
  + '1. variables 只能覆盖「开启模块」；「禁止模块」中的路径一律不要输出；NSFW=否时禁止一切身体私密字段。\n'
  + '2. 单人：路径可用「角色.字段」或「世界.字段」，须覆盖 path 布局规格中的示例集合。\n'
  + '3. 多人：世界/任务/事件各一份；入选人物档案中【每一个人】都必须用 NPC.姓名.字段 生成与开启模块一一对应的【完整同套】详字段；信息量人人相等，禁止因默认高亮姓名而增减字段、禁止精简/摘要块；path 须严格按「路径布局规格」为每个姓名完整展开。\n'
  + '4. 变量须可被剧情更新；数量随开启模块与人数增加，勿为未开启模块凑字段。\n'
  + '5. type 仅 string/number/boolean/enum/array/object；enum 必给 options。\n'
  + '6. check 为数组，说明更新条件。\n'
  + '7. 输出 JSON 前：多人模式下核对每位入选姓名的 path 数量与后缀集合是否一致；缺任一人的任一后缀须补全后再输出。\n'
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
