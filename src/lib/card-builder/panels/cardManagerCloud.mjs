/**
 * 卡片管理：Cloud（拆自 cardManager）
 */


/** @param {object} ctx @param {object} s @param {object} panel */
export function attachCardManagerCloud(ctx, s, panel) {
  async function fetchCloudConflictHint(id) {
    try {
      var metaMod = await import('../../sync/cardCloudMeta.mjs');
      var apiMod = await import('../../sync/cloudApi.mjs');
      var localMeta = metaMod.getCardCloudMeta(id);
      if (!localMeta || !localMeta.onCloud || !localMeta.cloudUpdatedAt) return '';
      var res = await apiMod.fetchCloudCards();
      var cards = (res && res.cards) || [];
      var row = null;
      for (var i = 0; i < cards.length; i++) {
        if (cards[i] && cards[i].id === id) { row = cards[i]; break; }
      }
      if (!row || !row.updatedAt || row.updatedAt === localMeta.cloudUpdatedAt) return '';
      return '云端该卡已有较新版本（更新于 ' + row.updatedAt + '）。继续将用本机覆盖云端。';
    } catch (e) {
      return '';
    }
  }

  panel.cloudUploadOverwrite = async function (id) {
    if (!id) return;
    try {
      var sync = await import('../../sync/index.mjs');
      if (sync.fetchSyncCredentials) await sync.fetchSyncCredentials();
    } catch (eCred) { /* confirm 内仍可能失败 */ }
    var conflictHint = await fetchCloudConflictHint(id);
    var ok = await ctx.showConfirmDialog({
      icon: '☁️',
      title: '同步上云？',
      message: '将用本机这张卡（含工坊/头像等绑卡数据）覆盖云端版本。',
      detail: '写出的小说（Story）不随此操作上传。本地编辑不会自动上云，需在此确认。'
        + (conflictHint ? '\n\n' + conflictHint : ''),
      okText: '同步上云',
      cancelText: '取消',
    });
    if (!ok) return;
    s.setCardManagerStatus('正在同步上云…');
    try {
      var sync2 = await import('../../sync/index.mjs');
      await sync2.cloudUploadOverwrite(id);
      s.setCardManagerStatus('已同步上云');
      panel.updateCardManagerUI();
    } catch (e) {
      s.setCardManagerStatus('上传失败：' + (e && e.message || e), true);
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
      var sync = await import('../../sync/index.mjs');
      if (sync.fetchSyncCredentials) await sync.fetchSyncCredentials();
      await sync.cloudDownloadOverwrite(id);
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
      var sync = await import('../../sync/index.mjs');
      if (sync.fetchSyncCredentials) await sync.fetchSyncCredentials();
      await sync.cloudDeleteRemoteOnly(id, { deleteStories: false });
      s.setCardManagerStatus('云端已删除，本地仍保留');
      panel.updateCardManagerUI();
    } catch (e) {
      s.setCardManagerStatus('删除云端失败：' + (e && e.message || e), true);
    }
  };
  return panel;
}
