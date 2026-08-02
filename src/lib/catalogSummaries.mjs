/**
 * 将 summary 挂到目录对象（展示/助手概览用）
 */
import { NTL_GROUPS, NTL_GROUP_IDS } from './adult/ntl/groups.mjs';
import { WORLDVIEW_GROUPS } from './presets/worldviews/groups.mjs';

export function applySummaries(targetMap, summaryMap) {
  if (!targetMap || !summaryMap) return targetMap;
  Object.keys(targetMap).forEach(function(id) {
    var item = targetMap[id];
    if (!item || typeof item !== 'object') return;
    var s = summaryMap[id];
    if (s) item.summary = String(s);
  });
  return targetMap;
}

export function applySummariesToList(list, summaryMap) {
  if (!Array.isArray(list) || !summaryMap) return list;
  list.forEach(function(item) {
    if (!item || !item.id) return;
    var s = summaryMap[item.id];
    if (s) item.summary = String(s);
  });
  return list;
}

function ntlGroupLabel(id) {
  var m = NTL_GROUPS[id];
  return m ? m.label : id;
}

function worldViewGroupLabel(id) {
  for (var i = 0; i < WORLDVIEW_GROUPS.length; i++) {
    if (WORLDVIEW_GROUPS[i].id === id) return WORLDVIEW_GROUPS[i].label;
  }
  return id;
}

function groupExpression(map) {
  var byG = Object.create(null);
  Object.keys(map).forEach(function(id) {
    var p = map[id];
    var g = (p && p.group) || '其他';
    if (!byG[g]) byG[g] = [];
    byG[g].push({ id: id, label: (p && p.label) || id, summary: (p && p.summary) || '' });
  });
  return Object.keys(byG).map(function(g) {
    return { group: g, items: byG[g] };
  });
}

/**
 * 结构化成人目录数据（get_adult_catalog 工具 / 概览 / 索引共用）
 * 返回：
 * {
 *   flavors:     [{ group, items:[{id,label,summary}] }],
 *   postures:    [{ group, items:[...] }],
 *   speeches:    [{ group, items:[...] }],
 *   ntl:         [{ group(中文), items:[...] }],
 *   worldframes: [{ id,label,summary }],   // 平铺（跳过 generic）
 *   worldviews:  [{ group(中文), items:[...] }],
 * }
 */
export function buildAdultCatalogData(opts) {
  opts = opts || {};
  var out = {};

  if (opts.flavors) {
    var byF = Object.create(null);
    Object.keys(opts.flavors).forEach(function(id) {
      var f = opts.flavors[id];
      var g = (f && f.group) || '其他';
      if (!byF[g]) byF[g] = [];
      byF[g].push({ id: id, label: (f && f.label) || id, summary: (f && f.summary) || '' });
    });
    out.flavors = Object.keys(byF).map(function(g) { return { group: g, items: byF[g] }; });
  }

  if (opts.postures) out.postures = groupExpression(opts.postures);
  if (opts.speeches) out.speeches = groupExpression(opts.speeches);

  if (opts.ntl) {
    var byN = Object.create(null);
    var orderN = NTL_GROUP_IDS.slice();
    Object.keys(opts.ntl).forEach(function(id) {
      var t = opts.ntl[id];
      var g = (t && t.group) || 'other';
      if (!byN[g]) { byN[g] = []; if (orderN.indexOf(g) < 0) orderN.push(g); }
      byN[g].push({ id: id, label: (t && t.label) || id, summary: (t && t.summary) || '' });
    });
    out.ntl = orderN.filter(function(g) { return byN[g] && byN[g].length; }).map(function(g) {
      return { group: ntlGroupLabel(g), items: byN[g] };
    });
  }

  if (opts.worldframes) {
    var frameIds = opts.worldframeIds || Object.keys(opts.worldframes);
    out.worldframes = frameIds.filter(function(id) {
      return id !== 'generic' && opts.worldframes[id];
    }).map(function(id) {
      var w = opts.worldframes[id];
      return { id: id, label: w.label || id, summary: w.summary || '' };
    });
  }

  if (opts.worldviews && opts.worldviews.length) {
    var byW = Object.create(null);
    var orderW = WORLDVIEW_GROUPS.map(function(g) { return g.id; });
    opts.worldviews.forEach(function(p) {
      var g = p.group || 'other';
      if (!byW[g]) { byW[g] = []; if (orderW.indexOf(g) < 0) orderW.push(g); }
      byW[g].push({ id: p.id, label: p.label || p.id, summary: p.summary || '' });
    });
    out.worldviews = orderW.filter(function(g) { return byW[g] && byW[g].length; }).map(function(g) {
      return { group: worldViewGroupLabel(g), items: byW[g] };
    });
  }

  return out;
}

