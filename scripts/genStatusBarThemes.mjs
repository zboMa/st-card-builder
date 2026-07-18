/**
 * 生成 28 套状态栏主题（一主题一文件，结构按 kind 差异化）
 * 用法：node scripts/genStatusBarThemes.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/lib/statusBarThemes');

const HDR = `import { escHtml, escAttr, guessPct, bucketPaths, makeCtx } from './shared.mjs';

function bar(pct) {
  return '<div class="zb-bar" style="--zb-pct:' + (pct != null ? pct : 55) + '%"><i></i></div>';
}
`;

/** 各结构 kind 的 render 函数体（接收 b,ctx,title,mainName,main,cast） */
const KINDS = {
  // 三列属性卡
  attr_grid: `
  var meters = b.meters.concat(b.attr);
  var cells = b.narrative.concat(b.items).slice(0, 4);
  var pills = b.narrative.filter(function(p) { return /情绪|关系|阶段|行动/.test(p.label || ''); }).slice(0, 4);
  var h = '<div class="zb-t"><div class="zb-t-head"><span class="zb-t-cap">' + escHtml(title) + '</span>';
  if (b.meta.length) h += '<div class="zb-t-meta">' + b.meta.map(function(p) {
    return '<span><b>' + escHtml(p.label) + '</b>' + ctx.val(p) + '</span>';
  }).join('') + '</div>';
  h += '</div><div class="zb-t-hero"><div class="zb-t-name">' + escHtml(mainName || '角色') + '</div>';
  if (pills.length) h += '<div class="zb-t-pills">' + pills.map(function(p) {
    return '<span class="zb-pill">' + escHtml(p.label) + '<em>' + escHtml(ctx.plain(p)) + '</em></span>';
  }).join('') + '</div>';
  h += '</div>';
  var take = (meters.length ? meters : b.narrative).slice(0, 6);
  if (take.length) h += '<div class="zb-attr-grid">' + take.map(function(p) {
    return '<div class="zb-attr-box"><div class="zb-attr-val">' + ctx.val(p)
      + '</div><div class="zb-attr-lab">' + escHtml(p.label) + '</div>' + bar(guessPct(ctx.plain(p))) + '</div>';
  }).join('') + '</div>';
  if (cells.length) h += sec('状态', cellGrid(cells, ctx));
  if (b.nsfw.length) h += sec('亲密', cellGrid(b.nsfw.slice(0, 4), ctx));
  return h + '</div>';
`,
  // 多人：角色轨 + 三列
  cast_attr: `
  var h = '<div class="zb-t">' + castRail(cast, main);
  h += '<div class="zb-t-head"><span class="zb-t-name">' + escHtml(main) + '</span>';
  if (b.meta.length) h += '<div class="zb-t-meta">' + b.meta.map(function(p) {
    return '<span><b>' + escHtml(p.label) + '</b>' + ctx.val(p) + '</span>';
  }).join('') + '</div>';
  h += '</div>';
  var meters = b.meters.concat(b.attr).slice(0, 6);
  if (meters.length) h += '<div class="zb-attr-grid">' + meters.map(function(p) {
    return '<div class="zb-attr-box"><div class="zb-attr-val">' + ctx.val(p)
      + '</div><div class="zb-attr-lab">' + escHtml(p.label) + '</div>' + bar(guessPct(ctx.plain(p))) + '</div>';
  }).join('') + '</div>';
  var cells = b.narrative.concat(b.items).slice(0, 4);
  if (cells.length) h += cellGrid(cells, ctx);
  if (b.nsfw.length) h += sec('亲密', cellGrid(b.nsfw.slice(0, 4), ctx));
  return h + '</div>';
`,
  // 霓虹顶栏 + 2×2
  neon_top: `
  var focus = b.meters[0] || b.attr[0] || b.narrative[0];
  var cellsSrc = b.narrative.concat(b.attr).concat(b.items);
  var h = '';
  if (b.meta.length) h += '<div class="zb-t-meta">' + b.meta.map(function(p) {
    return '<span><b>' + escHtml(p.label) + '</b>' + ctx.val(p) + '</span>';
  }).join('') + '</div>';
  h += '<div class="zb-neon-top"><div class="zb-neon-name">' + escHtml(mainName || title) + '</div>';
  if (focus) h += '<div class="zb-neon-gauge"><div class="zb-meter-row"><span>' + escHtml(focus.label)
    + '</span>' + bar(guessPct(ctx.plain(focus))) + '<span>' + ctx.val(focus) + '</span></div></div>';
  h += '</div>' + cellGrid(cellsSrc.slice(0, 4), ctx);
  if (b.nsfw.length) h += cellGrid(b.nsfw.slice(0, 4), ctx);
  var chips = b.items.slice(0, 3);
  if (chips.length) h += '<div class="zb-chip-rail">' + chips.map(function(p) {
    return '<span class="zb-chip">' + escHtml(ctx.plain(p)) + '</span>';
  }).join('') + '</div>';
  var rest = b.meters.slice(focus ? 1 : 0, 4);
  if (rest.length) h += '<div class="zb-meters">' + rest.map(function(p) {
    return '<div class="zb-meter-row"><span class="zb-meter-lab">' + escHtml(p.label) + '</span>'
      + bar(guessPct(ctx.plain(p))) + '<span class="zb-meter-val">' + ctx.val(p) + '</span></div>';
  }).join('') + '</div>';
  return '<div class="zb-t">' + h + '</div>';
`,
  // 赛博群像：等宽轨 + HUD
  cyber_rail: `
  var h = '<div class="zb-t"><div class="zb-cyber-rail">' + cast.map(function(c) {
    return '<span class="zb-cyber-id' + (c.name === main ? ' is-on' : '') + '">[' + escHtml(c.name) + ']</span>';
  }).join('') + '</div>';
  h += '<div class="zb-cyber-cap">// UNIT · ' + escHtml(main) + '</div>';
  if (b.meta.length) h += '<div class="zb-t-meta">' + b.meta.map(function(p) {
    return '<span><b>' + escHtml(p.label) + '</b>' + ctx.val(p) + '</span>';
  }).join('') + '</div>';
  var hud = b.meters.concat(b.attr).slice(0, 4);
  if (hud.length) h += '<div class="zb-hud-strip">' + hud.map(function(p) {
    return '<div class="zb-hud-m"><span class="zb-hud-k">' + escHtml(p.label) + '</span><span class="zb-hud-v">'
      + ctx.val(p) + '</span>' + bar(guessPct(ctx.plain(p))) + '</div>';
  }).join('') + '</div>';
  var cells = b.narrative.concat(b.items).slice(0, 4);
  if (cells.length) h += cellGrid(cells, ctx);
  if (b.nsfw.length) h += sec('BIO', gutter(b.nsfw, ctx));
  return h + '</div>';
`,
  // 分区 gutter
  form_gutter: `
  var blocks = [['时空', b.meta], ['关系与状态', b.meters.concat(b.narrative)], ['事务', b.items.concat(b.attr)], ['亲密', b.nsfw]];
  var h = '<div class="zb-t"><div class="zb-t-head"><span class="zb-t-cap">' + escHtml(title)
    + '</span><span class="zb-t-sub">' + escHtml(mainName || '') + '</span></div>';
  blocks.forEach(function(pair) {
    if (!pair[1].length) return;
    h += sec(pair[0], gutter(pair[1], ctx));
  });
  return h + '</div>';
`,
  // 古书群像：金线 Tab + 引用条
  gold_tabs: `
  var h = '<div class="zb-t"><div class="zb-lib-tabs">' + cast.map(function(c) {
    return '<span class="zb-lib-tab' + (c.name === main ? ' is-on' : '') + '">' + escHtml(c.name) + '</span>';
  }).join('') + '</div>';
  if (b.meta.length) h += '<div class="zb-lib-quote">' + b.meta.map(function(p) {
    return escHtml(p.label) + ' · ' + escHtml(ctx.plain(p));
  }).join('　') + '</div>';
  h += sec('卷册', gutter(b.meters.concat(b.narrative), ctx));
  if (b.items.concat(b.attr).length) h += sec('附录', gutter(b.items.concat(b.attr), ctx));
  if (b.nsfw.length) h += sec('密笺', gutter(b.nsfw, ctx));
  return h + '</div>';
`,
  // 恋爱柔光卡片墙
  romance_cards: `
  var rel = b.meters.slice(0, 3);
  var cells = b.narrative.concat(b.items).slice(0, 4);
  var h = '<div class="zb-t"><div class="zb-rom-head"><div class="zb-t-name">' + escHtml(mainName || '角色')
    + '</div><div class="zb-rom-tag">' + escHtml(title) + '</div></div>';
  if (b.meta.length) h += '<div class="zb-t-meta">' + b.meta.map(function(p) {
    return '<span><b>' + escHtml(p.label) + '</b>' + ctx.val(p) + '</span>';
  }).join('') + '</div>';
  if (rel.length) h += '<div class="zb-rom-meters">' + rel.map(function(p) {
    return '<div class="zb-meter-row"><span class="zb-meter-lab">' + escHtml(p.label) + '</span>'
      + bar(guessPct(ctx.plain(p))) + '<span class="zb-meter-val">' + ctx.val(p) + '</span></div>';
  }).join('') + '</div>';
  if (cells.length) h += cellGrid(cells, ctx);
  if (b.nsfw.length) h += sec('心意', cellGrid(b.nsfw.slice(0, 4), ctx));
  if (b.attr.length) h += '<div class="zb-attr-grid">' + b.attr.slice(0, 3).map(function(p) {
    return '<div class="zb-attr-box"><div class="zb-attr-val">' + ctx.val(p)
      + '</div><div class="zb-attr-lab">' + escHtml(p.label) + '</div></div>';
  }).join('') + '</div>';
  return h + '</div>';
`,
  // 粉璃群像 Tab
  glass_tabs: `
  var h = '<div class="zb-t"><div class="zb-tab-rail">' + cast.map(function(c) {
    return '<span class="zb-tab' + (c.name === main ? ' is-on' : '') + '">' + escHtml(c.name) + '</span>';
  }).join('') + '</div>';
  if (b.meta.length) h += '<div class="zb-t-meta">' + b.meta.map(function(p) {
    return '<span><b>' + escHtml(p.label) + '</b>' + ctx.val(p) + '</span>';
  }).join('') + '</div>';
  h += sec('状态', gutter(b.meters.concat(b.narrative), ctx));
  if (b.items.concat(b.attr).length) h += sec('事务', gutter(b.items.concat(b.attr), ctx));
  if (b.nsfw.length) h += sec('亲密', gutter(b.nsfw, ctx));
  return h + '</div>';
`,
  // 仙侠卷轴
  scroll: `
  var h = '<div class="zb-t zb-scroll-frame"><div class="zb-scroll-title">' + escHtml(title) + ' · '
    + escHtml(mainName || '修士') + '</div>';
  if (b.meta.length) h += '<div class="zb-t-meta">' + b.meta.map(function(p) {
    return '<span><b>' + escHtml(p.label) + '</b>' + ctx.val(p) + '</span>';
  }).join('') + '</div>';
  h += sec('修为', '<div class="zb-attr-grid">' + b.meters.concat(b.attr).slice(0, 6).map(function(p) {
    return '<div class="zb-attr-box"><div class="zb-attr-val">' + ctx.val(p)
      + '</div><div class="zb-attr-lab">' + escHtml(p.label) + '</div>' + bar(guessPct(ctx.plain(p))) + '</div>';
  }).join('') + '</div>');
  if (b.narrative.concat(b.items).length) h += sec('行止', gutter(b.narrative.concat(b.items), ctx));
  if (b.nsfw.length) h += sec('隐秘', cellGrid(b.nsfw.slice(0, 4), ctx));
  return h + '</div>';
`,
  // 仙侠同门：竖列金边
  ink_cast: `
  var h = '<div class="zb-t zb-xx"><div class="zb-xx-side">' + cast.map(function(c) {
    return '<span class="zb-xx-chip' + (c.name === main ? ' is-on' : '') + '">' + escHtml(c.name) + '</span>';
  }).join('') + '</div><div class="zb-xx-main">';
  h += '<div class="zb-scroll-title">' + escHtml(main) + '</div>';
  if (b.meta.length) h += '<div class="zb-t-meta">' + b.meta.map(function(p) {
    return '<span><b>' + escHtml(p.label) + '</b>' + ctx.val(p) + '</span>';
  }).join('') + '</div>';
  var meters = b.meters.concat(b.attr).slice(0, 4);
  if (meters.length) h += '<div class="zb-attr-grid">' + meters.map(function(p) {
    return '<div class="zb-attr-box"><div class="zb-attr-val">' + ctx.val(p)
      + '</div><div class="zb-attr-lab">' + escHtml(p.label) + '</div></div>';
  }).join('') + '</div>';
  if (b.narrative.concat(b.items).length) h += gutter(b.narrative.concat(b.items).slice(0, 6), ctx);
  if (b.nsfw.length) h += sec('隐秘', cellGrid(b.nsfw.slice(0, 4), ctx));
  return h + '</div></div>';
`,
  // 科幻 HUD
  hud_strip: `
  var hud = b.meters.concat(b.attr).slice(0, 4);
  var h = '<div class="zb-t"><div class="zb-hud-cap">//' + escHtml(title) + ' · ' + escHtml(mainName || 'UNIT') + '</div>';
  if (b.meta.length) h += '<div class="zb-t-meta">' + b.meta.map(function(p) {
    return '<span><b>' + escHtml(p.label) + '</b>' + ctx.val(p) + '</span>';
  }).join('') + '</div>';
  if (hud.length) h += '<div class="zb-hud-strip">' + hud.map(function(p) {
    return '<div class="zb-hud-m"><span class="zb-hud-k">' + escHtml(p.label) + '</span><span class="zb-hud-v">'
      + ctx.val(p) + '</span>' + bar(guessPct(ctx.plain(p))) + '</div>';
  }).join('') + '</div>';
  if (b.narrative.concat(b.items).length) h += cellGrid(b.narrative.concat(b.items).slice(0, 4), ctx);
  if (b.nsfw.length) h += sec('BIO', gutter(b.nsfw, ctx));
  return h + '</div>';
`,
  // 编队 HUD
  squad_hud: `
  var h = '<div class="zb-t"><div class="zb-squad">' + cast.map(function(c) {
    return '<span class="zb-squad-u' + (c.name === main ? ' is-on' : '') + '">' + escHtml(c.name) + '</span>';
  }).join('') + '</div>';
  h += '<div class="zb-hud-cap">// SQUAD · ' + escHtml(main) + '</div>';
  if (b.meta.length) h += '<div class="zb-t-meta">' + b.meta.map(function(p) {
    return '<span><b>' + escHtml(p.label) + '</b>' + ctx.val(p) + '</span>';
  }).join('') + '</div>';
  var hud = b.meters.concat(b.attr).slice(0, 4);
  if (hud.length) h += '<div class="zb-hud-strip">' + hud.map(function(p) {
    return '<div class="zb-hud-m"><span class="zb-hud-k">' + escHtml(p.label) + '</span><span class="zb-hud-v">'
      + ctx.val(p) + '</span>' + bar(guessPct(ctx.plain(p))) + '</div>';
  }).join('') + '</div>';
  if (b.narrative.concat(b.items).length) h += cellGrid(b.narrative.concat(b.items).slice(0, 4), ctx);
  if (b.nsfw.length) h += sec('BIO', gutter(b.nsfw, ctx));
  return h + '</div>';
`,
  // 水墨留白
  ink_vert: `
  var h = '<div class="zb-t"><div class="zb-ink-title">' + escHtml(mainName || title) + '</div>';
  if (b.meta.length) h += '<div class="zb-t-meta">' + b.meta.map(function(p) {
    return '<span><b>' + escHtml(p.label) + '</b>' + ctx.val(p) + '</span>';
  }).join('') + '</div>';
  if (b.meters.length) h += sec('气色', b.meters.slice(0, 4).map(function(p) {
    return '<div class="zb-meter-row"><span class="zb-meter-lab">' + escHtml(p.label) + '</span>'
      + bar(guessPct(ctx.plain(p))) + '<span class="zb-meter-val">' + ctx.val(p) + '</span></div>';
  }).join(''));
  if (b.narrative.concat(b.items).length) h += sec('近况', cellGrid(b.narrative.concat(b.items).slice(0, 4), ctx));
  if (b.attr.length) h += sec('杂项', gutter(b.attr, ctx));
  if (b.nsfw.length) h += sec('私密', cellGrid(b.nsfw.slice(0, 4), ctx));
  return h + '</div>';
`,
  // 水墨群像折叠
  ink_fold: `
  var h = '<div class="zb-t">';
  if (b.meta.length) h += '<div class="zb-t-meta">' + b.meta.map(function(p) {
    return '<span><b>' + escHtml(p.label) + '</b>' + ctx.val(p) + '</span>';
  }).join('') + '</div>';
  cast.forEach(function(c) {
    var open = c.name === main ? ' open' : '';
    var body = c.name === main
      ? (b.meters.slice(0, 3).map(function(p) {
          return '<div class="zb-meter-row"><span class="zb-meter-lab">' + escHtml(p.label) + '</span>'
            + bar(guessPct(ctx.plain(p))) + '<span class="zb-meter-val">' + ctx.val(p) + '</span></div>';
        }).join('') + cellGrid(b.narrative.concat(b.items).slice(0, 4), ctx)
        + (b.nsfw.length ? cellGrid(b.nsfw.slice(0, 2), ctx) : ''))
      : '<div class="zb-fold-hint">切换为主视角后展示详情</div>';
    h += '<details class="zb-fold"' + open + '><summary>' + escHtml(c.name)
      + (c.name === main ? ' ·主' : '') + '</summary>' + body + '</details>';
  });
  return h + '</div>';
`,
  // 毛玻璃蓝（单人）
  frost_soft: `
  var h = '<div class="zb-t"><div class="zb-frost-hero"><div class="zb-t-name">' + escHtml(mainName || '角色')
    + '</div><div class="zb-frost-cap">' + escHtml(title) + '</div></div>';
  if (b.meta.length) h += '<div class="zb-frost-pills">' + b.meta.map(function(p) {
    return '<span class="zb-fpill"><b>' + escHtml(p.label) + '</b>' + ctx.val(p) + '</span>';
  }).join('') + '</div>';
  if (b.meters.length) h += '<div class="zb-meters">' + b.meters.slice(0, 4).map(function(p) {
    return '<div class="zb-meter-row"><span class="zb-meter-lab">' + escHtml(p.label) + '</span>'
      + bar(guessPct(ctx.plain(p))) + '<span class="zb-meter-val">' + ctx.val(p) + '</span></div>';
  }).join('') + '</div>';
  if (b.narrative.concat(b.items).length) h += cellGrid(b.narrative.concat(b.items).slice(0, 4), ctx);
  if (b.nsfw.length) h += sec('私密', cellGrid(b.nsfw.slice(0, 4), ctx));
  return h + '</div>';
`,
  // 毛玻璃群像 pill（替代旧 multi_pill_sheet）
  frost_pills: `
  var h = '<div class="zb-t"><div class="zb-pill-rail">' + cast.map(function(c) {
    return '<span class="zb-pill' + (c.name === main ? ' is-on' : '') + '">' + escHtml(c.name) + '</span>';
  }).join('') + '</div>';
  h += '<div class="zb-t-head"><span class="zb-t-name">' + escHtml(main) + '</span>';
  if (b.meta.length) h += '<div class="zb-t-meta">' + b.meta.map(function(p) {
    return '<span><b>' + escHtml(p.label) + '</b>' + ctx.val(p) + '</span>';
  }).join('') + '</div>';
  h += '</div>';
  var meters = b.meters.concat(b.attr).slice(0, 6);
  if (meters.length) h += '<div class="zb-attr-grid">' + meters.map(function(p) {
    return '<div class="zb-attr-box"><div class="zb-attr-val">' + ctx.val(p)
      + '</div><div class="zb-attr-lab">' + escHtml(p.label) + '</div>' + bar(guessPct(ctx.plain(p))) + '</div>';
  }).join('') + '</div>';
  if (b.narrative.concat(b.items).length) h += cellGrid(b.narrative.concat(b.items).slice(0, 4), ctx);
  if (b.meters.length) h += '<div class="zb-meters">' + b.meters.slice(0, 3).map(function(p) {
    return '<div class="zb-meter-row"><span class="zb-meter-lab">' + escHtml(p.label) + '</span>'
      + bar(guessPct(ctx.plain(p))) + '<span class="zb-meter-val">' + ctx.val(p) + '</span></div>';
  }).join('') + '</div>';
  if (b.nsfw.length) h += sec('亲密', cellGrid(b.nsfw.slice(0, 4), ctx));
  return h + '</div>';
`,
  // 甜齿粉雾
  sweet_soft: `
  var h = '<div class="zb-t"><div class="zb-sweet-head"><div class="zb-t-name">' + escHtml(mainName || '角色')
    + '</div><span class="zb-sweet-badge">' + escHtml(title) + '</span></div>';
  if (b.meta.length) h += '<div class="zb-t-meta">' + b.meta.map(function(p) {
    return '<span><b>' + escHtml(p.label) + '</b>' + ctx.val(p) + '</span>';
  }).join('') + '</div>';
  if (b.meters.length) h += '<div class="zb-sweet-meters">' + b.meters.slice(0, 3).map(function(p) {
    return '<div class="zb-sweet-m"><div class="zb-sweet-ml">' + escHtml(p.label) + '</div>'
      + bar(guessPct(ctx.plain(p))) + '<div class="zb-sweet-mv">' + ctx.val(p) + '</div></div>';
  }).join('') + '</div>';
  if (b.narrative.concat(b.items).length) h += cellGrid(b.narrative.concat(b.items).slice(0, 4), ctx);
  if (b.nsfw.length) h += sec('悄悄话', cellGrid(b.nsfw.slice(0, 4), ctx));
  return h + '</div>';
`,
  sweet_pills: `
  var h = '<div class="zb-t"><div class="zb-pill-rail">' + cast.map(function(c) {
    return '<span class="zb-pill' + (c.name === main ? ' is-on' : '') + '">' + escHtml(c.name) + '</span>';
  }).join('') + '</div>';
  h += '<div class="zb-sweet-head"><div class="zb-t-name">' + escHtml(main) + '</div></div>';
  if (b.meta.length) h += '<div class="zb-t-meta">' + b.meta.map(function(p) {
    return '<span><b>' + escHtml(p.label) + '</b>' + ctx.val(p) + '</span>';
  }).join('') + '</div>';
  if (b.meters.length) h += '<div class="zb-sweet-meters">' + b.meters.slice(0, 3).map(function(p) {
    return '<div class="zb-sweet-m"><div class="zb-sweet-ml">' + escHtml(p.label) + '</div>'
      + bar(guessPct(ctx.plain(p))) + '<div class="zb-sweet-mv">' + ctx.val(p) + '</div></div>';
  }).join('') + '</div>';
  if (b.narrative.concat(b.items).length) h += cellGrid(b.narrative.concat(b.items).slice(0, 4), ctx);
  if (b.nsfw.length) h += sec('悄悄话', cellGrid(b.nsfw.slice(0, 4), ctx));
  return h + '</div>';
`,
  // 手帐水彩
  scrap: `
  var h = '<div class="zb-t zb-scrap"><div class="zb-scrap-clip"></div><div class="zb-scrap-title">'
    + escHtml(mainName || title) + '</div>';
  if (b.meta.length) h += '<div class="zb-scrap-tape">' + b.meta.map(function(p) {
    return '<span>' + escHtml(p.label) + ' ' + escHtml(ctx.plain(p)) + '</span>';
  }).join('') + '</div>';
  if (b.meters.length) h += '<div class="zb-scrap-note">' + b.meters.slice(0, 4).map(function(p) {
    return '<div class="zb-meter-row"><span class="zb-meter-lab">' + escHtml(p.label) + '</span>'
      + bar(guessPct(ctx.plain(p))) + '<span class="zb-meter-val">' + ctx.val(p) + '</span></div>';
  }).join('') + '</div>';
  if (b.narrative.concat(b.items).length) h += cellGrid(b.narrative.concat(b.items).slice(0, 4), ctx);
  if (b.nsfw.length) h += sec('贴纸', cellGrid(b.nsfw.slice(0, 4), ctx));
  return h + '</div>';
`,
  // 手帐群像嵌套（替代 multi_cast_nested）
  scrap_nest: `
  var others = cast.filter(function(c) { return c.name !== main; });
  var h = '<div class="zb-t"><div class="zb-nest-main"><div class="zb-t-name">' + escHtml(main)
    + '<em>主视角</em></div>';
  if (b.meta.length) h += '<div class="zb-t-meta">' + b.meta.map(function(p) {
    return '<span><b>' + escHtml(p.label) + '</b>' + ctx.val(p) + '</span>';
  }).join('') + '</div>';
  if (b.meters.length) h += b.meters.slice(0, 4).map(function(p) {
    return '<div class="zb-meter-row"><span class="zb-meter-lab">' + escHtml(p.label) + '</span>'
      + bar(guessPct(ctx.plain(p))) + '<span class="zb-meter-val">' + ctx.val(p) + '</span></div>';
  }).join('');
  if (b.narrative.concat(b.items).length) h += cellGrid(b.narrative.concat(b.items).slice(0, 4), ctx);
  if (b.nsfw.length) h += cellGrid(b.nsfw.slice(0, 4), ctx);
  h += '</div>';
  if (others.length) h += '<div class="zb-nest-rail">' + others.map(function(c) {
    return '<div class="zb-nest-chip"><b>' + escHtml(c.name) + '</b>'
      + (c.identity ? '<span>' + escHtml(c.identity) + '</span>' : '') + '</div>';
  }).join('') + '</div>';
  return h + '</div>';
`,
  // 冬雪冰晶
  snow_panel: `
  var h = '<div class="zb-t"><div class="zb-snow-cap">' + escHtml(title) + '</div><div class="zb-t-name">'
    + escHtml(mainName || '角色') + '</div>';
  if (b.meta.length) h += '<div class="zb-frost-pills">' + b.meta.map(function(p) {
    return '<span class="zb-fpill"><b>' + escHtml(p.label) + '</b>' + ctx.val(p) + '</span>';
  }).join('') + '</div>';
  if (b.meters.length) h += '<div class="zb-attr-grid">' + b.meters.slice(0, 3).map(function(p) {
    return '<div class="zb-attr-box"><div class="zb-attr-val">' + ctx.val(p)
      + '</div><div class="zb-attr-lab">' + escHtml(p.label) + '</div>' + bar(guessPct(ctx.plain(p))) + '</div>';
  }).join('') + '</div>';
  if (b.narrative.concat(b.items).length) h += cellGrid(b.narrative.concat(b.items).slice(0, 4), ctx);
  if (b.nsfw.length) h += sec('暖意', cellGrid(b.nsfw.slice(0, 4), ctx));
  return h + '</div>';
`,
  // 雪原群像侧栏（替代 multi_side_panel）
  snow_side: `
  var col = '<div class="zb-side-col">' + cast.map(function(c) {
    return '<span class="zb-side-chip' + (c.name === main ? ' is-on' : '') + '">' + escHtml(c.name) + '</span>';
  }).join('') + '</div>';
  var detail = '<div class="zb-side-main"><div class="zb-t-name">' + escHtml(main) + '</div>';
  if (b.meta.length) detail += '<div class="zb-t-meta">' + b.meta.map(function(p) {
    return '<span><b>' + escHtml(p.label) + '</b>' + ctx.val(p) + '</span>';
  }).join('') + '</div>';
  var meters = b.meters.concat(b.attr).slice(0, 3);
  if (meters.length) detail += '<div class="zb-attr-grid">' + meters.map(function(p) {
    return '<div class="zb-attr-box"><div class="zb-attr-val">' + ctx.val(p)
      + '</div><div class="zb-attr-lab">' + escHtml(p.label) + '</div></div>';
  }).join('') + '</div>';
  if (b.narrative.concat(b.items).length) detail += cellGrid(b.narrative.concat(b.items).slice(0, 4), ctx);
  if (b.meters.length) detail += b.meters.slice(0, 3).map(function(p) {
    return '<div class="zb-meter-row"><span class="zb-meter-lab">' + escHtml(p.label) + '</span>'
      + bar(guessPct(ctx.plain(p))) + '<span class="zb-meter-val">' + ctx.val(p) + '</span></div>';
  }).join('');
  if (b.nsfw.length) detail += cellGrid(b.nsfw.slice(0, 4), ctx);
  detail += '</div>';
  return '<div class="zb-t zb-side-layout">' + col + detail + '</div>';
`,
  // 绿野
  oz_moss: `
  var h = '<div class="zb-t"><div class="zb-oz-leaf"></div><div class="zb-t-name">' + escHtml(mainName || '角色')
    + '</div><div class="zb-oz-sub">' + escHtml(title) + '</div>';
  if (b.meta.length) h += '<div class="zb-t-meta">' + b.meta.map(function(p) {
    return '<span><b>' + escHtml(p.label) + '</b>' + ctx.val(p) + '</span>';
  }).join('') + '</div>';
  if (b.meters.length) h += '<div class="zb-meters">' + b.meters.slice(0, 4).map(function(p) {
    return '<div class="zb-meter-row"><span class="zb-meter-lab">' + escHtml(p.label) + '</span>'
      + bar(guessPct(ctx.plain(p))) + '<span class="zb-meter-val">' + ctx.val(p) + '</span></div>';
  }).join('') + '</div>';
  if (b.narrative.concat(b.items).length) h += cellGrid(b.narrative.concat(b.items).slice(0, 4), ctx);
  if (b.nsfw.length) h += sec('林间', cellGrid(b.nsfw.slice(0, 4), ctx));
  return h + '</div>';
`,
  // 绿野折叠（替代 multi_fold_elegant）
  oz_fold: `
  var h = '<div class="zb-t">';
  if (b.meta.length) h += '<div class="zb-t-meta">' + b.meta.map(function(p) {
    return '<span><b>' + escHtml(p.label) + '</b>' + ctx.val(p) + '</span>';
  }).join('') + '</div>';
  cast.forEach(function(c) {
    var open = c.name === main ? ' open' : '';
    var body = c.name === main
      ? ('<div class="zb-attr-grid">' + b.meters.concat(b.attr).slice(0, 6).map(function(p) {
          return '<div class="zb-attr-box"><div class="zb-attr-val">' + ctx.val(p)
            + '</div><div class="zb-attr-lab">' + escHtml(p.label) + '</div></div>';
        }).join('') + '</div>' + cellGrid(b.narrative.concat(b.items).slice(0, 4), ctx)
        + (b.nsfw.length ? gutter(b.nsfw, ctx) : ''))
      : '<div class="zb-fold-hint">切换为主视角后展示详情</div>';
    h += '<details class="zb-fold"' + open + '><summary>' + escHtml(c.name)
      + (c.name === main ? ' ·主' : '') + '</summary>' + body + '</details>';
  });
  return h + '</div>';
`,
  // 软紫
  lavender: `
  var h = '<div class="zb-t"><div class="zb-lav-star"></div><div class="zb-t-name">' + escHtml(mainName || '角色')
    + '</div><div class="zb-lav-tag">' + escHtml(title) + '</div>';
  if (b.meta.length) h += '<div class="zb-frost-pills">' + b.meta.map(function(p) {
    return '<span class="zb-fpill"><b>' + escHtml(p.label) + '</b>' + ctx.val(p) + '</span>';
  }).join('') + '</div>';
  if (b.meters.length) h += '<div class="zb-meters">' + b.meters.slice(0, 4).map(function(p) {
    return '<div class="zb-meter-row"><span class="zb-meter-lab">' + escHtml(p.label) + '</span>'
      + bar(guessPct(ctx.plain(p))) + '<span class="zb-meter-val">' + ctx.val(p) + '</span></div>';
  }).join('') + '</div>';
  if (b.narrative.concat(b.items).length) h += cellGrid(b.narrative.concat(b.items).slice(0, 4), ctx);
  if (b.nsfw.length) h += sec('星梦', cellGrid(b.nsfw.slice(0, 4), ctx));
  return h + '</div>';
`,
  lavender_tabs: `
  var h = '<div class="zb-t"><div class="zb-tab-rail">' + cast.map(function(c) {
    return '<span class="zb-tab' + (c.name === main ? ' is-on' : '') + '">' + escHtml(c.name) + '</span>';
  }).join('') + '</div>';
  h += '<div class="zb-t-name">' + escHtml(main) + '</div>';
  if (b.meta.length) h += '<div class="zb-t-meta">' + b.meta.map(function(p) {
    return '<span><b>' + escHtml(p.label) + '</b>' + ctx.val(p) + '</span>';
  }).join('') + '</div>';
  if (b.meters.length) h += '<div class="zb-meters">' + b.meters.slice(0, 4).map(function(p) {
    return '<div class="zb-meter-row"><span class="zb-meter-lab">' + escHtml(p.label) + '</span>'
      + bar(guessPct(ctx.plain(p))) + '<span class="zb-meter-val">' + ctx.val(p) + '</span></div>';
  }).join('') + '</div>';
  if (b.narrative.concat(b.items).length) h += cellGrid(b.narrative.concat(b.items).slice(0, 4), ctx);
  if (b.nsfw.length) h += sec('星梦', cellGrid(b.nsfw.slice(0, 4), ctx));
  return h + '</div>';
`,
};

