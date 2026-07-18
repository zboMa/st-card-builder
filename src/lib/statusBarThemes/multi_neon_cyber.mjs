/**
 * 赛博群像（多人）—— 多窗口叠放，点标题栏切焦点窗；人人同套字段
 */
import { escHtml, guessPct, makeCtx, rolePaths, roleFieldLists, questEventSectionHtml, worldScopedPaths, classifyPath } from './shared.mjs';

export const meta = {
  id: 'multi_neon_cyber',
  label: '赛博群像',
  cast: 'multi',
  family: 'neon',
  blurb: '多窗口叠放 · 点标题栏切焦点 · 人人同套',
  accent: '#39ff14',
};

/** 完整同密度窗体 */
function win(name, paths, ctx, isMain, idx) {
  var rf = roleFieldLists(paths);
  var meters = rf.meters;
  var lines = rf.detail;
  var h = '<section class="crt-win' + (isMain ? ' is-focus' : '') + '" data-win="' + idx + '">';
  h += '<button type="button" class="crt-win-title">'
    + '<span class="crt-dots"><i></i><i></i><i></i></span>'
    + '<span class="crt-win-name">PID_' + (idx + 1) + ' // ' + escHtml(name) + '</span>'
    + (isMain ? '<span class="crt-focus-tag">FOCUS</span>' : '')
    + '</button>';
  h += '<div class="crt-win-body">';
  meters.forEach(function(p) {
    var pct = guessPct(ctx.plain(p));
    h += '<div class="crt-meter"><div class="crt-meter-lab">[' + escHtml(p.label) + ']</div>'
      + '<div class="crt-meter-bar"><span style="width:' + pct + '%"></span></div>'
      + '<div class="crt-meter-num">' + ctx.val(p) + '</div></div>';
  });
  lines.forEach(function(p) {
    h += '<div class="crt-line"><span class="crt-key">&gt; ' + escHtml(p.label)
      + '</span><span class="crt-eq">=</span><span class="crt-out">' + ctx.val(p) + '</span></div>';
  });
  if (!meters.length && !lines.length) {
    h += '<div class="crt-line"><span class="crt-out">idle…</span></div>';
  }
  h += '</div></section>';
  return h;
}

/** @param {object} opts */
export function render(opts) {
  var allPaths = Array.isArray(opts && opts.allPaths) && opts.allPaths.length
    ? opts.allPaths : (opts.paths || []);
  if (!allPaths.length) return '<div class="crt-empty">NO NODES</div>';
  var characters = Array.isArray(opts && opts.characters) ? opts.characters : [];
  var mainName = String((opts && opts.mainName) || (characters[0] && characters[0].name) || 'NODE');
  var cast = characters.length
    ? characters.filter(function(c) { return c.selected !== false; })
    : [{ name: mainName }];
  var main = mainName || cast[0].name;
  var ctx = makeCtx(opts.valueFn, !!(opts && opts.rawValueHtml));
  var world = worldScopedPaths(allPaths).filter(function(p) { return classifyPath(p) === 'meta'; });

  var h = '<div class="crt-bezel crt-multi"><div class="crt-screen">';
  h += '<div class="crt-scanlines" aria-hidden="true"></div>';
  h += '<div class="crt-header"><span class="crt-boot">CLUSTER ONLINE</span>'
    + '<span class="crt-clock">' + escHtml(world[0] ? ctx.plain(world[0]) : 'SYNC') + '</span></div>';
  h += '<div class="crt-leds">';
  world.forEach(function(p) {
    h += '<span class="crt-led on"><i></i>' + escHtml(p.label) + ' <b>'
      + escHtml(ctx.plain(p)) + '</b></span>';
  });
  if (!world.length) h += '<span class="crt-led on"><i></i>UPLINK</span>';
  h += '</div>';
  h += '<div class="crt-grid">';
  cast.forEach(function(c, i) {
    var rp = rolePaths(allPaths, c.name);
    h += win(c.name, rp, ctx, c.name === main, i);
  });
  h += '</div>';
  h += questEventSectionHtml(allPaths, ctx, 'crt-qe');
  h += '<div class="crt-footer">/// MULTI-PROCESS CRT ///</div>';
  h += '</div></div>';

  // 点标题栏切焦点窗
  h += '<script>(function(){var root=document.currentScript&&document.currentScript.previousElementSibling;'
    + 'if(!root||!root.classList.contains("crt-bezel"))root=document.querySelector(".zb-root .crt-bezel");'
    + 'if(!root)return;var wins=root.querySelectorAll(".crt-win");'
    + 'wins.forEach(function(w){var t=w.querySelector(".crt-win-title");if(!t)return;'
    + 't.addEventListener("click",function(){'
    + 'wins.forEach(function(x){x.classList.remove("is-focus");'
    + 'var tag=x.querySelector(".crt-focus-tag");if(tag)tag.remove();});'
    + 'w.classList.add("is-focus");'
    + 'if(!w.querySelector(".crt-focus-tag")){'
    + 'var s=document.createElement("span");s.className="crt-focus-tag";s.textContent="FOCUS";'
    + 't.appendChild(s);}'
    + '});});})();</script>';
  return h;
}

