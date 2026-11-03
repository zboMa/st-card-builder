/**
 * AI 助手消息列表 → Vue 可渲染快照（无 DOM，可单测）。
 *
 * 旧面板在 `panelBoot.mjs` 里手工 createElement / innerHTML；
 * 迁移后由本模块把 uiMessages 映射成纯数据，Vue 只负责渲染。
 */
import { renderAssistantMarkdown, escapeAssistantHtml } from './markdownRender.mjs';
import { messageContentForDisplay } from './ragInject.mjs';
import { getToolByName } from './tools.mjs';
import {
  toolMessageSummary,
  parseToolNameFromLegacy,
  parseRiskFromLegacy,
} from './toolTraceSummary.mjs';
import { isTailRetryTarget, isTailRegenerateTarget } from './retryTurn.mjs';

export function riskBadgeClass(risk) {
  if (risk === 'auto') return 'assistant-tool-card__risk--auto';
  if (risk === 'confirm') return 'assistant-tool-card__risk--confirm';
  if (risk === 'none') return 'assistant-tool-card__risk--none';
  return '';
}

export function formatToolArgs(args) {
  if (!args || typeof args !== 'object') return '';
  var keys = Object.keys(args);
  if (!keys.length) return '';
  try {
    var json = JSON.stringify(args, null, 2);
    return json.length > 900 ? json.slice(0, 900) + '\n…(参数过长已截断)' : json;
  } catch (e) {
    return '';
  }
}

export function shortContextTitle(title) {
  return String(title || '')
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .trim()
    .slice(0, 8) || '段';
}

export function toContextModalView(sections, meta) {
  var list = Array.isArray(sections) ? sections : [];
  return {
    open: true,
    meta: String(meta || ''),
    activeId: list.length ? list[0].id : '',
    sections: list.map(function (sec) {
      return {
        id: sec.id,
        title: sec.title,
        shortTitle: shortContextTitle(sec.title),
        tokens: sec.tokens,
        note: sec.note || '',
        body: sec.body || '',
        children: (sec.children || []).map(function (ch) {
          return { title: ch.title, tokens: ch.tokens, body: ch.body };
        }),
      };
    }),
  };
}

export function createAssistantMessageCache() {
  return new WeakMap();
}

function buildBaseMessage(m) {
  var id = (m && typeof m === 'object' && m.id) ? String(m.id) : '';

  if (m && m.compaction) {
    return {
      kind: 'compaction',
      id: id,
      text: m.modelContent || '',
      showRetry: false,
      showReroll: false,
    };
  }

  if (m && m.role === 'tool') {
    var toolName = m.toolName || parseToolNameFromLegacy(m.content) || 'tool';
    var meta = getToolByName(toolName);
    var risk = m.risk || parseRiskFromLegacy(m.content) || '?';
    return {
      kind: 'tool',
      id: id,
      tool: {
        displayName: (meta && meta.title) || toolName,
        risk: risk,
        riskClass: riskBadgeClass(risk),
        summary: toolMessageSummary(m),
        detail: m.detail || m.content || '',
        argsText: formatToolArgs(m.toolArgs),
        running: !!m.running,
        error: !!m.error,
        pendingConfirm: !!m.pendingConfirm,
      },
      showRetry: false,
      showReroll: false,
    };
  }

  if (m && m.role === 'user') {
    return {
      kind: 'user',
      id: id,
      text: messageContentForDisplay(m),
      hasRag: !!(m.ragPreview && m.ragPreview.ragBody),
      showRetry: false,
      showReroll: false,
    };
  }

  var text = messageContentForDisplay(m);
  return {
    kind: 'assistant',
    id: id,
    text: text,
    error: !!(m && m.error),
    html: (m && m.error) ? escapeAssistantHtml(text) : renderAssistantMarkdown(text),
    showRetry: false,
    showReroll: false,
  };
}

export function buildAssistantMessages(uiMessages, cache) {
  var list = Array.isArray(uiMessages) ? uiMessages : [];
  return list.map(function (m, index) {
    var base = null;
    if (cache && m && typeof m === 'object') base = cache.get(m);
    if (!base) {
      base = buildBaseMessage(m);
      if (cache && m && typeof m === 'object') cache.set(m, base);
    }

    var showRetry = isTailRetryTarget(list, index);
    var showReroll = !showRetry && isTailRegenerateTarget(list, index);

    if (base.showRetry === showRetry && base.showReroll === showReroll) return base;
    return Object.assign({}, base, { showRetry: showRetry, showReroll: showReroll });
  });
}
