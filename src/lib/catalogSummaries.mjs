/**
 * 将 summary 挂到目录对象（展示/助手概览用）
 */
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

/**
 * 助手 system 用目录概览（id · label — summary）
 * @returns {string}
 */
export function buildCatalogOverviewText(opts) {
  opts = opts || {};
  var lines = [];
  lines.push('【目录概览·仅作选配参考；改配置用 get/set_adult_config；长文写作指引在 enrichment，勿把概览当正文】');

  if (opts.flavors) {
    lines.push('■ 口味 NSFW（按组；多选最多5，首项主调色盘）');
    var byG = Object.create(null);
    Object.keys(opts.flavors).forEach(function(id) {
      var f = opts.flavors[id];
      var g = (f && f.group) || '其他';
      if (!byG[g]) byG[g] = [];
      byG[g].push(id);
    });
    Object.keys(byG).forEach(function(g) {
      lines.push('·' + g + '：');
      byG[g].forEach(function(id) {
        var f = opts.flavors[id];
        lines.push('  ' + id + ' · ' + (f.label || id) + ' — ' + (f.summary || ''));
      });
    });
  }

  if (opts.postures) {
    lines.push('■ 姿势语言（表达层；不占口味槽，可多选）');
    Object.keys(opts.postures).forEach(function(id) {
      var p = opts.postures[id];
      lines.push('  ' + id + ' · ' + (p.label || id) + ' — ' + (p.summary || ''));
    });
  }

  if (opts.speeches) {
    lines.push('■ 情趣话风（表达层；不占口味槽，可多选）');
    Object.keys(opts.speeches).forEach(function(id) {
      var s = opts.speeches[id];
      lines.push('  ' + id + ' · ' + (s.label || id) + ' — ' + (s.summary || ''));
    });
  }

  if (opts.ntl) {
    lines.push('■ NTL 禁忌（多选）');
    var byN = Object.create(null);
    Object.keys(opts.ntl).forEach(function(id) {
      var t = opts.ntl[id];
      var g = (t && t.group) || 'other';
      if (!byN[g]) byN[g] = [];
      byN[g].push(id);
    });
    Object.keys(byN).forEach(function(g) {
      lines.push('·' + g + '：');
      byN[g].forEach(function(id) {
        var t = opts.ntl[id];
        lines.push('  ' + id + ' · ' + (t.label || id) + ' — ' + (t.summary || ''));
      });
    });
  }

  if (opts.worldframes) {
    lines.push('■ 世界观框架（载体物化；成人配置手动/自动）');
    Object.keys(opts.worldframes).forEach(function(id) {
      if (id === 'generic') return;
      var w = opts.worldframes[id];
      lines.push('  ' + id + ' · ' + (w.label || id) + ' — ' + (w.summary || ''));
    });
  }

  if (opts.worldviews && opts.worldviews.length) {
    lines.push('■ 世界观预设（AI 引擎多选底盘）');
    opts.worldviews.forEach(function(p) {
      lines.push('  ' + p.id + ' · ' + (p.label || p.id) + ' — ' + (p.summary || ''));
    });
  }

  return lines.join('\n');
}
