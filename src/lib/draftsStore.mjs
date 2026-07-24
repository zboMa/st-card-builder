/**
 * 卡草稿权威存储：IndexedDB（整 map）+ 内存缓存
 * 启动 hydrate：IDB 优先，否则从 localStorage 迁入并清除 LS 大 JSON
 */
import { DRAFTS_KEY } from './card-builder/state.mjs';
import { idbGetJson, idbSetJson } from './idbStore.mjs';

export var IDB_DRAFTS_KEY = 'cardDraftsV1';

var cache = null;
var hydrated = false;
var persistChain = Promise.resolve();
var lastPersistError = null;

function readLsDrafts() {
  try {
    return JSON.parse(localStorage.getItem(DRAFTS_KEY) || '{}') || {};
  } catch (e) {
    return {};
  }
}

function writeLsDrafts(drafts) {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts || {}));
}

function clearLsDrafts() {
  try { localStorage.removeItem(DRAFTS_KEY); } catch (e) { /* ignore */ }
}

/** 同步读取（hydrate 前回退 LS，供测试与早期调用） */
export function getDraftsMapSync() {
  if (cache && typeof cache === 'object') return cache;
  var ls = readLsDrafts();
  cache = ls;
  return cache;
}

/**
 * 启动时调用一次：IDB → 否则 LS 迁入 IDB
 * @returns {Promise<object>}
 */
export async function hydrateDraftsStore() {
  if (hydrated && cache) return cache;
  var fromIdb = null;
  try {
    fromIdb = await idbGetJson(IDB_DRAFTS_KEY);
  } catch (e) {
    fromIdb = null;
  }
  if (fromIdb && typeof fromIdb === 'object' && !Array.isArray(fromIdb)) {
    cache = fromIdb;
    clearLsDrafts();
  } else {
    var fromLs = readLsDrafts();
    cache = fromLs && typeof fromLs === 'object' ? fromLs : {};
    if (Object.keys(cache).length) {
      try {
        await idbSetJson(IDB_DRAFTS_KEY, cache);
        clearLsDrafts();
      } catch (e) {
        /* IDB 不可用时保留 LS */
        lastPersistError = e;
      }
    }
  }
  hydrated = true;
  return cache;
}

/**
 * 同步写缓存并异步落盘 IDB（失败回退 LS）
 * Node/无 IDB 环境同步写 LS，保证测试与早期调用可见
 * @returns {{ ok: boolean, error?: Error }}
 */
export function writeDraftsMapSync(drafts) {
  cache = drafts && typeof drafts === 'object' ? drafts : {};
  lastPersistError = null;
  var snap;
  try {
    snap = JSON.parse(JSON.stringify(cache));
  } catch (e) {
    snap = cache;
  }

  if (typeof indexedDB === 'undefined') {
    try {
      writeLsDrafts(snap);
      return { ok: true };
    } catch (e) {
      lastPersistError = e;
      return { ok: false, error: e };
    }
  }

  persistChain = persistChain.then(function() {
    return idbSetJson(IDB_DRAFTS_KEY, snap).then(function() {
      clearLsDrafts();
      return true;
    }).catch(function(err) {
      lastPersistError = err;
      try {
        writeLsDrafts(snap);
        return true;
      } catch (e2) {
        lastPersistError = e2;
        throw e2;
      }
    });
  }).catch(function(err) {
    lastPersistError = err;
  });
  return { ok: true };
}

/** 等待进行中的落盘（pagehide / flush） */
export function flushDraftsPersist() {
  return persistChain.then(function() {
    if (lastPersistError) {
      var err = lastPersistError;
      lastPersistError = null;
      return Promise.reject(err);
    }
    return true;
  });
}

export function getDraftsPersistError() {
  return lastPersistError;
}

/** 测试用：重置内存态 */
export function resetDraftsStoreForTests() {
  cache = null;
  hydrated = false;
  persistChain = Promise.resolve();
  lastPersistError = null;
}
