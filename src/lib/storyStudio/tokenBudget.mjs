/**
 * 洋葱式 Token 预算：近章全量、远章压缩、总预算封顶
 */

export var DEFAULT_TOKEN_BUDGET = {
  /** 粗估：中文约 1.6 字/token，此处用「字符预算」 */
  totalChars: 12000,
  graphChars: 1800,
  outlineNearChars: 2400,
  feedForwardRecentChars: 2800,
  feedForwardOlderChars: 1600,
  prevContentChars: 3200,
  ledgerChars: 1200,
  branchHintChars: 400,
};

/**
 * @param {string} text
 * @param {number} max
 */
export function truncateChars(text, max) {
  var s = String(text || '');
  var n = Math.max(0, Math.floor(max || 0));
  if (!n || s.length <= n) return s;
  return s.slice(0, Math.max(0, n - 1)) + '…';
}

/**
 * 组装写章上下文块（洋葱：最近 1～2 章 feed-forward 全量，更早压缩）
 * @param {object} opts
 * @returns {{ blocks: string[], usedChars: number, budget: object }}
 */
export function packChapterContext(opts) {
  var o = opts || {};
  var budget = Object.assign({}, DEFAULT_TOKEN_BUDGET, o.budget || {});
  var blocks = [];
  var used = 0;

  function push(label, body, max) {
    var raw = String(body || '').trim();
    if (!raw) return;
    var room = Math.max(0, budget.totalChars - used);
    var cap = Math.min(max, room);
    if (cap < 40) return;
    var text = truncateChars(raw, cap);
    blocks.push('【' + label + '】\n' + text);
    used += text.length + label.length + 4;
  }

  if (o.branchHint) push('当前分支方向', o.branchHint, budget.branchHintChars);
  if (o.graphBrief) push('人物·地点', o.graphBrief, budget.graphChars);
  if (o.outlineBrief) push('相关大纲', o.outlineBrief, budget.outlineNearChars);
  if (o.ledgerBrief) push('伏笔账本（未收束）', o.ledgerBrief, budget.ledgerChars);

  var feeds = Array.isArray(o.feedForwards) ? o.feedForwards : [];
  // feeds: [{ order, title, summary, openThreads, tension }] 近→远 或 远→近均可；约定 idx0 为最近
  feeds.forEach(function(f, i) {
    if (!f) return;
    var isRecent = i < 2;
    var cap = isRecent ? budget.feedForwardRecentChars : budget.feedForwardOlderChars;
    var lines = [];
    lines.push((typeof f.order === 'number' ? '第' + (f.order + 1) + '章 ' : '') + (f.title || ''));
    if (f.summary) lines.push('摘要：' + (isRecent ? f.summary : truncateChars(f.summary, 180)));
    if (f.openThreads) {
      var ot = Array.isArray(f.openThreads) ? f.openThreads.join('；') : String(f.openThreads);
      lines.push('开放线：' + (isRecent ? ot : truncateChars(ot, 120)));
    }
    if (f.tension != null && f.tension !== '') lines.push('张力：' + f.tension);
    push(isRecent ? '近章记忆' : '远章压缩', lines.join('\n'), cap);
  });

  if (o.prevContent) push('上一章正文节选', o.prevContent, budget.prevContentChars);

  return { blocks: blocks, usedChars: used, budget: budget };
}
