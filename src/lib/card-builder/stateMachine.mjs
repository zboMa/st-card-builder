/**
 * 制卡主侧状态机 — 草稿持久化（IndexedDB 权威 + 内存缓存同步 API）
 * 仿照 novel/stateMachine.mjs；CURRENT_KEY 仍在 localStorage
 */
import {
  CURRENT_KEY,
  genId,
  buildDraftSnapshot,
  stampDraftUpdatedAt,
  draftContentEqual,
  draftDisplayName,
} from './state.mjs';
import { deepCopy } from '../utils.mjs';
import { attachContentRevToDraft } from '../sync/contentRev.mjs';
import {
  getDraftsMapSync,
  writeDraftsMapSync,
  flushDraftsPersist,
} from '../draftsStore.mjs';

var DEBOUNCE_MS = 500;

function tipSaveFailed(opts) {
  if (opts && opts.reason === 'avatar') {
    return '草稿元数据保存失败；头像已尝试写入 IndexedDB，请刷新后重试。';
  }
  return '草稿保存失败。请稍后重试；若仍失败可删掉不用的旧卡再试。';
}

function showSaveTip(msg) {
  try {
    if (typeof window !== 'undefined' && typeof window.__setStatus__ === 'function') {
      window.__setStatus__(msg);
      return;
    }
  } catch (e) { /* ignore */ }
  if (typeof console !== 'undefined') console.warn('[stateMachine]', msg);
}

