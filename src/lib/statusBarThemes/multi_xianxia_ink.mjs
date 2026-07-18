/**
 * 仙侠群像（多人）—— 一人一牌匾，点匾展开卷；人人同套
 */
import { escHtml, guessPct, makeCtx, rolePaths, roleFieldLists, questEventSectionHtml, worldScopedPaths, classifyPath, formatMetaLine } from './shared.mjs';

export const meta = {
  id: 'multi_xianxia_ink',
  label: '仙侠群像',
  cast: 'multi',
  family: 'xianxia',
  blurb: '一人一牌匾 · 点匾展卷 · 人人同套',
  accent: '#fbbf24',
};

function unitBody(name, paths, ctx) {
  var rf = roleFieldLists(paths);
  var left = rf.meters;
  var right = rf.detail;
  var h = '<div class="xxs-couplet">';
  h += '<div class="xxs-col"><div class="xxs-col-h">修为</div>';
  left.forEach(function(p) {
    var pct = guessPct(ctx.plain(p));
    h += '<div class="xxs-item"><span class="xxs-k">' + escHtml(p.label) + '</span><span class="xxs-bar"><i style="width:' + pct + '%"></i></span><span class="xxs-v">' + ctx.val(p) + '</span></div>';
  });
  h += '</div><div class="xxs-col"><div class="xxs-col-h">行止</div>';
  right.forEach(function(p) {
    h += '<div class="xxs-line"><span class="xxs-k">' + escHtml(p.label) + '</span><span class="xxs-v">' + ctx.val(p) + '</span></div>';
  });
  h += '</div></div>';
  return h;
}

/** @param {object} opts */
export function render(opts) {
  var allPaths = Array.isArray(opts && opts.allPaths) && opts.allPaths.length ? opts.allPaths : (opts.paths || []);
  if (!allPaths.length) return '<div class="xxs-empty">仙册未开</div>';
  var characters = Array.isArray(opts && opts.characters) ? opts.characters : [];
  var mainName = String((opts && opts.mainName) || (characters[0] && characters[0].name) || '');
  var cast = characters.length ? characters.filter(function(c) { return c.selected !== false; }) : [{ name: mainName || '修士' }];
  var main = mainName || cast[0].name;
  var ctx = makeCtx(opts.valueFn, !!(opts && opts.rawValueHtml));
  var world = formatMetaLine(worldScopedPaths(allPaths).filter(function(p) { return classifyPath(p) === 'meta'; }), ctx);

  var h = '<div class="xxs-plaques">';
  h += '<div class="xxs-world">' + escHtml(world || '山中无历日') + '</div>';
  h += '<div class="xxs-plaque-row">';
  cast.forEach(function(c, i) {
    var on = c.name === main || i === 0 && !cast.some(function(x) { return x.name === main; });
    h += '<button type="button" class="xxs-plaque' + (on ? ' is-on' : '') + '" data-pl="' + i + '">'
      + '<span class="xxs-plaque-seal">匾</span><span class="xxs-plaque-name">' + escHtml(c.name) + '</span></button>';
  });
  h += '</div>';
  cast.forEach(function(c, i) {
    var rp = rolePaths(allPaths, c.name);
    var show = c.name === main || (i === 0 && !cast.some(function(x) { return x.name === main; }));
    h += '<div class="xxs-unit" data-pl-pane="' + i + '"' + (show ? '' : ' hidden') + '>';
    h += '<div class="xxs-rod xxs-rod-t"></div><div class="xxs-paper">';
    h += '<div class="xxs-unit-h">' + escHtml(c.name) + (c.name === main ? ' · 主视角' : '') + '</div>';
    h += unitBody(c.name, rp, ctx);
    h += '</div><div class="xxs-rod xxs-rod-b"></div></div>';
  });
  h += questEventSectionHtml(allPaths, ctx, 'xxs-qe');
  h += '</div>';
  h += '<script>(function(){var root=document.currentScript&&document.currentScript.previousElementSibling;if(!root||!root.classList.contains("xxs-plaques"))root=document.querySelector(".zb-root .xxs-plaques");if(!root)return;var pls=root.querySelectorAll(".xxs-plaque");var panes=root.querySelectorAll(".xxs-unit");pls.forEach(function(btn){btn.addEventListener("click",function(){var id=btn.getAttribute("data-pl");pls.forEach(function(p){p.classList.toggle("is-on",p===btn);});panes.forEach(function(p){p.hidden=p.getAttribute("data-pl-pane")!==id;});});});})();</script>';
  return h;
}

