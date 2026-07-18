/**
 * 霓虹监控（单人）—— CRT 终端：命令行头 + 分区面板 + 扫描线
 */
import { escHtml, guessPct, displayBuckets, makeCtx } from './shared.mjs';

export const meta = {
  id: 'neon_monitor',
  label: '霓虹监控',
  cast: 'single',
  family: 'neon',
  blurb: 'CRT 终端 · 命令行头 · 分区面板 · 扫描线',
  accent: '#39ff14',
};

/** @param {object} opts */
export function render(opts) {
  var paths = Array.isArray(opts && opts.paths) ? opts.paths : [];
  if (!paths.length) return '<div class="crt-empty">NO DATA // AWAITING UPLINK</div>';
  var ctx = makeCtx(opts.valueFn, !!(opts && opts.rawValueHtml));
  var b = displayBuckets(paths);
  var main = String((opts && opts.mainName) || 'SUBJECT');
  var meters = b.meters.length ? b.meters : b.attr;
  var narr = b.narrative.slice();
  var items = b.bag.concat(b.questEvents);
  if (b.meters.length) items = items.concat(b.attr);

  var panels = [];
  if (b.meta.length) panels.push({ id: 'env', lab: 'ENV', list: b.meta });
  if (meters.length) panels.push({ id: 'vitals', lab: 'VITALS', meters: meters });
  if (narr.length) panels.push({ id: 'log', lab: 'LOG', list: narr });
  if (items.length) panels.push({ id: 'inv', lab: 'INV', list: items });
  if (b.nsfw.length) panels.push({ id: 'sig', lab: 'SIGINT', list: b.nsfw });
  if (!panels.length) panels.push({ id: 'log', lab: 'LOG', list: paths.slice() });

  var h = '<div class="crt-bezel"><div class="crt-screen">';
  h += '<div class="crt-scanlines" aria-hidden="true"></div>';
  h += '<div class="crt-header">'
    + '<span class="crt-boot">BOOT OK</span>'
    + '<span class="crt-clock">' + escHtml((b.meta[0] && ctx.plain(b.meta[0])) || '00:00') + '</span>'
    + '</div>';

  h += '<div class="crt-prompt-line"><span class="crt-ps">root@nebula:~$</span> '
    + '<span class="crt-cmd">inspect --target <em>' + escHtml(main) + '</em></span>'
    + '<span class="crt-cursor">█</span></div>';

  h += '<div class="crt-panel-tabs">';
  panels.forEach(function(p, i) {
    h += '<button type="button" class="crt-ptab' + (i === 0 ? ' is-on' : '')
      + '" data-panel="' + p.id + '">[' + escHtml(p.lab) + ']</button>';
  });
  h += '</div>';

  panels.forEach(function(panel, i) {
    h += '<div class="crt-panel" data-panel-pane="' + panel.id + '"' + (i === 0 ? '' : ' hidden') + '>';
    if (panel.meters) {
      h += '<div class="crt-meters">';
      panel.meters.forEach(function(p) {
        var pct = guessPct(ctx.plain(p));
        h += '<div class="crt-meter"><div class="crt-meter-lab">[' + escHtml(p.label) + ']</div>'
          + '<div class="crt-meter-bar"><span style="width:' + pct + '%"></span></div>'
          + '<div class="crt-meter-num">' + ctx.val(p) + '</div></div>';
      });
      h += '</div>';
    }
    if (panel.list) {
      h += '<div class="crt-log">';
      panel.list.forEach(function(p) {
        h += '<div class="crt-line"><span class="crt-key">&gt; ' + escHtml(p.label)
          + '</span><span class="crt-eq">=</span><span class="crt-out">' + ctx.val(p) + '</span></div>';
      });
      h += '</div>';
    }
    h += '</div>';
  });

  h += '<div class="crt-footer">/// PHOSPHOR MONITOR v3.0 ///</div>';
  h += '</div></div>';

  h += '<script>(function(){var root=document.currentScript&&document.currentScript.previousElementSibling;'
    + 'if(!root||!root.classList.contains("crt-bezel"))root=document.querySelector(".zb-root .crt-bezel");'
    + 'if(!root)return;var tabs=root.querySelectorAll(".crt-ptab");var panes=root.querySelectorAll(".crt-panel");'
    + 'tabs.forEach(function(btn){btn.addEventListener("click",function(){'
    + 'var id=btn.getAttribute("data-panel");'
    + 'tabs.forEach(function(t){t.classList.toggle("is-on",t===btn);});'
    + 'panes.forEach(function(p){p.hidden=p.getAttribute("data-panel-pane")!==id;});'
    + '});});})();</script>';
  return h;
}