const LOCAL_HELPERS = `
function sec(title, inner) {
  if (!inner) return '';
  return '<div class="zb-section"><div class="zb-section-h">' + escHtml(title) + '</div>' + inner + '</div>';
}
function cellGrid(list, ctx) {
  if (!list || !list.length) return '';
  return '<div class="zb-cell-grid">' + list.map(function(p) {
    return '<div class="zb-cell"><div class="zb-cell-k">' + escHtml(p.label) + '</div><div class="zb-cell-v">' + ctx.val(p) + '</div></div>';
  }).join('') + '</div>';
}
function gutter(list, ctx) {
  if (!list || !list.length) return '';
  return '<div class="zb-gutter">' + list.map(function(p) {
    return '<div class="zb-gutter-row"><div class="zb-gutter-k">' + escHtml(p.label)
      + '</div><div class="zb-gutter-v">' + ctx.val(p) + '</div></div>';
  }).join('') + '</div>';
}
function castRail(cast, main) {
  return '<div class="zb-cast-rail">' + cast.map(function(c) {
    return '<span class="zb-cast-chip' + (c.name === main ? ' is-on' : '') + '">' + escHtml(c.name) + '</span>';
  }).join('') + '</div>';
}
`;

/** 共用结构 CSS 片段（各主题复制进自己的 css，非 shared 运行时骨架） */
function structCss() {
  return `+ '.zb-t-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 10px;flex-wrap:wrap}'
  + '.zb-t-cap{font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;opacity:.75;font-weight:700}'
  + '.zb-t-sub{font-size:.72rem;opacity:.65}.zb-t-name{font-size:1.15rem;font-weight:800;letter-spacing:.02em}'
  + '.zb-t-name em{font-style:normal;margin-left:8px;font-size:.68rem;opacity:.55;font-weight:600}'
  + '.zb-t-meta{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:.72rem;margin:0 0 8px}'
  + '.zb-t-meta b{font-weight:600;opacity:.55;font-size:.62rem;margin-right:4px}'
  + '.zb-t-hero{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin:0 0 10px}'
  + '.zb-t-pills,.zb-pill-rail,.zb-chip-rail,.zb-tab-rail,.zb-cast-rail{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}'
  + '.zb-pill,.zb-chip,.zb-tab,.zb-cast-chip,.zb-fpill{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;font-size:.68rem;border:1px solid rgba(148,163,184,.35);line-height:1.3}'
  + '.zb-pill em{font-style:normal;opacity:.65}.zb-pill.is-on,.zb-tab.is-on,.zb-cast-chip.is-on,.zb-side-chip.is-on{font-weight:800}'
  + '.zb-tab{border-radius:8px}'
  + '.zb-attr-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0 0 10px}'
  + '.zb-attr-box{padding:8px;text-align:center;border-radius:10px}'
  + '.zb-attr-val{font-size:1.05rem;font-weight:800;line-height:1.15}.zb-attr-lab{font-size:.6rem;opacity:.6;margin-top:2px}'
  + '.zb-cell-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 10px}'
  + '.zb-cell{padding:8px 10px;border-radius:10px;min-height:52px}'
  + '.zb-cell-k{font-size:.62rem;opacity:.55;margin-bottom:3px;font-weight:600}.zb-cell-v{font-size:.82rem;font-weight:700;line-height:1.3}'
  + '.zb-gutter{display:flex;flex-direction:column;margin:0 0 4px}'
  + '.zb-gutter-row{display:grid;grid-template-columns:88px 1fr;gap:10px;align-items:center;padding:6px 0;border-bottom:1px solid rgba(148,163,184,.12)}'
  + '.zb-gutter-row:last-child{border-bottom:0}'
  + '.zb-gutter-k{font-size:.7rem;opacity:.65;font-weight:600}.zb-gutter-v{font-size:.82rem;font-weight:700;min-width:0}'
  + '.zb-meter-row{display:grid;grid-template-columns:64px 1fr 40px;gap:8px;align-items:center;padding:4px 0}'
  + '.zb-meter-lab{font-size:.68rem;opacity:.65;white-space:nowrap}.zb-meter-val{font-size:.78rem;font-weight:800;text-align:right}'
  + '.zb-section{margin:0 0 10px}.zb-section-h{font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;padding:5px 8px;margin:0 0 6px;border-radius:6px;font-weight:700}'
  + '.zb-neon-top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin:0 0 10px;padding:10px 12px;border-radius:12px}'
  + '.zb-neon-name{font-size:1.2rem;font-weight:800}.zb-neon-gauge{flex:1 1 160px;min-width:140px}'
  + '.zb-rom-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin:0 0 8px}'
  + '.zb-rom-tag{font-size:.62rem;letter-spacing:.16em;opacity:.55}.zb-rom-meters{margin:0 0 8px}'
  + '.zb-scroll-frame{padding:4px 2px}.zb-scroll-title{text-align:center;font-size:.95rem;font-weight:700;letter-spacing:.2em;margin:0 0 10px}'
  + '.zb-hud-cap{font-family:Consolas,monospace;font-size:.62rem;letter-spacing:.08em;opacity:.7;margin:0 0 8px}'
  + '.zb-hud-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:0 0 10px}'
  + '.zb-hud-m{padding:7px 6px;text-align:center;border-radius:6px}'
  + '.zb-hud-k{display:block;font-size:.58rem;opacity:.6;margin-bottom:2px}.zb-hud-v{font-size:.9rem;font-weight:800}'
  + '.zb-ink-title{font-size:1.25rem;font-weight:700;letter-spacing:.18em;margin:0 0 10px;text-align:center}'
  + '.zb-nest-main{padding:10px 12px;border-radius:12px;margin:0 0 8px}'
  + '.zb-nest-rail{display:flex;flex-wrap:wrap;gap:6px}'
  + '.zb-nest-chip{padding:6px 10px;border-radius:8px;font-size:.68rem;border:1px dashed rgba(148,163,184,.35)}'
  + '.zb-nest-chip b{display:block;font-size:.74rem;margin-bottom:2px}.zb-nest-chip span{opacity:.65}'
  + '.zb-side-layout{display:grid;grid-template-columns:78px 1fr;gap:10px;align-items:start}'
  + '.zb-side-col{display:flex;flex-direction:column;gap:5px}'
  + '.zb-side-chip{display:block;text-align:center;padding:8px 4px;border-radius:8px;font-size:.68rem;border:1px solid rgba(148,163,184,.3);opacity:.75}'
  + '.zb-side-main{min-width:0}'
  + '.zb-fold{margin:0 0 6px;border-radius:10px;padding:2px 10px 6px;border:1px solid rgba(148,163,184,.22)}'
  + '.zb-fold>summary{cursor:pointer;font-size:.78rem;font-weight:700;padding:7px 0;list-style:none}'
  + '.zb-fold>summary::-webkit-details-marker{display:none}'
  + '.zb-fold-hint{font-size:.72rem;opacity:.55;padding:4px 0 6px}'
  + '.zb-cyber-rail,.zb-squad{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px;font-family:Consolas,monospace}'
  + '.zb-cyber-id,.zb-squad-u{padding:4px 8px;border:1px solid rgba(148,163,184,.3);font-size:.68rem;opacity:.7}'
  + '.zb-cyber-id.is-on,.zb-squad-u.is-on{opacity:1;font-weight:800}'
  + '.zb-cyber-cap{font-family:Consolas,monospace;font-size:.62rem;opacity:.65;margin:0 0 8px}'
  + '.zb-lib-tabs{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px;border-bottom:1px solid rgba(201,164,106,.25);padding-bottom:8px}'
  + '.zb-lib-tab{padding:4px 10px;font-size:.74rem;opacity:.6}.zb-lib-tab.is-on{opacity:1;font-weight:700;border-bottom:2px solid currentColor}'
  + '.zb-lib-quote{padding:8px 12px;margin:0 0 10px;border-left:3px solid currentColor;font-size:.78rem;opacity:.9;font-style:italic}'
  + '.zb-xx{display:grid;grid-template-columns:72px 1fr;gap:10px}.zb-xx-side{display:flex;flex-direction:column;gap:5px}'
  + '.zb-xx-chip{display:block;text-align:center;padding:8px 4px;border-radius:4px;font-size:.68rem;border:1px solid rgba(251,191,36,.35);opacity:.7}'
  + '.zb-xx-chip.is-on{opacity:1;font-weight:800;border-color:currentColor}'
  + '.zb-frost-hero{margin:0 0 10px}.zb-frost-cap{font-size:.62rem;opacity:.55;letter-spacing:.12em;margin-top:4px}'
  + '.zb-frost-pills{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}'
  + '.zb-fpill{backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);background:rgba(255,255,255,.12)}'
  + '.zb-sweet-head{display:flex;align-items:center;gap:10px;margin:0 0 10px;flex-wrap:wrap}'
  + '.zb-sweet-badge{padding:3px 10px;border-radius:999px;font-size:.62rem;opacity:.8}'
  + '.zb-sweet-meters{display:flex;flex-direction:column;gap:8px;margin:0 0 10px}'
  + '.zb-sweet-m{padding:8px 10px;border-radius:14px}.zb-sweet-ml{font-size:.65rem;opacity:.6;margin-bottom:4px}.zb-sweet-mv{font-size:.85rem;font-weight:700;margin-top:4px}'
  + '.zb-scrap{position:relative;padding-top:8px}.zb-scrap-clip{position:absolute;top:-2px;right:16px;width:18px;height:28px;border-radius:3px;background:rgba(180,140,100,.55);transform:rotate(8deg)}'
  + '.zb-scrap-title{font-size:1.1rem;font-weight:700;margin:0 0 8px}.zb-scrap-tape{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px;font-size:.7rem}'
  + '.zb-scrap-tape span{padding:3px 8px;background:rgba(255,240,200,.5);border-radius:2px}'
  + '.zb-scrap-note{margin:0 0 10px;padding:8px;border-radius:4px}'
  + '.zb-snow-cap{font-size:.62rem;letter-spacing:.2em;opacity:.55;margin:0 0 4px}'
  + '.zb-oz-leaf{width:28px;height:8px;border-radius:999px;margin:0 0 8px;opacity:.5}'
  + '.zb-oz-sub{font-size:.7rem;opacity:.6;margin:0 0 10px}'
  + '.zb-lav-star{width:10px;height:10px;border-radius:50%;margin:0 0 8px;opacity:.7}'
  + '.zb-lav-tag{font-size:.62rem;letter-spacing:.14em;opacity:.55;margin:0 0 10px}'
  + '@media(max-width:420px){.zb-attr-grid{grid-template-columns:1fr 1fr}.zb-hud-strip{grid-template-columns:1fr 1fr}.zb-side-layout,.zb-xx{grid-template-columns:1fr}.zb-gutter-row{grid-template-columns:72px 1fr}}'`;
}