export function css() {
  return [
    '.zb-root{box-sizing:border-box;width:100%;max-width:720px;margin:0 auto;padding:12px;font-family:Georgia,"Songti SC","Microsoft YaHei",serif;font-size:12px;line-height:1.45;color:#fef3c7;background:#120c08}',
    '.zb-root *,.zb-root *:before,.zb-root *:after{box-sizing:border-box}',
    '.xxs-empty{padding:28px;text-align:center;opacity:.5}',
    '.xxs-plaques{display:flex;flex-direction:column;gap:10px}',
    '.xxs-world{text-align:center;font-size:11px;color:#c9a46a;letter-spacing:.12em}',
    '.xxs-plaque-row{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}',
    '.xxs-plaque{appearance:none;display:flex;align-items:center;gap:8px;padding:8px 14px;background:linear-gradient(180deg,#2a1a10,#1a100a);border:1px solid rgba(251,191,36,.4);color:#fde68a;font:inherit;cursor:pointer}',
    '.xxs-plaque.is-on{border-color:#fbbf24;box-shadow:0 0 12px rgba(251,191,36,.25)}',
    '.xxs-plaque-seal{width:28px;height:28px;background:#9f1239;color:#fecdd3;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px}',
    '.xxs-plaque-name{font-weight:800;letter-spacing:.15em}',
    '.xxs-unit{display:flex;flex-direction:column}',
    '.xxs-rod{height:12px;border-radius:6px;background:linear-gradient(180deg,#b45309,#78350f)}',
    '.xxs-paper{margin:0 8px;padding:12px;background:#1a100a;border-left:1px solid rgba(251,191,36,.3);border-right:1px solid rgba(251,191,36,.3)}',
    '.xxs-unit-h{text-align:center;letter-spacing:.3em;color:#fbbf24;margin-bottom:10px;font-weight:800}',
    '.xxs-couplet{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
    '.xxs-col{padding:8px;background:rgba(0,0,0,.2);border:1px solid rgba(251,191,36,.2)}',
    '.xxs-col-h{text-align:center;font-size:11px;letter-spacing:.3em;color:#fbbf24;margin-bottom:6px}',
    '.xxs-item{display:grid;grid-template-columns:40px 1fr 36px;gap:6px;align-items:center;margin-bottom:5px}',
    '.xxs-k{font-size:10px;color:#c9a46a}',
    '.xxs-bar{height:4px;background:rgba(0,0,0,.35);overflow:hidden}',
    '.xxs-bar>i{display:block;height:100%;background:linear-gradient(90deg,#b45309,#fbbf24)}',
    '.xxs-v,.xxs-v .zb-value{font-size:11px;font-weight:700;color:#fde68a!important;text-align:right}',
    '.xxs-line{display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px dashed rgba(251,191,36,.15);font-size:11px}',
    '@media(max-width:420px){.xxs-couplet{grid-template-columns:1fr}}',
    '.xxs-qe{margin-top:10px;padding-top:8px;border-top:1px solid rgba(127,127,127,.28)}',
    '.xxs-qe-h{font-size:10px;letter-spacing:.12em;opacity:.7;margin-bottom:6px}',
    '.xxs-qe-rail{display:flex;flex-wrap:wrap;gap:6px}',
    '.xxs-qe-chip{font-size:10px;padding:3px 8px;border:1px solid rgba(127,127,127,.35);border-radius:4px}',
  ].join('');
}
