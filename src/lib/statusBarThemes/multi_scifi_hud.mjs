/**
 * 科幻群像（多人）—— 舰桥席位图点选，侧屏同套遥测
 */
import { escHtml, guessPct, makeCtx, rolePaths, roleFieldLists, questEventSectionHtml, worldScopedPaths, classifyPath, formatMetaLine } from './shared.mjs';

export const meta = {
  id: 'multi_scifi_hud',
  label: '科幻群像',
  cast: 'multi',
  family: 'scifi',
  blurb: '舰桥席位点选 · 侧屏同套遥测',
  accent: '#2dd4bf',
};

function telemetry(name, paths, ctx) {
  var rf = roleFieldLists(paths);
  var ring = rf.meters;
  var lines = rf.detail;
  var h = '<div class="sci-side">';
  h += '<div class="sci-side-h">' + escHtml(name) + ' // TELEMETRY</div>';
  h += '<div class="sci-grid">';
  ring.forEach(function(p) {
    var pct = guessPct(ctx.plain(p));
    h += '<div class="sci-cell"><div class="sci-cell-k">' + escHtml(p.label) + '</div>'
      + '<div class="sci-gauge"><i style="width:' + pct + '%"></i></div>'
      + '<div class="sci-cell-v">' + ctx.val(p) + '</div></div>';
  });
  h += '</div>';
  lines.forEach(function(p) {
    h += '<div class="sci-tick"><span>' + escHtml(p.label) + '</span><b>' + ctx.val(p) + '</b></div>';
  });
  h += '</div>';
  return h;
}

/** @param {object} opts */
export function render(opts) {
  var allPaths = Array.isArray(opts && opts.allPaths) && opts.allPaths.length ? opts.allPaths : (opts.paths || []);
  if (!allPaths.length) return '<div class="sci-empty">NO CREW</div>';
  var characters = Array.isArray(opts && opts.characters) ? opts.characters : [];
  var mainName = String((opts && opts.mainName) || (characters[0] && characters[0].name) || '');
  var cast = characters.length ? characters.filter(function(c) { return c.selected !== false; }) : [{ name: mainName || 'CREW' }];
  var main = mainName || cast[0].name;
  var ctx = makeCtx(opts.valueFn, !!(opts && opts.rawValueHtml));
  var world = formatMetaLine(worldScopedPaths(allPaths).filter(function(p) { return classifyPath(p) === 'meta'; }), ctx);

  var h = '<div class="sci-panel sci-bridge">';
  h += '<div class="sci-bridge-h">BRIDGE · ' + escHtml(world || 'STATION') + '</div>';
  h += '<div class="sci-seats">';
  cast.forEach(function(c, i) {
    var on = c.name === main || (i === 0 && !cast.some(function(x) { return x.name === main; }));
    h += '<button type="button" class="sci-seat' + (on ? ' is-on' : '') + '" data-s="' + i + '">'
      + '<i></i><span>' + escHtml(c.name) + '</span></button>';
  });
  h += '</div><div class="sci-side-wrap">';
  cast.forEach(function(c, i) {
    var rp = rolePaths(allPaths, c.name);
    var show = c.name === main || (i === 0 && !cast.some(function(x) { return x.name === main; }));
    h += '<div data-s-pane="' + i + '"' + (show ? '' : ' hidden') + '>' + telemetry(c.name, rp, ctx) + '</div>';
  });
  h += '</div>';
  h += questEventSectionHtml(allPaths, ctx, 'sci-qe');
  h += '</div>';
  h += '<script>(function(){var root=document.currentScript&&document.currentScript.previousElementSibling;if(!root||!root.classList.contains("sci-panel"))root=document.querySelector(".zb-root .sci-panel");if(!root)return;var seats=root.querySelectorAll(".sci-seat");var panes=root.querySelectorAll("[data-s-pane]");seats.forEach(function(btn){btn.addEventListener("click",function(){var id=btn.getAttribute("data-s");seats.forEach(function(s){s.classList.toggle("is-on",s===btn);});panes.forEach(function(p){p.hidden=p.getAttribute("data-s-pane")!==id;});});});})();</script>';
  return h;
}

export function css() {
  return [
    '.zb-root{box-sizing:border-box;width:100%;max-width:720px;margin:0 auto;padding:12px;font-family:"Segoe UI","Consolas",sans-serif;font-size:12px;line-height:1.4;color:#99f6e4;background:#020617}',
    '.zb-root *,.zb-root *:before,.zb-root *:after{box-sizing:border-box}',
    '.sci-empty{padding:24px;text-align:center;opacity:.5}',
    '.sci-panel{border:1px solid rgba(45,212,191,.35);padding:12px;background:rgba(2,6,23,.85)}',
    '.sci-bridge-h{font-size:10px;letter-spacing:.2em;opacity:.65;margin-bottom:10px}',
    '.sci-seats{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;justify-content:center}',
    '.sci-seat{appearance:none;display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 12px;background:rgba(45,212,191,.06);border:1px solid rgba(45,212,191,.25);color:#99f6e4;font:inherit;font-size:10px;cursor:pointer;min-width:64px}',
    '.sci-seat i{width:28px;height:28px;border-radius:50%;border:2px solid rgba(45,212,191,.4);background:rgba(45,212,191,.1)}',
    '.sci-seat.is-on{border-color:#2dd4bf;box-shadow:0 0 12px rgba(45,212,191,.3)}',
    '.sci-seat.is-on i{background:#2dd4bf;box-shadow:0 0 10px #2dd4bf}',
    '.sci-side-h{font-size:11px;letter-spacing:.1em;color:#5eead4;margin-bottom:8px}',
    '.sci-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px}',
    '.sci-cell{padding:6px;border:1px solid rgba(45,212,191,.2)}',
    '.sci-cell-k{font-size:9px;opacity:.6}',
    '.sci-gauge{height:4px;background:#0f172a;margin:3px 0;overflow:hidden}',
    '.sci-gauge>i{display:block;height:100%;background:linear-gradient(90deg,#0d9488,#2dd4bf)}',
    '.sci-cell-v,.sci-cell-v .zb-value{font-size:11px;font-weight:700;color:#99f6e4!important}',
    '.sci-tick{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dotted rgba(45,212,191,.2);font-size:10px}',
    '.sci-tick b,.sci-tick .zb-value{color:#5eead4!important}',
    '.sci-qe{margin-top:10px;padding-top:8px;border-top:1px solid rgba(127,127,127,.28)}',
    '.sci-qe-h{font-size:10px;letter-spacing:.12em;opacity:.7;margin-bottom:6px}',
    '.sci-qe-rail{display:flex;flex-wrap:wrap;gap:6px}',
    '.sci-qe-chip{font-size:10px;padding:3px 8px;border:1px solid rgba(127,127,127,.35);border-radius:4px}',
  ].join('');
}
