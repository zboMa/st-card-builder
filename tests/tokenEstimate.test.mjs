/**
 * 助手上下文 UI 展示（计数委托 contextManager / tiktoken）
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateTokens,
  estimateAssistantContext,
  estimateMessagesTokens,
  formatTokenCount,
  formatAssistantContextLabel,
  formatAssistantContextTitle,
  buildAssistantContextSections,
  countTokens,
  CONTEXT_BUDGET,
} from '../src/lib/assistant/tokenEstimate.mjs';

describe('tokenEstimate', function() {
  it('estimateTokens 走 tiktoken（非 chars×2）', function() {
    assert.equal(estimateTokens(''), 0);
    assert.equal(estimateTokens(null), 0);
    assert.equal(estimateTokens('hello'), countTokens('hello'));
    assert.notEqual(estimateTokens('hello world'), String('hello world').length * 2);
  });

  it('estimateMessagesTokens 累加各条 content', function() {
    var a = estimateMessagesTokens([
      { role: 'user', content: 'abcd' },
      { role: 'assistant', content: 'efgh' },
    ]);
    assert.ok(a > 0);
    assert.equal(
      a,
      countTokens('abcd') + countTokens('efgh') + CONTEXT_BUDGET.messageOverhead * 2,
    );
  });

  it('estimateAssistantContext 分解 system/history/pending', function() {
    var breakdown = estimateAssistantContext({
      systemPrompt: 'abcd',
      historyMessages: [{ content: 'efgh' }],
      pendingInput: 'hi',
    });
    assert.ok(breakdown.system > 0);
    assert.ok(breakdown.history > 0);
    assert.ok(breakdown.pending > 0);
    assert.equal(breakdown.total, breakdown.system + breakdown.history + breakdown.pending);
    assert.ok(breakdown.budget > 0);
  });

  it('formatTokenCount 与标签文案', function() {
    assert.equal(formatTokenCount(842), '842');
    assert.equal(formatTokenCount(12500), '12.5k');
    assert.equal(formatAssistantContextLabel(842), '上下文 842 tokens');
    assert.match(formatAssistantContextLabel(12500), /≈ 12\.5k tokens/);
  });

  it('formatAssistantContextTitle 含 tiktoken 与分项', function() {
    var title = formatAssistantContextTitle({
      system: 100,
      history: 200,
      pending: 50,
      total: 350,
      budget: CONTEXT_BUDGET.limit,
      softAt: 1000,
      hardAt: 2000,
      level: 'none',
    });
    assert.match(title, /tiktoken/);
    assert.match(title, /系统: 100/);
    assert.match(title, /历史: 200/);
    assert.match(title, /待发送: 50/);
  });

  it('buildAssistantContextSections 分区', function() {
    var secs = buildAssistantContextSections({
      systemPrompt: 'sys',
      toolList: 'tools',
      pendingInput: 'hi',
      historyMessages: [{ role: 'user', content: 'a' }],
    });
    var ids = secs.map(function(s) { return s.id; });
    assert.ok(ids.indexOf('system') >= 0);
    assert.ok(ids.indexOf('tools') >= 0);
    assert.ok(ids.indexOf('history') >= 0);
    assert.ok(ids.indexOf('pending') >= 0);
  });
});
