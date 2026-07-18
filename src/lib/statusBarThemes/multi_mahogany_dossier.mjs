/**
 * 暮褐群档（多人）—— 信笺叠匣：点信封翻页；人人同套
 */
import { escHtml, guessPct, makeCtx, rolePaths, roleFieldLists, questEventSectionHtml, worldScopedPaths, classifyPath, formatMetaLine } from './shared.mjs';

export const meta = {
  id: 'multi_mahogany_dossier',
  label: '暮褐群档',
  cast: 'multi',
  family: 'mahogany',
  blurb: '信笺叠匣 · 点信封翻页 · 人人同套密函',
  accent: '#c9a46a',
};

function letterBody(name, paths, ctx, isMain) {
  var rf = roleFieldLists(paths);
  var meters = rf.meters;
  var stamps = rf.detail;
  var h = '<div class="wax-letter-to">致 <strong>' + escHtml(name) + '</strong>' + (isMain ? '<em>主视角</em>' : '') + '</div>';
  if (meters.length) {
    h += '<div class="wax-letter-meters">';
    meters.forEach(function(p) {
      var pct = guessPct(ctx.plain(p));
      h += '<div class="wax-stat"><em>' + escHtml(p.label) + '</em><div class="wax-ink"><i style="width:' + pct + '%"></i></div><b>' + ctx.val(p) + '</b></div>';
    });
    h += '</div>';
  }
  h += '<div class="wax-letter-body">';
  stamps.forEach(function(p) {
    h += '<div class="wax-stamp"><span class="wax-stamp-k">' + escHtml(p.label) + '</span><span class="wax-stamp-v">' + ctx.val(p) + '</span></div>';
  });
  h += '</div>';
  return h;
}

/** @param {object} opts */
export function render(opts) {
  var allPaths = Array.isArray(opts && opts.allPaths) && opts.allPaths.length ? opts.allPaths : (opts.paths || []);
  if (!allPaths.length) return '<div class="wax-empty">卷宗空缺</div>';
  var characters = Array.isArray(opts && opts.characters) ? opts.characters : [];
  var mainName = String((opts && opts.mainName) || (characters[0] && characters[0].name) || '');
  var cast = characters.length ? characters.filter(function(c) { return c.selected !== false; }) : (mainName ? [{ name: mainName }] : [{ name: '某人' }]);
  var main = mainName || cast[0].name;
  var ctx = makeCtx(opts.valueFn, !!(opts && opts.rawValueHtml));
  var world = formatMetaLine(worldScopedPaths(allPaths).filter(function(p) { return classifyPath(p) === 'meta'; }), ctx);

  var h = '<div class="wax-stack">';
  h += '<div class="wax-stack-head"><span class="wax-stack-title">往来密函</span>' + (world ? '<span class="wax-stack-meta">' + escHtml(world) + '</span>' : '') + '</div>';
  h += '<div class="wax-env-rail">';
  cast.forEach(function(c, i) {
    var on = c.name === main || (!cast.some(function(x) { return x.name === main; }) && i === 0);
    h += '<button type="button" class="wax-env' + (on ? ' is-on' : '') + '" data-env="' + i + '"><span class="wax-letter-seal">' + (c.name === main ? '主' : '函') + '</span><span class="wax-env-name">' + escHtml(c.name) + '</span></button>';
  });
  h += '</div><div class="wax-flip">';
  cast.forEach(function(c, i) {
    var rp = rolePaths(allPaths, c.name);
    var show = c.name === main || (!cast.some(function(x) { return x.name === main; }) && i === 0);
    h += '<article class="wax-letter' + (c.name === main ? ' is-main' : '') + '" data-env-pane="' + i + '"' + (show ? '' : ' hidden') + '>';
    h += letterBody(c.name, rp, ctx, c.name === main);
    h += '</article>';
  });
  h += '</div>';
  h += questEventSectionHtml(allPaths, ctx, 'wax-qe');
  h += '<div class="wax-foot">— 火漆既落 · 不得外传 —</div></div>';
  h += '<script>(function(){var root=document.currentScript&&document.currentScript.previousElementSibling;if(!root||!root.classList.contains("wax-stack"))root=document.querySelector(".zb-root .wax-stack");if(!root)return;var envs=root.querySelectorAll(".wax-env");var panes=root.querySelectorAll(".wax-letter");envs.forEach(function(btn){btn.addEventListener("click",function(){var id=btn.getAttribute("data-env");envs.forEach(function(e){e.classList.toggle("is-on",e===btn);});panes.forEach(function(p){p.hidden=p.getAttribute("data-env-pane")!==id;});});});})();</script>';
  return h;
}

