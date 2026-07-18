/**
 * softmon 信息架构：仅布局 HTML（参数化 class 前缀 ns）
 * 单人 / 多人共用骨架，各族换皮在各自主题 css()
 */
import {
  escHtml, guessPct, bucketPaths, makeCtx, classifyPath,
  worldScopedPaths, rolePaths as pathsForRoleShared,
} from './shared.mjs';

function pickMeta(meta) {
  var time = [];
  var place = [];
  (meta || []).forEach(function(p) {
    var s = (p.label || '') + (p.path || '');
    if (/时间|日期|星期|时刻/.test(s)) time.push(p);
    else if (/地点|位置|场景|天气/.test(s)) place.push(p);
    else place.push(p);
  });
  return { time: time, place: place };
}

function ico(skin, key) {
  var icons = (skin && skin.icons) || {};
  var t = icons[key];
  if (!t) return '';
  return '<span class="' + skin.ns + '-ico ' + skin.ns + '-ico-' + key + '" aria-hidden="true">' + t + '</span>';
}

function accentAt(skin, i) {
  var a = (skin && skin.accents) || ['#81ecec'];
  return a[i % a.length];
}

function miniBars(ns, meters, ctx, accent) {
  var take = meters || [];
  if (!take.length) return '';
  return '<div class="' + ns + '-mini-bars">' + take.map(function(p, i) {
    var pct = guessPct(ctx.plain(p));
    // 完整 label 保证模块勾选可见；短位可用 CSS 截断
    var lab = String(p.label || '') || '值';
    var fillStyle = accent
      ? 'width:' + pct + '%;background:linear-gradient(90deg,' + accent + ',transparent)'
      : 'width:' + pct + '%';
    var numStyle = accent ? ' style="color:' + accent + '"' : '';
    // 数值用 val：保留 MVU data-zb-path 绑定
    return '<div class="' + ns + '-mini">'
      + '<span class="' + ns + '-mini-lab">' + escHtml(lab) + '</span>'
      + '<div class="' + ns + '-track"><div class="' + ns + '-fill" style="' + fillStyle + '"></div></div>'
      + '<span class="' + ns + '-mini-num"' + numStyle + '>' + ctx.val(p) + '</span></div>';
  }).join('') + '</div>';
}

function detailGrid(ns, list, ctx) {
  if (!list || !list.length) return '';
  return '<div class="' + ns + '-grid">' + list.map(function(p) {
    var full = /内心|记忆|想法|摘要|描述/.test((p.label || '') + (p.path || '')) ? ' ' + ns + '-full' : '';
    return '<div class="' + ns + '-cell' + full + '"><div class="' + ns + '-cell-k">' + escHtml(p.label)
      + '</div><div class="' + ns + '-cell-v">' + ctx.val(p) + '</div></div>';
  }).join('') + '</div>';
}

function eventChips(ns, items, ctx, skin) {
  // 全量 items（含任务/事件/物品/记忆），不再截断
  var list = items || [];
  if (!list.length) return '';
  return '<div class="' + ns + '-events"><div class="' + ns + '-events-h">'
    + ico(skin, 'events') + '事件追踪</div>'
    + '<div class="' + ns + '-chip-rail">' + list.map(function(p) {
      return '<span class="' + ns + '-chip"><b>' + escHtml(p.label) + '</b> '
        + ctx.val(p) + '</span>';
    }).join('') + '</div></div>';
}

function eventChipsMulti(ns, items, ctx, skin) {
  var list = items || [];
  if (!list.length) return '';
  return '<div class="' + ns + '-event-track"><div class="' + ns + '-event-track-h">'
    + ico(skin, 'events') + '事件追踪</div>'
    + '<div class="' + ns + '-chip-rail">' + list.map(function(p) {
      return '<span class="' + ns + '-chip done"><b>' + escHtml(p.label) + '</b> '
        + ctx.val(p) + '</span>';
    }).join('') + '</div></div>';
}

function pathsForRole(allPaths, name) {
  return pathsForRoleShared(allPaths, name);
}

function worldPaths(allPaths) {
  return worldScopedPaths(allPaths);
}

