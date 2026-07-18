/**
 * 恋爱群像（多人）—— 情书抽屉：一人一封，抽出展开；人人同套
 */
import { escHtml, guessPct, makeCtx, rolePaths, roleFieldLists, questEventSectionHtml, worldScopedPaths, classifyPath, formatMetaLine } from './shared.mjs';

export const meta = {
  id: 'multi_romance_glass',
  label: '恋爱群像',
  cast: 'multi',
  family: 'romance',
  blurb: '情书抽屉 · 一人一封抽出 · 人人同套',
  accent: '#fb7185',
};

function letter(name, paths, ctx, isMain) {
  var rf = roleFieldLists(paths);
  var heart = rf.meters;
  var lines = rf.detail;
  var h = '<div class="rom-card' + (isMain ? ' is-main' : '') + '">';
  h += '<div class="rom-card-h">致 <strong>' + escHtml(name) + '</strong>' + (isMain ? '<em>主视角</em>' : '') + '</div>';
  heart.forEach(function(p) {
    var pct = guessPct(ctx.plain(p));
    h += '<div class="rom-heart-row"><span>♥ ' + escHtml(p.label) + '</span>'
      + '<div class="rom-bar"><i style="width:' + pct + '%"></i></div><em>' + ctx.val(p) + '</em></div>';
  });
  lines.forEach(function(p) {
    h += '<div class="rom-chip"><b>' + escHtml(p.label) + '</b> ' + ctx.val(p) + '</div>';
  });
  h += '</div>';
  return h;
}

/** @param {object} opts */
export function render(opts) {
  var allPaths = Array.isArray(opts && opts.allPaths) && opts.allPaths.length ? opts.allPaths : (opts.paths || []);
  if (!allPaths.length) return '<div class="rom-empty">抽屉空空</div>';
  var characters = Array.isArray(opts && opts.characters) ? opts.characters : [];
  var mainName = String((opts && opts.mainName) || (characters[0] && characters[0].name) || '');
  var cast = characters.length ? characters.filter(function(c) { return c.selected !== false; }) : [{ name: mainName || '她' }];
  var main = mainName || cast[0].name;
  var ctx = makeCtx(opts.valueFn, !!(opts && opts.rawValueHtml));
  var world = formatMetaLine(worldScopedPaths(allPaths).filter(function(p) { return classifyPath(p) === 'meta'; }), ctx);

  var h = '<div class="rom-panel rom-drawer">';
  h += '<div class="rom-drawer-lab">情书抽屉 · ' + escHtml(world || '未署日期') + '</div>';
  h += '<div class="rom-tabs">';
  cast.forEach(function(c, i) {
    var on = c.name === main || (i === 0 && !cast.some(function(x) { return x.name === main; }));
    h += '<button type="button" class="rom-tab' + (on ? ' is-on' : '') + '" data-r="' + i + '">✉ ' + escHtml(c.name) + '</button>';
  });
  h += '</div><div class="rom-drawer-body">';
  cast.forEach(function(c, i) {
    var rp = rolePaths(allPaths, c.name);
    var show = c.name === main || (i === 0 && !cast.some(function(x) { return x.name === main; }));
    h += '<div class="rom-pull" data-r-pane="' + i + '"' + (show ? '' : ' hidden') + '>' + letter(c.name, rp, ctx, c.name === main) + '</div>';
  });
  h += '</div>';
  h += questEventSectionHtml(allPaths, ctx, 'rom-qe');
  h += '</div>';
  h += '<script>(function(){var root=document.currentScript&&document.currentScript.previousElementSibling;if(!root||!root.classList.contains("rom-panel"))root=document.querySelector(".zb-root .rom-panel");if(!root)return;var tabs=root.querySelectorAll(".rom-tab");var panes=root.querySelectorAll("[data-r-pane]");tabs.forEach(function(btn){btn.addEventListener("click",function(){var id=btn.getAttribute("data-r");tabs.forEach(function(t){t.classList.toggle("is-on",t===btn);});panes.forEach(function(p){p.hidden=p.getAttribute("data-r-pane")!==id;});});});})();</script>';
  return h;
}

export function css() {
  return [
    '.zb-root{box-sizing:border-box;width:100%;max-width:720px;margin:0 auto;padding:14px;font-family:Georgia,"Songti SC","Microsoft YaHei",serif;font-size:12px;line-height:1.45;color:#9f1239;background:linear-gradient(180deg,#fdf2f8,#fff1f2)}',
    '.zb-root *,.zb-root *:before,.zb-root *:after{box-sizing:border-box}',
    '.rom-empty{padding:24px;text-align:center;opacity:.5}',
    '.rom-drawer-lab{text-align:center;font-size:11px;letter-spacing:.15em;color:#fb7185;margin-bottom:10px}',
    '.rom-tabs{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:10px}',
    '.rom-tab{appearance:none;border:1px solid #fecdd3;background:#fff;color:#be123c;font:inherit;font-size:11px;padding:6px 12px;border-radius:4px 4px 0 0;cursor:pointer}',
    '.rom-tab.is-on{background:#fb7185;color:#fff;border-color:#e11d48}',
    '.rom-card{background:#fff;border:1px solid #fecdd3;border-radius:0 8px 8px 8px;padding:14px;box-shadow:0 8px 20px rgba(190,24,93,.1)}',
    '.rom-card.is-main{border-color:#fb7185}',
    '.rom-card-h{font-size:14px;margin-bottom:10px}',
    '.rom-card-h strong{color:#e11d48}',
    '.rom-card-h em{font-style:normal;margin-left:8px;font-size:10px;padding:1px 7px;background:#fecdd3;border-radius:999px}',
    '.rom-heart-row{display:grid;grid-template-columns:70px 1fr 36px;gap:6px;align-items:center;margin-bottom:6px;font-size:11px}',
    '.rom-bar{height:5px;background:#fecdd3;border-radius:999px;overflow:hidden}',
    '.rom-bar>i{display:block;height:100%;background:linear-gradient(90deg,#fb7185,#f472b6)}',
    '.rom-heart-row em,.rom-heart-row .zb-value{font-style:normal;text-align:right;font-weight:700;color:#be123c!important}',
    '.rom-chip{display:inline-block;margin:0 4px 6px 0;padding:4px 8px;background:#fff1f2;border:1px solid #fecdd3;border-radius:999px;font-size:10px}',
    '.rom-chip b{color:#e11d48;margin-right:3px}',
    '.rom-panel{/* root */}',
    '.rom-qe{margin-top:10px;padding-top:8px;border-top:1px solid rgba(127,127,127,.28)}',
    '.rom-qe-h{font-size:10px;letter-spacing:.12em;opacity:.7;margin-bottom:6px}',
    '.rom-qe-rail{display:flex;flex-wrap:wrap;gap:6px}',
    '.rom-qe-chip{font-size:10px;padding:3px 8px;border:1px solid rgba(127,127,127,.35);border-radius:4px}',
  ].join('');
}
