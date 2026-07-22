/**
 * 云端引擎：产品化 REST 存取（兼容旧 syncEngine 导出名）
 * 本地 LS/IDB 始终可离线使用；登录后保存走 API + outbox。
 */
import { SYNC_INTERVAL_MS, DOC, buildCardIndexFromDrafts, cardDocId } from './docIds.mjs';
import { clearLocalDirty, isLocalDirty } from './localDirty.mjs';
import { apiFetch } from '../publicConfig.mjs';
import {
  setCloudEnabled,
  isCloudEnabled,
  getCloudStatus,
  onCloudEvent,
  cloudSaveCard,
  cloudSaveAvatar,
  cloudDeleteCard,
  runCloudReconcile,
  ensureCardBundleLocal,
  pullCloudCardIndexAndMerge,
} from './cloudStore.mjs';
import { getOutboxSize } from './outbox.mjs';

var timer = null;
var lastSyncAt = null;
var lastSyncError = null;
var nextSyncAt = null;
var autoSyncEnabled = false;
var syncing = false;
var listeners = [];

export function onSyncEvent(fn) {
  listeners.push(fn);
  var offCloud = onCloudEvent(function(ev) {
    listeners.forEach(function(l) {
      try { l(ev); } catch (e) { /* ignore */ }
    });
  });
  return function() {
    listeners = listeners.filter(function(x) { return x !== fn; });
    offCloud();
  };
}

function emit(type, detail) {
  listeners.forEach(function(fn) {
    try { fn({ type: type, detail: detail }); } catch (e) { /* ignore */ }
  });
}

export function getSyncStatus() {
  var cloud = getCloudStatus();
  return {
    syncing: syncing || cloud.syncing,
    lastSyncAt: lastSyncAt || cloud.lastCloudAt,
    lastSyncError: lastSyncError || cloud.lastCloudError,
    nextSyncAt: nextSyncAt,
    autoSyncEnabled: autoSyncEnabled,
    hasCredentials: isCloudEnabled(),
    intervalMs: SYNC_INTERVAL_MS,
    localDirty: isLocalDirty() || getOutboxSize() > 0,
    outboxSize: getOutboxSize(),
    mode: 'rest',
  };
}

export function getMsUntilNextSync() {
  if (!autoSyncEnabled || nextSyncAt == null) return null;
  return Math.max(0, nextSyncAt - Date.now());
}

export function formatSyncCountdown(ms) {
  if (ms == null || !Number.isFinite(ms)) return '';
  var total = Math.max(0, Math.ceil(ms / 1000));
  var m = Math.floor(total / 60);
  var s = total % 60;
  return m + ':' + String(s).padStart(2, '0');
}

export function friendlySyncError(err) {
  var s = String(err && err.message || err || '');
  if (/unauthorized/i.test(s)) return '登录已失效，请重新登录';
  if (/credentials_failed|sync_credentials_removed/i.test(s)) return '请重新登录以使用云端存取';
  if (/Failed to fetch|NetworkError|network/i.test(s)) return '网络异常，已保留本地；恢复后自动上传';
  if (/conflict/i.test(s)) return '云端版本冲突，请刷新后重试或另存为新卡';
  if (s.length > 140) return s.slice(0, 140) + '…';
  return s || '云端操作失败';
}

export function computeShouldSkipSyncWhenClean(opts, state) {
  opts = opts || {};
  state = state || {};
  if (opts.force) return false;
  if (!opts.skipIfClean) return false;
  if (!state.lastSyncAt) return false;
  return !state.localDirty;
}

function shouldSkipSyncWhenClean(opts) {
  return computeShouldSkipSyncWhenClean(opts, {
    lastSyncAt: lastSyncAt,
    localDirty: isLocalDirty() || getOutboxSize() > 0,
  });
}

