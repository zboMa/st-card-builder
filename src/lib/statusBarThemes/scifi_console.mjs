/**
 * 科幻控制台（单人）—— HUD：中央全息 + 环绕数据环
 */
import { escHtml, guessPct, bucketPaths, makeCtx } from './shared.mjs';

export const meta = {
  id: 'scifi_console',
  label: '科幻控制台',
  cast: 'single',
  family: 'scifi',
  blurb: 'HUD 全息中核 · 环绕遥测环',
  accent: '#2dd4bf',
};

/** @param {object} opts */
export function render(opts) {
  var paths = Array.isArray(opts && opts.paths) ? opts.paths : [];
  if (!paths.length) return '<div class="sci-empty">NO SIGNAL</div>';
  var ctx = makeCtx(opts.valueFn, !!(opts && opts.rawValueHtml));
  var b = bucketPaths(paths);
  var main = String((opts && opts.mainName) || 'PILOT');
  var ring = b.meters.length ? b.meters : b.attr;
  var left = b.meta.concat(b.narrative);
  var right = b.items.concat(b.meters.length ? b.attr : []).concat(b.nsfw);
  var core = ring[0];

  var h = '<div class="sci-panel">';
  h += '<div class="sci-hud">';
  h += '<div class="sci-orbit sci-orbit-l">';
  left.forEach(function(p) {
    h += '<div class="sci-tick"><span>' + escHtml(p.label) + '</span><b>' + ctx.val(p) + '</b></div>';
  });
  h += '</div>';
  h += '<div class="sci-core">';
  h += '<div class="sci-ring" aria-hidden="true"></div>';
  h += '<div class="sci-holo"><div class="sci-holo-name">' + escHtml(main) + '</div>';
  if (core) {
    var pct = guessPct(ctx.plain(core));
    h += '<div class="sci-holo-pct">' + pct + '%</div><div class="sci-holo-lab">' + escHtml(core.label) + ' ' + ctx.val(core) + '</div>';
  }
  h += '</div></div>';
  h += '<div class="sci-orbit sci-orbit-r">';
  right.forEach(function(p) {
    h += '<div class="sci-tick"><span>' + escHtml(p.label) + '</span><b>' + ctx.val(p) + '</b></div>';
  });
  h += '</div></div>';
  h += '<div class="sci-grid">';
  ring.forEach(function(p) {
    var pct = guessPct(ctx.plain(p));
    h += '<div class="sci-cell"><div class="sci-cell-k">' + escHtml(p.label) + '</div>'
      + '<div class="sci-gauge"><i style="width:' + pct + '%"></i></div>'
      + '<div class="sci-cell-v">' + ctx.val(p) + '</div></div>';
  });
  h += '</div>';
  h += '<div class="sci-foot">// TACTICAL HUD //</div></div>';
  return h;
}

export function css() {
  return [
    '.zb-root{box-sizing:border-box;width:100%;max-width:720px;margin:0 auto;padding:12px;font-family:"Segoe UI","Consolas","Microsoft YaHei",sans-serif;font-size:12px;line-height:1.4;color:#99f6e4;background:radial-gradient(ellipse at 50% 30%,rgba(45,212,191,.12),transparent 55%),#020617}',
    '.zb-root *,.zb-root *:before,.zb-root *:after{box-sizing:border-box}',
    '.sci-empty{padding:24px;text-align:center;opacity:.5;letter-spacing:.2em}',
    '.sci-panel{border:1px solid rgba(45,212,191,.35);padding:12px;background:rgba(2,6,23,.8);clip-path:polygon(0 8px,8px 0,calc(100% - 8px) 0,100% 8px,100% calc(100% - 8px),calc(100% - 8px) 100%,8px 100%,0 calc(100% - 8px))}',
    '.sci-hud{display:grid;grid-template-columns:1fr 140px 1fr;gap:8px;align-items:center;margin-bottom:12px}',
    '.sci-orbit{display:flex;flex-direction:column;gap:6px}',
    '.sci-tick{display:flex;justify-content:space-between;gap:6px;padding:4px 6px;border:1px solid rgba(45,212,191,.2);font-size:10px;background:rgba(45,212,191,.05)}',
    '.sci-tick b,.sci-tick .zb-value{color:#5eead4!important;font-weight:700}',
    '.sci-core{position:relative;width:140px;height:140px;margin:0 auto}',
    '.sci-ring{position:absolute;inset:0;border:2px solid rgba(45,212,191,.4);border-radius:50%;box-shadow:0 0 20px rgba(45,212,191,.25),inset 0 0 20px rgba(45,212,191,.1);animation:sci-spin 12s linear infinite}',
    '.sci-ring:before{content:"";position:absolute;inset:10px;border:1px dashed rgba(45,212,191,.35);border-radius:50%}',
    '@keyframes sci-spin{to{transform:rotate(360deg)}}',
    '.sci-holo{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;z-index:1}',
    '.sci-holo-name{font-weight:800;font-size:13px;letter-spacing:.12em;color:#5eead4;text-shadow:0 0 10px rgba(45,212,191,.5)}',
    '.sci-holo-pct{font-size:1.6rem;font-weight:800;color:#2dd4bf;margin:4px 0}',
    '.sci-holo-lab{font-size:9px;opacity:.7}',
    '.sci-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}',
    '.sci-cell{padding:6px;border:1px solid rgba(45,212,191,.2);background:rgba(45,212,191,.04)}',
    '.sci-cell-k{font-size:9px;opacity:.6;margin-bottom:3px}',
    '.sci-gauge{height:4px;background:#0f172a;margin-bottom:3px;overflow:hidden}',
    '.sci-gauge>i{display:block;height:100%;background:linear-gradient(90deg,#0d9488,#2dd4bf)}',
    '.sci-cell-v,.sci-cell-v .zb-value{font-size:11px;font-weight:700;color:#99f6e4!important}',
    '.sci-foot{margin-top:10px;text-align:center;font-size:9px;letter-spacing:.25em;opacity:.35}',
    '@media(max-width:520px){.sci-hud{grid-template-columns:1fr}.sci-core{margin:8px auto}.sci-grid{grid-template-columns:1fr 1fr}}',
  ].join('');
}
