/**
 * 手帐拼贴（单人）—— 拍立得 + 贴纸；分区 Tab：此刻/关系/随身/记事/属性（按有数据动态出现）
 */
import { escHtml, guessPct, bucketPaths, makeCtx, ensureCoverage } from './shared.mjs';

export const meta = {
  id: 'scrapbook',
  label: '手帐拼贴',
  cast: 'single',
  family: 'scrap',
  blurb: '拍立得+贴纸 · 分区 Tab（此刻/关系/随身/记事/属性）',
  accent: '#c4a574',
};

function stickerRow(p, ctx, soft) {
  var pct = guessPct(ctx.plain(p));
  return '<div class="scr-sticker' + (soft ? ' scr-soft' : '') + '"><span class="scr-sticker-k">'
    + escHtml(p.label) + '</span><span class="scr-sticker-v">' + ctx.val(p) + '</span>'
    + (soft ? '' : '<span class="scr-dot" style="width:' + Math.max(8, pct * 0.2) + 'px"></span>')
    + '</div>';
}

function paneHtml(id, label, rows, active) {
  if (!rows) return '';
  return '<div class="scr-pane" data-pane="' + id + '"' + (active ? '' : ' hidden') + '>'
    + '<div class="scr-pane-lab">' + escHtml(label) + '</div>' + rows + '</div>';
}

