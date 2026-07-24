/**
 * 助手上下文管理（独立模块）
 * - 预算：200k tokens（tiktoken cl100k_base，经 js-tiktoken）
 * - ≥60%：启动压缩；≥80%：激进压缩
 * - 发送时整体压缩，禁止单条工具结果盲切固定字符数
 */
import { getEncoding } from 'js-tiktoken';
import { messageContentForModel } from './ragInject.mjs';

/** @type {{ limit: number, softRatio: number, hardRatio: number, messageOverhead: number, reserveReply: number }} */
export var CONTEXT_BUDGET = {
  /** 模型上下文总窗口 */
  limit: 200000,
  /** 超过该比例启动压缩 */
  softRatio: 0.6,
  /** 超过该比例激进压缩 */
  hardRatio: 0.8,
  /** 每条 Chat 消息额外开销（role / 分隔） */
  messageOverhead: 4,
  /** 预留给模型输出 */
  reserveReply: 8192,
};

var _enc = null;

function encoder() {
  if (!_enc) _enc = getEncoding('cl100k_base');
  return _enc;
}

/** @param {string|null|undefined} text */
export function countTokens(text) {
  if (text == null || text === '') return 0;
  try {
    return encoder().encode(String(text)).length;
  } catch (e) {
    // 极端失败回退：偏保守
    return Math.ceil(String(text).length / 2);
  }
}

/** @param {{ role?: string, content?: string }[]} messages */
export function countMessagesTokens(messages) {
  if (!messages || !messages.length) return 0;
  var overhead = CONTEXT_BUDGET.messageOverhead || 0;
  return messages.reduce(function(sum, m) {
    return sum + countTokens(m && m.content) + overhead;
  }, 0);
}

/** 可用于输入的 token 上限（总窗口 − 预留回复） */
export function inputTokenBudget() {
  return Math.max(1024, (CONTEXT_BUDGET.limit || 200000) - (CONTEXT_BUDGET.reserveReply || 0));
}

export function softThreshold() {
  return Math.floor(inputTokenBudget() * (CONTEXT_BUDGET.softRatio || 0.6));
}

export function hardThreshold() {
  return Math.floor(inputTokenBudget() * (CONTEXT_BUDGET.hardRatio || 0.8));
}

/**
 * @param {number} total
 * @returns {'none'|'soft'|'hard'}
 */
export function compressionLevelForTotal(total) {
  var n = Number(total) || 0;
  if (n >= hardThreshold()) return 'hard';
  if (n >= softThreshold()) return 'soft';
  return 'none';
}

/**
 * UI 消息 → 送模历史（不截断工具正文）
 * @param {object[]} uiMessages
 * @returns {{ role: string, content: string, meta?: object }[]}
 */
export function uiMessagesToModelHistory(uiMessages) {
  var out = [];
  (uiMessages || []).forEach(function(m) {
    if (!m) return;
    if (m.role === 'user') {
      out.push({
        role: 'user',
        content: messageContentForModel(m),
        meta: { kind: 'user', hasRag: !!(m.ragPreview && m.ragPreview.ragBody) },
      });
      return;
    }
    if (m.role === 'assistant') {
      out.push({
        role: 'assistant',
        content: String(m.content || ''),
        meta: { kind: /^💭/.test(String(m.content || '')) ? 'thought' : 'assistant' },
      });
      return;
    }
    if (m.role === 'tool') {
      var toolLine = m.summary || String(m.toolName || 'tool');
      var toolBody = m.modelDetail || m.detail || m.content || '';
      out.push({
        role: 'user',
        content: '[工具结果·成功]\n' + toolLine + '\n' + toolBody,
        meta: {
          kind: 'tool',
          toolName: m.toolName || '',
          summary: toolLine,
          fullBody: toolBody,
          error: !!m.error,
        },
      });
    }
  });
  return out;
}

function stripToModelMessages(history) {
  return (history || []).map(function(m) {
    return { role: m.role, content: m.content };
  });
}

/**
 * soft：压缩旧工具正文 / 丢掉较早 thought，保留近期完整结果
 * @param {{ role: string, content: string, meta?: object }[]} history
 * @param {number} keepRecentTools 近期工具条保留全文的数量
 */