export function css() {
  return [
    '.zb-root{box-sizing:border-box;width:100%;max-width:720px;margin:0 auto;padding:14px;font-family:"Consolas","Courier New",monospace;font-size:12px;line-height:1.35;color:#39ff14;background:#080808}',
    '.zb-root *,.zb-root *:before,.zb-root *:after{box-sizing:border-box}',
    '.crt-empty{padding:28px;text-align:center;opacity:.55}',
    '.crt-bezel{padding:12px;border-radius:16px;background:linear-gradient(160deg,#2c2c2c,#101010);box-shadow:inset 0 0 0 2px #3a3a3a,0 10px 36px rgba(0,0,0,.7)}',
    '.crt-screen{position:relative;overflow:hidden;border-radius:8px;padding:12px;background:radial-gradient(ellipse at center,#0c1a0c,#020602);box-shadow:inset 0 0 50px rgba(57,255,20,.07)}',
    '.crt-scanlines{pointer-events:none;position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.2) 2px,rgba(0,0,0,.2) 4px);opacity:.5;z-index:1}',
    '.crt-header,.crt-leds,.crt-grid,.crt-footer{position:relative;z-index:2}',
    '.crt-header{display:flex;justify-content:space-between;font-size:10px;letter-spacing:.18em;opacity:.8;margin-bottom:8px}',
    '.crt-boot{text-shadow:0 0 8px #39ff14}',
    '.crt-leds{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}',
    '.crt-led{display:inline-flex;align-items:center;gap:5px;font-size:10px;color:#39ff14}',
    '.crt-led i{width:7px;height:7px;border-radius:50%;background:#39ff14;box-shadow:0 0 8px #39ff14}',
    '.crt-led b{font-weight:700}',
    '.crt-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
    '.crt-win{border:1px solid rgba(57,255,20,.28);background:rgba(0,20,0,.35);min-height:90px;transition:box-shadow .2s,border-color .2s}',
    '.crt-win.is-focus{border-color:#39ff14;box-shadow:0 0 16px rgba(57,255,20,.25);background:rgba(0,40,0,.4);z-index:3}',
    '.crt-win-title{display:flex;align-items:center;gap:8px;width:100%;padding:5px 8px;background:rgba(57,255,20,.08);border:0;border-bottom:1px solid rgba(57,255,20,.2);font:inherit;font-size:10px;color:inherit;cursor:pointer;text-align:left}',
    '.crt-dots{display:inline-flex;gap:3px}',
    '.crt-dots i{width:6px;height:6px;border-radius:50%;background:#2a6b2a}',
    '.crt-win.is-focus .crt-dots i:nth-child(1){background:#ff5f56}',
    '.crt-win.is-focus .crt-dots i:nth-child(2){background:#ffbd2e}',
    '.crt-win.is-focus .crt-dots i:nth-child(3){background:#27c93f}',
    '.crt-win-name{flex:1;letter-spacing:.04em}',
    '.crt-focus-tag{font-size:8px;letter-spacing:.12em;padding:1px 5px;border:1px solid #39ff14;color:#39ff14}',
    '.crt-win-body{padding:8px}',
    '.crt-meter{display:grid;grid-template-columns:56px 1fr 36px;gap:6px;align-items:center;margin-bottom:6px}',
    '.crt-meter-lab{font-size:9px;color:#2f8f2f}',
    '.crt-meter-bar{height:7px;background:#041404;border:1px solid rgba(57,255,20,.3)}',
    '.crt-meter-bar>span{display:block;height:100%;background:repeating-linear-gradient(90deg,#39ff14,#39ff14 2px,transparent 2px,transparent 4px)}',
    '.crt-meter-num,.crt-meter-num .zb-value{font-size:10px;color:#39ff14!important;text-align:right;font-weight:800}',
    '.crt-line{display:grid;grid-template-columns:minmax(70px,auto) 10px 1fr;gap:3px;font-size:10px;padding:2px 0}',
    '.crt-key{color:#2f8f2f}',
    '.crt-eq{color:#1a5a1a;text-align:center}',
    '.crt-out,.crt-out .zb-value{color:#9aff9a!important}',
    '.crt-footer{margin-top:10px;text-align:center;font-size:9px;letter-spacing:.22em;opacity:.35}',
    '@media(max-width:480px){.crt-grid{grid-template-columns:1fr}}',
    '.crt-qe{margin-top:10px;padding-top:8px;border-top:1px solid rgba(127,127,127,.28)}',
    '.crt-qe-h{font-size:10px;letter-spacing:.12em;opacity:.7;margin-bottom:6px}',
    '.crt-qe-rail{display:flex;flex-wrap:wrap;gap:6px}',
    '.crt-qe-chip{font-size:10px;padding:3px 8px;border:1px solid rgba(127,127,127,.35);border-radius:4px}',
  ].join('');
}