function skinCss(s) {
  const acc = s.accent;
  return `'.zb-root{box-sizing:border-box;width:100%;max-width:720px;margin:0 auto;padding:14px 16px;font-size:13px;line-height:1.45;${s.root}}'
  + '.zb-root *,.zb-root *:before,.zb-root *:after{box-sizing:border-box}'
  + '.zb-empty{padding:16px;text-align:center;opacity:.55;font-size:.8rem}'
  + '.zb-bar{height:4px;border-radius:999px;background:rgba(148,163,184,.22);overflow:hidden;margin-top:4px}'
  + '.zb-bar>i{display:block;height:100%;width:var(--zb-pct,60%);background:currentColor;border-radius:inherit}'
  + '.zb-value,.zb-attr-val,.zb-cell-v,.zb-gutter-v,.zb-meter-val,.zb-hud-v,.zb-sweet-mv,.zb-bar>i{color:${acc}}'
  + '.zb-attr-box,.zb-cell,.zb-hud-m,.zb-neon-top,.zb-nest-main,.zb-sweet-m,.zb-scrap-note{${s.surface}}'
  + '.zb-section-h{${s.section}}'
  + '.zb-pill.is-on,.zb-tab.is-on,.zb-cast-chip.is-on,.zb-side-chip.is-on,.zb-cyber-id.is-on,.zb-squad-u.is-on,.zb-xx-chip.is-on,.zb-lib-tab.is-on{border-color:${acc};color:${acc}}'
  ${s.extra ? `+ '${s.extra}'` : ''}
  ${structCss()}`;
}