function compressSoft(history, keepRecentTools) {
  var keep = keepRecentTools == null ? 4 : keepRecentTools;
  var toolIdx = [];
  history.forEach(function(m, i) {
    if (m.meta && m.meta.kind === 'tool') toolIdx.push(i);
  });
  var keepSet = Object.create(null);
  toolIdx.slice(-keep).forEach(function(i) { keepSet[i] = 1; });

  var thoughtBudget = 3;
  var thoughtFromEnd = 0;
  var out = [];
  for (var i = history.length - 1; i >= 0; i--) {
    var m = history[i];
    var meta = m.meta || {};
    if (meta.kind === 'thought') {
      thoughtFromEnd += 1;
      if (thoughtFromEnd > thoughtBudget) continue;
      out.push(m);
      continue;
    }
    if (meta.kind === 'tool' && !keepSet[i]) {
      var summary = meta.summary || '工具结果';
      var body = String(meta.fullBody || m.content || '');
      // 按 token 预算截断旧工具正文，而非固定字符
      var preview = truncateToTokens(body, 180);
      out.push({
        role: 'user',
        content: '[工具结果·压缩]\n' + summary + '\n' + preview,
        meta: Object.assign({}, meta, { compressed: 'soft' }),
      });
      continue;
    }
    out.push(m);
  }
  return out.reverse();
}

/**
 * hard：只留系统外最近若干轮；工具只留摘要；旧 user RAG 去掉
 * @param {{ role: string, content: string, meta?: object }[]} history
 */
function compressHard(history) {
  var softed = compressSoft(history, 2);
  // 找最后一条真正的用户请求（非工具结果包装）
  var lastUserIdx = -1;
  for (var i = softed.length - 1; i >= 0; i--) {
    var meta = softed[i].meta || {};
    if (softed[i].role === 'user' && meta.kind === 'user') {
      lastUserIdx = i;
      break;
    }
  }
  var start = Math.max(0, softed.length - 10);
  if (lastUserIdx >= 0) start = Math.min(start, lastUserIdx);

  var slice = softed.slice(start);
  return slice.map(function(m) {
    var meta = m.meta || {};
    if (meta.kind === 'tool') {
      return {
        role: 'user',
        content: '[工具结果·摘要]\n' + (meta.summary || '完成'),
        meta: Object.assign({}, meta, { compressed: 'hard' }),
      };
    }
    if (meta.kind === 'user' && meta.hasRag && m !== slice[slice.length - 1] && softed.indexOf(m) !== lastUserIdx) {
      // 非当前用户回合：去掉可能很长的 RAG，只留短提示
      var plain = String(m.content || '');
      var cut = plain.split(/\n【相关小说/);
      return {
        role: 'user',
        content: truncateToTokens(cut[0] || plain, 400),
        meta: Object.assign({}, meta, { compressed: 'hard' }),
      };
    }
    if (meta.kind === 'thought') {
      return {
        role: 'assistant',
        content: truncateToTokens(String(m.content || ''), 80),
        meta: meta,
      };
    }
    if (String(m.content || '').length > 0 && countTokens(m.content) > 1200) {
      return {
        role: m.role,
        content: truncateToTokens(m.content, 1200),
        meta: Object.assign({}, meta, { compressed: 'hard-tail' }),
      };
    }
    return m;
  });
}

/**
 * 按 token 上限截断文本（末尾加标记）
 * @param {string} text
 * @param {number} maxTokens
 */
export function truncateToTokens(text, maxTokens) {
  var s = String(text == null ? '' : text);
  var cap = Math.max(1, Number(maxTokens) || 1);
  if (countTokens(s) <= cap) return s;
  var enc = encoder();
  var ids = enc.encode(s);
  if (ids.length <= cap) return s;
  var keep = Math.max(1, cap - 8);
  var sliced = ids.slice(0, keep);
  var out = enc.decode(sliced);
  return out + '\n…(已按 token 截断)';
}

/**
 * 若仍超预算：从最旧非「最后用户句」开始丢消息
 * @param {{ role: string, content: string, meta?: object }[]} history
 * @param {number} budget
 */
