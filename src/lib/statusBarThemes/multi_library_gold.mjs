/**
 * 古书群像（多人）—— 书架脊背点选进册；人人同套
 */
import { escHtml, guessPct, makeCtx, rolePaths, roleFieldLists, questEventSectionHtml, worldScopedPaths, classifyPath, formatMetaLine } from './shared.mjs';

export const meta = {
  id: 'multi_library_gold',
  label: '古书群像',
  cast: 'multi',
  family: 'library',
  blurb: '书架脊背点选 · 进册同信息量',
  accent: '#d4a017',
};

function book(name, paths, ctx, isMain) {
  var rf = roleFieldLists(paths);
  var meters = rf.meters;
  var cells = rf.detail;
  var h = '<div class="lib-book' + (isMain ? ' is-main' : '') + '">';
  h += '<div class="lib-book-h">' + escHtml(name) + (isMain ? ' · 主册' : '') + '</div>';
  h += '<div class="lib-grid">';
  meters.forEach(function(p) {
    var pct = guessPct(ctx.plain(p));
    h += '<div class="lib-cell"><div class="lib-cell-k">' + escHtml(p.label) + '</div>'
      + '<div class="lib-ink"><i style="width:' + pct + '%"></i></div>'
      + '<div class="lib-cell-v">' + ctx.val(p) + '</div></div>';
  });
  cells.forEach(function(p) {
    h += '<div class="lib-cell"><div class="lib-cell-k">' + escHtml(p.label) + '</div>'
      + '<div class="lib-cell-v">' + ctx.val(p) + '</div></div>';
  });
  h += '</div></div>';
  return h;
}

/** @param {object} opts */
export function render(opts) {
  var allPaths = Array.isArray(opts && opts.allPaths) && opts.allPaths.length ? opts.allPaths : (opts.paths || []);
  if (!allPaths.length) return '<div class="lib-empty">架上空空</div>';
  var characters = Array.isArray(opts && opts.characters) ? opts.characters : [];
  var mainName = String((opts && opts.mainName) || (characters[0] && characters[0].name) || '');
  var cast = characters.length ? characters.filter(function(c) { return c.selected !== false; }) : [{ name: mainName || '卷主' }];
  var main = mainName || cast[0].name;
  var ctx = makeCtx(opts.valueFn, !!(opts && opts.rawValueHtml));
  var world = formatMetaLine(worldScopedPaths(allPaths).filter(function(p) { return classifyPath(p) === 'meta'; }), ctx);

  var h = '<div class="lib-panel lib-shelf">';
  h += '<div class="lib-shelf-lab">' + escHtml(world || '群像书架') + '</div>';
  h += '<div class="lib-spines">';
  cast.forEach(function(c, i) {
    var on = c.name === main || (i === 0 && !cast.some(function(x) { return x.name === main; }));
    var colors = ['#92400e', '#b45309', '#a16207', '#78350f'];
    h += '<button type="button" class="lib-spine' + (on ? ' is-on' : '') + '" data-bk="' + i + '" style="--spine:' + colors[i % colors.length] + '">'
      + '<span>' + escHtml(c.name) + '</span></button>';
  });
  h += '</div>';
  cast.forEach(function(c, i) {
    var rp = rolePaths(allPaths, c.name);
    var show = c.name === main || (i === 0 && !cast.some(function(x) { return x.name === main; }));
    h += '<div data-bk-pane="' + i + '"' + (show ? '' : ' hidden') + '>' + book(c.name, rp, ctx, c.name === main) + '</div>';
  });
  h += questEventSectionHtml(allPaths, ctx, 'lib-qe');
  h += '</div>';
  h += '<script>(function(){var root=document.currentScript&&document.currentScript.previousElementSibling;if(!root||!root.classList.contains("lib-panel"))root=document.querySelector(".zb-root .lib-panel");if(!root)return;var spines=root.querySelectorAll(".lib-spine");var panes=root.querySelectorAll("[data-bk-pane]");spines.forEach(function(btn){btn.addEventListener("click",function(){var id=btn.getAttribute("data-bk");spines.forEach(function(s){s.classList.toggle("is-on",s===btn);});panes.forEach(function(p){p.hidden=p.getAttribute("data-bk-pane")!==id;});});});})();</script>';
  return h;
}

export function css() {
  return [
    '.zb-root{box-sizing:border-box;width:100%;max-width:720px;margin:0 auto;padding:14px;font-family:Georgia,"Songti SC","Microsoft YaHei",serif;font-size:12px;line-height:1.45;color:#f5e6c8;background:#1a1208}',
    '.zb-root *,.zb-root *:before,.zb-root *:after{box-sizing:border-box}',
    '.lib-empty{padding:28px;text-align:center;opacity:.5}',
    '.lib-shelf-lab{text-align:center;letter-spacing:.2em;font-size:11px;color:#c9a46a;margin-bottom:10px}',
    '.lib-spines{display:flex;gap:4px;justify-content:center;align-items:flex-end;margin-bottom:12px;padding:8px;background:linear-gradient(180deg,#3d2a12,#2a1c0c);border:1px solid rgba(212,160,23,.3);min-height:80px}',
    '.lib-spine{appearance:none;width:36px;height:70px;border:1px solid rgba(0,0,0,.4);background:var(--spine,#92400e);color:#fde68a;font:inherit;font-size:10px;font-weight:800;writing-mode:vertical-rl;letter-spacing:.15em;cursor:pointer;padding:6px 4px;box-shadow:inset -3px 0 0 rgba(0,0,0,.25)}',
    '.lib-spine.is-on{height:78px;box-shadow:0 0 0 2px #d4a017,inset -3px 0 0 rgba(0,0,0,.25)}',
    '.lib-book{border:1px solid rgba(212,160,23,.4);padding:12px;background:linear-gradient(160deg,#2a1c0c,#1a1208)}',
    '.lib-book.is-main{border-color:#d4a017}',
    '.lib-book-h{letter-spacing:.25em;color:#e8c547;margin-bottom:10px;font-weight:800}',
    '.lib-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}',
    '.lib-cell{padding:6px;background:rgba(212,160,23,.06);border:1px solid rgba(212,160,23,.2)}',
    '.lib-cell-k{font-size:9px;color:#a67c52}',
    '.lib-cell-v,.lib-cell-v .zb-value{font-size:11px;font-weight:700;color:#f5e6c8!important}',
    '.lib-ink{height:3px;background:rgba(0,0,0,.35);margin:3px 0;overflow:hidden}',
    '.lib-ink>i{display:block;height:100%;background:linear-gradient(90deg,#92400e,#d4a017)}',
    '.lib-panel{/* */}',
    '.lib-qe{margin-top:10px;padding-top:8px;border-top:1px solid rgba(127,127,127,.28)}',
    '.lib-qe-h{font-size:10px;letter-spacing:.12em;opacity:.7;margin-bottom:6px}',
    '.lib-qe-rail{display:flex;flex-wrap:wrap;gap:6px}',
    '.lib-qe-chip{font-size:10px;padding:3px 8px;border:1px solid rgba(127,127,127,.35);border-radius:4px}',
  ].join('');
}
