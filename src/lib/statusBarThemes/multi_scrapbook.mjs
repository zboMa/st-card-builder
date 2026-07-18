/**
 * 手帐群像（多人）—— 人物 Tab + 页内分区小签；入选角色人人同套字段
 */
import { escHtml, guessPct, makeCtx, rolePaths, roleFieldLists, questEventSectionHtml, worldScopedPaths, classifyPath, formatMetaLine } from './shared.mjs';

export const meta = {
  id: 'multi_scrapbook',
  label: '手帐群像',
  cast: 'multi',
  family: 'scrap',
  blurb: '人物 Tab · 页内分区小签 · 人人同套拍立得页',
  accent: '#c4a574',
};

function sticker(p, ctx) {
  return '<div class="scr-sticker"><span class="scr-sticker-k">' + escHtml(p.label)
    + '</span><span class="scr-sticker-v">' + ctx.val(p) + '</span></div>';
}

/** 单人页：同密度分区（小签切换） */
function personPage(name, paths, worldMeta, ctx, isMain, show) {
  var rf = roleFieldLists(paths);
  var meters = rf.meters;
  var narr = rf.buckets.narrative;
  var items = rf.buckets.items;
  var notes = rf.nsfw.concat(rf.buckets.attr.filter(function(p) {
    return rf.meters.indexOf(p) < 0;
  }));

  var secs = [];
  if (meters.length) secs.push({ id: 'm', lab: '关系', rows: meters });
  if (narr.length) secs.push({ id: 'n', lab: '此刻', rows: narr });
  if (items.length) secs.push({ id: 'i', lab: '随身', rows: items });
  if (notes.length) secs.push({ id: 'o', lab: '记事', rows: notes });
  if (!secs.length) secs.push({ id: 'm', lab: '空白', rows: [] });

  var h = '<article class="scr-note-card' + (isMain ? ' is-main' : '') + '"'
    + ' data-person="' + escHtml(name) + '"' + (show ? '' : ' hidden') + '>';
  h += '<div class="scr-tape" aria-hidden="true"></div>';
  h += '<div class="scr-note-h"><span class="scr-pin">' + escHtml(name.slice(0, 1)) + '</span>'
    + '<div><b>' + escHtml(name) + '</b>'
    + (isMain ? '<em>主视角</em>' : '')
    + (worldMeta ? '<small>' + escHtml(worldMeta) + '</small>' : '')
    + '</div></div>';

  h += '<div class="scr-sec-tabs">';
  secs.forEach(function(sec, i) {
    h += '<button type="button" class="scr-sec' + (i === 0 ? ' is-on' : '')
      + '" data-sec="' + sec.id + '">' + escHtml(sec.lab) + '</button>';
  });
  h += '</div>';

  secs.forEach(function(sec, i) {
    h += '<div class="scr-sec-pane" data-sec-pane="' + sec.id + '"' + (i === 0 ? '' : ' hidden') + '>';
    if (sec.id === 'm' && sec.rows.length) {
      h += '<div class="scr-bars">' + sec.rows.map(function(p) {
        var pct = guessPct(ctx.plain(p));
        return '<div class="scr-bar-row"><span>' + escHtml(p.label) + '</span>'
          + '<div class="scr-bar"><i style="width:' + pct + '%"></i></div>'
          + '<em>' + ctx.val(p) + '</em></div>';
      }).join('') + '</div>';
    } else {
      h += sec.rows.map(function(p) { return sticker(p, ctx); }).join('')
        || '<div class="scr-sticker scr-soft"><span class="scr-sticker-k">—</span></div>';
    }
    h += '</div>';
  });
  h += '</article>';
  return h;
}

/** @param {object} opts */
export function render(opts) {
  var allPaths = Array.isArray(opts && opts.allPaths) && opts.allPaths.length
    ? opts.allPaths : (opts.paths || []);
  if (!allPaths.length) return '<div class="scr-empty">暂无手帐内容</div>';
  var characters = Array.isArray(opts && opts.characters) ? opts.characters : [];
  var mainName = String((opts && opts.mainName) || (characters[0] && characters[0].name) || '');
  var cast = characters.length
    ? characters.filter(function(c) { return c.selected !== false; })
    : (mainName ? [{ name: mainName }] : [{ name: '主角' }]);
  var main = mainName || cast[0].name;
  var ctx = makeCtx(opts.valueFn, !!(opts && opts.rawValueHtml));
  var worldMeta = formatMetaLine(worldScopedPaths(allPaths).filter(function(p) {
    return classifyPath(p) === 'meta';
  }), ctx);

  var h = '<div class="scr-stack">';
  h += '<div class="scr-stack-title">✧ 群像手帐 ✧</div>';
  h += '<div class="scr-cast-tabs" role="tablist">';
  cast.forEach(function(c, i) {
    var on = c.name === main || (!main && i === 0);
    h += '<button type="button" class="scr-cast-tab' + (on ? ' is-on' : '')
      + '" data-cast="' + escHtml(c.name) + '">' + escHtml(c.name) + '</button>';
  });
  h += '</div>';

  cast.forEach(function(c, i) {
    var rp = rolePaths(allPaths, c.name);
    var show = c.name === main || (!cast.some(function(x) { return x.name === main; }) && i === 0);
    h += personPage(c.name, rp, worldMeta, ctx, c.name === main, show);
  });
  h += questEventSectionHtml(allPaths, ctx, 'scr-qe');
  h += '<div class="scr-fruit">🍓 🎀 🍋</div></div>';

  h += '<script>(function(){var root=document.currentScript&&document.currentScript.previousElementSibling;'
    + 'if(!root||!root.classList.contains("scr-stack"))root=document.querySelector(".zb-root .scr-stack");'
    + 'if(!root)return;'
    + 'var castTabs=root.querySelectorAll(".scr-cast-tab");'
    + 'var cards=root.querySelectorAll(".scr-note-card");'
    + 'castTabs.forEach(function(btn){btn.addEventListener("click",function(){'
    + 'var n=btn.getAttribute("data-cast");'
    + 'castTabs.forEach(function(t){t.classList.toggle("is-on",t===btn);});'
    + 'cards.forEach(function(c){c.hidden=c.getAttribute("data-person")!==n;});'
    + '});});'
    + 'cards.forEach(function(card){'
    + 'var secs=card.querySelectorAll(".scr-sec");var panes=card.querySelectorAll(".scr-sec-pane");'
    + 'secs.forEach(function(btn){btn.addEventListener("click",function(){'
    + 'var id=btn.getAttribute("data-sec");'
    + 'secs.forEach(function(t){t.classList.toggle("is-on",t===btn);});'
    + 'panes.forEach(function(p){p.hidden=p.getAttribute("data-sec-pane")!==id;});'
    + '});});});'
    + '})();</script>';
  return h;
}