/** mahogany 专用（完整参考结构） */
const MH_RENDER = `
  function mhPick(list, re) {
    return (list || []).filter(function(p) {
      return re.test(((p && p.label) || '') + ' ' + ((p && p.path) || ''));
    });
  }
  function mhExcept(list, keep) {
    return (list || []).filter(function(p) { return keep.indexOf(p) < 0; });
  }
  function mhRow(label, valueHtml) {
    return '<div class="zb-mh-row"><span class="zb-mh-row-k">' + escHtml(label)
      + ':</span><span class="zb-mh-row-v">' + valueHtml + '</span></div>';
  }
  function mhRows(list, ctx) {
    return (list || []).map(function(p) { return mhRow(p.label, ctx.val(p)); }).join('');
  }
  function mhSec(title, inner, open) {
    if (!inner) return '';
    return '<details class="zb-mh-sec"' + (open === false ? '' : ' open') + '>'
      + '<summary>' + escHtml(title) + '</summary>'
      + '<div class="zb-mh-sec-body">' + inner + '</div></details>';
  }
  var timeP = mhPick(b.meta, /时间|日期|时刻/);
  var placeP = mhPick(b.meta, /地点|位置|场景|天气/);
  var weatherP = mhPick(b.meta, /天气/);
  var placeRest = mhExcept(placeP, weatherP);
  var locParts = placeRest.concat(weatherP).map(function(p) { return ctx.plain(p); }).filter(Boolean);
  var timeParts = timeP.map(function(p) { return ctx.plain(p); }).filter(Boolean);
  var outfit = mhPick(b.narrative.concat(b.attr).concat(b.items), /着装|服饰|衣着|服装|上装|下装|鞋|内衣|配饰/);
  var action = mhPick(b.narrative, /行动|行为|近况/);
  var journalItems = b.items.concat(mhExcept(b.narrative, outfit.concat(action)));
  var thoughts = mhPick(b.nsfw, /内心|心声|想法/);
  var specialExtra = mhPick(b.nsfw.concat(b.narrative), /姿态|气味|特殊|情绪/);
  var emotion = mhPick(b.narrative, /情绪|心情/);
  var bodyNsfw = mhExcept(b.nsfw, thoughts);
  var basicList = emotion.concat(b.meters).concat(mhExcept(b.attr, outfit))
    .concat(mhExcept(b.narrative, outfit.concat(action).concat(emotion)));
  var seen = {};
  basicList = basicList.filter(function(p) {
    var k = (p.path || '') + '|' + (p.label || '');
    if (seen[k]) return false;
    seen[k] = true;
    return true;
  });
  var basicInner = mhRow('名字', '<span class="zb-value">' + escHtml(main) + '</span>') + mhRows(basicList, ctx);
  var top = '<div class="zb-mh-top">'
    + '<div class="zb-mh-top-col"><div class="zb-mh-lab">地点与天气</div>'
    + '<div class="zb-mh-val">' + escHtml(locParts.join(' · ') || '—') + '</div></div>'
    + '<div class="zb-mh-top-col zb-mh-top-r"><div class="zb-mh-lab">时间</div>'
    + '<div class="zb-mh-val">' + escHtml(timeParts.join(' ') || '—') + '</div></div></div>';
  var withTabs = __WITH_TABS__;
  var present = withTabs
    ? ('<div class="zb-mh-present"><span class="zb-mh-lab">在场角色</span><span class="zb-mh-names">'
      + cast.map(function(c) { return escHtml(c.name); }).join('、')
      + '</span><span class="zb-mh-all" title="预览占位">全显示</span></div>'
      + '<div class="zb-mh-tabs">' + cast.map(function(c) {
        return '<span class="zb-mh-tab' + (c.name === main ? ' is-on' : '') + '">' + escHtml(c.name) + '</span>';
      }).join('') + '</div>')
    : ('<div class="zb-mh-present"><span class="zb-mh-lab">角色</span><span class="zb-mh-names">'
      + escHtml(main) + '</span></div>');
  var boxBits = journalItems.filter(function(p) {
    return /记忆|事件|任务|线索|摘要/.test((p.label || '') + (p.path || ''));
  });
  if (!boxBits.length) boxBits = journalItems.slice(0, 3);
  var boxHtml = boxBits.length
    ? '<div class="zb-mh-box">' + boxBits.map(function(p) {
      return '<span class="zb-mh-box-i"><b>' + escHtml(p.label) + '</b> ' + escHtml(ctx.plain(p)) + '</span>';
    }).join('<span class="zb-mh-pipe">|</span>') + '</div>' : '';
  var journalInner = boxHtml + (action.length ? mhRows(action, ctx) : '')
    + (!boxHtml && !action.length && journalItems.length ? mhRows(journalItems.slice(0, 4), ctx) : '');
  var specialList = thoughts.concat(mhExcept(specialExtra, emotion.concat(thoughts)));
  return '<div class="zb-mh" data-zb-title="' + escAttr(title) + '">' + top + present
    + mhSec('时文', journalInner, true)
    + mhSec('基础信息', basicInner, true)
    + mhSec('衣着服饰', outfit.length ? mhRows(outfit, ctx) : '', true)
    + mhSec('身体状态', bodyNsfw.length ? mhRows(bodyNsfw, ctx) : '', true)
    + mhSec('特殊情况', specialList.length ? mhRows(specialList, ctx) : '', true)
    + '</div>';
`;

