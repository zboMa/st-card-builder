/**
 * 壳层内置 8 套主题（与 statusBarThemes 分层独立）
 */

export var STORAGE_KEY = 'st_v3_app_theme';
export var DEFAULT_THEME_ID = 'nocturne';

/** @type {readonly { id: string, label: string, blurb: string, sample: string, mode: 'dark'|'light', themeColor: string }[]} */
export var APP_THEMES = Object.freeze([
  { id: 'nocturne', label: '夜庭', blurb: '雾紫玻璃 · 默认', sample: 'oklch(76% 0.095 310)', mode: 'dark', themeColor: '#1e1c24' },
  { id: 'ink', label: '墨庭', blurb: '暖墨纸 · 琥珀金', sample: 'oklch(72% 0.08 75)', mode: 'dark', themeColor: '#1f1a14' },
  { id: 'frost', label: '霜庭', blurb: '冷青玻璃', sample: 'oklch(74% 0.1 220)', mode: 'dark', themeColor: '#141a22' },
  { id: 'jade', label: '竹庭', blurb: '仙侠竹青', sample: 'oklch(72% 0.09 155)', mode: 'dark', themeColor: '#141f1a' },
  { id: 'rose', label: '玫庭', blurb: '浪漫柔粉', sample: 'oklch(74% 0.1 350)', mode: 'dark', themeColor: '#21141c' },
  { id: 'neon', label: '霓虹庭', blurb: '赛博 lounge', sample: 'oklch(72% 0.14 300)', mode: 'dark', themeColor: '#18141f' },
  { id: 'slate', label: '岩庭', blurb: '中性灰蓝', sample: 'oklch(70% 0.04 250)', mode: 'dark', themeColor: '#181a1f' },
  { id: 'daybreak', label: '昼庭', blurb: '浅色日间', sample: 'oklch(52% 0.12 285)', mode: 'light', themeColor: '#f4f2f8' },
]);

var ids = Object.create(null);
APP_THEMES.forEach(function(t) { ids[t.id] = true; });

/** @param {string} id */
export function isValidThemeId(id) {
  return !!ids[String(id || '')];
}

/** @param {string} id */
export function getThemeMeta(id) {
  var sid = String(id || '');
  for (var i = 0; i < APP_THEMES.length; i++) {
    if (APP_THEMES[i].id === sid) return APP_THEMES[i];
  }
  return APP_THEMES[0];
}
