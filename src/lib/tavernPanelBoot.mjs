/**
 * 酒馆脚本面板 boot（从 TavernScriptsPanel.astro 外提）
 */
import {
  createEmptyTavernScript,
  normalizeTavernScript,
  normalizeTavernScriptList,
  moveTavernScript,
} from './tavernScripts.mjs';

export function initTavernScriptsPanel() {
  var listEl = document.getElementById('thList');
  var emptyEl = document.getElementById('thEmpty');
  var countEl = document.getElementById('thListCount');
  var editorEl = document.getElementById('thEditor');
  var statusEl = document.getElementById('thStatus');
  var liveHintEl = document.getElementById('thLiveHint');
  var selectedIndex = -1;
  var filling = false;
  var autosaving = false;
  var saveTimer = null;
  var lastRefreshFp = '';

  if (!listEl) return;

  var EDITOR_IDS = [
    'thName', 'thInfo', 'thContent', 'thType',
    'thEnabled', 'thButtonEnabled', 'thButtonJson', 'thDataJson',
  ];

  function isAutoName(name) {
    var n = String(name || '');
    if (n === 'MVU' || n === '[状态栏]前端展示') return true;
    if (/zod$/i.test(n)) return true;
    return false;
  }

  function autoBadge(name) {
    var n = String(name || '');
    if (n === 'MVU') return 'MVU';
    if (n === '[状态栏]前端展示') return '状态栏';
    if (/zod$/i.test(n)) return 'MVU';
    return '';
  }

  function getList() {
    if (window.__getTavernHelperScripts__) {
      return normalizeTavernScriptList(window.__getTavernHelperScripts__());
    }
    return [];
  }

  function setList(list, options) {
    options = options || {};
    if (!window.__setTavernHelperScripts__) {
      setStatus('无法写入：缺少 __setTavernHelperScripts__', 'var(--color-danger)');
      setLiveHint('写入失败', true);
      return false;
    }
    autosaving = true;
    var silent = options.silent !== false;
    window.__setTavernHelperScripts__(normalizeTavernScriptList(list), { silent: silent });
    autosaving = false;
    return true;
  }

  function refreshFingerprint(list) {
    try {
      return JSON.stringify(list) + '|' + selectedIndex;
    } catch (e) {
      return String(Date.now());
    }
  }

  function syncRefreshFingerprint(list) {
    lastRefreshFp = refreshFingerprint(list != null ? list : getList());
  }

  function setStatus(msg, color) {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.style.color = color || 'var(--color-success)';
  }

  function setLiveHint(msg, isErr) {
    if (!liveHintEl) return;
    liveHintEl.textContent = msg || '';
    liveHintEl.classList.toggle('is-ok', !isErr && !!msg);
    liveHintEl.classList.toggle('is-err', !!isErr);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderList() {
    var list = getList();
    if (countEl) countEl.textContent = list.length + ' 条';
    if (emptyEl) emptyEl.hidden = list.length > 0;
    if (!listEl) return;
    listEl.innerHTML = '';
    list.forEach(function(s, i) {
      var badge = autoBadge(s.name);
      var row = document.createElement('div');
      row.className = 'th-item' + (i === selectedIndex ? ' is-active' : '') + (s.enabled ? '' : ' is-disabled');
      row.setAttribute('data-idx', String(i));
      row.setAttribute('role', 'button');
      row.tabIndex = 0;
      row.innerHTML =
        '<input type="checkbox" class="th-toggle" data-idx="' + i + '" ' + (s.enabled ? 'checked' : '') + ' title="启停" />' +
        '<div>' +
          '<div class="th-item-name">' + escapeHtml(s.name || '(未命名)') +
            (badge ? '<span class="th-badge">' + badge + '</span>' : '') +
          '</div>' +
          '<div class="th-item-meta">' + (s.enabled ? '已启用' : '已禁用') + ' · ' + escapeHtml(s.type || 'script') + '</div>' +
        '</div>' +
        '<div class="th-item-actions">' +
          '<button type="button" class="th-icon-btn" data-move="up" data-idx="' + i + '" title="上移">↑</button>' +
          '<button type="button" class="th-icon-btn" data-move="down" data-idx="' + i + '" title="下移">↓</button>' +
          '<button type="button" class="th-icon-btn is-danger" data-del="' + i + '" title="删除">×</button>' +
        '</div>';
      listEl.appendChild(row);
    });
  }

  function fillEditor(s) {
    if (!editorEl) return;
    filling = true;
    editorEl.hidden = false;
    document.getElementById('thId').value = s.id || '';
    document.getElementById('thName').value = s.name || '';
    document.getElementById('thType').value = s.type || 'script';
    document.getElementById('thEnabled').checked = s.enabled !== false;
    document.getElementById('thInfo').value = s.info || '';
    document.getElementById('thContent').value = s.content || '';
    var button = s.button && typeof s.button === 'object' ? s.button : { enabled: true, buttons: [] };
    document.getElementById('thButtonEnabled').checked = button.enabled !== false;
    try {
      document.getElementById('thButtonJson').value = JSON.stringify(
        Array.isArray(button.buttons) ? button.buttons : [],
        null,
        2
      );
    } catch (e) {
      document.getElementById('thButtonJson').value = '[]';
    }
    try {
      document.getElementById('thDataJson').value = JSON.stringify(s.data || {}, null, 2);
    } catch (e2) {
      document.getElementById('thDataJson').value = '{}';
    }
    setLiveHint('已实时保存', false);
    filling = false;
  }

  function readEditor() {
    var buttons;
    var data;
    try {
      buttons = JSON.parse(document.getElementById('thButtonJson').value || '[]');
      if (!Array.isArray(buttons)) throw new Error('按钮列表须为数组');
    } catch (e) {
      throw new Error('按钮列表 JSON 无效');
    }
    try {
      data = JSON.parse(document.getElementById('thDataJson').value || '{}');
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('附加数据须为对象');
      }
    } catch (e2) {
      throw new Error(e2 && e2.message && String(e2.message).indexOf('附加') >= 0
        ? e2.message
        : '附加数据 JSON 无效');
    }
    return normalizeTavernScript({
      id: document.getElementById('thId').value,
      name: document.getElementById('thName').value,
      type: document.getElementById('thType').value || 'script',
      enabled: document.getElementById('thEnabled').checked,
      info: document.getElementById('thInfo').value,
      content: document.getElementById('thContent').value,
      button: {
        enabled: document.getElementById('thButtonEnabled').checked,
        buttons: buttons,
      },
      data: data,
    });
  }

  /** 编辑区变更 → 写回当前卡权威数组 */
  function persistEditor() {
    if (filling || selectedIndex < 0) return;
    var list = getList();
    if (!list[selectedIndex]) return;
    var edited;
    try {
      edited = readEditor();
    } catch (err) {
      setLiveHint(String(err && err.message ? err.message : err), true);
      setStatus(String(err && err.message ? err.message : err), 'var(--color-danger)');
      return;
    }
    var name = String(edited.name || '').trim();
    if (!name) {
      setLiveHint('名称不能为空', true);
      setStatus('名称不能为空', 'var(--color-danger)');
      return;
    }
    for (var i = 0; i < list.length; i++) {
      if (i !== selectedIndex && list[i].name === name) {
        setLiveHint('名称重复', true);
        setStatus('名称与其它脚本重复', 'var(--color-danger)');
        return;
      }
    }
    edited.name = name;
    list[selectedIndex] = edited;
    if (!setList(list)) return;
    setLiveHint(
      isAutoName(name) ? '已保存（可能被 MVU/状态栏再次覆盖）' : '已实时保存',
      false
    );
    setStatus('');
    renderList();
    syncRefreshFingerprint(list);
  }

  function schedulePersist() {
    if (filling || selectedIndex < 0) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function() {
      saveTimer = null;
      persistEditor();
    }, 180);
  }

  function selectIndex(i) {
    var list = getList();
    if (i < 0 || i >= list.length) {
      selectedIndex = -1;
      if (editorEl) editorEl.hidden = true;
      renderList();
      return;
    }
    selectedIndex = i;
    fillEditor(list[i]);
    renderList();
    syncRefreshFingerprint(list);
  }

  function refresh() {
    if (autosaving) {
      renderList();
      return;
    }
    var list = getList();
    var fp = refreshFingerprint(list);
    if (fp === lastRefreshFp) return;
    lastRefreshFp = fp;
    if (selectedIndex >= list.length) selectedIndex = list.length - 1;
    if (selectedIndex >= 0) fillEditor(list[selectedIndex]);
    else if (editorEl) editorEl.hidden = true;
    renderList();
  }

  function deleteAt(idx) {
    var list = getList();
    if (idx < 0 || idx >= list.length) return;
    var name = list[idx] && list[idx].name;
    var tip = isAutoName(name)
      ? '删除「' + name + '」？\n（MVU/状态栏下次注入可能重建）'
      : '删除脚本「' + (name || '') + '」？';
    if (!confirm(tip)) return;
    list.splice(idx, 1);
    setList(list);
    if (selectedIndex === idx) selectedIndex = Math.min(idx, list.length - 1);
    else if (selectedIndex > idx) selectedIndex -= 1;
    refresh();
    setStatus('已删除');
  }

  listEl.addEventListener('change', function(e) {
    var t = e.target;
    if (!t.classList || !t.classList.contains('th-toggle')) return;
    var ti = parseInt(t.getAttribute('data-idx'), 10);
    var list = getList();
    if (list[ti]) {
      list[ti] = Object.assign({}, list[ti], { enabled: !!t.checked });
      setList(list);
      if (ti === selectedIndex) fillEditor(list[ti]);
      else renderList();
      setStatus(t.checked ? '已启用' : '已禁用');
    }
  });

  listEl.addEventListener('click', function(e) {
    var t = e.target;
    if (t.classList && t.classList.contains('th-toggle')) return;
    var delBtn = t.closest && t.closest('[data-del]');
    if (delBtn) {
      e.stopPropagation();
      deleteAt(parseInt(delBtn.getAttribute('data-del'), 10));
      return;
    }
    var moveBtn = t.closest && t.closest('[data-move]');
    if (moveBtn) {
      e.stopPropagation();
      var mi = parseInt(moveBtn.getAttribute('data-idx'), 10);
      var dir = moveBtn.getAttribute('data-move');
      var to = dir === 'up' ? mi - 1 : mi + 1;
      var moved = moveTavernScript(getList(), mi, to);
      setList(moved);
      if (selectedIndex === mi) selectedIndex = to;
      else if (selectedIndex === to) selectedIndex = mi;
      refresh();
      return;
    }
    var item = t.closest && t.closest('.th-item');
    if (item) selectIndex(parseInt(item.getAttribute('data-idx'), 10));
  });

  listEl.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var item = e.target.closest && e.target.closest('.th-item');
    if (!item || (e.target.closest && e.target.closest('.th-item-actions'))) return;
    if (e.target.classList && e.target.classList.contains('th-toggle')) return;
    e.preventDefault();
    selectIndex(parseInt(item.getAttribute('data-idx'), 10));
  });

  EDITOR_IDS.forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', schedulePersist);
    el.addEventListener('change', schedulePersist);
  });

  document.getElementById('thBtnAdd')?.addEventListener('click', function() {
    var list = getList();
    var neu = createEmptyTavernScript({
      name: '新脚本 ' + (list.length + 1),
      info: '由 Card Builder 酒馆脚本面板创建',
    });
    list.push(neu);
    setList(list);
    selectedIndex = list.length - 1;
    refresh();
    setStatus('已新建');
  });

  window.addEventListener('card-builder-data-changed', refresh);
  window.addEventListener('card-draft-changed', refresh);
  window.addEventListener('app-view-changed', function(ev) {
    if (ev && ev.detail && ev.detail.view === 'tavern-scripts') refresh();
  });

  refresh();
  syncRefreshFingerprint();
  window.__tavernScriptsPanelApi__ = {
    refresh: refresh,
    getSelectedIndex: function() { return selectedIndex; },
    persistEditor: persistEditor,
  };
}
