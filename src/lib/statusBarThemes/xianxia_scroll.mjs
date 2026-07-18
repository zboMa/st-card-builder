/**
 * 仙侠金墨（单人）—— 长卷轴竖读 + 两侧楹联
 */
import { escHtml, guessPct, bucketPaths, makeCtx, formatMetaLine } from './shared.mjs';

export const meta = {
  id: 'xianxia_scroll',
  label: '仙侠金墨',
  cast: 'single',
  family: 'xianxia',
  blurb: '长卷轴竖读 · 两侧楹联 · 朱印天头',
  accent: '#fbbf24',
};

/** @param {object} opts */
export function render(opts) {
  var paths = Array.isArray(opts && opts.paths) ? opts.paths : [];
  if (!paths.length) return '<div class="xxs-empty">仙册未开</div>';
  var ctx = makeCtx(opts.valueFn, !!(opts && opts.rawValueHtml));
  var b = bucketPaths(paths);
  var main = String((opts && opts.mainName) || '修士');
  var metaText = formatMetaLine(b.meta, ctx) || '山中无历日';
  var leftCouplet = (b.meters[0] && b.meters[0].label) || '修';
  var rightCouplet = (b.narrative[0] && b.narrative[0].label) || '行';
  var body = b.meters.concat(b.attr).concat(b.narrative).concat(b.items);
  var verses = b.nsfw.length ? b.nsfw : b.narrative.filter(function(p) { return /内心|情绪|记忆/.test(p.label || ''); }).slice(0, 1);

  var h = '<div class="xxs-scroll">';
  h += '<div class="xxs-rod xxs-rod-t" aria-hidden="true"></div>';
  h += '<div class="xxs-frame">';
  // 左楹联
  h += '<aside class="xxs-couplet xxs-couplet-l"><span>' + escHtml(String(leftCouplet).slice(0, 4).split('').join('<br>')) + '</span></aside>';
  h += '<div class="xxs-paper">';
  h += '<div class="xxs-head"><div class="xxs-seal-sq">仙</div>'
    + '<div class="xxs-head-txt"><div class="xxs-name">' + escHtml(main) + '</div>'
    + '<div class="xxs-sub">' + escHtml(metaText) + '</div></div>'
    + '<div class="xxs-seal-round">印</div></div>';
  h += '<div class="xxs-cloud" aria-hidden="true"><span></span><span></span><span></span></div>';
  h += '<div class="xxs-vert">';
  body.forEach(function(p) {
    var pct = guessPct(ctx.plain(p));
    h += '<div class="xxs-row"><span class="xxs-k">' + escHtml(p.label) + '</span>'
      + '<span class="xxs-bar"><i style="width:' + pct + '%"></i></span>'
      + '<span class="xxs-v">' + ctx.val(p) + '</span></div>';
  });
  h += '</div>';
  verses.forEach(function(verse) {
    h += '<div class="xxs-verse"><span class="xxs-verse-mark">「</span>'
      + '<div><div class="xxs-verse-k">' + escHtml(verse.label) + '</div>'
      + '<div class="xxs-verse-v">' + ctx.val(verse) + '</div></div>'
      + '<span class="xxs-verse-mark">」</span></div>';
  });
  h += '<div class="xxs-foot">※ 金墨既书 · 天命可鉴 ※</div>';
  h += '</div>';
  // 右楹联
  h += '<aside class="xxs-couplet xxs-couplet-r"><span>' + escHtml(String(rightCouplet).slice(0, 4).split('').join('<br>')) + '</span></aside>';
  h += '</div>';
  h += '<div class="xxs-rod xxs-rod-b" aria-hidden="true"></div></div>';
  return h;
}