const MH_CSS = `'.zb-root{box-sizing:border-box;width:100%;max-width:720px;margin:0 auto;padding:14px 16px;font-size:13px;line-height:1.45;border-radius:12px;border:1px solid rgba(80,55,40,.55);background:rgba(28,18,16,.92);color:#e8e0d5;font-family:"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 8px 28px rgba(0,0,0,.35),inset 0 1px 0 rgba(201,164,106,.08)}'
  + '.zb-root *,.zb-root *:before,.zb-root *:after{box-sizing:border-box}'
  + '.zb-empty{padding:16px;text-align:center;opacity:.55}'
  + '.zb-root .zb-value,.zb-root .zb-mh-val,.zb-root .zb-mh-row-v,.zb-root .zb-mh-names,.zb-root .zb-mh-box{color:#e8e0d5!important}'
  + '.zb-mh-lab,.zb-mh-row-k,.zb-mh-sec>summary,.zb-mh-box-i b{color:#c9a46a!important}'
  + '.zb-mh-top{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 0 10px;padding:2px 2px 10px;border-bottom:1px solid rgba(201,164,106,.15)}'
  + '.zb-mh-top-r{text-align:right}.zb-mh-lab{font-size:.68rem;font-weight:600;margin:0 0 4px;letter-spacing:.04em}'
  + '.zb-mh-val{font-size:.82rem;font-weight:600;line-height:1.35}'
  + '.zb-mh-present{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 10px;font-size:.75rem}'
  + '.zb-mh-present .zb-mh-lab{margin:0}.zb-mh-names{flex:1 1 auto;min-width:0;opacity:.92}'
  + '.zb-mh-all{margin-left:auto;padding:3px 10px;border-radius:4px;border:1px solid rgba(201,164,106,.45);color:#c9a46a;font-size:.68rem;white-space:nowrap}'
  + '.zb-mh-tabs{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}'
  + '.zb-mh-tab{display:inline-flex;align-items:center;justify-content:center;min-width:72px;padding:7px 14px;border-radius:8px;font-size:.78rem;border:1px solid rgba(120,90,70,.45);background:rgba(20,14,12,.55);color:rgba(232,224,213,.45);opacity:.85}'
  + '.zb-mh-tab.is-on{border-color:#c9a46a;color:#e8c98a;background:rgba(80,50,30,.55);font-weight:700;opacity:1;box-shadow:0 0 0 1px rgba(201,164,106,.25)}'
  + '.zb-mh-sec{margin:0 0 8px;border-radius:8px;overflow:hidden;border:1px solid rgba(70,48,36,.55);background:rgba(22,14,12,.45)}'
  + '.zb-mh-sec>summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:8px 12px;font-size:.78rem;font-weight:700;background:rgba(14,10,8,.72);border-bottom:1px solid rgba(201,164,106,.12)}'
  + '.zb-mh-sec>summary::-webkit-details-marker{display:none}'
  + '.zb-mh-sec>summary:after{content:"";width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:6px solid #c9a46a;opacity:.85}'
  + '.zb-mh-sec:not([open])>summary:after{border-bottom:0;border-top:6px solid #c9a46a}'
  + '.zb-mh-sec-body{padding:8px 12px 10px}'
  + '.zb-mh-row{display:grid;grid-template-columns:5.5em 1fr;gap:8px;align-items:start;padding:7px 0;border-bottom:1px solid rgba(201,164,106,.1);font-size:.78rem;line-height:1.45}'
  + '.zb-mh-row:last-child{border-bottom:0}'
  + '.zb-mh-row-k{font-weight:600;white-space:nowrap}.zb-mh-row-v{font-weight:500;min-width:0;word-break:break-word}'
  + '.zb-mh-box{margin:0 0 8px;padding:10px 12px;border-radius:6px;background:rgba(12,8,6,.65);border:1px solid rgba(201,164,106,.16);font-size:.72rem;line-height:1.5}'
  + '.zb-mh-box-i{display:inline}.zb-mh-pipe{margin:0 6px;opacity:.35;color:#c9a46a}'
`;

