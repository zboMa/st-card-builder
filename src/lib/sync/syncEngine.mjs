/**
 * 同步引擎：凭证、定时 5 分钟、手动同步、懒拉卡
 */
import { SYNC_INTERVAL_MS, DOC, buildCardIndexFromDrafts, cardDocId } from './docIds.mjs';
import { getLocalDb, getDoc, putDoc, getCardDraft, putCardDraft, replicateWithRemote, getCardIndex } from './pouch.mjs';
import { apiFetch } from '../publicConfig.mjs';

var timer = null;
var lastCred = null;
var lastSyncAt = null;
var lastSyncError = null;
var nextSyncAt = null;
var autoSyncEnabled = false;
var syncing = false;
var listeners = [];

export function onSyncEvent(fn) {
  listeners.push(fn);
  return function() {
    listeners = listeners.filter(function(x) { return x !== fn; });
  };
}

function emit(type, detail) {
  listeners.forEach(function(fn) {
    try { fn({ type: type, detail: detail }); } catch (e) { /* ignore */ }
  });
}

export function getSyncStatus() {
  return {
    syncing: syncing,
    lastSyncAt: lastSyncAt,
    lastSyncError: lastSyncError,
    nextSyncAt: nextSyncAt,
    autoSyncEnabled: autoSyncEnabled,
    hasCredentials: !!lastCred,
    intervalMs: SYNC_INTERVAL_MS,
  };
}

/** 距下次自动同步剩余毫秒；未调度返回 null */
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
  if (/Class extends|is not a constructor|import_events|EventEmitter/i.test(s)) {
    return '本地同步组件加载失败，请硬刷新页面后重试';
  }
  if (/unauthorized/i.test(s)) return '登录已失效，请重新登录';
  if (/credentials_failed/i.test(s)) return '无法获取同步凭证，请稍后重试';
  if (/Failed to fetch|NetworkError|network/i.test(s)) return '网络异常，请检查连接后重试';
  if (s.length > 140) return s.slice(0, 140) + '…';
  return s || '同步失败';
}

export async function fetchAuthStatus() {
  var res = await apiFetch('/api/auth/status');
  return res.json();
}

export async function fetchSyncCredentials() {
  var res = await apiFetch('/api/sync/credentials');
  if (res.status === 401) {
    lastCred = null;
    throw new Error('unauthorized');
  }
  if (!res.ok) {
    var t = await res.text();
    throw new Error('credentials_failed:' + res.status + ':' + t.slice(0, 120));
  }
  lastCred = await res.json();
  return lastCred;
}

export async function refreshCardIndexFromLocalDrafts(draftsMap) {
  var idx = buildCardIndexFromDrafts(draftsMap || {});
  await putDoc(idx);
  return idx;
}

/**
 * 全量同步（不含 secrets，除非 includeSecrets）
 */
export async function runSync(opts) {
  opts = opts || {};
  if (syncing) return { skipped: true, reason: 'busy' };
  syncing = true;
  lastSyncError = null;
  emit('start', {});
  try {
    if (!lastCred || opts.refreshCred) {
      await fetchSyncCredentials();
    }
    var includeSecrets = !!(opts.includeSecrets);
    // 同步偏好
    if (!includeSecrets) {
      var prefs = await getDoc(DOC.syncPrefs);
      includeSecrets = !!(prefs && prefs.syncSecrets);
    }
    var result = await replicateWithRemote(lastCred, { includeSecrets: includeSecrets });
    await mergePulledCardsIntoLocalStorage();
    lastSyncAt = new Date().toISOString();
    lastSyncError = null;
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

/** 将 Pouch 中的卡文档合并进 localStorage 草稿箱（云端列表 → 本地可点） */
async function mergePulledCardsIntoLocalStorage() {
  if (typeof localStorage === 'undefined') return;
  var DRAFTS_KEY = 'st_v3_builder_drafts';
  var drafts = {};
  try { drafts = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '{}') || {}; } catch (e) { drafts = {}; }

  var idx = await getCardIndex();
  var changed = false;
  for (var i = 0; i < idx.length; i++) {
    var meta = idx[i];
    if (!meta || !meta.id) continue;
    var existing = drafts[meta.id];
    if (!existing || existing._cloudStub) {
      var full = await getCardDraft(meta.id);
      if (full) {
        drafts[meta.id] = full;
        changed = true;
      } else if (!existing) {
        drafts[meta.id] = {
          draftId: meta.id,
          charName: meta.charName || '（云端）',
          updatedAt: meta.updatedAt || '',
          _cloudStub: true,
        };
        changed = true;
      }
    }
  }
  if (changed) {
    try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts)); } catch (e) { /* ignore */ }
    emit('drafts-merged', { count: Object.keys(drafts).length });
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
    runSync({}).catch(function(e) {
      console.warn('[sync] auto', e);
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

/**
 * 懒同步：确保某张卡正文在本地
 * 策略：先 pull（过滤由 replicate 全库完成时已带上；此处若无本地则触发一次 sync）
 */
export async function ensureCardLocal(cardId) {
  var id = String(cardId || '').trim();
  if (!id) return null;
  var local = await getCardDraft(id);
  if (local) return local;
  // 无本地则尝试同步后再读
  try {
    await runSync({});
  } catch (e) {
    console.warn('[sync] ensureCardLocal', e);
  }
  return getCardDraft(id);
}

export async function listCardsFromIndex() {
  return getCardIndex();
}

export async function upsertLocalCardAndIndex(cardId, draft, allDraftsMap) {
  await putCardDraft(cardId, draft);
  if (allDraftsMap) await refreshCardIndexFromLocalDrafts(allDraftsMap);
}

export { getCardDraft, putCardDraft, getLocalDb, DOC, cardDocId };
