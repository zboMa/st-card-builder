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
import { DEFAULT_PROMPTS } from '../src/lib/promptCanon.mjs';

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

  it('buildAssistantContextSections 支持 catalog 子分区与 note', function() {
    var secs = buildAssistantContextSections({
      systemPrompt: 'sys {{toolList}}',
      systemNote: '原始模板',
      toolList: 'tools',
      toolNote: '并入 system',
      catalogBlocks: [
        { kind: 'flavors', label: '口味 NSFW', count: 3, body: '■ 口味\n·组：\n  id · 标签 — 摘要' },
        { kind: 'ntl', label: 'NTL 禁忌', count: 2, body: '■ NTL\n·组：' },
      ],
      catalogNote: '紧凑索引',
      characterFieldHint: 'hint',
      historyMessages: [{ role: 'user', content: 'a' }],
      ragBody: '【相关小说原文】\n片段',
      ragNote: '绑定到历史第 1 条',
    });
    var catalog = secs.find(function(s) { return s.id === 'catalog'; });
    assert.ok(catalog, '应含 catalog 分区');
    assert.ok(Array.isArray(catalog.children) && catalog.children.length === 2, 'catalog 应拆 2 个子分区');
    assert.equal(catalog.children[0].title, '口味 NSFW（3 条）');
    assert.ok(catalog.note.indexOf('紧凑索引') >= 0);
    assert.ok(catalog.tokens > 0);
    var system = secs.find(function(s) { return s.id === 'system'; });
    assert.ok(system.note.indexOf('原始模板') >= 0);
    var rag = secs.find(function(s) { return s.id === 'rag'; });
    assert.ok(rag.note.indexOf('第 1 条') >= 0);
    // 空分区（pending 无值）不出现
    assert.ok(secs.every(function(s) { return s.id !== 'pending'; }));
  });

  it('catalogRepeat>1 时目录 token 按送模份数计且 note 标注', function() {
    var blocks = [
      { kind: 'flavors', label: '口味 NSFW', count: 1, body: '■ 口味\n内容A' },
    ];
    var once = buildAssistantContextSections({ catalogBlocks: blocks, catalogNote: '' });
    var cat = once.find(function(s) { return s.id === 'catalog'; });
    assert.equal(cat.tokens, countTokens('■ 口味\n内容A'));
    assert.ok(cat.note.indexOf('×2') < 0);

    var twice = buildAssistantContextSections({ catalogBlocks: blocks, catalogRepeat: 2, catalogNote: '索引' });
    var cat2 = twice.find(function(s) { return s.id === 'catalog'; });
    assert.equal(cat2.tokens, countTokens('■ 口味\n内容A') * 2, '真实送模应为 2 份');
    assert.ok(cat2.note.indexOf('模板引用 {{catalogOverview}} 2 次') >= 0);
    assert.equal(cat2.children.length, 1, 'children 仍展示单份内容');
  });

  it('默认 assistantSystem 模板中注入变量各只出现 1 次（防重复注入）', function() {
    var sys = DEFAULT_PROMPTS.assistantSystem || '';
    ['{{catalogOverview}}', '{{toolList}}', '{{characterFieldHint}}', '{{buildGuide}}'].forEach(function(v) {
      var c = (String(sys).match(new RegExp(v.replace(/[{}]/g, '\\$&'), 'g')) || []).length;
      assert.equal(c, 1, v + ' 应只出现一次（当前 ' + c + ' 次）');
    });
  });

  it('默认 assistantBuildGuide 独立可编辑且符合引导原则', function() {
    var g = DEFAULT_PROMPTS.assistantBuildGuide || '';
    assert.ok(g.indexOf('建卡引导') >= 0, '应含引导标题');
    assert.ok(g.indexOf('探测工具') >= 0, '维度清单应降级为探测工具');
    assert.ok(g.indexOf('先发散后收敛') >= 0, '应含发散优先');
    assert.ok(g.indexOf('你来设计') >= 0, '应含创作委托触发词');
    assert.ok(g.indexOf('提案') >= 0, '创意补全应标注为提案');
    assert.ok(g.indexOf('一句话卡') >= 0, '应含极简/快出出口');
    assert.ok(g.indexOf('{{') < 0, '引导块不应含待替换变量');
  });

  it('buildAssistantContextSections 含 guide 分区', function() {
    var secs = buildAssistantContextSections({
      systemPrompt: 'sys',
      buildGuide: '建卡引导内容',
      guideNote: '独立编辑',
    });
    var guide = secs.find(function(s) { return s.id === 'guide'; });
    assert.ok(guide, '应含 guide 分区');
    assert.ok(guide.tokens > 0);
    assert.ok(guide.note.indexOf('独立编辑') >= 0);
  });
});
