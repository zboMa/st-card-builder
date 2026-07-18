/**
 * RPG 群像（多人）—— 队伍条点选，右栏同密度角色页
 */
import { escHtml, guessPct, makeCtx, rolePaths, roleFieldLists, questEventSectionHtml, worldScopedPaths, classifyPath, formatMetaLine } from './shared.mjs';

export const meta = {
  id: 'multi_sheet_attr',
  label: 'RPG群像',
  cast: 'multi',
  family: 'rpg',
  blurb: '队伍条点选 · 右栏同密度装备页',
  accent: '#38bdf8',
};

function page(name, paths, ctx, isMain) {
  var rf = roleFieldLists(paths);
  var stats = rf.meters;
  var bag = rf.detail;
  var h = '<div class="rpg-page' + (isMain ? ' is-main' : '') + '">';
  h += '<div class="rpg-page-h"><span class="rpg-frame-sm">' + escHtml(name.slice(0, 1)) + '</span>'
    + '<b>' + escHtml(name) + '</b>' + (isMain ? '<em>主视角</em>' : '') + '</div>';
  h += '<div class="rpg-mini-bars">';
  stats.forEach(function(p) {
    var pct = guessPct(ctx.plain(p));
    h += '<div class="rpg-stat"><span class="rpg-stat-k">' + escHtml(p.label) + '</span>'
      + '<div class="rpg-track"><div class="rpg-fill" style="width:' + pct + '%"></div></div>'
      + '<span class="rpg-stat-v">' + ctx.val(p) + '</span></div>';
  });
  h += '</div><div class="rpg-grid">';
  bag.forEach(function(p) {
    h += '<div class="rpg-slot"><div class="rpg-slot-k">' + escHtml(p.label) + '</div>'
      + '<div class="rpg-slot-v">' + ctx.val(p) + '</div></div>';
  });
  h += '</div></div>';
  return h;
}

/** @param {object} opts */
export function render(opts) {
  var allPaths = Array.isArray(opts && opts.allPaths) && opts.allPaths.length ? opts.allPaths : (opts.paths || []);
  if (!allPaths.length) return '<div class="rpg-empty">无队伍</div>';
  var characters = Array.isArray(opts && opts.characters) ? opts.characters : [];
  var mainName = String((opts && opts.mainName) || (characters[0] && characters[0].name) || '');
  var cast = characters.length ? characters.filter(function(c) { return c.selected !== false; }) : [{ name: mainName || '冒险者' }];
  var main = mainName || cast[0].name;
  var ctx = makeCtx(opts.valueFn, !!(opts && opts.rawValueHtml));
  var world = formatMetaLine(worldScopedPaths(allPaths).filter(function(p) { return classifyPath(p) === 'meta'; }), ctx);

  var h = '<div class="rpg-panel rpg-party">';
  h += '<div class="rpg-world">' + escHtml(world || 'PARTY STATUS') + '</div>';
  h += '<div class="rpg-layout"><div class="rpg-party-bar">';
  cast.forEach(function(c, i) {
    var on = c.name === main || (i === 0 && !cast.some(function(x) { return x.name === main; }));
    h += '<button type="button" class="rpg-member' + (on ? ' is-on' : '') + '" data-m="' + i + '">'
      + '<span class="rpg-frame-sm">' + escHtml(c.name.slice(0, 1)) + '</span>'
      + '<span>' + escHtml(c.name) + '</span></button>';
  });
  h += '</div><div class="rpg-detail">';
  cast.forEach(function(c, i) {
    var rp = rolePaths(allPaths, c.name);
    var show = c.name === main || (i === 0 && !cast.some(function(x) { return x.name === main; }));
    h += '<div data-m-pane="' + i + '"' + (show ? '' : ' hidden') + '>' + page(c.name, rp, ctx, c.name === main) + '</div>';
  });
  h += '</div></div>';
  h += questEventSectionHtml(allPaths, ctx, 'rpg-qe');
  h += '</div>';
  h += '<script>(function(){var root=document.currentScript&&document.currentScript.previousElementSibling;if(!root||!root.classList.contains("rpg-panel"))root=document.querySelector(".zb-root .rpg-panel");if(!root)return;var ms=root.querySelectorAll(".rpg-member");var panes=root.querySelectorAll("[data-m-pane]");ms.forEach(function(btn){btn.addEventListener("click",function(){var id=btn.getAttribute("data-m");ms.forEach(function(m){m.classList.toggle("is-on",m===btn);});panes.forEach(function(p){p.hidden=p.getAttribute("data-m-pane")!==id;});});});})();</script>';
  return h;
}