export function css() {
  return [
    '.zb-root{box-sizing:border-box;width:100%;max-width:720px;margin:0 auto;padding:14px;font-family:Georgia,"Songti SC","Microsoft YaHei",serif;font-size:12px;line-height:1.45;color:#f0e6d2;background:linear-gradient(180deg,#2a1810,#140c08)}',
    '.zb-root *,.zb-root *:before,.zb-root *:after{box-sizing:border-box}',
    '.wax-empty{padding:28px;text-align:center;opacity:.5}',
    '.wax-stack{display:flex;flex-direction:column;gap:12px}',
    '.wax-stack-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px}',
    '.wax-stack-title{font-size:13px;letter-spacing:.3em;color:#e8c547;font-weight:700}',
    '.wax-stack-meta{font-size:10px;color:#c9a46a;font-style:italic}',
    '.wax-env-rail{display:flex;flex-wrap:wrap;gap:8px}',
    '.wax-env{appearance:none;display:flex;align-items:center;gap:8px;padding:8px 12px;background:linear-gradient(160deg,#3a2418,#24160f);border:1px solid rgba(201,164,106,.45);border-radius:4px;color:#f0e6d2;font:inherit;cursor:pointer}',
    '.wax-env.is-on{border-color:#e8c547;box-shadow:0 0 0 1px rgba(232,197,71,.3)}',
    '.wax-letter-seal{width:28px;height:28px;border-radius:50%;background:radial-gradient(circle at 30% 30%,#e11d48,#9f1239);border:2px solid #fca5a5;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fecdd3}',
    '.wax-env.is-on .wax-letter-seal{background:radial-gradient(circle at 30% 30%,#fbbf24,#b45309);border-color:#fde68a;color:#422006}',
    '.wax-env-name{font-size:12px;font-weight:700}',
    '.wax-letter{background:linear-gradient(160deg,#3a2418,#24160f);border:1px solid rgba(201,164,106,.55);border-radius:6px;padding:16px 14px 12px;box-shadow:3px 5px 0 rgba(0,0,0,.25)}',
    '.wax-letter.is-main{border-color:#e8c547}',
    '.wax-letter-to{font-size:14px;margin-bottom:10px;color:#f5e6c8}',
    '.wax-letter-to strong{color:#e8c547}',
    '.wax-letter-to em{font-style:normal;margin-left:8px;font-size:10px;padding:1px 7px;border-radius:999px;background:#7f1d1d;color:#fecdd3}',
    '.wax-letter-meters{display:flex;flex-direction:column;gap:5px;margin-bottom:8px}',
    '.wax-stat{display:grid;grid-template-columns:48px 1fr 36px;gap:6px;align-items:center}',
    '.wax-stat em{font-style:normal;font-size:10px;color:#c9a46a}',
    '.wax-ink{height:4px;background:rgba(0,0,0,.35);overflow:hidden;border-radius:2px}',
    '.wax-ink>i{display:block;height:100%;background:linear-gradient(90deg,#7f1d1d,#c9a46a)}',
    '.wax-stat b,.wax-stat .zb-value{font-size:10px;text-align:right;color:#e8c547!important}',
    '.wax-letter-body{display:flex;flex-wrap:wrap;gap:6px}',
    '.wax-stamp{flex:1 1 100px;padding:6px 8px;background:rgba(201,164,106,.06);border:1px dashed rgba(201,164,106,.35)}',
    '.wax-stamp-k{display:block;font-size:9px;color:#a67c52;margin-bottom:2px}',
    '.wax-stamp-v,.wax-stamp-v .zb-value{font-size:11px;font-weight:700;color:#f5e6c8!important}',
    '.wax-foot{text-align:center;font-size:10px;letter-spacing:.18em;color:#a67c52;opacity:.65}',
    '.wax-qe{margin-top:10px;padding-top:8px;border-top:1px solid rgba(127,127,127,.28)}',
    '.wax-qe-h{font-size:10px;letter-spacing:.12em;opacity:.7;margin-bottom:6px}',
    '.wax-qe-rail{display:flex;flex-wrap:wrap;gap:6px}',
    '.wax-qe-chip{font-size:10px;padding:3px 8px;border:1px solid rgba(127,127,127,.35);border-radius:4px}',
  ].join('');
}
