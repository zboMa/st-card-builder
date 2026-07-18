/**
 * 近似 token 估算（非精确 tokenizer）。
 * 启发式：字符数 × 2。
 */

export function estimateTokens(text) {
  if (text == null || text === '') return 0;
  return Math.round(String(text).length * 2);
}

/** @param {{ role?: string, content?: string }[]} messages */
export function estimateMessagesTokens(messages) {
  if (!messages || !messages.length) return 0;
  return messages.reduce(function(sum, m) {
    return sum + estimateTokens(m && m.content);
  }, 0);
}

/**
 * @param {{ systemPrompt?: string, historyMessages?: { content?: string }[], pendingInput?: string }} opts
 */
export function estimateAssistantContext(opts) {
  opts = opts || {};
  var system = estimateTokens(opts.systemPrompt || '');
  var history = estimateMessagesTokens(opts.historyMessages || []);
  var pending = estimateTokens(opts.pendingInput || '');
  return {
    system: system,
    history: history,
    pending: pending,
    total: system + history + pending,
  };
}

/** 显示用：8420 → "8420"，12500 → "12.5k" */
export function formatTokenCount(n) {
  var num = Number(n) || 0;
  if (num >= 10000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return String(num);
}

/** @param {number} total */
export function formatAssistantContextLabel(total) {
  var n = Number(total) || 0;
  if (n >= 1000) return '上下文 ≈ ' + formatTokenCount(n) + ' tokens';
  return '上下文 ' + n + ' tokens';
}

/** @param {{ system: number, history: number, pending: number }} breakdown */
export function formatAssistantContextTitle(breakdown) {
  return [
    '近似估算（非精确 tokenizer，字符数 × 2）',
    '系统: ' + breakdown.system,
    '历史: ' + breakdown.history,
    '待发送: ' + breakdown.pending,
  ].join('\n');
}
