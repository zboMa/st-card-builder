/**
 * 暮褐档案（单人）—— 蜡封印信/卷宗：点火漆开合分区
 */
import { escHtml, guessPct, bucketPaths, makeCtx, formatMetaLine } from './shared.mjs';

export const meta = {
  id: 'mahogany_dossier',
  label: '暮褐档案',
  cast: 'single',
  family: 'mahogany',
  blurb: '蜡封印信 · 火漆开合分区 · 丝带卷宗',
  accent: '#c9a46a',
};

/** @param {object} opts */
export function render(opts) {
  var paths = Array.isArray(opts && opts.paths) ? opts.paths : [];
  if (!paths.length) return '<div class="wax-empty">卷宗空缺</div>';
  var ctx = makeCtx(opts.valueFn, !!(opts && opts.rawValueHtml));
  var b = bucketPaths(paths);
  var main = String((opts && opts.mainName) || '某人');
  var metaText = formatMetaLine(b.meta, ctx) || '未标注时空';

  var seals = [];
  if (b.meters.length) seals.push({ id: 'vit', lab: '体征', kind: 'meters', list: b.meters });
  if (b.narrative.length) seals.push({ id: 'nar', lab: '行止', kind: 'stamps', list: b.narrative });
  if (b.items.length || b.attr.length) seals.push({ id: 'bag', lab: '随身', kind: 'stamps', list: b.items.concat(b.attr) });
  if (b.nsfw.length) seals.push({ id: 'sec', lab: '密函', kind: 'secret', list: b.nsfw });
  if (!seals.length) seals.push({ id: 'nar', lab: '正文', kind: 'stamps', list: paths.slice() });

  var h = '<div class="wax-folio">';
  h += '<div class="wax-ribbon" aria-hidden="true"></div>';
  h += '<div class="wax-flap"><span class="wax-flap-lab">机密卷宗</span></div>';
  h += '<div class="wax-sheet">';
  h += '<div class="wax-addr"><div class="wax-to">致：<strong>' + escHtml(main) + '</strong></div>';
  h += '<div class="wax-meta">' + escHtml(metaText) + '</div></div>';
  h += '<div class="wax-seal-row">';
  seals.forEach(function(s, i) {
    h += '<button type="button" class="wax-seal' + (i === 0 ? ' is-open' : '') + '" data-seal="' + s.id + '"><span>' + escHtml(s.lab.slice(0, 1)) + '</span><em>' + escHtml(s.lab) + '</em></button>';
  });
  h += '</div>';
  seals.forEach(function(s, i) {
    h += '<div class="wax-seal-pane" data-seal-pane="' + s.id + '"' + (i === 0 ? '' : ' hidden') + '>';
    if (s.kind === 'meters') {
      h += '<div class="wax-ribbon-stats">';
      s.list.forEach(function(p) {
        var pct = guessPct(ctx.plain(p));
        h += '<div class="wax-stat"><em>' + escHtml(p.label) + '</em><div class="wax-ink"><i style="width:' + pct + '%"></i></div><b>' + ctx.val(p) + '</b></div>';
      });
      h += '</div>';
    } else if (s.kind === 'secret') {
      s.list.forEach(function(p) {
        h += '<div class="wax-secret"><div class="wax-secret-seal">密</div><div><div class="wax-secret-k">' + escHtml(p.label) + '</div><div class="wax-secret-v">' + ctx.val(p) + '</div></div></div>';
      });
    } else {
      h += '<div class="wax-stamps">';
      s.list.forEach(function(p, j) {
        var rot = ((j % 3) - 1) * 1.4;
        h += '<div class="wax-stamp" style="--wax-r:' + rot + 'deg"><span class="wax-stamp-k">' + escHtml(p.label) + '</span><span class="wax-stamp-v">' + ctx.val(p) + '</span></div>';
      });
      h += '</div>';
    }
    h += '</div>';
  });
  h += '<div class="wax-foot">— 火漆既落 · 不得外传 —</div></div></div>';
  h += '<script>(function(){var root=document.currentScript&&document.currentScript.previousElementSibling;if(!root||!root.classList.contains("wax-folio"))root=document.querySelector(".zb-root .wax-folio");if(!root)return;var seals=root.querySelectorAll(".wax-seal");var panes=root.querySelectorAll(".wax-seal-pane");seals.forEach(function(btn){btn.addEventListener("click",function(){var id=btn.getAttribute("data-seal");seals.forEach(function(s){s.classList.toggle("is-open",s===btn);});panes.forEach(function(p){p.hidden=p.getAttribute("data-seal-pane")!==id;});});});})();</script>';
  return h;
}

