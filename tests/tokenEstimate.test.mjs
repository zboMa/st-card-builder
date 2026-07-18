/**
 * 助手上下文 token 近似估算
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
} from '../src/lib/assistant/tokenEstimate.mjs';

describe('tokenEstimate', function() {
  it('estimateTokens：空文本为 0', function() {
    assert.equal(estimateTokens(''), 0);
    assert.equal(estimateTokens(null), 0);
  });

  it('estimateTokens：英文 chars × 2', function() {
    assert.equal(estimateTokens('abcd'), 8);
    assert.equal(estimateTokens('hello world'), 22);
  });

  it('estimateTokens：中文同样 chars × 2', function() {
    assert.equal(estimateTokens('你好'), 4);
  });

  it('estimateMessagesTokens 累加各条 content', function() {
    assert.equal(
      estimateMessagesTokens([
        { role: 'user', content: 'abcd' },
        { role: 'assistant', content: 'efgh' },
      ]),
      16,
    );
  });

  it('estimateAssistantContext 分解 system/history/pending', function() {
    var breakdown = estimateAssistantContext({
      systemPrompt: 'abcd',
      historyMessages: [{ content: 'efgh' }],
      pendingInput: 'hi',
    });
    assert.equal(breakdown.system, 8);
    assert.equal(breakdown.history, 8);
    assert.equal(breakdown.pending, 4);
    assert.equal(breakdown.total, 20);
  });

  it('formatTokenCount 与标签文案', function() {
    assert.equal(formatTokenCount(842), '842');
    assert.equal(formatTokenCount(12500), '12.5k');
    assert.equal(formatAssistantContextLabel(842), '上下文 842 tokens');
    assert.match(formatAssistantContextLabel(12500), /≈ 12\.5k tokens/);
  });

  it('formatAssistantContextTitle 含分项', function() {
    var title = formatAssistantContextTitle({ system: 100, history: 200, pending: 50 });
    assert.match(title, /字符数 × 2/);
    assert.match(title, /系统: 100/);
    assert.match(title, /历史: 200/);
    assert.match(title, /待发送: 50/);
  });
});
