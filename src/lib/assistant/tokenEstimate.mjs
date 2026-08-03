/**
 * 助手上下文 UI 展示层。
 * Token 计数 / 压缩预算见 contextManager.mjs（tiktoken cl100k_base）。
 */
import {
  countTokens,
  countMessagesTokens,
  estimateAssistantContext,
  CONTEXT_BUDGET,
  compressionLevelForTotal,
} from './contextManager.mjs';

export {
  countTokens,
  countMessagesTokens,
  estimateAssistantContext,
  CONTEXT_BUDGET,
  compressionLevelForTotal,
};

/** @deprecated 使用 countTokens；保留别名兼容旧测试/调用 */
export function estimateTokens(text) {
  return countTokens(text);
}

/** @deprecated 使用 countMessagesTokens */
export function estimateMessagesTokens(messages) {
  return countMessagesTokens(messages);
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

/**
 * @param {{ system: number, history: number, pending: number, budget?: number, level?: string, softAt?: number, hardAt?: number }} breakdown
 */
export function formatAssistantContextTitle(breakdown) {
  var b = breakdown || {};
  var level = b.level || compressionLevelForTotal(b.total || 0);
  var levelZh = level === 'hard' ? '激进压缩' : (level === 'soft' ? '启动压缩' : '未压缩');
  return [
    'tiktoken (cl100k_base) · 预算 ' + formatTokenCount(b.budget || CONTEXT_BUDGET.limit)
      + ' · 当前档：' + levelZh + ' · 点击查看上下文内容',
    '系统: ' + (b.system || 0),
    '历史: ' + (b.history || 0),
    '待发送: ' + (b.pending || 0),
    '软阈值: ' + (b.softAt != null ? b.softAt : '—')
      + ' · 硬阈值: ' + (b.hardAt != null ? b.hardAt : '—'),
  ].join('\n');
}

/**
 * 组装弹窗分区（纯数据，不含 HTML）。
 * @param {{
 *   systemPrompt?: string,      // 原始 system 模板（未替换变量）
 *   systemNote?: string,
 *   toolList?: string,
 *   toolNote?: string,
 *   catalogBlocks?: { kind: string, label: string, count: number, body: string }[], // 实际注入形态，按类拆分
 *   catalogRepeat?: number,    // 模板中 {{catalogOverview}} 出现次数（默认 1）；>1 表示真实送模 N 份
 *   catalogNote?: string,
 *   characterFieldHint?: string,
 *   fieldNote?: string,
 *   buildGuide?: string,      // 建卡引导（独立可编辑，经 {{buildGuide}} 并入 system）
 *   guideNote?: string,
 *   historyMessages?: { role?: string, content?: string }[],
 *   historyNote?: string,
 *   pendingInput?: string,
 *   ragBody?: string,
 *   ragNote?: string,
 * }} opts
 * @returns {{ id: string, title: string, tokens: number, body: string, note?: string, children?: { title: string, tokens: number, body: string }[] }[]}
 */
export function buildAssistantContextSections(opts) {
  opts = opts || {};
  var sections = [];
  function push(id, title, body, note) {
    var text = String(body == null ? '' : body);
    if (!text.trim()) return;
    sections.push({
      id: id,
      title: title,
      tokens: countTokens(text),
      body: text,
      note: note || '',
    });
  }
  function pushChildren(id, title, children, note, totalBody, repeat) {
    if (!children || !children.length) return;
    var multi = Math.max(1, Number(repeat) || 1);
    sections.push({
      id: id,
      title: title,
      tokens: countTokens(totalBody || '') * multi,
      body: totalBody || '',
      note: note || '',
      children: children,
    });
  }

  push('system', '系统提示（原始模板）', opts.systemPrompt || '', opts.systemNote);
  push('tools', '工具列表', opts.toolList || '', opts.toolNote);
  if (opts.catalogBlocks && opts.catalogBlocks.length) {
    var totalBody = opts.catalogBlocks.map(function(b) { return b.body; }).join('\n\n');
    var repeat = Math.max(1, Number(opts.catalogRepeat) || 1);
    var repeatNote = repeat > 1
      ? '（注意：模板引用 {{catalogOverview}} ' + repeat + ' 次，真实送模为下方内容 ×' + repeat + '，分区 token 已按 ×' + repeat + ' 计）'
      : '';
    pushChildren('catalog', '目录注入', opts.catalogBlocks.map(function(b) {
      return {
        title: b.label + (b.count ? '（' + b.count + ' 条）' : ''),
        tokens: countTokens(b.body),
        body: b.body,
      };
    }), (opts.catalogNote || '') + repeatNote, totalBody, repeat);
  }
  push('fields', '角色字段提示', opts.characterFieldHint || '', opts.fieldNote);
  push('guide', '建卡引导', opts.buildGuide || '', opts.guideNote);

  var hist = opts.historyMessages || [];
  if (hist.length) {
    var histBody = hist.map(function(m, i) {
      var role = (m && m.role) || 'msg';
      var content = String(m && m.content || '');
      return '[' + (i + 1) + '] ' + role + '\n' + content;
    }).join('\n\n——\n\n');
    push('history', '历史（最近 ' + hist.length + ' 条）', histBody, opts.historyNote);
  }

  push('pending', '待发送输入', opts.pendingInput || '');
  push('rag', 'RAG 注入', opts.ragBody || '', opts.ragNote);
  return sections;
}
