/**
 * 助手工具执行器：依赖 bridge 读写卡片状态，纯逻辑可单测
 */
export { normalizeTarget, resolveWorldbookIndex } from './executorResolve.mjs';
import { classifyToolRisk } from './risk.mjs';
import { normalizeTarget, resolveWorldbookIndex } from './executorResolve.mjs';
import { createExecutorHelpers } from './executorHelpers.mjs';
import { createExecutorExecute } from './executorExecute.mjs';

export function createToolExecutor(bridge, snapApi) {
  var snaps = snapApi || {};
  var helpers = createExecutorHelpers(bridge, snaps);
  return createExecutorExecute(bridge, snaps, helpers);
}
