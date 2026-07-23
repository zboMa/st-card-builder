/**
 * 小说工坊状态机 —— 封装 state 读写、持久化、变更通知
 *
 * 渐进迁移策略：
 * - `sm.state` 仍然可直接读写（兼容现有 browserApp 代码）
 * - `sm.set()` / `sm.get()` 为新增 API，逐步替换直接赋值
 * - `sm.save()` 统一持久化入口，替代分散的 persistNovelState 调用
 * - `sm.onChange()` 供未来的目标化渲染，替代 renderAll()
 */

import {
  idbGetJson,
  idbSetJson,
  idbDeleteJson,
  idbCopyJson,
  idbNovelKey,
} from "../idbStore.mjs";
import { createDefaultNovelState, hydrateNovelState } from "./state.mjs";

var NOVEL_STORAGE_KEY = "novelWorkshopV3";
var NOVEL_BUCKET_PREFIX = "novelWorkshopV3:card:";

function bucketKey(cardId) {
  return NOVEL_BUCKET_PREFIX + (cardId || "");
}

function legacyGlobalKey() {
  return NOVEL_STORAGE_KEY;
}

function legacyV2Key() {
  return "novelWorkshopV2";
}

/**
 * @param {object} [opts]
 * @param {function(string): Promise<object|null>} [opts.idbGet] 可注入（供测试）
 * @param {function(string, object): Promise<void>} [opts.idbSet]
 * @param {function(string): Promise<void>} [opts.idbDelete]
 * @param {function(): string|null} [opts.getCardId] 获取当前 cardId
 * @param {Function} [opts.debugLog]
 * @returns {object} stateMachine
 */
