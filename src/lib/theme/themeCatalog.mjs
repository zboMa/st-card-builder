/**
 * 壳层精品场景主题（与 statusBarThemes 分层独立）
 */

export var STORAGE_KEY = 'st_v3_app_theme';
export var DEFAULT_THEME_ID = 'nocturne';

/** v1 → v2 迁移 */
export var LEGACY_THEME_MAP = Object.freeze({
  ink: 'sumi-ink',
  frost: 'frost-shard',
  jade: 'bamboo-edge',
  rose: 'nocturne',
  neon: 'nocturne',
  slate: 'nocturne',
  daybreak: 'nocturne',
});

/**
 * @typedef {'none'|'sumi-ink'|'frost-shard'|'ember-blaze'|'bamboo-edge'} SceneId
 */

/** @type {readonly { id: string, label: string, tagline: string, blurb: string, previewClass: string, scene: SceneId, mode: 'dark'|'light', themeColor: string }[]} */
export var APP_THEMES = Object.freeze([
  {
    id: 'nocturne',
    label: '夜庭',
    tagline: '默认',
    blurb: '雾紫玻璃 · 制卡器原生',
    previewClass: 'theme-preview--nocturne',
    scene: 'none',
    mode: 'dark',
    themeColor: '#1e1c24',
  },
  {
    id: 'sumi-ink',
    label: '水墨',
    tagline: '精品',
    blurb: '宣纸墨晕 · 黑白灰 · 朱砂点题',
    previewClass: 'theme-preview--sumi-ink',
    scene: 'sumi-ink',
    mode: 'dark',
    themeColor: '#141414',
  },
  {
    id: 'frost-shard',
    label: '碎冰寒霜',
    tagline: '精品',
    blurb: '冰裂霜雾 · 刃光冷青',
    previewClass: 'theme-preview--frost-shard',
    scene: 'frost-shard',
    mode: 'dark',
    themeColor: '#121820',
  },
  {
    id: 'ember-blaze',
    label: '烈焰',
    tagline: '精品',
    blurb: '余烬锻铁 · 暖浪流火',
    previewClass: 'theme-preview--ember-blaze',
    scene: 'ember-blaze',
    mode: 'dark',
    themeColor: '#1a1210',
  },
  {
    id: 'bamboo-edge',
    label: '翠竹风刀',
    tagline: '精品',
    blurb: '竹影风纹 · 剑意翠青',
    previewClass: 'theme-preview--bamboo-edge',
    scene: 'bamboo-edge',
    mode: 'dark',
    themeColor: '#101a14',
  },
]);

var ids = Object.create(null);
APP_THEMES.forEach(function(t) { ids[t.id] = true; });

/** @param {string|null|undefined} id */
export function migrateThemeId(id) {
  var sid = String(id || '').trim();
  if (!sid) return DEFAULT_THEME_ID;
  if (ids[sid]) return sid;
  var mapped = LEGACY_THEME_MAP[sid];
  if (mapped && ids[mapped]) return mapped;
  return DEFAULT_THEME_ID;
}

/** @param {string} id */
export function isValidThemeId(id) {
  return !!ids[migrateThemeId(id)];
}

/** @param {string} id */
export function getThemeMeta(id) {
  var sid = migrateThemeId(id);
  for (var i = 0; i < APP_THEMES.length; i++) {
    if (APP_THEMES[i].id === sid) return APP_THEMES[i];
  }
  return APP_THEMES[0];
}

/** @param {string} id */
export function sceneIdForTheme(id) {
  return getThemeMeta(id).scene;
}
