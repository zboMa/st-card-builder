/**
 * 卡片管理：Render（拆自 cardManager）
 */

import { buildExportChecklist } from '../exportChecklist.mjs';
import { escapeHtml } from '../../utils.mjs';
import { getCardShareMeta } from '../cardShareClient.mjs';
import { getCardCloudMeta, resolveCardCloudStatus, resolveCardCloudQuickAction } from '../../sync/cardCloudMeta.mjs';
import { buildDraftSnapshot, draftDisplayName, DRAFTS_KEY } from '../state.mjs';
import { listCardVersions, ensureCardVersions, bumpCardDraftVersion, switchCardDraftVersion } from '../cardVersions.mjs';
import { normalizeCharacterVersion } from '../cardRelease.mjs';

/** @param {object} ctx @param {object} s @param {object} panel */
export function attachCardManagerRender(ctx, s, panel) {
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
    var all = s.getAllDrafts();
    var currentId = s.getCurrentDraftId();
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
    s.positionFixedPopover(pop, anchorBtn, { width: 280, gap: 4 });
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
    var currentId = s.getCurrentDraftId();
    if (id === currentId) panel.saveCurrentDraft();
    var all = s.getAllDrafts();
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
    s.setCardManagerStatus('已增版至 v' + d.characterVersion + '（上一版已写入列表）');
    panel.updateCardManagerUI();
    if (id === currentId) panel.loadDraft(id);
  };

  panel.switchDraftVersion = async function(id, targetVer) {
    if (!id || !targetVer) return;
    var currentId = s.getCurrentDraftId();
    if (id === currentId) panel.saveCurrentDraft();
    var all = s.getAllDrafts();
    var d = id === currentId
      ? Object.assign({}, buildDraftSnapshot(ctx.state), { draftId: id })
      : all[id];
    if (!d) return;
    ensureCardVersions(d);
    var sw = switchCardDraftVersion(d, targetVer);
    if (!sw.ok) {
      s.setCardManagerStatus('无法切换：' + (sw.error || '未知错误'), true);
      return;
    }
    all[id] = d;
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(all));
    if (id === currentId) {
      panel.loadDraft(id);
    }
    s.setCardManagerStatus('已切换到 v' + targetVer);
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
      + item('cloud-upload', '同步上云', !cloudLoggedIn)
      + item('cloud-download', '从云端覆盖', !cloudLoggedIn)
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
      s.positionFixedPopover(pop, anchorBtn, { width: 220 });
    }
    pop.innerHTML = panel.buildCardMoreMenuHtml(shareMeta, loggedIn);
    // 挂到 body，避免卡片 overflow:hidden 裁切
    document.body.appendChild(pop);
    s.positionFixedPopover(pop, anchorBtn, { width: 220 });
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
      s.positionFixedPopover(pop, anchorBtn, { width: 220 });
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
    s.revokeManagerThumbs();
    var dr = s.getDraftsForDisplay(storedDrafts);
    var allTags = s.collectAllTags(dr);
    s.renderTagFilters(allTags);
    if (s.tagPopupOpen) {
      var popup = ctx.$('cardManagerTagPopup');
      var btn = ctx.$('btnCardTagPicker');
      if (popup && btn) {
        if (!popup._tagPopupHome) popup._tagPopupHome = ctx.$('cardManagerFilters') || popup.parentNode;
        if (popup.parentNode !== document.body) document.body.appendChild(popup);
        popup.hidden = false;
        popup.classList.add('is-fixed-portal');
        s.positionFixedPopover(popup, btn, { width: 320, gap: 4 });
      }
    }

    var ks = Object.keys(dr).filter(function(id) {
      return s.draftMatchesFilters(dr[id] || {});
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
    var currentId = s.getCurrentDraftId();
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
        s.hydrateManagerCoverThumb(id, cover, loadingPh);
      } else {
        var ph = document.createElement('span');
        ph.className = 'card-manager-cover-placeholder';
        ph.textContent = '无封面';
        cover.appendChild(ph);
      }

      var badges = document.createElement('div');
      badges.className = 'card-manager-cover-badges';
      if (active) {
        badges.insertAdjacentHTML('beforeend', buildCheckBadgeHtml(s.lastExportCheck));
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
      verBadge.textContent = 'v' + s.draftWorkVersion(d);
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
      var stubHint = d._cloudStub ? ' · 云端摘要' : '';
      var overlay = document.createElement('div');
      overlay.className = 'card-manager-cover-overlay';
      overlay.innerHTML =
        '<button type="button" class="card-manager-item-name" data-card-action="rename" title="点击重命名">'
        + ctx.escapeHtml(draftDisplayName(d)) + '</button>'
        + '<div class="card-manager-item-meta">更新 ' + ctx.escapeHtml(d.updatedAt || '—')
        + stubHint
        + ' ' + cloudStatusIconHtml(cloudStatus)
        + '<br>' + ctx.escapeHtml(s.buildShareMetaLine(d, shareMeta)) + '</div>';
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
    s.lastExportCheck = {
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
        if (view) s.goToView(view);
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
    s.cardManagerUiPendingDrafts = storedDrafts;
    if (s.cardManagerUiTimer) clearTimeout(s.cardManagerUiTimer);
    s.cardManagerUiTimer = setTimeout(function () {
      s.cardManagerUiTimer = null;
      var pending = s.cardManagerUiPendingDrafts;
      s.cardManagerUiPendingDrafts = undefined;
      if (s.getCurrentAppView() === 'card-manager') panel.refreshExportChecklist();
      panel.render(pending);
    }, s.CARD_MANAGER_UI_DEBOUNCE_MS);
  };

  panel.closeCardMoreMenu = closeCardMoreMenu;
  panel.openCardMoreMenu = openCardMoreMenu;
  panel.closeCardVersionMenu = closeCardVersionMenu;
  panel.openCardVersionMenu = openCardVersionMenu;
  panel.openExportChecklistModal = openExportChecklistModal;
  panel.closeExportChecklistModal = closeExportChecklistModal;
  return panel;
}
