/**
 * 软监控面板（单人）—— 真正仪表盘：顶栏 KPI + 主表盘 + 侧栏明细（非 softmonLayout）
 */
import { escHtml, guessPct, bucketPaths, makeCtx } from './shared.mjs';

export const meta = {
  id: 'soft_monitor',
  label: '软监控面板',
  cast: 'single',
  family: 'softmon',
  blurb: '仪表盘 KPI · 主表盘 · 侧栏明细',
  accent: '#a8d8ea',
};

/** @param {object} opts */
export function render(opts) {
  var paths = Array.isArray(opts && opts.paths) ? opts.paths : [];
  if (!paths.length) return '<div class="sm-empty">NO FEED</div>';
  var ctx = makeCtx(opts.valueFn, !!(opts && opts.rawValueHtml));
  var b = bucketPaths(paths);
  var main = String((opts && opts.mainName) || 'SUBJECT');
  var kpis = b.meta.slice();
  var dials = b.meters.length ? b.meters : b.attr;
  var grid = b.narrative.concat(b.meters.length ? b.attr : []).concat(b.items).concat(b.nsfw);
  var primary = dials[0];

  var h = '<div class="sm-panel">';
  h += '<div class="sm-topbar"><span class="sm-live">● LIVE</span>'
    + '<span class="sm-title">SYSTEM MONITORING</span>'
    + '<span class="sm-subject">' + escHtml(main) + '</span></div>';
  h += '<div class="sm-kpi">';
  (kpis.length ? kpis : [{ label: 'LINK', sample: 'OK' }]).forEach(function(p) {
    h += '<div class="sm-kpi-item"><div class="sm-kpi-k">' + escHtml(p.label) + '</div>'
      + '<div class="sm-kpi-v">' + (p.path ? ctx.val(p) : escHtml(p.sample || '—')) + '</div></div>';
  });
  h += '</div>';
  h += '<div class="sm-dash">';
  h += '<div class="sm-dial">';
  if (primary) {
    var pct = guessPct(ctx.plain(primary));
    h += '<div class="sm-dial-ring" style="--pct:' + pct + '"><span>' + pct + '</span></div>'
      + '<div class="sm-dial-lab">' + escHtml(primary.label) + '</div>'
      + '<div class="sm-dial-val">' + ctx.val(primary) + '</div>';
  }
  h += '</div>';
  h += '<div class="sm-mini-bars">';
  dials.slice(1).forEach(function(p) {
    var pct = guessPct(ctx.plain(p));
    h += '<div class="sm-mini"><span class="sm-mini-lab">' + escHtml(String(p.label || '')) + '</span>'
      + '<div class="sm-track"><div class="sm-fill" style="width:' + pct + '%;background:linear-gradient(90deg,#81ecec,transparent)"></div></div>'
      + '<span class="sm-mini-num">' + ctx.val(p) + '</span></div>';
  });
  h += '</div></div>';
  h += '<div class="sm-grid">';
  grid.forEach(function(p) {
    h += '<div class="sm-cell"><div class="sm-cell-k">' + escHtml(p.label) + '</div>'
      + '<div class="sm-cell-v">' + ctx.val(p) + '</div></div>';
  });
  h += '</div></div>';
  return h;
}

export function css() {
  return [
    '.zb-root{box-sizing:border-box;width:100%;max-width:720px;margin:0 auto;padding:10px;font-family:"Microsoft YaHei","Segoe UI",sans-serif;font-size:12px;line-height:1.4;color:#e0e0e0;background:radial-gradient(ellipse at 15% 0%,rgba(168,216,234,.12),transparent 50%),#0d1117}',
    '.zb-root *,.zb-root *:before,.zb-root *:after{box-sizing:border-box}',
    '.sm-empty{padding:20px;text-align:center;opacity:.5}',
    '.sm-panel{border:1px solid rgba(168,216,234,.3);border-radius:12px;padding:12px;background:rgba(13,17,23,.85)}',
    '.sm-topbar{display:flex;align-items:center;gap:10px;margin-bottom:10px;font-size:10px;letter-spacing:.08em}',
    '.sm-live{color:#81ecec;animation:sm-pulse 1.6s ease-in-out infinite}',
    '@keyframes sm-pulse{50%{opacity:.4}}',
    '.sm-title{flex:1;opacity:.65}',
    '.sm-subject{font-weight:700;color:#a8d8ea}',
    '.sm-kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:6px;margin-bottom:12px}',
    '.sm-kpi-item{padding:8px;border-radius:8px;background:rgba(168,216,234,.08);border:1px solid rgba(168,216,234,.15)}',
    '.sm-kpi-k{font-size:9px;opacity:.55;margin-bottom:2px}',
    '.sm-kpi-v,.sm-kpi-v .zb-value{font-size:13px;font-weight:700;color:#81ecec!important}',
    '.sm-dash{display:grid;grid-template-columns:120px 1fr;gap:12px;margin-bottom:12px;align-items:center}',
    '.sm-dial{text-align:center}',
    '.sm-dial-ring{width:88px;height:88px;margin:0 auto 6px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:800;color:#81ecec;background:conic-gradient(#81ecec calc(var(--pct,50)*1%),rgba(168,216,234,.12) 0);mask:radial-gradient(farthest-side,transparent calc(100% - 8px),#000 calc(100% - 7px));-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 8px),#000 calc(100% - 7px))}',
    '.sm-dial-ring span{position:absolute}',
    '.sm-dial{position:relative}',
    '.sm-dial-ring{position:relative}',
    '.sm-dial-ring span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;mask:none;-webkit-mask:none;background:transparent}',
    '.sm-dial-lab{font-size:10px;opacity:.6}',
    '.sm-dial-val,.sm-dial-val .zb-value{font-size:11px;color:#a8d8ea!important}',
    '.sm-mini-bars{display:flex;flex-direction:column;gap:8px}',
    '.sm-mini{display:flex;align-items:center;gap:6px}',
    '.sm-mini-lab{font-size:10px;opacity:.55;min-width:20px}',
    '.sm-track{flex:1;height:6px;border-radius:3px;background:rgba(0,0,0,.35);overflow:hidden}',
    '.sm-fill{height:100%;border-radius:inherit}',
    '.sm-mini-num,.sm-mini-num .zb-value{font-size:10px;font-weight:700;color:#81ecec!important;min-width:28px;text-align:right}',
    '.sm-grid{max-height:240px;overflow:auto;display:grid;grid-template-columns:1fr 1fr;gap:6px}',
    '.sm-cell{padding:8px;border-radius:8px;background:rgba(168,216,234,.06);border:1px solid rgba(168,216,234,.12)}',
    '.sm-cell-k{font-size:9px;opacity:.5;margin-bottom:2px}',
    '.sm-cell-v,.sm-cell-v .zb-value{font-size:12px;font-weight:600;color:#e0e0e0!important}',
    '@media(max-width:420px){.sm-kpi{grid-template-columns:1fr}.sm-dash{grid-template-columns:1fr}}',
  ].join('');
}
