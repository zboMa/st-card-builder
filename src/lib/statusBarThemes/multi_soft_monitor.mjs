/**
 * 软监控群像（多人）—— 多路画面网格 + 选中放大；人人同套
 */
import { escHtml, guessPct, makeCtx, rolePaths, roleFieldLists, questEventSectionHtml, worldScopedPaths, classifyPath, formatMetaLine } from './shared.mjs';

export const meta = {
  id: 'multi_soft_monitor',
  label: '软监控群像',
  cast: 'multi',
  family: 'softmon',
  blurb: '多路画面网格 · 选中放大 · 人人同套',
  accent: '#a8d8ea',
};

function cam(name, paths, ctx, isMain, expanded) {
  var rf = roleFieldLists(paths);
  var meters = rf.meters;
  var grid = rf.detail;
  var h = '<article class="msm-card' + (isMain ? ' is-main' : '') + (expanded ? ' is-focus' : '') + '">';
  h += '<div class="msm-cam-h"><span class="msm-rec">●</span><b>' + escHtml(name) + '</b>'
    + (isMain ? '<em>FOCUS</em>' : '') + '</div>';
  h += '<div class="msm-mini-bars">';
  meters.forEach(function(p) {
    var pct = guessPct(ctx.plain(p));
    h += '<div class="msm-mini"><span class="msm-mini-lab">' + escHtml(String(p.label || '')) + '</span>'
      + '<div class="msm-track"><div class="msm-fill" style="width:' + pct + '%"></div></div>'
      + '<span class="msm-mini-num">' + ctx.val(p) + '</span></div>';
  });
  h += '</div><div class="msm-grid">';
  grid.forEach(function(p) {
    h += '<div class="msm-cell"><div class="msm-cell-k">' + escHtml(p.label) + '</div>'
      + '<div class="msm-cell-v">' + ctx.val(p) + '</div></div>';
  });
  h += '</div></article>';
  return h;
}

/** @param {object} opts */
export function render(opts) {
  var allPaths = Array.isArray(opts && opts.allPaths) && opts.allPaths.length ? opts.allPaths : (opts.paths || []);
  if (!allPaths.length) return '<div class="msm-empty">NO CAMERAS</div>';
  var characters = Array.isArray(opts && opts.characters) ? opts.characters : [];
  var mainName = String((opts && opts.mainName) || (characters[0] && characters[0].name) || '');
  var cast = characters.length ? characters.filter(function(c) { return c.selected !== false; }) : [{ name: mainName || 'CAM' }];
  var main = mainName || cast[0].name;
  var ctx = makeCtx(opts.valueFn, !!(opts && opts.rawValueHtml));
  var world = formatMetaLine(worldScopedPaths(allPaths).filter(function(p) { return classifyPath(p) === 'meta'; }), ctx);

  var h = '<div class="msm-panel">';
  h += '<div class="msm-top"><span>SYSTEM MONITORING</span><span>' + escHtml(world || 'MULTI-CAM') + '</span></div>';
  h += '<div class="msm-wall">';
  cast.forEach(function(c, i) {
    var rp = rolePaths(allPaths, c.name);
    var focus = c.name === main || (i === 0 && !cast.some(function(x) { return x.name === main; }));
    h += '<button type="button" class="msm-thumb' + (focus ? ' is-on' : '') + '" data-cam="' + i + '">' + cam(c.name, rp, ctx, c.name === main, focus) + '</button>';
  });
  h += '</div>';
  h += questEventSectionHtml(allPaths, ctx, 'msm-qe');
  h += '</div>';
  h += '<script>(function(){var root=document.currentScript&&document.currentScript.previousElementSibling;if(!root||!root.classList.contains("msm-panel"))root=document.querySelector(".zb-root .msm-panel");if(!root)return;var thumbs=root.querySelectorAll(".msm-thumb");thumbs.forEach(function(btn){btn.addEventListener("click",function(){thumbs.forEach(function(t){t.classList.remove("is-on");var c=t.querySelector(".msm-card");if(c)c.classList.remove("is-focus");});btn.classList.add("is-on");var card=btn.querySelector(".msm-card");if(card)card.classList.add("is-focus");});});})();</script>';
  return h;
}

export function css() {
  return [
    '.zb-root{box-sizing:border-box;width:100%;max-width:720px;margin:0 auto;padding:10px;font-family:"Microsoft YaHei","Segoe UI",sans-serif;font-size:12px;line-height:1.35;color:#e0e0e0;background:#0d1117}',
    '.zb-root *,.zb-root *:before,.zb-root *:after{box-sizing:border-box}',
    '.msm-empty{padding:20px;text-align:center;opacity:.5}',
    '.msm-panel{border:1px solid rgba(168,216,234,.28);border-radius:12px;padding:10px;background:rgba(13,17,23,.9)}',
    '.msm-top{display:flex;justify-content:space-between;font-size:10px;letter-spacing:.1em;opacity:.65;margin-bottom:10px}',
    '.msm-wall{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
    '.msm-thumb{appearance:none;border:0;padding:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}',
    '.msm-card{border:1px solid rgba(168,216,234,.2);border-radius:8px;padding:8px;background:rgba(168,216,234,.05);transition:box-shadow .2s,transform .2s}',
    '.msm-thumb.is-on .msm-card,.msm-card.is-focus{border-color:#81ecec;box-shadow:0 0 16px rgba(129,236,236,.25);transform:scale(1.02)}',
    '.msm-cam-h{display:flex;align-items:center;gap:6px;margin-bottom:6px;font-size:11px}',
    '.msm-rec{color:#ff7675;font-size:8px}',
    '.msm-cam-h em{font-style:normal;margin-left:auto;font-size:9px;color:#81ecec;border:1px solid #81ecec;padding:0 5px}',
    '.msm-mini-bars{display:flex;flex-direction:column;gap:4px;margin-bottom:6px}',
    '.msm-mini{display:flex;align-items:center;gap:4px}',
    '.msm-mini-lab{font-size:9px;opacity:.5;min-width:12px}',
    '.msm-track{flex:1;height:4px;background:rgba(0,0,0,.35);border-radius:2px;overflow:hidden}',
    '.msm-fill{height:100%;background:linear-gradient(90deg,#81ecec,#a8d8ea)}',
    '.msm-mini-num,.msm-mini-num .zb-value{font-size:9px;color:#81ecec!important;font-weight:700}',
    '.msm-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px}',
    '.msm-cell{padding:4px;background:rgba(0,0,0,.25);border-radius:4px}',
    '.msm-cell-k{font-size:8px;opacity:.45}',
    '.msm-cell-v,.msm-cell-v .zb-value{font-size:10px;font-weight:600;color:#e0e0e0!important}',
    '@media(max-width:420px){.msm-wall{grid-template-columns:1fr}}',
    '.msm-qe{margin-top:10px;padding-top:8px;border-top:1px solid rgba(127,127,127,.28)}',
    '.msm-qe-h{font-size:10px;letter-spacing:.12em;opacity:.7;margin-bottom:6px}',
    '.msm-qe-rail{display:flex;flex-wrap:wrap;gap:6px}',
    '.msm-qe-chip{font-size:10px;padding:3px 8px;border:1px solid rgba(127,127,127,.35);border-radius:4px}',
  ].join('');
}
