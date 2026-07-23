/**
 * 卡片管理：Crud（拆自 cardManager）
 */

import { genId, DRAFTS_KEY, buildCardJSONFromDraft, normalizeTags, draftDisplayName } from '../state.mjs';
import { deepCopy } from '../../utils.mjs';
import { engineAssert, engineTryAllowed, engineRefresh } from '../../actionEngine/helpers.mjs';

/** @param {object} ctx @param {object} s @param {object} panel */
export function attachCardManagerCrud(ctx, s, panel) {
  // ---- Avatar migration ----
  async function migrateDraftAvatarToIdb(id, d, dr) {
    if (!d || !d.avatarBase64 || d.avatarInIdb) return false;
    await s.ensureIdbReady();
    if (!window.__avatarIdb__) return false;
    var ok = await window.__avatarIdb__.migrateAvatarBase64ToIdb(id, d.avatarBase64);
    if (!ok) return false;
    d.avatarInIdb = true;
    d.avatarBase64 = '';
    dr[id] = d;
    try { ctx.sm.patchDraftRecord(id, { avatarInIdb: true, avatarBase64: '' }, { notify: false }); } catch (e) {
      try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(dr)); } catch (e2) { console.warn('Saving drafts to localStorage failed', e2); }
    }
    return true;
  }

  // ---- Events bridge (called by other panels / state machine) ----
  panel.emitCardDraftChanged = function (cardId) {
    var currentId = s.getCurrentDraftId();
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
    s.syncDomFieldsToState();
    var result = ctx.sm.saveDraft(opts);
    var saveIndicator = ctx.$('saveIndicator');
    if (result.saved && saveIndicator) {
      saveIndicator.style.display = 'inline';
      setTimeout(function () { saveIndicator.style.display = 'none'; }, 1500);
    }
    if (result.saved && !result.unchanged) {
      window.dispatchEvent(new CustomEvent('card-local-saved', {
        detail: { cardId: ctx.state.draftId, needsCloudSync: true },
      }));
    }
    panel.updateCardManagerUI(result.drafts);
    return result.saved;
  };

  panel.debouncedUpdateAndSave = function () {
    clearTimeout(s.autoSaveTimer);
    s.autoSaveTimer = setTimeout(function () {
      s.syncDomFieldsToState();
      if (window.updatePreviewPanel) {
        var fj = buildCardJSONFromDraft(ctx.state);
        window.updatePreviewPanel(fj);
      }
      panel.saveCurrentDraft();
    }, 500);
  };

  panel.flushUpdateAndSave = function () {
    clearTimeout(s.autoSaveTimer);
    s.syncDomFieldsToState();
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
    var gate = engineTryAllowed('lifecycle.card.switch');
    if (!gate.ok) return;
    var dr = s.getAllDrafts();
    if (!dr[id]) return;

    // 云端占位卡或缺正文：拉取完整卡包（卡+头像+小说+创作）再打开
    if (dr[id]._cloudStub || !dr[id].charDesc) {
      try {
        var sync = await import('../../sync/index.mjs');
        var full = await sync.ensureCardBundleLocal(id, { force: true });
        if (!full) full = await sync.ensureCardLocal(id);
        if (full) {
          dr = s.getAllDrafts();
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
      await s.ensureIdbReady();
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
    if (!engineTryAllowed('lifecycle.card.create').ok) return;
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

    if (jump) s.goToView('character');
  };

  // ---- Delete ----
  panel.deleteDraft = async function (id, opts) {
    if (!engineTryAllowed('lifecycle.card.delete').ok) {
      return { ok: false, error: '任务进行中，禁止删卡' };
    }
    if (!id) return { ok: false, error: '缺少 id' };
    var dr = s.getAllDrafts();
    if (!dr[id]) return { ok: false, error: '卡不存在' };
    var currentId = s.getCurrentDraftId();
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
    s.ensureIdbReady().then(function () {
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
      return mod.cascadeDeleteCardDocs(id, s.getAllDrafts(), { deleteStories: deleteStories });
    }).catch(function(e) { console.warn('[cloud] cascade delete', e); });

    // Navigate: if deleted was current, load next or create blank
    if (id === currentId) {
      var drAfter = s.getAllDrafts();
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
    if (!engineTryAllowed('lifecycle.card.duplicate').ok) return;
    var dr = s.getAllDrafts();
    var src = dr[id];
    if (!src) return;
    var newId = genId();
    var copy = deepCopy(src);
    copy.charName = draftDisplayName(src) + ' 副本';
    copy.updatedAt = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    copy.avatarInIdb = !!(src.avatarInIdb || src.avatarBase64);
    if (copy.avatarInIdb) copy.avatarBase64 = '';
    dr[newId] = copy;
    ctx.sm.writeDraftsMap(dr, { notify: false });

    await s.ensureIdbReady();
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
    s.goToView('character');
  };

  // ---- Rename ----
  panel.renameDraft = async function (id, newName) {
    var dr = s.getAllDrafts();
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
    var renamed = ctx.sm.renameDraft(id, next);
    if (!renamed.ok) return renamed;
    var currentId = s.getCurrentDraftId();
    if (id === currentId) {
      var el = ctx.$('charName');
      if (el) el.value = next;
    }
    panel.updateCardManagerUI();
    if (id === currentId && window.updatePreviewPanel) {
      var fj = buildCardJSONFromDraft(ctx.state);
      window.updatePreviewPanel(fj);
    }
    return renamed;
  };
  return panel;
}
