import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderAssistantMarkdown, escapeAssistantHtml } from '../src/lib/assistant/markdownRender.mjs';

test('基本 markdown 语法', function() {
  var html = renderAssistantMarkdown('# 标题\n\n**粗体** 与 *斜体*，行内 `code`。\n\n> 引用');
  assert.ok(html.indexOf('<h1>标题</h1>') >= 0);
  assert.ok(html.indexOf('<strong>粗体</strong>') >= 0);
  assert.ok(html.indexOf('<em>斜体</em>') >= 0);
  assert.ok(html.indexOf('<code>code</code>') >= 0);
  assert.ok(html.indexOf('<blockquote>') >= 0);
});

test('列表与代码块与表格', function() {
  var html = renderAssistantMarkdown('- 甲\n- 乙\n\n```js\nconst a = 1 < 2;\n```\n\n| k | v |\n|---|---|\n| 1 | 2 |');
  assert.ok(html.indexOf('<ul>') >= 0 && html.indexOf('<li>甲</li>') >= 0);
  assert.ok(html.indexOf('<pre><code class="language-js">') >= 0);
  assert.ok(html.indexOf('<table>') >= 0);
});

test('原始 HTML 一律转义为文本（防 XSS）', function() {
  var html = renderAssistantMarkdown('<script>alert(1)</script>\n<img src=x onerror=alert(2)>');
  assert.ok(html.indexOf('<script>') < 0, '无原始 <script>');
  assert.ok(html.indexOf('&lt;script&gt;') >= 0, '转义为文本');
  assert.ok(html.indexOf('&lt;img') >= 0);
  assert.ok(html.indexOf('onerror=alert(2)') >= 0);
});

test('危险链接 scheme 降级为纯文本', function() {
  var html = renderAssistantMarkdown('[安全](https://example.com) [危险](javascript:alert(1)) [data](data:text/html,x)');
  assert.ok(html.indexOf('<a href="https://example.com"') >= 0);
  assert.ok(html.indexOf('javascript:') < 0, 'javascript 不进 href');
  assert.ok(html.indexOf('data:text/html') < 0);
});

test('图片降级为链接（不加载外部资源）', function() {
  var html = renderAssistantMarkdown('![图](https://example.com/a.png)');
  assert.ok(html.indexOf('<img') < 0);
  assert.ok(html.indexOf('<a href="https://example.com/a.png"') >= 0);
});

test('空输入', function() {
  assert.equal(renderAssistantMarkdown(''), '');
  assert.equal(renderAssistantMarkdown('   '), '');
  assert.equal(renderAssistantMarkdown(null), '');
  assert.equal(renderAssistantMarkdown(undefined), '');
});

test('escapeAssistantHtml', function() {
  assert.equal(escapeAssistantHtml('<b>&"\''), '&lt;b&gt;&amp;&quot;&#39;');
});

test('换行保留（breaks）', function() {
  var html = renderAssistantMarkdown('第一行\n第二行');
  assert.ok(html.indexOf('第一行<br>') >= 0);
});
