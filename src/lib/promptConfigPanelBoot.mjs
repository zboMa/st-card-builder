/**
 * 提示词配置面板 boot（从 PromptConfigPanel.astro 外提）
 */

export function initPromptConfigPanel() {
  var tabsEl = document.getElementById('promptConfigTabs');
  var listEl = document.getElementById('promptConfigList');
  var statusEl = document.getElementById('promptConfigStatus');
  var actionsEl = document.getElementById('promptConfigActions');
  var btnSave = document.getElementById('btnPromptSaveAll');
  var btnResetTab = document.getElementById('btnPromptResetTab');
  var btnReset = document.getElementById('btnPromptResetAll');
  if (!listEl || !tabsEl) return;

  /** 跨 Tab 编辑缓存（切页不丢） */
  var draftCache = {};
  var activeGroup = '';
  /** 目录类 Tab：sectionKey -> 当前选中条目 id */
  var catalogSelection = {};

  function store() {
    return window.__promptStore__;
  }

  function catalogBrowser() {
    return window.__promptCatalogBrowser__ || null;
  }

  function setStatus(msg, ok) {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.style.color = ok ? 'var(--color-success)' : 'var(--color-danger)';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function groupsOf(ps) {
    if (ps.listGroups) return ps.listGroups();
    var seen = {};
    var out = [];
    (ps.META || []).forEach(function(m) {
      if (!m || !m.group || seen[m.group]) return;
      seen[m.group] = true;
      out.push(m.group);
    });
    return out;
  }

  function catalogTabMeta() {
    var cb = catalogBrowser();
    return (cb && cb.tabMeta) || [];
  }

  function allTabKeys(ps) {
    return groupsOf(ps).concat(catalogTabMeta().map(function(t) { return t.id; }));
  }

  function findCatalogTab(tabId) {
    var list = catalogTabMeta();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === tabId) return list[i];
    }
    return null;
  }

  function isCatalogTab(tabId) {
    return !!findCatalogTab(tabId);
  }

  function setActionsMode(catalogMode) {
    if (!actionsEl) return;
    if (catalogMode) actionsEl.classList.add('is-catalog-mode');
    else actionsEl.classList.remove('is-catalog-mode');
  }

  /** 把当前 Tab 的 textarea 写入 draftCache */
  function stashActiveTab() {
    listEl.querySelectorAll('[data-prompt-ta]').forEach(function(ta) {
      var id = ta.getAttribute('data-prompt-ta');
      if (id) draftCache[id] = ta.value;
    });
  }

  function valueFor(ps, id) {
    if (Object.prototype.hasOwnProperty.call(draftCache, id)) return draftCache[id];
    return ps.get(id);
  }

  function metaInGroup(ps, group) {
    return (ps.META || []).filter(function(m) { return m && m.group === group; });
  }

  function renderTabs(ps) {
    var keys = allTabKeys(ps);
    if (!activeGroup || keys.indexOf(activeGroup) < 0) {
      activeGroup = keys[0] || '';
    }
    var labelMap = Object.create(null);
    catalogTabMeta().forEach(function(t) { labelMap[t.id] = t.label; });
    var html = '';
    keys.forEach(function(g) {
      var active = g === activeGroup;
      var label = labelMap[g] || g;
      html += '<button type="button" class="ui-tabs__tab prompt-config-tab'
        + (active ? ' is-active' : '') + '" role="tab" aria-selected="'
        + (active ? 'true' : 'false') + '" data-prompt-tab="' + escapeHtml(g) + '">'
        + escapeHtml(label) + '</button>';
    });
    tabsEl.innerHTML = html;
    tabsEl.querySelectorAll('[data-prompt-tab]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var next = btn.getAttribute('data-prompt-tab');
        if (!next || next === activeGroup) return;
        stashActiveTab();
        activeGroup = next;
        renderList(ps);
        renderTabs(ps);
      });
    });
  }

  function splitBlockTitle(title) {
    var raw = String(title || '').trim();
    var idx = raw.lastIndexOf(' ');
    if (idx <= 0) return { main: raw, sub: '' };
    var maybeEn = raw.slice(idx + 1);
    if (/^[a-zA-Z][a-zA-Z0-9_.-]*$/.test(maybeEn)) {
      return { main: raw.slice(0, idx), sub: maybeEn };
    }
    return { main: raw, sub: '' };
  }

  function renderBlockLabel(title) {
    var parts = splitBlockTitle(title);
    return '<p class="prompt-catalog-block-label">'
      + '<span class="prompt-catalog-block-label-main">' + escapeHtml(parts.main) + '</span>'
      + (parts.sub
        ? '<span class="prompt-catalog-block-label-sub">' + escapeHtml(parts.sub) + '</span>'
        : '')
      + '</p>';
  }

  function renderBulletBlock(title, arr) {
    if (!arr || !arr.length) return '';
    var lis = arr.map(function(x) {
      return '<li>' + escapeHtml(x) + '</li>';
    }).join('');
    return '<div class="prompt-catalog-block">'
      + renderBlockLabel(title)
      + '<ul class="prompt-catalog-list">' + lis + '</ul></div>';
  }

  function renderTextBlock(title, text) {
    if (!text) return '';
    return '<div class="prompt-catalog-block">'
      + renderBlockLabel(title)
      + '<pre class="prompt-catalog-block-body">' + escapeHtml(text) + '</pre></div>';
  }

  function renderChips(title, arr) {
    if (!arr || !arr.length) return '';
    var chips = arr.map(function(x) {
      return '<span class="prompt-catalog-chip">' + escapeHtml(x) + '</span>';
    }).join('');
    return '<div class="prompt-catalog-block">'
      + renderBlockLabel(title)
      + '<div class="prompt-catalog-chips">' + chips + '</div></div>';
  }

  function buildSelectOptions(section, selectedId) {
    var items = section.items || [];
    var groups = section.optgroups || [];
    var html = '';
    if (groups.length) {
      var byGroup = Object.create(null);
      var ungrouped = [];
      items.forEach(function(it) {
        var g = it.group || '';
        if (!g) { ungrouped.push(it); return; }
        if (!byGroup[g]) byGroup[g] = [];
        byGroup[g].push(it);
      });
      groups.forEach(function(og) {
        var list = byGroup[og.id] || [];
        if (!list.length) return;
        html += '<optgroup label="' + escapeHtml(og.label || og.id) + '">';
        list.forEach(function(it) {
          html += '<option value="' + escapeHtml(it.id) + '"'
            + (it.id === selectedId ? ' selected' : '') + '>'
            + escapeHtml(it.label || it.id) + '</option>';
        });
        html += '</optgroup>';
      });
      ungrouped.forEach(function(it) {
        html += '<option value="' + escapeHtml(it.id) + '"'
          + (it.id === selectedId ? ' selected' : '') + '>'
          + escapeHtml(it.label || it.id) + '</option>';
      });
    } else {
      items.forEach(function(it) {
        html += '<option value="' + escapeHtml(it.id) + '"'
          + (it.id === selectedId ? ' selected' : '') + '>'
          + escapeHtml(it.label || it.id) + '</option>';
      });
    }
    return html;
  }

  function findItem(section, id) {
    var items = section.items || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) return items[i];
    }
    return items[0] || null;
  }

  function renderCatalogDetail(item) {
    if (!item) {
      return '<p class="prompt-config-hint">本分类暂无条目</p>';
    }
    var metaBits = [];
    if (item.groupLabel) metaBits.push(item.groupLabel);
    else if (item.group) metaBits.push(item.group);
    var metaLine = metaBits.length
      ? '<p class="prompt-catalog-hint">' + escapeHtml(metaBits.join(' · ')) + '</p>'
      : '';
    return '<div class="prompt-config-item" data-catalog-id="' + escapeHtml(item.id) + '">'
      + '<div class="prompt-config-item-head">'
      + '<h3 class="prompt-config-item-title">' + escapeHtml(item.label || item.id)
      + '<span class="prompt-config-item-id">' + escapeHtml(item.id) + '</span></h3>'
      + '</div>'
      + metaLine
      + '<div class="prompt-catalog-blocks">'
      + renderTextBlock('摘要 summary', item.summary)
      + renderTextBlock('说明 description', item.description)
      + renderTextBlock('写作指引 writingGuide', item.writingGuide)
      + renderBulletBlock('必须覆盖 mustCover', item.mustCover)
      + renderBulletBlock('反模式 antiPatterns', item.antiPatterns)
      + renderBulletBlock('回避 avoid', item.avoid)
      + renderChips('焦点 focus', item.focus)
      + renderChips('词表 lexicon', item.lexicon)
      + renderChips('信号 signals', item.signals)
      + '</div></div>';
  }

  function renderCatalogList(ps, tabMeta) {
    setActionsMode(true);
    var cb = catalogBrowser();
    if (!cb || !cb.sections || !tabMeta) {
      listEl.innerHTML = '<p class="prompt-config-hint">目录数据未加载（需重新构建页面）</p>';
      return;
    }
    var section = cb.sections[tabMeta.section];
    if (!section || !(section.items || []).length) {
      listEl.innerHTML = '<p class="prompt-config-hint">本分类暂无条目</p>';
      return;
    }
    var items = section.items;
    var selectedId = catalogSelection[tabMeta.section];
    var matched = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === selectedId) { matched = items[i]; break; }
    }
    if (!matched) {
      selectedId = items[0].id;
      matched = items[0];
    }
    catalogSelection[tabMeta.section] = selectedId;
    var item = matched;

    var html = '<div class="prompt-catalog-toolbar">'
      + '<p class="prompt-catalog-hint">' + escapeHtml(section.hint || '只读目录') + '</p>'
      + '<div class="prompt-catalog-select-row">'
      + '<label for="promptCatalogSelect">查看条目</label>'
      + '<select id="promptCatalogSelect">'
      + buildSelectOptions(section, selectedId)
      + '</select>'
      + '</div></div>'
      + renderCatalogDetail(item);

    listEl.innerHTML = html;
    var sel = document.getElementById('promptCatalogSelect');
    if (sel) {
      sel.addEventListener('change', function() {
        catalogSelection[tabMeta.section] = sel.value;
        renderList(ps);
      });
      if (typeof window.__enhanceSelect__ === 'function') {
        try { window.__enhanceSelect__(sel); } catch (e) {}
      }
    }
  }

  function renderEditableList(ps) {
    setActionsMode(false);
    var items = metaInGroup(ps, activeGroup);
    if (!items.length) {
      listEl.innerHTML = '<p class="prompt-config-hint">本分类暂无提示词</p>';
      return;
    }
    var html = '';
    items.forEach(function(meta) {
      var val = valueFor(ps, meta.id);
      html += '<div class="prompt-config-item" data-prompt-id="' + escapeHtml(meta.id) + '">'
        + '<div class="prompt-config-item-head">'
        + '<h3 class="prompt-config-item-title">' + escapeHtml(meta.label)
        + '<span class="prompt-config-item-id">' + escapeHtml(meta.id) + '</span></h3>'
        + '</div>'
        + '<textarea data-prompt-ta="' + escapeHtml(meta.id) + '">' + escapeHtml(val) + '</textarea>'
        + '<div class="prompt-config-item-actions">'
        + '<button type="button" class="btn btn-fetch btn-prompt-reset-one" data-id="'
        + escapeHtml(meta.id) + '" style="width:auto;margin:0;padding:5px 10px;font-size:0.72rem;">↺ 恢复默认</button>'
        + '</div></div>';
    });
    listEl.innerHTML = html;

    listEl.querySelectorAll('.btn-prompt-reset-one').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-id');
        var ps2 = store();
        if (!ps2 || !id) return;
        ps2.reset(id);
        delete draftCache[id];
        var ta = listEl.querySelector('[data-prompt-ta="' + id + '"]');
        if (ta) ta.value = ps2.getDefault(id);
        setStatus('已恢复「' + id + '」默认值', true);
      });
    });
  }

  function renderList(ps) {
    var cat = findCatalogTab(activeGroup);
    if (cat) renderCatalogList(ps, cat);
    else renderEditableList(ps);
  }

  function render() {
    var ps = store();
    if (!ps) {
      listEl.innerHTML = '<p class="prompt-config-hint" style="color:var(--color-danger);">提示词仓库未加载</p>';
      tabsEl.innerHTML = '';
      return;
    }
    draftCache = {};
    (ps.META || []).forEach(function(m) {
      if (m && m.id) draftCache[m.id] = ps.get(m.id);
    });
    renderTabs(ps);
    renderList(ps);
  }

  function collectAllValues(ps) {
    stashActiveTab();
    var values = {};
    (ps.META || []).forEach(function(m) {
      if (!m || !m.id) return;
      values[m.id] = Object.prototype.hasOwnProperty.call(draftCache, m.id)
        ? draftCache[m.id]
        : ps.get(m.id);
    });
    return values;
  }

  if (btnSave) {
    btnSave.addEventListener('click', function() {
      var ps = store();
      if (!ps) return;
      if (isCatalogTab(activeGroup)) {
        setStatus('目录类 Tab 只读，无需保存', true);
        return;
      }
      ps.setAll(collectAllValues(ps));
      setStatus('已保存到 localStorage（含全部可编辑 Tab）', true);
    });
  }

  if (btnResetTab) {
    btnResetTab.addEventListener('click', function() {
      var ps = store();
      if (!ps || !activeGroup) return;
      if (isCatalogTab(activeGroup)) {
        setStatus('目录类 Tab 只读，无默认可恢复', true);
        return;
      }
      if (!confirm('确定将「' + activeGroup + '」下全部提示词恢复为默认？')) return;
      metaInGroup(ps, activeGroup).forEach(function(m) {
        ps.reset(m.id);
        delete draftCache[m.id];
      });
      renderList(ps);
      setStatus('已恢复「' + activeGroup + '」默认', true);
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', function() {
      var ps = store();
      if (!ps) return;
      if (!confirm('确定将全部可编辑提示词恢复为内置默认值？')) return;
      ps.reset();
      draftCache = {};
      render();
      setStatus('已全部恢复默认', true);
    });
  }

  window.addEventListener('app-view-changed', function(ev) {
    if (ev.detail && ev.detail.view === 'prompt-config') render();
  });

  render();
}
