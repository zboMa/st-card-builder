/**
 * 古书典藏（单人）—— 开本目录 + 章节页翻阅
 */
import { escHtml, guessPct, bucketPaths, makeCtx } from './shared.mjs';

export const meta = {
  id: 'form_sections',
  label: '古书典藏',
  cast: 'single',
  family: 'library',
  blurb: '开本目录 · 章节翻阅 · 金线装帧',
  accent: '#d4a017',
};

/** @param {object} opts */
export function render(opts) {
  var paths = Array.isArray(opts && opts.paths) ? opts.paths : [];
  if (!paths.length) return '<div class="lib-empty">书页空白</div>';
  var ctx = makeCtx(opts.valueFn, !!(opts && opts.rawValueHtml));
  var b = bucketPaths(paths);
  var main = String((opts && opts.mainName) || '卷主');
  var chapters = [];
  if (b.meta.length) chapters.push({ id: 'ch1', lab: '卷一 · 时空', list: b.meta });
  if (b.meters.length) chapters.push({ id: 'ch2', lab: '卷二 · 气数', list: b.meters, meters: true });
  if (b.narrative.length) chapters.push({ id: 'ch3', lab: '卷三 · 行止', list: b.narrative });
  if (b.items.length || b.attr.length) chapters.push({ id: 'ch4', lab: '卷四 · 器物', list: b.items.concat(b.attr) });
  if (b.nsfw.length) chapters.push({ id: 'ch5', lab: '卷五 · 密录', list: b.nsfw });
  if (!chapters.length) chapters.push({ id: 'ch1', lab: '卷一', list: paths.slice() });

  var h = '<div class="lib-panel">';
  h += '<div class="lib-cover"><div class="lib-cover-title">' + escHtml(main) + ' · 典藏</div>'
    + '<div class="lib-cover-sub">金线装帧开本</div></div>';
  h += '<div class="lib-toc">';
  chapters.forEach(function(c, i) {
    h += '<button type="button" class="lib-toc-item' + (i === 0 ? ' is-on' : '') + '" data-ch="' + c.id + '">'
      + escHtml(c.lab) + '</button>';
  });
  h += '</div><div class="lib-pages">';
  chapters.forEach(function(c, i) {
    h += '<div class="lib-page" data-ch-pane="' + c.id + '"' + (i === 0 ? '' : ' hidden') + '>';
    h += '<div class="lib-page-h">' + escHtml(c.lab) + '</div><div class="lib-grid">';
    c.list.forEach(function(p) {
      if (c.meters) {
        var pct = guessPct(ctx.plain(p));
        h += '<div class="lib-cell"><div class="lib-cell-k">' + escHtml(p.label) + '</div>'
          + '<div class="lib-ink"><i style="width:' + pct + '%"></i></div>'
          + '<div class="lib-cell-v">' + ctx.val(p) + '</div></div>';
      } else {
        h += '<div class="lib-cell"><div class="lib-cell-k">' + escHtml(p.label) + '</div>'
          + '<div class="lib-cell-v">' + ctx.val(p) + '</div></div>';
      }
    });
    h += '</div></div>';
  });
  h += '</div></div>';
  h += '<script>(function(){var root=document.currentScript&&document.currentScript.previousElementSibling;if(!root||!root.classList.contains("lib-panel"))root=document.querySelector(".zb-root .lib-panel");if(!root)return;var toc=root.querySelectorAll(".lib-toc-item");var pages=root.querySelectorAll(".lib-page");toc.forEach(function(btn){btn.addEventListener("click",function(){var id=btn.getAttribute("data-ch");toc.forEach(function(t){t.classList.toggle("is-on",t===btn);});pages.forEach(function(p){p.hidden=p.getAttribute("data-ch-pane")!==id;});});});})();</script>';
  return h;
}

export function css() {
  return [
    '.zb-root{box-sizing:border-box;width:100%;max-width:720px;margin:0 auto;padding:14px;font-family:Georgia,"Songti SC","Microsoft YaHei",serif;font-size:12px;line-height:1.5;color:#f5e6c8;background:radial-gradient(ellipse at 50% 0%,#3d2a12,transparent 50%),#1a1208}',
    '.zb-root *,.zb-root *:before,.zb-root *:after{box-sizing:border-box}',
    '.lib-empty{padding:28px;text-align:center;opacity:.5}',
    '.lib-panel{border:1px solid rgba(212,160,23,.45);background:linear-gradient(160deg,#2a1c0c,#1a1208);padding:14px;box-shadow:inset 0 0 0 1px rgba(212,160,23,.15)}',
    '.lib-cover{text-align:center;padding:10px 0 14px;border-bottom:1px solid rgba(212,160,23,.3);margin-bottom:12px}',
    '.lib-cover-title{font-size:1.2rem;font-weight:800;letter-spacing:.35em;color:#e8c547}',
    '.lib-cover-sub{font-size:10px;color:#c9a46a;margin-top:4px;letter-spacing:.15em}',
    '.lib-toc{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}',
    '.lib-toc-item{appearance:none;border:1px solid rgba(212,160,23,.35);background:rgba(0,0,0,.25);color:#c9a46a;font:inherit;font-size:11px;padding:5px 10px;cursor:pointer}',
    '.lib-toc-item.is-on{background:rgba(212,160,23,.2);color:#e8c547;border-color:#d4a017}',
    '.lib-page-h{font-size:12px;letter-spacing:.2em;color:#d4a017;margin-bottom:10px;padding-bottom:6px;border-bottom:1px dashed rgba(212,160,23,.3)}',
    '.lib-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
    '.lib-cell{padding:8px;background:rgba(212,160,23,.06);border:1px solid rgba(212,160,23,.2)}',
    '.lib-cell-k{font-size:10px;color:#a67c52;margin-bottom:3px}',
    '.lib-cell-v,.lib-cell-v .zb-value{font-size:12px;font-weight:700;color:#f5e6c8!important}',
    '.lib-ink{height:4px;background:rgba(0,0,0,.35);margin:4px 0;overflow:hidden}',
    '.lib-ink>i{display:block;height:100%;background:linear-gradient(90deg,#92400e,#d4a017)}',
    '@media(max-width:420px){.lib-grid{grid-template-columns:1fr}}',
  ].join('');
}
