/**
 * 助手重试规划（纯函数，可单测）。
 * 重试不读输入框、不追加用户消息：
 * - 最后一条用户消息之后没有工具轨迹：去掉可重试错误，从 step 0 重跑
 * - 已有工具轨迹：保留轨迹与非错误气泡，去掉可重试错误，从工具结果续接
 */

/**
 * 失败红条是否可重试。
 * 新消息带 retryable；旧会话只有 error，正文可能是半角「错误:」或全角「错误：」。
 * 撤销失败 / 应用失败永远不可重试。
 * @param {object} msg
 * @returns {boolean}
 */
export function isRetryableAssistantError(msg) {
  if (!msg || msg.role !== 'assistant' || !msg.error) return false;
  var text = String(msg.displayContent != null ? msg.displayContent : (msg.content || '')).trim();
  if (/^撤销失败[:：]/.test(text) || /^应用失败[:：]/.test(text)) return false;
  if (msg.retryable) return true;
  if (/^错误[:：]/.test(text)) return true;
  if (/failed to fetch/i.test(text)) return true;
  return false;
}

/**
 * @param {object[]} uiMessages
 * @returns {null | {
 *   userIndex: number,
 *   userText: string,
 *   toolCount: number,
 *   mode: 'restart' | 'continue',
 *   startStep: number,
 *   nextMessages: object[],
 * }}
 */
/**
 * 确认后点「应用」的收场。
 * resume：应用成功，叫醒规划写下一步。
 * reopen：请求没到达，确认卡留着，不叫模型。
 * stop：工具返回业务失败，结束本轮，不叫模型。
 * @param {{ threw?: boolean, ok?: boolean }} outcome
 * @returns {'resume'|'reopen'|'stop'}
 */
export function planApplyOutcome(outcome) {
  var o = outcome || {};
  if (o.threw) return 'reopen';
  if (o.ok) return 'resume';
  return 'stop';
}

export function planAssistantRetry(uiMessages) {
  var list = Array.isArray(uiMessages) ? uiMessages : [];
  var userIndex = -1;
  for (var i = list.length - 1; i >= 0; i--) {
    if (list[i] && list[i].role === 'user') {
      userIndex = i;
      break;
    }
  }
  if (userIndex < 0) return null;
  var userText = String(list[userIndex].content || '').trim();
  if (!userText) return null;

  var floor = userIndex;
  for (var c = list.length - 1; c > userIndex; c--) {
    if (list[c] && list[c].compaction && list[c].ok) {
      floor = c;
      break;
    }
  }
  var toolCount = 0;
  var next = [];
  for (var j = 0; j < list.length; j++) {
    var m = list[j];
    if (j > floor && m && m.role === 'tool' && !m.running) toolCount += 1;
    if (j > userIndex && isRetryableAssistantError(m)) continue;
    next.push(m);
  }

  var continueTurn = toolCount > 0;
  return {
    userIndex: userIndex,
    userText: userText,
    toolCount: toolCount,
    mode: continueTurn ? 'continue' : 'restart',
    startStep: continueTurn ? Math.max(1, toolCount) : 0,
    nextMessages: next,
  };
}
