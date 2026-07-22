/**
 * 用户配置镜像：提示词 / UI 偏好
 * 登录后本地一改 → 防抖写 Pouch → 仅 push prefs/*（不进用户数据 dirty）
 */
import { DOC } from './docIds.mjs';
import { getDoc, putDoc, replicateDocIdsWithRemote } from './pouch.mjs';
import { fetchSyncCredentials } from './syncEngine.mjs';
import { PROMPT_STORAGE_KEY } from '../promptStore.mjs';

export var FX_KEY = 'st_v3_fx_enabled';
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
  try { fx = localStorage.getItem(FX_KEY); } catch (e) { fx = null; }
  var currentId = '';
  try { currentId = localStorage.getItem(CURRENT_CARD_KEY) || ''; } catch (e) { currentId = ''; }
  return {
    fxEnabled: fx,
    currentCardId: currentId,
  };
}

export function applyLocalUiPrefs(data) {
  if (!data || typeof data !== 'object') return;
  if (data.fxEnabled != null) {
    try { localStorage.setItem(FX_KEY, String(data.fxEnabled)); } catch (e) { /* ignore */ }
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
  var overrides = readLocalPromptOverrides();
  await putDoc({
    _id: DOC.prompts,
    type: 'user-prefs-prompts',
    data: overrides,
    updatedAt: new Date().toISOString(),
  }, { skipDirty: true });
}

export async function mirrorUiPrefsToLocalPouch() {
  var ui = readLocalUiPrefs();
  await putDoc({
    _id: DOC.ui,
    type: 'user-prefs-ui',
    data: ui,
    updatedAt: new Date().toISOString(),
  }, { skipDirty: true });
}

async function pushPrefsToRemote() {
  try {
    await mirrorPromptsToLocalPouch();
    await mirrorUiPrefsToLocalPouch();
    var cred = await fetchSyncCredentials();
    await replicateDocIdsWithRemote(cred, [DOC.prompts, DOC.ui]);
  } catch (e) {
    console.warn('[sync] user prefs push', e);
  }
}

/** 调度防抖上传（未启用时只写本地 Pouch，不推远端） */
export function scheduleUserPrefsCloudPush() {
  if (typeof window === 'undefined') return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(function() {
    pushTimer = null;
    if (!enabled) {
      // 未登录：仍镜像到本地 Pouch，便于日后登录首推
      Promise.all([
        mirrorPromptsToLocalPouch().catch(function() {}),
        mirrorUiPrefsToLocalPouch().catch(function() {}),
      ]);
      return;
    }
    pushPrefsToRemote();
  }, DEBOUNCE_MS);
}

/**
 * 登录后拉取 prefs 并合并到 localStorage（云端有则覆盖本地对应文档）
 */
export async function pullUserPrefsFromCloud() {
  var cred = await fetchSyncCredentials();
  await replicateDocIdsWithRemote(cred, [DOC.prompts, DOC.ui]);
  var promptsDoc = await getDoc(DOC.prompts);
  if (promptsDoc && promptsDoc.data && typeof promptsDoc.data === 'object') {
    applyLocalPromptOverrides(promptsDoc.data);
  }
  var uiDoc = await getDoc(DOC.ui);
  if (uiDoc && uiDoc.data && typeof uiDoc.data === 'object') {
    applyLocalUiPrefs(uiDoc.data);
  }
  return {
    prompts: !!(promptsDoc && promptsDoc.data),
    ui: !!(uiDoc && uiDoc.data),
  };
}

/** 立即推一次（登录后可选） */
export async function pushUserPrefsToCloudNow() {
  if (!enabled) return { skipped: true };
  await pushPrefsToRemote();
  return { ok: true };
}
