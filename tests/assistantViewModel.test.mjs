import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildAssistantMessages, shortContextTitle, toContextModalView } from '../src/lib/assistant/assistantViewModel.mjs';

describe('assistantViewModel', function () {
  it('user 消息输出纯文本与 RAG 标记', function () {
    const [m] = buildAssistantMessages([
      { role: 'user', content: '帮我改卡', ragPreview: { ragBody: '片段' } },
    ]);
    assert.equal(m.kind, 'user');
    assert.equal(m.text, '帮我改卡');
    assert.equal(m.hasRag, true);
  });

  it('tool 消息输出工具卡字段', function () {
    const [m] = buildAssistantMessages([
      { role: 'tool', toolName: 'no_such_tool', risk: 'auto', detail: 'ok', toolArgs: { a: 1 } },
    ]);
    assert.equal(m.kind, 'tool');
    assert.equal(m.tool.displayName, 'no_such_tool');
    assert.equal(m.tool.risk, 'auto');
    assert.equal(m.tool.riskClass, 'assistant-tool-card__risk--auto');
    assert.match(m.tool.argsText, /"a": 1/);
    assert.equal(m.tool.detail, 'ok');
    assert.equal(typeof m.tool.summary, 'string');
  });

  it('压缩节点单独成卡', function () {
    const [m] = buildAssistantMessages([{ compaction: true, modelContent: '更早的对话' }]);
    assert.equal(m.kind, 'compaction');
    assert.equal(m.text, '更早的对话');
  });

  it('assistant 正常回复走 markdown，错误走转义', function () {
    const [ok, err] = buildAssistantMessages([
      { role: 'assistant', content: '**加粗**' },
      { role: 'assistant', content: '<b>x</b>', error: true, retryable: true },
    ]);
    assert.match(ok.html, /<strong>加粗<\/strong>/);
    assert.equal(err.error, true);
    assert.doesNotMatch(err.html, /<b>/);
    assert.match(err.html, /&lt;b&gt;/);
  });

  it('上下文弹窗快照：短标题、子段与首段激活', function () {
    assert.equal(shortContextTitle('历史对话（12 条）'), '历史对话');
    const view = toContextModalView([
      {
        id: 'catalog',
        title: '目录注入',
        tokens: 120,
        note: '完整概览',
        body: '总览',
        children: [{ title: '口味·3', tokens: 40, body: '片段' }],
      },
      { id: 'pending', title: '待发送内容', tokens: 8, body: '你好' },
    ], '总 token 128');
    assert.equal(view.open, true);
    assert.equal(view.meta, '总 token 128');
    assert.equal(view.activeId, 'catalog');
    assert.equal(view.sections[0].shortTitle, '目录注入');
    assert.equal(view.sections[0].children[0].body, '片段');
    assert.equal(view.sections[1].children.length, 0);
  });

  it('只有最后一条正常回复给「重新生成」，错误给「重试」', function () {
    const list = buildAssistantMessages([
      { role: 'assistant', content: '第一条' },
      { role: 'assistant', content: '第二条' },
    ]);
    assert.equal(list[0].showReroll, false);
    assert.equal(list[1].showReroll, true);

    const [err] = buildAssistantMessages([
      { role: 'assistant', content: '错误：网络失败', error: true, retryable: true },
    ]);
    assert.equal(err.showRetry, true);
    assert.equal(err.showReroll, false);
  });
});
