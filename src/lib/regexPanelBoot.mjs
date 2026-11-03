/**
 * 正则面板 boot（无 DOM 的逻辑 API）。
 */
import {
  createEmptyRegexScript,
  normalizeRegexList,
  normalizeRegexScript,
  moveRegex,
  applyRegexScript,
} from './regexScripts.mjs';
import { appFeedback } from './ui/appMessage.mjs';
import { buildRegexEditor } from './card-builder/panels/regexViewModel.mjs';
import {
  emptyRegexEditor,
  patchRegexEditor,
  patchRegexUi,
  regexStore,
  setRegexLiveHint,
  setRegexPlacement as writeRegexPlacement,
  setRegexStatus,
} from './store/regexStore.mjs';

export function initRegexPanel() {
  if (typeof window === 'undefined' || window.__regexPanelInstalled__) return;
  window.__regexPanelInstalled__ = true;

  var saveTimer = null;
  var lastRefreshFp = '';

  function ui() {
    return regexStore.get();
  }

  function getList() {
    if (window.__getRegexScripts__) return normalizeRegexList(window.__getRegexScripts__());
    return [];
  }

  function setList(list, options) {
    options = options || {};
    if (!window.__setRegexScripts__) {
      setStatus('无法写入：缺少 __setRegexScripts__', 'danger');
      setLiveHint('写入失败', true);
      return false;
    }
    var silent = options.silent !== false;
    window.__setRegexScripts__(normalizeRegexList(list), { silent: silent });
    return true;
  }

  function refreshFingerprint(list) {
    try {
      return JSON.stringify(list) + '|' + ui().selectedId;
    } catch (e) {
      return String(Date.now());
    }
  }

  function syncRefreshFingerprint(list) {
    lastRefreshFp = refreshFingerprint(list != null ? list : getList());
  }

  function setStatus(msg, kind) {
    var text = String(msg || '').trim();
    var isErr = kind === 'danger' || kind === 'err' || kind === true;
    setRegexStatus(text, isErr ? 'err' : (text ? 'ok' : ''));
    if (!text) return;
    appFeedback(null, {
      message: text,
      level: isErr ? 'error' : 'success',
      channel: isErr ? 'auto' : 'toast',
    });
  }

  function setLiveHint(msg, isErr) {
    var text = String(msg || '').trim();
    setRegexLiveHint(text, isErr ? 'err' : (text ? 'ok' : ''));
    if (!text || !isErr) return;
    appFeedback(null, { message: text, level: 'warn', channel: 'toast' });
  }

  function findIndexById(list, id) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return i;
    }
    return -1;
  }

  function fillEditor(rx) {
    var editor = buildRegexEditor(rx);
    patchRegexUi({ selectedId: editor.id, editor: editor });
    setLiveHint('已实时保存', false);
  }

  function readEditor() {
    var e = ui().editor || emptyRegexEditor();
    var placement = Array.isArray(e.placement) ? e.placement.slice() : [];
    return normalizeRegexScript({
      id: e.id,
      scriptName: e.scriptName,
      findRegex: e.findRegex,
      replaceString: e.replaceString,
      placement: placement,
      disabled: e.disabled === true,
      markdownOnly: e.markdownOnly === true,
      promptOnly: e.promptOnly === true,
      runOnEdit: e.runOnEdit !== false,
      substituteRegex: e.substituteRegex === true,
      minDepth: e.minDepth === '' || e.minDepth == null ? null : Number(e.minDepth),
      maxDepth: e.maxDepth === '' || e.maxDepth == null ? null : Number(e.maxDepth),
    });
  }

  function persistEditor() {
    var selectedId = ui().selectedId;
    if (!selectedId) return false;
    var list = getList();
    var idx = findIndexById(list, selectedId);
    if (idx < 0) return false;
    var edited = readEditor();
    var name = String(edited.scriptName || '').trim();
    if (!name) {
      setLiveHint('脚本名称不能为空', true);
      setStatus('脚本名称不能为空', 'danger');
      return false;
    }
    for (var i = 0; i < list.length; i++) {
      if (i !== idx && list[i].scriptName === name) {
        setLiveHint('脚本名称重复', true);
        setStatus('脚本名称与其它条目重复', 'danger');
        return false;
      }
    }
    edited.scriptName = name;
    if (Array.isArray(list[idx].trimStrings)) {
      edited.trimStrings = list[idx].trimStrings.slice();
    }
    list[idx] = edited;
    if (!setList(list)) return false;
    setLiveHint('已实时保存', false);
    setStatus('');
    syncRefreshFingerprint(list);
    return true;
  }

  function clearSaveTimer() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
  }

  function flushPending() {
    if (!saveTimer) return true;
    clearSaveTimer();
    return persistEditor();
  }

  function schedulePersist() {
    if (!ui().selectedId) return;
    clearSaveTimer();
    saveTimer = setTimeout(function () {
      saveTimer = null;
      persistEditor();
    }, 180);
  }

  function updateEditor(patch) {
    if (!ui().selectedId) return;
    patchRegexEditor(patch);
    schedulePersist();
  }

  function setPlacement(placement, enabled) {
    if (!ui().selectedId) return;
    writeRegexPlacement(placement, enabled);
    schedulePersist();
  }

  function clearSelection() {
    patchRegexUi({ selectedId: '', editor: emptyRegexEditor() });
    setLiveHint('', false);
  }

  function select(index) {
    flushPending();
    var list = getList();
    if (index < 0 || index >= list.length) {
      clearSelection();
      syncRefreshFingerprint(list);
      return;
    }
    fillEditor(list[index]);
    syncRefreshFingerprint(list);
  }

  function refresh() {
    var list = getList();
    var fp = refreshFingerprint(list);
    if (fp === lastRefreshFp) return;
    lastRefreshFp = fp;
    var idx = findIndexById(list, ui().selectedId);
    if (idx >= 0) {
      fillEditor(list[idx]);
      return;
    }
    clearSelection();
    syncRefreshFingerprint(list);
  }

  function toggleAt(index) {
    flushPending();
    var list = getList();
    if (index < 0 || index >= list.length) return;
    list[index] = Object.assign({}, list[index], { disabled: !list[index].disabled });
    if (!setList(list)) return;
    if (list[index].id === ui().selectedId) fillEditor(list[index]);
    syncRefreshFingerprint(list);
    setStatus(list[index].disabled ? '已禁用' : '已启用');
  }

  function moveAt(index, direction) {
    flushPending();
    var list = getList();
    var to = direction === 'up' ? index - 1 : index + 1;
    var moved = moveRegex(list, index, to);
    if (!setList(moved)) return;
    syncRefreshFingerprint(moved);
  }

  function deleteAt(index) {
    flushPending();
    var list = getList();
    if (index < 0 || index >= list.length) return;
    var name = list[index] && list[index].scriptName;
    if (!confirm('删除正则「' + (name || '') + '」？')) return;
    clearSaveTimer();
    var selectedId = ui().selectedId;
    var deletedId = list[index].id;
    list.splice(index, 1);
    if (!setList(list)) return;
    if (selectedId && selectedId === deletedId) {
      select(Math.min(index, list.length - 1));
    } else {
      syncRefreshFingerprint(list);
    }
    setStatus('已删除');
  }

  function add() {
    flushPending();
    var list = getList();
    var neu = createEmptyRegexScript({ scriptName: '新正则 ' + (list.length + 1) });
    list.push(neu);
    if (!setList(list)) return;
    select(list.length - 1);
    setStatus('已新建');
  }

  function openTest() {
    var list = getList();
    var idx = findIndexById(list, ui().selectedId);
    var rx = idx >= 0 ? list[idx] : null;
    patchRegexUi({
      testOpen: true,
      testTip: rx ? ('当前：' + (rx.scriptName || '(未命名)')) : '未选中正则',
      testOutput: '',
      testError: '',
    });
  }

  function closeTest() {
    patchRegexUi({ testOpen: false });
  }

  function setTestInput(text) {
    patchRegexUi({ testInput: String(text != null ? text : '') });
  }

  function runParse() {
    var list = getList();
    var idx = findIndexById(list, ui().selectedId);
    if (idx < 0) {
      patchRegexUi({ testOutput: '', testError: '请先在列表中选中一条正则' });
      return;
    }
    var res = applyRegexScript(readEditor(), ui().testInput);
    patchRegexUi({
      testOutput: res.result,
      testError: res.ok ? '' : (res.error || '解析失败'),
    });
  }

  window.addEventListener('card-builder-data-changed', refresh);
  window.addEventListener('card-draft-changed', function () {
    clearSaveTimer();
    refresh();
  });
  window.addEventListener('app-view-changed', function (ev) {
    if (ev && ev.detail && ev.detail.view === 'regex') refresh();
  });

  window.__regexPanelApi__ = {
    refresh: refresh,
    getSelectedIndex: function () {
      return findIndexById(getList(), ui().selectedId);
    },
    persistEditor: persistEditor,
    updateEditor: updateEditor,
    setPlacement: setPlacement,
    schedulePersist: schedulePersist,
    select: select,
    toggleAt: toggleAt,
    moveAt: moveAt,
    deleteAt: deleteAt,
    add: add,
    openTest: openTest,
    closeTest: closeTest,
    setTestInput: setTestInput,
    runParse: runParse,
  };

  refresh();
  syncRefreshFingerprint();
}