async function readSyncPrefsDoc() {
  try {
    var raw = localStorage.getItem('st_v3_sync_prefs_v1');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

async function patchSyncPrefs(patch) {
  var prefs = await readSyncPrefsDoc();
  var next = Object.assign({}, prefs, patch, { updatedAt: new Date().toISOString() });
  try {
    localStorage.setItem('st_v3_sync_prefs_v1', JSON.stringify(next));
  } catch (e) { /* ignore */ }
  return next;
}

export async function getAutoSyncPref() {
  var prefs = await readSyncPrefsDoc();
  return !!prefs.autoSync;
}

export async function setAutoSyncPref(on) {
  await patchSyncPrefs({ autoSync: !!on });
  return !!on;
}

export async function fetchAuthStatus() {
  var res = await apiFetch('/api/auth/status');
  return res.json();
}

/** @deprecated 旧凭证接口；现仅探测登录态并启用云端 */
export async function fetchSyncCredentials() {
  var st = await fetchAuthStatus();
  if (!st || !st.user || !st.user.id) {
    setCloudEnabled(false);
    throw new Error('unauthorized');
  }
  setCloudEnabled(true);
  return { ok: true, mode: 'rest', user: st.user };
}

export async function refreshCardIndexFromLocalDrafts(draftsMap) {
  return buildCardIndexFromDrafts(draftsMap || {});
}

/**
 * 云端对齐（替代全量 replicate）
 */
export async function runSync(opts) {
  opts = opts || {};
  if (syncing) return { skipped: true, reason: 'busy' };
  if (shouldSkipSyncWhenClean(opts)) {
    emit('skipped', { reason: 'clean' });
    if (autoSyncEnabled) armAutoSyncTimer();
    return { skipped: true, reason: 'clean' };
  }
  syncing = true;
  lastSyncError = null;
  emit('start', {});
  try {
    await fetchSyncCredentials();
    var result = await runCloudReconcile({
      uploadLocal: opts.uploadLocal !== false,
      hydrateAll: !!opts.hydrateAll,
    });
    lastSyncAt = result.at || new Date().toISOString();
    lastSyncError = null;
    clearLocalDirty();
    if (autoSyncEnabled) armAutoSyncTimer();
    emit('complete', { at: lastSyncAt, result: result, nextSyncAt: nextSyncAt });
    return { ok: true, at: lastSyncAt, result: result };
  } catch (e) {
    lastSyncError = String(e && e.message || e);
    emit('error', { message: lastSyncError });
    throw e;
  } finally {
    syncing = false;
  }
}

function clearAutoSyncTimerOnly() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function armAutoSyncTimer() {
  clearAutoSyncTimerOnly();
  nextSyncAt = Date.now() + SYNC_INTERVAL_MS;
  timer = setInterval(function() {
    runSync({ skipIfClean: true }).catch(function(e) {
      console.warn('[cloud] auto', e);
    });
  }, SYNC_INTERVAL_MS);
  emit('schedule', { nextSyncAt: nextSyncAt });
}

export function startAutoSync() {
  autoSyncEnabled = true;
  armAutoSyncTimer();
}

export function stopAutoSync() {
  autoSyncEnabled = false;
  clearAutoSyncTimerOnly();
  nextSyncAt = null;
  emit('schedule', { nextSyncAt: null });
}

export async function applyAutoSyncPref() {
  var on = await getAutoSyncPref();
  if (on) startAutoSync();
  else stopAutoSync();
  return on;
}

/** 确保某卡完整数据在本地（含关联小说/头像等） */
export async function ensureCardLocal(cardId) {
  var id = String(cardId || '').trim();
  if (!id) return null;
  try {
    if (!isCloudEnabled()) {
      var st = await fetchAuthStatus();
      if (st && st.user) setCloudEnabled(true);
    }
  } catch (e) { /* offline ok */ }
  return ensureCardBundleLocal(id, { force: false });
}

export async function upsertLocalCardAndIndex(cardId, draft, allDraftsMap) {
  // 本地已由 stateMachine 写入；此处推云端 + 头像
  await cloudSaveCard(cardId, draft);
  try {
    await cloudSaveAvatar(cardId);
  } catch (e) {
    console.warn('[cloud] avatar save', e);
  }
  return buildCardIndexFromDrafts(allDraftsMap || {});
}

export { getOutboxSize, pullCloudCardIndexAndMerge, DOC, cardDocId };
