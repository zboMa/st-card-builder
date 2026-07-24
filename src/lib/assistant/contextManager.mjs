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
/** 单段 encode 上限：js-tiktoken 纯 JS BPE 对长 CJK 近似 O(n²)，必须分块 */
var ENCODE_CHUNK_CHARS = 240;

function encoder() {
  if (!_enc) _enc = getEncoding('cl100k_base');
  return _enc;
}

/**
 * @param {string|null|undefined} text
 */
export function countTokens(text) {
  if (text == null || text === '') return 0;
  try {
    var s = String(text);
    var enc = encoder();
    if (s.length <= ENCODE_CHUNK_CHARS) return enc.encode(s).length;
    var total = 0;
    for (var i = 0; i < s.length; i += ENCODE_CHUNK_CHARS) {
      total += enc.encode(s.slice(i, i + ENCODE_CHUNK_CHARS)).length;
    }
    return total;
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
        // 送模优先 modelContent（完整 raw）；UI 用 content/displayContent
        content: messageContentForModel(m),
        meta: { kind: 'assistant' },
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
 * soft：压缩旧工具正文，保留近期完整结果；assistant 原文不丢弃、不改写结构
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

  var out = [];
  for (var i = history.length - 1; i >= 0; i--) {
    var m = history[i];
    var meta = m.meta || {};
    if (meta.kind === 'tool' && !keepSet[i]) {
      var summary = meta.summary || '工具结果';
      var body = String(meta.fullBody || m.content || '');
      // 旧工具结果按 token 预算截断预览；不改写模型 assistant 原文
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
 * assistant 仅允许按 token 截断，禁止 Thought/Action 重组
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
    // assistant / 其它：仅按 token 截断，不重组 Thought/Action
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
 * 按 token 上限截断文本（保留开头，末尾加标记）
 * @param {string} text
 * @param {number} maxTokens
 */
export function truncateToTokens(text, maxTokens) {
  var s = String(text == null ? '' : text);
  var cap = Math.max(0, Math.floor(Number(maxTokens) || 0));
  if (!cap) return '';
  if (!s) return '';
  // 预切字符窗，避免对整章/长召回整段 BPE
  var maxChars = Math.min(s.length, Math.max(cap * 4, cap + 64));
  var head = s.length > maxChars ? s.slice(0, maxChars) : s;
  if (countTokens(head) <= cap && head === s) return s;
  var enc = encoder();
  var ids = enc.encode(head);
  if (ids.length <= cap && head === s) return s;
  var marker = '\n…(已按 token 截断)';
  var markerTok = enc.encode(marker).length;
  var keep = Math.max(1, Math.min(ids.length, cap - markerTok));
  if (keep >= ids.length && head === s && ids.length + markerTok <= cap) return s;
  return enc.decode(ids.slice(0, keep)) + marker;
}

/**
 * 按 token 上限截断文本（保留末尾，用于扫描缓冲等「近端优先」场景）
 * @param {string} text
 * @param {number} maxTokens
 */
export function truncateTailToTokens(text, maxTokens) {
  var s = String(text == null ? '' : text);
  var cap = Math.max(0, Math.floor(Number(maxTokens) || 0));
  if (!cap) return '';
  if (!s) return '';
  var maxChars = Math.min(s.length, Math.max(cap * 4, cap + 64));
  var tail = s.length > maxChars ? s.slice(s.length - maxChars) : s;
  if (countTokens(tail) <= cap && tail === s) return s;
  var enc = encoder();
  var ids = enc.encode(tail);
  if (ids.length <= cap && tail === s) return s;
  return enc.decode(ids.slice(Math.max(0, ids.length - cap)));
}

/**
 * 按 token 预算累积片段（可截断最后一条）
 * @param {object[]} snippets
 * @param {number} budgetTokens
 * @param {{ getText?: (s: object) => string, minRemain?: number }} [opts]
 * @returns {{ snippets: object[], totalTokens: number, truncated: boolean }}
 */
export function truncateSnippetsByTokenBudget(snippets, budgetTokens, opts) {
  opts = opts || {};
  var getText = opts.getText || function(s) { return String(s && s.text != null ? s.text : ''); };
  var minRemain = opts.minRemain != null ? opts.minRemain : 24;
  var cap = Math.max(1, Math.floor(Number(budgetTokens) || 0));
  var out = [];
  var total = 0;
  var truncated = false;
  (snippets || []).forEach(function(s) {
    if (total >= cap) {
      truncated = true;
      return;
    }
    var text = getText(s);
    if (!text) return;
    var tok = countTokens(text);
    if (total + tok <= cap) {
      out.push(s);
      total += tok;
      return;
    }
    var remain = cap - total;
    if (remain >= minRemain) {
      var clipped = truncateToTokens(text, remain);
      out.push(Object.assign({}, s, { text: clipped }));
      total += countTokens(clipped);
    }
    truncated = true;
  });
  if (!truncated && out.length < (snippets || []).length) truncated = true;
  return { snippets: out, totalTokens: total, truncated: truncated };
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

/**
 * 拆分 Chat Completions：前缀连续 system 保留，其余为可压缩 body
 * @param {{ role: string, content: string }[]} messages
 */
function splitChatPrefix(messages) {
  var list = Array.isArray(messages) ? messages : [];
  var prefix = [];
  var body = [];
  var i = 0;
  while (i < list.length && list[i] && list[i].role === 'system') {
    prefix.push({ role: 'system', content: String(list[i].content || '') });
    i++;
  }
  for (; i < list.length; i++) {
    if (!list[i]) continue;
    body.push({
      role: list[i].role || 'user',
      content: String(list[i].content || ''),
    });
  }
  return { prefix: prefix, body: body };
}

/**
 * soft：压缩较早的长消息（按 token），保留近端完整
 * @param {{ role: string, content: string }[]} body
 * @param {number} keepRecent
 */
function compressChatBodySoft(body, keepRecent) {
  var keep = keepRecent == null ? 6 : keepRecent;
  var startFull = Math.max(0, body.length - keep);
  return body.map(function(m, idx) {
    if (idx >= startFull) return m;
    var tok = countTokens(m.content);
    if (tok <= 400) return m;
    return {
      role: m.role,
      content: truncateToTokens(m.content, 400),
    };
  });
}

/**
 * hard：只留近端若干条；更早的大幅截断
 * @param {{ role: string, content: string }[]} body
 */
function compressChatBodyHard(body) {
  var softed = compressChatBodySoft(body, 4);
  var keep = 8;
  var start = Math.max(0, softed.length - keep);
  var head = softed.slice(0, start).map(function(m) {
    return {
      role: m.role,
      content: truncateToTokens(m.content, 120),
    };
  });
  return head.concat(softed.slice(start));
}

/**
 * 丢弃最旧 body，尽量保留最后一条 user
 * @param {{ role: string, content: string }[]} body
 * @param {number} budget
 */
function dropChatBodyUntilFit(body, budget) {
  var list = body.slice();
  while (list.length > 1 && countMessagesTokens(list) > budget) {
    var removeAt = 0;
    if (list[0] && list[0].role === 'user' && list.length > 1) removeAt = 0;
    // 若第一条是最后唯一 user 则删下一条
    var lastUser = -1;
    for (var i = list.length - 1; i >= 0; i--) {
      if (list[i].role === 'user') { lastUser = i; break; }
    }
    if (removeAt === lastUser && list.length > 1) removeAt = 1;
    list.splice(removeAt, 1);
  }
  if (list.length && countMessagesTokens(list) > budget) {
    list = list.map(function(m) {
      var room = Math.max(64, Math.floor(budget / Math.max(1, list.length)) - 4);
      return { role: m.role, content: truncateToTokens(m.content, room) };
    });
  }
  return list;
}

/**
 * 试聊 / 任意 Chat Completions：发送前整体压缩（与助手同一套 200k / 60% / 80%）
 * @param {{ role: string, content: string }[]} messages
 * @param {{ limit?: number, reserveReply?: number, softRatio?: number, hardRatio?: number }} [opts]
 * @returns {{
 *   messages: { role: string, content: string }[],
 *   level: 'none'|'soft'|'hard',
 *   breakdown: { total: number, budget: number, softAt: number, hardAt: number, prefix: number, body: number },
 * }}
 */
export function prepareChatCompletionMessages(messages, opts) {
  opts = opts || {};
  var limit = opts.limit != null ? Number(opts.limit) : CONTEXT_BUDGET.limit;
  var reserve = opts.reserveReply != null ? Number(opts.reserveReply) : CONTEXT_BUDGET.reserveReply;
  var softRatio = opts.softRatio != null ? Number(opts.softRatio) : CONTEXT_BUDGET.softRatio;
  var hardRatio = opts.hardRatio != null ? Number(opts.hardRatio) : CONTEXT_BUDGET.hardRatio;
  var budget = Math.max(1024, limit - Math.max(0, reserve || 0));
  var softAt = Math.floor(budget * (softRatio || 0.6));
  var hardAt = Math.floor(budget * (hardRatio || 0.8));

  var split = splitChatPrefix(messages);
  var prefix = split.prefix;
  var body = split.body;
  var prefixTokens = countMessagesTokens(prefix);
  var bodyTokens = countMessagesTokens(body);
  var total = prefixTokens + bodyTokens;

  var level = 'none';
  if (total >= hardAt) level = 'hard';
  else if (total >= softAt) level = 'soft';

  if (level === 'soft') body = compressChatBodySoft(body, 6);
  if (level === 'hard') body = compressChatBodyHard(body);

  bodyTokens = countMessagesTokens(body);
  total = prefixTokens + bodyTokens;

  if (total > hardAt || total > budget) {
    level = 'hard';
    var roomForBody = Math.max(256, budget - prefixTokens);
    body = dropChatBodyUntilFit(body, roomForBody);
    // 前缀过大：按条截断 system
    if (prefixTokens > budget * 0.7) {
      prefix = prefix.map(function(m) {
        return { role: 'system', content: truncateToTokens(m.content, Math.floor((budget * 0.5) / Math.max(1, prefix.length))) };
      });
      prefixTokens = countMessagesTokens(prefix);
      roomForBody = Math.max(256, budget - prefixTokens);
      body = dropChatBodyUntilFit(body, roomForBody);
    }
    bodyTokens = countMessagesTokens(body);
    total = prefixTokens + bodyTokens;
  }

  return {
    messages: prefix.concat(body),
    level: level,
    breakdown: {
      total: total,
      budget: budget,
      softAt: softAt,
      hardAt: hardAt,
      prefix: prefixTokens,
      body: bodyTokens,
    },
  };
}

/**
 * 按 token 预算逐行追加（用于 prior/digest 拼装）
 * @param {number} maxTokens
 * @returns {{ tryAdd: (line: string) => boolean, used: () => number, remaining: () => number }}
 */
export function createTokenBudgetAccumulator(maxTokens) {
  var cap = Math.max(0, Math.floor(Number(maxTokens) || 0));
  var used = 0;
  return {
    tryAdd: function(line) {
      var t = countTokens(line);
      if (cap > 0 && used + t > cap) return false;
      used += t;
      return true;
    },
    used: function() { return used; },
    remaining: function() { return Math.max(0, cap - used); },
  };
}
