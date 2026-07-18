/**
 * 状态栏主题总入口：15 美学族 × 单人/多人
 * 本轮 10 族（scrap/neon/mahogany/xianxia/rpg/romance/scifi/ink/softmon/library）各自独立结构；
 * frost/sweet/snow/oz/lavender 暂缓，仍可共用 softmonLayout。
 */
import {
  migrateDesignId as migrateRaw,
  escHtml, escAttr, classifyPath, DESIGN_MIGRATE, filterMainPaths,
} from './shared.mjs';

import * as sheet_attr from './sheet_attr.mjs';
import * as multi_sheet_attr from './multi_sheet_attr.mjs';
import * as neon_monitor from './neon_monitor.mjs';
import * as multi_neon_cyber from './multi_neon_cyber.mjs';
import * as form_sections from './form_sections.mjs';
import * as multi_library_gold from './multi_library_gold.mjs';
import * as romance_glow from './romance_glow.mjs';
import * as multi_romance_glass from './multi_romance_glass.mjs';
import * as xianxia_scroll from './xianxia_scroll.mjs';
import * as multi_xianxia_ink from './multi_xianxia_ink.mjs';
import * as scifi_console from './scifi_console.mjs';
import * as multi_scifi_hud from './multi_scifi_hud.mjs';
import * as ink_paper from './ink_paper.mjs';
import * as multi_ink_paper from './multi_ink_paper.mjs';
import * as frost_blue from './frost_blue.mjs';
import * as multi_frost_blue from './multi_frost_blue.mjs';
import * as sweet_pink from './sweet_pink.mjs';
import * as multi_sweet_pink from './multi_sweet_pink.mjs';
import * as scrapbook from './scrapbook.mjs';
import * as multi_scrapbook from './multi_scrapbook.mjs';
import * as snow_glass from './snow_glass.mjs';
import * as multi_snow_glass from './multi_snow_glass.mjs';
import * as oz_green from './oz_green.mjs';
import * as multi_oz_green from './multi_oz_green.mjs';
import * as soft_lavender from './soft_lavender.mjs';
import * as multi_soft_lavender from './multi_soft_lavender.mjs';
import * as mahogany_dossier from './mahogany_dossier.mjs';
import * as multi_mahogany_dossier from './multi_mahogany_dossier.mjs';
import * as soft_monitor from './soft_monitor.mjs';
import * as multi_soft_monitor from './multi_soft_monitor.mjs';

/** @typedef {{ id: string, label: string, cast: 'single'|'multi', blurb: string, accent: string, family: string, render: Function, css: Function }} ThemeMod */

/** @type {ThemeMod[]} */
const THEMES = [
  sheet_attr, multi_sheet_attr,
  neon_monitor, multi_neon_cyber,
  form_sections, multi_library_gold,
  romance_glow, multi_romance_glass,
  xianxia_scroll, multi_xianxia_ink,
  scifi_console, multi_scifi_hud,
  ink_paper, multi_ink_paper,
  frost_blue, multi_frost_blue,
  sweet_pink, multi_sweet_pink,
  scrapbook, multi_scrapbook,
  snow_glass, multi_snow_glass,
  oz_green, multi_oz_green,
  soft_lavender, multi_soft_lavender,
  mahogany_dossier, multi_mahogany_dossier,
  soft_monitor, multi_soft_monitor,
].map(function(m) {
  return Object.assign({}, m.meta, { render: m.render, css: m.css });
});

const byId = Object.create(null);
THEMES.forEach(function(t) { byId[t.id] = t; });
const KNOWN_IDS = THEMES.map(function(t) { return t.id; });

/** @type {readonly object[]} */
export const STATUS_BAR_DESIGNS = Object.freeze(THEMES.map(function(t) {
  return {
    id: t.id,
    label: t.label,
    cast: t.cast,
    blurb: t.blurb,
    accent: t.accent,
    family: t.family,
  };
}));

export { escHtml, escAttr, classifyPath, DESIGN_MIGRATE };
export {
  guessPct, stripTags, bucketPaths, filterMainPaths, makeCtx,
  worldScopedPaths, rolePaths, globalQuestEventPaths, displayBuckets,
  roleFieldLists, ensureCoverage, orphanPaths, questEventSectionHtml, formatMetaLine,
} from './shared.mjs';

/** @param {string} id */
export function getDesignById(id) {
  var mid = migrateDesignId(id);
  return byId[mid] ? STATUS_BAR_DESIGNS.find(function(d) { return d.id === mid; }) : STATUS_BAR_DESIGNS[0];
}

/** @param {'single'|'multi'} cast */
export function designsForCast(cast) {
  return STATUS_BAR_DESIGNS.filter(function(d) { return d.cast === cast; });
}

/** @param {'single'|'multi'} cast */
export function defaultDesignId(cast) {
  return cast === 'multi' ? 'multi_mahogany_dossier' : 'sheet_attr';
}

/**
 * 旧 layout/style/multi id → 新 design id
 * @param {string} [oldLayoutId]
 * @param {string} [oldStyleId]
 */
export function migrateDesignId(oldLayoutId, oldStyleId) {
  return migrateRaw(oldLayoutId, oldStyleId, KNOWN_IDS, defaultDesignId('single'));
}

/**
 * @param {{ designId: string, paths: any[], title?: string, castMode?: string, characters?: any[], mainName?: string, valueFn: Function, rawValueHtml?: boolean }} opts
 */
export function renderDesignHtml(opts) {
  var designId = getDesignById(opts && opts.designId).id;
  var theme = byId[designId] || byId.sheet_attr;
  var paths = Array.isArray(opts && opts.paths) ? opts.paths : [];
  var characters = Array.isArray(opts && opts.characters) ? opts.characters : [];
  var mainName = String((opts && opts.mainName) || (characters[0] && characters[0].name) || '');
  // 多人传全量路径：人人同套字段由主题按 role 分组；不再裁成仅主视角
  return theme.render(Object.assign({}, opts || {}, {
    paths: paths,
    allPaths: paths,
    designId: designId,
    mainName: mainName,
  }));
}

/** @param {string} designId */
export function designCss(designId) {
  var id = getDesignById(designId).id;
  var theme = byId[id] || byId.sheet_attr;
  return theme.css();
}
