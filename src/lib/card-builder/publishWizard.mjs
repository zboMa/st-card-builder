/**
 * 发布向导：门禁 → 确认 → 执行回调
 */
import { confirmPublishGate } from './publishGate.mjs';

/**
 * @param {object} ctx
 * @param {object} opts
 * @param {object} opts.gate publishGate 结果
 * @param {string} opts.title
 * @param {function(): Promise<void>} opts.run
 * @param {function(): string} [opts.successCopyLink]
 */
export async function runPublishWizard(ctx, opts) {
  opts = opts || {};
  var gate = opts.gate;
  if (gate && !gate.canProceed) {
    var okWarn = await confirmPublishGate(ctx, gate);
    if (!okWarn) return { ok: false, reason: 'gate' };
  }
  if (gate && gate.critical > 0) {
    await confirmPublishGate(ctx, gate);
    return { ok: false, reason: 'critical' };
  }
  var confirm = await ctx.showConfirmDialog({
    icon: opts.icon || '🚀',
    title: opts.title || '确认发布？',
    message: opts.message || '将写入已发布版本快照。',
    detail: opts.detail || '',
    okText: opts.okText || '发布',
    cancelText: '取消',
  });
  if (!confirm) return { ok: false, reason: 'cancel' };
  await opts.run();
  if (typeof opts.successCopyLink === 'function') {
    var link = opts.successCopyLink();
    if (link && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(link);
      } catch (e) { /* ignore */ }
    }
  }
  return { ok: true };
}
