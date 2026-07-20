/**
 * 制卡主侧状态机 — localStorage 草稿持久化
 * 仿照 novel/stateMachine.mjs 模式，但后端为 localStorage
 */
import {
  DRAFTS_KEY,
  CURRENT_KEY,
  genId,
  buildDraftSnapshot,
} from './state.mjs';
import { deepCopy } from '../utils.mjs';

var DEBOUNCE_MS = 500;

export function createCardStateMachine(state) {
  var saveTimer = null;
  var listeners = [];

  function getAllDrafts() {
    try {
      return JSON.parse(localStorage.getItem(DRAFTS_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function getDraft(id) {
    var dr = getAllDrafts();
    return dr[id] || null;
  }

  function saveDraft(opts) {
    opts = opts || {};
    if (!state.draftId) state.draftId = genId();
    var dr = getAllDrafts();
    dr[state.draftId] = buildDraftSnapshot(state);
    var saved = false;
    try {
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(dr));
      localStorage.setItem(CURRENT_KEY, state.draftId);
      saved = true;
    } catch (e) {
      var tip = opts.reason === 'avatar'
        ? '草稿元数据保存失败；头像已尝试写入 IndexedDB，请刷新后重试。'
        : '草稿保存失败（内容可能过大），请减少世界书条目或启用 IndexedDB。';
      if (typeof alert !== 'undefined') alert(tip);
      console.warn('[stateMachine] save failed', e);
    }
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
    return result;
  }

  function loadDraftIntoState(id) {
    var d = getDraft(id);
    if (!d) return false;
    state.draftId = id;
    localStorage.setItem(CURRENT_KEY, id);
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
    state.corruptionEnabled = !!d.corruptionEnabled;
    state.corruptionPreset = d.corruptionPreset || '5';
    state.corruptionCustomBrief = d.corruptionCustomBrief || '';
    state.corruptionStageNames = Array.isArray(d.corruptionStageNames) ? d.corruptionStageNames.slice() : [];
    state.corruptionSelectedNames = Array.isArray(d.corruptionSelectedNames) ? d.corruptionSelectedNames.slice() : [];
    state.corruptionDefaultFemaleOnly = d.corruptionDefaultFemaleOnly !== false;
    state.corruptionSyncStatusBar = d.corruptionSyncStatusBar !== false;
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
    state.ntlEnabled = false;
    state.ntlTabooTypes = [];
    state.ntlTabooItems = [];
    state.corruptionEnabled = false;
    state.corruptionPreset = '5';
    state.corruptionCustomBrief = '';
    state.corruptionStageNames = [];
    state.corruptionSelectedNames = [];
    state.corruptionDefaultFemaleOnly = true;
    state.corruptionSyncStatusBar = true;
  }

  function deleteDraft(id) {
    if (!id) return { ok: false, error: '缺少 id' };
    var dr = getAllDrafts();
    if (!dr[id]) return { ok: false, error: '卡不存在' };
    delete dr[id];
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(dr));
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
    copy.updatedAt = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    copy.avatarInIdb = !!(src.avatarInIdb || src.avatarBase64);
    if (copy.avatarInIdb) copy.avatarBase64 = '';
    dr[newId] = copy;
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(dr));
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
    d.updatedAt = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    dr[id] = d;
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(dr));
    if (id === state.draftId) state.charName = next;
    return { ok: true, id: id, name: next };
  }

  function getCurrentDraftId() {
    return state.draftId || '';
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
    getCurrentDraftId: getCurrentDraftId,
    on: on,
    snapshot: snapshot,
  };
}