/** @param {object} opts */
export function render(opts) {
  var paths = Array.isArray(opts && opts.paths) ? opts.paths : [];
  if (!paths.length) return '<div class="scr-empty">暂无手帐内容</div>';
  var ctx = makeCtx(opts.valueFn, !!(opts && opts.rawValueHtml));
  var b = bucketPaths(paths);
  var main = String((opts && opts.mainName) || '主角');
  var metaLine = b.meta.map(function(p) { return escHtml(ctx.plain(p)); }).filter(Boolean).join(' · ') || '今日手帐';

  // 按业务语义拆 Tab 内容（有数据才出签）
  var nowList = b.meta.concat(b.narrative.filter(function(p) {
    return /情绪|行动|着装|心情|状态/.test((p.label || '') + (p.path || ''));
  }));
  var relList = b.meters.filter(function(p) {
    return /好感|信任|亲密|关系/.test((p.label || '') + (p.path || ''));
  }).concat(b.narrative.filter(function(p) {
    return /关系|阶段/.test((p.label || '') + (p.path || ''));
  }));
  var bagList = b.items.slice();
  var noteList = b.nsfw.concat(b.narrative.filter(function(p) {
    return /记忆|内心|记事|事件|任务/.test((p.label || '') + (p.path || ''));
  }));
  var attrList = b.attr.concat(b.meters.filter(function(p) {
    return !/好感|信任|亲密|关系/.test((p.label || '') + (p.path || ''));
  }));

  // 兜底：未入任何 Tab 的字段并入属性
  ensureCoverage(paths, nowList.concat(relList).concat(bagList).concat(noteList).concat(attrList)).forEach(function(p) {
    attrList.push(p);
  });

  var tabs = [];
  if (nowList.length) tabs.push({ id: 'now', lab: '此刻' });
  if (relList.length) tabs.push({ id: 'rel', lab: '关系' });
  if (bagList.length) tabs.push({ id: 'bag', lab: '随身' });
  if (noteList.length) tabs.push({ id: 'note', lab: '记事' });
  if (attrList.length) tabs.push({ id: 'attr', lab: '属性' });
  if (!tabs.length) tabs.push({ id: 'attr', lab: '属性' });

  var h = '<div class="scr-page">';
  h += '<div class="scr-clip" aria-hidden="true"></div>';
  h += '<div class="scr-card">';
  h += '<div class="scr-head"><span class="scr-title">第 #1 页</span>'
    + '<span class="scr-date">' + metaLine + '</span></div>';

  h += '<div class="scr-body">';
  h += '<div class="scr-polaroid"><div class="scr-polaroid-in">'
    + '<div class="scr-avatar">' + escHtml(main.slice(0, 1)) + '</div>'
    + '<div class="scr-avatar-name">' + escHtml(main) + '</div>'
    + '</div><div class="scr-polaroid-cap">Life is short · write it</div></div>';

  h += '<div class="scr-right">';
  h += '<div class="scr-tabs" role="tablist">';
  tabs.forEach(function(t, i) {
    h += '<button type="button" class="scr-tab' + (i === 0 ? ' is-on' : '')
      + '" data-tab="' + t.id + '" role="tab">' + escHtml(t.lab) + '</button>';
  });
  h += '</div><div class="scr-panes">';

  var first = tabs[0].id;
  if (nowList.length) {
    h += paneHtml('now', '此刻', nowList.map(function(p) { return stickerRow(p, ctx, true); }).join(''), first === 'now');
  }
  if (relList.length) {
    h += paneHtml('rel', '关系', relList.map(function(p) { return stickerRow(p, ctx, false); }).join(''), first === 'rel');
  }
  if (bagList.length) {
    h += paneHtml('bag', '随身', bagList.map(function(p) { return stickerRow(p, ctx, true); }).join(''), first === 'bag');
  }
  if (noteList.length) {
    h += paneHtml('note', '记事', noteList.map(function(p) { return stickerRow(p, ctx, true); }).join(''), first === 'note');
  }
  if (attrList.length || !nowList.length) {
    var alist = attrList.length ? attrList : b.attr.concat(b.meters);
    h += paneHtml('attr', '属性', alist.map(function(p) { return stickerRow(p, ctx, false); }).join(''), first === 'attr');
  }
  h += '</div></div></div>';

  h += '<div class="scr-washi" aria-hidden="true"><span>✧ Sprinkle joy on your words ✧</span></div>';
  h += '<div class="scr-fruit" aria-hidden="true">🍓 🍋 🫐</div>';
  h += '</div></div>';

  // 预览内 Tab 切换
  h += '<script>(function(){var root=document.currentScript&&document.currentScript.previousElementSibling;'
    + 'if(!root||!root.classList||!root.classList.contains("scr-page")){'
    + 'root=document.querySelector(".zb-root .scr-page");}'
    + 'if(!root)return;var tabs=root.querySelectorAll(".scr-tab");var panes=root.querySelectorAll(".scr-pane");'
    + 'tabs.forEach(function(btn){btn.addEventListener("click",function(){'
    + 'var id=btn.getAttribute("data-tab");'
    + 'tabs.forEach(function(t){t.classList.toggle("is-on",t===btn);});'
    + 'panes.forEach(function(p){p.hidden=p.getAttribute("data-pane")!==id;});'
    + '});});})();</script>';
  return h;
}

