/**
 * 卡草稿唯一权威：IndexedDB `cardDraftsV1` + 内存缓存
 */
import { idbGetJson, idbSetJson } from './idbStore.mjs';

export var IDB_DRAFTS_KEY = 'cardDraftsV1';

var cache = null;
var hydrated = false;
var persistChain = Promise.resolve();
var lastPersistError = null;

function emptyMap() {
  return {};
}

function asMap(drafts) {
  return drafts && typeof drafts === 'object' && !Array.isArray(drafts) ? drafts : emptyMap();
}

function snapshotMap(drafts) {
  var map = asMap(drafts);
  try {
    return JSON.parse(JSON.stringify(map));
  } catch (e) {
    return asMap(map);
  }
}

function hasIdb() {
  return typeof indexedDB !== 'undefined';
}

/** 同步读取内存缓存；未 hydrate 时返回空对象（不落盘） */
export function getDraftsMapSync() {
  if (cache && typeof cache === 'object' && !Array.isArray(cache)) return cache;
  cache = emptyMap();
  return cache;
}

export function isDraftsStoreHydrated() {
  return !!hydrated;
}

/**
 * 启动时调用一次：只从 IDB 加载（无 IDB 环境＝内存空表，供 Node 测试）
 * @returns {Promise<object>}
 */
export async function hydrateDraftsStore() {
  if (hydrated) return getDraftsMapSync();

  var pending = asMap(cache);

  if (!hasIdb()) {
    cache = pending;
    hydrated = true;
    return cache;
  }

  var fromIdb = null;
  try {
    fromIdb = await idbGetJson(IDB_DRAFTS_KEY);
  } catch (e) {
    lastPersistError = e;
    fromIdb = null;
  }

  if (fromIdb && typeof fromIdb === 'object' && !Array.isArray(fromIdb)) {
    cache = fromIdb;
  } else if (Object.keys(pending).length) {
    // hydrate 前仅写了内存、IDB 尚无记录：落盘 pending
    cache = pending;
    try {
      await idbSetJson(IDB_DRAFTS_KEY, snapshotMap(cache));
    } catch (e) {
      lastPersistError = e;
    }
  } else {
    cache = emptyMap();
  }
  hydrated = true;
  return cache;
}

/**
 * 写内存；hydrate 后异步落盘 IDB。无 IDB 时仅内存（测试）。
 * hydrate 前写内存但不写 IDB，避免空表冲掉库内数据。
 * @returns {{ ok: boolean, deferred?: boolean, error?: Error }}
 */
export function writeDraftsMapSync(drafts) {
  var snap = snapshotMap(drafts);
  cache = snap;
  lastPersistError = null;

  if (!hasIdb()) {
    hydrated = true;
    return { ok: true };
  }

  if (!hydrated) {
    return { ok: true, deferred: true };
  }

  persistChain = persistChain.then(function() {
    return idbSetJson(IDB_DRAFTS_KEY, snap).then(function() {
      return true;
    }).catch(function(err) {
      lastPersistError = err;
      throw err;
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