function dropOldestUntilFit(history, budget) {
  var list = history.slice();
  while (list.length > 1 && countMessagesTokens(stripToModelMessages(list)) > budget) {
    // 尽量不删最后一条 user
    var removeAt = 0;
    var last = list.length - 1;
    if (list[0] && list[0].meta && list[0].meta.kind === 'user' && last > 0) {
      removeAt = 1;
    }
    list.splice(removeAt, 1);
  }
  // 单条仍过大则硬截断
  if (list.length && countMessagesTokens(stripToModelMessages(list)) > budget) {
    list = list.map(function(m) {
      var room = Math.max(64, Math.floor(budget / Math.max(1, list.length)) - 4);
      return {
        role: m.role,
        content: truncateToTokens(m.content, room),
        meta: Object.assign({}, m.meta || {}, { compressed: 'force' }),
      };
    });
  }
  return list;
}

/**
 * 组装即将发送的 messages，并按预算整体压缩。
 * @param {{
 *   systemPrompt: string,
 *   uiMessages: object[],
 *   extraSystem?: string,
 *   pendingInput?: string,
 * }} opts
 * @returns {{
 *   messages: { role: string, content: string }[],
 *   level: 'none'|'soft'|'hard',
 *   breakdown: { system: number, history: number, pending: number, total: number, budget: number, softAt: number, hardAt: number },
 *   historyForUi: { role: string, content: string }[],
 * }}
 */
export function prepareAssistantMessages(opts) {
  opts = opts || {};
  var systemPrompt = String(opts.systemPrompt || '');
  var extraSystem = String(opts.extraSystem || '').trim();
  var pending = String(opts.pendingInput || '');
  var budget = inputTokenBudget();
  var softAt = softThreshold();
  var hardAt = hardThreshold();

  var history = uiMessagesToModelHistory(opts.uiMessages || []);
  var systemTokens = countTokens(systemPrompt)
    + (extraSystem ? countTokens(extraSystem) + (CONTEXT_BUDGET.messageOverhead || 0) : 0)
    + (CONTEXT_BUDGET.messageOverhead || 0);
  var pendingTokens = countTokens(pending);
  var historyTokens = countMessagesTokens(stripToModelMessages(history));
  var total = systemTokens + historyTokens + pendingTokens;

  var level = compressionLevelForTotal(total);
  if (level === 'soft') history = compressSoft(history, 4);
  if (level === 'hard') history = compressHard(history);

  historyTokens = countMessagesTokens(stripToModelMessages(history));
  total = systemTokens + historyTokens + pendingTokens;

  // 压缩后仍超硬阈值：继续丢最旧
  if (total > hardAt || total > budget) {
    level = 'hard';
    var roomForHistory = Math.max(256, budget - systemTokens - pendingTokens);
    history = dropOldestUntilFit(history, roomForHistory);
    historyTokens = countMessagesTokens(stripToModelMessages(history));
    total = systemTokens + historyTokens + pendingTokens;
  }

  var messages = [{ role: 'system', content: systemPrompt }];
  if (extraSystem) messages.push({ role: 'system', content: extraSystem });
  stripToModelMessages(history).forEach(function(m) { messages.push(m); });

  return {
    messages: messages,
    level: level,
    breakdown: {
      system: systemTokens,
      history: historyTokens,
      pending: pendingTokens,
      total: total,
      budget: budget,
      softAt: softAt,
      hardAt: hardAt,
    },
    historyForUi: stripToModelMessages(history),
  };
}

/**
 * 仅估算（不改写消息）— UI 计数器 / 弹窗用
 * @param {{ systemPrompt?: string, historyMessages?: { content?: string }[], pendingInput?: string, uiMessages?: object[] }} opts
 */
export function estimateAssistantContext(opts) {
  opts = opts || {};
  var system = countTokens(opts.systemPrompt || '') + (CONTEXT_BUDGET.messageOverhead || 0);
  var historyMsgs = opts.historyMessages;
  if ((!historyMsgs || !historyMsgs.length) && opts.uiMessages) {
    historyMsgs = stripToModelMessages(uiMessagesToModelHistory(opts.uiMessages));
  }
  var history = countMessagesTokens(historyMsgs || []);
  var pending = countTokens(opts.pendingInput || '');
  var total = system + history + pending;
  return {
    system: system,
    history: history,
    pending: pending,
    total: total,
    budget: inputTokenBudget(),
    softAt: softThreshold(),
    hardAt: hardThreshold(),
    level: compressionLevelForTotal(total),
  };
}