const THEMES = [
  { id: 'sheet_attr', label: 'RPG属性卡', cast: 'single', family: 'rpg', blurb: '深蓝面板、三列属性、清晰数值', accent: '#38bdf8', kind: 'attr_grid',
    root: 'border-radius:14px;border:1px solid rgba(56,189,248,.35);background:linear-gradient(155deg,#0b1726,#0f2137 55%,#0a1624);color:#e2e8f0;font-family:"Segoe UI",system-ui,sans-serif',
    surface: 'background:rgba(15,35,55,.55);border:1px solid rgba(56,189,248,.2)', section: 'background:linear-gradient(90deg,rgba(56,189,248,.18),transparent);color:#7dd3fc' },
  { id: 'multi_sheet_attr', label: 'RPG群像卡', cast: 'multi', family: 'rpg', blurb: '角色轨 + 深蓝三列属性主详', accent: '#38bdf8', kind: 'cast_attr',
    root: 'border-radius:14px;border:1px solid rgba(56,189,248,.4);background:linear-gradient(160deg,#081420,#0e2438);color:#e2e8f0;font-family:"Segoe UI",system-ui,sans-serif',
    surface: 'background:rgba(12,30,48,.6);border:1px solid rgba(56,189,248,.22)', section: 'background:rgba(56,189,248,.15);color:#7dd3fc' },
  { id: 'neon_monitor', label: '霓虹监控', cast: 'single', family: 'neon', blurb: '青黑霓虹、发光边、等宽感', accent: '#22d3ee', kind: 'neon_top',
    root: 'border-radius:12px;border:1px solid rgba(34,211,238,.45);background:linear-gradient(165deg,#050a12,#0a1220 50%,#061018);color:#e0f2fe;font-family:Consolas,"Segoe UI",monospace;box-shadow:0 0 28px rgba(34,211,238,.12)',
    surface: 'background:rgba(8,20,36,.55);border:1px solid rgba(34,211,238,.28)', section: 'background:rgba(34,211,238,.14);color:#67e8f9',
    extra: '.zb-neon-top{background:linear-gradient(90deg,rgba(34,211,238,.12),rgba(14,165,233,.08));border:1px solid rgba(34,211,238,.35);box-shadow:0 0 16px rgba(34,211,238,.08)}' },
  { id: 'multi_neon_cyber', label: '赛博群像', cast: 'multi', family: 'neon', blurb: '等宽角色轨 + 赛博 HUD', accent: '#22d3ee', kind: 'cyber_rail',
    root: 'border-radius:8px;border:1px solid rgba(34,211,238,.5);background:linear-gradient(180deg,#03080f,#0a1524);color:#cffafe;font-family:Consolas,monospace;box-shadow:0 0 24px rgba(34,211,238,.1)',
    surface: 'background:rgba(6,24,40,.55);border:1px solid rgba(34,211,238,.3)', section: 'background:rgba(34,211,238,.12);color:#a5f3fc',
    extra: '.zb-cyber-id.is-on{background:rgba(34,211,238,.15);box-shadow:0 0 8px rgba(34,211,238,.25)}' },
  { id: 'form_sections', label: '古书分区', cast: 'single', family: 'library', blurb: '深褐+琥珀金、标题下划线、引用条', accent: '#d4a017', kind: 'form_gutter',
    root: 'border-radius:6px;border:1px solid rgba(212,160,23,.4);background:linear-gradient(180deg,#1a1208,#100c06);color:#f5e6c8;font-family:Georgia,"Songti SC",serif',
    surface: 'background:rgba(60,40,12,.35);border:1px solid rgba(212,160,23,.22)', section: 'background:transparent;color:#e8c547;letter-spacing:.18em;border-bottom:1px solid rgba(212,160,23,.35);border-radius:0;padding-left:0',
    extra: '.zb-gutter-row{border-bottom-color:rgba(212,160,23,.15)}' },
  { id: 'multi_library_gold', label: '古书群像', cast: 'multi', family: 'library', blurb: '金线 Tab + 引用条分区', accent: '#d4a017', kind: 'gold_tabs',
    root: 'border-radius:6px;border:1px solid rgba(212,160,23,.45);background:linear-gradient(180deg,#161008,#0e0a05);color:#f5e6c8;font-family:Georgia,"Songti SC",serif',
    surface: 'background:rgba(50,35,10,.4);border:1px solid rgba(212,160,23,.2)', section: 'color:#e8c547;letter-spacing:.16em;border-bottom:1px solid rgba(212,160,23,.3);border-radius:0;background:transparent;padding-left:0',
    extra: '.zb-lib-quote{color:#d4a017;background:rgba(40,28,8,.4)}.zb-lib-tab.is-on{color:#e8c547}' },
  { id: 'romance_glow', label: '恋爱柔光', cast: 'single', family: 'romance', blurb: '粉玻璃、柔圆角、好感焦点', accent: '#fb7185', kind: 'romance_cards',
    root: 'border-radius:18px;border:1px solid rgba(251,113,133,.35);background:linear-gradient(145deg,#2a1524,#1a1220 60%,#221528);color:#fce7f3;font-family:"Segoe UI",system-ui,sans-serif',
    surface: 'background:rgba(76,29,49,.35);border:1px solid rgba(251,113,133,.25);border-radius:14px', section: 'background:rgba(251,113,133,.16);color:#fbcfe8' },
  { id: 'multi_romance_glass', label: '粉璃群像', cast: 'multi', family: 'romance', blurb: '粉璃 Tab + 分区 gutter', accent: '#fb7185', kind: 'glass_tabs',
    root: 'border-radius:16px;border:1px solid rgba(251,113,133,.4);background:linear-gradient(150deg,#2a1824,#1c121c);color:#fce7f3;font-family:"Segoe UI",system-ui,sans-serif;backdrop-filter:blur(8px)',
    surface: 'background:rgba(76,29,49,.4);border:1px solid rgba(251,113,133,.28)', section: 'background:rgba(251,113,133,.14);color:#fbcfe8',
    extra: '.zb-tab.is-on{background:rgba(251,113,133,.2)}' },
  { id: 'xianxia_scroll', label: '仙侠金墨', cast: 'single', family: 'xianxia', blurb: '新中式金墨、卷轴/金边', accent: '#fbbf24', kind: 'scroll',
    root: 'border-radius:6px;border:1px solid rgba(251,191,36,.5);background:linear-gradient(180deg,#1c140a,#100c08);color:#fef3c7;font-family:Georgia,"Songti SC",serif',
    surface: 'background:rgba(69,40,12,.4);border:1px solid rgba(245,158,11,.3)', section: 'background:linear-gradient(90deg,rgba(251,191,36,.22),transparent);color:#fde68a;letter-spacing:.2em',
    extra: '.zb-scroll-title{color:#fde68a;border-bottom:1px solid rgba(251,191,36,.35);padding-bottom:8px}' },
  { id: 'multi_xianxia_ink', label: '仙侠同门', cast: 'multi', family: 'xianxia', blurb: '竖列金边 + 卷轴主详', accent: '#fbbf24', kind: 'ink_cast',
    root: 'border-radius:6px;border:1px solid rgba(251,191,36,.45);background:linear-gradient(180deg,#181208,#0e0a06);color:#fef3c7;font-family:Georgia,"Songti SC",serif',
    surface: 'background:rgba(60,36,10,.4);border:1px solid rgba(245,158,11,.28)', section: 'background:rgba(251,191,36,.15);color:#fde68a',
    extra: '.zb-xx-chip.is-on{background:rgba(251,191,36,.18)}' },
  { id: 'scifi_console', label: '科幻HUD', cast: 'single', family: 'scifi', blurb: '青绿 HUD、仪表条', accent: '#2dd4bf', kind: 'hud_strip',
    root: 'border-radius:4px;border:1px solid rgba(45,212,191,.45);background:linear-gradient(180deg,#04121c,#0a1f2e);color:#ccfbf1;font-family:Consolas,"SF Mono",monospace',
    surface: 'background:rgba(6,50,55,.4);border:1px solid rgba(45,212,191,.28);border-radius:4px', section: 'background:rgba(45,212,191,.12);color:#99f6e4;font-family:Consolas,monospace' },
  { id: 'multi_scifi_hud', label: '编队HUD', cast: 'multi', family: 'scifi', blurb: '编队切换 + 仪表条', accent: '#2dd4bf', kind: 'squad_hud',
    root: 'border-radius:4px;border:1px solid rgba(45,212,191,.5);background:linear-gradient(180deg,#031018,#0a1e2c);color:#ccfbf1;font-family:Consolas,monospace',
    surface: 'background:rgba(6,45,50,.45);border:1px solid rgba(45,212,191,.3);border-radius:4px', section: 'background:rgba(45,212,191,.12);color:#99f6e4',
    extra: '.zb-squad-u.is-on{background:rgba(45,212,191,.18)}' },
  { id: 'ink_paper', label: '水墨宣纸', cast: 'single', family: 'ink', blurb: '浅宣纸、留白、淡墨', accent: '#475569', kind: 'ink_vert',
    root: 'border-radius:4px;border:1px solid rgba(100,116,139,.35);background:linear-gradient(180deg,#f8fafc,#e8eef4);color:#1e293b;font-family:Georgia,"Songti SC",serif',
    surface: 'background:rgba(255,255,255,.65);border:1px solid rgba(148,163,184,.25)', section: 'background:rgba(71,85,105,.08);color:#475569;letter-spacing:.2em;border-left:3px solid #64748b;border-radius:0',
    extra: '.zb-bar{background:rgba(100,116,139,.2)}.zb-gutter-row{border-bottom-color:rgba(100,116,139,.18)}' },
  { id: 'multi_ink_paper', label: '水墨群像', cast: 'multi', family: 'ink', blurb: '宣纸折叠块群像', accent: '#475569', kind: 'ink_fold',
    root: 'border-radius:4px;border:1px solid rgba(100,116,139,.35);background:linear-gradient(180deg,#f7f8fa,#e6ecf2);color:#1e293b;font-family:Georgia,"Songti SC",serif',
    surface: 'background:rgba(255,255,255,.7);border:1px solid rgba(148,163,184,.25)', section: 'background:rgba(71,85,105,.08);color:#475569',
    extra: '.zb-fold{background:rgba(255,255,255,.55);border-color:rgba(100,116,139,.25)}.zb-bar{background:rgba(100,116,139,.2)}' },
  { id: 'frost_blue', label: '毛玻璃蓝', cast: 'single', family: 'frost', blurb: '蓝白透光 blur、浮层 pill', accent: '#60a5fa', kind: 'frost_soft',
    root: 'border-radius:16px;border:1px solid rgba(147,197,253,.45);background:linear-gradient(160deg,rgba(30,58,95,.75),rgba(15,35,70,.85));color:#e0f2fe;font-family:"Segoe UI",system-ui,sans-serif;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)',
    surface: 'background:rgba(255,255,255,.08);border:1px solid rgba(147,197,253,.25);backdrop-filter:blur(6px)', section: 'background:rgba(96,165,250,.15);color:#93c5fd' },
  { id: 'multi_frost_blue', label: '毛玻璃群像', cast: 'multi', family: 'frost', blurb: '毛玻璃 pill 轨 + 主详', accent: '#60a5fa', kind: 'frost_pills',
    root: 'border-radius:16px;border:1px solid rgba(147,197,253,.5);background:linear-gradient(155deg,rgba(25,50,90,.8),rgba(12,30,60,.88));color:#e0f2fe;font-family:"Segoe UI",system-ui,sans-serif;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)',
    surface: 'background:rgba(255,255,255,.08);border:1px solid rgba(147,197,253,.28)', section: 'background:rgba(96,165,250,.15);color:#93c5fd',
    extra: '.zb-pill.is-on{background:rgba(96,165,250,.25)}' },
  { id: 'sweet_pink', label: '甜齿粉雾', cast: 'single', family: 'sweet', blurb: '奶油粉、圆角软 UI', accent: '#f472b6', kind: 'sweet_soft',
    root: 'border-radius:20px;border:1px solid rgba(244,114,182,.35);background:linear-gradient(150deg,#3a2030,#2a1824 55%,#322028);color:#fce7f3;font-family:"Segoe UI",system-ui,sans-serif',
    surface: 'background:rgba(244,114,182,.12);border:1px solid rgba(244,114,182,.22);border-radius:16px', section: 'background:rgba(244,114,182,.14);color:#f9a8d4',
    extra: '.zb-sweet-badge{background:rgba(244,114,182,.2);border:1px solid rgba(244,114,182,.3)}' },
  { id: 'multi_sweet_pink', label: '甜齿群像', cast: 'multi', family: 'sweet', blurb: '奶油粉 pill + 软卡主详', accent: '#f472b6', kind: 'sweet_pills',
    root: 'border-radius:20px;border:1px solid rgba(244,114,182,.4);background:linear-gradient(150deg,#382030,#281820);color:#fce7f3;font-family:"Segoe UI",system-ui,sans-serif',
    surface: 'background:rgba(244,114,182,.12);border:1px solid rgba(244,114,182,.25);border-radius:16px', section: 'background:rgba(244,114,182,.14);color:#f9a8d4',
    extra: '.zb-pill.is-on{background:rgba(244,114,182,.22)}' },
  { id: 'scrapbook', label: '手帐水彩', cast: 'single', family: 'scrap', blurb: '奶油纸、夹子感、水彩点缀', accent: '#c4a574', kind: 'scrap',
    root: 'border-radius:8px;border:1px solid rgba(196,165,116,.45);background:linear-gradient(180deg,#faf6ee,#f0e6d4);color:#4a3f35;font-family:Georgia,"Segoe UI",serif',
    surface: 'background:rgba(255,250,240,.7);border:1px solid rgba(196,165,116,.3)', section: 'background:rgba(196,165,116,.15);color:#8b6914',
    extra: '.zb-scrap-note{background:rgba(255,248,230,.8);border:1px dashed rgba(196,165,116,.4)}.zb-bar{background:rgba(196,165,116,.25)}' },
  { id: 'multi_scrapbook', label: '手帐群像', cast: 'multi', family: 'scrap', blurb: '主视角大卡 + 次要角色嵌套条', accent: '#c4a574', kind: 'scrap_nest',
    root: 'border-radius:10px;border:1px solid rgba(196,165,116,.5);background:linear-gradient(160deg,#faf6ee,#ebe0cc);color:#4a3f35;font-family:Georgia,"Segoe UI",serif',
    surface: 'background:rgba(255,250,240,.75);border:1px solid rgba(196,165,116,.35)', section: 'background:rgba(196,165,116,.15);color:#8b6914',
    extra: '.zb-nest-main{background:rgba(255,248,230,.85);border:1px solid rgba(196,165,116,.4)}.zb-nest-chip{background:rgba(255,252,245,.9);border-color:rgba(196,165,116,.4)}.zb-bar{background:rgba(196,165,116,.25)}' },
  { id: 'snow_glass', label: '冬雪冰晶', cast: 'single', family: 'snow', blurb: '冰蓝玻璃、轻盈', accent: '#7dd3fc', kind: 'snow_panel',
    root: 'border-radius:14px;border:1px solid rgba(186,230,253,.55);background:linear-gradient(165deg,rgba(224,242,254,.92),rgba(186,230,253,.75));color:#0c4a6e;font-family:"Segoe UI",system-ui,sans-serif;backdrop-filter:blur(10px)',
    surface: 'background:rgba(255,255,255,.45);border:1px solid rgba(125,211,252,.35)', section: 'background:rgba(125,211,252,.2);color:#0369a1',
    extra: '.zb-bar{background:rgba(125,211,252,.3)}' },
  { id: 'multi_snow_glass', label: '雪原群像', cast: 'multi', family: 'snow', blurb: '左侧角色列 + 右侧冰蓝主详', accent: '#7dd3fc', kind: 'snow_side',
    root: 'border-radius:14px;border:1px solid rgba(186,230,253,.55);background:linear-gradient(165deg,rgba(224,242,254,.94),rgba(186,230,253,.78));color:#0c4a6e;font-family:"Segoe UI",system-ui,sans-serif;backdrop-filter:blur(10px)',
    surface: 'background:rgba(255,255,255,.5);border:1px solid rgba(125,211,252,.35)', section: 'background:rgba(125,211,252,.2);color:#0369a1',
    extra: '.zb-side-chip.is-on{background:rgba(125,211,252,.3);border-color:#0ea5e9;color:#0369a1}.zb-bar{background:rgba(125,211,252,.3)}' },
  { id: 'oz_green', label: '绿野仙踪', cast: 'single', family: 'oz', blurb: '苔绿毛玻璃、自然清新', accent: '#4ade80', kind: 'oz_moss',
    root: 'border-radius:14px;border:1px solid rgba(74,222,128,.4);background:linear-gradient(160deg,rgba(20,40,28,.88),rgba(12,28,20,.92));color:#dcfce7;font-family:"Segoe UI",system-ui,sans-serif;backdrop-filter:blur(10px)',
    surface: 'background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.25)', section: 'background:rgba(74,222,128,.14);color:#86efac',
    extra: '.zb-oz-leaf{background:#4ade80}' },
  { id: 'multi_oz_green', label: '绿野群像', cast: 'multi', family: 'oz', blurb: '优雅折叠块 · 主开配关', accent: '#4ade80', kind: 'oz_fold',
    root: 'border-radius:14px;border:1px solid rgba(74,222,128,.45);background:linear-gradient(160deg,rgba(16,36,24,.9),rgba(10,24,16,.94));color:#dcfce7;font-family:"Segoe UI",system-ui,sans-serif;backdrop-filter:blur(10px)',
    surface: 'background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.25)', section: 'background:rgba(74,222,128,.14);color:#86efac',
    extra: '.zb-fold{background:rgba(20,48,32,.5);border-color:rgba(74,222,128,.3)}' },
  { id: 'soft_lavender', label: '软紫星梦', cast: 'single', family: 'lavender', blurb: '淡紫透明、可爱但不幼稚', accent: '#c4b5fd', kind: 'lavender',
    root: 'border-radius:16px;border:1px solid rgba(196,181,253,.4);background:linear-gradient(150deg,rgba(40,30,60,.85),rgba(28,22,48,.9));color:#ede9fe;font-family:"Segoe UI",system-ui,sans-serif;backdrop-filter:blur(10px)',
    surface: 'background:rgba(196,181,253,.1);border:1px solid rgba(196,181,253,.25)', section: 'background:rgba(196,181,253,.14);color:#ddd6fe',
    extra: '.zb-lav-star{background:#c4b5fd;box-shadow:0 0 8px rgba(196,181,253,.5)}' },
  { id: 'multi_soft_lavender', label: '软紫群像', cast: 'multi', family: 'lavender', blurb: '淡紫 Tab + 星梦主详', accent: '#c4b5fd', kind: 'lavender_tabs',
    root: 'border-radius:16px;border:1px solid rgba(196,181,253,.45);background:linear-gradient(150deg,rgba(36,28,55,.88),rgba(24,18,42,.92));color:#ede9fe;font-family:"Segoe UI",system-ui,sans-serif;backdrop-filter:blur(10px)',
    surface: 'background:rgba(196,181,253,.1);border:1px solid rgba(196,181,253,.28)', section: 'background:rgba(196,181,253,.14);color:#ddd6fe',
    extra: '.zb-tab.is-on{background:rgba(196,181,253,.2)}' },
];