export function css() {
  return [
    '.zb-root{box-sizing:border-box;width:100%;max-width:720px;margin:0 auto;padding:14px;font-family:"Consolas","Courier New",monospace;font-size:12px;line-height:1.4;color:#39ff14;background:#0a0a0a}',
    '.zb-root *,.zb-root *:before,.zb-root *:after{box-sizing:border-box}',
    '.crt-empty{padding:28px;text-align:center;letter-spacing:.15em;opacity:.6}',
    '.crt-bezel{padding:14px;border-radius:18px;background:linear-gradient(160deg,#2a2a2a,#111);box-shadow:inset 0 0 0 2px #444,0 12px 40px rgba(0,0,0,.65)}',
    '.crt-screen{position:relative;overflow:hidden;border-radius:10px;padding:14px 14px 12px;background:radial-gradient(ellipse at center,#0d1f0d 0%,#020802 70%);box-shadow:inset 0 0 60px rgba(57,255,20,.08);min-height:200px}',
    '.crt-scanlines{pointer-events:none;position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.18) 2px,rgba(0,0,0,.18) 4px);opacity:.55;z-index:2}',
    '.crt-header,.crt-prompt-line,.crt-panel-tabs,.crt-panel,.crt-footer{position:relative;z-index:3}',
    '.crt-header{display:flex;justify-content:space-between;margin-bottom:10px;font-size:10px;letter-spacing:.2em;opacity:.75}',
    '.crt-boot{color:#39ff14;text-shadow:0 0 8px #39ff14}',
    '.crt-prompt-line{margin-bottom:10px;font-size:12px}',
    '.crt-ps{color:#7dff7d;opacity:.85}',
    '.crt-cmd em{font-style:normal;color:#39ff14;text-shadow:0 0 10px #39ff14;font-weight:800}',
    '.crt-cursor{display:inline-block;margin-left:2px;animation:crt-blink 1s step-end infinite}',
    '@keyframes crt-blink{50%{opacity:0}}',
    '.crt-panel-tabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}',
    '.crt-ptab{appearance:none;border:1px solid rgba(57,255,20,.35);background:rgba(0,20,0,.4);color:#2f8f2f;font:inherit;font-size:10px;padding:3px 8px;cursor:pointer;letter-spacing:.06em}',
    '.crt-ptab.is-on{color:#39ff14;border-color:#39ff14;box-shadow:0 0 10px rgba(57,255,20,.3);text-shadow:0 0 6px #39ff14}',
    '.crt-meters{display:flex;flex-direction:column;gap:8px;margin-bottom:8px}',
    '.crt-meter{display:grid;grid-template-columns:72px 1fr 48px;gap:8px;align-items:center}',
    '.crt-meter-lab{font-size:10px;color:#2f8f2f}',
    '.crt-meter-bar{height:10px;background:#041404;border:1px solid rgba(57,255,20,.35);padding:1px}',
    '.crt-meter-bar>span{display:block;height:100%;background:repeating-linear-gradient(90deg,#39ff14,#39ff14 3px,transparent 3px,transparent 5px);box-shadow:0 0 10px rgba(57,255,20,.45)}',
    '.crt-meter-num,.crt-meter-num .zb-value{font-size:11px;font-weight:800;color:#39ff14!important;text-align:right;text-shadow:0 0 6px #39ff14}',
    '.crt-log{font-size:11px}',
    '.crt-line{display:grid;grid-template-columns:minmax(90px,auto) 12px 1fr;gap:4px;padding:3px 0;border-bottom:1px dotted rgba(57,255,20,.12)}',
    '.crt-key{color:#2f8f2f;white-space:nowrap}',
    '.crt-eq{color:#1a5a1a;text-align:center}',
    '.crt-out,.crt-out .zb-value{color:#9aff9a!important;word-break:break-word}',
    '.crt-footer{margin-top:12px;text-align:center;font-size:9px;letter-spacing:.25em;opacity:.4}',
  ].join('');
}
