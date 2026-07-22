/**
 * 卡片管理：Bind（拆自 cardManager）
 */

import { buildExportChecklist } from '../exportChecklist.mjs';
import { buildCardJSONFromDraft, draftDisplayName } from '../state.mjs';
import { getCardShareMeta } from '../cardShareClient.mjs';

/** @param {object} ctx @param {object} s @param {object} panel */
export function attachCardManagerBind(ctx, s, panel) {
  function handleCardMoreAction(action, id) {
    if (!action || !id) return;
    panel.closeCardMoreMenu();
    if (action === 'export-check') panel.openExportChecklistModal();
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
        s.cardManagerSearchQuery = searchEl.value || '';
        syncSearchClear();
        panel.updateCardManagerUI();
      });
      syncSearchClear();
    }
    if (searchClear && !searchClear._cardMgrBound) {
      searchClear._cardMgrBound = true;
      searchClear.addEventListener('click', function() {
        if (searchEl) searchEl.value = '';
        s.cardManagerSearchQuery = '';
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
          s.toggleFilterTag(chip.getAttribute('data-card-tag'));
          return;
        }
        if (e.target.closest('#btnCardTagClear')) {
          e.preventDefault();
          s.selectedFilterTags.clear();
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
        s.setTagPopupOpen(!s.tagPopupOpen);
        if (s.tagPopupOpen) {
          s.renderTagFilters(s.collectAllTags(s.getDraftsForDisplay()));
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
        s.toggleFilterTag(chip.getAttribute('data-card-tag'));
      });
    }

    document.addEventListener('click', function(e) {
      if (!s.tagPopupOpen) return;
      var filters = ctx.$('cardManagerFilters');
      var popup = ctx.$('cardManagerTagPopup');
      var picker = ctx.$('btnCardTagPicker');
      if (filters && filters.contains(e.target)) return;
      if (popup && popup.contains(e.target)) return;
      if (picker && (e.target === picker || picker.contains(e.target))) return;
      s.setTagPopupOpen(false);
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        if (s.tagPopupOpen) s.setTagPopupOpen(false);
        panel.closeCardMoreMenu();
        panel.closeCardVersionMenu();
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
          panel.openCardMoreMenu(e.target.closest('[data-card-action="more"]'), id, shareMetaMore);
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
          panel.openCardVersionMenu(e.target.closest('[data-card-action="versions"]'), id);
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
          panel.closeCardMoreMenu();
          panel.openExportChecklistModal();
          return;
        }
        // Click cover/name area: switch to that draft and go to character view
        panel.closeCardMoreMenu();
        panel.loadDraft(id);
        s.goToView('character');
      });
    }

    // Hash change / view switch → refresh card manager covers
    window.addEventListener('hashchange', function () {
      if (s.getCurrentAppView() === 'card-manager') panel.updateCardManagerUI();
    });
    window.addEventListener('app-view-changed', function (ev) {
      var view = ev && ev.detail && ev.detail.view;
      if (view === 'card-manager') panel.updateCardManagerUI();
    });
    window.addEventListener('st-idb-ready', function () {
      if (s.getCurrentAppView() === 'card-manager') panel.updateCardManagerUI();
    });

    // 关页 / 切后台：冲掉双路径 debounce，避免丢最后一次编辑
    function flushPendingCardSaves() {
      try {
        clearTimeout(s.autoSaveTimer);
        if (ctx.sm && typeof ctx.sm.flushSave === 'function') {
          s.syncDomFieldsToState();
          ctx.sm.flushSave();
        } else {
          panel.flushUpdateAndSave();
        }
      } catch (eFlush) { /* ignore */ }
    }
    window.addEventListener('pagehide', flushPendingCardSaves);
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') flushPendingCardSaves();
    });

    // Assistant card API
    window.__assistantCardApi__ = {
      list: function () {
        var dr = s.getAllDrafts();
        var currentId = s.getCurrentDraftId();
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
        var dr = s.getAllDrafts();
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
        var src = id || s.getCurrentDraftId();
        if (!src) throw new Error('无可复制卡片');
        panel.duplicateDraft(src);
        return { id: ctx.state.draftId, name: ctx.state.charName || '副本' };
      },
      rename: function (id, name) {
        return panel.renameDraft(id || s.getCurrentDraftId(), name);
      },
      bumpVersion: function (which) {
        var id = s.getCurrentDraftId();
        if (!id) throw new Error('无当前卡');
        return panel.bumpDraftVersion(id, which === 'major' ? 'major' : 'minor');
      },
      switchVersion: function (targetVer) {
        var id = s.getCurrentDraftId();
        if (!id) throw new Error('无当前卡');
        return panel.switchDraftVersion(id, targetVer);
      },
      delete: async function (id) {
        return panel.deleteDraft(id || s.getCurrentDraftId(), { force: true });
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
    if (s.getCurrentAppView() === 'card-manager') panel.refreshExportChecklist();

    ctx.sm.on(function(result) {
      panel.updateCardManagerUI(result && result.drafts);
    });

    window.addEventListener('card-builder-data-changed', function() {
      if (s.getCurrentAppView() === 'card-manager') panel.updateCardManagerUI();
    });
  };
  return panel;
}