function renderMainCard(ns, name, rolePaths, ctx, accent, open, skin) {
  var b = bucketPaths(rolePaths);
  var thoughts = b.nsfw.filter(function(p) { return /内心|心声|想法/.test(p.label || ''); });
  var bodyNsfw = b.nsfw.filter(function(p) { return thoughts.indexOf(p) < 0; });
  var gridSrc = b.narrative.concat(b.attr).concat(bodyNsfw).slice(0, 6);
  if (thoughts.length) gridSrc = gridSrc.concat(thoughts.slice(0, 1));

  var openAttr = open ? ' open' : '';
  var h = '<details class="' + ns + '-card"' + openAttr + ' style="--' + ns + '-accent:' + accent + '">';
  h += '<summary class="' + ns + '-head">'
    + '<span class="' + ns + '-name">' + escHtml(name) + '</span>'
    + miniBars(ns, b.meters.length ? b.meters : b.attr, ctx, accent)
    + '<span class="' + ns + '-toggle"></span></summary>';
  h += '<div class="' + ns + '-detail">'
    + detailGrid(ns, gridSrc, ctx)
    + eventChipsMulti(ns, b.items, ctx, skin)
    + '</div></details>';
  return h;
}

function renderOtherCard(ns, name, rolePaths, ctx, accent) {
  var b = bucketPaths(rolePaths);
  var favor = b.meters[0] || b.attr[0];
  var pct = favor ? guessPct(ctx.plain(favor)) : 0;
  var brief = b.narrative.concat(b.attr).slice(0, 3);
  var thought = b.nsfw.concat(b.narrative).find(function(p) {
    return /内心|想法|情绪/.test(p.label || '');
  });

  var h = '<div class="' + ns + '-other" style="--' + ns + '-accent:' + accent + '">';
  h += '<div class="' + ns + '-other-head">'
    + '<span class="' + ns + '-other-name">' + escHtml(name) + '</span>';
  if (favor) {
    h += '<div class="' + ns + '-other-favor"><span class="' + ns + '-other-lab">' + escHtml(favor.label) + '</span>'
      + '<div class="' + ns + '-track"><div class="' + ns + '-fill" style="width:' + pct
      + '%;background:linear-gradient(90deg,' + accent + ',transparent)"></div></div>'
      + '<span class="' + ns + '-mini-num" style="color:' + accent + '">' + ctx.val(favor) + '</span></div>';
  }
  h += '</div>';
  if (brief.length || thought) {
    h += '<div class="' + ns + '-other-info">';
    brief.forEach(function(p) {
      h += '<div class="' + ns + '-other-i"><span class="' + ns + '-other-lab">' + escHtml(p.label)
        + '：</span><span class="' + ns + '-other-v">' + ctx.val(p) + '</span></div>';
    });
    if (thought && brief.indexOf(thought) < 0) {
      h += '<div class="' + ns + '-other-i ' + ns + '-full"><span class="' + ns + '-other-lab">' + escHtml(thought.label)
        + '：</span><span class="' + ns + '-other-v">' + ctx.val(thought) + '</span></div>';
    }
    h += '</div>';
  }
  h += '</div>';
  return h;
}

/**
 * @param {{ paths: any[], title?: string, mainName?: string, valueFn: Function, rawValueHtml?: boolean }} opts
 * @param {{ ns: string, footer?: string, icons?: object, accents?: string[] }} skin
 */
export function renderSoftmonSingle(opts, skin) {
  var ns = skin.ns;
  var paths = Array.isArray(opts && opts.paths) ? opts.paths : [];
  if (!paths.length) return '<div class="' + ns + '-empty">暂无变量路径</div>';
  var ctx = makeCtx(opts.valueFn, !!(opts && opts.rawValueHtml));
  var b = bucketPaths(paths);
  var main = String((opts && opts.mainName) || '角色');
  var wm = pickMeta(b.meta);
  var timeHtml = wm.time.map(function(p) { return escHtml(p.label) + ' ' + ctx.val(p); }).join(' ') || '—';
  var placeHtml = wm.place.map(function(p) { return escHtml(p.label) + ' ' + ctx.val(p); }).join(' · ') || '—';

  var thoughts = b.nsfw.filter(function(p) { return /内心|心声|想法/.test(p.label || ''); });
  var bodyNsfw = b.nsfw.filter(function(p) { return thoughts.indexOf(p) < 0; });
  var gridSrc = b.narrative.concat(b.attr).concat(bodyNsfw);
  if (thoughts.length) gridSrc = gridSrc.concat(thoughts);

  var accent = accentAt(skin, 0);
  var h = '<div class="' + ns + '-panel">';
  h += '<div class="' + ns + '-top"><div class="' + ns + '-world">'
    + '<div class="' + ns + '-world-primary">' + ico(skin, 'time')
    + '<span class="' + ns + '-datetime">' + timeHtml + '</span></div>'
    + '<div class="' + ns + '-world-secondary">' + ico(skin, 'loc')
    + '<span class="' + ns + '-loc">' + placeHtml + '</span></div>'
    + '</div></div>';

  h += '<div class="' + ns + '-chars"><div class="' + ns + '-card" style="--' + ns + '-accent:' + accent + '">';
  h += '<div class="' + ns + '-head">'
    + '<span class="' + ns + '-name">' + escHtml(main) + '</span>'
    + miniBars(ns, b.meters, ctx, null)
    + '</div>';
  h += '<div class="' + ns + '-detail">'
    + detailGrid(ns, gridSrc, ctx)
    + eventChips(ns, b.items, ctx, skin)
    + '</div>';
  h += '</div></div>';

  var foot = String((skin && skin.footer) || 'STATUS');
  h += '<div class="' + ns + '-foot"><span class="' + ns + '-deco"></span><span class="'
    + ns + '-deco-t">' + escHtml(foot) + '</span><span class="' + ns + '-deco"></span></div>';
  h += '</div>';
  return h;
}