function writeTheme(t) {
  const meta = { id: t.id, label: t.label, cast: t.cast, family: t.family, blurb: t.blurb, accent: t.accent };
  const body = `/**
 * 状态栏主题：${t.label}（${t.family} / ${t.cast}）
 */
${HDR}${LOCAL_HELPERS}
export const meta = ${JSON.stringify(meta, null, 2)};

/** @param {{ paths: any[], title?: string, castMode?: string, characters?: any[], mainName?: string, valueFn: Function, rawValueHtml?: boolean }} opts */
export function render(opts) {
  var paths = Array.isArray(opts && opts.paths) ? opts.paths : [];
  if (!paths.length) return '<div class="zb-empty">暂无变量路径</div>';
  var title = String((opts && opts.title) || 'STATUS');
  var characters = Array.isArray(opts && opts.characters) ? opts.characters : [];
  var mainName = String((opts && opts.mainName) || (characters[0] && characters[0].name) || '');
  var ctx = makeCtx(opts.valueFn, !!(opts && opts.rawValueHtml));
  var b = bucketPaths(paths);
  var cast = characters.length ? characters : (mainName ? [{ name: mainName }] : [{ name: '主视角' }]);
  var main = mainName || cast[0].name;
${KINDS[t.kind]}
}

export function css() {
  return ${skinCss(t)};
}
`;
  fs.writeFileSync(path.join(dir, t.id + '.mjs'), body, 'utf8');
}

