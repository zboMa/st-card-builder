/**
 * 恋爱微光（单人）—— 日记本对开页：左情右况
 */
import { escHtml, guessPct, bucketPaths, makeCtx, formatMetaLine } from './shared.mjs';

export const meta = {
  id: 'romance_glow',
  label: '恋爱微光',
  cast: 'single',
  family: 'romance',
  blurb: '日记对开页 · 左情右况 · 心形签',
  accent: '#fb7185',
};

/** @param {object} opts */
export function render(opts) {
  var paths = Array.isArray(opts && opts.paths) ? opts.paths : [];
  if (!paths.length) return '<div class="rom-empty">日记空白</div>';
  var ctx = makeCtx(opts.valueFn, !!(opts && opts.rawValueHtml));
  var b = bucketPaths(paths);
  var main = String((opts && opts.mainName) || '她');
  var meta = formatMetaLine(b.meta, ctx);
  var heart = b.meters.filter(function(p) { return /好感|信任|亲密|关系/.test((p.label || '') + (p.path || '')); });
  if (!heart.length) heart = b.meters.slice();
  var feel = b.narrative.concat(b.nsfw);
  var life = b.attr.concat(b.items).concat(b.meters.filter(function(p) { return heart.indexOf(p) < 0; }));

  var h = '<div class="rom-panel">';
  h += '<div class="rom-spine" aria-hidden="true"></div>';
  h += '<div class="rom-diary">';
  h += '<div class="rom-page rom-left">';
  h += '<div class="rom-date">' + escHtml(meta || '某日') + '</div>';
  h += '<div class="rom-dear">致 <strong>' + escHtml(main) + '</strong></div>';
  h += '<div class="rom-hearts">';
  heart.forEach(function(p) {
    var pct = guessPct(ctx.plain(p));
    h += '<div class="rom-heart-row"><span>♥ ' + escHtml(p.label) + '</span>'
      + '<div class="rom-bar"><i style="width:' + pct + '%"></i></div>'
      + '<em>' + ctx.val(p) + '</em></div>';
  });
  h += '</div>';
  feel.forEach(function(p) {
    h += '<div class="rom-chip"><b>' + escHtml(p.label) + '</b> ' + ctx.val(p) + '</div>';
  });
  h += '</div>';
  h += '<div class="rom-page rom-right">';
  h += '<div class="rom-right-h">此刻况味</div>';
  life.forEach(function(p) {
    h += '<div class="rom-line"><span>' + escHtml(p.label) + '</span><span>' + ctx.val(p) + '</span></div>';
  });
  h += '</div></div>';
  h += '<div class="rom-foot">✧ forever in these pages ✧</div></div>';
  return h;
}

export function css() {
  return [
    '.zb-root{box-sizing:border-box;width:100%;max-width:720px;margin:0 auto;padding:14px;font-family:Georgia,"Songti SC","Microsoft YaHei",serif;font-size:12px;line-height:1.5;color:#9f1239;background:radial-gradient(circle at 30% 0%,#fce7f3,transparent 50%),#fff1f2}',
    '.zb-root *,.zb-root *:before,.zb-root *:after{box-sizing:border-box}',
    '.rom-empty{padding:24px;text-align:center;opacity:.5}',
    '.rom-panel{position:relative}',
    '.rom-spine{position:absolute;left:50%;top:8px;bottom:28px;width:10px;transform:translateX(-50%);background:linear-gradient(90deg,#fda4af,#fb7185,#fda4af);border-radius:2px;z-index:2;box-shadow:0 0 8px rgba(251,113,133,.35)}',
    '.rom-diary{display:grid;grid-template-columns:1fr 1fr;gap:0;background:#fff;border-radius:4px;box-shadow:0 10px 28px rgba(190,24,93,.12);overflow:hidden;border:1px solid #fecdd3}',
    '.rom-page{padding:16px 18px 14px;min-height:200px}',
    '.rom-left{background:linear-gradient(180deg,#fff7fb,#fff);border-right:1px solid #fecdd3}',
    '.rom-right{background:linear-gradient(180deg,#fff,#fff1f2)}',
    '.rom-date{font-size:10px;color:#fb7185;font-style:italic;margin-bottom:6px}',
    '.rom-dear{font-size:14px;margin-bottom:10px;color:#be123c}',
    '.rom-dear strong{color:#e11d48}',
    '.rom-hearts{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}',
    '.rom-heart-row{display:grid;grid-template-columns:70px 1fr 36px;gap:6px;align-items:center;font-size:11px}',
    '.rom-bar{height:6px;background:#fecdd3;border-radius:999px;overflow:hidden}',
    '.rom-bar>i{display:block;height:100%;background:linear-gradient(90deg,#fb7185,#f472b6)}',
    '.rom-heart-row em,.rom-heart-row .zb-value{font-style:normal;text-align:right;font-weight:700;color:#be123c!important}',
    '.rom-chip{display:inline-block;margin:0 4px 6px 0;padding:4px 8px;background:#fff1f2;border:1px solid #fecdd3;border-radius:999px;font-size:10px}',
    '.rom-chip b{color:#e11d48;margin-right:3px}',
    '.rom-right-h{font-size:11px;letter-spacing:.2em;color:#fb7185;margin-bottom:10px;font-weight:700}',
    '.rom-line{display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px dashed #fecdd3;font-size:11px}',
    '.rom-line .zb-value{color:#9f1239!important;font-weight:600}',
    '.rom-foot{text-align:center;margin-top:10px;font-size:10px;color:#fb7185;letter-spacing:.12em;opacity:.7}',
    '@media(max-width:480px){.rom-diary{grid-template-columns:1fr}.rom-spine{display:none}.rom-left{border-right:0;border-bottom:1px solid #fecdd3}}',
  ].join('');
}
