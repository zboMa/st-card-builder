/**
 * 助手大改确认：自动应用只在第一次待确认时直接写入。
 * 请求没到达、确认卡重新弹出时停住，避免失败后自己反复提交。
 * @param {boolean} autoApply
 * @param {'first'|'reopen'} phase
 * @returns {'apply'|'ask'}
 */
export function assistantConfirmDisposition(autoApply, phase) {
  if (!autoApply) return 'ask';
  if (phase === 'reopen') return 'ask';
  return 'apply';
}
