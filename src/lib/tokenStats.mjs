/**
 * 卡构建器面板的 token 统计共用层（世界书 / 角色设定 / 开场白）。
 * 计数与展示格式复用 AI 助手同一套（tiktoken cl100k_base）；
 * 展示用低调 .tok-text（无底色无边框），与助手 token 计数视觉一致。
 */
import { countTokens } from './assistant/contextManager.mjs';
import { formatTokenCount } from './assistant/tokenEstimate.mjs';

export { countTokens, formatTokenCount };

/** 「1.2k tok」低调展示串（精确值放 title） */
export function formatTokenBadgeText(text) {
  var n = countTokens(text == null ? '' : text);
  return {
    html: '<span class="tok-text" title="' + n + ' tokens">' + formatTokenCount(n) + ' tok</span>',
    n: n,
    text: formatTokenCount(n) + ' tok',
  };
}

/** 纯文本摘要：`123 tok` / `1.2k tok` */
export function formatTokenText(n) {
  return formatTokenCount(n) + ' tok';
}
