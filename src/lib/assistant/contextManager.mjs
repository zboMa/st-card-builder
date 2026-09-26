/**
 * 助手上下文管理（独立模块）
 * - 预算：200k tokens（tiktoken cl100k_base，经 js-tiktoken）
 * - 送模从最近一次成功的上下文检查点开始；检查点之前的原文留在会话里
 * - 达到硬阈值时由面板写一次检查点，不在每次发送时重压全文
 * - 试聊仍走 prepareChatCompletionMessages 的发送时压缩
 */
import { getEncoding } from 'js-tiktoken';
import { messageContentForModel } from './ragInject.mjs';
import { modelFacingToolSummary, toolResultBodyForModel } from './toolTraceSummary.mjs';

/** @type {{ limit: number, softRatio: number, hardRatio: number, messageOverhead: number, reserveReply: number }} */
export var CONTEXT_BUDGET = {
  /** 模型上下文总窗口 */
  limit: 200000,
  /** 超过该比例只标档位，不在发送时重写历史 */
  softRatio: 0.6,
  /** 超过该比例且还有可收起的对话时，写一次上下文检查点 */
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
      // 失败红条不送模（重试会删掉或续接）；工具错误走 role===tool，仍送模
      if (m.error) return;
      out.push({
        role: 'assistant',
        // 送模优先 modelContent（完整 raw）；UI 用 content/displayContent
        content: messageContentForModel(m),
        meta: { kind: 'assistant' },
      });
      return;
    }
    if (m.compaction) {
      if (!m.ok) return;
      var checkpointBody = String(m.modelContent || m.content || '').trim();
      if (!checkpointBody || checkpointBody === '上下文已压缩') return;
      out.push({
        role: 'user',
        content: '[上下文检查点]\n' + checkpointBody,
        meta: { kind: 'checkpoint' },
      });
      return;
    }
    if (m.role === 'tool') {
      if (m.running) return;
      var toolLine = modelFacingToolSummary(m);
      var toolBody = toolResultBodyForModel(m);
      var toolLabel = m.error ? '[工具结果·失败]' : '[工具结果·成功]';
      out.push({
        role: 'user',
        content: toolLabel + '\n' + toolLine + (toolBody ? '\n' + toolBody : ''),
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

/** 检查点之后原样保留的近期 token。再早的对话收进下一次检查点。 */
export var COMPACTION_KEEP_TOKENS = 8000;

/** @param {object[]} uiMessages */
export function lastCheckpointIndex(uiMessages) {
  var idx = -1;
  var list = uiMessages || [];
  for (var i = 0; i < list.length; i++) {
    if (list[i] && list[i].compaction && list[i].ok) idx = i;
  }
  return idx;
}

/** 送模面：最近一次成功检查点及其后的消息。 */
export function modelSurfaceMessages(uiMessages) {
  var list = uiMessages || [];
  var idx = lastCheckpointIndex(list);
  if (idx < 0) return list.slice();
  return list.slice(idx);
}

function surfacePieceTokens(m) {
  if (!m || m.running) return 0;
  var hist = uiMessagesToModelHistory([m]);
  return countMessagesTokens(stripToModelMessages(hist));
}

/**
 * 压哪一段：检查点之后、近期原文之前。尾部是连续的近端，切在工具结果上时把前一条助手调用留在尾部。
 * @param {object[]} uiMessages
 * @returns {{ anchor: string, head: object[], insertAt: number }|null}
 */
export function planCompactionSpan(uiMessages) {
  var list = uiMessages || [];
  var ck = lastCheckpointIndex(list);
  var bodyStart = ck < 0 ? 0 : ck + 1;
  if (list.length - bodyStart < 2) return null;

  var keep = 0;
  var tailAt = list.length;
  for (var i = list.length - 1; i >= bodyStart; i--) {
    var tok = surfacePieceTokens(list[i]);
    if (keep > 0 && keep + tok > COMPACTION_KEEP_TOKENS) break;
    keep += tok;
    tailAt = i;
  }
  if (list[tailAt] && list[tailAt].role === 'tool' && tailAt - 1 >= bodyStart
    && list[tailAt - 1] && list[tailAt - 1].role === 'assistant') {
    tailAt -= 1;
  }
  if (tailAt <= bodyStart) return null;
  var head = list.slice(bodyStart, tailAt).filter(function(m) { return m && !m.running; });
  if (!head.length) return null;
  var anchor = ck >= 0 ? String(list[ck].modelContent || list[ck].content || '') : '';
  if (anchor === '上下文已压缩') anchor = '';
  return { anchor: anchor, head: head, insertAt: tailAt };
}

/**
 * 摘要调用的用户消息。超长时只保留这段对话的近端，已有检查点全文仍放在前面。
 * @param {{ anchor?: string, head?: object[] }} span
 */
export function buildCompactionRequest(span) {
  span = span || {};
  var headHist = uiMessagesToModelHistory(span.head || []);
  var transcript = headHist.map(function(m) {
    return '[' + (m.role || 'msg') + ']\n' + String(m.content || '');
  }).join('\n\n');
  var room = Math.max(2000, inputTokenBudget() - 2000);
  if (countTokens(transcript) > room) transcript = truncateTailToTokens(transcript, room);
  var lines = [
    '你在为制卡助手写上下文检查点。只输出摘要，不要调用工具，不要抄长正文。',
    '卡片上的设定以之后的读卡工具为准。不要把角色卡、世界书、开场白的全文写进摘要。',
    '用中文，按此结构：当前目标；已写入的角色与世界书（标题和条数）；世界与限定；未完成的生成；失败与待确认；用户明确要求。',
  ];
  if (span.anchor) {
    lines.push('已有检查点（据此更新，删掉已经过时的内容）：\n' + span.anchor);
  }
  lines.push('需要收进检查点的对话：\n' + (transcript || '（无）'));
  return lines.join('\n\n');
}

/** @param {string} summary */
export function makeCheckpointMessage(summary) {
  var text = String(summary || '').trim();
  return {
    role: 'compaction',
    compaction: true,
    ok: true,
    content: '上下文已压缩',
    modelContent: text,
  };
}

function stripToModelMessages(history) {
  return (history || []).map(function(m) {
    return { role: m.role, content: m.content };
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
 * 组装即将发送的 messages。送模面从最近检查点开始；仍超窗时当次丢掉最旧几条，不改会话原文。
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

  var rawMessages = opts.uiMessages || [];
  var history = uiMessagesToModelHistory(modelSurfaceMessages(rawMessages));
  var systemTokens = countTokens(systemPrompt)
    + (extraSystem ? countTokens(extraSystem) + (CONTEXT_BUDGET.messageOverhead || 0) : 0)
    + (CONTEXT_BUDGET.messageOverhead || 0);
  var pendingTokens = countTokens(pending);
  var historyTokens = countMessagesTokens(stripToModelMessages(history));
  var total = systemTokens + historyTokens + pendingTokens;

  var level = compressionLevelForTotal(total);
  var needsCompaction = total >= hardAt && !!planCompactionSpan(rawMessages);

  // 检查点还没写上、或尾巴本身仍超窗：当次丢掉最旧的几条，避免请求超限。不改会话原文。
  if (total > budget) {
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
    needsCompaction: needsCompaction,
    compacted: lastCheckpointIndex(rawMessages) >= 0,
  };
}

/**
 * 仅估算送模面（最近检查点及其后），不改写消息。
 * @param {{ systemPrompt?: string, historyMessages?: { content?: string }[], pendingInput?: string, uiMessages?: object[] }} opts
 */
export function estimateAssistantContext(opts) {
  opts = opts || {};
  var system = countTokens(opts.systemPrompt || '') + (CONTEXT_BUDGET.messageOverhead || 0);
  var historyMsgs = opts.historyMessages;
  var raw = opts.uiMessages || [];
  if ((!historyMsgs || !historyMsgs.length) && raw.length) {
    historyMsgs = stripToModelMessages(uiMessagesToModelHistory(modelSurfaceMessages(raw)));
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
    compacted: lastCheckpointIndex(raw) >= 0,
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