function writeMahogany(id, label, cast, withTabs) {
  const meta = {
    id, label, cast, family: 'mahogany',
    blurb: cast === 'multi' ? '顶栏时空 · 在场角色 · Tab · 折叠档案分区' : '暮褐档案单人版 · 无角色 Tab',
    accent: '#c9a46a',
  };
  const rb = MH_RENDER.split('var withTabs = __WITH_TABS__;').join(`var withTabs = ${withTabs};`);
  const body = `/**
 * 状态栏主题：${label}（mahogany / ${cast}）
 */
${HDR}
export const meta = ${JSON.stringify(meta, null, 2)};

/** @param {{ paths: any[], title?: string, castMode?: string, characters?: any[], mainName?: string, valueFn: Function, rawValueHtml?: boolean }} opts */
export function render(opts) {
  var paths = Array.isArray(opts && opts.paths) ? opts.paths : [];
  if (!paths.length) return '<div class="zb-empty">暂无变量路径</div>';
  var title = String((opts && opts.title) || 'STATUS');
  var characters = Array.isArray(opts && opts.characters) ? opts.characters : [];
  var mainName = String((opts && opts.mainName) || (characters[0] && characters[0].name) || '');
  var ctx = makeCtx(opts.valueFn, !!(opts && opts.rawValueHtml));
  var b = bucketPaths(paths);
  var cast = characters.length ? characters : (mainName ? [{ name: mainName }] : [{ name: '主视角' }]);
  var main = mainName || cast[0].name;
${rb}
}

export function css() {
  return ${MH_CSS};
}
`;
  fs.writeFileSync(path.join(dir, id + '.mjs'), body, 'utf8');
}

fs.mkdirSync(dir, { recursive: true });
for (const t of THEMES) {
  if (!KINDS[t.kind]) throw new Error('missing kind ' + t.kind);
  writeTheme(t);
  console.log('ok', t.id);
}
writeMahogany('mahogany_dossier', '暮褐档案', 'single', false);
writeMahogany('multi_mahogany_dossier', '暮褐群档', 'multi', true);
console.log('ok mahogany pair');
console.log('done', THEMES.length + 2);