export function css() {
  return [
    '.zb-root{box-sizing:border-box;width:100%;max-width:720px;margin:0 auto;padding:12px;font-family:"Segoe UI","Microsoft YaHei",sans-serif;font-size:12px;line-height:1.4;color:#e0f2fe;background:linear-gradient(180deg,#0b1220,#0f172a)}',
    '.zb-root *,.zb-root *:before,.zb-root *:after{box-sizing:border-box}',
    '.rpg-empty{padding:20px;text-align:center;opacity:.5}',
    '.rpg-panel{border:1px solid rgba(56,189,248,.35);border-radius:10px;padding:12px;background:rgba(15,23,42,.75)}',
    '.rpg-world{font-size:10px;opacity:.6;margin-bottom:8px;letter-spacing:.08em}',
    '.rpg-layout{display:grid;grid-template-columns:100px 1fr;gap:10px}',
    '.rpg-party-bar{display:flex;flex-direction:column;gap:6px}',
    '.rpg-member{appearance:none;display:flex;align-items:center;gap:6px;padding:6px;background:rgba(2,6,23,.5);border:1px solid rgba(56,189,248,.2);border-radius:6px;color:#e0f2fe;font:inherit;font-size:11px;cursor:pointer;text-align:left}',
    '.rpg-member.is-on{border-color:#38bdf8;background:rgba(56,189,248,.15)}',
    '.rpg-frame-sm{width:28px;height:28px;border:1px solid #38bdf8;border-radius:4px;display:flex;align-items:center;justify-content:center;font-weight:800;color:#7dd3fc;flex:0 0 auto}',
    '.rpg-page-h{display:flex;align-items:center;gap:8px;margin-bottom:10px}',
    '.rpg-page-h b{font-size:13px;color:#7dd3fc}',
    '.rpg-page-h em{font-style:normal;font-size:10px;padding:1px 6px;background:#0284c7;border-radius:999px}',
    '.rpg-mini-bars{display:flex;flex-direction:column;gap:5px;margin-bottom:10px}',
    '.rpg-stat{display:grid;grid-template-columns:44px 1fr 36px;gap:6px;align-items:center}',
    '.rpg-stat-k{font-size:10px;opacity:.65}',
    '.rpg-track{height:5px;background:#020617;border-radius:2px;overflow:hidden}',
    '.rpg-fill{height:100%;background:linear-gradient(90deg,#0284c7,#38bdf8)}',
    '.rpg-stat-v,.rpg-stat-v .zb-value{font-size:10px;text-align:right;color:#7dd3fc!important;font-weight:700}',
    '.rpg-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}',
    '.rpg-slot{border:1px solid rgba(56,189,248,.2);border-radius:4px;padding:5px;min-height:48px;background:rgba(2,6,23,.4)}',
    '.rpg-slot-k{font-size:9px;opacity:.5;margin-bottom:2px}',
    '.rpg-slot-v,.rpg-slot-v .zb-value{font-size:10px;font-weight:700;color:#e0f2fe!important}',
    '@media(max-width:480px){.rpg-layout{grid-template-columns:1fr}.rpg-party-bar{flex-direction:row;flex-wrap:wrap}.rpg-grid{grid-template-columns:repeat(2,1fr)}}',
    '.rpg-qe{margin-top:10px;padding-top:8px;border-top:1px solid rgba(127,127,127,.28)}',
    '.rpg-qe-h{font-size:10px;letter-spacing:.12em;opacity:.7;margin-bottom:6px}',
    '.rpg-qe-rail{display:flex;flex-wrap:wrap;gap:6px}',
    '.rpg-qe-chip{font-size:10px;padding:3px 8px;border:1px solid rgba(127,127,127,.35);border-radius:4px}',
  ].join('');
}
