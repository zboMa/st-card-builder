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
import {
  publishCardDraft,
  bumpCardDraftVersion,
  switchCardDraftVersion,
  listCardVersions,
  ensureCardVersions,
} from '../cardVersions.mjs';
import {
  getCardCloudMeta,
  resolveCardCloudStatus,
  resolveCardCloudQuickAction,
} from '../../sync/cardCloudMeta.mjs';

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
    panel.updateCardManagerUI();
  }

  // ---- Actions HTML ----
  function cloudStatusIconHtml(status) {
    var label = '未上云';
    var cls = 'card-cloud-status is-local';
    var svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.7-1.5A3.5 3.5 0 0 0 7 18z"/><path d="M9 12h6M12 9v6"/></svg>';
    if (status === 'cloud_synced') {
      label = '上云已同步';
      cls = 'card-cloud-status is-synced';
      svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.7-1.5A3.5 3.5 0 0 0 7 18z"/><path d="M9.5 13.2l1.8 1.8 3.4-3.6"/></svg>';
    } else if (status === 'cloud_dirty') {
      label = '上云未同步';
      cls = 'card-cloud-status is-dirty';
      svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.7-1.5A3.5 3.5 0 0 0 7 18z"/><path d="M12 10v3"/><path d="M12 15.5h.01"/></svg>';
    }
    return '<span class="' + cls + '" title="' + label + '" aria-label="' + label + '">' + svg + '</span>';
  }


  function closeCardVersionMenu() {
    document.querySelectorAll('.card-version-popover').forEach(function(el) { el.remove(); });
    if (cardVersionMenuDocHandler) {
      document.removeEventListener('mousedown', cardVersionMenuDocHandler, true);
      cardVersionMenuDocHandler = null;
    }
  }
  var cardVersionMenuDocHandler = null;

  function openCardVersionMenu(anchorBtn, cardId) {
    closeCardVersionMenu();
    closeCardMoreMenu();
    if (!anchorBtn || !cardId) return;
    var all = getAllDrafts();
    var currentId = getCurrentDraftId();
    var d = cardId === currentId
      ? Object.assign({}, buildDraftSnapshot(ctx.state), { draftId: cardId, versions: ctx.state.versions || (all[cardId] && all[cardId].versions) || [] })
      : (all[cardId] || {});
    ensureCardVersions(d);
    // 合并当前草稿虚线：若当前 ver 不在列表，展示为「草稿中」
    var list = listCardVersions(d);
    var draftVer = normalizeCharacterVersion(d.characterVersion);
    var hasDraftVer = list.some(function(v) { return normalizeCharacterVersion(v.ver) === draftVer; });
    var pop = document.createElement('div');
    pop.className = 'card-version-popover';
    pop.setAttribute('data-card-id', cardId);
    var rows = list.map(function(v) {
      var active = normalizeCharacterVersion(v.ver) === draftVer;
      return '<button type="button" class="card-version-item' + (active ? ' is-active' : '') + '" data-ss-ver="'
        + ctx.escapeHtml(v.ver) + '">'
        + '<span class="card-version-item__ver">v' + ctx.escapeHtml(v.ver) + '</span>'
        + '<span class="card-version-item__meta">'
        + (v.published ? '已发布' : '未发布')
        + (active ? ' · 当前草稿' : '')
        + '</span></button>';
    }).join('');
    if (!hasDraftVer) {
      rows = '<div class="card-version-item is-active is-draftonly">'
        + '<span class="card-version-item__ver">v' + ctx.escapeHtml(draftVer) + '</span>'
        + '<span class="card-version-item__meta">当前草稿（尚未写入列表）</span></div>'
        + rows;
    }
    if (!rows) {
      rows = '<div class="card-more-hint">暂无版本记录。增版或发布后出现在此。</div>';
    }
    pop.innerHTML = '<div class="card-more-section__title">版本列表</div>'
      + '<p class="card-more-hint">点击版本号切换；切换会把当前草稿写入列表。发布会写入并自动升草稿版号。</p>'
      + rows
      + '<div class="card-more-divider"></div>'
      + '<button type="button" class="card-more-item" data-ss-ver-bump="minor">小版本增版</button>'
      + '<button type="button" class="card-more-item" data-ss-ver-bump="major">大版本增版</button>';
    document.body.appendChild(pop);
    positionFixedPopover(pop, anchorBtn, { width: 280, gap: 4 });
    setTimeout(function() {
      cardVersionMenuDocHandler = function(ev) {
        if (!pop.contains(ev.target) && ev.target !== anchorBtn && !anchorBtn.contains(ev.target)) {
          closeCardVersionMenu();
        }
      };
      document.addEventListener('mousedown', cardVersionMenuDocHandler, true);
    }, 0);
    pop.addEventListener('click', async function(ev) {
      var bump = ev.target.closest('[data-ss-ver-bump]');
      var item = ev.target.closest('[data-ss-ver]');
      if (bump) {
        ev.preventDefault();
        await panel.bumpDraftVersion(cardId, bump.getAttribute('data-ss-ver-bump'));
        closeCardVersionMenu();
        return;
      }
      if (item) {
        ev.preventDefault();
        var ver = item.getAttribute('data-ss-ver');
        await panel.switchDraftVersion(cardId, ver);
        closeCardVersionMenu();
      }
    });
  }

  panel.bumpDraftVersion = async function(id, which) {
    if (!id) return;
    var currentId = getCurrentDraftId();
    if (id === currentId) panel.saveCurrentDraft();
    var all = getAllDrafts();
    var d = id === currentId
      ? Object.assign({}, buildDraftSnapshot(ctx.state), { draftId: id })
      : all[id];
    if (!d) return;
    ensureCardVersions(d);
    bumpCardDraftVersion(d, which === 'major' ? 'major' : 'minor');
    all[id] = d;
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(all));
    if (id === currentId) {
      ctx.state.characterVersion = d.characterVersion;
      ctx.state.versions = d.versions;
      Object.keys(d).forEach(function(k) {
        if (k === 'versions' || k === 'draftId') return;
        if (k in ctx.state) ctx.state[k] = d[k];
      });
      var verEl = ctx.$('characterVersion');
      if (verEl) verEl.value = d.characterVersion;
      if (ctx.panels.character && ctx.panels.character.renderCharTags) {
        /* keep */
      }
    }
    setCardManagerStatus('已增版至 v' + d.characterVersion + '（上一版已写入列表）');
    panel.updateCardManagerUI();
    if (id === currentId) panel.loadDraft(id);
  };

  panel.switchDraftVersion = async function(id, targetVer) {
    if (!id || !targetVer) return;
    var currentId = getCurrentDraftId();
    if (id === currentId) panel.saveCurrentDraft();
    var all = getAllDrafts();
    var d = id === currentId
      ? Object.assign({}, buildDraftSnapshot(ctx.state), { draftId: id })
      : all[id];
    if (!d) return;
    ensureCardVersions(d);
    var sw = switchCardDraftVersion(d, targetVer);
    if (!sw.ok) {
      setCardManagerStatus('无法切换：' + (sw.error || '未知错误'), true);
      return;
    }
    all[id] = d;
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(all));
    if (id === currentId) {
      panel.loadDraft(id);
    }
    setCardManagerStatus('已切换到 v' + targetVer);
    panel.updateCardManagerUI();
  };

  panel.buildCardManagerActionsHtml = function (meta, cloudStatus) {
    meta = meta || {};
    function iconBtn(action, label, extraClass, svgOverride) {
      var cls = 'btn-icon btn-icon--sm card-mgr-icon' + (extraClass ? ' ' + extraClass : '');
      var icons = {
        dup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
        more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/></svg>',
        delete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M10 11v6M14 11v6"/><path d="M7 7l1 12a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9l1-12"/></svg>',
        'cloud-upload': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.7-1.5A3.5 3.5 0 0 0 7 18z"/><path d="M12 15V9"/><path d="M9.5 11.5 12 9l2.5 2.5"/></svg>',
      };
      return '<button type="button" class="' + cls + '" data-card-action="' + action + '" title="' + label + '" aria-label="' + label + '">'
        + (svgOverride || icons[action] || '') + '</button>';
    }
    var quick = resolveCardCloudQuickAction(cloudStatus);
    var cloudBtn = quick
      ? iconBtn(quick.action, quick.label, 'card-mgr-icon--cloud')
      : '';
    return ''
      + '<div class="card-manager-item-actions__group">'
      + iconBtn('dup', '复制')
      + iconBtn('delete', '删除', 'card-mgr-icon--danger btn-icon--danger')
      + '</div>'
      + '<div class="card-manager-item-actions__group card-manager-item-actions__group--end">'
      + cloudBtn
      + iconBtn('more', '更多操作')
      + '</div>';
  };

  panel.buildCardMoreMenuHtml = function (meta, cloudLoggedIn) {
    meta = meta || {};
    function item(action, label, disabled) {
      return '<button type="button" class="card-more-item" data-card-action="' + action + '"'
        + (disabled ? ' disabled' : '') + '>' + label + '</button>';
    }
    var shareBits = ''
      + item('publish', '发布', !cloudLoggedIn)
      + item('share', '分享', !cloudLoggedIn)
      + (meta.token ? item('copy-share', '复制链接') : '')
      + (meta.token ? item('reset-share', '重置链接', !cloudLoggedIn) : '')
      + (meta.token ? item('unshare', '停分享', !cloudLoggedIn) : '');
    return ''
      + '<div class="card-more-menu" role="menu">'
      + '<div class="card-more-section">'
      + '<div class="card-more-section__title">导出</div>'
      + item('export-json', '导出 JSON')
      + item('export-png', '导出 PNG')
      + item('export-check', '导出前检查')
      + '</div>'
      + '<div class="card-more-divider" role="separator"></div>'
      + '<div class="card-more-section">'
      + '<div class="card-more-section__title">发布与分享</div>'
      + shareBits
      + '</div>'
      + '<div class="card-more-divider" role="separator"></div>'
      + '<div class="card-more-section">'
      + '<div class="card-more-section__title">云端</div>'
      + item('cloud-upload', '上传覆盖云端', !cloudLoggedIn)
      + item('cloud-download', '拉取覆盖本地', !cloudLoggedIn)
      + item('cloud-delete', '删除云端', !cloudLoggedIn)
      + (!cloudLoggedIn ? '<p class="card-more-hint">请先在「账户与云端」登录</p>' : '')
      + '</div>'
      + '</div>';
  };

  function closeCardMoreMenu() {
    document.querySelectorAll('.card-more-popover').forEach(function(el) { el.remove(); });
    document.querySelectorAll('[data-card-action="more"][aria-expanded="true"]').forEach(function(btn) {
      btn.setAttribute('aria-expanded', 'false');
    });
    if (cardMoreMenuDocHandler) {
      document.removeEventListener('mousedown', cardMoreMenuDocHandler, true);
      cardMoreMenuDocHandler = null;
    }
    if (cardMoreMenuRepositionHandler) {
      window.removeEventListener('scroll', cardMoreMenuRepositionHandler, true);
      window.removeEventListener('resize', cardMoreMenuRepositionHandler);
      cardMoreMenuRepositionHandler = null;
    }
  }

  var cardMoreMenuDocHandler = null;
  var cardMoreMenuRepositionHandler = null;

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

  function openCardMoreMenu(anchorBtn, cardId, shareMeta) {
    closeCardMoreMenu();
    if (!anchorBtn) return;
    anchorBtn.setAttribute('aria-expanded', 'true');
    var pop = document.createElement('div');
    pop.className = 'card-more-popover';
    pop.setAttribute('data-card-id', cardId);
    pop.setAttribute('role', 'menu');
    var loggedIn = false;
    try {
      loggedIn = !!(window.__syncCloudEnabled__ || (window.__getCloudEnabled__ && window.__getCloudEnabled__()));
    } catch (e) { loggedIn = false; }
    function fill(logged) {
      if (!pop.isConnected) return;
      pop.innerHTML = panel.buildCardMoreMenuHtml(shareMeta, logged);
      positionFixedPopover(pop, anchorBtn, { width: 220 });
    }
    pop.innerHTML = panel.buildCardMoreMenuHtml(shareMeta, loggedIn);
    // 挂到 body，避免卡片 overflow:hidden 裁切
    document.body.appendChild(pop);
    positionFixedPopover(pop, anchorBtn, { width: 220 });
    import('../../sync/index.mjs').then(function(sync) {
      if (sync.isCloudEnabled) loggedIn = !!sync.isCloudEnabled();
      fill(loggedIn);
    }).catch(function() {
      fill(false);
    });

    cardMoreMenuRepositionHandler = function() {
      if (!pop.isConnected || !anchorBtn.isConnected) {
        closeCardMoreMenu();
        return;
      }
      positionFixedPopover(pop, anchorBtn, { width: 220 });
    };
    window.addEventListener('scroll', cardMoreMenuRepositionHandler, true);
    window.addEventListener('resize', cardMoreMenuRepositionHandler);

    setTimeout(function() {
      cardMoreMenuDocHandler = function(ev) {
        if (!pop.contains(ev.target) && ev.target !== anchorBtn && !anchorBtn.contains(ev.target)) {
          closeCardMoreMenu();
        }
      };
      document.addEventListener('mousedown', cardMoreMenuDocHandler, true);
    }, 0);
  }

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
    closeCardMoreMenu();
    var listEl = ctx.$('cardManagerList');
    if (!listEl) return;
    revokeManagerThumbs();
    var dr = getDraftsForDisplay(storedDrafts);
    var allTags = collectAllTags(dr);
    renderTagFilters(allTags);
    if (tagPopupOpen) {
      var popup = ctx.$('cardManagerTagPopup');
      var btn = ctx.$('btnCardTagPicker');
      if (popup && btn) {
        if (!popup._tagPopupHome) popup._tagPopupHome = ctx.$('cardManagerFilters') || popup.parentNode;
        if (popup.parentNode !== document.body) document.body.appendChild(popup);
        popup.hidden = false;
        popup.classList.add('is-fixed-portal');
        positionFixedPopover(popup, btn, { width: 320, gap: 4 });
      }
    }

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
      var verBadge = document.createElement('button');
      verBadge.type = 'button';
      verBadge.className = 'card-manager-version-badge';
      verBadge.setAttribute('data-card-action', 'versions');
      verBadge.title = '版本列表 / 切换版本';
      verBadge.textContent = 'v' + draftWorkVersion(d);
      badges.appendChild(verBadge);
      cover.appendChild(badges);

      var shareMeta = getCardShareMeta(id) || {};
      var cloudMeta = null;
      try {
        cloudMeta = getCardCloudMeta(id);
      } catch (eMeta) {
        cloudMeta = null;
      }
      var cloudStatus = resolveCardCloudStatus(d, cloudMeta);
      var overlay = document.createElement('div');
      overlay.className = 'card-manager-cover-overlay';
      overlay.innerHTML =
        '<button type="button" class="card-manager-item-name" data-card-action="rename" title="点击重命名">'
        + ctx.escapeHtml(draftDisplayName(d)) + '</button>'
        + '<div class="card-manager-item-meta">更新 ' + ctx.escapeHtml(d.updatedAt || '—')
        + ' ' + cloudStatusIconHtml(cloudStatus)
        + '<br>' + ctx.escapeHtml(buildShareMetaLine(d, shareMeta)) + '</div>';
      cover.appendChild(overlay);

      var actions = document.createElement('div');
      actions.className = 'card-manager-item-actions';
      actions.innerHTML = panel.buildCardManagerActionsHtml(shareMeta, cloudStatus);

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

    // 云端占位卡或缺正文：拉取完整卡包（卡+头像+小说+创作）再打开
    if (dr[id]._cloudStub || !dr[id].charDesc) {
      try {
        var sync = await import('../../sync/index.mjs');
        var full = await sync.ensureCardBundleLocal(id, { force: true });
        if (!full) full = await sync.ensureCardLocal(id);
        if (full) {
          dr = getAllDrafts();
        }
      } catch (e) {
        console.warn('[cloud] ensureCardBundleLocal', e);
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
    var deleteStories = !!(opts && opts.deleteStories);
    if (!(opts && opts.force)) {
      var dlg = await ctx.showConfirmDialog({
        icon: '🗑️',
        title: '删除角色卡？',
        message: '将删除该卡及其小说工坊、RAG、头像等绑卡数据。',
        detail: '即将删除：' + draftNameVal + '。写出的小说默认保留，可在下方勾选一并删除。',
        okText: '删除',
        cancelText: '再想想',
        checks: [
          {
            id: 'deleteStories',
            label: '同时删除写出的小说（Story Studio）',
            checked: false,
          },
        ],
      });
      if (!dlg) return { ok: false, cancelled: true };
      deleteStories = !!(dlg.checks && dlg.checks.deleteStories);
    }
    var result = ctx.sm.deleteDraft(id);
    if (!result.ok) return result;

    // Clean up IndexedDB：工坊始终删；Story 按勾选
    ensureIdbReady().then(function () {
      if (window.__avatarIdb__) return window.__avatarIdb__.deleteAvatarDraft(id);
    }).catch(function () { console.warn('Deleting avatar draft from IDB failed'); });
    if (window.__novelIdb__) {
      window.__novelIdb__.removeNovelBucketIdb(id, localStorage).catch(function () { console.warn('Removing novel bucket from IDB failed'); });
    }
    import('../../idbStore.mjs').then(function(idb) {
      return idb.idbDeleteJson('novelRagV1:card:' + id);
    }).catch(function() {});
    if (deleteStories) {
      import('../../storyStudio/idb.mjs').then(function(storyIdb) {
        return storyIdb.deleteAllStoriesForCard(id);
      }).catch(function(e) { console.warn('[story] local cascade delete', e); });
    }
    import('../../sync/cascade.mjs').then(function(mod) {
      return mod.cascadeDeleteCardDocs(id, getAllDrafts(), { deleteStories: deleteStories });
    }).catch(function(e) { console.warn('[cloud] cascade delete', e); });

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
    return { ok: true, deleted: id, name: draftNameVal, deleteStories: deleteStories };
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
  panel.renameDraft = async function (id, newName) {
    var dr = getAllDrafts();
    var d = dr[id];
    if (!d) return { ok: false, error: '卡不存在' };
    var next;
    if (newName != null) {
      next = String(newName);
    } else {
      next = await ctx.showPromptDialog({
        icon: '✏️',
        title: '重命名角色卡',
        message: '输入新的角色卡名称。',
        defaultValue: draftDisplayName(d),
        okText: '保存',
        cancelText: '取消',
      });
      if (next === null) return { ok: false, cancelled: true };
    }
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
    var all = getAllDrafts();
    var stored = all[id];
    if (id !== currentId && !stored) {
      setCardManagerStatus('找不到该角色卡', true);
      return;
    }
    var d = id === currentId
      ? Object.assign({}, buildDraftSnapshot(ctx.state), { draftId: id })
      : Object.assign({}, stored, { draftId: id });
    ensureCardVersions(d);

    var okPublish = await ctx.showConfirmDialog({
      icon: '📣',
      title: '发布角色卡？',
      message: '将把当前草稿写入版本列表并标记为已发布，然后草稿自动升小版本。',
      detail: '分享 latest 指向最新已发版；亦可使用带版本号的链接。保存草稿不会写入版本列表。',
      okText: '发布',
      cancelText: '取消',
    });
    if (!okPublish) return;

    var withPng = false;
    if (d.avatarInIdb || d.avatarBase64 || (id === currentId && (ctx.state.avatarInIdb || ctx.state.avatarBase64))) {
      withPng = !!(await ctx.showConfirmDialog({
        icon: '🖼️',
        title: '同时上传 PNG？',
        message: '上传嵌入角色数据的 PNG（开启「PNG 直链」分享时需要）。',
        okText: '上传 PNG',
        cancelText: '仅 JSON',
      }));
    }

    var pub = publishCardDraft(d);
    all[id] = d;
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(all));
    if (id === currentId) {
      ctx.state.characterVersion = d.characterVersion;
      ctx.state.versions = d.versions;
      var verEl = ctx.$('characterVersion');
      if (verEl) verEl.value = d.characterVersion;
    }

    setCardManagerStatus('正在发布 v' + pub.publishedVer + '…');
    try {
      var pngBase64 = null;
      if (withPng) {
        // 临时用已发布版号导出 PNG：切回 published 字段
        var prevVer = d.characterVersion;
        d.characterVersion = pub.publishedVer;
        if (id === currentId) {
          ctx.state.characterVersion = pub.publishedVer;
          panel.saveCurrentDraft();
        }
        pngBase64 = await panel.buildPngBase64ForDraft(id);
        d.characterVersion = prevVer;
        if (id === currentId) {
          ctx.state.characterVersion = prevVer;
          panel.saveCurrentDraft();
        }
        if (!pngBase64) {
          setCardManagerStatus('无头像，已跳过 PNG；仍发布 JSON', true);
        }
      }
      var data = await apiPublishCard({
        cardId: id,
        cardJson: pub.cardJson,
        characterVersion: pub.publishedVer,
        title: pub.title,
        pngEnabled: !!(withPng && pngBase64),
        pngBase64: pngBase64,
      });
      try {
        var mirror = await import('../../sync/cardMirror.mjs');
        await mirror.mirrorCardReleaseToPouch(id, {
          characterVersion: data.characterVersion,
          title: pub.title,
          publishedAt: data.publishedAt,
          pngEnabled: !!(withPng && pngBase64),
          cardJson: pub.cardJson,
        });
      } catch (e) { console.warn('[cardShare] mirror', e); }
      setCardShareMeta(id, {
        publishedCharacterVersion: data.characterVersion,
        publishedAt: data.publishedAt,
        title: pub.title,
      });
      setCardManagerStatus('已发布 v' + data.characterVersion
        + '；草稿现为 v' + pub.draftVer
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
      var cont = await ctx.showConfirmDialog({
        icon: '⚠️',
        title: '工作版已超前',
        message: '当前工作版 ' + work + ' 已超前于已发布 ' + meta.publishedCharacterVersion + '。',
        detail: '分享仍只展示已发布版。是否继续？',
        okText: '继续分享',
        cancelText: '取消',
      });
      if (!cont) return;
    }

    var passRaw = await ctx.showPromptDialog({
      icon: '🔒',
      title: '分享访问密码',
      message: '可选。留空=不修改；填 clear=清除密码。查看信息/JSON 需登录同账号并校验此密码。',
      defaultValue: '',
      placeholder: '留空不修改',
      okText: '下一步',
      cancelText: '取消',
      select: false,
    });
    if (passRaw === null) return;

    var pngAns = await ctx.showConfirmDialog({
      icon: '🖼️',
      title: '开启 PNG 直链？',
      message: '开启后：持链接可不登录直接下载最新 PNG（内含完整卡数据）。信息页与 JSON 仍需登录。',
      okText: '开启',
      cancelText: '不开',
    });

    var expRaw = await ctx.showPromptDialog({
      icon: '⏳',
      title: '链接有效天数',
      message: '可选。留空=不修改；填 0=永不过期。',
      defaultValue: '',
      placeholder: '留空不修改',
      okText: '创建分享',
      cancelText: '取消',
      select: false,
    });
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
      if (url) {
        var okCopy = await copyTextWithFallback(url, '复制分享信息链接');
        if (okCopy) {
          setCardManagerStatus('分享信息链接已复制：' + url
            + (data.pngPublic && data.pngUrl ? '；PNG：' + data.pngUrl : '')
            + (data.hasPassword ? '（需密码）' : ''));
        } else {
          setCardManagerStatus('请复制分享链接');
        }
      } else {
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
    var okCopy = await copyTextWithFallback(meta.infoUrl, '复制分享信息链接');
    if (okCopy) {
      setCardManagerStatus('已复制：' + meta.infoUrl
        + (meta.pngUrl ? '（另有 PNG 直链）' : ''));
    }
  };

  panel.unshareDraft = async function (id) {
    var meta = getCardShareMeta(id) || {};
    if (!meta.token) {
      setCardManagerStatus('未在分享', true);
      return;
    }
    var okUnshare = await ctx.showConfirmDialog({
      icon: '🔗',
      title: '停止分享？',
      message: '停止分享后链接将失效。',
      okText: '停分享',
      cancelText: '取消',
    });
    if (!okUnshare) return;
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

  panel.cloudUploadOverwrite = async function (id) {
    if (!id) return;
    var ok = await ctx.showConfirmDialog({
      icon: '☁️',
      title: '上传覆盖云端？',
      message: '将用本机这张卡（含工坊/头像等绑卡数据）覆盖云端版本。',
      detail: '写出的小说（Story）不随此操作上传。',
      okText: '上传覆盖',
      cancelText: '取消',
    });
    if (!ok) return;
    setCardManagerStatus('正在上传覆盖云端…');
    try {
      var sync = await import('../../sync/index.mjs');
      if (sync.fetchSyncCredentials) await sync.fetchSyncCredentials();
      await sync.cloudUploadOverwrite(id);
      setCardManagerStatus('已上传覆盖云端');
      panel.updateCardManagerUI();
    } catch (e) {
      setCardManagerStatus('上传失败：' + (e && e.message || e), true);
    }
  };

  panel.cloudDownloadOverwrite = async function (id) {
    if (!id) return;
    var ok = await ctx.showConfirmDialog({
      icon: '⬇️',
      title: '拉取覆盖本地？',
      message: '将用云端版本覆盖本机这张卡（含工坊/头像等）。本地未上云的修改会丢失。',
      okText: '拉取覆盖',
      cancelText: '取消',
    });
    if (!ok) return;
    setCardManagerStatus('正在拉取覆盖本地…');
    try {
      var sync = await import('../../sync/index.mjs');
      if (sync.fetchSyncCredentials) await sync.fetchSyncCredentials();
      await sync.cloudDownloadOverwrite(id);
      setCardManagerStatus('已拉取覆盖本地');
      panel.updateCardManagerUI();
      if (id === getCurrentDraftId()) panel.loadDraft(id);
    } catch (e) {
      setCardManagerStatus('拉取失败：' + (e && e.message || e), true);
    }
  };

  panel.cloudDeleteRemote = async function (id) {
    if (!id) return;
    var ok = await ctx.showConfirmDialog({
      icon: '🗑️',
      title: '删除云端副本？',
      message: '只删除云端上的这张卡，本机草稿保留。',
      detail: '默认不删除云端写出的小说（Story）。',
      okText: '删除云端',
      cancelText: '取消',
    });
    if (!ok) return;
    setCardManagerStatus('正在删除云端…');
    try {
      var sync = await import('../../sync/index.mjs');
      if (sync.fetchSyncCredentials) await sync.fetchSyncCredentials();
      await sync.cloudDeleteRemoteOnly(id, { deleteStories: false });
      setCardManagerStatus('云端已删除，本地仍保留');
      panel.updateCardManagerUI();
    } catch (e) {
      setCardManagerStatus('删除云端失败：' + (e && e.message || e), true);
    }
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
      if (!d) {
        setCardManagerStatus('找不到该角色卡', true);
        return;
      }
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
      if (!d) {
        setCardManagerStatus('找不到该角色卡', true);
        return;
      }
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
    if (!avatar) {
      setCardManagerStatus('该卡尚未上传头像，无法导出 PNG', true);
      return;
    }
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
      setCardManagerStatus('导出失败: ' + err.message, true);
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

  function handleCardMoreAction(action, id) {
    if (!action || !id) return;
    closeCardMoreMenu();
    if (action === 'export-check') openExportChecklistModal();
    else if (action === 'export-json') panel.exportDraftAsJson(id);
    else if (action === 'export-png') panel.exportDraftAsPng(id);
    else if (action === 'publish') panel.publishDraft(id);
    else if (action === 'share') panel.shareDraft(id);
    else if (action === 'reset-share') panel.shareDraft(id, { resetToken: true });
    else if (action === 'copy-share') panel.copyShareLink(id);
    else if (action === 'unshare') panel.unshareDraft(id);
    else if (action === 'cloud-upload') panel.cloudUploadOverwrite(id);
    else if (action === 'cloud-download') panel.cloudDownloadOverwrite(id);
    else if (action === 'cloud-delete') panel.cloudDeleteRemote(id);
  }

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
      var popup = ctx.$('cardManagerTagPopup');
      var picker = ctx.$('btnCardTagPicker');
      if (filters && filters.contains(e.target)) return;
      if (popup && popup.contains(e.target)) return;
      if (picker && (e.target === picker || picker.contains(e.target))) return;
      setTagPopupOpen(false);
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        if (tagPopupOpen) setTagPopupOpen(false);
        closeCardMoreMenu();
        closeCardVersionMenu();
      }
    });

    if (!document._cardMoreMenuBound) {
      document._cardMoreMenuBound = true;
      document.addEventListener('click', function(e) {
        var pop = e.target.closest('.card-more-popover');
        if (!pop) return;
        var actionEl = e.target.closest('[data-card-action]');
        if (!actionEl) return;
        var action = actionEl.getAttribute('data-card-action');
        var id = pop.getAttribute('data-card-id');
        if (!id || !action) return;
        e.preventDefault();
        e.stopPropagation();
        handleCardMoreAction(action, id);
      });
    }

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
        if (action === 'more') {
          e.preventDefault();
          e.stopPropagation();
          var shareMetaMore = getCardShareMeta(id) || {};
          openCardMoreMenu(e.target.closest('[data-card-action="more"]'), id, shareMetaMore);
          return;
        }
        if (action === 'cloud-upload' || action === 'cloud-download' || action === 'cloud-delete') {
          e.preventDefault();
          e.stopPropagation();
          handleCardMoreAction(action, id);
          return;
        }
        if (action === 'versions') {
          e.preventDefault();
          e.stopPropagation();
          openCardVersionMenu(e.target.closest('[data-card-action="versions"]'), id);
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
          closeCardMoreMenu();
          openExportChecklistModal();
          return;
        }
        // Click cover/name area: switch to that draft and go to character view
        closeCardMoreMenu();
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
      bumpVersion: function (which) {
        var id = getCurrentDraftId();
        if (!id) throw new Error('无当前卡');
        return panel.bumpDraftVersion(id, which === 'major' ? 'major' : 'minor');
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
