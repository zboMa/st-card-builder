/**
 * 提示词仓库单元测试（Node 内置 test runner）
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PROMPTS,
  PROMPT_BLOCKS,
  PROMPT_META,
  PROMPT_TAB_ORDER,
  PROMPT_STORAGE_KEY,
  applyTemplate,
  createPromptStore,
  listPromptGroups,
} from '../src/lib/promptStore.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function memoryStorage() {
  var map = new Map();
  return {
    getItem: function(k) { return map.has(k) ? map.get(k) : null; },
    setItem: function(k, v) { map.set(k, String(v)); },
    removeItem: function(k) { map.delete(k); },
  };
}

describe('promptStore', function() {
  it('DEFAULT_PROMPTS 覆盖 META 全部 id', function() {
    PROMPT_META.forEach(function(m) {
      assert.ok(DEFAULT_PROMPTS[m.id], 'missing default for ' + m.id);
      assert.ok(String(DEFAULT_PROMPTS[m.id]).length > 0);
    });
  });

  it('描述体系公共块齐全且关键提示已组装', function() {
    ['contentCanon', 'nsfwPersonCanon', 'nsfwWorldCanon', 'inferCanon', 'outputCanon', 'antiSlop', 'adultGate', 'ntlCanon']
      .forEach(function(k) {
        assert.ok(PROMPT_BLOCKS[k] && PROMPT_BLOCKS[k].length > 40, 'block ' + k);
      });
    assert.match(DEFAULT_PROMPTS.charGen, /内容描述体系/);
    assert.match(DEFAULT_PROMPTS.wbSingle, /世界 NSFW|成人维/);
    assert.match(DEFAULT_PROMPTS.novelCharExpand, /人物 NSFW 描述体系|NSFW_information/);
    assert.match(DEFAULT_PROMPTS.novelEnrichEntity, /分步推断|attrs\.adult/);
    assert.match(DEFAULT_PROMPTS.novelAnalyzeSkeleton, /NtlMode|禁忌张力/);
    assert.match(DEFAULT_PROMPTS.novelStyleDistill, /NTL 文风指令|NtlMode/);
    assert.match(DEFAULT_PROMPTS.novelCharSetup, /AdultMode|内容描述体系/);
    assert.match(DEFAULT_PROMPTS.chatRpCore, /Limits|成人向/);
    assert.match(DEFAULT_PROMPTS.assistantSystem, /内容描述体系|NSFW/);
    assert.match(DEFAULT_PROMPTS.assistantSystem, /characterFieldHint|角色字段名/);
    assert.match(DEFAULT_PROMPTS.assistantSystem, /creatorNotes|postHistoryInstructions/);
    var store = createPromptStore(memoryStorage());
    assert.ok(store.BLOCKS && store.BLOCKS.contentCanon);
  });

  it('PROMPT_META 按 Tab 分组且覆盖约定分类', function() {
    var groups = listPromptGroups();
    assert.deepEqual(groups, PROMPT_TAB_ORDER);
    ['角色卡制作', '世界书', '状态栏·MVU', '小说', '小说创作', 'AI 助手'].forEach(function(g) {
      assert.ok(PROMPT_META.some(function(m) { return m.group === g; }), 'missing group ' + g);
    });
    assert.equal(PROMPT_META.find(function(m) { return m.id === 'wbSkeleton'; }).group, '世界书');
    assert.equal(PROMPT_META.find(function(m) { return m.id === 'wbOutline'; }).group, '世界书');
    assert.equal(PROMPT_META.find(function(m) { return m.id === 'wbEnrichFromOutline'; }).group, '世界书');
    assert.equal(PROMPT_META.find(function(m) { return m.id === 'wbCrossLink'; }).group, '世界书');
    assert.equal(PROMPT_META.find(function(m) { return m.id === 'wbAudit'; }).group, '世界书');
    assert.equal(PROMPT_META.find(function(m) { return m.id === 'mvuDesign'; }).group, '状态栏·MVU');
    assert.equal(PROMPT_META.find(function(m) { return m.id === 'charGen'; }).group, '角色卡制作');
    var store = createPromptStore(memoryStorage());
    assert.deepEqual(store.listGroups(), PROMPT_TAB_ORDER);
  });

  it('PromptConfigPanel 使用 ui-tabs 分栏', function() {
    const src = readFileSync(join(root, 'src/components/PromptConfigPanel.astro'), 'utf8');
    assert.match(src, /ui-tabs/);
    assert.match(src, /promptConfigTabs|data-prompt-tab/);
    assert.match(src, /btnPromptResetTab|恢复本页默认/);
    assert.match(src, /draftCache|stashActiveTab/);
  });

  it('无覆盖时 get 回退默认', function() {
    var store = createPromptStore(memoryStorage());
    assert.equal(store.get('charGen'), DEFAULT_PROMPTS.charGen);
  });

  it('set 后优先返回用户值并写入 localStorage key', function() {
    var storage = memoryStorage();
    var store = createPromptStore(storage);
    store.set('charGen', '自定义角色生成');
    assert.equal(store.get('charGen'), '自定义角色生成');
    var raw = JSON.parse(storage.getItem(PROMPT_STORAGE_KEY));
    assert.equal(raw.charGen, '自定义角色生成');
  });

  it('与默认相同的 set 会清除覆盖', function() {
    var storage = memoryStorage();
    var store = createPromptStore(storage);
    store.set('charGen', '临时');
    store.set('charGen', DEFAULT_PROMPTS.charGen);
    var raw = JSON.parse(storage.getItem(PROMPT_STORAGE_KEY) || '{}');
    assert.equal(raw.charGen, undefined);
    assert.equal(store.get('charGen'), DEFAULT_PROMPTS.charGen);
  });

  it('reset 单条 / 全部', function() {
    var store = createPromptStore(memoryStorage());
    store.set('charGen', 'A');
    store.set('wbSingle', 'B');
    store.reset('charGen');
    assert.equal(store.get('charGen'), DEFAULT_PROMPTS.charGen);
    assert.equal(store.get('wbSingle'), 'B');
    store.reset();
    assert.equal(store.get('wbSingle'), DEFAULT_PROMPTS.wbSingle);
  });

  it('applyTemplate 替换占位符', function() {
    assert.equal(
      applyTemplate('产出【{{batchSize}}条】查询「{{query}}」', { batchSize: 5, query: '赛博' }),
      '产出【5条】查询「赛博」'
    );
  });

  it('wbSkeleton 默认含 batchSize 占位且可渲染', function() {
    var store = createPromptStore(null);
    var text = store.applyTemplate(store.get('wbSkeleton'), { batchSize: 6 });
    assert.match(text, /【6条】/);
  });

  it('侧栏相关默认提示词键齐全', function() {
    ['charGen', 'greetingGen', 'charTagsGen', 'wbSkeleton', 'novelExtract', 'novelMerge', 'wbAudit', 'mvuDesign', 'statusBarPaths', 'statusBarCharScan', 'statusBarMvuDesign', 'statusBarCustomLayout', 'chatRpCore',
      'assistantSystem', 'assistantReactHint', 'assistantChatFeedback',
      'novelCharScan', 'novelCharExpand', 'novelWbExtract', 'novelWbExpand', 'novelStyleDistill',
      'novelAnalyzeSkeleton', 'novelEnrichEntity', 'novelAnalyzeRelations',
      'novelCharSetup', 'novelGreetingsGen', 'styleGuide', 'assistantNovelRagHint']
      .forEach(function(id) {
        assert.ok(DEFAULT_PROMPTS[id]);
      });
  });

  it('统一分析提示词含实体与 provenance（含一体分析增强）', function() {
    assert.match(DEFAULT_PROMPTS.novelAnalyzeSkeleton, /entities/);
    assert.match(DEFAULT_PROMPTS.novelAnalyzeSkeleton, /event/);
    assert.match(DEFAULT_PROMPTS.novelAnalyzeSkeleton, /已有实体\/关系/);
    assert.match(DEFAULT_PROMPTS.novelAnalyzeSkeleton, /attrs\.adult|分步推断/);
    assert.match(DEFAULT_PROMPTS.novelEnrichEntity, /无需二次扩展/);
    assert.match(DEFAULT_PROMPTS.novelEnrichEntity, /provenance/);
    assert.match(DEFAULT_PROMPTS.novelEnrichEntity, /attrs\.adult|nsfwMeta/);
    assert.match(DEFAULT_PROMPTS.novelAnalyzeRelations, /已有关系/);
    assert.match(DEFAULT_PROMPTS.assistantNovelRagHint, /相关小说原文|相关实体/);
  });

  it('小说角色设定/开场白提示词要求 JSON 字段', function() {
    assert.match(DEFAULT_PROMPTS.novelCharSetup, /charName/);
    assert.match(DEFAULT_PROMPTS.novelCharSetup, /charDesc/);
    assert.match(DEFAULT_PROMPTS.novelGreetingsGen, /firstMes/);
    assert.match(DEFAULT_PROMPTS.novelGreetingsGen, /altGreetings/);
    assert.match(DEFAULT_PROMPTS.novelGreetingsGen, /\{\{altCount\}\}/);
    assert.match(DEFAULT_PROMPTS.greetingGen, /firstMes/);
    assert.match(DEFAULT_PROMPTS.charGen, /不要输出 firstMes/);
  });

  it('人物扩展提示词含附录1字段与虚构补全规则', function() {
    assert.match(DEFAULT_PROMPTS.novelCharExpand, /Chinese name/);
    assert.match(DEFAULT_PROMPTS.novelCharExpand, /NSFW_information/);
    assert.match(DEFAULT_PROMPTS.novelCharExpand, /turning_points/);
    assert.match(DEFAULT_PROMPTS.novelCharExpand, /合理虚构/);
    assert.match(DEFAULT_PROMPTS.novelCharExpand, /erogenous_zones|xp_kinks|contrast/);
    assert.match(DEFAULT_PROMPTS.novelCharScan, /已扫描人物/);
    assert.match(DEFAULT_PROMPTS.novelCharScan, /aliases 必填|别名/);
    assert.match(DEFAULT_PROMPTS.novelWbExtract, /keys 必填/);
  });

  it('世界书条目扩展提示词要求 JSON content 且可合理补充', function() {
    assert.match(DEFAULT_PROMPTS.novelWbExpand, /content/);
    assert.match(DEFAULT_PROMPTS.novelWbExpand, /合理补充|可指导|attrs\.adult/);
    assert.match(DEFAULT_PROMPTS.novelWbExtract, /nsfw|IncludeAdult/);
    assert.match(DEFAULT_PROMPTS.novelWbExtract, /attrs\.adult|分步推断/);
  });

  it('文风蒸馏含 NSFW/NTL 结构化指导', function() {
    assert.match(DEFAULT_PROMPTS.novelStyleDistill, /NSFW 文风指令/);
    assert.match(DEFAULT_PROMPTS.novelStyleDistill, /敏感点|内心独白|反差/);
    assert.match(DEFAULT_PROMPTS.novelStyleDistill, /NTL 文风指令|NtlMode/);
  });
});
