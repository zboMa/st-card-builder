/**
 * 卡片管理面板：草稿系统 UI、CRUD、导入导出、封面缩略图、状态持久化
 * 提取自 index.astro 草稿系统代码
 */
import {
  genId,
  DRAFTS_KEY,
  buildDraftSnapshot,
  draftDisplayName,
  buildCardJSONFromDraft,
  normalizeTags,
  tagsFromImportJson,
} from '../state.mjs';
import { crc32, createTextChunk, deepCopy, escapeHtml } from '../../utils.mjs';
import { buildExportChecklist } from '../exportChecklist.mjs';
import { buildCardReleasePayload, normalizeCharacterVersion } from '../cardRelease.mjs';
import {
  apiPublishCard,
  apiCreateCardShare,
  apiDeleteCardShare,
  getCardShareMeta,
  setCardShareMeta,
  clearCardShareToken,
} from '../cardShareClient.mjs';

export function registerCardManager(ctx) {
  var panel = {};

  var managerThumbUrls = [];
  var cardManagerUiTimer = null;
  var cardManagerUiPendingDrafts = undefined;
  var CARD_MANAGER_UI_DEBOUNCE_MS = 80;
  var autoSaveTimer;
  /** @type {Set<string>} */
  var selectedFilterTags = new Set();
  var cardManagerSearchQuery = '';
  /** 当前卡导出检查缓存（角标用） */
  var lastExportCheck = { items: [], critical: 0, warning: 0, ok: true, summary: '', canExportPng: false };
  var tagPopupOpen = false;

  // ---- IDB helpers ----
  function ensureIdbReady() {
    if (typeof window.__ensureIdbReady__ === 'function') return window.__ensureIdbReady__();
    return window.__idbReady__ ? window.__idbReady__.catch(function() { return null; }) : Promise.resolve(null);
  }

  // ---- Thumbnail management ----
  function revokeManagerThumbs() {
    managerThumbUrls.forEach(function (u) {
      try { URL.revokeObjectURL(u); } catch (e) { console.warn('Revoking object URL failed', e); }
    });
    managerThumbUrls = [];
  }

  function hydrateManagerCoverThumb(draftId, coverEl, placeholderEl) {
    ensureIdbReady().then(function () {
      if (!window.__avatarIdb__) return '';
      return window.__avatarIdb__.loadAvatarThumbObjectUrl(draftId);
    }).then(function (url) {
      if (!url || !coverEl.isConnected) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      if (placeholderEl && placeholderEl.parentNode) placeholderEl.remove();
      var coverImg = document.createElement('img');
      coverImg.src = url;
      coverImg.alt = '';
      managerThumbUrls.push(url);
      coverEl.insertBefore(coverImg, coverEl.firstChild);
    }).catch(function (err) {
      console.warn('[card-manager] 封面加载失败 draft=' + draftId, err);
    });
  }

  // ---- setCharTags helper ----
  function setCharTags(next, opts) {
    ctx.state.charTags = normalizeTags(next);
    if (ctx.panels.character && ctx.panels.character.renderCharTags) {
      ctx.panels.character.renderCharTags();
    } else if (window.__getCharTags__ && typeof window.__setCharTags__ === 'function') {
      window.__setCharTags__(next, opts);
    }
  }

  // ---- Sync DOM text fields into ctx.state ----
  function syncDomFieldsToState() {
    var fn = function (id) { var el = ctx.$(id); return el ? el.value.trim() : ''; };
    ctx.state.charName = fn('charName');
    ctx.state.wbName = fn('wbName');
    ctx.state.charDesc = fn('charDesc');
    ctx.state.firstMes = fn('firstMes');
    ctx.state.creatorNotes = fn('creatorNotes');
    var verEl = ctx.$('characterVersion');
    if (verEl) ctx.state.characterVersion = String(verEl.value || '').trim() || '1.0';
  }

  // ---- State bridge helpers ----
  function getCurrentDraftId() {
    return ctx.sm.getCurrentDraftId();
  }

  function getAllDrafts() {
    return ctx.sm.getAllDrafts();
  }

  // ---- Draft display helpers ----
  function getDraftsForDisplay(stored) {
    var dr = stored ? Object.assign({}, stored) : getAllDrafts();
    var currentId = getCurrentDraftId();
    if (currentId) {
      var snap = buildDraftSnapshot(ctx.state);
      var existing = dr[currentId] || {};
      var merged = Object.assign({}, existing, snap);
      if (existing.avatarInIdb != null) merged.avatarInIdb = existing.avatarInIdb;
      if (existing.avatarBase64 != null && existing.avatarBase64.length > 100) merged.avatarBase64 = existing.avatarBase64;
      dr[currentId] = merged;
    }
    return dr;
  }

  function getCurrentAppView() {
    var active = document.querySelector('.app-view.is-active');
    if (active) return active.getAttribute('data-view') || '';
    var hash = (location.hash || '').replace(/^#/, '');
    return hash || 'character';
  }

  function goToView(viewId) {
    window.__setAppView__(viewId);
  }

  function setCardManagerStatus(msg, isError) {
    var bar = ctx.$('importStatusBar');
    if (!bar) return;
    if (!msg) {
      bar.style.display = 'none';
      bar.textContent = '';
      return;
    }
    bar.style.display = '';
    bar.textContent = String(msg);
    bar.classList.toggle('is-error', !!isError);
  }

  function draftWorkVersion(d) {
    return normalizeCharacterVersion(d && d.characterVersion);
  }

  function buildShareMetaLine(d, meta) {
    var work = draftWorkVersion(d);
    var pub = meta && meta.publishedCharacterVersion
      ? ('已发布 ' + meta.publishedCharacterVersion)
      : '未发布';
    var stale = meta && meta.publishedCharacterVersion
      && meta.publishedCharacterVersion !== work
      ? ' · 草稿超前'
      : '';
    var share = meta && meta.token ? ' · 分享中' : '';
    var png = meta && meta.token && meta.pngPublic ? ' · PNG直链' : '';
    return pub + stale + share + png;
  }

  function draftTags(d) {
    return normalizeTags((d && (d.charTags || d.tags)) || []);
  }

  function collectAllTags(dr) {
    var map = Object.create(null);
    Object.keys(dr || {}).forEach(function(id) {
      draftTags(dr[id]).forEach(function(t) {
        map[t] = (map[t] || 0) + 1;
      });
    });
    return Object.keys(map).sort(function(a, b) {
      return map[b] - map[a] || a.localeCompare(b, 'zh');
    });
  }

  function draftMatchesFilters(d) {
    if (selectedFilterTags.size) {
      var tags = draftTags(d);
      var hit = false;
      selectedFilterTags.forEach(function(t) {
        if (tags.indexOf(t) >= 0) hit = true;
      });
      if (!hit) return false;
    }
    var q = String(cardManagerSearchQuery || '').trim().toLowerCase();
    if (q) {
      var name = String(draftDisplayName(d) || '').toLowerCase();
      if (name.indexOf(q) < 0) return false;
    }
    return true;
  }

  function renderTagFilters(allTags) {
    var scroll = ctx.$('cardManagerTagScroll');
    var clearBtn = ctx.$('btnCardTagClear');
    var popup = ctx.$('cardManagerTagPopup');
    if (scroll) {
      if (!allTags.length) {
        scroll.innerHTML = '<span class="card-manager-tag-popup-empty">暂无标签</span>';
      } else {
        scroll.innerHTML = allTags.map(function(t) {
          var active = selectedFilterTags.has(t);
          return '<button type="button" class="card-manager-tag-chip' + (active ? ' is-active' : '')
            + '" data-card-tag="' + ctx.escapeHtml(t) + '" aria-pressed="' + (active ? 'true' : 'false') + '">'
            + ctx.escapeHtml(t) + '</button>';
        }).join('');
      }
    }
    if (clearBtn) clearBtn.hidden = selectedFilterTags.size === 0;
    if (popup && !popup.hidden) {
      if (!allTags.length) {
        popup.innerHTML = '<div class="card-manager-tag-popup-empty">暂无标签可筛选</div>';
      } else {
        popup.innerHTML = allTags.map(function(t) {
          var active = selectedFilterTags.has(t);
          return '<button type="button" class="card-manager-tag-chip' + (active ? ' is-active' : '')
            + '" data-card-tag="' + ctx.escapeHtml(t) + '" role="option" aria-selected="'
            + (active ? 'true' : 'false') + '">' + ctx.escapeHtml(t) + '</button>';
        }).join('');
      }
    }
  }

  function setTagPopupOpen(open) {
    var popup = ctx.$('cardManagerTagPopup');
    var btn = ctx.$('btnCardTagPicker');
    tagPopupOpen = !!open;
    if (popup) popup.hidden = !tagPopupOpen;
    if (btn) btn.setAttribute('aria-expanded', tagPopupOpen ? 'true' : 'false');
  }

  function toggleFilterTag(tag) {
    var t = String(tag || '').trim();
    if (!t) return;
    if (selectedFilterTags.has(t)) selectedFilterTags.delete(t);
    else selectedFilterTags.add(t);
    panel.updateCardManagerUI();
  }

  // ---- Actions HTML ----
  panel.buildCardManagerActionsHtml = function (meta) {
    meta = meta || {};
    function iconBtn(action, label, extraClass) {
      var cls = 'btn-icon btn-icon--sm card-mgr-icon' + (extraClass ? ' ' + extraClass : '');
      var icons = {
        dup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
        'export-json': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13 6l-2 12"/></svg>',
        'export-png': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M4 16l4.5-4.5 3 3L14 12l6 6"/></svg>',
        delete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M10 11v6M14 11v6"/><path d="M7 7l1 12a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9l1-12"/></svg>',
      };
      return '<button type="button" class="' + cls + '" data-card-action="' + action + '" title="' + label + '" aria-label="' + label + '">' + (icons[action] || '') + '</button>';
    }
    function textBtn(action, label) {
      return '<button type="button" class="btn btn-ghost btn-inline" data-card-action="'
        + action + '">' + label + '</button>';
    }
    return ''
      + '<div class="card-manager-item-actions__group">'
      + iconBtn('dup', '复制')
      + '</div>'
      + '<div class="card-manager-item-actions__group">'
      + iconBtn('export-json', '导出 JSON', 'card-mgr-icon--export')
      + iconBtn('export-png', '导出 PNG', 'card-mgr-icon--export')
      + iconBtn('delete', '删除', 'card-mgr-icon--danger btn-icon--danger')
      + '</div>'
      + '<div class="card-manager-item-share">'
      + textBtn('publish', '发布')
      + textBtn('share', '分享')
      + (meta.token ? textBtn('copy-share', '复制链接') : '')
      + (meta.token ? textBtn('reset-share', '重置链接') : '')
      + (meta.token ? textBtn('unshare', '停分享') : '')
      + '</div>';
  };

  function buildCheckBadgeHtml(check) {
    if (!check || (!check.critical && !check.warning)) return '';
    var n = check.critical > 0 ? check.critical : check.warning;
    var cls = 'card-manager-check-badge' + (check.critical > 0 ? '' : ' is-warning');
    var title = check.critical > 0
      ? ('导出检查：严重 ' + check.critical + (check.warning ? ' · 警告 ' + check.warning : ''))
      : ('导出检查：警告 ' + check.warning);
    var icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>';
    return '<button type="button" class="' + cls + '" data-card-action="export-check" title="'
      + ctx.escapeHtml(title) + '" aria-label="' + ctx.escapeHtml(title) + '">'
      + icon + '<span>' + n + '</span></button>';
  }

  // ---- Core render ----
  panel.render = function (storedDrafts) {
    var listEl = ctx.$('cardManagerList');
    if (!listEl) return;
    revokeManagerThumbs();
    var dr = getDraftsForDisplay(storedDrafts);
    var allTags = collectAllTags(dr);
    renderTagFilters(allTags);

    var ks = Object.keys(dr).filter(function(id) {
      return draftMatchesFilters(dr[id] || {});
    });
    // 更新时间倒序
    ks.sort(function(a, b) {
      var ta = String((dr[a] && dr[a].updatedAt) || '');
      var tb = String((dr[b] && dr[b].updatedAt) || '');
      return tb.localeCompare(ta);
    });

    if (!Object.keys(dr).length) {
      listEl.innerHTML = '<p class="card-manager-empty ui-empty-tip">暂无角色卡，点击右上角「新建」</p>';
      return;
    }
    if (!ks.length) {
      listEl.innerHTML = '<p class="card-manager-empty ui-empty-tip">没有符合筛选条件的角色卡</p>';
      return;
    }
    listEl.innerHTML = '';
    var currentId = getCurrentDraftId();
    ks.forEach(function (id) {
      var d = dr[id] || {};
      var active = id === currentId;
      var item = document.createElement('div');
      item.className = 'card-manager-item' + (active ? ' is-active' : '');
      item.setAttribute('data-draft-id', id);

      var cover = document.createElement('div');
      cover.className = 'card-manager-cover';
      cover.setAttribute('data-card-action', 'open');
      if (d.avatarBase64) {
        var coverImg = document.createElement('img');
        coverImg.src = d.avatarBase64;
        coverImg.alt = '';
        cover.appendChild(coverImg);
      } else if (d.avatarInIdb) {
        var loadingPh = document.createElement('span');
        loadingPh.className = 'card-manager-cover-placeholder';
        loadingPh.textContent = '…';
        cover.appendChild(loadingPh);
        hydrateManagerCoverThumb(id, cover, loadingPh);
      } else {
        var ph = document.createElement('span');
        ph.className = 'card-manager-cover-placeholder';
        ph.textContent = '无封面';
        cover.appendChild(ph);
      }

      var badges = document.createElement('div');
      badges.className = 'card-manager-cover-badges';
      if (active) {
        badges.insertAdjacentHTML('beforeend', buildCheckBadgeHtml(lastExportCheck));
        var badge = document.createElement('span');
        badge.className = 'card-manager-badge';
        badge.textContent = '当前';
        badges.appendChild(badge);
      }
      var verBadge = document.createElement('span');
      verBadge.className = 'card-manager-version-badge';
      verBadge.textContent = 'v' + draftWorkVersion(d);
      badges.appendChild(verBadge);
      cover.appendChild(badges);

      var shareMeta = getCardShareMeta(id) || {};
      var overlay = document.createElement('div');
      overlay.className = 'card-manager-cover-overlay';
      overlay.innerHTML =
        '<button type="button" class="card-manager-item-name" data-card-action="rename" title="点击重命名">'
        + ctx.escapeHtml(draftDisplayName(d)) + '</button>'
        + '<div class="card-manager-item-meta">更新 ' + ctx.escapeHtml(d.updatedAt || '—')
        + '<br>' + ctx.escapeHtml(buildShareMetaLine(d, shareMeta)) + '</div>';
      cover.appendChild(overlay);

      var actions = document.createElement('div');
      actions.className = 'card-manager-item-actions';
      actions.innerHTML = panel.buildCardManagerActionsHtml(shareMeta);

      item.appendChild(cover);
      item.appendChild(actions);
      listEl.appendChild(item);
    });
  };

  panel.refreshExportChecklist = function () {
    var box = ctx.$('exportChecklistBox');
    var summaryEl = ctx.$('exportChecklistSummary');
    var modalLead = ctx.$('exportChecklistModalSummary');
    var listEl = ctx.$('exportChecklistItems');
    var check = (window.__getExportChecklist__ || window.__assistantCardApi__ && window.__assistantCardApi__.exportCheck)
      ? (window.__getExportChecklist__ || window.__assistantCardApi__.exportCheck)()
      : buildExportChecklist({
        charName: ctx.state.charName,
        charDesc: ctx.state.charDesc,
        firstMes: ctx.state.firstMes || (ctx.$('firstMes') || {}).value || '',
        hasAvatar: !!(ctx.state.avatarInIdb || ctx.state.avatarBase64),
        worldbookCount: (ctx.state.worldbookEntries || []).length,
        worldbookNoKeys: (ctx.state.worldbookEntries || []).filter(function(e) {
          return e && e.enabled !== false && (!e.keys || !e.keys.length);
        }).length,
        altGreetingCount: Array.isArray(window.__altGreetings__) ? window.__altGreetings__.length : 0,
      });
    var items = check.items || [];
    var critical = items.filter(function(it) { return it.level === 'critical'; }).length;
    var warning = items.filter(function(it) { return it.level === 'warning'; }).length;
    lastExportCheck = {
      items: items,
      critical: critical,
      warning: warning,
      ok: !!check.ok,
      summary: check.summary || '',
      canExportPng: !!check.canExportPng,
    };
    if (box) box.hidden = true;
    var countText;
    if (!items.length) {
      countText = check.ok
        ? ('通过 · 可导出 JSON' + (check.canExportPng ? ' / PNG' : ''))
        : (check.summary || '存在问题');
    } else {
      countText = '严重 ' + critical + ' · 警告 ' + warning;
      if (check.summary) countText += ' · ' + check.summary;
    }
    if (summaryEl) {
      summaryEl.textContent = countText;
      summaryEl.classList.toggle('is-critical', critical > 0);
      summaryEl.classList.toggle('is-warning', critical === 0 && warning > 0);
    }
    if (modalLead) modalLead.textContent = countText;
    if (!listEl) return;

    if (!items.length) {
      listEl.innerHTML = '<li>当前卡可导出 JSON' + (check.canExportPng ? ' / PNG' : '（PNG 需头像）') + '</li>';
    } else {
      listEl.innerHTML = items.map(function(it) {
        var cls = it.level === 'critical' ? 'is-critical' : (it.level === 'warning' ? 'is-warning' : '');
        var jump = it.view
          ? '<button type="button" class="export-checklist-jump" data-view="' + escapeHtml(it.view) + '">去处理</button>'
          : '';
        return '<li class="' + cls + '"><span>' + escapeHtml(it.message) + '</span>' + jump + '</li>';
      }).join('');
    }
    listEl.querySelectorAll('.export-checklist-jump').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var view = btn.getAttribute('data-view');
        closeExportChecklistModal();
        if (view) goToView(view);
      });
    });
  };

  function openExportChecklistModal() {
    var modal = ctx.$('exportChecklistModal');
    if (!modal) return;
    // 挂到 body，避免父级 transform/overflow 把 position:fixed 变成「嵌在面板里」
    if (!modal._exportChecklistHome) modal._exportChecklistHome = modal.parentNode;
    document.body.appendChild(modal);
    panel.refreshExportChecklist();
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('export-checklist-modal-open');
  }

  function closeExportChecklistModal() {
    var modal = ctx.$('exportChecklistModal');
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('export-checklist-modal-open');
    if (modal._exportChecklistHome && modal.parentNode !== modal._exportChecklistHome) {
      modal._exportChecklistHome.appendChild(modal);
    }
  }

  panel.bindExportChecklistUi = function () {
    var refreshBtn = ctx.$('btnRefreshExportChecklist');
    var modal = ctx.$('exportChecklistModal');
    if (refreshBtn && !refreshBtn._exportChecklistBound) {
      refreshBtn._exportChecklistBound = true;
      refreshBtn.addEventListener('click', function() {
        panel.refreshExportChecklist();
        panel.updateCardManagerUI();
      });
    }
    if (modal && !modal._exportChecklistBound) {
      modal._exportChecklistBound = true;
      modal.querySelectorAll('[data-export-checklist-close]').forEach(function(el) {
        el.addEventListener('click', closeExportChecklistModal);
      });
    }
  };

  // ---- Debounced update ----
  panel.updateCardManagerUI = function (storedDrafts) {
    var listEl = ctx.$('cardManagerList');
    if (!listEl) return;
    cardManagerUiPendingDrafts = storedDrafts;
    if (cardManagerUiTimer) clearTimeout(cardManagerUiTimer);
    cardManagerUiTimer = setTimeout(function () {
      cardManagerUiTimer = null;
      var pending = cardManagerUiPendingDrafts;
      cardManagerUiPendingDrafts = undefined;
      if (getCurrentAppView() === 'card-manager') panel.refreshExportChecklist();
      panel.render(pending);
    }, CARD_MANAGER_UI_DEBOUNCE_MS);
  };

  // ---- Avatar migration ----
  async function migrateDraftAvatarToIdb(id, d, dr) {
    if (!d || !d.avatarBase64 || d.avatarInIdb) return false;
    await ensureIdbReady();
    if (!window.__avatarIdb__) return false;
    var ok = await window.__avatarIdb__.migrateAvatarBase64ToIdb(id, d.avatarBase64);
    if (!ok) return false;
    d.avatarInIdb = true;
    d.avatarBase64 = '';
    dr[id] = d;
    try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(dr)); } catch (e) { console.warn('Saving drafts to localStorage failed', e); }
    return true;
  }

  // ---- Events bridge (called by other panels / state machine) ----
  panel.emitCardDraftChanged = function (cardId) {
    var currentId = getCurrentDraftId();
    window.dispatchEvent(new CustomEvent('card-draft-changed', {
      detail: { cardId: cardId || currentId || '' }
    }));
  };

  panel.dispatchDataChanged = function () {
    window.dispatchEvent(new CustomEvent('card-builder-data-changed'));
  };

  // ---- Save ----
  panel.saveCurrentDraft = function (opts) {
    opts = opts || {};
    syncDomFieldsToState();
    var result = ctx.sm.saveDraft(opts);
    var saveIndicator = ctx.$('saveIndicator');
    if (result.saved && saveIndicator) {
      saveIndicator.style.display = 'inline';
      setTimeout(function () { saveIndicator.style.display = 'none'; }, 1500);
    }
    panel.updateCardManagerUI(result.drafts);
    return result.saved;
  };

  panel.debouncedUpdateAndSave = function () {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(function () {
      syncDomFieldsToState();
      if (window.updatePreviewPanel) {
        var fj = buildCardJSONFromDraft(ctx.state);
        window.updatePreviewPanel(fj);
      }
      panel.saveCurrentDraft();
    }, 500);
  };

  panel.flushUpdateAndSave = function () {
    clearTimeout(autoSaveTimer);
    syncDomFieldsToState();
    if (window.updatePreviewPanel) {
      var fj = buildCardJSONFromDraft(ctx.state);
      window.updatePreviewPanel(fj);
    }
    panel.saveCurrentDraft();
  };

  // ---- Load draft ----
  panel.loadDraft = function (id) {
    loadDraftAsync(id).catch(function (err) {
      console.warn('[draft] loadDraft failed', err);
    });
  };

  async function loadDraftAsync(id) {
    var dr = getAllDrafts();
    if (!dr[id]) return;

    // 云端占位卡：懒同步正文
    if (dr[id]._cloudStub || !dr[id].charDesc) {
      try {
        var sync = await import('../../sync/index.mjs');
        var full = await sync.ensureCardLocal(id);
        if (full) {
          dr[id] = full;
          try { localStorage.setItem('st_v3_builder_drafts', JSON.stringify(dr)); } catch (e) { /* ignore */ }
        }
      } catch (e) {
        console.warn('[sync] ensureCardLocal', e);
      }
    }

    var loaded = ctx.sm.loadDraftIntoState(id);
    if (!loaded) return;
    var d = dr[id];

    // Update DOM fields from state
    var setVal = function (elId, val) { var el = ctx.$(elId); if (el) el.value = val; };
    setVal('charName', ctx.state.charName);
    setVal('wbName', ctx.state.wbName);
    setVal('charDesc', ctx.state.charDesc);
    setVal('firstMes', ctx.state.firstMes);
    setVal('creatorNotes', ctx.state.creatorNotes);
    setVal('characterVersion', ctx.state.characterVersion || '1.0');

    // Tags
    var tagsVal = d.charTags || d.tags || [];
    ctx.state.charTags = normalizeTags(tagsVal);
    if (ctx.panels.character && ctx.panels.character.renderCharTags) {
      ctx.panels.character.renderCharTags();
    }

    // Non-DOM state fields (these are set in loadDraftIntoState already)
    // worldbookEntries, regexScripts, tavernHelperScripts, cardBuilderExtensions
    // altGreetings
    window.__altGreetings__ = d.altGreetings || [];
    if (window.__renderAltGreetings__) window.__renderAltGreetings__();

    // Reset WB form
    if (ctx.panels.worldbook && ctx.panels.worldbook.resetWBForm) {
      ctx.panels.worldbook.resetWBForm();
    }

    // Avatar
    var avatarImg = ctx.$('avatarImg');
    var avatarPlaceholder = ctx.$('avatarPlaceholder');
    if (avatarImg && avatarPlaceholder) {
      avatarImg.style.display = 'none';
      avatarPlaceholder.style.display = 'block';
    }
    if (ctx.state.avatarBase64 && !ctx.state.avatarInIdb) {
      var migrated = await migrateDraftAvatarToIdb(id, d, dr);
      if (migrated) {
        ctx.state.avatarInIdb = true;
        ctx.state.avatarBase64 = '';
      }
    }
    if (ctx.state.avatarInIdb) {
      await ensureIdbReady();
      if (window.__avatarIdb__) {
        var fullUrl = await window.__avatarIdb__.loadAvatarFullDataUrl(id);
        if (fullUrl && avatarImg) {
          avatarImg.src = fullUrl;
          avatarImg.style.display = 'block';
          if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
        }
      }
    } else if (ctx.state.avatarBase64 && avatarImg) {
      avatarImg.src = ctx.state.avatarBase64;
      avatarImg.style.display = 'block';
      if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
    }

    // Refresh other panels
    panel.updateCardManagerUI();
    if (ctx.panels.worldbook && ctx.panels.worldbook.renderEntriesList) {
      ctx.panels.worldbook.renderEntriesList();
    }
    if (window.updatePreviewPanel) {
      var fj = buildCardJSONFromDraft(ctx.state);
      window.updatePreviewPanel(fj);
    }
    if (ctx.panels.adultConfig && ctx.panels.adultConfig.renderNsfwBlock) {
      ctx.panels.adultConfig.renderNsfwBlock();
    }

    // Dispatch events
    panel.dispatchDataChanged();
    panel.emitCardDraftChanged(id);
  }

  // ---- Create blank ----
  panel.createBlankDraft = function (opts) {
    var jump = !opts || opts.jumpToCharacter !== false;
    ctx.sm.createBlank();

    // Clear DOM fields
    var setVal = function (elId, val) { var el = ctx.$(elId); if (el) el.value = val; };
    setVal('charName', '');
    setVal('wbName', '');
    setVal('charDesc', '');
    setVal('firstMes', '');
    setVal('creatorNotes', '');
    setVal('characterVersion', '1.0');

    ctx.state.charTags = [];
    if (ctx.panels.character && ctx.panels.character.renderCharTags) {
      ctx.panels.character.renderCharTags();
    }

    var charImageInput = ctx.$('charImageInput');
    if (charImageInput) charImageInput.value = '';

    var avatarImg = ctx.$('avatarImg');
    var avatarPlaceholder = ctx.$('avatarPlaceholder');
    if (avatarImg) avatarImg.style.display = 'none';
    if (avatarPlaceholder) avatarPlaceholder.style.display = 'block';

    window.__altGreetings__ = [];
    if (window.__renderAltGreetings__) window.__renderAltGreetings__();

    // Reset WB form
    if (ctx.panels.worldbook && ctx.panels.worldbook.resetWBForm) {
      ctx.panels.worldbook.resetWBForm();
    }

    panel.saveCurrentDraft();

    if (ctx.panels.worldbook && ctx.panels.worldbook.renderEntriesList) {
      ctx.panels.worldbook.renderEntriesList();
    }
    if (window.updatePreviewPanel) {
      var fj = buildCardJSONFromDraft(ctx.state);
      window.updatePreviewPanel(fj);
    }

    panel.dispatchDataChanged();
    panel.emitCardDraftChanged(ctx.state.draftId);

    if (jump) goToView('character');
  };

  // ---- Delete ----
  panel.deleteDraft = async function (id, opts) {
    if (!id) return { ok: false, error: '缺少 id' };
    var dr = getAllDrafts();
    if (!dr[id]) return { ok: false, error: '卡不存在' };
    var currentId = getCurrentDraftId();
    var draftNameVal = draftDisplayName(dr[id], id === currentId ? ctx.state.charName : '');
    if (!(opts && opts.force)) {
      var ok = await ctx.showConfirmDialog({
        icon: '🗑️',
        title: '删除角色卡？',
        message: '这会从本地多卡草稿箱中移除该卡。',
        detail: '即将删除：' + draftNameVal + '。此操作不会影响已下载到本地的卡片文件。',
        okText: '删除',
        cancelText: '再想想',
      });
      if (!ok) return { ok: false, cancelled: true };
    }
    var result = ctx.sm.deleteDraft(id);
    if (!result.ok) return result;

    // Clean up IndexedDB
    ensureIdbReady().then(function () {
      if (window.__avatarIdb__) return window.__avatarIdb__.deleteAvatarDraft(id);
    }).catch(function () { console.warn('Deleting avatar draft from IDB failed'); });
    if (window.__novelIdb__) {
      window.__novelIdb__.removeNovelBucketIdb(id, localStorage).catch(function () { console.warn('Removing novel bucket from IDB failed'); });
    }
    // Pouch 级联（RAG / storyStudio / card）
    import('../../sync/cascade.mjs').then(function(mod) {
      return mod.cascadeDeleteCardDocs(id, getAllDrafts());
    }).catch(function(e) { console.warn('[sync] cascade delete', e); });

    // Navigate: if deleted was current, load next or create blank
    if (id === currentId) {
      var drAfter = getAllDrafts();
      var ks = Object.keys(drAfter);
      if (ks.length > 0) {
        panel.loadDraft(ks[0]);
      } else {
        panel.createBlankDraft({ jumpToCharacter: false });
      }
    } else {
      panel.updateCardManagerUI();
    }
    return { ok: true, deleted: id, name: draftNameVal };
  };

  // ---- Duplicate ----
  panel.duplicateDraft = async function (id) {
    var dr = getAllDrafts();
    var src = dr[id];
    if (!src) return;
    var newId = genId();
    var copy = deepCopy(src);
    copy.charName = draftDisplayName(src) + ' 副本';
    copy.updatedAt = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    copy.avatarInIdb = !!(src.avatarInIdb || src.avatarBase64);
    if (copy.avatarInIdb) copy.avatarBase64 = '';
    dr[newId] = copy;
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(dr));

    await ensureIdbReady();
    if (window.__avatarIdb__) {
      if (src.avatarInIdb) {
        await window.__avatarIdb__.copyAvatarDraft(id, newId);
      } else if (src.avatarBase64) {
        await window.__avatarIdb__.migrateAvatarBase64ToIdb(newId, src.avatarBase64);
      }
    }
    if (window.__novelIdb__) {
      await window.__novelIdb__.copyNovelBucketIdb(id, newId, localStorage);
    }
    panel.loadDraft(newId);
    goToView('character');
  };

  // ---- Rename ----
  panel.renameDraft = function (id, newName) {
    var dr = getAllDrafts();
    var d = dr[id];
    if (!d) return { ok: false, error: '卡不存在' };
    var next = newName != null ? String(newName) : window.prompt('重命名角色卡', draftDisplayName(d));
    if (next === null) return { ok: false, cancelled: true };
    next = String(next).trim();
    if (!next) return { ok: false, error: '名称为空' };
    d.charName = next;
    d.updatedAt = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    dr[id] = d;
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(dr));
    var currentId = getCurrentDraftId();
    if (id === currentId) {
      ctx.state.charName = next;
      var el = ctx.$('charName');
      if (el) el.value = next;
    }
    panel.updateCardManagerUI();
    if (id === currentId && window.updatePreviewPanel) {
      var fj = buildCardJSONFromDraft(ctx.state);
      window.updatePreviewPanel(fj);
    }
    return { ok: true, id: id, name: next };
  };

  // ---- PNG bytes for publish ----
  panel.buildPngBase64ForDraft = async function (id) {
    var json;
    var avatar;
    var currentId = getCurrentDraftId();
    if (id === currentId) {
      panel.saveCurrentDraft();
      json = buildCardJSONFromDraft(ctx.state);
      if (ctx.state.avatarInIdb) {
        await ensureIdbReady();
        avatar = window.__avatarIdb__
          ? await window.__avatarIdb__.loadAvatarFullDataUrl(id)
          : '';
      } else {
        avatar = ctx.state.avatarBase64;
      }
    } else {
      var d = getAllDrafts()[id];
      if (!d) return null;
      json = buildCardJSONFromDraft(d);
      if (d.avatarInIdb) {
        await ensureIdbReady();
        avatar = window.__avatarIdb__
          ? await window.__avatarIdb__.loadAvatarFullDataUrl(id)
          : '';
      } else {
        avatar = d.avatarBase64 || '';
      }
    }
    if (!avatar) return null;
    var ch = createTextChunk('chara', JSON.stringify(json));
    var raw = atob(avatar.split(',')[1]);
    var bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    var io = bytes.length - 12;
    var bef = bytes.slice(0, io);
    var ie = bytes.slice(io);
    var fin = new Uint8Array(bef.length + ch.length + ie.length);
    fin.set(bef, 0);
    fin.set(ch, bef.length);
    fin.set(ie, bef.length + ch.length);
    var bin = '';
    for (var j = 0; j < fin.length; j++) bin += String.fromCharCode(fin[j]);
    return btoa(bin);
  };

  // ---- Publish / Share ----
  panel.publishDraft = async function (id) {
    if (!id) return;
    var currentId = getCurrentDraftId();
    if (id === currentId) panel.saveCurrentDraft();
    var stored = getAllDrafts()[id];
    if (id !== currentId && !stored) {
      setCardManagerStatus('找不到该角色卡', true);
      return;
    }
    var d = id === currentId
      ? Object.assign({}, buildDraftSnapshot(ctx.state), { draftId: id })
      : Object.assign({}, stored, { draftId: id });
    var release = buildCardReleasePayload(d, {});
    if (!window.confirm(
      '发布角色卡为分享可见版「' + release.characterVersion + '」。\n'
      + '分享链接只展示已发布快照；之后编辑需再次发布才会更新。继续？'
    )) return;

    var withPng = false;
    if (d.avatarInIdb || d.avatarBase64 || (id === currentId && (ctx.state.avatarInIdb || ctx.state.avatarBase64))) {
      withPng = window.confirm('同时上传嵌入角色数据的 PNG？（开启「PNG 直链」分享时需要）');
    }

    setCardManagerStatus('正在发布…');
    try {
      var pngBase64 = null;
      if (withPng) {
        pngBase64 = await panel.buildPngBase64ForDraft(id);
        if (!pngBase64) {
          setCardManagerStatus('无头像，已跳过 PNG；仍发布 JSON', true);
        }
      }
      var data = await apiPublishCard({
        cardId: id,
        cardJson: release.cardJson,
        characterVersion: release.characterVersion,
        title: release.title,
        pngEnabled: !!(withPng && pngBase64),
        pngBase64: pngBase64,
      });
      try {
        var mirror = await import('../../sync/cardMirror.mjs');
        await mirror.mirrorCardReleaseToPouch(id, {
          characterVersion: data.characterVersion,
          title: release.title,
          publishedAt: data.publishedAt,
          pngEnabled: !!(withPng && pngBase64),
          cardJson: release.cardJson,
        });
      } catch (e) { console.warn('[cardShare] mirror', e); }
      setCardShareMeta(id, {
        publishedCharacterVersion: data.characterVersion,
        publishedAt: data.publishedAt,
        title: release.title,
      });
      setCardManagerStatus('已发布 v' + data.characterVersion
        + (data.pngStored ? '（含 PNG）' : ''));
      panel.updateCardManagerUI();
    } catch (err) {
      if (err && err.status === 401) {
        setCardManagerStatus('请先在「账户与同步」登录后再发布', true);
      } else {
        setCardManagerStatus('发布失败：' + (err.message || err), true);
      }
    }
  };

  panel.shareDraft = async function (id, opts) {
    opts = opts || {};
    if (!id) return;
    var meta = getCardShareMeta(id) || {};
    if (!meta.publishedCharacterVersion) {
      setCardManagerStatus('请先「发布」角色卡版本后再分享', true);
      return;
    }
    var currentId = getCurrentDraftId();
    if (id === currentId) panel.saveCurrentDraft();
    var d = id === currentId ? buildDraftSnapshot(ctx.state, id) : getAllDrafts()[id];
    var work = draftWorkVersion(d || {});
    if (meta.publishedCharacterVersion !== work) {
      if (!window.confirm(
        '当前工作版 ' + work + ' 已超前于已发布 ' + meta.publishedCharacterVersion
        + '。分享仍只展示已发布版。继续？'
      )) return;
    }

    var passRaw = window.prompt(
      '可选：分享访问密码（留空=不修改；填 clear=清除密码）。\n'
      + '查看信息/JSON 需登录同账号，并校验此密码。',
      ''
    );
    if (passRaw === null) return;

    var pngAns = window.confirm(
      '是否开启 PNG 直链？\n'
      + '开启后：持链接可不登录直接下载最新 PNG（内含完整卡数据）。\n'
      + '信息页与 JSON 仍需登录。\n'
      + '确定开启？'
    );

    var expRaw = window.prompt('可选：链接有效天数（留空=不修改；填 0=永不过期）', '');
    if (expRaw === null) return;

    setCardManagerStatus(opts.resetToken ? '重置分享链接…' : '创建分享链接…');
    try {
      var payload = {
        cardId: id,
        token: meta.token || '',
        resetToken: !!opts.resetToken,
        pngPublic: !!pngAns,
      };
      var pass = String(passRaw).trim();
      if (pass.toLowerCase() === 'clear') payload.clearPassword = true;
      else if (pass) payload.password = pass;

      expRaw = String(expRaw).trim();
      if (expRaw === '0') payload.expiresAt = null;
      else if (expRaw) {
        var days = parseInt(expRaw, 10);
        if (!Number.isFinite(days) || days < 0) {
          setCardManagerStatus('有效天数无效', true);
          return;
        }
        if (days > 0) payload.expiresInDays = days;
      }

      var data = await apiCreateCardShare(payload);
      setCardShareMeta(id, {
        token: data.token,
        infoUrl: data.infoUrl,
        pngUrl: data.pngUrl || null,
        pngPublic: !!data.pngPublic,
        hasPassword: !!data.hasPassword,
        publishedCharacterVersion: data.characterVersion || meta.publishedCharacterVersion,
        title: data.title || meta.title,
      });
      var url = data.infoUrl || '';
      try {
        if (url && navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
          setCardManagerStatus('分享信息链接已复制：' + url
            + (data.pngPublic && data.pngUrl ? '；PNG：' + data.pngUrl : '')
            + (data.hasPassword ? '（需密码）' : ''));
        } else {
          window.prompt('复制分享信息链接', url);
          setCardManagerStatus('请复制分享链接');
        }
      } catch (e2) {
        window.prompt('复制分享信息链接', url);
        setCardManagerStatus('请复制分享链接');
      }
      panel.updateCardManagerUI();
    } catch (err) {
      if (err && err.code === 'no_release') {
        setCardManagerStatus('云端尚无发布版：请先发布并确保已登录', true);
      } else if (err && err.status === 401) {
        setCardManagerStatus('请先在「账户与同步」登录后再分享', true);
      } else {
        setCardManagerStatus('分享失败：' + (err.message || err), true);
      }
    }
  };

  panel.copyShareLink = async function (id) {
    var meta = getCardShareMeta(id) || {};
    if (!meta.token || !meta.infoUrl) {
      setCardManagerStatus('尚未创建分享链接', true);
      return;
    }
    var text = meta.infoUrl + (meta.pngUrl ? ('\nPNG: ' + meta.pngUrl) : '');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(meta.infoUrl);
        setCardManagerStatus('已复制：' + meta.infoUrl
          + (meta.pngUrl ? '（另有 PNG 直链）' : ''));
      } else {
        window.prompt('复制分享信息链接', meta.infoUrl);
      }
    } catch (e) {
      window.prompt('复制分享信息链接', text);
    }
  };

  panel.unshareDraft = async function (id) {
    var meta = getCardShareMeta(id) || {};
    if (!meta.token) {
      setCardManagerStatus('未在分享', true);
      return;
    }
    if (!window.confirm('停止分享后链接将失效，确定？')) return;
    try {
      await apiDeleteCardShare(meta.token);
    } catch (e) {
      if (!(e && e.status === 401)) {
        setCardManagerStatus('停分享失败：' + (e.message || e), true);
        return;
      }
    }
    clearCardShareToken(id);
    setCardManagerStatus('已停止分享');
    panel.updateCardManagerUI();
  };

  // ---- Export ----
  panel.exportDraftAsJson = function (id) {
    if (!id) return;
    var json;
    var name;
    var currentId = getCurrentDraftId();
    if (id === currentId) {
      panel.saveCurrentDraft();
      json = buildCardJSONFromDraft(ctx.state);
      name = ctx.state.charName || 'card';
    } else {
      var d = getAllDrafts()[id];
      if (!d) return alert('❌ 找不到该角色卡');
      json = buildCardJSONFromDraft(d);
      name = draftDisplayName(d) || 'card';
    }
    var a = document.createElement('a');
    a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(json, null, 2));
    a.download = name + '.json';
    a.click();
  };

  panel.exportDraftAsPng = async function (id) {
    if (!id) return;
    var json;
    var avatar;
    var name;
    var currentId = getCurrentDraftId();
    if (id === currentId) {
      panel.saveCurrentDraft();
      json = buildCardJSONFromDraft(ctx.state);
      name = ctx.state.charName || 'CharacterCard';
      if (ctx.state.avatarInIdb) {
        await ensureIdbReady();
        avatar = window.__avatarIdb__
          ? await window.__avatarIdb__.loadAvatarFullDataUrl(id)
          : '';
      } else {
        avatar = ctx.state.avatarBase64;
      }
    } else {
      var d = getAllDrafts()[id];
      if (!d) return alert('❌ 找不到该角色卡');
      json = buildCardJSONFromDraft(d);
      name = draftDisplayName(d) || 'CharacterCard';
      if (d.avatarInIdb) {
        await ensureIdbReady();
        avatar = window.__avatarIdb__
          ? await window.__avatarIdb__.loadAvatarFullDataUrl(id)
          : '';
      } else {
        avatar = d.avatarBase64 || '';
      }
    }
    if (!avatar) return alert('❌ 该卡尚未上传头像，无法导出 PNG');
    try {
      var ch = createTextChunk('chara', JSON.stringify(json));
      var raw = atob(avatar.split(',')[1]);
      var bytes = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      var io = bytes.length - 12;
      var bef = bytes.slice(0, io);
      var ie = bytes.slice(io);
      var fin = new Uint8Array(bef.length + ch.length + ie.length);
      fin.set(bef, 0);
      fin.set(ch, bef.length);
      fin.set(ie, bef.length + ch.length);
      var blob = new Blob([fin], { type: 'image/png' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name + '.png';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      alert('❌ 导出失败: ' + err.message);
    }
  };

  // ---- generateCardJSON ----
  panel.generateCardJSON = function () {
    syncDomFieldsToState();
    return buildCardJSONFromDraft(ctx.state);
  };
  panel.buildCardJSONFromDraft = function (d) {
    return buildCardJSONFromDraft(d);
  };

  // ---- Event bindings ----
  panel.bind = function () {
    panel.bindExportChecklistUi();

    var searchEl = ctx.$('cardManagerSearch');
    var searchClear = ctx.$('cardManagerSearchClear');
    function syncSearchClear() {
      if (!searchClear) return;
      searchClear.hidden = !(searchEl && String(searchEl.value || '').length);
    }
    if (searchEl && !searchEl._cardMgrBound) {
      searchEl._cardMgrBound = true;
      searchEl.addEventListener('input', function() {
        cardManagerSearchQuery = searchEl.value || '';
        syncSearchClear();
        panel.updateCardManagerUI();
      });
      syncSearchClear();
    }
    if (searchClear && !searchClear._cardMgrBound) {
      searchClear._cardMgrBound = true;
      searchClear.addEventListener('click', function() {
        if (searchEl) searchEl.value = '';
        cardManagerSearchQuery = '';
        syncSearchClear();
        panel.updateCardManagerUI();
        if (searchEl) searchEl.focus();
      });
    }

    var tagBar = ctx.$('cardManagerTagBar');
    if (tagBar && !tagBar._cardMgrBound) {
      tagBar._cardMgrBound = true;
      tagBar.addEventListener('click', function(e) {
        var chip = e.target.closest('[data-card-tag]');
        if (chip) {
          e.preventDefault();
          toggleFilterTag(chip.getAttribute('data-card-tag'));
          return;
        }
        if (e.target.closest('#btnCardTagClear')) {
          e.preventDefault();
          selectedFilterTags.clear();
          panel.updateCardManagerUI();
        }
      });
    }

    var pickerBtn = ctx.$('btnCardTagPicker');
    if (pickerBtn && !pickerBtn._cardMgrBound) {
      pickerBtn._cardMgrBound = true;
      pickerBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        setTagPopupOpen(!tagPopupOpen);
        if (tagPopupOpen) {
          renderTagFilters(collectAllTags(getDraftsForDisplay()));
        }
      });
    }

    var tagPopup = ctx.$('cardManagerTagPopup');
    if (tagPopup && !tagPopup._cardMgrBound) {
      tagPopup._cardMgrBound = true;
      tagPopup.addEventListener('click', function(e) {
        var chip = e.target.closest('[data-card-tag]');
        if (!chip) return;
        e.preventDefault();
        e.stopPropagation();
        toggleFilterTag(chip.getAttribute('data-card-tag'));
      });
    }

    document.addEventListener('click', function(e) {
      if (!tagPopupOpen) return;
      var filters = ctx.$('cardManagerFilters');
      if (filters && filters.contains(e.target)) return;
      setTagPopupOpen(false);
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && tagPopupOpen) setTagPopupOpen(false);
    });

    var btnNewDraft = ctx.$('btnNewDraft');
    if (btnNewDraft) {
      btnNewDraft.addEventListener('click', function () {
        panel.createBlankDraft({ jumpToCharacter: true });
      });
    }

    var listEl = ctx.$('cardManagerList');
    if (listEl) {
      listEl.addEventListener('click', function (e) {
        var actionEl = e.target.closest('[data-card-action]');
        var row = e.target.closest('.card-manager-item[data-draft-id]');
        if (!row) return;
        var id = row.getAttribute('data-draft-id');
        var action = actionEl ? actionEl.getAttribute('data-card-action') : 'open';
        if (action === 'delete') {
          e.preventDefault();
          e.stopPropagation();
          panel.deleteDraft(id);
          return;
        }
        if (action === 'dup') {
          e.preventDefault();
          e.stopPropagation();
          panel.duplicateDraft(id);
          return;
        }
        if (action === 'rename') {
          e.preventDefault();
          e.stopPropagation();
          panel.renameDraft(id);
          return;
        }
        if (action === 'export-check') {
          e.preventDefault();
          e.stopPropagation();
          openExportChecklistModal();
          return;
        }
        if (action === 'export-json') {
          e.preventDefault();
          e.stopPropagation();
          panel.exportDraftAsJson(id);
          return;
        }
        if (action === 'export-png') {
          e.preventDefault();
          e.stopPropagation();
          panel.exportDraftAsPng(id);
          return;
        }
        if (action === 'publish') {
          e.preventDefault();
          e.stopPropagation();
          panel.publishDraft(id);
          return;
        }
        if (action === 'share') {
          e.preventDefault();
          e.stopPropagation();
          panel.shareDraft(id);
          return;
        }
        if (action === 'reset-share') {
          e.preventDefault();
          e.stopPropagation();
          panel.shareDraft(id, { resetToken: true });
          return;
        }
        if (action === 'copy-share') {
          e.preventDefault();
          e.stopPropagation();
          panel.copyShareLink(id);
          return;
        }
        if (action === 'unshare') {
          e.preventDefault();
          e.stopPropagation();
          panel.unshareDraft(id);
          return;
        }
        // Click cover/name area: switch to that draft and go to character view
        panel.loadDraft(id);
        goToView('character');
      });
    }

    // Hash change / view switch → refresh card manager covers
    window.addEventListener('hashchange', function () {
      if (getCurrentAppView() === 'card-manager') panel.updateCardManagerUI();
    });
    window.addEventListener('app-view-changed', function (ev) {
      var view = ev && ev.detail && ev.detail.view;
      if (view === 'card-manager') panel.updateCardManagerUI();
    });
    window.addEventListener('st-idb-ready', function () {
      if (getCurrentAppView() === 'card-manager') panel.updateCardManagerUI();
    });

    // Assistant card API
    window.__assistantCardApi__ = {
      list: function () {
        var dr = getAllDrafts();
        var currentId = getCurrentDraftId();
        return {
          currentId: currentId || '',
          cards: Object.keys(dr).map(function (id) {
            return {
              id: id,
              name: draftDisplayName(dr[id]),
              updatedAt: dr[id].updatedAt || '',
              current: id === currentId,
            };
          }),
        };
      },
      switchTo: function (idOrName) {
        var key = String(idOrName || '').trim();
        if (!key) throw new Error('缺少 id 或 name');
        var dr = getAllDrafts();
        if (dr[key]) {
          panel.loadDraft(key);
          return { id: key, name: draftDisplayName(dr[key]) };
        }
        var found = Object.keys(dr).find(function (id) {
          return draftDisplayName(dr[id]) === key;
        });
        if (!found) throw new Error('未找到卡片: ' + key);
        panel.loadDraft(found);
        return { id: found, name: draftDisplayName(dr[found]) };
      },
      create: function (opts) {
        opts = opts || {};
        panel.createBlankDraft({ jumpToCharacter: false });
        if (opts.name) {
          ctx.state.charName = String(opts.name);
          var el = ctx.$('charName');
          if (el) el.value = String(opts.name);
          panel.saveCurrentDraft();
          panel.updateCardManagerUI();
        }
        return { id: ctx.state.draftId, name: ctx.state.charName || '未命名' };
      },
      duplicate: function (id) {
        var src = id || getCurrentDraftId();
        if (!src) throw new Error('无可复制卡片');
        panel.duplicateDraft(src);
        return { id: ctx.state.draftId, name: ctx.state.charName || '副本' };
      },
      rename: function (id, name) {
        return panel.renameDraft(id || getCurrentDraftId(), name);
      },
      delete: async function (id) {
        return panel.deleteDraft(id || getCurrentDraftId(), { force: true });
      },
      importJson: function (cardJson) {
        if (!cardJson || typeof cardJson !== 'object') throw new Error('需要已解析的 cardJson 对象');
        if (typeof window.applyJSONFromEditor !== 'function') throw new Error('导入桥接未就绪');
        window.applyJSONFromEditor(cardJson);
        panel.saveCurrentDraft();
        panel.updateCardManagerUI();
        return { id: ctx.state.draftId, name: ctx.state.charName || '导入卡' };
      },
      exportCheck: function () {
        if (typeof window.__getExportChecklist__ === 'function') {
          return window.__getExportChecklist__();
        }
        var wb = Array.isArray(ctx.state.worldbookEntries) ? ctx.state.worldbookEntries : [];
        return buildExportChecklist({
          charName: ctx.state.charName,
          charDesc: ctx.state.charDesc,
          firstMes: ctx.state.firstMes || (ctx.$('firstMes') || {}).value || '',
          hasAvatar: !!(ctx.state.avatarInIdb || ctx.state.avatarBase64),
          worldbookCount: wb.length,
          worldbookNoKeys: wb.filter(function(e) {
            return e && e.enabled !== false && (!e.keys || !e.keys.length);
          }).length,
          altGreetingCount: Array.isArray(window.__altGreetings__) ? window.__altGreetings__.length : 0,
        });
      },
    };

    var btnRefreshChecklist = ctx.$('btnRefreshExportChecklist');
    if (btnRefreshChecklist) {
      btnRefreshChecklist.addEventListener('click', function() {
        panel.refreshExportChecklist();
      });
    }
    if (getCurrentAppView() === 'card-manager') panel.refreshExportChecklist();
  };

  // Mount
  ctx.panels.cardManager = panel;
  return panel;
}
