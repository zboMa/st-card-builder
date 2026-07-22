/**
 * 卡片管理：共享闭包状态与 DOM/草稿工具（拆自 cardManager）
 */

import {
  buildDraftSnapshot,
  draftDisplayName,
  normalizeTags,
} from '../state.mjs';
import { normalizeCharacterVersion } from '../cardRelease.mjs';

/** @param {object} ctx */
export function createCardManagerShared(ctx) {
  /** @type {object|null} */
  var panel = null;

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
    syncDomFieldsToState();
    var dr = stored ? Object.assign({}, stored) : getAllDrafts();
    var currentId = getCurrentDraftId();
    if (currentId) {
      var snap = buildDraftSnapshot(ctx.state);
      var existing = dr[currentId] || {};
      var merged = Object.assign({}, existing, snap);
      if (existing.avatarInIdb != null) merged.avatarInIdb = existing.avatarInIdb;
      if (existing.avatarBase64 != null && existing.avatarBase64.length > 100) merged.avatarBase64 = existing.avatarBase64;
      // 列表展示不得用「此刻时钟」覆盖已落盘时间，否则云状态基线永远对不上
      merged.updatedAt = existing.updatedAt || ctx.state.updatedAt || snap.updatedAt || '';
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
    var text = String(msg || '').trim();
    var bar = ctx.$('importStatusBar');
    if (bar) {
      bar.style.display = 'none';
      bar.textContent = '';
      bar.classList.remove('is-error');
    }
    if (!text) return;
    if (isError) {
      if (ctx.showAppNotification) {
        ctx.showAppNotification({ title: '操作未完成', message: text, level: 'error' });
      } else if (ctx.showAppMessage) {
        ctx.showAppMessage(text, { level: 'error' });
      }
      return;
    }
    if (ctx.showAppMessage) ctx.showAppMessage(text);
  }

  async function copyTextWithFallback(text, label) {
    var value = String(text || '');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch (e) { /* fall through */ }
    var copied = await ctx.showPromptDialog({
      icon: '🔗',
      title: label || '复制链接',
      message: '自动复制失败，请手动全选复制。',
      defaultValue: value,
      okText: '关闭',
      cancelText: '取消',
    });
    return copied !== null;
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
          return '<button type="button" class="card-manager-tag-option' + (active ? ' is-active' : '')
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
    if (!popup) {
      if (btn) btn.setAttribute('aria-expanded', 'false');
      return;
    }
    if (btn) btn.setAttribute('aria-expanded', tagPopupOpen ? 'true' : 'false');
    if (!tagPopupOpen) {
      popup.hidden = true;
      popup.classList.remove('is-fixed-portal');
      popup.style.left = '';
      popup.style.top = '';
      popup.style.width = '';
      popup.style.visibility = '';
      if (popup._tagPopupHome && popup.parentNode !== popup._tagPopupHome) {
        popup._tagPopupHome.appendChild(popup);
      }
      if (tagPopupRepositionHandler) {
        window.removeEventListener('scroll', tagPopupRepositionHandler, true);
        window.removeEventListener('resize', tagPopupRepositionHandler);
        tagPopupRepositionHandler = null;
      }
      return;
    }
    if (!popup._tagPopupHome) popup._tagPopupHome = popup.parentNode;
    document.body.appendChild(popup);
    popup.hidden = false;
    popup.classList.add('is-fixed-portal');
    positionFixedPopover(popup, btn || popup._tagPopupHome, { width: 240, gap: 4 });
    tagPopupRepositionHandler = function() {
      if (!tagPopupOpen || !popup.isConnected) return;
      var anchor = ctx.$('btnCardTagPicker') || popup._tagPopupHome;
      if (!anchor || !anchor.isConnected) {
        setTagPopupOpen(false);
        return;
      }
      positionFixedPopover(popup, anchor, { width: 240, gap: 4 });
    };
    window.addEventListener('scroll', tagPopupRepositionHandler, true);
    window.addEventListener('resize', tagPopupRepositionHandler);
  }

  var tagPopupRepositionHandler = null;

  function toggleFilterTag(tag) {
    var t = String(tag || '').trim();
    if (!t) return;
    if (selectedFilterTags.has(t)) selectedFilterTags.delete(t);
    else selectedFilterTags.add(t);
    if (panel) panel.updateCardManagerUI();
  }

  function positionFixedPopover(pop, anchorBtn, opts) {
    opts = opts || {};
    var width = opts.width || 220;
    var gap = opts.gap != null ? opts.gap : 6;
    var rect = anchorBtn.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight || 0;
    var vw = window.innerWidth || document.documentElement.clientWidth || 0;
    // 先放到视口外测高
    pop.style.visibility = 'hidden';
    pop.style.left = '0px';
    pop.style.top = '0px';
    pop.style.width = width + 'px';
    var popH = Math.max(pop.offsetHeight || 280, 120);
    var popW = Math.min(width, vw - 16);
    pop.style.width = popW + 'px';

    var preferAbove = rect.top > vh - rect.bottom;
    var top;
    if (preferAbove) {
      top = rect.top - popH - gap;
      if (top < 8) top = 8;
    } else {
      top = rect.bottom + gap;
      if (top + popH > vh - 8) top = Math.max(8, vh - popH - 8);
    }
    var left = rect.right - popW;
    if (left < 8) left = 8;
    if (left + popW > vw - 8) left = Math.max(8, vw - popW - 8);

    pop.style.left = Math.round(left) + 'px';
    pop.style.top = Math.round(top) + 'px';
    pop.style.visibility = '';
  }

  function bindPanel(p) {
    panel = p;
  }

  return {
    bindPanel: bindPanel,
    getPanel: function() { return panel; },
    get managerThumbUrls() { return managerThumbUrls; },
    get cardManagerUiTimer() { return cardManagerUiTimer; },
    set cardManagerUiTimer(v) { cardManagerUiTimer = v; },
    get cardManagerUiPendingDrafts() { return cardManagerUiPendingDrafts; },
    set cardManagerUiPendingDrafts(v) { cardManagerUiPendingDrafts = v; },
    CARD_MANAGER_UI_DEBOUNCE_MS: CARD_MANAGER_UI_DEBOUNCE_MS,
    get autoSaveTimer() { return autoSaveTimer; },
    set autoSaveTimer(v) { autoSaveTimer = v; },
    selectedFilterTags: selectedFilterTags,
    get cardManagerSearchQuery() { return cardManagerSearchQuery; },
    set cardManagerSearchQuery(v) { cardManagerSearchQuery = v; },
    get lastExportCheck() { return lastExportCheck; },
    set lastExportCheck(v) { lastExportCheck = v; },
    get tagPopupOpen() { return tagPopupOpen; },
    set tagPopupOpen(v) { tagPopupOpen = v; },
    get tagPopupRepositionHandler() { return tagPopupRepositionHandler; },
    set tagPopupRepositionHandler(v) { tagPopupRepositionHandler = v; },
    get cardVersionMenuDocHandler() { return cardVersionMenuDocHandler; },
    set cardVersionMenuDocHandler(v) { cardVersionMenuDocHandler = v; },
    get cardMoreMenuDocHandler() { return cardMoreMenuDocHandler; },
    set cardMoreMenuDocHandler(v) { cardMoreMenuDocHandler = v; },
    get cardMoreMenuRepositionHandler() { return cardMoreMenuRepositionHandler; },
    set cardMoreMenuRepositionHandler(v) { cardMoreMenuRepositionHandler = v; },
    ensureIdbReady: ensureIdbReady,
    revokeManagerThumbs: revokeManagerThumbs,
    hydrateManagerCoverThumb: hydrateManagerCoverThumb,
    setCharTags: setCharTags,
    syncDomFieldsToState: syncDomFieldsToState,
    getCurrentDraftId: getCurrentDraftId,
    getAllDrafts: getAllDrafts,
    getDraftsForDisplay: getDraftsForDisplay,
    getCurrentAppView: getCurrentAppView,
    goToView: goToView,
    setCardManagerStatus: setCardManagerStatus,
    copyTextWithFallback: copyTextWithFallback,
    draftWorkVersion: draftWorkVersion,
    buildShareMetaLine: buildShareMetaLine,
    draftTags: draftTags,
    collectAllTags: collectAllTags,
    draftMatchesFilters: draftMatchesFilters,
    renderTagFilters: renderTagFilters,
    setTagPopupOpen: setTagPopupOpen,
    toggleFilterTag: toggleFilterTag,
    positionFixedPopover: positionFixedPopover,
  };
}
