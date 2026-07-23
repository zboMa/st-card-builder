/**
 * 卡片管理：Cloud（拆自 cardManager）
 */

import {
  CLOUD_STATUS,
  getCardCloudMeta,
  resolveCardCloudStatus,
} from '../../sync/cardCloudMeta.mjs';
import { computeDraftContentRev } from '../../sync/contentRev.mjs';
import { ensureCloudQuota, invalidateQuotaCache } from '../../sync/quotaClient.mjs';

/** @param {object} ctx @param {object} s @param {object} panel */
export function attachCardManagerCloud(ctx, s, panel) {
  /** 上云前把当前卡未落盘的 DOM / 防抖编辑写入 LS（bundle 读本地） */
  function flushLocalBeforeCloudUpload(id) {
    if (!id || id !== s.getCurrentDraftId()) return;
    s.syncDomFieldsToState();
    if (ctx.flushSave) ctx.flushSave();
    if (panel.saveCurrentDraft) panel.saveCurrentDraft();
  }

  function buildLocalConflictSummary(id) {
    var dr = s.getAllDrafts();
    var draft = dr[id];
    if (!draft) return null;
    return {
      charName: draft.charName || '',
      updatedAt: draft.updatedAt || '',
      contentRev: draft.contentRev || computeDraftContentRev(draft),
      wbCount: Array.isArray(draft.worldbookEntries) ? draft.worldbookEntries.length : 0,
      hasAvatar: !!(draft.avatarInIdb || draft.avatarBase64),
    };
  }

  async function fetchCloudConflictHint(id) {
    try {
      var apiMod = await import('../../sync/cloudApi.mjs');
      var local = buildLocalConflictSummary(id);
      var localMeta = getCardCloudMeta(id);
      if (!localMeta || !localMeta.onCloud) return { hint: '', hasConflict: false };
      var res = await apiMod.fetchCardConflict(id);
      var remote = res && res.remote;
      if (!remote) return { hint: '', hasConflict: false };
      var revDiff = remote.contentRev && local && local.contentRev
        && remote.contentRev !== local.contentRev;
      var timeDiff = remote.updatedAt && localMeta.cloudUpdatedAt
        && remote.updatedAt !== localMeta.cloudUpdatedAt;
      if (!revDiff && !timeDiff) return { hint: '', hasConflict: false, local: local, remote: remote };
      var lines = [
        '本地：' + (local.charName || '—') + ' · 世界书 ' + (local.wbCount || 0) + ' 条 · rev ' + (local.contentRev || '—'),
        '云端：' + (remote.charName || '—') + ' · 世界书 ' + (remote.wbCount || 0) + ' 条 · rev ' + (remote.contentRev || '—'),
      ];
      return {
        hint: lines.join('\n'),
        hasConflict: true,
        local: local,
        remote: remote,
      };
    } catch (e) {
      return { hint: '', hasConflict: false };
    }
  }

  function listDirtyCloudUploadIds() {
    var dr = s.getAllDrafts();
    return Object.keys(dr).filter(function(id) {
      if (!id || (dr[id] && dr[id]._cloudStub)) return false;
      var meta = getCardCloudMeta(id);
      var status = resolveCardCloudStatus(dr[id], meta);
      return status !== CLOUD_STATUS.CLOUD_SYNCED;
    });
  }

  panel.cloudUploadOverwrite = async function (id) {
    if (!id) return;
    try {
      var sync = await import('../../sync/index.mjs');
      if (sync.fetchSyncCredentials) await sync.fetchSyncCredentials();
    } catch (eCred) { /* ignore */ }
    var conflict = await fetchCloudConflictHint(id);
    var meta = getCardCloudMeta(id);
    var isNew = !(meta && meta.onCloud);
    var quotaCheck = await ensureCloudQuota('upload_bundle', { isNewCard: isNew });
    if (!quotaCheck.ok) {
      s.setCardManagerStatus(quotaCheck.message, true);
      return;
    }
    if (conflict.hasConflict) {
      var pick = await ctx.showConfirmDialog({
        icon: '⚠️',
        title: '云端版本不一致',
        message: '本机与云端内容可能不同，请选择操作。',
        detail: conflict.hint + '\n\n· 同步上云 = 用本机覆盖云端\n· 取消后可在 ⋯ 菜单选「从云端覆盖」',
        okText: '仍用本机覆盖上云',
        cancelText: '取消',
      });
      if (!pick) return;
    }
    var ok = await ctx.showConfirmDialog({
      icon: '☁️',
      title: '同步上云？',
      message: '将用本机这张卡（含工坊/头像等绑卡数据）覆盖云端版本。',
      detail: '写出的小说（Story）不随此操作上传。本地编辑不会自动上云，需在此确认。',
      okText: '同步上云',
      cancelText: '取消',
    });
    if (!ok) return;
    flushLocalBeforeCloudUpload(id);
    s.setCardManagerStatus('正在同步上云…');
    try {
      var sync2 = await import('../../sync/index.mjs');
      await sync2.cloudUploadOverwrite(id);
      invalidateQuotaCache();
      s.setCardManagerStatus('已同步上云');
      panel.updateCardManagerUI();
    } catch (e) {
      s.setCardManagerStatus('上传失败：' + (e && e.message || e), true);
    }
  };

  panel.cloudUploadAllDirty = async function () {
    var sync = await import('../../sync/index.mjs');
    if (!sync.isCloudEnabled || !sync.isCloudEnabled()) {
      s.setCardManagerStatus('请先在「账户与云端」登录', true);
      return;
    }
    try {
      if (sync.fetchSyncCredentials) await sync.fetchSyncCredentials();
    } catch (e) {
      s.setCardManagerStatus('登录状态无效，请重新登录', true);
      return;
    }
    var ids = listDirtyCloudUploadIds();
    if (!ids.length) {
      s.setCardManagerStatus('所有本地卡均已同步上云');
      return;
    }
    var batchQuota = await ensureCloudQuota('batch_upload', { count: ids.length });
    if (!batchQuota.ok) {
      s.setCardManagerStatus(batchQuota.message, true);
      return;
    }
    var ok = await ctx.showConfirmDialog({
      icon: '☁️',
      title: '批量同步上云？',
      message: '将依次用本机版本覆盖云端，共 ' + ids.length + ' 张未同步卡。',
      detail: '不含 Story；云端较新的版本仍会被本机覆盖，请确认后再继续。',
      okText: '全部同步上云',
      cancelText: '取消',
    });
    if (!ok) return;
    s.setCardManagerStatus('正在批量同步上云（0/' + ids.length + '）…');
    var done = 0;
    var failed = 0;
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      try {
        flushLocalBeforeCloudUpload(id);
        await sync.cloudUploadOverwrite(id);
        done++;
      } catch (e) {
        failed++;
        console.warn('[cloud] batch upload', id, e);
      }
      s.setCardManagerStatus('正在批量同步上云（' + done + '/' + ids.length + '）…');
    }
    panel.updateCardManagerUI();
    if (failed) {
      s.setCardManagerStatus('批量完成：成功 ' + done + '，失败 ' + failed, true);
    } else {
      s.setCardManagerStatus('已批量同步上云 ' + done + ' 张');
    }
  };

  panel.cloudDownloadOverwrite = async function (id) {
    if (!id) return;
    var ok = await ctx.showConfirmDialog({
      icon: '⬇️',
      title: '从云端覆盖？',
      message: '将用云端最新版本覆盖本机这张卡（含工坊/头像等）。本地未同步的修改会丢失。',
      okText: '从云端覆盖',
      cancelText: '取消',
    });
    if (!ok) return;
    s.setCardManagerStatus('正在从云端覆盖…');
    try {
      var syncDl = await import('../../sync/index.mjs');
      if (syncDl.fetchSyncCredentials) await syncDl.fetchSyncCredentials();
      await syncDl.cloudDownloadOverwrite(id);
      s.setCardManagerStatus('已从云端覆盖本地');
      panel.updateCardManagerUI();
      if (id === s.getCurrentDraftId()) panel.loadDraft(id);
    } catch (e) {
      s.setCardManagerStatus('拉取失败：' + (e && e.message || e), true);
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
    s.setCardManagerStatus('正在删除云端…');
    try {
      var syncDel = await import('../../sync/index.mjs');
      if (syncDel.fetchSyncCredentials) await syncDel.fetchSyncCredentials();
      await syncDel.cloudDeleteRemoteOnly(id, { deleteStories: false });
      s.setCardManagerStatus('云端已删除，本地仍保留');
      panel.updateCardManagerUI();
    } catch (e) {
      s.setCardManagerStatus('删除云端失败：' + (e && e.message || e), true);
    }
  };
  return panel;
}
