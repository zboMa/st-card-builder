/**
 * RPG 属性卡（单人）—— 装备栏：头像框 + 属性条 + 背包格（全量、无硬截断）
 */
import { escHtml, guessPct, displayBuckets, makeCtx, formatMetaLine } from './shared.mjs';

export const meta = {
  id: 'sheet_attr',
  label: 'RPG属性卡',
  cast: 'single',
  family: 'rpg',
  blurb: '装备栏 · 头像框 · 六维条 · 背包格',
  accent: '#38bdf8',
};

/** @param {object} opts */
export function render(opts) {
  var paths = Array.isArray(opts && opts.paths) ? opts.paths : [];
  if (!paths.length) return '<div class="rpg-empty">无角色数据</div>';
  var ctx = makeCtx(opts.valueFn, !!(opts && opts.rawValueHtml));
  var b = displayBuckets(paths);
  var main = String((opts && opts.mainName) || '冒险者');
  var meta = formatMetaLine(b.meta, ctx);
  var stats = b.meters.length ? b.meters : b.attr;
  // 背包：物品记忆等 + 叙事；有 meters 时再并入 attr；任务事件单独芯片
  var bag = b.bag.concat(b.narrative);
  if (b.meters.length) bag = bag.concat(b.attr);
  var chips = b.questEvents.slice();

  var h = '<div class="rpg-panel">';
  h += '<div class="rpg-equip-top">';
  h += '<div class="rpg-portrait"><div class="rpg-frame"><span>' + escHtml(main.slice(0, 1)) + '</span></div>'
    + '<div class="rpg-name">' + escHtml(main) + '</div>'
    + (meta ? '<div class="rpg-meta">' + escHtml(meta) + '</div>' : '') + '</div>';
  h += '<div class="rpg-mini-bars rpg-scroll">';
  stats.forEach(function(p) {
    var pct = guessPct(ctx.plain(p));
    h += '<div class="rpg-stat"><span class="rpg-stat-k">' + escHtml(p.label) + '</span>'
      + '<div class="rpg-track"><div class="rpg-fill" style="width:' + pct + '%"></div></div>'
      + '<span class="rpg-stat-v">' + ctx.val(p) + '</span></div>';
  });
  h += '</div></div>';

  h += '<div class="rpg-grid rpg-scroll">';
  bag.forEach(function(p) {
    h += '<div class="rpg-slot"><div class="rpg-slot-ico">◇</div>'
      + '<div class="rpg-slot-k">' + escHtml(p.label) + '</div>'
      + '<div class="rpg-slot-v">' + ctx.val(p) + '</div></div>';
  });
  h += '</div>';

  if (chips.length) {
    h += '<div class="rpg-quests">';
    chips.forEach(function(p) {
      h += '<span class="rpg-chip"><b>' + escHtml(p.label) + '</b> ' + ctx.val(p) + '</span>';
    });
    h += '</div>';
  }
  // NSFW 整区
  if (b.nsfw.length) {
    h += '<div class="rpg-nsfw rpg-scroll"><div class="rpg-nsfw-h">亲密</div>';
    b.nsfw.forEach(function(p) {
      h += '<div class="rpg-slot"><div class="rpg-slot-k">' + escHtml(p.label) + '</div>'
        + '<div class="rpg-slot-v">' + ctx.val(p) + '</div></div>';
    });
    h += '</div>';
  }
  h += '<div class="rpg-foot">RPG EQUIPMENT</div></div>';
  return h;
}

export function css() {
  return [
    '.zb-root{box-sizing:border-box;width:100%;max-width:720px;margin:0 auto;padding:12px;font-family:"Segoe UI","Microsoft YaHei",sans-serif;font-size:12px;line-height:1.45;color:#e0f2fe;background:radial-gradient(ellipse at 20% 0%,rgba(56,189,248,.12),transparent 55%),linear-gradient(180deg,#0b1220,#0f172a)}',
    '.zb-root *,.zb-root *:before,.zb-root *:after{box-sizing:border-box}',
    '.rpg-empty{padding:20px;text-align:center;opacity:.5}',
    '.rpg-panel{border:1px solid rgba(56,189,248,.35);border-radius:10px;padding:12px;background:rgba(15,23,42,.7);box-shadow:0 0 0 1px rgba(56,189,248,.08),0 12px 32px rgba(0,0,0,.35)}',
    '.rpg-equip-top{display:grid;grid-template-columns:110px 1fr;gap:14px;margin-bottom:12px}',
    '.rpg-portrait{text-align:center}',
    '.rpg-frame{width:72px;height:72px;margin:0 auto 8px;border:2px solid #38bdf8;border-radius:8px;background:linear-gradient(145deg,#1e3a5f,#0f172a);display:flex;align-items:center;justify-content:center;font-size:1.6rem;font-weight:800;color:#7dd3fc;box-shadow:inset 0 0 16px rgba(56,189,248,.2),0 0 12px rgba(56,189,248,.25)}',
    '.rpg-name{font-weight:800;font-size:13px;color:#7dd3fc}',
    '.rpg-meta{font-size:10px;opacity:.65;margin-top:2px}',
    '.rpg-mini-bars{display:flex;flex-direction:column;gap:6px;justify-content:center}',
    '.rpg-scroll{max-height:220px;overflow:auto}',
    '.rpg-stat{display:grid;grid-template-columns:48px 1fr 40px;gap:6px;align-items:center}',
    '.rpg-stat-k{font-size:10px;opacity:.7}',
    '.rpg-track{height:6px;background:rgba(15,23,42,.9);border-radius:3px;overflow:hidden;border:1px solid rgba(56,189,248,.2)}',
    '.rpg-fill{height:100%;background:linear-gradient(90deg,#0284c7,#38bdf8,#7dd3fc);border-radius:inherit}',
    '.rpg-stat-v,.rpg-stat-v .zb-value{font-size:11px;font-weight:700;text-align:right;color:#7dd3fc!important}',
    '.rpg-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px}',
    '.rpg-slot{aspect-ratio:1;border:1px solid rgba(56,189,248,.25);border-radius:6px;background:rgba(2,6,23,.5);padding:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:64px}',
    '.rpg-slot-ico{font-size:14px;opacity:.5;color:#38bdf8}',
    '.rpg-slot-k{font-size:9px;opacity:.55;text-align:center}',
    '.rpg-slot-v,.rpg-slot-v .zb-value{font-size:10px;font-weight:700;text-align:center;color:#e0f2fe!important;word-break:break-all}',
    '.rpg-quests{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}',
    '.rpg-chip{font-size:10px;padding:3px 8px;border-radius:4px;background:rgba(56,189,248,.12);border:1px solid rgba(56,189,248,.3)}',
    '.rpg-chip b{margin-right:4px;color:#7dd3fc}',
    '.rpg-nsfw{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px;padding-top:8px;border-top:1px solid rgba(56,189,248,.2)}',
    '.rpg-nsfw-h{grid-column:1/-1;font-size:10px;letter-spacing:.15em;opacity:.55;margin-bottom:2px}',
    '.rpg-nsfw .rpg-slot{aspect-ratio:auto;min-height:48px}',
    '.rpg-foot{text-align:center;font-size:9px;letter-spacing:.2em;opacity:.35}',
    '@media(max-width:420px){.rpg-equip-top{grid-template-columns:1fr}.rpg-grid,.rpg-nsfw{grid-template-columns:repeat(2,1fr)}}',
  ].join('');
}