export function css() {
  return [
    '.zb-root{box-sizing:border-box;width:100%;max-width:720px;margin:0 auto;padding:16px 14px;font-family:Georgia,"Songti SC","Microsoft YaHei",serif;font-size:12px;line-height:1.5;color:#f0e6d2;background:radial-gradient(circle at 50% 0%,#3d2317,transparent 55%),#1a100c}',
    '.zb-root *,.zb-root *:before,.zb-root *:after{box-sizing:border-box}',
    '.wax-empty{padding:28px;text-align:center;opacity:.5}',
    '.wax-folio{position:relative;padding-right:14px}',
    '.wax-ribbon{position:absolute;right:2px;top:24px;bottom:24px;width:14px;background:linear-gradient(180deg,#7f1d1d,#b91c1c 40%,#7f1d1d);border-radius:2px;z-index:2}',
    '.wax-flap{background:linear-gradient(180deg,#4a2c1a,#2c1810);border:1px solid #c9a46a;border-bottom:0;border-radius:10px 10px 0 0;padding:10px 16px;text-align:center}',
    '.wax-flap-lab{font-size:11px;letter-spacing:.35em;color:#e8c547;font-weight:700}',
    '.wax-sheet{position:relative;background:linear-gradient(165deg,#3a2418,#24160f 60%,#1c120c);border:1px solid #c9a46a;border-radius:0 0 10px 10px;padding:20px 18px 14px;box-shadow:0 12px 32px rgba(0,0,0,.45)}',
    '.wax-addr{margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid rgba(201,164,106,.3)}',
    '.wax-to{font-size:15px;color:#f5e6c8}',
    '.wax-to strong{color:#e8c547;font-size:1.15em;margin-left:4px}',
    '.wax-meta{margin-top:4px;font-size:11px;color:#c9a46a;font-style:italic}',
    '.wax-seal-row{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px}',
    '.wax-seal{appearance:none;width:52px;height:52px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#e11d48,#9f1239 55%,#4c0519);border:2px solid #fca5a5;box-shadow:0 4px 12px rgba(0,0,0,.4);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;color:#fecdd3;padding:0;position:relative}',
    '.wax-seal span{font-size:14px;font-weight:800}',
    '.wax-seal em{position:absolute;bottom:-16px;left:50%;transform:translateX(-50%);font-style:normal;font-size:9px;color:#c9a46a;white-space:nowrap}',
    '.wax-seal.is-open{background:radial-gradient(circle at 35% 30%,#fbbf24,#b45309);border-color:#fde68a;color:#422006;box-shadow:0 0 16px rgba(251,191,36,.45)}',
    '.wax-seal.is-open em{color:#e8c547}',
    '.wax-ribbon-stats{display:flex;flex-direction:column;gap:6px;padding:8px 10px;background:rgba(0,0,0,.25);border-left:3px solid #b91c1c}',
    '.wax-stat{display:grid;grid-template-columns:52px 1fr 40px;gap:8px;align-items:center}',
    '.wax-stat em{font-style:normal;font-size:10px;color:#c9a46a}',
    '.wax-ink{height:5px;background:rgba(0,0,0,.35);border-radius:2px;overflow:hidden}',
    '.wax-ink>i{display:block;height:100%;background:linear-gradient(90deg,#7f1d1d,#c9a46a,#e8c547)}',
    '.wax-stat b,.wax-stat .zb-value{font-size:11px;text-align:right;color:#e8c547!important}',
    '.wax-stamps{display:flex;flex-wrap:wrap;gap:8px}',
    '.wax-stamp{flex:1 1 120px;min-width:110px;padding:8px 10px;background:rgba(201,164,106,.07);border:1px dashed rgba(201,164,106,.45);transform:rotate(var(--wax-r,0deg))}',
    '.wax-stamp-k{display:block;font-size:9px;letter-spacing:.12em;color:#a67c52;margin-bottom:3px}',
    '.wax-stamp-v,.wax-stamp-v .zb-value{font-size:12px;font-weight:700;color:#f5e6c8!important}',
    '.wax-secret{display:flex;gap:10px;align-items:flex-start;padding:10px;margin-bottom:8px;background:rgba(127,29,29,.2);border:1px solid rgba(185,28,28,.4);border-radius:4px}',
    '.wax-secret-seal{flex:0 0 28px;height:28px;border-radius:50%;background:#9f1239;color:#fecdd3;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800}',
    '.wax-secret-k{font-size:10px;color:#fca5a5;margin-bottom:2px}',
    '.wax-secret-v,.wax-secret-v .zb-value{font-size:11px;color:#f0e6d2!important}',
    '.wax-foot{margin-top:12px;text-align:center;font-size:10px;letter-spacing:.2em;color:#a67c52;opacity:.7}',
  ].join('');
}
