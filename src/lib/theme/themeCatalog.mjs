/**
 * 壳层精品场景主题（与 statusBarThemes 分层独立）
 */

export var STORAGE_KEY = 'st_v3_app_theme';
export var DEFAULT_THEME_ID = 'warm-paper';

/** v1 → v2 迁移 */
export var LEGACY_THEME_MAP = Object.freeze({
  ink: 'sumi-ink',
  frost: 'frost-shard',
  jade: 'nocturne',
  rose: 'nocturne',
  neon: 'nocturne',
  slate: 'nocturne',
  daybreak: 'nocturne',
  'bamboo-edge': 'nocturne',
  'fresh-lime': 'nocturne',
});

/**
 * @typedef {'none'|'sumi-ink'|'frost-shard'|'ember-blaze'|'water-wave'|'cloud-pavilion'|'morning-drizzle'|'doom-carrion'|'moon-haze'|'journal'} SceneId
 */

/** @type {readonly { id: string, label: string, tagline: string, blurb: string, previewClass: string, scene: SceneId, mode: 'dark'|'light', themeColor: string }[]} */
export var APP_THEMES = Object.freeze([
  {
    id: 'nocturne',
    label: '夜庭',
    tagline: '深色',
    blurb: '雾紫玻璃 · 制卡器原生',
    previewClass: 'theme-preview--nocturne',
    scene: 'none',
    mode: 'dark',
    themeColor: '#1e1c24',
  },
  {
    id: 'warm-paper',
    label: '暖纸',
    tagline: '默认',
    blurb: '午后窗光 · 米杏纸 · 赤陶',
    previewClass: 'theme-preview--warm-paper',
    scene: 'none',
    mode: 'light',
    themeColor: '#f6efe4',
  },
  {
    id: 'journal',
    label: '手账',
    tagline: '亮色',
    blurb: '点阵纸 · 红线 · 印章朱',
    previewClass: 'theme-preview--journal',
    scene: 'journal',
    mode: 'light',
    themeColor: '#f3ead4',
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
    id: 'water-wave',
    label: '水浪',
    tagline: '精品',
    blurb: '潮涌层波 · 深海青蓝',
    previewClass: 'theme-preview--water-wave',
    scene: 'water-wave',
    mode: 'dark',
    themeColor: '#0c1820',
  },
  {
    id: 'cloud-pavilion',
    label: '云楼雕粱',
    tagline: '精品',
    blurb: '飞檐云气 · 雕梁金漆',
    previewClass: 'theme-preview--cloud-pavilion',
    scene: 'cloud-pavilion',
    mode: 'dark',
    themeColor: '#1a1410',
  },
  {
    id: 'morning-drizzle',
    label: '清晨细雨',
    tagline: '精品',
    blurb: '窗上水珠 · 晓色微蓝',
    previewClass: 'theme-preview--morning-drizzle',
    scene: 'morning-drizzle',
    mode: 'dark',
    themeColor: '#141820',
  },
  {
    id: 'doom-carrion',
    label: '末日邪鸦',
    tagline: '精品',
    blurb: '断壁鸦影 · 锈铁余烬',
    previewClass: 'theme-preview--doom-carrion',
    scene: 'doom-carrion',
    mode: 'dark',
    themeColor: '#141210',
  },
  {
    id: 'moon-haze',
    label: '月影朦胧',
    tagline: '精品',
    blurb: '满月月华 · 薄雾银辉',
    previewClass: 'theme-preview--moon-haze',
    scene: 'moon-haze',
    mode: 'dark',
    themeColor: '#121218',
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
