/**
 * AI 助手回复 markdown 渲染（安全壳）
 * 策略：不整体预转义（会破坏 > 引用等语法）；而是在渲染层对原始 HTML / 链接 scheme / 代码 单独防护，
 * 使任何 `<script>`、`onerror=` 等降级为纯文本，而 markdown 语法（标题/列表/引用/表格等）正常生效。
 * 纯逻辑，可在 Node 直跑（测试依赖）。
 */
import { marked } from 'marked';

var SAFE_SCHEME = /^(https?:\/\/|mailto:)/i;

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

marked.use({
  gfm: true,
  breaks: true,
  renderer: {
    html: function(token) {
      // 原始 HTML 一律转义为文本：<script>、<img onerror=…> 等不可执行
      return escapeHtml(String((token && token.text) || ''));
    },
    link: function(token) {
      var href = String((token && token.href) || '').trim();
      var title = token && token.title ? escapeHtml(String(token.title)) : '';
      var text = token && token.tokens
        ? this.parser.parseInline(token.tokens)
        : escapeHtml(String((token && token.text) || ''));
      if (!SAFE_SCHEME.test(href)) return text;
      var attrs = ' href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer"';
      if (title) attrs += ' title="' + title + '"';
      return '<a' + attrs + '>' + text + '</a>';
    },
    image: function(token) {
      // 不渲染外部图片（数据安全）；降级为链接文本
      var alt = token && token.text ? escapeHtml(String(token.text)) : '';
      var href = String((token && token.href) || '').trim();
      if (SAFE_SCHEME.test(href)) {
        return '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">' + (alt || href) + '</a>';
      }
      return alt || '';
    },
    codespan: function(token) {
      return '<code>' + escapeHtml(String((token && token.text) || '')) + '</code>';
    },
  },
});

/**
 * @param {string} text AI 回复原文
 * @returns {string} 安全 HTML
 */
export function renderAssistantMarkdown(text) {
  var src = String(text == null ? '' : text);
  if (!src.trim()) return '';
  return marked.parse(src);
}

export function escapeAssistantHtml(text) {
  return escapeHtml(text);
}