export function css() {
  return [
    '.zb-root{box-sizing:border-box;width:100%;max-width:720px;margin:0 auto;padding:18px 14px 14px;font-family:Georgia,"Songti SC","Microsoft YaHei",serif;font-size:12px;line-height:1.5;color:#5c4033;background:radial-gradient(circle at 20% 0%,#fce7f3 0%,transparent 40%),radial-gradient(circle at 90% 20%,#fef3c7 0%,transparent 35%),#faf3e8}',
    '.zb-root *,.zb-root *:before,.zb-root *:after{box-sizing:border-box}',
    '.scr-empty{padding:24px;text-align:center;opacity:.5}',
    '.scr-page{position:relative;padding-top:10px}',
    '.scr-clip{position:absolute;top:-2px;left:50%;transform:translateX(-50%);width:36px;height:18px;background:linear-gradient(180deg,#e8c547,#b8956a);border-radius:3px 3px 2px 2px;box-shadow:0 3px 6px rgba(0,0,0,.2);z-index:3}',
    '.scr-clip:after{content:"";position:absolute;left:50%;top:6px;transform:translateX(-50%);width:10px;height:10px;border-radius:50%;background:#6b4423;box-shadow:inset 0 1px 2px rgba(255,255,255,.3)}',
    '.scr-card{position:relative;background:#fffef8;border:1px solid #e8d5b7;border-radius:4px;padding:16px 14px 12px;box-shadow:4px 6px 0 rgba(196,165,116,.2),0 8px 24px rgba(92,64,51,.08);transform:rotate(-0.4deg)}',
    '.scr-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin:8px 0 14px}',
    '.scr-title{font-size:1.05rem;font-weight:800;color:#6b4423;letter-spacing:.04em}',
    '.scr-date{font-size:10px;color:#a67c52;font-style:italic}',
    '.scr-body{display:grid;grid-template-columns:120px 1fr;gap:14px;align-items:start}',
    '.scr-polaroid{background:#fff;padding:8px 8px 20px;border:1px solid #e8d5b7;box-shadow:2px 3px 0 rgba(0,0,0,.06);transform:rotate(-2deg)}',
    '.scr-polaroid-in{aspect-ratio:1;background:linear-gradient(145deg,#fce7f3,#fef3c7 50%,#e0f2fe);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}',
    '.scr-avatar{width:42px;height:42px;border-radius:50%;background:#c4a574;color:#fffef8;display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:800;box-shadow:0 2px 0 #a67c52}',
    '.scr-avatar-name{font-size:11px;font-weight:700;color:#5c4033}',
    '.scr-polaroid-cap{margin-top:8px;font-size:9px;font-family:cursive,Georgia,serif;color:#a67c52;text-align:center;font-style:italic}',
    '.scr-right{min-width:0;display:flex;flex-direction:column;gap:8px}',
    '.scr-tabs{display:flex;flex-wrap:wrap;gap:4px}',
    '.scr-tab{appearance:none;border:1px dashed #d4b896;background:#faf3e8;color:#8b6914;font:inherit;font-size:10px;font-weight:700;padding:4px 10px;border-radius:2px;cursor:pointer}',
    '.scr-tab.is-on{background:#c4a574;color:#fffef8;border-style:solid;border-color:#a67c52}',
    '.scr-panes{min-height:80px}',
    '.scr-pane-lab{font-size:9px;letter-spacing:.15em;color:#a67c52;margin-bottom:6px}',
    '.scr-sticker{position:relative;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 10px;margin-bottom:6px;background:#faf3e8;border:1px dashed #d4b896;border-radius:2px;box-shadow:1px 1px 0 rgba(196,165,116,.25)}',
    '.scr-sticker.scr-soft{background:#fff7ed;border-style:solid;border-color:#f3e9d8}',
    '.scr-sticker-k{font-size:10px;color:#8b6914;font-weight:700;white-space:nowrap}',
    '.scr-sticker-v,.scr-sticker-v .zb-value{font-size:11px;color:#5c4033!important;font-weight:600;text-align:right;min-width:0}',
    '.scr-dot{display:inline-block;height:6px;border-radius:999px;background:linear-gradient(90deg,#fb7185,#fbbf24);margin-left:4px;flex:0 0 auto}',
    '.scr-washi{margin:14px -6px;padding:6px 0;text-align:center;background:repeating-linear-gradient(90deg,#86efac,#86efac 10px,#fff 10px,#fff 20px);border-top:1px solid rgba(134,239,172,.5);border-bottom:1px solid rgba(134,239,172,.5);transform:rotate(0.6deg)}',
    '.scr-washi span{display:inline-block;padding:2px 10px;background:rgba(255,255,255,.85);font-size:9px;letter-spacing:.08em;color:#3f6212;font-style:italic}',
    '.scr-fruit{margin-top:10px;text-align:center;font-size:14px;letter-spacing:8px;opacity:.85}',
    '@media(max-width:420px){.scr-body{grid-template-columns:1fr}.scr-polaroid{max-width:160px;margin:0 auto}}',
  ].join('');
}
