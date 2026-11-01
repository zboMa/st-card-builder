/**
 * 助手重试：不追加用户消息；无工具从 step 0，有工具轨迹则续接
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { planAssistantRetry, isRetryableAssistantError, isTailRetryTarget, isTailRegenerateTarget, planAssistantReroll, planApplyOutcome } from '../src/lib/assistant/retryTurn.mjs';

describe('planAssistantRetry', function() {
  it('该用户消息之后只有可重试错误：删错误，从 step 0', function() {
    var plan = planAssistantRetry([
      { role: 'user', content: '上一轮' },
      { role: 'assistant', content: '好的' },
      { role: 'user', content: '写开场白' },
      { role: 'assistant', content: '错误：Failed to fetch', error: true, retryable: true },
    ]);
    assert.ok(plan);
    assert.equal(plan.mode, 'restart');
    assert.equal(plan.startStep, 0);
    assert.equal(plan.userText, '写开场白');
    assert.equal(plan.toolCount, 0);
    assert.equal(plan.nextMessages.length, 3);
    assert.equal(plan.nextMessages[2].content, '写开场白');
    assert.ok(!plan.nextMessages.some(function(m) { return m.error && m.retryable; }));
  });

  it('已有工具轨迹：保留轨迹，从工具结果续接，并去掉可重试错误', function() {
    var tool = {
      role: 'tool',
      toolName: 'update_character_fields',
      summary: '已写入',
      detail: 'ok',
    };
    var plan = planAssistantRetry([
      { role: 'user', content: '把描述写长' },
      { role: 'assistant', content: '💭 调用工具 update_character_fields' },
      tool,
      { role: 'assistant', content: '错误：Failed to fetch', error: true, retryable: true },
    ]);
    assert.equal(plan.mode, 'continue');
    assert.equal(plan.startStep, 1);
    assert.equal(plan.toolCount, 1);
    assert.equal(plan.nextMessages.length, 3);
    assert.equal(plan.nextMessages[1].role, 'assistant');
    assert.equal(plan.nextMessages[2], tool);
    assert.equal(plan.userText, '把描述写长');
  });

  it('撤销失败不是可重试错误，重试规划不会把它当成要删的红条', function() {
    var undo = { role: 'assistant', content: '撤销失败：没有快照', error: true };
    var plan = planAssistantRetry([
      { role: 'user', content: '改名字' },
      { role: 'tool', toolName: 'update_character_fields', summary: '已改' },
      undo,
    ]);
    assert.equal(plan.mode, 'continue');
    assert.equal(plan.nextMessages[plan.nextMessages.length - 1], undo);
    assert.equal(isRetryableAssistantError(undo), false);
    assert.equal(isRetryableAssistantError({
      role: 'assistant',
      content: '应用失败: 写入被拒绝',
      error: true,
    }), false);
  });

  it('旧会话半角「错误:」且没有 retryable，仍视为可重试并删掉', function() {
    var old = { role: 'assistant', content: '错误: Failed to fetch', error: true };
    assert.equal(isRetryableAssistantError(old), true);
    assert.equal(isRetryableAssistantError({
      role: 'assistant',
      content: '错误：Failed to fetch',
      error: true,
    }), true);
    var plan = planAssistantRetry([
      { role: 'user', content: '写开场白' },
      old,
    ]);
    assert.equal(plan.mode, 'restart');
    assert.equal(plan.startStep, 0);
    assert.equal(plan.nextMessages.length, 1);
    assert.equal(plan.nextMessages[0].content, '写开场白');
  });

  it('多条工具按次数续接；没有用户消息则不能重试', function() {
    var plan = planAssistantRetry([
      { role: 'user', content: '整理世界书' },
      { role: 'tool', toolName: 'get_worldbook_list' },
      { role: 'tool', toolName: 'update_worldbook_entry' },
      { role: 'assistant', content: '错误：网络中断', error: true, retryable: true },
    ]);
    assert.equal(plan.startStep, 2);
    assert.equal(plan.mode, 'continue');
    assert.equal(planAssistantRetry([]), null);
    assert.equal(planAssistantRetry([{ role: 'assistant', content: '只有助手' }]), null);
  });

  it('检查点之前的工具不计入续接步数', function() {
    var plan = planAssistantRetry([
      { role: 'user', content: '逐条写世界书' },
      { role: 'tool', toolName: 'generate_worldbook_entry' },
      { role: 'tool', toolName: 'generate_worldbook_entry' },
      { role: 'compaction', compaction: true, ok: true, content: '上下文已压缩', modelContent: '已写两条' },
      { role: 'tool', toolName: 'generate_worldbook_entry' },
      { role: 'assistant', content: '错误：Failed to fetch', error: true, retryable: true },
    ]);
    assert.equal(plan.toolCount, 1);
    assert.equal(plan.startStep, 1);
    assert.equal(plan.mode, 'continue');
  });
});

describe('isTailRetryTarget', function() {
  it('只有最后一条可重试错误能重试', function() {
    var earlier = { role: 'assistant', content: '错误：请求失败 HTTP 400', error: true, retryable: true };
    var laterUser = { role: 'user', content: '用户要求重新检查' };
    var list = [
      { role: 'user', content: '写开场白' },
      earlier,
      laterUser,
    ];
    assert.equal(isTailRetryTarget(list, 1), false);
    assert.equal(isTailRetryTarget(list, 2), false);
    var tail = list.concat([{ role: 'assistant', content: '错误：请求失败 HTTP 400', error: true, retryable: true }]);
    assert.equal(isTailRetryTarget(tail, 1), false);
    assert.equal(isTailRetryTarget(tail, tail.length - 1), true);
  });
});

describe('isTailRegenerateTarget', function() {
  it('只有最后一条正常回复可重新生成', function() {
    var list = [
      { role: 'user', content: '写开场白' },
      { role: 'assistant', content: '这是最终回复' },
    ];
    assert.equal(isTailRegenerateTarget(list, 1), true);
    assert.equal(isTailRegenerateTarget(list, 0), false);
    // 错误红条走重试，不显示重新生成
    assert.equal(isTailRegenerateTarget([
      { role: 'user', content: '写开场白' },
      { role: 'assistant', content: '错误：Failed to fetch', error: true, retryable: true },
    ], 1), false);
    // 工具轨迹 / 空文本不算
    assert.equal(isTailRegenerateTarget([
      { role: 'user', content: 'x' },
      { role: 'tool', toolName: 'get_worldbook_list' },
    ], 1), false);
    assert.equal(isTailRegenerateTarget([
      { role: 'user', content: 'x' },
      { role: 'assistant', content: '' },
    ], 1), false);
  });
});

describe('planAssistantReroll', function() {
  it('无工具：丢掉最后一条正常回复，从 step 0 重跑', function() {
    var plan = planAssistantReroll([
      { role: 'user', content: '上一轮' },
      { role: 'assistant', content: '旧回复' },
      { role: 'user', content: '写开场白' },
      { role: 'assistant', content: '内容不对的回复' },
    ]);
    assert.ok(plan);
    assert.equal(plan.mode, 'restart');
    assert.equal(plan.startStep, 0);
    assert.equal(plan.userText, '写开场白');
    assert.equal(plan.droppedReply, true);
    assert.ok(!plan.nextMessages.some(function(m) { return m.content === '内容不对的回复'; }));
    assert.ok(plan.nextMessages.some(function(m) { return m.content === '旧回复'; }));
    assert.equal(plan.nextMessages[plan.nextMessages.length - 1].content, '写开场白');
  });

  it('有工具轨迹：保留轨迹与 thought，只丢最终回复，从工具结果续写', function() {
    var tool = { role: 'tool', toolName: 'rewrite_greeting', summary: '已写入' };
    var plan = planAssistantReroll([
      { role: 'user', content: '重写开场白' },
      { role: 'assistant', content: '💭 调用工具 rewrite_greeting' },
      tool,
      { role: 'assistant', content: '不理想的最终回复' },
    ]);
    assert.equal(plan.mode, 'continue');
    assert.equal(plan.startStep, 1);
    assert.equal(plan.toolCount, 1);
    assert.equal(plan.droppedReply, true);
    assert.ok(!plan.nextMessages.some(function(m) { return m.content === '不理想的最终回复'; }));
    assert.ok(plan.nextMessages.some(function(m) { return m === tool; }));
    assert.ok(plan.nextMessages.some(function(m) { return m.content === '💭 调用工具 rewrite_greeting'; }));
  });

  it('没有可丢的回复 / 没有用户消息时降级', function() {
    var onlyUser = planAssistantReroll([
      { role: 'user', content: '写开场白' },
    ]);
    assert.equal(onlyUser.mode, 'restart');
    assert.equal(onlyUser.droppedReply, false);
    assert.equal(onlyUser.userText, '写开场白');
    assert.equal(planAssistantReroll([]), null);
    assert.equal(planAssistantReroll([{ role: 'assistant', content: '只有助手' }]), null);
  });
});

describe('planApplyOutcome', function() {
  it('成功才续接；抛错留卡；业务失败结束本轮', function() {
    assert.equal(planApplyOutcome({ threw: false, ok: true }), 'resume');
    assert.equal(planApplyOutcome({ threw: true, ok: false }), 'reopen');
    assert.equal(planApplyOutcome({ threw: true, ok: true }), 'reopen');
    assert.equal(planApplyOutcome({ threw: false, ok: false }), 'stop');
    assert.equal(planApplyOutcome({ threw: false, ok: false, error: '这是长正文，不要写进 update_character_fields 的参数。' }), 'resume');
    assert.equal(planApplyOutcome({ threw: false, ok: false, error: '请勾选主角或至少一名角色' }), 'resume');
    assert.equal(planApplyOutcome({ threw: false, ok: false, error: '请先生成变量' }), 'resume');
    assert.equal(planApplyOutcome({ threw: true, ok: false, error: 'API HTTP 400' }), 'reopen');
    assert.equal(planApplyOutcome(null), 'stop');
  });
});
