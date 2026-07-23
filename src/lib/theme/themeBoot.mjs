import {
  STORAGE_KEY,
  DEFAULT_THEME_ID,
  migrateThemeId,
  getThemeMeta,
  sceneIdForTheme,
} from './themeCatalog.mjs';
import { applySceneTier } from './themeSceneTier.mjs';

/** @returns {string} */
export function getThemeId() {
  return migrateThemeId(document.documentElement.getAttribute('data-app-theme'));
}

function syncSceneAttr(themeId) {
  var scene = sceneIdForTheme(themeId);
  document.documentElement.setAttribute('data-app-scene', scene);
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
  id = migrateThemeId(id);
  document.documentElement.setAttribute('data-app-theme', id);
  syncSceneAttr(id);
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch (e) {}
  syncMetaThemeColor(id);
  applySceneTier();
  window.dispatchEvent(new CustomEvent('app-theme-changed', { detail: { theme: id } }));
}

export function initTheme() {
  var id = DEFAULT_THEME_ID;
  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    id = migrateThemeId(saved);
    if (saved && saved !== id) {
      localStorage.setItem(STORAGE_KEY, id);
    }
  } catch (e) {}
  var onHtml = migrateThemeId(document.documentElement.getAttribute('data-app-theme'));
  if (onHtml !== id) {
    document.documentElement.setAttribute('data-app-theme', id);
  }
  syncSceneAttr(id);
  syncMetaThemeColor(id);
  applySceneTier();
}