export function createCardStateMachine(state) {
  var saveTimer = null;
  var listeners = [];

  function getAllDrafts() {
    return getDraftsMapSync() || {};
  }

  function getDraft(id) {
    var dr = getAllDrafts();
    return dr[id] || null;
  }

  function saveDraft(opts) {
    opts = opts || {};
    if (!state.draftId) state.draftId = genId();
    var dr = getAllDrafts();
    var prev = dr[state.draftId];
    // 内容未变时不刷新 updatedAt（pagehide/flush 刷新页面时常见，否则会误判云 dirty）
    if (prev && draftContentEqual(prev, state)) {
      state.updatedAt = prev.updatedAt || state.updatedAt || '';
      return { saved: true, drafts: dr, id: state.draftId, unchanged: true };
    }
    // 仅在真实落盘时刷新 updatedAt（列表渲染用的快照不得伪造时间，否则云状态永远 dirty）
    state.updatedAt = stampDraftUpdatedAt();
    dr[state.draftId] = attachContentRevToDraft(buildDraftSnapshot(state));
    var saved = false;
    try {
      var wrote = writeDraftsMapSync(dr);
      if (!wrote || wrote.ok === false) throw new Error('drafts_persist_rejected');
      localStorage.setItem(CURRENT_KEY, state.draftId);
      saved = true;
      try {
        if (typeof window !== 'undefined' && window.__scheduleUserPrefsCloudPush__) {
          window.__scheduleUserPrefsCloudPush__();
        }
      } catch (ePrefs) { /* ignore */ }
    } catch (e) {
      showSaveTip(tipSaveFailed(opts));
      console.warn('[stateMachine] save failed', e);
    }
    // 本地落盘即权威；卡包上云仅在卡管理「同步上云」或账户页 flush outbox 时进行
    return { saved: saved, drafts: dr, id: state.draftId };
  }

  function saveDebounced(opts) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function() {
      var result = saveDraft(opts);
      notifyListeners(result);
    }, DEBOUNCE_MS);
  }

  function flushSave() {
    clearTimeout(saveTimer);
    var result = saveDraft();
    notifyListeners(result);
    flushDraftsPersist().catch(function(err) {
      console.warn('[stateMachine] flush IDB failed', err);
      showSaveTip(tipSaveFailed({}));
    });
    return result;
  }

  function loadDraftIntoState(id) {
    var d = getDraft(id);
    if (!d) return false;
    state.draftId = id;
    localStorage.setItem(CURRENT_KEY, id);
    try {
      if (typeof window !== 'undefined' && window.__scheduleUserPrefsCloudPush__) {
        window.__scheduleUserPrefsCloudPush__();
      }
    } catch (ePrefs) { /* ignore */ }
    state.charName = d.charName || '';
    state.wbName = d.wbName || '';
    state.charDesc = d.charDesc || '';
    state.firstMes = d.firstMes || '';
    state.creatorNotes = d.creatorNotes || '';
    state.charTags = d.charTags || d.tags || [];
    state.worldbookEntries = d.worldbookEntries || [];
    state.regexScripts = d.regexScripts || [];
    state.tavernHelperScripts = Array.isArray(d.tavernHelperScripts) ? d.tavernHelperScripts : [];
    state.cardBuilderExtensions = Object.assign({}, d.cardBuilderExtensions || {});
    state.avatarInIdb = !!d.avatarInIdb;
    state.avatarBase64 = d.avatarBase64 || '';
    state.altGreetings = d.altGreetings || [];
    state.nsfwEnabled = !!d.nsfwEnabled;
    state.nsfwFlavor = d.nsfwFlavor || '';
    if (Array.isArray(d.nsfwFlavorItems) && d.nsfwFlavorItems.length) {
      state.nsfwFlavorItems = d.nsfwFlavorItems.map(function(it) {
        return { id: String((it && it.id) || ''), note: String((it && it.note) || '') };
      }).filter(function(it) { return it.id; });
      if (!state.nsfwFlavor && state.nsfwFlavorItems[0]) state.nsfwFlavor = state.nsfwFlavorItems[0].id;
    } else if (state.nsfwFlavor) {
      state.nsfwFlavorItems = [{ id: state.nsfwFlavor, note: '' }];
    } else {
      state.nsfwFlavorItems = [];
    }
    if (Array.isArray(d.eroticPostureItems) && d.eroticPostureItems.length) {
      state.eroticPostureItems = d.eroticPostureItems.map(function(it) {
        return { id: String((it && it.id) || ''), note: String((it && it.note) || '') };
      }).filter(function(it) { return it.id; });
    } else {
      state.eroticPostureItems = [];
    }
    if (Array.isArray(d.eroticSpeechItems) && d.eroticSpeechItems.length) {
      state.eroticSpeechItems = d.eroticSpeechItems.map(function(it) {
        return { id: String((it && it.id) || ''), note: String((it && it.note) || '') };
      }).filter(function(it) { return it.id; });
    } else {
      state.eroticSpeechItems = [];
    }
    state.ntlEnabled = !!d.ntlEnabled;
    if (Array.isArray(d.ntlTabooItems) && d.ntlTabooItems.length) {
      state.ntlTabooItems = d.ntlTabooItems.map(function(it) {
        return { id: String((it && it.id) || ''), note: String((it && it.note) || '') };
      }).filter(function(it) { return it.id; });
      state.ntlTabooTypes = state.ntlTabooItems.map(function(it) { return it.id; });
    } else {
      state.ntlTabooTypes = Array.isArray(d.ntlTabooTypes) ? d.ntlTabooTypes.slice() : [];
      state.ntlTabooItems = state.ntlTabooTypes.map(function(id) { return { id: id, note: '' }; });
    }
    if (Array.isArray(d.worldviewPresetItems) && d.worldviewPresetItems.length) {
      state.worldviewPresetItems = d.worldviewPresetItems.map(function(it) {
        return { id: String((it && it.id) || ''), note: String((it && it.note) || '') };
      }).filter(function(it) { return it.id; });
    } else {
      state.worldviewPresetItems = [];
    }
    state.adultWorldframe = d.adultWorldframe || '';
    state.adultWorldframeForced = d.adultWorldframeForced || '';
    state.corruptionEnabled = !!d.corruptionEnabled;
    state.corruptionPreset = d.corruptionPreset || '5';
    state.corruptionCustomBrief = d.corruptionCustomBrief || '';
    state.corruptionExtraNotes = d.corruptionExtraNotes || '';
    state.corruptionStageNames = Array.isArray(d.corruptionStageNames) ? d.corruptionStageNames.slice() : [];
    state.corruptionSelectedNames = Array.isArray(d.corruptionSelectedNames) ? d.corruptionSelectedNames.slice() : [];
    state.corruptionDefaultFemaleOnly = d.corruptionDefaultFemaleOnly !== false;
    state.corruptionSyncStatusBar = d.corruptionSyncStatusBar !== false;
    state.characterVersion = String(d.characterVersion != null ? d.characterVersion : '1.0').trim() || '1.0';
    state.versions = Array.isArray(d.versions) ? d.versions : [];
    state.updatedAt = d.updatedAt || '';
    return true;
  }

  function createBlank() {
    state.draftId = genId();
    state.charName = '';
    state.wbName = '';
    state.charDesc = '';
    state.firstMes = '';
    state.creatorNotes = '';
    state.charTags = [];
    state.worldbookEntries = [];
    state.regexScripts = [];
    state.tavernHelperScripts = [];
    state.cardBuilderExtensions = {};
    state.avatarBase64 = '';
    state.avatarInIdb = false;
    state.altGreetings = [];
    state.nsfwEnabled = false;
    state.nsfwFlavor = '';
    state.nsfwFlavorItems = [];
    state.eroticPostureItems = [];
    state.eroticSpeechItems = [];
    state.ntlEnabled = false;
    state.ntlTabooTypes = [];
    state.ntlTabooItems = [];
    state.worldviewPresetItems = [];
    state.adultWorldframe = '';
    state.adultWorldframeForced = '';
    state.corruptionEnabled = false;
    state.corruptionPreset = '5';
    state.corruptionCustomBrief = '';
    state.corruptionExtraNotes = '';
    state.corruptionStageNames = [];
    state.corruptionSelectedNames = [];
    state.corruptionDefaultFemaleOnly = true;
    state.corruptionSyncStatusBar = true;
    state.characterVersion = '1.0';
    state.versions = [];
  }

  function deleteDraft(id) {
    if (!id) return { ok: false, error: '缺少 id' };
    var dr = getAllDrafts();
    if (!dr[id]) return { ok: false, error: '卡不存在' };
    delete dr[id];
    writeDraftsMapSync(dr);
    if (id === state.draftId) {
      var ks = Object.keys(dr);
      if (ks.length > 0) {
        loadDraftIntoState(ks[0]);
      } else {
        createBlank();
      }
    }
    return { ok: true, deleted: id };
  }

  function duplicateDraft(id) {
    var dr = getAllDrafts();
    var src = dr[id];
    if (!src) return null;
    var newId = genId();
    var copy = deepCopy(src);
    copy.charName = draftDisplayName(src) + ' 副本';
    copy.updatedAt = stampDraftUpdatedAt();
    copy.avatarInIdb = !!(src.avatarInIdb || src.avatarBase64);
    if (copy.avatarInIdb) copy.avatarBase64 = '';
    dr[newId] = attachContentRevToDraft(copy);
    writeDraftsMapSync(dr);
    loadDraftIntoState(newId);
    return newId;
  }

  function renameDraft(id, newName) {
    var dr = getAllDrafts();
    var d = dr[id];
    if (!d) return { ok: false, error: '卡不存在' };
    var next = String(newName || '').trim();
    if (!next) return { ok: false, error: '名称为空' };
    d.charName = next;
    d.updatedAt = stampDraftUpdatedAt();
    dr[id] = attachContentRevToDraft(d);
    writeDraftsMapSync(dr);
    if (id === state.draftId) {
      state.charName = next;
      state.updatedAt = d.updatedAt;
    }
    return { ok: true, id: id, name: next };
  }

  function getCurrentDraftId() {
    return state.draftId || '';
  }

  /** 写入整张 drafts map（版本/发布等已组装好对象时使用） */
  function writeDraftsMap(dr, opts) {
    opts = opts || {};
    var next = dr || {};
    Object.keys(next).forEach(function(k) {
      if (next[k] && typeof next[k] === 'object') {
        next[k] = attachContentRevToDraft(next[k]);
      }
    });
    try {
      writeDraftsMapSync(next);
      var result = { saved: true, drafts: next, id: state.draftId };
      if (opts.notify !== false) notifyListeners(result);
      return Object.assign({ ok: true }, result);
    } catch (e) {
      console.warn('[stateMachine] writeDraftsMap failed', e);
      showSaveTip(tipSaveFailed({}));
      return { ok: false, drafts: next };
    }
  }

  /** 合并 patch 到某条草稿（重命名/头像迁移等） */
  function patchDraftRecord(id, patch, opts) {
    opts = opts || {};
    var dr = getAllDrafts();
    if (!dr[id]) return { ok: false, error: 'not_found' };
    dr[id] = Object.assign({}, dr[id], patch || {});
    var out = writeDraftsMap(dr, { notify: opts.notify });
    if (id === state.draftId && patch) {
      Object.keys(patch).forEach(function(k) {
        if (Object.prototype.hasOwnProperty.call(state, k)) state[k] = dr[id][k];
      });
    }
    return Object.assign({ ok: true, id: id, draft: dr[id] }, out);
  }

  function on(fn) {
    listeners.push(fn);
  }

  function notifyListeners(result) {
    listeners.forEach(function(fn) {
      try { fn(result); } catch (e) { console.warn('Draft listener notification failed', e); }
    });
  }

  function snapshot() {
    var snap = getAllDrafts();
    return { drafts: snap, id: state.draftId };
  }

  return {
    /** 与 createCardBuilderContext 共享的同一 state 引用 */
    state: state,
    getAllDrafts: getAllDrafts,
    getDraft: getDraft,
    saveDraft: saveDraft,
    saveDebounced: saveDebounced,
    flushSave: flushSave,
    loadDraftIntoState: loadDraftIntoState,
    createBlank: createBlank,
    deleteDraft: deleteDraft,
    duplicateDraft: duplicateDraft,
    renameDraft: renameDraft,
    writeDraftsMap: writeDraftsMap,
    patchDraftRecord: patchDraftRecord,
    getCurrentDraftId: getCurrentDraftId,
    on: on,
    snapshot: snapshot,
  };
}
