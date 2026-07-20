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

export function registerCardManager(ctx) {
  var panel = {};

  var managerThumbUrls = [];
  var cardManagerUiTimer = null;
  var cardManagerUiPendingDrafts = undefined;
  var CARD_MANAGER_UI_DEBOUNCE_MS = 80;
  var autoSaveTimer;

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

  // ---- Actions HTML ----
  panel.buildCardManagerActionsHtml = function () {
    function iconBtn(action, label, extraClass) {
      var cls = 'btn-icon btn-icon--sm card-mgr-icon' + (extraClass ? ' ' + extraClass : '');
      var icons = {
        dup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
        rename: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M15.5 5.5l3 3L8 19l-4 1 1-4 10.5-10.5z"/></svg>',
        'export-json': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13 6l-2 12"/></svg>',
        'export-png': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M4 16l4.5-4.5 3 3L14 12l6 6"/></svg>',
        delete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M10 11v6M14 11v6"/><path d="M7 7l1 12a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9l1-12"/></svg>',
      };
      return '<button type="button" class="' + cls + '" data-card-action="' + action + '" title="' + label + '" aria-label="' + label + '">' + (icons[action] || '') + '</button>';
    }
    return ''
      + '<div class="card-manager-item-actions__group">'
      + iconBtn('dup', '复制')
      + iconBtn('rename', '重命名')
      + '</div>'
      + '<div class="card-manager-item-actions__group">'
      + iconBtn('export-json', '导出 JSON', 'card-mgr-icon--export')
      + iconBtn('export-png', '导出 PNG', 'card-mgr-icon--export')
      + iconBtn('delete', '删除', 'card-mgr-icon--danger btn-icon--danger')
      + '</div>';
  };

  // ---- Core render ----
  panel.render = function (storedDrafts) {
    var listEl = ctx.$('cardManagerList');
    if (!listEl) return;
    revokeManagerThumbs();
    var dr = getDraftsForDisplay(storedDrafts);
    var ks = Object.keys(dr);
    if (!ks.length) {
      listEl.innerHTML = '<p class="card-manager-empty">暂无角色卡，点击右上角「新建」</p>';
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
      if (active) {
        var badge = document.createElement('span');
        badge.className = 'card-manager-badge';
        badge.textContent = '当前';
        cover.appendChild(badge);
      }

      var main = document.createElement('div');
      main.className = 'card-manager-item-main';
      main.setAttribute('data-card-action', 'open');
      main.innerHTML =
        '<div class="card-manager-item-name">' + ctx.escapeHtml(draftDisplayName(d)) + '</div>' +
        '<div class="card-manager-item-meta">更新 ' + ctx.escapeHtml(d.updatedAt || '—') + '</div>';

      var actions = document.createElement('div');
      actions.className = 'card-manager-item-actions';
      actions.innerHTML = panel.buildCardManagerActionsHtml();

      item.appendChild(cover);
      item.appendChild(main);
      item.appendChild(actions);
      listEl.appendChild(item);
    });
  };

  panel.refreshExportChecklist = function () {
    var box = ctx.$('exportChecklistBox');
    var summaryEl = ctx.$('exportChecklistSummary');
    var listEl = ctx.$('exportChecklistItems');
    if (!box || !summaryEl || !listEl) return;
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
    box.hidden = false;
    summaryEl.textContent = check.summary || (check.ok ? '检查通过' : '存在问题');
    if (!check.items || !check.items.length) {
      listEl.innerHTML = '<li>当前卡可导出 JSON' + (check.canExportPng ? ' / PNG' : '（PNG 需头像）') + '</li>';
      return;
    }
    listEl.innerHTML = check.items.map(function(it) {
      var cls = it.level === 'critical' ? 'is-critical' : (it.level === 'warning' ? 'is-warning' : '');
      var jump = it.view
        ? '<button type="button" class="export-checklist-jump" data-view="' + escapeHtml(it.view) + '">去处理</button>'
        : '';
      return '<li class="' + cls + '"><span>' + escapeHtml(it.message) + '</span>' + jump + '</li>';
    }).join('');
    listEl.querySelectorAll('.export-checklist-jump').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var view = btn.getAttribute('data-view');
        if (view) goToView(view);
      });
    });
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
      panel.render(pending);
      if (getCurrentAppView() === 'card-manager') panel.refreshExportChecklist();
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