export function css() {
  return [
    '.zb-root{box-sizing:border-box;width:100%;max-width:720px;margin:0 auto;padding:12px;font-family:Georgia,"Songti SC","STSong","Microsoft YaHei",serif;font-size:12px;line-height:1.55;color:#fef3c7;background:radial-gradient(ellipse at 50% 0%,#3b2210,transparent 50%),#120c08}',
    '.zb-root *,.zb-root *:before,.zb-root *:after{box-sizing:border-box}',
    '.xxs-empty{padding:28px;text-align:center;letter-spacing:.3em;opacity:.5}',
    '.xxs-scroll{display:flex;flex-direction:column}',
    '.xxs-rod{height:14px;border-radius:8px;background:linear-gradient(180deg,#b45309,#78350f 45%,#451a03);box-shadow:0 2px 0 #1c0a00,inset 0 1px 0 rgba(251,191,36,.35);position:relative;z-index:2}',
    '.xxs-rod:before,.xxs-rod:after{content:"";position:absolute;top:50%;width:10px;height:10px;border-radius:50%;background:#fbbf24;transform:translateY(-50%)}',
    '.xxs-rod:before{left:8px}',
    '.xxs-rod:after{right:8px}',
    '.xxs-frame{display:grid;grid-template-columns:36px 1fr 36px;gap:0;margin:-4px 6px;align-items:stretch}',
    '.xxs-couplet{writing-mode:horizontal-tb;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.25);border:1px solid rgba(251,191,36,.3);padding:8px 4px;color:#fbbf24;font-size:13px;font-weight:800;letter-spacing:.2em;line-height:1.6;text-align:center}',
    '.xxs-couplet-l{border-radius:0 0 0 4px}',
    '.xxs-couplet-r{border-radius:0 0 4px 0}',
    '.xxs-paper{padding:16px 14px 12px;background:linear-gradient(180deg,#2a1a10,#1a100a 40%,#140c08);border-top:1px solid rgba(251,191,36,.35);border-bottom:1px solid rgba(251,191,36,.35);box-shadow:inset 0 0 40px rgba(0,0,0,.35)}',
    '.xxs-head{display:flex;align-items:center;gap:12px;margin-bottom:8px}',
    '.xxs-seal-sq{width:40px;height:40px;background:#9f1239;color:#fecdd3;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;transform:rotate(-6deg)}',
    '.xxs-seal-round{width:36px;height:36px;border-radius:50%;border:2px solid #fbbf24;color:#fbbf24;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800}',
    '.xxs-head-txt{flex:1;text-align:center}',
    '.xxs-name{font-size:1.35rem;font-weight:800;letter-spacing:.35em;color:#fde68a}',
    '.xxs-sub{margin-top:4px;font-size:11px;color:#c9a46a}',
    '.xxs-cloud{display:flex;justify-content:center;gap:10px;margin:10px 0 14px;opacity:.55}',
    '.xxs-cloud span{width:28px;height:6px;border-radius:999px;background:rgba(251,191,36,.35)}',
    '.xxs-vert{max-height:280px;overflow:auto;display:flex;flex-direction:column;gap:6px;margin-bottom:10px}',
    '.xxs-row{display:grid;grid-template-columns:48px 1fr 40px;gap:8px;align-items:center;padding:4px 0;border-bottom:1px dashed rgba(251,191,36,.12)}',
    '.xxs-k{font-size:10px;color:#c9a46a}',
    '.xxs-bar{height:4px;background:rgba(0,0,0,.35);overflow:hidden}',
    '.xxs-bar>i{display:block;height:100%;background:linear-gradient(90deg,#b45309,#fbbf24)}',
    '.xxs-v,.xxs-v .zb-value{font-size:11px;font-weight:700;color:#fde68a!important;text-align:right}',
    '.xxs-verse{display:flex;align-items:stretch;gap:6px;padding:10px;margin-bottom:8px;background:rgba(159,18,57,.15);border:1px solid rgba(251,191,36,.25)}',
    '.xxs-verse-mark{font-size:22px;color:#fbbf24;opacity:.7}',
    '.xxs-verse-k{font-size:10px;color:#c9a46a}',
    '.xxs-verse-v,.xxs-verse-v .zb-value{font-size:12px;color:#fef3c7!important}',
    '.xxs-foot{text-align:center;font-size:10px;letter-spacing:.2em;color:#a67c52;opacity:.7}',
    '@media(max-width:420px){.xxs-frame{grid-template-columns:1fr}.xxs-couplet{display:none}}',
  ].join('');
}
