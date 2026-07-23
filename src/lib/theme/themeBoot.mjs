import {
  STORAGE_KEY,
  DEFAULT_THEME_ID,
  isValidThemeId,
  getThemeMeta,
} from './themeCatalog.mjs';

/** @returns {string} */
export function getThemeId() {
  var el = document.documentElement;
  var cur = el.getAttribute('data-app-theme');
  return isValidThemeId(cur) ? String(cur) : DEFAULT_THEME_ID;
}

function syncMetaThemeColor(id) {
  var meta = getThemeMeta(id);
  var node = document.querySelector('meta[name="theme-color"]');
  if (!node) {
    node = document.createElement('meta');
    node.setAttribute('name', 'theme-color');
    document.head.appendChild(node);
  }
  node.setAttribute('content', meta.themeColor);
}

/** @param {string} id */
export function applyTheme(id) {
  if (!isValidThemeId(id)) id = DEFAULT_THEME_ID;
  document.documentElement.setAttribute('data-app-theme', id);
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch (e) {}
  syncMetaThemeColor(id);
  window.dispatchEvent(new CustomEvent('app-theme-changed', { detail: { theme: id } }));
}

export function initTheme() {
  var id = DEFAULT_THEME_ID;
  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (isValidThemeId(saved)) id = String(saved);
  } catch (e) {}
  if (!isValidThemeId(document.documentElement.getAttribute('data-app-theme'))) {
    document.documentElement.setAttribute('data-app-theme', id);
  } else {
    id = getThemeId();
  }
  syncMetaThemeColor(id);
}
