/**
 * 角色卡管理：Vue 岛 ↔ 既有业务逻辑的桥。
 * Vue 组件通过 cardManagerApi 调用，不再直接接触 ctx / panel / window.__*__。
 */
import { engineTryAllowed } from '../../actionEngine/helpers.mjs';
import { parseCardFile } from '../cardImportParsers.mjs';
import { setCardList } from '../../store/cardListStore.mjs';

var impl = null;

export function registerCardManagerApi(next) {
  impl = next || null;
}

/**
 * 对外门面：即使 impl 未就绪也可安全调用（no-op / 空数据）。
 * 组件用这个对象，避免到处判空。
 */
export const cardManagerApi = {
  onMount: function () { if (impl) impl.onMount(); },
  openCard: function (id) { if (impl) impl.openCard(id); },
  rename: function (id) { if (impl) impl.rename(id); },
  duplicate: function (id) { if (impl) impl.duplicate(id); },
  remove: function (id) { if (impl) impl.remove(id); },
  createBlank: function () { if (impl) impl.createBlank(); },
  cloudUploadAll: function () { if (impl) impl.cloudUploadAll(); },
  cloudUpload: function (id) { if (impl) impl.cloudUpload(id); },
  cloudDownload: function (id) { if (impl) impl.cloudDownload(id); },
  cloudDelete: function (id) { if (impl) impl.cloudDelete(id); },
  exportJson: function (id) { if (impl) impl.exportJson(id); },
  exportPng: function (id) { if (impl) impl.exportPng(id); },
  openExportCheck: function () { if (impl) impl.openExportCheck(); },
  refreshExportChecklist: function () { if (impl) impl.refreshExportChecklist(); },
  closeExportChecklist: function () { if (impl) impl.closeExportChecklist(); },
  goView: function (view) { if (impl) impl.goView(view); },
  publish: function (id) { if (impl) impl.publish(id); },
  share: function (id, opts) { if (impl) impl.share(id, opts); },
  copyShare: function (id) { if (impl) impl.copyShare(id); },
  unshare: function (id) { if (impl) impl.unshare(id); },
  getVersions: function (id) {
    return impl ? impl.getVersions(id) : { list: [], draftVer: '', hasDraftVer: false };
  },
  switchVersion: function (id, ver) { if (impl) return impl.switchVersion(id, ver); },
  bumpVersion: function (id, which) { if (impl) return impl.bumpVersion(id, which); },
  setQuery: function (q) { if (impl) impl.setQuery(q); },
  toggleTag: function (tag) { if (impl) impl.toggleTag(tag); },
  clearTags: function () { if (impl) impl.clearTags(); },
  loadThumb: function (id, avatarId) {
    return impl ? impl.loadThumb(id, avatarId) : Promise.resolve('');
  },
  importFile: function (file) { if (impl) return impl.importFile(file); },
  cardMoreAction: function (action, id) { if (impl) impl.cardMoreAction(action, id); },
};

/**
 * 注册实际实现（由 cardManagerBind 在 bind 时调用）。
 * @param {object} ctx
 * @param {object} s
 * @param {object} panel
 */
export function installCardManagerBridge(ctx, s, panel) {
  function cardMoreAction(action, id) {
    if (!action || !id) return;
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

  registerCardManagerApi({
    onMount: function () {
      panel.updateCardManagerUI();
    },
    openCard: function (id) {
      if (!id) return;
      panel.loadDraft(id);
      s.goToView('character');
    },
    rename: function (id) { panel.renameDraft(id); },
    duplicate: function (id) { panel.duplicateDraft(id); },
    remove: function (id) { panel.deleteDraft(id); },
    createBlank: function () { panel.createBlankDraft({ jumpToCharacter: true }); },
    cloudUploadAll: function () { if (panel.cloudUploadAllDirty) panel.cloudUploadAllDirty(); },
    cloudUpload: function (id) { panel.cloudUploadOverwrite(id); },
    cloudDownload: function (id) { panel.cloudDownloadOverwrite(id); },
    cloudDelete: function (id) { panel.cloudDeleteRemote(id); },
    exportJson: function (id) { panel.exportDraftAsJson(id); },
    exportPng: function (id) { panel.exportDraftAsPng(id); },
    openExportCheck: function () { panel.openExportChecklistModal(); },
    refreshExportChecklist: function () {
      panel.refreshExportChecklist();
      panel.updateCardManagerUI();
    },
    closeExportChecklist: function () { panel.closeExportChecklistModal(); },
    goView: function (view) { s.goToView(view); },
    publish: function (id) { panel.publishDraft(id); },
    share: function (id, opts) { panel.shareDraft(id, opts); },
    copyShare: function (id) { panel.copyShareLink(id); },
    unshare: function (id) { panel.unshareDraft(id); },
    getVersions: function (id) { return panel.getCardVersions(id); },
    switchVersion: function (id, ver) { return panel.switchDraftVersion(id, ver); },
    bumpVersion: function (id, which) { return panel.bumpDraftVersion(id, which); },
    setQuery: function (q) {
      s.cardManagerSearchQuery = String(q || '');
      setCardList({ query: s.cardManagerSearchQuery });
      panel.updateCardManagerUI();
    },
    toggleTag: function (tag) { s.toggleFilterTag(tag); },
    clearTags: function () {
      s.selectedFilterTags.clear();
      setCardList({ selectedTags: [] });
      panel.updateCardManagerUI();
    },
    loadThumb: function (id, avatarId) {
      return s.ensureIdbReady().then(function () {
        if (!window.__avatarIdb__) return '';
        return window.__avatarIdb__.loadAvatarThumbObjectUrl(id, avatarId);
      });
    },
    importFile: async function (file) {
      if (!file) return;
      if (!engineTryAllowed('lifecycle.card.import').ok) return;
      try {
        s.setCardManagerStatus('正在导入：' + file.name);
        var parsed = await parseCardFile(file);
        if (parsed.avatarBase64 && window.__setImportedAvatar__) {
          window.__setImportedAvatar__(parsed.avatarBase64);
        }
        if (typeof window.applyJSONFromEditor !== 'function') {
          s.setCardManagerStatus('导入桥接未就绪', true);
          return;
        }
        window.applyJSONFromEditor(parsed.cardJson, { asNew: true });
        if (window.updatePreviewPanel) window.updatePreviewPanel(parsed.cardJson);
        panel.saveCurrentDraft();
        panel.updateCardManagerUI();
        var name = (parsed.cardJson.data && parsed.cardJson.data.name)
          || parsed.cardJson.name || '未知角色';
        s.setCardManagerStatus('已导入「' + name + '」← ' + file.name + '（记得检查各字段后再导出）');
      } catch (err) {
        s.setCardManagerStatus('导入失败：' + (err && err.message || err), true);
      }
    },
    cardMoreAction: cardMoreAction,
  });
}
