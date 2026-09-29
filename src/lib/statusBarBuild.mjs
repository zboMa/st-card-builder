/** 状态栏：路径解析 / 预览 / 脚本拼装（拆自 statusBar） */
import {
  normalizePathItem,
  pathSetOf,
  pathIsMeter,
  migratePresetId,
  resolveModuleFlags,
  STATUS_BAR_REGEX_NAME,
  STATUS_BAR_PLACEHOLDER,
  designCss,
  migrateDesignId,
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
 * 主角档案与女角色档案分开。卡角色本人不进入女角色名单。
 * @param {{ includeProtagonist?: boolean, includeFemales?: boolean, selected?: import('./statusBarBuild.mjs').CastCharacter[], card?: { name?: string, desc?: string, firstMes?: string }, worldbookEntries?: any[] }} opts
 */
export function buildCastProfileBlock(opts) {
  var o = opts || {};
  var card = o.card || {};
  var cardName = String(card.name || '').trim();
  var includeProtagonist = !!o.includeProtagonist;
  var includeFemales = !!o.includeFemales;
  var females = (Array.isArray(o.selected) ? o.selected : []).filter(function(c) {
    var name = c && String(c.name || '').trim();
    return c && c.selected !== false && name && name !== cardName;
  });

  var wbIndex = Object.create(null);
  (o.worldbookEntries || []).forEach(function(e) {
    if (!e || !isPersonWorldbookEntry(e)) return;
    var n = personNameFromWorldbookEntry(e);
    if (n && !wbIndex[n]) wbIndex[n] = e;
  });

  var lines = ['【追踪对象】两套路径互不改写。禁止把主角写成 NPC.' + (cardName || '卡角色名') + '，禁止把女角色收成 角色.字段。'];
  if (includeProtagonist) {
    lines.push('');
    lines.push('■ 主角（路径前缀固定为「角色.」，第一段不要用卡角色名）');
    lines.push('角色名：' + (cardName || '（未填）'));
    if (card.desc) lines.push('描述：' + String(card.desc));
    if (card.creatorNotes) lines.push('作者注释：' + String(card.creatorNotes));
  }
  if (includeFemales) {
    lines.push('');
    lines.push('■ 女角色（路径前缀 NPC.姓名.；不要包含卡角色本人）');
    if (!females.length) {
      lines.push('（尚未勾选女角色）');
    }
    females.forEach(function(c) {
      var name = String(c.name || '').trim();
      lines.push('');
      lines.push('· ' + name);
      var entry = wbIndex[name];
      var content = entry ? String(entry.content || '').trim() : '';
      if (content) lines.push('档案：' + content);
      else if (c.identity) lines.push('档案：' + String(c.identity));
      else lines.push('档案：（暂无正文）');
    });
  }
  if (!includeProtagonist && !includeFemales) return '（未勾选主角或女角色）';
  var greetings = Array.isArray(card.greetings) ? card.greetings : [];
  if (!greetings.length && card.firstMes) greetings = [{ label: '主开场', text: card.firstMes }];
  lines.push('');
  lines.push('【各条开场】互相并列，不是同时发生。某一场的地点、在场人物和此刻动作只属于该场，不要写进所有人的 default。');
  if (!greetings.length) lines.push('（无开场白）');
  greetings.forEach(function(g) {
    var label = g && g.label ? String(g.label) : '开场';
    var text = g && g.text != null ? String(g.text).trim() : '';
    if (!text) return;
    lines.push(label + '：' + text);
  });
  return lines.join('\n');
}

/** 女角色名单去掉卡角色名 */
export function excludeCardNameFromCharacters(characters, cardName) {
  var ban = String(cardName || '').trim();
  return (Array.isArray(characters) ? characters : []).filter(function(c) {
    return c && String(c.name || '').trim() && String(c.name).trim() !== ban;
  });
}

export function pathsFromMvuDesign(design, opts) {
  var vars = design && Array.isArray(design.variables) ? design.variables : [];
  var o = opts || {};
  var slice = vars;
  if (typeof o.limit === 'number' && o.limit > 0) {
    slice = vars.slice(0, o.limit);
  }
  var charName = String(o.charName || o.protagonistName || '').trim();
  return slice.map(function(v) {
    var path = String((v && (v.path || v.name)) || '').trim();
    var parts = path.split('.');
    var set = pathSetOf(path);
    var role = '';
    if (set === 'npc' && parts[1]) role = parts[1];
    else if (set === 'protagonist') role = charName;
    return normalizePathItem({
      path: path,
      label: v && (v.description || v.label) ? String(v.description || v.label).slice(0, 24) : parts[parts.length - 1],
      group: parts.length > 1 ? parts[0] : '状态',
      type: v && v.type,
      sample: v && v.default != null ? String(v.default) : undefined,
      role: role,
      set: set,
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
 * 自定义排版：注入片段里路径文本先写成「—」，数值条宽度归零，由酒馆脚本回填。
 * @param {string} bodyHtml
 */
export function normalizeCustomBodyForSnippet(bodyHtml) {
  var html = String(bodyHtml || '').replace(
    /(<span[^>]*\bdata-zb-path="[^"]+"[^>]*>)[\s\S]*?(<\/span>)/gi,
    '$1—$2'
  );
  html = html.replace(
    /(<[^>]*\bdata-zb-meter="[^"]+"[^>]*style=")([^"]*)(")/gi,
    function(_m, a, style, c) {
      var next = String(style || '').replace(/width\s*:\s*[^;]+;?/i, '').trim();
      if (next && !/;\s*$/.test(next)) next += ';';
      return a + next + 'width:0%' + c;
    }
  );
  return html;
}

function meterWidth(value) {
  var n = parseFloat(value);
  if (!isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

function plainStatusCss() {
  return 'body{margin:0;padding:16px;background:#0b1020;color:#e8e6f2;font:14px/1.45 sans-serif}'
    + '.zb-plain{display:flex;flex-direction:column;gap:4px}'
    + '.zb-row{display:flex;flex-direction:column;gap:4px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.08)}'
    + '.zb-row-head{display:flex;justify-content:space-between;gap:12px}'
    + '.zb-k{color:#a8a3b8}'
    + '.zb-meter-track{height:6px;background:rgba(255,255,255,.12);border-radius:99px;overflow:hidden}'
    + '.zb-meter-track>span{display:block;height:100%;background:#c4b5fd;width:0}';
}

/**
 * @param {import('./statusBarCatalog.mjs').PathItem[]} paths
 * @param {Record<string, string>} map
 * @param {boolean} placeholderDash
 */
export function buildPlainStatusBody(paths, map, placeholderDash) {
  var rows = (paths || []).map(function(p) {
    var raw = map && Object.prototype.hasOwnProperty.call(map, p.path) ? map[p.path] : (placeholderDash ? '—' : (p.sample || '—'));
    var text = (raw == null || raw === '') ? '—' : String(raw);
    var meter = (p.meter || pathIsMeter(p.path))
      ? '<div class="zb-meter-track"><span data-zb-meter="' + escAttr(p.path) + '" style="width:' + meterWidth(text) + '%"></span></div>'
      : '';
    return '<div class="zb-row"><div class="zb-row-head"><span class="zb-k">' + escHtml(p.label || p.path) + '</span>'
      + '<span class="zb-value" data-zb-path="' + escAttr(p.path) + '">' + escHtml(text) + '</span></div>'
      + meter + '</div>';
  }).join('');
  return '<section class="zb-plain">' + rows + '</section>';
}

/**
 * 父页面把某一楼的值写进已有 HTML（预览 iframe 不跑脚本）。
 * 缺键写成「—」，不借用别的路径。
 * @param {string} html
 * @param {Record<string, string|number|null|undefined>} map
 */
export function fillStatusMarkup(html, map) {
  var values = map || {};
  var out = String(html || '');
  out = out.replace(/<([a-zA-Z0-9]+)(\s[^>]*\bdata-zb-path="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/g, function(_full, tag, attrs, path) {
    var has = Object.prototype.hasOwnProperty.call(values, path);
    var raw = has ? values[path] : undefined;
    var text = (!has || raw == null || raw === '') ? '—' : String(raw);
    return '<' + tag + attrs + '>' + escHtml(text) + '</' + tag + '>';
  });
  out = out.replace(/(<[^>]*\bdata-zb-meter=")([^"]+)("[^>]*)>/g, function(full, a, path, b) {
    var has = Object.prototype.hasOwnProperty.call(values, path);
    var w = has ? meterWidth(values[path]) : 0;
    if (/\bstyle="/.test(full)) {
      return full.replace(/style="[^"]*"/, function(styleAttr) {
        var inner = styleAttr.slice(7, -1).replace(/width\s*:\s*[^;]+;?/ig, '').trim();
        if (inner && !/;\s*$/.test(inner)) inner += ';';
        return 'style="' + inner + 'width:' + w + '%"';
      });
    }
    return a + path + b + ' style="width:' + w + '%">';
  });
  return out;
}

/** 预览里去掉当前未勾选路径的节点，留下的 path 字符串不改写。 */
export function keepMarkupPaths(html, paths) {
  var allow = Object.create(null);
  (paths || []).forEach(function(p) { if (p && p.path) allow[p.path] = true; });
  return String(html || '').replace(
    /<([a-zA-Z0-9]+)(\s[^>]*\bdata-zb-(?:path|meter)="([^"]+)"[^>]*)>[\s\S]*?<\/\1>/g,
    function(full, _tag, _attrs, path) {
      return allow[path] ? full : '';
    }
  );
}

function valueMapForPaths(paths, values, useSample) {
  var map = {};
  (paths || []).forEach(function(p) {
    if (values && Object.prototype.hasOwnProperty.call(values, p.path)) {
      var raw = values[p.path];
      map[p.path] = (raw == null || raw === '') ? '—' : String(raw);
    } else if (useSample) {
      map[p.path] = p.sample || '—';
    } else {
      map[p.path] = '—';
    }
  });
  return map;
}

/**
 * 预览文档。已有排版 HTML 时用模型结果；否则朴素列表。不引用 30 套主题。
 * @param {{ paths?: any[], values?: Record<string, string>, customCss?: string, customBodyHtml?: string, title?: string }} opts
 */
export function buildPreviewHtml(opts) {
  var o = opts || {};
  var paths = Array.isArray(o.paths) ? o.paths.map(normalizePathItem) : [];
  var map = valueMapForPaths(paths, o.values, true);
  var css = String(o.customCss || '');
  var custom = String(o.customBodyHtml || '').trim();
  var body = custom
    ? fillStatusMarkup(custom, map)
    : buildPlainStatusBody(paths, map, false);
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><style>'
    + plainStatusCss() + css
    + '</style></head><body><div class="zb-root" id="zb-status-root">' + body + '</div></body></html>';
}

/**
 * 自定义排版完整预览文档（与 buildPreviewHtml 同一套 data-zb-path）
 * @param {{ customCss?: string, customBodyHtml?: string, paths?: any[], values?: Record<string, string> }} opts
 */
export function buildCustomLayoutDocument(opts) {
  return buildPreviewHtml(opts || {});
}

/**
 * 注入片段：路径文本为「—」。有排版 HTML 用模型结果，否则朴素列表。
 * @param {{ customCss?: string, customBodyHtml?: string, paths?: any[], mode?: string }} opts
 */
export function buildCustomLayoutSnippet(opts) {
  return buildStatusBarSnippet(opts || {});
}

/**
 * @param {{ paths?: any[], customCss?: string, customBodyHtml?: string, mode?: string }} opts
 */
export function buildStatusBarSnippet(opts) {
  var o = opts || {};
  var mode = o.mode || 'mvu';
  var paths = Array.isArray(o.paths) ? o.paths.map(normalizePathItem) : [];
  var css = String(o.customCss || '');
  var custom = String(o.customBodyHtml || '').trim();
  var body = custom
    ? normalizeCustomBodyForSnippet(custom)
    : buildPlainStatusBody(paths, null, true);
  return '<style id="zb-style">' + plainStatusCss() + css + '</style>'
    + '<div class="zb-root" id="zb-status-root" data-zb-mode="' + escAttr(mode) + '">'
    + body + '</div>';
}

function buildStatusBarMvuRefreshScript() {
  return [
    '<script>',
    '(function(){',
    '  function dig(root, path){',
    '    if(root==null) return undefined;',
    '    var cur=root;',
    '    var parts=String(path||"").split(".");',
    '    for(var i=0;i<parts.length;i++){',
    '      if(cur==null) return undefined;',
    '      cur=cur[parts[i]];',
    '    }',
    '    if(Array.isArray(cur)) return cur.length?cur[0]:undefined;',
    '    return cur;',
    '  }',
    '  function readStat(data, path){',
    '    if(!data) return undefined;',
    '    var disp=data.display_data!=null?data.display_data:data.displayData;',
    '    var stat=data.stat_data!=null?data.stat_data:data.statData;',
    '    var v=dig(disp, path);',
    '    if(v==null||v==="") v=dig(stat, path);',
    '    return v;',
    '  }',
    '  function refresh(root){',
    '    if(!root) return;',
    '    if(typeof getCurrentMessageId!=="function") return;',
    '    var id=getCurrentMessageId();',
    '    if(id==null||typeof Mvu==="undefined"||!Mvu.getMvuData) return;',
    '    var data;',
    '    try{ data=Mvu.getMvuData({type:"message", message_id:id}); }catch(e){ return; }',
    '    root.querySelectorAll("[data-zb-path]").forEach(function(el){',
    '      var v=readStat(data, el.getAttribute("data-zb-path"));',
    '      el.textContent=(v==null||v==="")?"—":String(v);',
    '    });',
    '    root.querySelectorAll("[data-zb-meter]").forEach(function(el){',
    '      var v=readStat(data, el.getAttribute("data-zb-meter"));',
    '      var n=parseFloat(v);',
    '      var w=isFinite(n)?Math.max(0,Math.min(100,n)):0;',
    '      el.style.width=w+"%";',
    '    });',
    '  }',
    '  function boot(){',
    '    var root=document.getElementById("zb-status-root")||document.querySelector(".zb-root")||document.body;',
    '    refresh(root);',
    '    if(typeof eventOn==="function"&&typeof Mvu!=="undefined"&&Mvu.events&&Mvu.events.VARIABLE_UPDATE_ENDED){',
    '      eventOn(Mvu.events.VARIABLE_UPDATE_ENDED,function(){refresh(root);});',
    '    }',
    '  }',
    '  if(typeof errorCatched==="function") errorCatched(boot)(); else boot();',
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
function migrateCastSelection(p) {
  var chars = Array.isArray(p.characters)
    ? p.characters.map(normalizeCastCharacter).filter(Boolean)
    : [];
  var hasNew = p.includeProtagonist != null || p.includeFemales != null;
  if (hasNew) {
    return {
      includeProtagonist: !!p.includeProtagonist,
      includeFemales: !!p.includeFemales,
      characters: chars,
    };
  }
  if (p.castMode === 'multi') {
    var mainName = String(p.mainName || '').trim();
    var includeProtagonist = false;
    var females = [];
    chars.forEach(function(c) {
      var isProtag = c.source === 'card' || (mainName && c.name === mainName);
      if (isProtag) includeProtagonist = true;
      else females.push(c);
    });
    return {
      includeProtagonist: includeProtagonist,
      includeFemales: females.length > 0,
      characters: females,
    };
  }
  return { includeProtagonist: true, includeFemales: false, characters: [] };
}

/**
 * 水合时用当前卡角色名再对一次：名单里姓名等于 charName 的人视为主角并移出 characters。
 * 对不上就不把别人猜成主角。
 * @param {object} design
 * @param {string} charName
 */
export function reconcileDesignWithCharName(design, charName) {
  var d = design || {};
  var name = String(charName || '').trim();
  var chars = Array.isArray(d.characters) ? d.characters : [];
  if (!name || !chars.some(function(c) { return c && c.name === name; })) return d;
  var rest = chars.filter(function(c) { return c && c.name !== name; });
  return Object.assign({}, d, {
    includeProtagonist: true,
    includeFemales: rest.some(function(c) { return c.selected !== false; }),
    characters: rest,
  });
}

/**
 * 持久化形状。样例楼层不进入结果。旧 castMode / 主题 id 不再参与渲染。
 * @param {any} partial
 */
export function normalizeDesign(partial) {
  var p = partial || {};
  var cast = migrateCastSelection(p);
  var presetId = migratePresetId(p.presetId);
  var nsfw = !!p.nsfw;
  var moduleFlags = resolveModuleFlags(presetId, p.moduleFlags || p.modules, nsfw);
  var layoutPrompt = p.layoutPrompt != null ? String(p.layoutPrompt) : String(p.customPrompt || '');
  return {
    mode: 'mvu',
    includeProtagonist: cast.includeProtagonist,
    includeFemales: cast.includeFemales,
    femaleOnly: p.femaleOnly !== false,
    presetId: presetId,
    nsfw: nsfw,
    moduleFlags: moduleFlags,
    extra: String(p.extra || ''),
    characters: cast.characters,
    layoutPrompt: layoutPrompt,
    customCss: String(p.customCss || ''),
    customBodyHtml: String(p.customBodyHtml || ''),
    paths: Array.isArray(p.paths) ? p.paths.map(normalizePathItem).filter(function(x) { return x.path; }) : [],
    snippetHtml: String(p.snippetHtml || ''),
    updatedAt: p.updatedAt || new Date().toISOString(),
  };
}

/**
 * 生成前拒绝。返回空字符串表示可以调模型。
 * 变量生成传 `{ requireLayout: false }`。排版再要求路径；修改再要求已有 HTML。
 * @param {{ includeProtagonist?: boolean, includeFemales?: boolean, characters?: any[], moduleFlags?: Record<string, boolean>, layoutPrompt?: string, charName?: string, paths?: any[], customBodyHtml?: string }} design
 * @param {{ requireLayout?: boolean, requirePaths?: boolean, requireMarkup?: boolean }} [opts]
 * @returns {string}
 */
export function rejectStatusBarGenerate(design, opts) {
  var d = design || {};
  var cardName = String(d.charName || '').trim();
  var females = excludeCardNameFromCharacters(d.characters, cardName).filter(function(c) {
    return c.selected !== false;
  });
  var hasProtag = !!d.includeProtagonist;
  var hasFemales = !!d.includeFemales && females.length > 0;
  if (!hasProtag && !hasFemales) return '请勾选主角或女角色';
  var flags = d.moduleFlags || {};
  var any = Object.keys(flags).some(function(k) { return !!flags[k]; });
  if (!any) return '请至少开启一个模块';
  var o = opts || {};
  if (o.requirePaths && !(Array.isArray(d.paths) && d.paths.length)) return '请先生成变量';
  if (o.requireLayout !== false && !String(d.layoutPrompt || '').trim()) return '请填写排版风格说明';
  if (o.requireMarkup && !String(d.customBodyHtml || '').trim()) return '还没有排版，请先重新生成';
  return '';
}

/**
 * 占位路径。全局一份；主角固定「角色.字段」；女角色「NPC.姓名.字段」。
 * 都不勾时返回空。卡角色名不会写成 NPC 前缀。
 * @param {{ includeProtagonist?: boolean, includeFemales?: boolean, charName?: string, protagonistName?: string, mainName?: string, castMode?: string, moduleFlags?: Record<string, boolean>, characters?: CastCharacter[] }} opts
 * @returns {import('./statusBarCatalog.mjs').PathItem[]}
 */
export function buildPlaceholderPaths(opts) {
  var o = opts || {};
  var flags = o.moduleFlags || {};
  var cardName = String(o.charName || o.protagonistName || o.mainName || '').trim();
  var includeProtagonist = o.includeProtagonist != null ? !!o.includeProtagonist : o.castMode !== 'multi';
  var includeFemales = o.includeFemales != null ? !!o.includeFemales : o.castMode === 'multi';
  if (!includeProtagonist && !includeFemales) return [];

  var base = [];
  function push(path, label, group, sample, role, set) {
    base.push(normalizePathItem({
      path: path,
      label: label,
      group: group,
      sample: sample,
      role: role || '',
      set: set,
    }));
  }

  if (flags.time_weather) {
    push('世界.当前时间', '时间', '世界', '08:30', '', 'global');
    push('世界.天气', '天气', '世界', '晴', '', 'global');
  }
  if (flags.location) push('世界.当前地点', '地点', '世界', '咖啡馆', '', 'global');
  if (flags.quest) push('任务.当前', '任务', '任务', '调查线索', '', 'global');
  if (flags.event_chips) push('事件.标签', '事件', '事件', '同行', '', 'global');

  var nsfwMap = [
    ['nsfw_thoughts', '内心', '隐秘心声'],
    ['nsfw_breasts', '双乳', '柔软'],
    ['nsfw_vagina', '小穴', '湿润'],
    ['nsfw_legs', '美腿', '修长'],
    ['nsfw_feet', '美脚', '轻颤'],
    ['nsfw_anus', '屁穴', '紧致'],
    ['nsfw_mouth', '口腔', '微张'],
    ['nsfw_erogenous', '敏感带', '发烫'],
    ['nsfw_uterus', '子宫', '未受孕'],
    ['nsfw_orgasm', '快感', '62'],
    ['nsfw_fluids', '体液', '微量'],
    ['nsfw_exposure', '露出', '低'],
    ['nsfw_training', '调教', '无'],
    ['nsfw_experience', '性经验', '摘要'],
    ['nsfw_act_state', '性行为', '无'],
    ['nsfw_pregnancy', '怀孕', '未怀孕'],
  ];

  function pushCharFields(prefix, set, role, group) {
    if (flags.emotion) push(prefix + '.情绪', '情绪', group, '平静', role, set);
    if (flags.action) push(prefix + '.行动', '行动', group, '闲聊', role, set);
    if (flags.outfit) push(prefix + '.着装', '着装', group, '便装', role, set);
    if (flags.affection) push(prefix + '.好感度', '好感', group, '42', role, set);
    if (flags.trust) push(prefix + '.信任', '信任', group, '30', role, set);
    if (flags.relation_stage) push(prefix + '.关系阶段', '关系', group, '熟人', role, set);
    if (flags.corruption_stage) push(prefix + '.恶堕进度', '恶堕进度', '亲密', '0', role, set);
    if (flags.affection_stage) push(prefix + '.亲密度', '亲密度', '亲密', '30', role, set);
    if (flags.attributes) {
      push(prefix + '.体力', '体力', '属性', '78', role, set);
      push(prefix + '.魔力', '魔力', '属性', '55', role, set);
    }
    if (flags.realm) push(prefix + '.境界', '境界', '属性', '练气三层', role, set);
    if (flags.injury) push(prefix + '.伤势', '伤势', '属性', '轻伤', role, set);
    if (flags.sanity) push(prefix + '.理智', '理智', '属性', '72', role, set);
    if (flags.items) push(prefix + '.物品', '物品', group, '钥匙扣', role, set);
    if (flags.money) push(prefix + '.金钱', '金钱', group, '320', role, set);
    if (flags.memory_summary) push(prefix + '.记忆', '记忆', group, '初遇约定', role, set);
    nsfwMap.forEach(function(row) {
      if (!flags[row[0]]) return;
      push(prefix + '.' + row[1], row[1], '亲密', row[2], role, set);
    });
  }

  if (includeProtagonist) pushCharFields('角色', 'protagonist', cardName, '角色');
  if (includeFemales) {
    (Array.isArray(o.characters) ? o.characters : []).forEach(function(c) {
      if (!c || c.selected === false) return;
      var name = String(c.name || '').trim();
      if (!name || name === cardName) return;
      pushCharFields('NPC.' + name, 'npc', name, 'NPC');
    });
  }
  return base;
}

/**
 * 与 buildPlaceholderPaths 同规则的 path 说明。不含主题 CSS / 主题 id。
 * @param {{ includeProtagonist?: boolean, includeFemales?: boolean, charName?: string, moduleFlags?: Record<string, boolean>, characters?: any[] }} opts
 */
export function describeMvuPathLayoutSpec(opts) {
  var o = opts || {};
  var paths = buildPlaceholderPaths({
    includeProtagonist: !!o.includeProtagonist,
    includeFemales: !!o.includeFemales,
    charName: o.charName || o.mainName || '',
    moduleFlags: o.moduleFlags || {},
    characters: o.characters || [],
  });
  if (!paths.length) return '（按开启模块生成 path；暂无占位）';
  var lines = [
    '【路径布局规格】variables 的 path 须按此展开，两套前缀禁止互换。',
    '全局字段用「世界.* / 任务.* / 事件.*」，整卡一份，set=global。',
  ];
  if (o.includeProtagonist) {
    lines.push('主角字段固定「角色.字段名」，不要用卡角色名当第一段，不要写成 NPC.' + (o.charName || '卡角色名') + '。');
  }
  if (o.includeFemales) {
    lines.push('女角色字段用「NPC.姓名.字段名」。卡角色本人不得出现在 NPC 路径里。');
  }
  var globalPaths = paths.filter(function(p) { return p.set === 'global'; });
  if (globalPaths.length) lines.push('全局：' + globalPaths.map(function(p) { return p.path; }).join('、'));
  var protag = paths.filter(function(p) { return p.set === 'protagonist'; });
  if (protag.length) lines.push('主角：' + protag.map(function(p) { return p.path; }).join('、'));
  var npcNames = [];
  paths.forEach(function(p) {
    if (p.set === 'npc' && p.role && npcNames.indexOf(p.role) < 0) npcNames.push(p.role);
  });
  npcNames.forEach(function(name) {
    var list = paths.filter(function(p) { return p.set === 'npc' && p.role === name; });
    lines.push(name + '：' + list.map(function(p) { return p.path; }).join('、'));
  });
  return lines.join('\n');
}

/**
 * 把点分路径收成嵌套对象。主角停在「角色」，女角色停在「NPC.姓名」，两套前缀不改写。
 * @param {Array<{ path?: string, sample?: any }>} paths
 * @param {(pathItem: any) => any} [valueOf]
 */
export function buildVariableTree(paths, valueOf) {
  var root = {};
  (Array.isArray(paths) ? paths : []).forEach(function(p) {
    if (!p || !p.path) return;
    var parts = String(p.path).split('.').filter(Boolean);
    if (!parts.length) return;
    var value = valueOf ? valueOf(p) : (p.sample != null && p.sample !== '' ? p.sample : '—');
    if (value == null || value === '') value = '—';
    var cur = root;
    for (var i = 0; i < parts.length - 1; i++) {
      var key = parts[i];
      if (!cur[key] || typeof cur[key] !== 'object' || Array.isArray(cur[key])) cur[key] = {};
      cur = cur[key];
    }
    cur[parts[parts.length - 1]] = value;
  });
  return root;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * 三楼样例校验。少一楼、楼层对象或内层袋子共用引用、三楼内容相同，整次作废。
 * @param {any} floors
 * @returns {{ ok: boolean, reason?: string, floors?: object[] }}
 */
export function validateSampleFloors(floors) {
  if (!Array.isArray(floors) || floors.length !== 3) return { ok: false, reason: 'count' };
  for (var i = 0; i < 3; i++) {
    if (!floors[i] || typeof floors[i] !== 'object' || Array.isArray(floors[i])) {
      return { ok: false, reason: 'count' };
    }
  }
  if (floors[0] === floors[1] || floors[1] === floors[2] || floors[0] === floors[2]) {
    return { ok: false, reason: 'shared' };
  }
  var bags = ['global', 'protagonist', 'npc'];
  for (var a = 0; a < 3; a++) {
    for (var b = a + 1; b < 3; b++) {
      for (var k = 0; k < bags.length; k++) {
        var left = floors[a][bags[k]];
        var right = floors[b][bags[k]];
        if (left && right && left === right) return { ok: false, reason: 'shared' };
      }
    }
  }
  var sig = floors.map(function(f) { return JSON.stringify(f); });
  if (sig[0] === sig[1] && sig[1] === sig[2]) return { ok: false, reason: 'duplicate' };
  return { ok: true, floors: floors.map(cloneJson) };
}

/**
 * 只读该楼、该套。缺键返回 undefined，不拿另一套填。
 * @param {any} floor
 * @param {{ path?: string, set?: string, role?: string }} pathItem
 */
export function readFloorValue(floor, pathItem) {
  if (!floor || !pathItem) return undefined;
  var path = String(pathItem.path || '');
  var parts = path.split('.');
  var leaf = parts[parts.length - 1] || '';
  var set = pathItem.set || pathSetOf(path);
  function pick(bag) {
    if (!bag || typeof bag !== 'object' || Array.isArray(bag)) return undefined;
    if (Object.prototype.hasOwnProperty.call(bag, path)) return bag[path];
    if (Object.prototype.hasOwnProperty.call(bag, leaf)) return bag[leaf];
    return undefined;
  }
  if (set === 'global') return pick(floor.global);
  if (set === 'protagonist') return pick(floor.protagonist);
  var npc = floor.npc;
  if (!npc || typeof npc !== 'object' || Array.isArray(npc)) return undefined;
  var name = pathItem.role || parts[1] || '';
  var named = name ? npc[name] : undefined;
  if (named && typeof named === 'object' && !Array.isArray(named)) {
    if (Object.prototype.hasOwnProperty.call(named, leaf)) return named[leaf];
    if (Object.prototype.hasOwnProperty.call(named, path)) return named[path];
    return undefined;
  }
  if (Object.prototype.hasOwnProperty.call(npc, path)) return npc[path];
  return undefined;
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

/** 从世界书识别女角色。不要输出卡角色本人。 */
export const STATUS_BAR_CHAR_SCAN_PROMPT =
  '你是 SillyTavern 世界书人物识别器。根据世界书条目列表，找出可作状态栏女角色追踪对象的人物。\n'
  + '{{wbBlock}}\n'
  + '当前卡角色（禁止输出此人）：{{charName}}\n'
  + '规则：\n'
  + '1. 只输出 JSON，不要解释。\n'
  + '2. 格式：{ "characters": [ { "name":"姓名", "aliases":[], "identity":"一句话身份", "source":"来源条目标题" } ] }\n'
  + '3. 优先条目标题/内容像角色卡、人物档案的；忽略纯地点/势力/规则。\n'
  + '4. 最多 12 人；name 用最常用称呼。\n'
  + '5. 不要输出当前卡角色本人，即使世界书里有同名条目。\n'
  + '{{femaleOnlyRule}}';

/**
 * 把 AI 配置里已勾选的预设全文贴到系统提示末尾，与引擎阶段 1 的「文风要求」相同。
 * 预设为空时原文不动。
 * @param {string} systemText
 * @param {string} presetsStr
 */
export function appendStylePreset(systemText, presetsStr) {
  var base = String(systemText || '');
  var extra = String(presetsStr || '').trim();
  if (!extra) return base;
  return base + '\n【文风要求】：\n' + extra;
}

/** 默认值最长一句，避免把人物小传写进变量。 */
export var STATUS_BAR_DEFAULT_MAX = 80;

var NUMBER_LEAVES = {
  '好感度': true,
  '信任': true,
  '恶堕进度': true,
  '亲密度': true,
  '体力': true,
  '魔力': true,
  '理智': true,
  '金钱': true,
  '快感': true,
};

var GLOBAL_FIELD_SPECS = {
  '世界.当前时间': { description: '当前时间', check: '根据行动耗时、移动、等待或用户指定时间推进' },
  '世界.天气': { description: '天气', check: '天气变化时更新' },
  '世界.当前地点': { description: '当前地点', check: '随场景切换更新' },
  '任务.当前': { description: '当前任务', check: '任务确立、推进或完成时更新' },
  '事件.标签': { description: '当前事件', check: '场面事件变化时更新' },
};

export function clipDefaultText(value) {
  var s = String(value == null ? '' : value).trim();
  if (s.length <= STATUS_BAR_DEFAULT_MAX) return s;
  return s.slice(0, STATUS_BAR_DEFAULT_MAX);
}

function leafOfPath(path) {
  var parts = String(path || '').split('.');
  return parts[parts.length - 1] || '';
}

function specForFillPath(p) {
  var path = String(p && p.path || '');
  var leaf = leafOfPath(path);
  var global = GLOBAL_FIELD_SPECS[path];
  if (global) {
    return {
      type: 'string',
      description: global.description,
      check: [global.check],
      fallback: '',
    };
  }
  if (leaf === '关系阶段') {
    return {
      type: 'enum',
      description: '关系阶段',
      check: ['关系阶段真正改变时才更新，无变化不要输出'],
      fallback: '未结识',
      enumRequired: ['未结识'],
    };
  }
  if (NUMBER_LEAVES[leaf] || (p && p.meter)) {
    var spec = {
      type: 'number',
      description: leaf,
      check: [leaf + '被剧情改变时更新，无变化不要输出'],
      fallback: 0,
      min: 0,
    };
    if (leaf !== '金钱') spec.max = 100;
    return spec;
  }
  return {
    type: 'string',
    description: (p && p.label) || leaf,
    check: [leaf + '被剧情写明时更新'],
    fallback: '',
  };
}

function coerceFillValue(raw, spec) {
  if (spec.type === 'number') {
    if (typeof raw === 'number' && isFinite(raw)) return raw;
    var n = Number(String(raw == null ? '' : raw).trim());
    return isFinite(n) ? n : spec.fallback;
  }
  if (raw == null) return spec.fallback;
  return clipDefaultText(raw);
}

function normalizeEnumOptions(raw, spec) {
  var list = [];
  (Array.isArray(raw) ? raw : []).forEach(function(item) {
    var text = clipDefaultText(item);
    if (text && list.indexOf(text) < 0) list.push(text);
  });
  (spec.enumRequired || []).forEach(function(req) {
    if (list.indexOf(req) < 0) list.unshift(req);
  });
  if (!list.length) list = (spec.enumRequired || ['未结识']).slice();
  return list.slice(0, 8);
}

function readFillPayload(payload) {
  var defaults = {};
  var enums = {};
  if (payload && payload.defaults && typeof payload.defaults === 'object' && !Array.isArray(payload.defaults)) {
    Object.keys(payload.defaults).forEach(function(key) { defaults[key] = payload.defaults[key]; });
  }
  if (payload && payload.enums && typeof payload.enums === 'object' && !Array.isArray(payload.enums)) {
    Object.keys(payload.enums).forEach(function(key) { enums[key] = payload.enums[key]; });
  }
  if (payload && Array.isArray(payload.variables)) {
    payload.variables.forEach(function(v) {
      if (!v) return;
      var leaf = leafOfPath(v.path || v.name || '');
      if (!leaf) return;
      if (defaults[leaf] === undefined && defaults[v.path] === undefined && v.default !== undefined) defaults[leaf] = v.default;
      if (enums[leaf] === undefined && Array.isArray(v.options)) enums[leaf] = v.options;
    });
  }
  return { defaults: defaults, enums: enums };
}

/**
 * 全局加主角一批，每个勾选的女角色单独一批。
 * @param {Array<{ path?: string, set?: string, role?: string }>} paths
 */
export function planStatusBarBatches(paths) {
  var globals = [];
  var protagonist = [];
  var byNpc = Object.create(null);
  var npcOrder = [];
  (paths || []).forEach(function(p) {
    if (!p || !p.path) return;
    if (p.set === 'npc') {
      var name = p.role || String(p.path).split('.')[1] || '';
      if (!byNpc[name]) {
        byNpc[name] = [];
        npcOrder.push(name);
      }
      byNpc[name].push(p);
      return;
    }
    if (p.set === 'protagonist') protagonist.push(p);
    else globals.push(p);
  });
  var batches = [];
  var shared = globals.concat(protagonist);
  if (shared.length) {
    batches.push({
      id: 'shared',
      label: protagonist.length ? '全局与主角' : '全局',
      kind: 'shared',
      name: '',
      paths: shared,
    });
  }
  npcOrder.forEach(function(name) {
    batches.push({
      id: 'npc:' + name,
      label: name,
      kind: 'npc',
      name: name,
      paths: byNpc[name],
    });
  });
  return batches;
}

/**
 * 只采纳这一批路径上的短值。不认识的键丢掉；没返回的用目录兜底。
 * description / check 来自目录，同一字段所有人共用。
 */
export function applyBatchFill(paths, payload) {
  var parsed = readFillPayload(payload);
  return (paths || []).filter(function(p) { return p && p.path; }).map(function(p) {
    var spec = specForFillPath(p);
    var leaf = leafOfPath(p.path);
    var hasLeaf = Object.prototype.hasOwnProperty.call(parsed.defaults, leaf);
    var hasPath = Object.prototype.hasOwnProperty.call(parsed.defaults, p.path);
    var raw = hasLeaf ? parsed.defaults[leaf] : (hasPath ? parsed.defaults[p.path] : undefined);
    var def = raw === undefined || raw === null ? spec.fallback : coerceFillValue(raw, spec);
    var item = {
      path: p.path,
      type: spec.type,
      default: def,
      description: spec.description,
      check: spec.check.slice(),
    };
    if (spec.min !== undefined) item.min = spec.min;
    if (spec.max !== undefined) item.max = spec.max;
    if (spec.type === 'enum') {
      var options = normalizeEnumOptions(parsed.enums[leaf] || parsed.enums[p.path], spec);
      item.options = options;
      if (options.indexOf(String(item.default)) < 0) item.default = options.indexOf('未结识') >= 0 ? '未结识' : options[0];
    }
    return item;
  });
}

function isFillAbort(err, signal) {
  if (signal && signal.aborted) return true;
  return !!(err && (err.name === 'AbortError' || /aborted/i.test(String(err.message || ''))));
}

/**
 * 按批填值。某一批失败再试一次；仍失败则抛出，调用方不得写入已有设计。
 * @param {{ batches: any[], fetchBatch: (batch: any, attempt: number) => Promise<any>, signal?: AbortSignal, onProgress?: (progress: number, text: string) => void }} opts
 */
export async function fillStatusBarVariables(opts) {
  var o = opts || {};
  var batches = o.batches || [];
  var variables = [];
  for (var i = 0; i < batches.length; i++) {
    if (o.signal && o.signal.aborted) {
      var abort = new Error('已取消');
      abort.name = 'AbortError';
      throw abort;
    }
    var batch = batches[i];
    var label = batch.label + ' ' + (i + 1) + '/' + batches.length;
    if (typeof o.onProgress === 'function') o.onProgress(i / batches.length, label);
    var payload = null;
    var lastErr = null;
    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        payload = await o.fetchBatch(batch, attempt);
        lastErr = null;
        break;
      } catch (err) {
        if (isFillAbort(err, o.signal)) throw err;
        lastErr = err;
      }
    }
    if (lastErr) throw lastErr;
    variables = variables.concat(applyBatchFill(batch.paths, payload));
    if (typeof o.onProgress === 'function') o.onProgress((i + 1) / batches.length, label);
  }
  return { summary: '状态栏生成的变量设计', variables: variables };
}

/**
 * 这一批的人设和各条开场。不带其他女角色的长文。
 */
export function buildBatchProfileBlock(batch, card, worldbookEntries, characters) {
  var b = batch || { kind: 'shared', paths: [] };
  var hasProtag = (b.paths || []).some(function(p) { return p.set === 'protagonist'; });
  if (b.kind === 'npc') {
    var one = (characters || []).filter(function(c) {
      return c && String(c.name || '').trim() === b.name;
    });
    return buildCastProfileBlock({
      includeProtagonist: false,
      includeFemales: true,
      selected: one.length ? one : [{ name: b.name, selected: true }],
      card: card || {},
      worldbookEntries: worldbookEntries || [],
    });
  }
  if (hasProtag) {
    return buildCastProfileBlock({
      includeProtagonist: true,
      includeFemales: false,
      selected: [],
      card: card || {},
      worldbookEntries: worldbookEntries || [],
    });
  }
  var lines = ['【这一批】全局字段。'];
  appendGreetingLines(lines, card);
  return lines.join('\n');
}

function appendGreetingLines(lines, card) {
  var greetings = card && Array.isArray(card.greetings) ? card.greetings : [];
  if ((!greetings || !greetings.length) && card && card.firstMes) greetings = [{ label: '主开场', text: card.firstMes }];
  lines.push('');
  lines.push('【各条开场】互相并列，不是同时发生。某一场的地点、在场人物和此刻动作只属于该场，不要写进 default。');
  if (!greetings.length) lines.push('（无开场白）');
  greetings.forEach(function(g) {
    var text = g && g.text != null ? String(g.text).trim() : '';
    if (!text) return;
    lines.push((g && g.label ? String(g.label) : '开场') + '：' + text);
  });
}

/** 排版提示只列一套字段，不把每个人的路径摊开。 */
export function describeLayoutFields(paths) {
  var globals = [];
  var protag = [];
  var npc = [];
  (paths || []).forEach(function(p) {
    if (!p || !p.path) return;
    var leaf = leafOfPath(p.path);
    if (p.set === 'npc') {
      if (npc.indexOf(leaf) < 0) npc.push(leaf);
    } else if (p.set === 'protagonist') protag.push(p.path);
    else globals.push(p.path);
  });
  var lines = [];
  if (globals.length) lines.push('全局：\n' + globals.map(function(p) { return '- ' + p; }).join('\n'));
  if (protag.length) lines.push('主角：\n' + protag.map(function(p) { return '- ' + p; }).join('\n'));
  if (npc.length) lines.push('女角色模板（路径写成 NPC.{{name}}.字段）：\n' + npc.map(function(p) { return '- ' + p; }).join('\n'));
  return lines.join('\n\n') || '（无）';
}

function escapeTemplateName(name) {
  return String(name || '').replace(/"/g, '');
}

/**
 * 预览和正则按当前勾选的姓名展开。存下来的仍是模板。
 * @param {string} html
 * @param {string[]} names
 */
export function expandStatusBarTemplate(html, names) {
  var src = String(html || '');
  var list = (names || []).map(function(n) { return String(n || '').trim(); }).filter(Boolean);
  return src.replace(/<template\b([^>]*)>([\s\S]*?)<\/template>/gi, function(full, attrs, inner) {
    if (!/data-zb-repeat\s*=\s*["']npc["']/.test(attrs || '')) return full;
    if (!list.length) return '';
    return list.map(function(name) {
      var safe = escapeTemplateName(name);
      return inner.replace(/\{\{\s*name\s*\}\}/g, safe);
    }).join('');
  });
}

/**
 * 修改时发给模型的是模板。旧卡已展开的，只留一个女角色样本。
 * @param {string} html
 * @param {string[]} names
 */
export function layoutReviseSource(html, names) {
  var src = String(html || '');
  var roster = (names || []).map(function(n) { return String(n || '').trim(); }).filter(Boolean);
  if (/data-zb-repeat\s*=\s*["']npc["']/.test(src)) {
    return { html: src, names: roster, legacy: false };
  }
  var found = [];
  var re = /data-zb-(?:path|meter)="NPC\.([^.]+)\./g;
  var m;
  while ((m = re.exec(src))) {
    if (found.indexOf(m[1]) < 0) found.push(m[1]);
  }
  if (found.length <= 1) {
    return { html: src, names: roster.length ? roster : found, legacy: found.length > 0 };
  }
  var keep = found[0];
  var stripped = src.replace(/<([a-zA-Z][\w:-]*)([^>]*\bdata-zb-(?:path|meter)="NPC\.([^.]+)\.[^"]*"[^>]*)>[\s\S]*?<\/\1>/g, function(full, _tag, _attrs, name) {
    return name === keep ? full : '';
  });
  stripped = stripped.split('NPC.' + keep + '.').join('NPC.{{name}}.');
  return { html: stripped, names: roster.length ? roster : found, legacy: true };
}

/**
 * 用默认值在本地变出三楼不同的样例，不请求模型。
 * @param {Array<{ path?: string, set?: string, role?: string, sample?: any, meter?: boolean }>} paths
 */
export function buildLocalSampleFloors(paths) {
  function vary(p, n) {
    var spec = specForFillPath(p);
    if (spec.type === 'number') {
      var base = Number(p && p.sample);
      if (!isFinite(base)) base = 0;
      var shifted = [base, Math.min(spec.max != null ? spec.max : base + 12, base + 12), Math.max(0, base - 8)];
      return shifted[n];
    }
    if (spec.type === 'enum') {
      var options = ['未结识', '相识', '同行'];
      return options[n % options.length];
    }
    var text = p && p.sample != null && String(p.sample).trim() ? String(p.sample).trim() : '—';
    var marks = ['', '·二', '·三'];
    return text + marks[n];
  }
  function floor(n) {
    var global = {};
    var protagonist = {};
    var npc = {};
    (paths || []).forEach(function(p) {
      if (!p || !p.path) return;
      var value = vary(p, n);
      if (p.set === 'protagonist') protagonist[p.path] = value;
      else if (p.set === 'npc') {
        var name = p.role || String(p.path).split('.')[1] || '';
        if (!name) return;
        npc[name] = npc[name] || {};
        npc[name][leafOfPath(p.path)] = value;
      } else global[p.path] = value;
    });
    var out = { global: global };
    if (Object.keys(protagonist).length) out.protagonist = protagonist;
    if (Object.keys(npc).length) out.npc = npc;
    return out;
  }
  return [floor(0), floor(1), floor(2)];
}

/**
 * 更新规则按字段名合并。枚举选项不同时，在该字段下按角色列出。
 * @param {Array<{ path?: string, type?: string, description?: string, check?: string[], options?: string[], min?: number, max?: number }>} variables
 */
export function buildGroupedUpdateRules(variables) {
  var groups = [];
  var index = Object.create(null);
  (variables || []).forEach(function(v) {
    if (!v || !v.path) return;
    var parts = String(v.path).split('.');
    var leaf = parts[parts.length - 1];
    var role = '';
    if (parts[0] === 'NPC' && parts.length >= 3) role = parts[1];
    else if (parts[0] === '角色') role = '主角';
    if (!index[leaf]) {
      index[leaf] = {
        field: leaf,
        type: v.type || 'string',
        description: v.description || '',
        check: Array.isArray(v.check) ? v.check.filter(Boolean).slice(0, 3) : [],
        min: v.min,
        max: v.max,
        optionsByRole: {},
      };
      groups.push(index[leaf]);
    }
    var g = index[leaf];
    if (v.type === 'enum' && Array.isArray(v.options) && v.options.length) {
      g.optionsByRole[role || '全局'] = v.options.slice();
    }
  });
  var lines = ['---', '变量更新规则:'];
  groups.forEach(function(g) {
    lines.push('');
    lines.push('  ' + g.field + ':');
    lines.push('    type: ' + g.type);
    if (g.min !== undefined || g.max !== undefined) {
      lines.push('    range: ' + (g.min != null ? g.min : '-∞') + '~' + (g.max != null ? g.max : '+∞'));
    }
    if (g.description) lines.push('    desc: ' + g.description);
    var roles = Object.keys(g.optionsByRole);
    if (roles.length) {
      var first = g.optionsByRole[roles[0]].join('\0');
      var same = roles.every(function(r) { return g.optionsByRole[r].join('\0') === first; });
      if (same) lines.push('    options: ' + g.optionsByRole[roles[0]].join(' / '));
      else {
        lines.push('    options:');
        roles.forEach(function(r) {
          lines.push('      ' + r + ': ' + g.optionsByRole[r].join(' / '));
        });
      }
    }
    lines.push('    check:');
    var checks = g.check.length ? g.check : ['仅当本轮剧情明确导致该变量变化时更新；无变化不要输出操作'];
    checks.forEach(function(c) { lines.push('      - ' + c); });
  });
  lines.push('');
  lines.push('  输出范围:');
  lines.push('    check:');
  lines.push('      - 只输出本轮真正变化的路径，不要把没变化的人再写一遍');
  return lines.join('\n');
}

/** 状态栏变量设计。已停用：生成变量改走 STATUS_BAR_MVU_FILL_PROMPT。 */
export const STATUS_BAR_MVU_DESIGN_PROMPT =
  '【已停用】状态栏生成变量已改走按人分批填值，本提示词不再被读取。\n'
  + '你是 SillyTavern MVU 变量系统设计专家。请根据状态栏配置设计完整变量 JSON。'
  + '不要输出 zod/YAML/解释；本地会组装注入产物。\n\n'
  + '{{charBlock}}\n'
  + '开启模块（仅允许为这些项设计 variables）：\n{{moduleBlock}}\n'
  + '禁止模块（不得出现下列路径或同义字段）：\n{{forbiddenModuleBlock}}\n'
  + 'NSFW：{{nsfw}}\n'
  + '额外要求：{{extra}}\n\n'
  + '{{pathLayoutSpec}}\n\n'
  + '\n【设计原则】\n'
  + '1. variables 只能覆盖「开启模块」；「禁止模块」中的路径一律不要输出；NSFW=否时禁止一切身体私密字段。\n'
  + '2. 全局字段整卡一份：世界.当前时间、世界.天气、世界.当前地点、任务.当前、事件.标签，仅当对应模块开启。\n'
  + '3. 勾了主角时，字段前缀固定为「角色.」，不要用卡角色名当第一段，禁止写成 NPC.卡角色名。\n'
  + '4. 勾了女角色时，每人用「NPC.姓名.字段」。卡角色本人不得出现在 characters 或 NPC 路径中。两套前缀可以同时存在，禁止把女角色收成「角色.字段」，禁止把主角改写成 NPC。\n'
  + '5. 只勾一边时，只生成那一边，外加开启的全局字段。\n'
  + '6. 恶堕进度、亲密度：主角是 角色.恶堕进度 / 角色.亲密度；女角色是 NPC.姓名.恶堕进度 / NPC.姓名.亲密度。\n'
  + '7. type 仅 string/number/boolean/enum/array/object；enum 必给 options。check 为数组。\n'
  + '8. 变量须可被剧情更新；不要为未开启模块凑字段。\n'
  + '9. default 会写成世界书变量初始化，表示还没选开场时这张卡已经成立的状态。设定里写明的身份、关系、常驻地、身体事实照写。设定没写死、但按这个世界的常理推得出的，给一个说得通的值，不要套示例数字。设定和常理都推不出的，关系用未结识、数值关系用 0、人不在场则写未在场或其日常所在，物品和记忆留空。关系阶段的 options 必须包含未结识，default 必须是 options 里的一项。\n'
  + '10. 【各条开场】互相并列，不是同时发生。不要把某一场的地点、在场人物和此刻动作写成所有人的 default。多条开场互相矛盾的内容不要进 default。只有一条开场、卡面又没有更早的前史时，default 可以写成这场。身体字段只写开局前的客观状态；欲望和比喻不是正在发生的事。\n'
  + '\n【输出】仅 JSON：\n'
  + '{ "summary":"摘要", "variables":[ { "path":"世界.当前时间", "type":"string", "default":"08:00", "description":"时间", "check":["推进时间时更新"] } ] }\n';

/** 按人分批时模型只填短默认值和个别枚举。path / type / description / check 由本地目录提供。 */
export const STATUS_BAR_MVU_FILL_PROMPT =
  '你只为这一批对象填写变量的短默认值。不要输出 path、type、description、check，那些由本地目录提供。\n'
  + '开启模块：\n{{moduleBlock}}\n'
  + '禁止模块：\n{{forbiddenModuleBlock}}\n'
  + 'NSFW：{{nsfw}}\n'
  + '额外要求：{{extra}}\n\n'
  + '【填写规矩】\n'
  + '1. 只返回 JSON：{"defaults":{"字段名":"短值"},"enums":{"关系阶段":["未结识","相识"]}}。\n'
  + '2. defaults 的键是用户消息里列出的字段名。人物字段不要写成 NPC.姓名.字段，也不要写 角色.。\n'
  + '3. 只有关系阶段需要 enums。选项必须包含未结识，defaults 里的关系阶段必须是其中一项。选项可以按这个人来写。\n'
  + '4. default 表示还没选开场时已经成立、且符合这张卡设定的状态。设定写明的照写。没写死但按这个世界推得出的给说得通的短值。推不出的：关系用未结识，数值用 0，其余留空字符串。\n'
  + '5. 各条开场互相并列。不要把某一场的地点和此刻动作写成 default。身体字段只写开局前的客观状态。\n'
  + '6. 每个值不超过一句，不要写人物小传。\n';

/** 排版：只用 data-zb-path / data-zb-meter，不引用主题 CSS。已停用：排版改走 STATUS_BAR_LAYOUT_SHELL_PROMPT。 */
export const STATUS_BAR_CUSTOM_LAYOUT_PROMPT =
  '【已停用】状态栏排版已改走人物模板，本提示词不再被读取。\n'
  + '你是 SillyTavern 状态栏前端排版工程师。根据变量路径与用户的排版风格说明，输出可注入的 HTML 与 CSS。\n\n'
  + '{{charBlock}}\n'
  + 'NSFW：{{nsfw}}\n'
  + '开启模块：\n{{moduleBlock}}\n\n'
  + '【变量路径（必须全部可见）】\n{{pathBlock}}\n\n'
  + '【排版风格说明】\n{{userPrompt}}\n\n'
  + '【绑定规则】\n'
  + '1. 文本值只用属性 data-zb-path，写成 <span data-zb-path="完整路径">示例值</span>。\n'
  + '2. 数值字段才加 data-zb-meter，写在用来表示宽度的元素上，例如 <span data-zb-meter="完整路径" style="width:40%"></span>。非数值字段不要加 data-zb-meter。\n'
  + '3. 禁止 script，禁止内联事件（onclick 等），禁止外部 CDN。\n'
  + '4. 不要引用任何预置主题样式；CSS 写在本次输出里，类名用 zb- 前缀。\n'
  + '5. 主角路径保持「角色.字段」，女角色路径保持「NPC.姓名.字段」，不要改写前缀。\n'
  + '\n【输出】仅 JSON，不要解释：\n'
  + '{ "css": "/* CSS */", "bodyHtml": "<div class=\\"zb-custom-root\\">...</div>" }\n';

/** 排版只写一套外壳。女角色放在 template 里，本地再按姓名展开。 */
export const STATUS_BAR_LAYOUT_SHELL_PROMPT =
  '你是 SillyTavern 状态栏排版工程师。只写 CSS 和一套外壳，不要把每个人的名字和路径都展开。\n\n'
  + 'NSFW：{{nsfw}}\n'
  + '开启模块：\n{{moduleBlock}}\n'
  + '字段清单：\n{{fieldBlock}}\n\n'
  + '【排版风格说明】\n{{userPrompt}}\n\n'
  + '【结构】\n'
  + '1. 全局字段一块。路径用完整路径，例如 data-zb-path="世界.当前时间"。\n'
  + '2. 主角一块。路径用 角色.字段。\n'
  + '3. 女角色只写一套，放在 <template data-zb-repeat="npc"> 里。路径写成 NPC.{{name}}.字段，不要写出具体姓名。\n'
  + '4. 文本用 data-zb-path。数值才加 data-zb-meter。\n'
  + '5. 禁止 script、内联事件、外部 CDN。CSS 类名用 zb- 前缀。\n'
  + '6. 只输出 JSON：{"css":"...","bodyHtml":"<div class=\\"zb-custom-root\\">...</div>"}。\n';

/** 三楼样例提示词。已停用：样例改由 buildLocalSampleFloors 在本地生成。 */
export const STATUS_BAR_SAMPLE_FLOORS_PROMPT =
  '【已停用】三楼样例已改由本地按默认值生成，本提示词不再被读取。\n'
  + '你为状态栏写 3 楼互不相同的样例变量值。只输出 JSON，不要解释。\n'
  + '格式：{"floors":[{"global":{"世界.当前时间":"08:00"},"protagonist":{"角色.情绪":"平静"},"npc":{"林晚":{"情绪":"紧张"}}}]}\n'
  + '必须正好 3 个 floor，且三楼的值不能相同。\n'
  + 'global 的键是完整路径。protagonist 仅在勾了主角时出现，键是完整「角色.字段」路径。\n'
  + 'npc 只含当前入选女角色的姓名，内层键是字段名，不要包含卡角色本人。没勾的那一套不要写。\n'
  + '路径清单：\n{{pathBlock}}\n';

function escAttr(s) {
  return escHtml(s).replace(/'/g, '&#39;');
}