export function createNovelStateMachine(opts) {
  var o = opts || {};
  var _idbGet = o.idbGet || idbGetJson;
  var _idbSet = o.idbSet || idbSetJson;
  var _idbDelete = o.idbDelete || idbDeleteJson;
  var _getCardId =
    o.getCardId ||
    function () {
      return "";
    };
  var _debug = o.debugLog || function () {};

  /** @type {object} 公共可读写的 state 对象 */
  var state = createDefaultNovelState();
  var boundCardId = "";
  var _debounceTimer = null;
  var DEBOUNCE_MS = 280;
  var _listeners = [];

  function _bucketKey() {
    return bucketKey(boundCardId);
  }

  /**
   * 用新数据替换 state 的内容，但保持同一个对象引用不变。
   * 注意：browserApp/panels 里大量代码在 bind() 时做过 `var state = ctx.state`
   * 这类"只拷贝一次引用"的写法；若这里改成 `state = xxx` 重新赋值一个新对象，
   * 那些早先捕获的旧引用就再也收不到后续（如 bindCard 异步加载完成）的数据，
   * 表现为"刷新后卡绑定的小说就没了"。因此必须就地替换属性，而不是换对象。
   */
  function _replaceState(nextState) {
    var keys = Object.keys(state);
    for (var i = 0; i < keys.length; i++) delete state[keys[i]];
    Object.assign(state, nextState || {});
  }

  function _flush() {
    if (_debounceTimer) {
      clearTimeout(_debounceTimer);
      _debounceTimer = null;
    }
    _persist();
  }

  function _persist() {
    var raw = state;
    var key = _bucketKey();
    if (!key || key === NOVEL_BUCKET_PREFIX) return;
    var cardId = boundCardId;
    _idbSet(key, raw)
      .then(function () {
        if (cardId) {
          import("../sync/contentRev.mjs")
            .then(function (m) {
              m.bumpCardBundleTouch(cardId);
            })
            .catch(function () {
              /* ignore */
            });
        }
      })
      .catch(function (err) {
        _debug("stateMachine: IDB 写入失败，回退 localStorage", err);
        try {
          localStorage.setItem(key, JSON.stringify(raw));
        } catch (e) {
          _debug("stateMachine: localStorage 回退也失败", e);
        }
      });
  }

  function _debouncedSave() {
    if (_debounceTimer) clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(function () {
      _persist();
    }, DEBOUNCE_MS);
  }

  function _loadBucket(key) {
    return _idbGet(key).then(function (data) {
      if (data && typeof data === "object" && Object.keys(data).length)
        return data;
      return null;
    });
  }

  function _loadLegacy(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (data && typeof data === "object" && Object.keys(data).length)
        return data;
    } catch (e) {
      _debug("stateMachine: legacy load failed", e);
    }
    return null;
  }

  function _migrateOldGlobal(cardId, data) {
    var key = bucketKey(cardId);
    return _idbSet(key, data).then(function () {
      try {
        localStorage.removeItem(legacyGlobalKey());
      } catch (e) {
        console.warn("Removing legacy global novel data failed", e);
      }
      try {
        localStorage.removeItem(legacyV2Key());
      } catch (e) {
        console.warn("Removing legacy V2 novel data failed", e);
      }
      _debug("stateMachine: migrated legacy data to", key);
    });
  }

  function _notify(changedKeys) {
    var snapshot = Object.assign({}, state, {
      chapters: (state.chapters || []).slice(),
      entities: (state.entities || []).slice(),
      relations: (state.relations || []).slice(),
      wbEntries: (state.wbEntries || []).slice(),
      characters: (state.characters || []).slice(),
    });
    for (var i = 0; i < _listeners.length; i++) {
      try {
        _listeners[i](snapshot, changedKeys);
      } catch (e) {
        _debug("stateMachine: listener error", e);
      }
    }
  }

  var sm = {
    /** @type {object} 原始 state 对象，可直接读写 */
    state: state,

    /** 当前绑定的 cardId */
    getBoundCardId: function () {
      return boundCardId;
    },

    /**
     * 绑定新卡片：加载对应桶数据，替换当前 state
     * @returns {Promise<void>}
     */
    bindCard: function (cardId) {
      _flush();
      var id = String(cardId || _getCardId() || "");
      if (!id) {
        _replaceState(createDefaultNovelState());
        boundCardId = "";
        return Promise.resolve();
      }
      boundCardId = id;
      var key = _bucketKey();
      return _loadBucket(key).then(function (data) {
        if (data) {
          _replaceState(hydrateNovelState(data));
          _notify(["*"]);
          return;
        }
        return Promise.resolve()
          .then(function () {
            return _loadLegacy(legacyGlobalKey());
          })
          .then(function (globalData) {
            if (globalData && Object.keys(globalData).length) {
              return _migrateOldGlobal(id, globalData);
            }
            return Promise.resolve();
          })
          .then(function () {
            return _loadLegacy(legacyV2Key());
          })
          .then(function (v2Data) {
            if (v2Data && typeof v2Data === "string" && v2Data.trim()) {
              var migrated = hydrateNovelState({ sourceText: v2Data });
              return _idbSet(key, migrated);
            }
            return Promise.resolve();
          })
          .then(function () {
            return _loadBucket(key);
          })
          .then(function (d) {
            if (d) {
              _replaceState(hydrateNovelState(d));
            }
            _notify(["*"]);
          });
      });
    },

    /** 主动保存（绕过 debounce） */
    save: function () {
      _flush();
    },

    /** 延迟保存（滚动输入时用，减少 I/O） */
    saveDebounced: function () {
      _debouncedSave();
    },

    /** 重置为本卡默认空状态 */
    reset: function () {
      _replaceState(createDefaultNovelState());
      _persist();
      _notify(["*"]);
    },

    /** 删除当前卡的数据 */
    remove: function () {
      var key = _bucketKey();
      if (!key || key === NOVEL_BUCKET_PREFIX) return Promise.resolve();
      _idbDelete(key).catch(function (e) {
        _debug("stateMachine: delete failed", e);
      });
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn("Removing novel bucket from localStorage failed", e);
      }
      _replaceState(createDefaultNovelState());
      boundCardId = "";
      return Promise.resolve();
    },

    /** 复制数据到新卡 */
    copyTo: function (targetCardId) {
      _flush();
      return idbCopyJson(_bucketKey(), bucketKey(targetCardId));
    },

    /**
     * 捕获快照（供 undo）
     * @returns {string} JSON 快照
     */
    captureSnapshot: function () {
      return JSON.stringify(state);
    },

    /**
     * 恢复快照
     * @param {string} json
     */
    restoreSnapshot: function (json) {
      if (!json) return;
      var parsed;
      try {
        parsed = JSON.parse(json);
      } catch (e) {
        return;
      }
      _replaceState(hydrateNovelState(parsed));
      _persist();
    },

    /**
     * 注册变更监听（stateMachine 内部目前不强制使用——为未来 renderAll 拆分做准备）
     * @param {function(stateSnapshot, changedKeys: string[])} listener
     * @returns {function} 取消监听的函数
     */
    onChange: function (listener) {
      _listeners.push(listener);
      return function () {
        var idx = _listeners.indexOf(listener);
        if (idx >= 0) _listeners.splice(idx, 1);
      };
    },

    /**
     * 设置指定字段（渐进 API——当前与直接 state.xxx = yyy 等效，未来可加校验）
     */
    set: function (key, value) {
      state[key] = value;
      return sm;
    },

    /**
     * 读取指定字段
     */
    get: function (key) {
      return state[key];
    },

    // --- 内部用：暴露给 browserApp 迁移期 ---
    _persist: _persist,
    _notify: _notify,
  };

  return sm;
}
