/**
 * 一次性：按 softmon 骨架重写全部主题文件（各族独立 CSS）
 * 用法：node scripts/rebuildSoftmonThemes.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/lib/statusBarThemes');

function layoutCss(ns, multi) {
  const a = `--${ns}-accent`;
  const lines = [
    `.zb-root *,.zb-root *:before,.zb-root *:after{box-sizing:border-box}`,
    `.${ns}-empty{padding:20px;text-align:center;opacity:.5}`,
    `.${ns}-world{flex:1;display:flex;flex-direction:column;gap:6px}`,
    `.${ns}-world-primary,.${ns}-world-secondary{display:flex;align-items:center;gap:6px}`,
    `.${ns}-ico{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;line-height:1;opacity:.85}`,
    `.${ns}-chars{padding:8px}`,
    `.${ns}-head{display:flex;align-items:center;gap:10px;padding:10px 12px}`,
    `.${ns}-mini-bars{flex:1;display:flex;gap:8px;min-width:0}`,
    `.${ns}-mini{flex:1;display:flex;align-items:center;gap:5px;min-width:0}`,
    `.${ns}-mini-lab{font-size:10px;opacity:.6;min-width:14px}`,
    `.${ns}-track{flex:1;height:4px;border-radius:2px;overflow:hidden;max-width:100%}`,
    `.${ns}-fill{height:100%;border-radius:2px;transition:width .3s}`,
    `.${ns}-mini-num{font-size:10px;font-weight:600;min-width:20px;text-align:right}`,
    `.${ns}-detail{padding:0 12px 12px}`,
    `.${ns}-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px}`,
    `.${ns}-cell.${ns}-full{grid-column:1/-1}`,
    `.${ns}-cell-k{font-size:9px;opacity:.5;margin-bottom:2px}`,
    `.${ns}-events-h,.${ns}-event-track-h{font-size:10px;opacity:.65;margin-bottom:6px;display:flex;align-items:center;gap:4px}`,
    `.${ns}-chip-rail{display:flex;gap:8px;flex-wrap:wrap}`,
    `.${ns}-chip b{font-weight:600;margin-right:2px}`,
    `.${ns}-foot{margin-top:4px;padding:8px 0 6px;display:flex;justify-content:center;align-items:center;gap:8px}`,
    `.${ns}-deco{height:1px;width:30px}`,
    `.${ns}-deco-t{font-size:9px;letter-spacing:2px;font-weight:700}`,
  ];
  if (multi) {
    lines.push(
      `.${ns}-head{cursor:pointer;list-style:none}`,
      `.${ns}-head::-webkit-details-marker{display:none}`,
      `.${ns}-toggle{width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:5px solid currentColor;opacity:.45;margin-left:4px;transition:transform .2s;flex:0 0 auto}`,
      `details.${ns}-card:not([open])>.${ns}-head .${ns}-toggle{transform:rotate(-90deg)}`,
      `.${ns}-card{margin-bottom:6px}`,
      `.${ns}-card:last-child{margin-bottom:0}`,
      `.${ns}-name{color:var(${a})}`,
      `.${ns}-card{border-left:3px solid var(${a})}`,
      `.${ns}-others-sec,.${ns}-events-sec{padding:8px;border-top:1px solid rgba(128,128,128,.2)}`,
      `.${ns}-fold-h{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;cursor:pointer;list-style:none;font-weight:600;font-size:12px}`,
      `.${ns}-fold-h::-webkit-details-marker{display:none}`,
      `details.${ns}-fold:not([open])>.${ns}-fold-h .${ns}-toggle{transform:rotate(-90deg)}`,
      `.${ns}-others-list,.${ns}-events-list{padding:8px 0 0}`,
      `.${ns}-other{margin-bottom:6px;padding:10px 12px;border-left:3px solid var(${a})}`,
      `.${ns}-other:last-child{margin-bottom:0}`,
      `.${ns}-other-head{display:flex;align-items:center;gap:10px;margin-bottom:8px}`,
      `.${ns}-other-name{color:var(${a})}`,
      `.${ns}-other-favor{flex:1;display:flex;align-items:center;gap:6px;min-width:0}`,
      `.${ns}-other-favor .${ns}-track{max-width:80px}`,
      `.${ns}-other-lab{font-size:10px;opacity:.5}`,
      `.${ns}-other-info{display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10px}`,
      `.${ns}-other-i.${ns}-full{grid-column:1/-1}`,
      `.${ns}-other-v{opacity:.8}`,
      `.${ns}-event-row{display:flex;align-items:center;padding:8px 12px;margin-bottom:4px;gap:10px}`,
      `.${ns}-event-name{font-weight:600;font-size:11px;min-width:60px}`,
      `.${ns}-event-status{flex:1;font-size:10px;text-align:right}`,
    );
  }
  return lines;
}

// 各族视觉定义见同目录片段文件，避免本脚本过大：内联精简版
import { SKINS } from './softmonSkins.mjs';

const THEMES = [
  { file: 'sheet_attr.mjs', id: 'sheet_attr', label: 'RPG属性卡', cast: 'single', family: 'rpg', blurb: '深蓝玻璃 · 迷你条卡头 · 2×2 详情格', skinKey: 'rpg' },
  { file: 'neon_monitor.mjs', id: 'neon_monitor', label: '霓虹监控', cast: 'single', family: 'neon', blurb: '青黑霓虹 · 发光边框 · 迷你条卡头', skinKey: 'neon' },
  { file: 'form_sections.mjs', id: 'form_sections', label: '古书分卷', cast: 'single', family: 'library', blurb: '深褐金线 · softmon 骨架', skinKey: 'library' },
  { file: 'romance_glow.mjs', id: 'romance_glow', label: '恋爱柔光', cast: 'single', family: 'romance', blurb: '粉璃柔光 · 迷你条 · 事件 chips', skinKey: 'romance' },
  { file: 'xianxia_scroll.mjs', id: 'xianxia_scroll', label: '仙侠卷轴', cast: 'single', family: 'xianxia', blurb: '金墨卷轴 · softmon 骨架', skinKey: 'xianxia' },
  { file: 'scifi_console.mjs', id: 'scifi_console', label: '科幻控制台', cast: 'single', family: 'scifi', blurb: '青绿 HUD · 等宽 · softmon 骨架', skinKey: 'scifi' },
  { file: 'ink_paper.mjs', id: 'ink_paper', label: '水墨宣纸', cast: 'single', family: 'ink', blurb: '浅宣纸深墨 · softmon 骨架', skinKey: 'ink' },
  { file: 'frost_blue.mjs', id: 'frost_blue', label: '毛玻璃蓝', cast: 'single', family: 'frost', blurb: '蓝白毛玻璃 blur · softmon 骨架', skinKey: 'frost' },
  { file: 'sweet_pink.mjs', id: 'sweet_pink', label: '甜齿粉', cast: 'single', family: 'sweet', blurb: '奶油粉软圆角 · softmon 骨架', skinKey: 'sweet' },
  { file: 'scrapbook.mjs', id: 'scrapbook', label: '手帐拼贴', cast: 'single', family: 'scrap', blurb: '奶油纸夹子 · softmon 骨架', skinKey: 'scrap' },
  { file: 'snow_glass.mjs', id: 'snow_glass', label: '冬雪玻璃', cast: 'single', family: 'snow', blurb: '冰蓝冬雪 · softmon 骨架', skinKey: 'snow' },
  { file: 'oz_green.mjs', id: 'oz_green', label: '绿野仙踪', cast: 'single', family: 'oz', blurb: '苔绿自然 · softmon 骨架', skinKey: 'oz' },
  { file: 'soft_lavender.mjs', id: 'soft_lavender', label: '软紫星梦', cast: 'single', family: 'lavender', blurb: '淡紫星梦 · softmon 骨架', skinKey: 'lavender' },
  { file: 'mahogany_dossier.mjs', id: 'mahogany_dossier', label: '暮褐档案', cast: 'single', family: 'mahogany', blurb: '暮褐暖金 · 迷你条卡头 · softmon 骨架', skinKey: 'mahogany' },
  { file: 'soft_monitor.mjs', id: 'soft_monitor', label: '软监控面板', cast: 'single', family: 'softmon', blurb: '顶栏时空 · 折叠卡头迷你条 · 2×2 详情格 · 事件 chips', skinKey: 'softmon', nsOverride: 'sm' },
  { file: 'multi_sheet_attr.mjs', id: 'multi_sheet_attr', label: 'RPG群像', cast: 'multi', family: 'rpg', blurb: '深蓝玻璃群像 · 主卡展开 · 其他角色', skinKey: 'rpg' },
  { file: 'multi_neon_cyber.mjs', id: 'multi_neon_cyber', label: '霓虹赛博群像', cast: 'multi', family: 'neon', blurb: '霓虹群像 · 主卡+其他角色', skinKey: 'neon' },
  { file: 'multi_library_gold.mjs', id: 'multi_library_gold', label: '古书群像', cast: 'multi', family: 'library', blurb: '金线群像 · softmon 骨架', skinKey: 'library' },
  { file: 'multi_romance_glass.mjs', id: 'multi_romance_glass', label: '恋爱群像', cast: 'multi', family: 'romance', blurb: '粉璃群像 · softmon 骨架', skinKey: 'romance' },
  { file: 'multi_xianxia_ink.mjs', id: 'multi_xianxia_ink', label: '仙侠群像', cast: 'multi', family: 'xianxia', blurb: '金墨群像 · softmon 骨架', skinKey: 'xianxia' },
  { file: 'multi_scifi_hud.mjs', id: 'multi_scifi_hud', label: '科幻群像', cast: 'multi', family: 'scifi', blurb: 'HUD 群像 · softmon 骨架', skinKey: 'scifi' },
  { file: 'multi_ink_paper.mjs', id: 'multi_ink_paper', label: '水墨群像', cast: 'multi', family: 'ink', blurb: '宣纸群像 · softmon 骨架', skinKey: 'ink' },
  { file: 'multi_frost_blue.mjs', id: 'multi_frost_blue', label: '毛玻璃群像', cast: 'multi', family: 'frost', blurb: '毛玻璃群像 · softmon 骨架', skinKey: 'frost' },
  { file: 'multi_sweet_pink.mjs', id: 'multi_sweet_pink', label: '甜齿群像', cast: 'multi', family: 'sweet', blurb: '奶油粉群像 · softmon 骨架', skinKey: 'sweet' },
  { file: 'multi_scrapbook.mjs', id: 'multi_scrapbook', label: '手帐群像', cast: 'multi', family: 'scrap', blurb: '手帐群像 · softmon 骨架', skinKey: 'scrap' },
  { file: 'multi_snow_glass.mjs', id: 'multi_snow_glass', label: '冬雪群像', cast: 'multi', family: 'snow', blurb: '冬雪群像 · softmon 骨架', skinKey: 'snow' },
  { file: 'multi_oz_green.mjs', id: 'multi_oz_green', label: '绿野群像', cast: 'multi', family: 'oz', blurb: '苔绿群像 · softmon 骨架', skinKey: 'oz' },
  { file: 'multi_soft_lavender.mjs', id: 'multi_soft_lavender', label: '软紫群像', cast: 'multi', family: 'lavender', blurb: '星梦群像 · softmon 骨架', skinKey: 'lavender' },
  { file: 'multi_mahogany_dossier.mjs', id: 'multi_mahogany_dossier', label: '暮褐群档', cast: 'multi', family: 'mahogany', blurb: '暮褐群档 · softmon 骨架 · 其他角色', skinKey: 'mahogany' },
  { file: 'multi_soft_monitor.mjs', id: 'multi_soft_monitor', label: '软监控群像', cast: 'multi', family: 'softmon', blurb: '顶栏时空 · 主卡展开迷你条 · 其他角色折叠 · 事件区', skinKey: 'softmon', nsOverride: 'msm' },
];

function buildCss(skin, ns, multi) {
  const parts = [skin.root, ...layoutCss(ns, multi), ...skin.panel(ns)];
  if (multi) parts.push(...skin.multiExtra(ns));
  return parts;
}

function iconsLiteral(icons) {
  return JSON.stringify(icons);
}

function accentsLiteral(accents) {
  return JSON.stringify(accents);
}

function writeTheme(t) {
  const skin = SKINS[t.skinKey];
  const multi = t.cast === 'multi';
  const ns = t.nsOverride || skin.ns;
  const footer = multi ? skin.footerM : skin.footerS;
  const cssParts = buildCss(skin, ns, multi);
  const cssJoined = cssParts.map((s) => JSON.stringify(s)).join(',\n    ');

  const renderFn = multi ? 'renderSoftmonMulti' : 'renderSoftmonSingle';
  const body = `/**
 * 状态栏主题：${t.label}（${t.family} / ${t.cast}）
 * softmon 信息架构 + 本族换皮 CSS
 */
import { ${renderFn} } from './softmonLayout.mjs';

export const meta = {
  id: ${JSON.stringify(t.id)},
  label: ${JSON.stringify(t.label)},
  cast: ${JSON.stringify(t.cast)},
  family: ${JSON.stringify(t.family)},
  blurb: ${JSON.stringify(t.blurb)},
  accent: ${JSON.stringify(skin.accent)},
};

const SKIN = {
  ns: ${JSON.stringify(ns)},
  footer: ${JSON.stringify(footer)},
  icons: ${iconsLiteral(skin.icons)},
  accents: ${accentsLiteral(skin.accents)},
};

/** @param {object} opts */
export function render(opts) {
  return ${renderFn}(opts, SKIN);
}

export function css() {
  return [
    ${cssJoined}
  ].join('');
}
`;
  fs.writeFileSync(path.join(dir, t.file), body, 'utf8');
}

for (const t of THEMES) writeTheme(t);
console.log('wrote', THEMES.length, 'themes');
