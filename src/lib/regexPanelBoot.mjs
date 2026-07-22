/**
 * 正则面板 boot（从 RegexPanel.astro 外提）
 */
import {
  createEmptyRegexScript,
  normalizeRegexList,
  normalizeRegexScript,
  moveRegex,
  applyRegexScript,
  placementLabel,
} from './regexScripts.mjs';

export function initRegexPanel() {
  var listEl = document.getElementById('rxList');
  var emptyEl = document.getElementById('rxEmpty');
  var countEl = document.getElementById('rxListCount');
  var editorEl = document.getElementById('rxEditor');
  var statusEl = document.getElementById('rxStatus');
  var liveHintEl = document.getElementById('rxLiveHint');
  var testModal = document.getElementById('rxTestModal');
  var selectedIndex = -1;
  var filling = false;
  var autosaving = false;
  var saveTimer = null;
  var lastRefreshFp = '';

  if (!listEl) return;

  // MVU / 状态栏自动注入名，仅作提示，不禁止编辑
  var KNOWN_AUTO = {
    '[不发送]去除变量更新': 'MVU',
    '[美化]变量更新状态卡': 'MVU',
    '[美化]状态栏展示': '状态栏',
  };

  var EDITOR_IDS = [
    'rxScriptName', 'rxFind', 'rxReplace',
    'rxPlaceUser', 'rxPlaceAi', 'rxPlaceSlash', 'rxPlaceWorld', 'rxPlaceReason',
    'rxMinDepth', 'rxMaxDepth',
    'rxDisabled', 'rxRunOnEdit', 'rxSubstitute', 'rxMarkdownOnly', 'rxPromptOnly',
  ];

  function getList() {
    if (window.__getRegexScripts__) return normalizeRegexList(window.__getRegexScripts__());
    return [];
  }

  function setList(list, options) {
    options = options || {};
    if (!window.__setRegexScripts__) {
      setStatus('无法写入：缺少 __setRegexScripts__', 'var(--color-danger)');
      setLiveHint('写入失败', true);
      return false;
    }
    autosaving = true;
    // 默认 silent：面板内已 renderList，避免 card-builder-data-changed 自刷循环
    var silent = options.silent !== false;
    window.__setRegexScripts__(normalizeRegexList(list), { silent: silent });
    autosaving = false;
    return true;
  }

  /** 列表 + 选中项指纹，用于跳过无变化 refresh */
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
    list.forEach(function(rx, i) {
      var auto = KNOWN_AUTO[rx.scriptName];
      // 必须用 div：button 内不可嵌套 checkbox / 子 button，否则点击失效
      var row = document.createElement('div');
      row.className = 'rx-item' + (i === selectedIndex ? ' is-active' : '') + (rx.disabled ? ' is-disabled' : '');
      row.setAttribute('data-idx', String(i));
      row.setAttribute('role', 'button');
      row.tabIndex = 0;
      row.innerHTML =
        '<input type="checkbox" class="rx-toggle" data-idx="' + i + '" ' + (rx.disabled ? '' : 'checked') + ' title="启停" />' +
        '<div>' +
          '<div class="rx-item-name">' + escapeHtml(rx.scriptName || '(未命名)') +
            (auto ? '<span class="rx-badge">' + auto + '</span>' : '') +
          '</div>' +
          '<div class="rx-item-meta">' + (rx.disabled ? '已禁用 · ' : '') + placementLabel(rx.placement) + '</div>' +
        '</div>' +
        '<div class="rx-item-actions">' +
          '<button type="button" class="rx-icon-btn" data-move="up" data-idx="' + i + '" title="上移">↑</button>' +
          '<button type="button" class="rx-icon-btn" data-move="down" data-idx="' + i + '" title="下移">↓</button>' +
          '<button type="button" class="rx-icon-btn is-danger" data-del="' + i + '" title="删除">×</button>' +
        '</div>';
      listEl.appendChild(row);
    });
  }

  function fillEditor(rx) {
    if (!editorEl) return;
    filling = true;
    editorEl.hidden = false;
    document.getElementById('rxId').value = rx.id || '';
    document.getElementById('rxScriptName').value = rx.scriptName || '';
    document.getElementById('rxFind').value = rx.findRegex || '';
    document.getElementById('rxReplace').value = rx.replaceString || '';
    document.getElementById('rxPlaceUser').checked = (rx.placement || []).indexOf(1) >= 0;
    document.getElementById('rxPlaceAi').checked = (rx.placement || []).indexOf(2) >= 0;
    document.getElementById('rxPlaceSlash').checked = (rx.placement || []).indexOf(3) >= 0;
    document.getElementById('rxPlaceWorld').checked = (rx.placement || []).indexOf(5) >= 0;
    document.getElementById('rxPlaceReason').checked = (rx.placement || []).indexOf(6) >= 0;
    document.getElementById('rxDisabled').checked = !!rx.disabled;
    document.getElementById('rxMarkdownOnly').checked = !!rx.markdownOnly;
    document.getElementById('rxPromptOnly').checked = !!rx.promptOnly;
    document.getElementById('rxRunOnEdit').checked = rx.runOnEdit !== false;
    document.getElementById('rxSubstitute').checked = !!rx.substituteRegex;
    document.getElementById('rxMinDepth').value = rx.minDepth == null ? '' : String(rx.minDepth);
    document.getElementById('rxMaxDepth').value = rx.maxDepth == null ? '' : String(rx.maxDepth);
    setLiveHint('已实时保存', false);
    filling = false;
  }

  function readEditor() {
    var placement = [];
    if (document.getElementById('rxPlaceUser').checked) placement.push(1);
    if (document.getElementById('rxPlaceAi').checked) placement.push(2);
    if (document.getElementById('rxPlaceSlash').checked) placement.push(3);
    if (document.getElementById('rxPlaceWorld').checked) placement.push(5);
    if (document.getElementById('rxPlaceReason').checked) placement.push(6);
    var minRaw = document.getElementById('rxMinDepth').value;
    var maxRaw = document.getElementById('rxMaxDepth').value;
    return normalizeRegexScript({
      id: document.getElementById('rxId').value,
      scriptName: document.getElementById('rxScriptName').value,
      findRegex: document.getElementById('rxFind').value,
      replaceString: document.getElementById('rxReplace').value,
      placement: placement,
      disabled: document.getElementById('rxDisabled').checked,
      markdownOnly: document.getElementById('rxMarkdownOnly').checked,
      promptOnly: document.getElementById('rxPromptOnly').checked,
      runOnEdit: document.getElementById('rxRunOnEdit').checked,
      substituteRegex: document.getElementById('rxSubstitute').checked,
      minDepth: minRaw === '' ? null : Number(minRaw),
      maxDepth: maxRaw === '' ? null : Number(maxRaw),
    });
  }

  /** 编辑区变更 → 写回当前卡权威数组（经 __setRegexScripts__ 防抖落盘） */
  function persistEditor() {
    if (filling || selectedIndex < 0) return;
    var list = getList();
    if (!list[selectedIndex]) return;
    var edited = readEditor();
    var name = String(edited.scriptName || '').trim();
    if (!name) {
      setLiveHint('脚本名称不能为空', true);
      setStatus('脚本名称不能为空', 'var(--color-danger)');
      return;
    }
    for (var i = 0; i < list.length; i++) {
      if (i !== selectedIndex && list[i].scriptName === name) {
        setLiveHint('脚本名称重复', true);
        setStatus('脚本名称与其它条目重复', 'var(--color-danger)');
        return;
      }
    }
    edited.scriptName = name;
    // 保留原 trimStrings，避免编辑时丢字段
    if (Array.isArray(list[selectedIndex].trimStrings)) {
      edited.trimStrings = list[selectedIndex].trimStrings.slice();
    }
    list[selectedIndex] = edited;
    if (!setList(list)) return;
    setLiveHint('已实时保存', false);
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
    var name = list[idx] && list[idx].scriptName;
    if (!confirm('删除正则「' + (name || '') + '」？')) return;
    list.splice(idx, 1);
    setList(list);
    if (selectedIndex === idx) selectedIndex = Math.min(idx, list.length - 1);
    else if (selectedIndex > idx) selectedIndex -= 1;
    refresh();
    setStatus('已删除');
  }

  function openTestModal() {
    if (!testModal) return;
    var tip = document.getElementById('rxTestTip');
    var list = getList();
    var rx = selectedIndex >= 0 ? list[selectedIndex] : null;
    if (tip) tip.textContent = rx ? ('当前：' + (rx.scriptName || '(未命名)')) : '未选中正则';
    document.getElementById('rxTestOutput').value = '';
    var errEl = document.getElementById('rxTestErr');
    if (errEl) { errEl.hidden = true; errEl.textContent = ''; }
    // 挂到 body，避免 .panel transform/overflow 把 fixed 困成内嵌层
    if (!testModal._rxModalHome) testModal._rxModalHome = testModal.parentNode;
    document.body.appendChild(testModal);
    testModal.hidden = false;
    testModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rx-modal-open');
  }

  function closeTestModal() {
    if (!testModal) return;
    testModal.hidden = true;
    testModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rx-modal-open');
    if (testModal._rxModalHome && testModal.parentNode !== testModal._rxModalHome) {
      testModal._rxModalHome.appendChild(testModal);
    }
  }

  function runParse() {
    var errEl = document.getElementById('rxTestErr');
    var outEl = document.getElementById('rxTestOutput');
    var list = getList();
    if (selectedIndex < 0 || !list[selectedIndex]) {
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = '请先在列表中选中一条正则';
      }
      if (outEl) outEl.value = '';
      return;
    }
    // 优先用编辑区当前值（可能尚未防抖落盘）
    var rx = editorEl && !editorEl.hidden ? readEditor() : list[selectedIndex];
    var text = document.getElementById('rxTestInput').value;
    var res = applyRegexScript(rx, text);
    if (errEl) {
      errEl.hidden = res.ok;
      errEl.textContent = res.ok ? '' : (res.error || '解析失败');
    }
    if (outEl) outEl.value = res.result;
  }

  /** 列表启停：用 change 更可靠（避免 click 与行选中冲突） */
  listEl.addEventListener('change', function(e) {
    var t = e.target;
    if (!t.classList || !t.classList.contains('rx-toggle')) return;
    var ti = parseInt(t.getAttribute('data-idx'), 10);
    var list = getList();
    if (list[ti]) {
      list[ti] = Object.assign({}, list[ti], { disabled: !t.checked });
      setList(list);
      if (ti === selectedIndex) fillEditor(list[ti]);
      else renderList();
      setStatus(t.checked ? '已启用' : '已禁用');
    }
  });

  listEl.addEventListener('click', function(e) {
    var t = e.target;
    if (t.classList && t.classList.contains('rx-toggle')) return;
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
      var moved = moveRegex(getList(), mi, to);
      setList(moved);
      if (selectedIndex === mi) selectedIndex = to;
      else if (selectedIndex === to) selectedIndex = mi;
      refresh();
      return;
    }
    var item = t.closest && t.closest('.rx-item');
    if (item) selectIndex(parseInt(item.getAttribute('data-idx'), 10));
  });

  listEl.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var item = e.target.closest && e.target.closest('.rx-item');
    if (!item || (e.target.closest && e.target.closest('.rx-item-actions'))) return;
    if (e.target.classList && e.target.classList.contains('rx-toggle')) return;
    e.preventDefault();
    selectIndex(parseInt(item.getAttribute('data-idx'), 10));
  });

  EDITOR_IDS.forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', schedulePersist);
    el.addEventListener('change', schedulePersist);
  });

  document.getElementById('rxBtnAdd')?.addEventListener('click', function() {
    var list = getList();
    var neu = createEmptyRegexScript({ scriptName: '新正则 ' + (list.length + 1) });
    list.push(neu);
    setList(list);
    selectedIndex = list.length - 1;
    refresh();
    setStatus('已新建');
  });

  document.getElementById('rxBtnTest')?.addEventListener('click', openTestModal);
  document.getElementById('rxBtnParse')?.addEventListener('click', runParse);

  if (testModal) {
    testModal.addEventListener('click', function(e) {
      if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-rx-modal-close')) {
        closeTestModal();
      }
    });
  }
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && testModal && !testModal.hidden) closeTestModal();
  });

  window.addEventListener('card-builder-data-changed', refresh);
  window.addEventListener('card-draft-changed', refresh);
  window.addEventListener('app-view-changed', function(ev) {
    if (ev && ev.detail && ev.detail.view === 'regex') refresh();
  });

  refresh();
  syncRefreshFingerprint();
  window.__regexPanelApi__ = {
    refresh: refresh,
    getSelectedIndex: function() { return selectedIndex; },
    persistEditor: persistEditor,
  };
}
