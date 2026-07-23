/**
 * 用户配置：本地 LS + 登录后 REST 上传
 */
import { DOC } from './docIds.mjs';
import { cloudSavePrefs, isCloudEnabled } from './cloudStore.mjs';
import * as api from './cloudApi.mjs';
import { PROMPT_STORAGE_KEY } from '../promptStore.mjs';
import { SCENE_FX_KEY, applySceneTier } from '../theme/themeSceneTier.mjs';
import { STORAGE_KEY as APP_THEME_KEY } from '../theme/themeCatalog.mjs';

export var FX_KEY = SCENE_FX_KEY;
export var FX_KEY_LEGACY = 'st_v3_fx_enabled';
export var CURRENT_CARD_KEY = 'st_v3_builder_current_id';

var DEBOUNCE_MS = 800;
var pushTimer = null;
var enabled = false;

function parseJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    var v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : fallback;
  } catch (e) {
    return fallback;
  }
}

export function setUserPrefsSyncEnabled(on) {
  enabled = !!on;
  if (!enabled && pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
}

export function isUserPrefsSyncEnabled() {
  return !!enabled;
}

export function readLocalUiPrefs() {
  var fx = null;
  try { fx = localStorage.getItem(SCENE_FX_KEY); } catch (e) { fx = null; }
  if (fx === null) {
    try { fx = localStorage.getItem(FX_KEY_LEGACY); } catch (e) { fx = null; }
  }
  var theme = '';
  try { theme = localStorage.getItem(APP_THEME_KEY) || ''; } catch (e) { theme = ''; }
  var currentId = '';
  try { currentId = localStorage.getItem(CURRENT_CARD_KEY) || ''; } catch (e) { currentId = ''; }
  return {
    fxEnabled: fx,
    sceneFx: fx,
    appTheme: theme,
    currentCardId: currentId,
  };
}

export function applyLocalUiPrefs(data) {
  if (!data || typeof data !== 'object') return;
  var fxVal = data.sceneFx != null ? data.sceneFx : data.fxEnabled;
  if (fxVal != null) {
    try {
      localStorage.setItem(SCENE_FX_KEY, String(fxVal));
      localStorage.setItem(FX_KEY_LEGACY, String(fxVal));
    } catch (e) { /* ignore */ }
    applySceneTier();
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('scene-tier-changed'));
      } catch (e2) { /* ignore */ }
    }
  }
  if (data.appTheme != null && String(data.appTheme)) {
    try { localStorage.setItem(APP_THEME_KEY, String(data.appTheme)); } catch (e) { /* ignore */ }
  }
  if (data.currentCardId != null && String(data.currentCardId)) {
    try { localStorage.setItem(CURRENT_CARD_KEY, String(data.currentCardId)); } catch (e) { /* ignore */ }
  }
}

export function readLocalPromptOverrides() {
  try {
    return parseJson(localStorage.getItem(PROMPT_STORAGE_KEY), {});
  } catch (e) {
    return {};
  }
}

export function applyLocalPromptOverrides(data) {
  if (!data || typeof data !== 'object') return;
  try {
    localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify(data));
  } catch (e) { /* ignore */ }
}

export async function mirrorPromptsToLocalPouch() {
  // 本地已在 LS；无需 Pouch
  return true;
}

export async function mirrorUiPrefsToLocalPouch() {
  return true;
}

async function pushPrefsToRemote() {
  try {
    await cloudSavePrefs('prompts', readLocalPromptOverrides());
    await cloudSavePrefs('ui', readLocalUiPrefs());
  } catch (e) {
    console.warn('[cloud] user prefs push', e);
  }
}

export function scheduleUserPrefsCloudPush() {
  if (typeof window === 'undefined') return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(function() {
    pushTimer = null;
    if (!enabled) return;
    pushPrefsToRemote();
  }, DEBOUNCE_MS);
}

export async function pullUserPrefsFromCloud() {
  if (!isCloudEnabled()) {
    try {
      var st = await api.cloudGet('/api/auth/status');
      // cloudGet expects data API; use fetchAuth via apiFetch path — skip if not enabled
    } catch (e) { /* ignore */ }
  }
  var prompts = await api.getPrefs('prompts').catch(function() { return null; });
  var ui = await api.getPrefs('ui').catch(function() { return null; });
  if (prompts && prompts.data && typeof prompts.data === 'object') {
    applyLocalPromptOverrides(prompts.data);
  }
  if (ui && ui.data && typeof ui.data === 'object') {
    applyLocalUiPrefs(ui.data);
  }
  return {
    prompts: !!(prompts && prompts.data),
    ui: !!(ui && ui.data),
  };
}

export async function pushUserPrefsToCloudNow() {
  if (!enabled) return { skipped: true };
  await pushPrefsToRemote();
  return { ok: true };
}

export { DOC };
