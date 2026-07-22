/**
 * 卡片管理：Cloud（拆自 cardManager）
 */


/** @param {object} ctx @param {object} s @param {object} panel */
export function attachCardManagerCloud(ctx, s, panel) {
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
    s.setCardManagerStatus('正在上传覆盖云端…');
    try {
      var sync = await import('../../sync/index.mjs');
      if (sync.fetchSyncCredentials) await sync.fetchSyncCredentials();
      await sync.cloudUploadOverwrite(id);
      s.setCardManagerStatus('已上传覆盖云端');
      panel.updateCardManagerUI();
    } catch (e) {
      s.setCardManagerStatus('上传失败：' + (e && e.message || e), true);
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
    s.setCardManagerStatus('正在拉取覆盖本地…');
    try {
      var sync = await import('../../sync/index.mjs');
      if (sync.fetchSyncCredentials) await sync.fetchSyncCredentials();
      await sync.cloudDownloadOverwrite(id);
      s.setCardManagerStatus('已拉取覆盖本地');
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
