/**
 * 发布/导出门禁（复用 exportChecklist）
 */
import { buildExportChecklist } from './exportChecklist.mjs';
import {
  CLOUD_STATUS,
  getCardCloudMeta,
  resolveCardCloudStatus,
} from '../sync/cardCloudMeta.mjs';

/**
 * @param {object} input checklist 输入
 * @param {'export'|'publish'|'cloud'} mode
 */
export function buildPublishGate(input, mode) {
  mode = mode || 'publish';
  var base = buildExportChecklist(input);
  var items = base.items.slice();

  if (input.cloudDirty && mode !== 'export') {
    items.push({
      id: 'cloud_dirty',
      level: mode === 'publish' ? 'warning' : 'warning',
      message: '尚未同步上云，其他设备看不到最新工作稿',
      view: 'card-manager',
    });
  }

  if (input.shareQuotaBlocked) {
    items.push({
      id: 'quota_shares',
      level: 'critical',
      message: input.shareQuotaMessage || '活跃分享已达账户上限',
      view: 'account-sync',
    });
  }

  var critical = items.filter(function(x) { return x.level === 'critical'; }).length;
  var warning = items.filter(function(x) { return x.level === 'warning'; }).length;
  var canProceed = mode === 'export'
    ? base.canExportJson && critical === 0
    : critical === 0;

  return {
    mode: mode,
    ok: canProceed && (mode === 'publish' ? critical === 0 : base.ok),
    canProceed: canProceed,
    canPublish: critical === 0,
    canExportJson: base.canExportJson && critical === 0,
    canExportPng: base.canExportPng && critical === 0,
    critical: critical,
    warning: warning,
    items: items,
    summary: critical
      ? ('有 ' + critical + ' 项必须处理后才能' + (mode === 'publish' ? '发布' : '继续'))
      : (warning ? ('可继续，另有 ' + warning + ' 条提醒') : '检查通过'),
  };
}

export function isCardCloudDirty(draft, cardId) {
  if (!draft || !cardId) return false;
  var meta = getCardCloudMeta(cardId);
  return resolveCardCloudStatus(draft, meta) !== CLOUD_STATUS.CLOUD_SYNCED;
}

/**
 * @param {object} ctx showConfirmDialog
 * @param {object} gate buildPublishGate 结果
 */
export async function confirmPublishGate(ctx, gate) {
  if (!gate) return true;
  if (gate.critical > 0) {
    await ctx.showConfirmDialog({
      icon: '⛔',
      title: '无法发布',
      message: gate.summary,
      detail: gate.items.filter(function(x) { return x.level === 'critical'; })
        .map(function(x) { return '· ' + x.message; }).join('\n'),
      okText: '知道了',
      cancelText: '关闭',
    });
    return false;
  }
  if (gate.warning > 0) {
    return ctx.showConfirmDialog({
      icon: '⚠️',
      title: '发布提醒',
      message: gate.summary,
      detail: gate.items.filter(function(x) { return x.level === 'warning'; })
        .map(function(x) { return '· ' + x.message; }).join('\n'),
      okText: '仍要发布',
      cancelText: '返回修改',
    });
  }
  return true;
}
