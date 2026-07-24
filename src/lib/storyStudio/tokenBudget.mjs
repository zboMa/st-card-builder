/**
 * 洋葱式 Token 预算：近章全量、远章压缩、总预算封顶
 * 计数 / 截断一律走 tiktoken（contextManager），禁止字符粗估。
 */
import { countTokens, truncateToTokens } from '../assistant/contextManager.mjs';

export var DEFAULT_TOKEN_BUDGET = {
  totalTokens: 8000,
  graphTokens: 1200,
  outlineNearTokens: 1600,
  feedForwardRecentTokens: 1800,
  feedForwardOlderTokens: 1000,
  prevContentTokens: 2000,
  ledgerTokens: 800,
  branchHintTokens: 280,
};

/**
 * 兼容旧字段名（*Chars → *Tokens）
 * @param {object} budget
 */
function normalizeBudget(budget) {
  var b = Object.assign({}, DEFAULT_TOKEN_BUDGET, budget || {});
  function map(oldKey, newKey) {
    if (budget && budget[oldKey] != null && budget[newKey] == null) {
      b[newKey] = budget[oldKey];
    }
  }
  map('totalChars', 'totalTokens');
  map('graphChars', 'graphTokens');
  map('outlineNearChars', 'outlineNearTokens');
  map('feedForwardRecentChars', 'feedForwardRecentTokens');
  map('feedForwardOlderChars', 'feedForwardOlderTokens');
  map('prevContentChars', 'prevContentTokens');
  map('ledgerChars', 'ledgerTokens');
  map('branchHintChars', 'branchHintTokens');
  return b;
}

/**
 * @param {string} text
 * @param {number} maxTokens
 * @deprecated 请用 truncateToTokens；保留别名兼容旧调用
 */
export function truncateChars(text, maxTokens) {
  return truncateToTokens(text, maxTokens);
}

/**
 * 组装写章上下文块（洋葱：最近 1～2 章 feed-forward 全量，更早压缩）
 * @param {object} opts
 * @returns {{ blocks: string[], usedTokens: number, usedChars: number, budget: object }}
 */
export function packChapterContext(opts) {
  var o = opts || {};
  var budget = normalizeBudget(o.budget);
  var blocks = [];
  var used = 0;

  function push(label, body, maxTok) {
    var raw = String(body || '').trim();
    if (!raw) return;
    var room = Math.max(0, budget.totalTokens - used);
    var cap = Math.min(maxTok, room);
    if (cap < 24) return;
    var text = truncateToTokens(raw, cap);
    var block = '【' + label + '】\n' + text;
    blocks.push(block);
    used += countTokens(block);
  }

  if (o.branchHint) push('当前分支方向', o.branchHint, budget.branchHintTokens);
  if (o.graphBrief) push('人物·地点', o.graphBrief, budget.graphTokens);
  if (o.outlineBrief) push('相关大纲', o.outlineBrief, budget.outlineNearTokens);
  if (o.ledgerBrief) push('伏笔账本（未收束）', o.ledgerBrief, budget.ledgerTokens);

  var feeds = Array.isArray(o.feedForwards) ? o.feedForwards : [];
  feeds.forEach(function(f, i) {
    if (!f) return;
    var isRecent = i < 2;
    var cap = isRecent ? budget.feedForwardRecentTokens : budget.feedForwardOlderTokens;
    var lines = [];
    lines.push((typeof f.order === 'number' ? '第' + (f.order + 1) + '章 ' : '') + (f.title || ''));
    if (f.summary) {
      lines.push('摘要：' + (isRecent ? f.summary : truncateToTokens(f.summary, 120)));
    }
    if (f.openThreads) {
      var ot = Array.isArray(f.openThreads) ? f.openThreads.join('；') : String(f.openThreads);
      lines.push('开放线：' + (isRecent ? ot : truncateToTokens(ot, 80)));
    }
    if (f.tension != null && f.tension !== '') lines.push('张力：' + f.tension);
    push(isRecent ? '近章记忆' : '远章压缩', lines.join('\n'), cap);
  });

  if (o.prevContent) push('上一章正文节选', o.prevContent, budget.prevContentTokens);

  return {
    blocks: blocks,
    usedTokens: used,
    /** @deprecated 兼容旧字段：数值为 token，非字符 */
    usedChars: used,
    budget: budget,
  };
}
