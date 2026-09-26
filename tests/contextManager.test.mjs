/**
 * 助手上下文管理：tiktoken 计数、送模面与检查点
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
  planCompactionSpan,
  makeCheckpointMessage,
  COMPACTION_KEEP_TOKENS,
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

  it('跳过助手错误气泡，工具错误仍送模', function() {
    var hist = uiMessagesToModelHistory([
      { role: 'user', content: '改开场白', modelContent: '改开场白' },
      { role: 'assistant', content: '错误：Failed to fetch', error: true, retryable: true },
      {
        role: 'tool',
        toolName: 'update_character_fields',
        summary: '写入失败',
        detail: '桥接未就绪',
        error: true,
      },
    ]);
    assert.equal(hist.length, 2);
    assert.equal(hist[0].role, 'user');
    assert.equal(hist[1].meta.kind, 'tool');
    assert.equal(hist[1].meta.error, true);
    assert.match(hist[1].content, /工具结果·失败/);
    assert.match(hist[1].content, /桥接未就绪/);
    assert.ok(!hist.some(function(m) { return /Failed to fetch/.test(m.content); }));
  });

  it('工具结果不把调用参数再送一遍，执行中的卡片不送模', function() {
    var instruction = '编写世界书人物条目：' + '李清露。'.repeat(40);
    var hist = uiMessagesToModelHistory([
      {
        role: 'tool',
        toolName: 'generate_worldbook_entry',
        summary: '{"added":1}… · 点击展开',
        detail: '{"added":1,"total":11}',
        modelDetail: '调用: generate_worldbook_entry\n参数: {"instruction":"' + instruction + '"}\n返回: {"added":1}',
        running: false,
      },
      {
        role: 'tool',
        toolName: 'generate_worldbook_entry',
        summary: '执行中…',
        running: true,
      },
    ]);
    assert.equal(hist.length, 1);
    assert.match(hist[0].content, /工具结果·成功/);
    assert.match(hist[0].content, /生成世界书条目|读取/);
    assert.ok(hist[0].content.indexOf(instruction) < 0);
    assert.ok(!/点击展开/.test(hist[0].content));
    assert.match(hist[0].content, /"added":1/);
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

  it('超硬阈值标记需要检查点，不在发送时把工具结果重写成压缩稿', function() {
    var prevLimit = CONTEXT_BUDGET.limit;
    var prevReserve = CONTEXT_BUDGET.reserveReply;
    CONTEXT_BUDGET.limit = 8000;
    CONTEXT_BUDGET.reserveReply = 500;
    try {
      var fat = '角色描述段落。'.repeat(400);
      var msgs = [{ role: 'user', content: '任务', modelContent: '任务' }];
      for (var i = 0; i < 4; i++) {
        msgs.push({ role: 'assistant', content: '调用工具 ' + i, modelContent: '调用工具 ' + i });
        msgs.push({
          role: 'tool',
          toolName: 'get_character_fields',
          summary: '读取角色字段 #' + i,
          detail: fat,
        });
      }
      var prepared = prepareAssistantMessages({
        systemPrompt: 'system prompt for assistant',
        uiMessages: msgs,
      });
      assert.equal(prepared.needsCompaction, true);
      var joined = prepared.messages.map(function(m) { return m.content; }).join('\n');
      assert.ok(!/工具结果·压缩/.test(joined));
      assert.ok(prepared.breakdown.total <= inputTokenBudget());
      var span = planCompactionSpan(msgs);
      assert.ok(span);
      assert.ok(span.head.length > 0);
      assert.ok(span.insertAt > 0 && span.insertAt < msgs.length);
      msgs.splice(span.insertAt, 0, makeCheckpointMessage('已写入若干角色字段。'));
      var after = estimateAssistantContext({
        systemPrompt: 'system prompt for assistant',
        uiMessages: msgs,
      });
      assert.equal(after.compacted, true);
      var surface = uiMessagesToModelHistory(msgs.slice(span.insertAt));
      assert.match(surface[0].content, /上下文检查点/);
      assert.match(surface[0].content, /已写入若干角色字段/);
      assert.ok(surface[0].content.indexOf(fat) < 0);
      assert.ok(COMPACTION_KEEP_TOKENS > 0);
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
