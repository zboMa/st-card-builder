/**
 * 水墨素笺（单人）—— 条幅/册页：竖排题签 + 留白分区
 */
import { escHtml, guessPct, bucketPaths, makeCtx } from './shared.mjs';

export const meta = {
  id: 'ink_paper',
  label: '水墨素笺',
  cast: 'single',
  family: 'ink',
  blurb: '竖排题签 · 留白分区 · 条幅册页',
  accent: '#475569',
};

/** @param {object} opts */
export function render(opts) {
  var paths = Array.isArray(opts && opts.paths) ? opts.paths : [];
  if (!paths.length) return '<div class="ink-empty">素笺未书</div>';
  var ctx = makeCtx(opts.valueFn, !!(opts && opts.rawValueHtml));
  var b = bucketPaths(paths);
  var main = String((opts && opts.mainName) || '故人');
  var title = (b.meta[0] && ctx.plain(b.meta[0])) || main;
  var secs = [
    { lab: '景', list: b.meta.slice() },
    { lab: '气', list: b.meters.length ? b.meters : b.attr },
    { lab: '事', list: b.narrative.concat(b.items) },
    { lab: '念', list: b.nsfw.concat(b.meters.length ? b.attr : []) },
  ].filter(function(s) { return s.list.length; });

  var h = '<div class="ink-panel">';
  h += '<div class="ink-title-seal"><span class="ink-vert-title">' + escHtml(String(title).slice(0, 6).split('').join('<br>')) + '</span></div>';
  h += '<div class="ink-sheets">';
  h += '<div class="ink-name">' + escHtml(main) + '</div>';
  secs.forEach(function(s) {
    h += '<section class="ink-section"><div class="ink-sec-lab">' + escHtml(s.lab) + '</div><div class="ink-sec-body">';
    s.list.forEach(function(p) {
      var pct = guessPct(ctx.plain(p));
      h += '<div class="ink-cell"><div class="ink-cell-k">' + escHtml(p.label) + '</div>'
        + '<div class="ink-cell-v">' + ctx.val(p) + '</div>'
        + '<div class="ink-wash" style="width:' + Math.max(12, pct * 0.4) + '%"></div></div>';
    });
    h += '</div></section>';
  });
  h += '</div></div>';
  return h;
}

export function css() {
  return [
    '.zb-root{box-sizing:border-box;width:100%;max-width:720px;margin:0 auto;padding:14px;font-family:Georgia,"Songti SC","STKaiti","Microsoft YaHei",serif;font-size:12px;line-height:1.6;color:#334155;background:linear-gradient(180deg,#f8fafc,#e2e8f0)}',
    '.zb-root *,.zb-root *:before,.zb-root *:after{box-sizing:border-box}',
    '.ink-empty{padding:28px;text-align:center;opacity:.45;letter-spacing:.4em}',
    '.ink-panel{display:grid;grid-template-columns:48px 1fr;gap:12px;background:#fafafa;border:1px solid #cbd5e1;padding:16px;box-shadow:0 8px 24px rgba(71,85,105,.08)}',
    '.ink-title-seal{display:flex;justify-content:center;padding-top:8px}',
    '.ink-vert-title{display:block;writing-mode:horizontal-tb;text-align:center;font-size:14px;font-weight:800;letter-spacing:.3em;line-height:1.7;color:#1e293b;border-left:3px solid #475569;padding-left:8px}',
    '.ink-name{font-size:1.2rem;font-weight:800;letter-spacing:.4em;margin-bottom:14px;color:#0f172a}',
    '.ink-section{margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #e2e8f0}',
    '.ink-sec-lab{display:inline-block;font-size:11px;padding:2px 8px;border:1px solid #64748b;color:#475569;letter-spacing:.3em;margin-bottom:8px}',
    '.ink-sec-body{display:flex;flex-direction:column;gap:8px}',
    '.ink-cell{position:relative;padding:6px 0 8px;border-bottom:1px dashed #cbd5e1}',
    '.ink-cell-k{font-size:10px;color:#64748b;margin-bottom:2px}',
    '.ink-cell-v,.ink-cell-v .zb-value{font-size:13px;color:#1e293b!important;font-weight:600}',
    '.ink-wash{position:absolute;left:0;bottom:0;height:3px;background:linear-gradient(90deg,#64748b,transparent);opacity:.45}',
  ].join('');
}
