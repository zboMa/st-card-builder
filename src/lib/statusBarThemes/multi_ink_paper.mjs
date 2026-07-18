/**
 * 水墨群像（多人）—— 折扇面：一扇一人，展扇同信息量
 */
import { escHtml, guessPct, makeCtx, rolePaths, roleFieldLists, questEventSectionHtml, worldScopedPaths, classifyPath, formatMetaLine } from './shared.mjs';

export const meta = {
  id: 'multi_ink_paper',
  label: '水墨群像',
  cast: 'multi',
  family: 'ink',
  blurb: '折扇一面一人 · 展扇同信息量',
  accent: '#475569',
};

function fan(name, paths, ctx, isMain) {
  var rf = roleFieldLists(paths);
  var meters = rf.meters;
  var lines = rf.detail;
  var h = '<div class="ink-fan' + (isMain ? ' is-main' : '') + '">';
  h += '<div class="ink-fan-h"><span class="ink-fan-seal">' + escHtml(name.slice(0, 1)) + '</span>'
    + '<b>' + escHtml(name) + '</b>' + (isMain ? '<em>主</em>' : '') + '</div>';
  meters.forEach(function(p) {
    var pct = guessPct(ctx.plain(p));
    h += '<div class="ink-cell"><div class="ink-cell-k">' + escHtml(p.label) + '</div>'
      + '<div class="ink-cell-v">' + ctx.val(p) + '</div>'
      + '<div class="ink-wash" style="width:' + Math.max(12, pct * 0.4) + '%"></div></div>';
  });
  lines.forEach(function(p) {
    h += '<div class="ink-cell"><div class="ink-cell-k">' + escHtml(p.label) + '</div>'
      + '<div class="ink-cell-v">' + ctx.val(p) + '</div></div>';
  });
  h += '</div>';
  return h;
}

/** @param {object} opts */
export function render(opts) {
  var allPaths = Array.isArray(opts && opts.allPaths) && opts.allPaths.length ? opts.allPaths : (opts.paths || []);
  if (!allPaths.length) return '<div class="ink-empty">扇未展</div>';
  var characters = Array.isArray(opts && opts.characters) ? opts.characters : [];
  var mainName = String((opts && opts.mainName) || (characters[0] && characters[0].name) || '');
  var cast = characters.length ? characters.filter(function(c) { return c.selected !== false; }) : [{ name: mainName || '故人' }];
  var main = mainName || cast[0].name;
  var ctx = makeCtx(opts.valueFn, !!(opts && opts.rawValueHtml));
  var world = formatMetaLine(worldScopedPaths(allPaths).filter(function(p) { return classifyPath(p) === 'meta'; }), ctx);

  var h = '<div class="ink-panel ink-fans">';
  h += '<div class="ink-fans-lab">' + escHtml(world || '折扇群像') + '</div>';
  h += '<div class="ink-fan-ribs">';
  cast.forEach(function(c, i) {
    var on = c.name === main || (i === 0 && !cast.some(function(x) { return x.name === main; }));
    h += '<button type="button" class="ink-rib' + (on ? ' is-on' : '') + '" data-f="' + i + '">' + escHtml(c.name) + '</button>';
  });
  h += '</div>';
  cast.forEach(function(c, i) {
    var rp = rolePaths(allPaths, c.name);
    var show = c.name === main || (i === 0 && !cast.some(function(x) { return x.name === main; }));
    h += '<div data-f-pane="' + i + '"' + (show ? '' : ' hidden') + '>' + fan(c.name, rp, ctx, c.name === main) + '</div>';
  });
  h += questEventSectionHtml(allPaths, ctx, 'ink-qe');
  h += '</div>';
  h += '<script>(function(){var root=document.currentScript&&document.currentScript.previousElementSibling;if(!root||!root.classList.contains("ink-panel"))root=document.querySelector(".zb-root .ink-panel");if(!root)return;var ribs=root.querySelectorAll(".ink-rib");var panes=root.querySelectorAll("[data-f-pane]");ribs.forEach(function(btn){btn.addEventListener("click",function(){var id=btn.getAttribute("data-f");ribs.forEach(function(r){r.classList.toggle("is-on",r===btn);});panes.forEach(function(p){p.hidden=p.getAttribute("data-f-pane")!==id;});});});})();</script>';
  return h;
}

export function css() {
  return [
    '.zb-root{box-sizing:border-box;width:100%;max-width:720px;margin:0 auto;padding:14px;font-family:Georgia,"Songti SC","Microsoft YaHei",serif;font-size:12px;line-height:1.55;color:#334155;background:#f1f5f9}',
    '.zb-root *,.zb-root *:before,.zb-root *:after{box-sizing:border-box}',
    '.ink-empty{padding:28px;text-align:center;opacity:.45}',
    '.ink-fans-lab{text-align:center;letter-spacing:.25em;font-size:11px;color:#64748b;margin-bottom:10px}',
    '.ink-fan-ribs{display:flex;flex-wrap:wrap;gap:4px;justify-content:center;margin-bottom:10px}',
    '.ink-rib{appearance:none;border:1px solid #94a3b8;background:#fff;color:#475569;font:inherit;font-size:11px;padding:6px 14px;cursor:pointer;clip-path:polygon(8% 0,92% 0,100% 100%,0 100%)}',
    '.ink-rib.is-on{background:#475569;color:#f8fafc;border-color:#334155}',
    '.ink-fan{background:#fafafa;border:1px solid #cbd5e1;padding:14px;box-shadow:0 6px 16px rgba(71,85,105,.08)}',
    '.ink-fan.is-main{border-color:#64748b}',
    '.ink-fan-h{display:flex;align-items:center;gap:8px;margin-bottom:10px}',
    '.ink-fan-seal{width:28px;height:28px;background:#334155;color:#f8fafc;display:flex;align-items:center;justify-content:center;font-weight:800}',
    '.ink-fan-h b{letter-spacing:.2em}',
    '.ink-fan-h em{font-style:normal;font-size:10px;padding:1px 6px;border:1px solid #64748b}',
    '.ink-cell{position:relative;padding:5px 0 7px;border-bottom:1px dashed #cbd5e1}',
    '.ink-cell-k{font-size:10px;color:#64748b}',
    '.ink-cell-v,.ink-cell-v .zb-value{font-size:12px;color:#1e293b!important;font-weight:600}',
    '.ink-wash{position:absolute;left:0;bottom:0;height:2px;background:#64748b;opacity:.4}',
    '.ink-panel{/* */}',
    '.ink-qe{margin-top:10px;padding-top:8px;border-top:1px solid rgba(127,127,127,.28)}',
    '.ink-qe-h{font-size:10px;letter-spacing:.12em;opacity:.7;margin-bottom:6px}',
    '.ink-qe-rail{display:flex;flex-wrap:wrap;gap:6px}',
    '.ink-qe-chip{font-size:10px;padding:3px 8px;border:1px solid rgba(127,127,127,.35);border-radius:4px}',
  ].join('');
}
