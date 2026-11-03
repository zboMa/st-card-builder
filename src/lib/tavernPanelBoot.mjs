/**
 * 酒馆脚本：逻辑 API（无 DOM）。Vue 视图通过 window.__tavernScriptsPanelApi__ 调用。
 */
import {
  createEmptyTavernScript,
  normalizeTavernScript,
  normalizeTavernScriptList,
  moveTavernScript,
} from './tavernScripts.mjs';
import { appFeedback } from './ui/appMessage.mjs';
import {
  tavernScriptsStore,
  patchTavernScriptsUi,
  patchTavernEditor,
  emptyTavernEditor,
  setTavernLiveHint,
  setTavernStatus,
} from './store/tavernScriptsStore.mjs';
import { isAutoTavernName, buildTavernEditor } from './card-builder/panels/tavernViewModel.mjs';

export function initTavernScriptsPanel() {
  if (window.__tavernScriptsPanelInstalled__) return;
  window.__tavernScriptsPanelInstalled__ = true;

  var saveTimer = null;
  var lastRefreshFp = '';

  function ui() {
    return tavernScriptsStore.get();
  }

  function getList() {
    if (typeof window.__getTavernHelperScripts__ === 'function') {
      return normalizeTavernScriptList(window.__getTavernHelperScripts__());
    }
    return [];
  }

  function setList(list, options) {
    options = options || {};
    if (typeof window.__setTavernHelperScripts__ !== 'function') {
      setStatus('无法写入：缺少 __setTavernHelperScripts__', 'err');
      setLiveHint('写入失败', true);
      return false;
    }
    var silent = options.silent !== false;
    window.__setTavernHelperScripts__(normalizeTavernScriptList(list), { silent: silent });
    return true;
  }

  function refreshFingerprint(list, selectedId) {
    try {
      return JSON.stringify(list || []) + '|' + String(selectedId || '');
    } catch (e) {
      return String(Date.now());
    }
  }

  function syncRefreshFingerprint(list) {
    lastRefreshFp = refreshFingerprint(list != null ? list : getList(), ui().selectedId);
  }

  function setStatus(msg, kind) {
    var text = String(msg || '').trim();
    setTavernStatus(text, kind || '');
    if (!text) return;
    var isErr = kind === 'err';
    appFeedback(null, {
      message: text,
      level: isErr ? 'error' : 'success',
      channel: isErr ? 'auto' : 'toast',
    });
  }

  function setLiveHint(msg, isErr) {
    var text = String(msg || '').trim();
    setTavernLiveHint(text, isErr ? 'err' : (text ? 'ok' : ''));
    if (!text || !isErr) return;
    appFeedback(null, { message: text, level: 'warn', channel: 'toast' });
  }

  function findIndex(list, id) {
    var target = String(id || '');
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === target) return i;
    }
    return -1;
  }

  function fillEditor(script) {
    if (!script) {
      patchTavernScriptsUi({ selectedId: '', editor: emptyTavernEditor() });
      return;
    }
    patchTavernScriptsUi({
      selectedId: script.id,
      editor: buildTavernEditor(script),
    });
    setLiveHint('已实时保存', false);
  }

  function readEditor() {
    var e = ui().editor || emptyTavernEditor();
    var buttons;
    var data;
    try {
      buttons = JSON.parse(e.buttonJson || '[]');
      if (!Array.isArray(buttons)) throw new Error('按钮列表须为数组');
    } catch (err) {
      throw new Error('按钮列表 JSON 无效');
    }
    try {
      data = JSON.parse(e.dataJson || '{}');
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('附加数据须为对象');
      }
    } catch (err2) {
      throw new Error(err2 && String(err2.message).indexOf('附加') >= 0
        ? err2.message
        : '附加数据 JSON 无效');
    }
    return normalizeTavernScript({
      id: e.id,
      name: e.name,
      type: e.type || 'script',
      enabled: !!e.enabled,
      info: e.info,
      content: e.content,
      button: {
        enabled: !!e.buttonEnabled,
        buttons: buttons,
      },
      data: data,
    });
  }

  function persistEditor() {
    var selectedId = ui().selectedId;
    if (!selectedId) return false;
    var list = getList();
    var idx = findIndex(list, selectedId);
    if (idx < 0) return false;
    var edited;
    try {
      edited = readEditor();
    } catch (err) {
      var msg = String(err && err.message ? err.message : err);
      setLiveHint(msg, true);
      setStatus(msg, 'err');
      return false;
    }
    var name = String(edited.name || '').trim();
    if (!name) {
      setLiveHint('名称不能为空', true);
      setStatus('名称不能为空', 'err');
      return false;
    }
    for (var i = 0; i < list.length; i++) {
      if (i !== idx && list[i].name === name) {
        setLiveHint('名称重复', true);
        setStatus('名称与其它脚本重复', 'err');
        return false;
      }
    }
    edited.name = name;
    list[idx] = edited;
    if (!setList(list)) return false;
    patchTavernEditor({
      id: edited.id,
      name: edited.name,
      type: edited.type,
      enabled: edited.enabled,
      info: edited.info,
      content: edited.content,
      buttonEnabled: edited.button.enabled,
    });
    setLiveHint(
      isAutoTavernName(name) ? '已保存（可能被 MVU/状态栏再次覆盖）' : '已实时保存',
      false
    );
    setStatus('', '');
    syncRefreshFingerprint(list);
    return true;
  }

  function schedulePersist() {
    if (!ui().selectedId) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = null;
      persistEditor();
    }, 180);
  }

  function flushPending() {
    if (!saveTimer) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    persistEditor();
  }

  function select(id) {
    flushPending();
    var list = getList();
    var idx = findIndex(list, id);
    if (idx < 0) {
      fillEditor(null);
      syncRefreshFingerprint(list);
      return;
    }
    fillEditor(list[idx]);
    syncRefreshFingerprint(list);
  }

  function refresh() {
    var list = getList();
    var selectedId = ui().selectedId;
    var fp = refreshFingerprint(list, selectedId);
    if (fp === lastRefreshFp) return;
    lastRefreshFp = fp;
    if (!selectedId) return;
    var idx = findIndex(list, selectedId);
    if (idx < 0) {
      fillEditor(null);
      return;
    }
    fillEditor(list[idx]);
  }

  function deleteScript(id) {
    flushPending();
    var list = getList();
    var idx = findIndex(list, id);
    if (idx < 0) return;
    var name = list[idx] && list[idx].name;
    var tip = isAutoTavernName(name)
      ? '删除「' + name + '」？\n（MVU/状态栏下次注入可能重建）'
      : '删除脚本「' + (name || '') + '」？';
    if (!window.confirm(tip)) return;
    var wasSelected = ui().selectedId === id;
    list.splice(idx, 1);
    if (!setList(list)) return;
    if (wasSelected) {
      var next = list[Math.min(idx, list.length - 1)];
      fillEditor(next || null);
      syncRefreshFingerprint(list);
    } else {
      syncRefreshFingerprint(list);
    }
    setStatus('已删除', 'ok');
  }

  function addScript() {
    flushPending();
    var list = getList();
    var neu = createEmptyTavernScript({
      name: '新脚本 ' + (list.length + 1),
      info: '由 Card Builder 酒馆脚本面板创建',
    });
    list.push(neu);
    if (!setList(list)) return;
    fillEditor(neu);
    syncRefreshFingerprint(list);
    setStatus('已新建', 'ok');
  }

  function moveScript(id, delta) {
    flushPending();
    var list = getList();
    var idx = findIndex(list, id);
    if (idx < 0) return;
    var to = idx + (delta < 0 ? -1 : 1);
    if (to < 0 || to >= list.length) return;
    var moved = moveTavernScript(list, idx, to);
    if (!setList(moved)) return;
    syncRefreshFingerprint(moved);
  }

  function toggleScript(id, enabled) {
    flushPending();
    var list = getList();
    var idx = findIndex(list, id);
    if (idx < 0) return;
    list[idx] = Object.assign({}, list[idx], { enabled: !!enabled });
    if (!setList(list)) return;
    if (ui().selectedId === id) {
      fillEditor(list[idx]);
    }
    syncRefreshFingerprint(list);
    setStatus(enabled ? '已启用' : '已禁用', 'ok');
  }

  function updateEditor(patch) {
    patchTavernEditor(patch || {});
    schedulePersist();
  }

  function getSelectedIndex() {
    return findIndex(getList(), ui().selectedId);
  }

  window.__tavernScriptsPanelApi__ = {
    refresh: refresh,
    getSelectedIndex: getSelectedIndex,
    persistEditor: persistEditor,
    select: select,
    add: addScript,
    remove: deleteScript,
    move: moveScript,
    toggle: toggleScript,
    updateEditor: updateEditor,
    schedulePersist: schedulePersist,
    buildView: function () {
      return {
        selectedId: ui().selectedId,
      };
    },
  };

  window.addEventListener('card-builder-data-changed', refresh);
  window.addEventListener('card-draft-changed', function () {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    refresh();
  });
  window.addEventListener('app-view-changed', function (ev) {
    if (ev && ev.detail && ev.detail.view === 'tavern-scripts') refresh();
  });

  refresh();
  syncRefreshFingerprint();
}
