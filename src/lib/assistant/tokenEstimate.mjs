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
    '近似估算（非精确 tokenizer，字符数 × 2）· 点击查看上下文内容',
    '系统: ' + breakdown.system,
    '历史: ' + breakdown.history,
    '待发送: ' + breakdown.pending,
  ].join('\n');
}

/**
 * 组装弹窗分区（纯数据，不含 HTML）。
 * @param {{
 *   systemPrompt?: string,
 *   catalogOverview?: string,
 *   toolList?: string,
 *   characterFieldHint?: string,
 *   historyMessages?: { role?: string, content?: string }[],
 *   pendingInput?: string,
 *   ragBody?: string,
 * }} opts
 * @returns {{ id: string, title: string, tokens: number, body: string }[]}
 */
export function buildAssistantContextSections(opts) {
  opts = opts || {};
  var sections = [];
  function push(id, title, body) {
    var text = String(body == null ? '' : body);
    if (!text.trim()) return;
    sections.push({
      id: id,
      title: title,
      tokens: estimateTokens(text),
      body: text,
    });
  }

  var systemFull = String(opts.systemPrompt || '');
  push('system', '系统提示（送模合成）', systemFull);
  push('tools', '工具列表', opts.toolList || '');
  push('catalog', '目录概览', opts.catalogOverview || '');
  push('fields', '角色字段提示', opts.characterFieldHint || '');

  var hist = opts.historyMessages || [];
  if (hist.length) {
    var histBody = hist.map(function(m, i) {
      var role = (m && m.role) || 'msg';
      var content = String(m && m.content || '');
      return '[' + (i + 1) + '] ' + role + '\n' + content;
    }).join('\n\n——\n\n');
    push('history', '历史（最近 ' + hist.length + ' 条）', histBody);
  }

  push('pending', '待发送输入', opts.pendingInput || '');
  push('rag', '本回合 RAG 注入', opts.ragBody || '');
  return sections;
}