/**
 * @param {{ paths: any[], allPaths?: any[], title?: string, characters?: any[], mainName?: string, valueFn: Function, rawValueHtml?: boolean }} opts
 * @param {{ ns: string, footer?: string, icons?: object, accents?: string[] }} skin
 */
export function renderSoftmonMulti(opts, skin) {
  var ns = skin.ns;
  var allPaths = Array.isArray(opts && opts.allPaths) && opts.allPaths.length
    ? opts.allPaths
    : (Array.isArray(opts && opts.paths) ? opts.paths : []);
  if (!allPaths.length) return '<div class="' + ns + '-empty">暂无变量路径</div>';

  var ctx = makeCtx(opts.valueFn, !!(opts && opts.rawValueHtml));
  var characters = Array.isArray(opts && opts.characters) ? opts.characters : [];
  var mainName = String((opts && opts.mainName) || (characters[0] && characters[0].name) || '');
  var cast = characters.length
    ? characters.filter(function(c) { return c.selected !== false; })
    : (mainName ? [{ name: mainName }] : [{ name: '主视角' }]);
  if (!cast.length) cast = [{ name: mainName || '主视角' }];
  var main = mainName || cast[0].name;

  var world = bucketPaths(worldPaths(allPaths));
  var wm = pickMeta(world.meta.length ? world.meta : bucketPaths(allPaths).meta);
  var timeHtml = wm.time.map(function(p) { return escHtml(p.label) + ' ' + ctx.val(p); }).join(' ') || '—';
  var placeHtml = wm.place.map(function(p) { return escHtml(p.label) + ' ' + ctx.val(p); }).join(' · ') || '—';

  // 人人同结构：同一套主卡模板；mainName 仅决定默认展开
  var h = '<div class="' + ns + '-panel">';
  h += '<div class="' + ns + '-top"><div class="' + ns + '-world">'
    + '<div class="' + ns + '-world-primary">' + ico(skin, 'time')
    + '<span class="' + ns + '-datetime">' + timeHtml + '</span></div>'
    + '<div class="' + ns + '-world-secondary">' + ico(skin, 'loc')
    + '<span class="' + ns + '-loc">' + placeHtml + '</span></div>'
    + '</div></div>';

  h += '<div class="' + ns + '-chars">';
  cast.forEach(function(c, i) {
    var rp = pathsForRole(allPaths, c.name);
    if (!rp.length) {
      // 无专属路径时不降级为单字段摘要，尽量回落同规格切片
      rp = allPaths.filter(function(p) {
        return p.role === c.name || (!p.role && classifyPath(p) !== 'meta');
      });
    }
    h += renderMainCard(ns, c.name, rp, ctx, accentAt(skin, i), c.name === main, skin);
  });
  h += '</div>';

  var globalEvents = allPaths.filter(function(p) {
    if (p.role) return false;
    return /事件|任务/.test((p.label || '') + (p.path || '') + (p.group || ''));
  });
  if (globalEvents.length) {
    h += '<div class="' + ns + '-events-sec"><details class="' + ns + '-fold">';
    h += '<summary class="' + ns + '-fold-h"><span>' + ico(skin, 'events')
      + '可触发事件</span><span class="' + ns + '-toggle"></span></summary>';
    h += '<div class="' + ns + '-events-list">' + globalEvents.map(function(p) {
      return '<div class="' + ns + '-event-row unlocked"><span class="' + ns + '-event-name">' + escHtml(p.label)
        + '</span><span class="' + ns + '-event-status">' + ctx.val(p) + '</span></div>';
    }).join('') + '</div></details></div>';
  }

  var foot = String((skin && skin.footer) || 'STATUS');
  h += '<div class="' + ns + '-foot"><span class="' + ns + '-deco"></span><span class="'
    + ns + '-deco-t">' + escHtml(foot) + '</span><span class="' + ns + '-deco"></span></div>';
  h += '</div>';
  return h;
}