export function css() {
  return [
    '.zb-root{box-sizing:border-box;width:100%;max-width:720px;margin:0 auto;padding:14px;font-family:Georgia,"Songti SC","Microsoft YaHei",serif;font-size:12px;line-height:1.45;color:#5c4033;background:linear-gradient(180deg,#fdf2f8,#faf3e8 40%,#fef9c3)}',
    '.zb-root *,.zb-root *:before,.zb-root *:after{box-sizing:border-box}',
    '.scr-empty{padding:24px;text-align:center;opacity:.5}',
    '.scr-stack{display:flex;flex-direction:column;gap:10px}',
    '.scr-stack-title{text-align:center;font-size:11px;letter-spacing:.2em;color:#a67c52}',
    '.scr-cast-tabs{display:flex;flex-wrap:wrap;gap:4px;justify-content:center}',
    '.scr-cast-tab{appearance:none;border:1px solid #e8d5b7;background:#fffef8;color:#6b4423;font:inherit;font-size:11px;font-weight:700;padding:5px 12px;border-radius:3px;cursor:pointer}',
    '.scr-cast-tab.is-on{background:#c4a574;color:#fffef8;border-color:#a67c52}',
    '.scr-note-card{position:relative;background:#fffef8;border:1px solid #e8d5b7;border-radius:3px;padding:14px 12px 10px;box-shadow:3px 4px 0 rgba(196,165,116,.18)}',
    '.scr-note-card.is-main{background:#fff7ed;border-color:#f0c4a0}',
    '.scr-tape{position:absolute;top:-8px;left:18px;width:48px;height:16px;background:repeating-linear-gradient(90deg,#fda4af,#fda4af 6px,#fff 6px,#fff 12px);opacity:.9;transform:rotate(-6deg)}',
    '.scr-note-h{display:flex;align-items:center;gap:10px;margin-bottom:10px}',
    '.scr-pin{width:36px;height:36px;border-radius:4px;background:linear-gradient(145deg,#fce7f3,#fde68a);border:2px solid #fff;box-shadow:0 2px 0 #e8d5b7;display:flex;align-items:center;justify-content:center;font-weight:800;color:#9a3412}',
    '.scr-note-h b{display:block;font-size:13px;color:#6b4423}',
    '.scr-note-h em{font-style:normal;margin-left:6px;font-size:10px;padding:1px 6px;border-radius:999px;background:#fdba74;color:#7c2d12}',
    '.scr-note-h small{display:block;font-size:10px;color:#a67c52;margin-top:2px}',
    '.scr-sec-tabs{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px}',
    '.scr-sec{appearance:none;border:1px dashed #d4b896;background:#faf3e8;color:#8b6914;font:inherit;font-size:10px;padding:3px 8px;cursor:pointer}',
    '.scr-sec.is-on{background:#fb923c;color:#fff7ed;border-style:solid;border-color:#c2410c}',
    '.scr-bars{display:flex;flex-direction:column;gap:5px}',
    '.scr-bar-row{display:grid;grid-template-columns:48px 1fr 36px;gap:6px;align-items:center;font-size:10px}',
    '.scr-bar-row span{color:#8b6914;font-weight:700}',
    '.scr-bar{height:6px;background:#f3e9d8;border-radius:999px;overflow:hidden}',
    '.scr-bar>i{display:block;height:100%;background:linear-gradient(90deg,#fb7185,#fbbf24,#86efac);border-radius:inherit}',
    '.scr-bar-row em,.scr-bar-row .zb-value{font-style:normal;text-align:right;color:#5c4033!important;font-weight:700}',
    '.scr-sticker{display:flex;justify-content:space-between;gap:8px;padding:6px 8px;margin-bottom:5px;background:#faf3e8;border:1px dashed #d4b896}',
    '.scr-sticker.scr-soft{border-style:solid}',
    '.scr-sticker-k{font-size:10px;color:#8b6914;font-weight:700}',
    '.scr-sticker-v,.scr-sticker-v .zb-value{font-size:11px;color:#5c4033!important}',
    '.scr-fruit{text-align:center;letter-spacing:10px;font-size:14px;opacity:.8}',
    '.scr-qe{margin-top:10px;padding-top:8px;border-top:1px solid rgba(127,127,127,.28)}',
    '.scr-qe-h{font-size:10px;letter-spacing:.12em;opacity:.7;margin-bottom:6px}',
    '.scr-qe-rail{display:flex;flex-wrap:wrap;gap:6px}',
    '.scr-qe-chip{font-size:10px;padding:3px 8px;border:1px solid rgba(127,127,127,.35);border-radius:4px}',
  ].join('');
}
