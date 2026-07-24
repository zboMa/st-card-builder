/**
 * 助手上下文管理：tiktoken 计数 + 60%/80% 整体压缩
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTEXT_BUDGET,
  countTokens,
  countMessagesTokens,
  softThreshold,
  hardThreshold,
  compressionLevelForTotal,
  truncateToTokens,
  uiMessagesToModelHistory,
  prepareAssistantMessages,
  prepareChatCompletionMessages,
  estimateAssistantContext,
  inputTokenBudget,
} from '../src/lib/assistant/contextManager.mjs';

describe('contextManager budget', function() {
  it('默认 200k / 60% / 80%，并预留回复额度', function() {
    assert.equal(CONTEXT_BUDGET.limit, 200000);
    assert.equal(CONTEXT_BUDGET.softRatio, 0.6);
    assert.equal(CONTEXT_BUDGET.hardRatio, 0.8);
    var budget = inputTokenBudget();
    assert.equal(budget, 200000 - 8192);
    assert.equal(softThreshold(), Math.floor(budget * 0.6));
    assert.equal(hardThreshold(), Math.floor(budget * 0.8));
  });

  it('compressionLevelForTotal 分档', function() {
    assert.equal(compressionLevelForTotal(0), 'none');
    assert.equal(compressionLevelForTotal(softThreshold()), 'soft');
    assert.equal(compressionLevelForTotal(hardThreshold()), 'hard');
  });
});

describe('contextManager tiktoken', function() {
  it('countTokens 非 chars×2', function() {
    // cl100k：短英文常少于 chars×2
    assert.ok(countTokens('hello world') > 0);
    assert.notEqual(countTokens('hello world'), String('hello world').length * 2);
    assert.equal(countTokens(''), 0);
    assert.equal(countTokens(null), 0);
  });

  it('truncateToTokens 按 token 截断', function() {
    var long = '角色设定。'.repeat(200);
    var out = truncateToTokens(long, 20);
    assert.ok(countTokens(out) <= 28); // 截断标记留余量
    assert.match(out, /已按 token 截断/);
  });

  it('countMessagesTokens 含条目标开销', function() {
    var one = countTokens('abcd');
    var n = countMessagesTokens([{ role: 'user', content: 'abcd' }]);
    assert.equal(n, one + CONTEXT_BUDGET.messageOverhead);
  });
});

describe('contextManager prepare', function() {
  it('uiMessagesToModelHistory 工具结果不盲切 1200 字符', function() {
    var fat = 'X'.repeat(5000);
    var hist = uiMessagesToModelHistory([
      { role: 'user', content: '加开场白', modelContent: '加开场白' },
      {
        role: 'tool',
        toolName: 'get_character_fields',
        summary: '读取角色',
        detail: fat,
      },
    ]);
    var toolMsg = hist.find(function(m) { return m.meta && m.meta.kind === 'tool'; });
    assert.ok(toolMsg);
    assert.ok(toolMsg.content.indexOf(fat) >= 0);
    assert.ok(toolMsg.content.length > 1200);
  });

  it('assistant 送模用 modelContent 原样，UI content 可为人读摘要', function() {
    var raw = '{"thought":"写开场","tool":"update_character_fields","args":{"fields":{"altGreetings":["苏有容在后宫"]}}}';
    var hist = uiMessagesToModelHistory([
      { role: 'user', content: '添加一条备用开场白', modelContent: '添加一条备用开场白' },
      {
        role: 'assistant',
        content: '💭 写开场',
        displayContent: '💭 写开场',
        modelContent: raw,
      },
    ]);
    assert.equal(hist.length, 2);
    assert.equal(hist[1].role, 'assistant');
    assert.equal(hist[1].content, raw);
    assert.equal(hist[1].meta.kind, 'assistant');
  });

  it('低用量不压缩', function() {
    var prepared = prepareAssistantMessages({
      systemPrompt: 'sys',
      uiMessages: [
        { role: 'user', content: 'hi', modelContent: 'hi' },
        { role: 'assistant', content: 'ok' },
      ],
    });
    assert.equal(prepared.level, 'none');
    assert.ok(prepared.messages[0].role === 'system');
    assert.ok(prepared.breakdown.total < softThreshold());
  });

  it('超软阈值时压缩旧工具正文', function() {
    var prevLimit = CONTEXT_BUDGET.limit;
    var prevReserve = CONTEXT_BUDGET.reserveReply;
    CONTEXT_BUDGET.limit = 8000;
    CONTEXT_BUDGET.reserveReply = 500;
    try {
      var fat = '角色描述段落。'.repeat(400);
      var tools = [];
      for (var i = 0; i < 5; i++) {
        tools.push({
          role: 'tool',
          toolName: 'get_character_fields',
          summary: '读取角色字段 #' + i,
          detail: fat,
        });
      }
      var prepared = prepareAssistantMessages({
        systemPrompt: 'system prompt for assistant',
        uiMessages: [{ role: 'user', content: '任务', modelContent: '任务' }].concat(tools),
      });
      assert.ok(prepared.level === 'soft' || prepared.level === 'hard');
      var joined = prepared.messages.map(function(m) { return m.content; }).join('\n');
      assert.match(joined, /工具结果·压缩|工具结果·摘要/);
      assert.ok(prepared.breakdown.total <= inputTokenBudget());
    } finally {
      CONTEXT_BUDGET.limit = prevLimit;
      CONTEXT_BUDGET.reserveReply = prevReserve;
    }
  });

  it('estimateAssistantContext 暴露档位与阈值', function() {
    var b = estimateAssistantContext({
      systemPrompt: 'a',
      uiMessages: [{ role: 'user', content: 'b', modelContent: 'b' }],
      pendingInput: 'c',
    });
    assert.ok(b.budget > 0);
    assert.ok(b.softAt > 0);
    assert.ok(b.hardAt > b.softAt);
    assert.equal(b.level, 'none');
  });
});

describe('prepareChatCompletionMessages（试聊共用）', function() {
  it('短对话不压缩', function() {
    var prepared = prepareChatCompletionMessages([
      { role: 'system', content: 'You are a character.' },
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '你好呀' },
    ]);
    assert.equal(prepared.level, 'none');
    assert.equal(prepared.messages.length, 3);
    assert.ok(prepared.breakdown.total > 0);
  });

  it('超软阈值时压缩较早长消息', function() {
    var fat = '剧情描述。'.repeat(500);
    var msgs = [{ role: 'system', content: 'sys' }];
    for (var i = 0; i < 10; i++) {
      msgs.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: fat });
    }
    var prepared = prepareChatCompletionMessages(msgs, {
      limit: 8000,
      reserveReply: 500,
    });
    assert.ok(prepared.level === 'soft' || prepared.level === 'hard');
    assert.ok(prepared.breakdown.total <= prepared.breakdown.budget);
    // 前缀 system 仍在
    assert.equal(prepared.messages[0].role, 'system');
  });
});