function kindLine(label, groups) {
  var parts = groups.map(function(g) { return g.group + '(' + g.items.length + ')'; });
  var total = groups.reduce(function(n, g) { return n + g.items.length; }, 0);
  return '■ ' + label + '：' + parts.join('、') + ' ｜ 共 ' + groups.length + ' 组 ' + total + ' 条';
}

/**
 * 紧凑目录索引（system 默认用；省 token）
 * @returns {string}
 */
export function buildCatalogIndexText(opts) {
  var data = buildAdultCatalogData(opts);
  var lines = [];
  lines.push('【目录索引·选配参考】具体 id 与摘要用 get_adult_catalog 查询；勿凭印象编造 id。');
  if (data.flavors && data.flavors.length) lines.push(kindLine('口味 NSFW（多选最多5）', data.flavors));
  if (data.postures && data.postures.length) lines.push(kindLine('姿势语言（不占口味槽）', data.postures));
  if (data.speeches && data.speeches.length) lines.push(kindLine('情趣话风（不占口味槽）', data.speeches));
  if (data.ntl && data.ntl.length) lines.push(kindLine('NTL 禁忌（多选）', data.ntl));
  if (data.worldframes && data.worldframes.length) lines.push('■ 世界观框架（载体物化）：' + data.worldframes.length + ' 种');
  if (data.worldviews && data.worldviews.length) lines.push(kindLine('世界观预设（多选最多3）', data.worldviews));
  return lines.join('\n');
}

/**
 * 助手 system 用目录概览（id · label — summary；按需注入）
 * @returns {string}
 */
export function buildCatalogOverviewText(opts) {
  var data = buildAdultCatalogData(opts);
  var lines = [];
  lines.push('【目录概览·仅作选配参考；改配置用 get/set_adult_config；长文写作指引在 enrichment，勿把概览当正文】');

  if (data.flavors && data.flavors.length) {
    lines.push('■ 口味 NSFW（按组；多选最多5，首项主调色盘）');
    data.flavors.forEach(function(g) {
      lines.push('·' + g.group + '：');
      g.items.forEach(function(it) {
        lines.push('  ' + it.id + ' · ' + it.label + ' — ' + it.summary);
      });
    });
  }

  if (data.postures && data.postures.length) {
    lines.push('■ 姿势语言（表达层；不占口味槽，可多选）');
    data.postures.forEach(function(g) {
      g.items.forEach(function(it) {
        lines.push('  ' + it.id + ' · ' + it.label + ' — ' + it.summary);
      });
    });
  }

  if (data.speeches && data.speeches.length) {
    lines.push('■ 情趣话风（表达层；不占口味槽，可多选）');
    data.speeches.forEach(function(g) {
      g.items.forEach(function(it) {
        lines.push('  ' + it.id + ' · ' + it.label + ' — ' + it.summary);
      });
    });
  }

  if (data.ntl && data.ntl.length) {
    lines.push('■ NTL 禁忌（多选）');
    data.ntl.forEach(function(g) {
      lines.push('·' + g.group + '：');
      g.items.forEach(function(it) {
        lines.push('  ' + it.id + ' · ' + it.label + ' — ' + it.summary);
      });
    });
  }

  if (data.worldframes && data.worldframes.length) {
    lines.push('■ 世界观框架（载体物化；成人配置手动/自动）');
    data.worldframes.forEach(function(w) {
      lines.push('  ' + w.id + ' · ' + w.label + ' — ' + w.summary);
    });
  }

  if (data.worldviews && data.worldviews.length) {
    lines.push('■ 世界观预设（AI 引擎多选底盘）');
    data.worldviews.forEach(function(g) {
      lines.push('·' + g.group + '：');
      g.items.forEach(function(it) {
        lines.push('  ' + it.id + ' · ' + it.label + ' — ' + it.summary);
      });
    });
  }

  return lines.join('\n');
}

/**
 * 目录相关关键词：命中则按需注入完整概览（方案 B 混合注入）
 */
export const CATALOG_KEYWORDS = [
  '世界与限定', '世界观', '口味', '姿势', '话风', 'NTL', '禁忌',
  '恶堕', 'NSFW', '成人', '框架', '载体', '玩法', '人外', '调教',
  '百合', '寝取', '推荐搭配', '配卡', '色情', '重口',
];

/**
 * 判断文本是否与成人目录相关（用于决定是否注入完整概览）
 * @param {string} [text]
 * @returns {boolean}
 */
export function isCatalogRelevantText(text) {
  var s = String(text == null ? '' : text);
  if (!s) return false;
  for (var i = 0; i < CATALOG_KEYWORDS.length; i++) {
    if (s.indexOf(CATALOG_KEYWORDS[i]) >= 0) return true;
  }
  return false;
}
