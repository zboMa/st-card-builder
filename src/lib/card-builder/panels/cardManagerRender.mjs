/**
 * 角色卡管理：视图模型 + 面板方法（Vue 渲染，不再直接操作列表 DOM）
 */

import { buildDraftSnapshot } from '../state.mjs';
import { buildExportChecklist } from '../exportChecklist.mjs';
import { engineTryAllowed, engineRefresh } from '../../actionEngine/helpers.mjs';
import {
  listCardVersions,
  ensureCardVersions,
  bumpCardDraftVersion,
  switchCardDraftVersion,
} from '../cardVersions.mjs';
import { normalizeCharacterVersion } from '../cardRelease.mjs';
import { setCardList } from '../../store/cardListStore.mjs';
import { buildCardListSnapshot } from './cardManagerViewModel.mjs';

/** @param {object} ctx @param {object} s @param {object} panel */
export function attachCardManagerRender(ctx, s, panel) {
  function isCloudLoggedIn() {
    try {
      return !!(window.__syncCloudEnabled__
        || (window.__getCloudEnabled__ && window.__getCloudEnabled()));
    } catch (e) {
      return false;
    }
  }

  function computeExportCheck() {
    return (window.__getExportChecklist__ || (window.__assistantCardApi__ && window.__assistantCardApi__.exportCheck))
      ? (window.__getExportChecklist__ || window.__assistantCardApi__.exportCheck)()
      : buildExportChecklist({
        charName: ctx.state.charName,
        charDesc: ctx.state.charDesc,
        firstMes: ctx.state.firstMes || (ctx.$('firstMes') || {}).value || '',
        hasAvatar: !!(String(ctx.state.activeAvatarId || '').trim() || ctx.state.avatarBase64 || ctx.state.avatarInIdb),
        worldbookCount: (ctx.state.worldbookEntries || []).length,
        worldbookNoKeys: (ctx.state.worldbookEntries || []).filter(function (e) {
          return e && e.enabled !== false && (!e.keys || !e.keys.length);
        }).length,
        altGreetingCount: Array.isArray(window.__altGreetings__) ? window.__altGreetings__.length : 0,
      });
  }

  function summarizeCheck(check) {
    var items = check.items || [];
    var critical = items.filter(function (it) { return it.level === 'critical'; }).length;
    var warning = items.filter(function (it) { return it.level === 'warning'; }).length;
    var text;
    if (!items.length) {
      text = check.ok
        ? ('通过 · 可导出 JSON' + (check.canExportPng ? ' / PNG' : ''))
        : (check.summary || '存在问题');
    } else {
      text = '严重 ' + critical + ' · 警告 ' + warning;
      if (check.summary) text += ' · ' + check.summary;
    }
    return {
      items: items,
      critical: critical,
      warning: warning,
      ok: !!check.ok,
      summary: check.summary || '',
      summaryText: text,
      canExportPng: !!check.canExportPng,
    };
  }

  panel.refreshExportChecklist = function () {
    var summarized = summarizeCheck(computeExportCheck());
    s.lastExportCheck = summarized;
    setCardList({ exportCheck: summarized });
    return summarized;
  };

  // ---- Core render：只产出快照，DOM 由 Vue 负责 ----
  panel.render = function (storedDrafts) {
    var dr = s.getDraftsForDisplay(storedDrafts);
    var snapshot = buildCardListSnapshot({
      drafts: dr,
      currentId: s.getCurrentDraftId(),
      state: ctx.state,
      query: s.cardManagerSearchQuery,
      selectedTags: s.selectedFilterTags,
      lastExportCheck: s.lastExportCheck,
    });
    snapshot.cloudLoggedIn = isCloudLoggedIn();
    snapshot.selectedTags = Array.from(s.selectedFilterTags);
    setCardList(snapshot);
  };

  // ---- Debounced update ----
  panel.updateCardManagerUI = function (storedDrafts) {
    s.cardManagerUiPendingDrafts = storedDrafts;
    if (s.cardManagerUiTimer) clearTimeout(s.cardManagerUiTimer);
    s.cardManagerUiTimer = setTimeout(function () {
      s.cardManagerUiTimer = null;
      var pending = s.cardManagerUiPendingDrafts;
      s.cardManagerUiPendingDrafts = undefined;
      if (s.getCurrentAppView() === 'card-manager') panel.refreshExportChecklist();
      panel.render(pending);
      engineRefresh();
    }, s.CARD_MANAGER_UI_DEBOUNCE_MS);
  };

  panel.openExportChecklistModal = function () {
    panel.refreshExportChecklist();
    setCardList({ exportModalOpen: true });
  };

  panel.closeExportChecklistModal = function () {
    setCardList({ exportModalOpen: false });
  };

  // 菜单/弹层已迁到 Vue，这里保留兼容空实现（bind / 其他模块仍会调用）
  panel.closeCardMoreMenu = function () {};
  panel.openCardMoreMenu = function () {};
  panel.closeCardVersionMenu = function () {};
  panel.openCardVersionMenu = function () {};

  // ---- Version list for Vue menu ----
  panel.getCardVersions = function (id) {
    var all = s.getAllDrafts();
    var currentId = s.getCurrentDraftId();
    var d = id === currentId
      ? Object.assign({}, buildDraftSnapshot(ctx.state), {
        draftId: id,
        versions: ctx.state.versions || (all[id] && all[id].versions) || [],
      })
      : (all[id] || {});
    ensureCardVersions(d);
    var list = listCardVersions(d);
    var draftVer = normalizeCharacterVersion(d.characterVersion);
    var hasDraftVer = list.some(function (v) {
      return normalizeCharacterVersion(v.ver) === draftVer;
    });
    return { list: list, draftVer: draftVer, hasDraftVer: hasDraftVer };
  };

  panel.bumpDraftVersion = async function (id, which) {
    if (!id) return;
    if (!engineTryAllowed('lifecycle.card.version.bump').ok) return;
    var currentId = s.getCurrentDraftId();
    if (id === currentId) panel.saveCurrentDraft();
    var all = s.getAllDrafts();
    var d = id === currentId
      ? Object.assign({}, buildDraftSnapshot(ctx.state), { draftId: id, versions: ctx.state.versions || [] })
      : all[id];
    if (!d) return;
    ensureCardVersions(d);
    bumpCardDraftVersion(d, which === 'major' ? 'major' : 'minor');
    all[id] = d;
    ctx.sm.writeDraftsMap(all);
    try {
      var { persistDraftVersions } = await import('../cardVersions.mjs');
      await persistDraftVersions(id, d);
    } catch (eVer) { console.warn('[versions] persist', eVer); }
    if (id === currentId) {
      ctx.state.characterVersion = d.characterVersion;
      ctx.state.versions = d.versions;
      Object.keys(d).forEach(function (k) {
        if (k === 'versions' || k === 'draftId') return;
        if (k in ctx.state) ctx.state[k] = d[k];
      });
      var verEl = ctx.$('characterVersion');
      if (verEl) verEl.value = d.characterVersion;
    }
    s.setCardManagerStatus('已增版至 v' + d.characterVersion + '（上一版已写入列表）');
    panel.updateCardManagerUI();
    if (id === currentId) panel.loadDraft(id);
  };

  panel.switchDraftVersion = async function (id, targetVer) {
    if (!id || !targetVer) return;
    if (!engineTryAllowed('lifecycle.card.version.switch').ok) return;
    var currentId = s.getCurrentDraftId();
    if (id === currentId) panel.saveCurrentDraft();
    var all = s.getAllDrafts();
    var d = id === currentId
      ? Object.assign({}, buildDraftSnapshot(ctx.state), { draftId: id, versions: ctx.state.versions || [] })
      : all[id];
    if (!d) return;
    ensureCardVersions(d);
    var sw = switchCardDraftVersion(d, targetVer);
    if (!sw.ok) {
      s.setCardManagerStatus('无法切换：' + (sw.error || '未知错误'), true);
      return;
    }
    all[id] = d;
    ctx.sm.writeDraftsMap(all);
    try {
      var { persistDraftVersions } = await import('../cardVersions.mjs');
      await persistDraftVersions(id, d);
    } catch (eVer) { console.warn('[versions] persist', eVer); }
    if (id === currentId) {
      panel.loadDraft(id);
    }
    s.setCardManagerStatus('已切换到 v' + targetVer);
    panel.updateCardManagerUI();
  };

  return panel;
}
