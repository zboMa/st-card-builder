/**
 * AI 助手核心路径：工具注册、风险分级、ReAct 解析、定向修改、小说/多卡/MVU、撤销
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  ASSISTANT_TOOLS,
  ASSISTANT_PRESET_CHIPS,
  getToolByName,
  formatToolsForPrompt,
  VALID_VIEWS,
} from '../src/lib/assistant/tools.mjs';
import { classifyToolRisk, buildChangePreview } from '../src/lib/assistant/risk.mjs';
import { parseReactStep, extractJsonObject } from '../src/lib/assistant/reactParse.mjs';
import {
  createToolExecutor,
  resolveWorldbookIndex,
  normalizeTarget,
} from '../src/lib/assistant/executor.mjs';
import {
  createAssistantSessionStore,
  createSnapshotStack,
  ASSISTANT_SESSION_KEY,
} from '../src/lib/assistant/session.mjs';
import { DEFAULT_PROMPTS, PROMPT_META } from '../src/lib/promptStore.mjs';
import {
  summarizeToolTrace,
  summarizePendingConfirm,
  buildToolUiMessage,
  toolMessageSummary,
} from '../src/lib/assistant/toolTraceSummary.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readCardManagerSources(base) {
  return [
    'cardManager.mjs',
    'cardManagerShared.mjs',
    'cardManagerRender.mjs',
    'cardManagerCrud.mjs',
    'cardManagerPublishShare.mjs',
    'cardManagerCloud.mjs',
    'cardManagerExport.mjs',
    'cardManagerBind.mjs',
  ].map(function (f) {
    return readFileSync(join(base, 'src/lib/card-builder/panels', f), 'utf8');
  }).join('');
}

function memoryStorage() {
  var map = new Map();
  return {
    getItem: function(k) { return map.has(k) ? map.get(k) : null; },
    setItem: function(k, v) { map.set(k, String(v)); },
    removeItem: function(k) { map.delete(k); },
  };
}

function mockBridge(seed) {
  var state = {
    character: Object.assign({
      charName: '测试', charDesc: '短', firstMes: '你好', creatorNotes: '',
      wbName: '', tags: [], altGreetings: ['备选甲', '备选乙'],
    }, (seed && seed.character) || {}),
    worldbook: ((seed && seed.worldbook) || []).slice(),
    mvu: { design: { variables: [{ path: 'stat.hp', label: 'HP' }] } },
    novel: {
      available: true,
      draftCount: 0,
      chapters: [{ id: 'ch1', title: '第一章', enabled: true }],
      characters: [{ id: 'c1', name: '林月', profile: { 'Chinese name': '林月' } }],
      wbEntries: [{ name: '青云宗', content: '短设定', keys: ['青云'] }],
      novelBucket: { sourceText: '原文', chapters: [] },
    },
    cards: [{ id: 'draft_a', name: '卡A', current: true }, { id: 'draft_b', name: '卡B', current: false }],
    engine: { skeletonCount: 6 },
    opened: null,
    snapshots: [],
  };
  return {
    state: state,
    getCharacter: function() { return Object.assign({}, state.character, { altGreetings: (state.character.altGreetings || []).slice() }); },
    setCharacter: function(f) {
      Object.assign(state.character, f || {});
      if (Array.isArray(f && f.altGreetings)) state.character.altGreetings = f.altGreetings.slice();
    },
    getWorldbook: function() { return state.worldbook.slice(); },
    setWorldbook: function(e) { state.worldbook = (e || []).slice(); },
    getMvu: function() { return state.mvu; },
    upsertMvu: function(d) { state.mvu.design = d; return { count: (d.variables || []).length }; },
    upsertMvuDesign: function(p) {
      state.mvu.design = (p && p.design) || p;
      return { count: (state.mvu.design.variables || []).length, inject: false };
    },
    upsertMvuVariables: function(p) {
      state.mvu.design = (p && p.design) || p;
      return { count: (state.mvu.design.variables || []).length, inject: true };
    },
    clearMvu: function() { state.mvu.design = null; return { cleared: true }; },
    patchMvuNode: function(opts) {
      var vars = (state.mvu.design && state.mvu.design.variables) || [];
      var i = vars.findIndex(function(v) { return v.path === opts.path; });
      if (i < 0) throw new Error('no node');
      vars[i] = Object.assign({}, vars[i], opts.patch || {});
      return { path: opts.path };
    },
    getNovel: function() { return state.novel; },
    listNovelOutputs: function() {
      return { characters: state.novel.characters, worldbook: [], styleLen: 0 };
    },
    setNovelSource: function(p) {
      state.novel.sourceLen = String((p && p.text) || '').length;
      state.novel.novelBucket.sourceText = (p && p.text) || '';
      return state.novel;
    },
    runNovelExtract: async function(opts) {
      var mode = (opts && opts.mode) || 'characters';
      // 模拟真 await（禁止 started-only）
      if (mode === 'split') return { mode: 'split', chapterCount: 3 };
      if (mode === 'worldbook') return { mode: 'worldbook', draftCount: 2 };
      if (mode === 'style') return { mode: 'style', styleLen: 120 };
      return { mode: 'characters', characterCount: 2 };
    },
    patchNovelChapters: function(opts) {
      return { action: opts.action, chapterCount: 1 };
    },
    mutateNovelCharacter: async function(opts) {
      var t = opts.target || opts;
      var ch = state.novel.characters.find(function(c) {
        return c.id === t.id || c.name === t.name;
      });
      if (!ch) throw new Error('人物未找到');
      return { id: ch.id, name: ch.name, mode: opts.mode || 'expand' };
    },
    expandNovelWorldbook: async function(opts) {
      var t = opts.target || opts;
      var list = state.novel.wbEntries || [];
      var idx = t.index != null ? Number(t.index) : list.findIndex(function(e) {
        return e.name === t.name || e.comment === t.name;
      });
      if (idx < 0 || !list[idx]) throw new Error('世界书条目未找到');
      return { index: idx, name: list[idx].name, mode: opts.mode || 'expand' };
    },
    syncNovelOutputs: function(opts) {
      return { target: (opts && opts.target) || 'worldbook', applied: 1, policy: (opts && opts.policy) || 'merge' };
    },
    applyNovel: function(opts) { return this.syncNovelOutputs(opts); },
    getExportPreview: function() {
      return { name: state.character.charName, worldbookCount: state.worldbook.length };
    },
    exportCardCheck: function() {
      return { ok: true, issues: [], note: '仅校验，不触发下载' };
    },
    auditWorldbook: function() {
      var noKeys = state.worldbook.filter(function(e) { return !e.keys || !e.keys.length; }).length;
      var skeleton = state.worldbook.filter(function(e) { return String(e.content || '').length < 60; }).length;
      return { issues: [], total: state.worldbook.length, noKeys: noKeys, skeleton: skeleton };
    },
    lintCard: function() {
      var issues = [];
      if (!state.character.charName) issues.push({ level: 'critical', code: 'no_name', message: 'no name' });
      if (String(state.character.charDesc || '').length < 80) {
        issues.push({ level: 'warning', code: 'short_desc', message: '角色描述偏短' });
      }
      return { ok: issues.filter(function(x) { return x.level === 'critical'; }).length === 0, issues: issues };
    },
    getChatFeedback: function() {
      return { messages: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'ok' }], started: true };
    },
    analyzeChatFeedback: async function() {
      return {
        source: 'llm',
        issues: [{ type: 'thin_desc', message: '人设偏薄' }],
        fixes: [{ tool: 'expand_character_field', args: { field: 'charDesc', mode: 'expand' } }],
      };
    },
    openModule: function(v) { state.opened = v; },
    listCards: function() { return { currentId: 'draft_a', cards: state.cards }; },
    manageCard: async function(action, args) {
      if (action === 'rename_card') return { ok: true, id: args.id || 'draft_a', name: args.name };
      if (action === 'create_card') return { id: 'draft_new', name: args.name || '未命名' };
      if (action === 'switch_card') return { id: args.id || 'draft_b', name: '卡B' };
      if (action === 'delete_card') return { ok: true, deleted: args.id };
      if (action === 'duplicate_card') return { id: 'draft_dup', name: '副本' };
      if (action === 'import_card') return { id: 'draft_imp', name: '导入' };
      throw new Error('unknown ' + action);
    },
    getEngineOptions: function() { return Object.assign({ note: '不含 API Key' }, state.engine); },
    setEngineOptions: function(o) {
      if (o.skeletonCount != null) state.engine.skeletonCount = o.skeletonCount;
      return { skeleton: { skeletonCount: state.engine.skeletonCount } };
    },
    getPromptIds: function() { return { ids: Object.keys(DEFAULT_PROMPTS) }; },
    generateCharacter: async function() { return { charName: '生成' }; },
    generateSkeleton: async function() { return { added: 1 }; },
    generateWorldbookEntry: async function() {
      state.worldbook.push({ comment: '新条', content: '内容足够长的设定文本', keys: ['k'] });
      return { added: 1, total: state.worldbook.length };
    },
    organizeWorldbook: async function(opts) {
      return { applied: opts.apply !== false, preview: [{ index: 0, depth: 2 }], appliedCount: 1 };
    },
    batchFillWorldbookKeys: async function() {
      state.worldbook.forEach(function(e) {
        if (!e.keys || !e.keys.length) e.keys = ['补键'];
      });
      return { updated: 1, targets: 1 };
    },
    mutateWorldbookEntry: async function(opts) {
      var idx = resolveWorldbookIndex(state.worldbook, opts);
      if (idx < 0) throw new Error('条目未找到');
      state.worldbook[idx] = Object.assign({}, state.worldbook[idx], {
        content: (state.worldbook[idx].content || '') + '【' + (opts.mode || 'expand') + '】',
      });
      return { index: idx, comment: state.worldbook[idx].comment, mode: opts.mode };
    },
    expandEntry: async function(opts) {
      return this.mutateWorldbookEntry(Object.assign({}, opts, { mode: 'expand' }));
    },
    expandCharacterField: async function(opts) {
      state.character[opts.field] = '扩写后的' + opts.field + (opts.instruction || '');
      return { field: opts.field, length: state.character[opts.field].length };
    },
    mutateGreeting: async function(opts) {
      var mode = opts.mode || 'rewrite';
      if (opts.target === 'main' || opts.target == null) {
        state.character.firstMes = mode + '-主开场';
        return { target: 'main', mode: mode };
      }
      var ai = typeof opts.target === 'object' ? opts.target.alternate : opts.target;
      state.character.altGreetings[ai] = mode + '-备选' + ai;
      return { target: { alternate: ai }, mode: mode };
    },
    captureSnapshot: function() {
      return {
        character: Object.assign({}, state.character, { altGreetings: (state.character.altGreetings || []).slice() }),
        worldbook: state.worldbook.slice(),
        novel: JSON.parse(JSON.stringify(state.novel.novelBucket)),
      };
    },
    restoreSnapshot: function(s) {
      state.character = Object.assign({}, s.character);
      state.worldbook = (s.worldbook || []).slice();
      if (s.novel) state.novel.novelBucket = s.novel;
    },
  };
}

describe('assistant tools registry', function() {
  it('工具名唯一且可查询', function() {
    var names = ASSISTANT_TOOLS.map(function(t) { return t.name; });
    assert.equal(new Set(names).size, names.length);
    [
      'generate_worldbook_entry', 'organize_worldbook', 'batch_fill_worldbook_keys',
      'rewrite_worldbook_entry', 'fix_from_lint',
      'novel_split_chapters', 'novel_patch_chapters', 'novel_expand_character',
      'novel_rewrite_character', 'novel_expand_worldbook', 'novel_sync_outputs',
      'list_cards', 'switch_card', 'create_card', 'clear_mvu', 'patch_mvu_node',
      'rewrite_greeting', 'expand_greeting', 'expand_character_field',
      'get_engine_options', 'set_engine_options', 'export_card_check',
    ].forEach(function(n) {
      assert.ok(getToolByName(n), 'missing tool ' + n);
    });
    // 硬性约束：无头像、无代导出下载
    assert.equal(getToolByName('set_avatar'), null);
    assert.equal(getToolByName('export_card'), null);
    assert.equal(getToolByName('download_card'), null);
  });

  it('formatToolsForPrompt 包含定向与小说工具', function() {
    var text = formatToolsForPrompt();
    assert.match(text, /rewrite_worldbook_entry/);
    assert.match(text, /delete_worldbook_entry.*all:true/);
    assert.match(text, /novel_expand_character/);
    assert.match(text, /novel_expand_worldbook/);
    assert.match(text, /rewrite_greeting/);
    assert.match(text, /fix_from_lint/);
  });

  it('预设 chips 挂真实工具', function() {
    assert.ok(ASSISTANT_PRESET_CHIPS.length >= 5);
    var withTool = ASSISTANT_PRESET_CHIPS.filter(function(c) { return c.tool; });
    assert.ok(withTool.length >= 4);
    assert.ok(ASSISTANT_PRESET_CHIPS.some(function(c) { return c.id === 'setup_card'; }));
    assert.ok(ASSISTANT_PRESET_CHIPS.some(function(c) { return c.id === 'start_generate'; }));
    assert.ok(ASSISTANT_PRESET_CHIPS.some(function(c) { return c.tool === 'batch_fill_worldbook_keys'; }));
    assert.ok(ASSISTANT_PRESET_CHIPS.some(function(c) { return c.tool === 'fix_from_lint'; }));
  });

  it('VALID_VIEWS 覆盖侧栏主模块', function() {
    ['card-manager', 'character', 'greetings', 'worldbook', 'chat', 'mvu', 'statusbar', 'regex', 'tavern-scripts',
      'novel-source', 'novel-character-setup', 'novel-greetings', 'novel-analyze', 'novel-characters', 'novel-worldbook', 'novel-style', 'prompt-config'].forEach(function(v) {
      assert.ok(VALID_VIEWS.indexOf(v) >= 0, 'missing view ' + v);
    });
    assert.ok(VALID_VIEWS.indexOf('novel-outputs') < 0);
    // 小说设定/开场白与主卡 view 分离
    assert.ok(VALID_VIEWS.indexOf('novel-character-setup') >= 0);
    assert.ok(VALID_VIEWS.indexOf('novel-greetings') >= 0);
  });
});

describe('assistant targeting', function() {
  it('normalizeTarget / resolveWorldbookIndex 支持序号与标题', function() {
    var entries = [
      { comment: '青云剑宗', content: 'a', keys: [] },
      { comment: '禁地', content: 'b', keys: [], id: 'wb_2' },
      { comment: '宗门秘闻', content: 'c', keys: [] },
    ];
    assert.equal(resolveWorldbookIndex(entries, { index: 2 }), 2);
    assert.equal(resolveWorldbookIndex(entries, { target: { titleMatch: '剑宗' } }), 0);
    assert.equal(resolveWorldbookIndex(entries, { target: { id: 'wb_2' } }), 1);
    assert.equal(normalizeTarget({ target: 'main' }).name, 'main');
  });
});

describe('assistant risk', function() {
  it('小改 update_character_fields → auto', function() {
    assert.equal(classifyToolRisk('update_character_fields', { fields: { charName: '新名' } }), 'auto');
  });

  it('长文本 / 删除 / 整段覆盖 → confirm', function() {
    var long = '字'.repeat(500);
    assert.equal(classifyToolRisk('update_character_fields', { fields: { charDesc: long } }), 'confirm');
    assert.equal(classifyToolRisk('delete_worldbook_entry', { index: 0 }), 'confirm');
    assert.equal(classifyToolRisk('delete_worldbook_entry', { all: true }), 'confirm');
    assert.equal(classifyToolRisk('replace_character_section', { field: 'charDesc', content: 'x' }), 'confirm');
    assert.equal(classifyToolRisk('generate_character_draft', {}), 'confirm');
    assert.equal(classifyToolRisk('organize_worldbook', {}), 'confirm');
    assert.equal(classifyToolRisk('switch_card', { id: 'x' }), 'confirm');
    assert.equal(classifyToolRisk('rewrite_worldbook_entry', { index: 0 }), 'confirm');
  });

  it('expand_worldbook_entry 默认 auto，rewrite mode → confirm', function() {
    assert.equal(classifyToolRisk('expand_worldbook_entry', { index: 0 }), 'auto');
    assert.equal(classifyToolRisk('expand_worldbook_entry', { index: 0, mode: 'rewrite' }), 'confirm');
  });

  it('buildChangePreview 含工具名', function() {
    var p = buildChangePreview('update_character_fields', { fields: { charName: 'A' } });
    assert.match(p, /update_character_fields/);
    assert.match(p, /charName/);
  });
});

describe('assistant react parse', function() {
  it('解析 tool / final JSON', function() {
    var t = parseReactStep('{"thought":"读卡","tool":"get_character_fields","args":{}}');
    assert.equal(t.type, 'tool');
    assert.equal(t.tool, 'get_character_fields');
    var f = parseReactStep('```json\n{"final":"完成了"}\n```');
    assert.equal(f.type, 'final');
    assert.equal(f.final, '完成了');
  });

  it('无 JSON 时当作 final', function() {
    var p = parseReactStep('直接中文回复');
    assert.equal(p.type, 'final');
  });

  it('extractJsonObject 扫描嵌套', function() {
    var obj = extractJsonObject('前缀 {"a":1,"b":{"c":2}} 后缀');
    assert.equal(obj.a, 1);
    assert.equal(obj.b.c, 2);
  });
});

describe('assistant executor', function() {
  it('只读工具直接返回', async function() {
    var bridge = mockBridge();
    var ex = createToolExecutor(bridge);
    var r = await ex.invoke('get_character_fields', {});
    assert.equal(r.ok, true);
    assert.equal(r.risk, 'none');
    assert.equal(r.data.charName, '测试');
  });

  it('小改自动应用', async function() {
    var bridge = mockBridge();
    var stack = [];
    var ex = createToolExecutor(bridge, {
      pushSnapshot: function(s) { stack.push(s); },
      popSnapshot: function() { return stack.pop(); },
    });
    var r = await ex.invoke('update_character_fields', { fields: { charName: '自动', tags: ['奇幻', '恋爱'] } });
    assert.deepEqual(bridge.state.character.tags, ['奇幻', '恋爱']);
    assert.equal(r.ok, true);
    assert.equal(r.risk, 'auto');
    assert.equal(r.applied, true);
    assert.equal(bridge.state.character.charName, '自动');
    assert.ok(stack.length >= 1);
  });

  it('postHistoryInstructions 映射写入 creatorNotes', async function() {
    var bridge = mockBridge();
    var ex = createToolExecutor(bridge);
    var r = await ex.invoke('update_character_fields', {
      fields: { post_history_instructions: '场景后作者注' },
    });
    assert.equal(r.ok, true);
    assert.equal(bridge.state.character.creatorNotes, '场景后作者注');
    assert.deepEqual(r.data.mapped, [{ from: 'post_history_instructions', to: 'creatorNotes' }]);
  });

  it('未知字段 update_character_fields 失败且不写入', async function() {
    var bridge = mockBridge({ character: { charName: '原名', charDesc: '短', firstMes: '', creatorNotes: '', wbName: '', tags: [], altGreetings: [] } });
    var ex = createToolExecutor(bridge);
    var r = await ex.invoke('update_character_fields', { fields: { avatarUrl: 'http://x', personality: '开朗' } });
    assert.equal(r.ok, false);
    assert.match(r.error, /未写入任何角色字段/);
    assert.match(r.error, /avatarUrl/);
    assert.equal(bridge.state.character.charName, '原名');
  });

  it('大改返回 pendingConfirm 且不写入', async function() {
    var bridge = mockBridge({ worldbook: [{ comment: 'A', content: 'x', keys: [] }] });
    var ex = createToolExecutor(bridge);
    var r = await ex.invoke('delete_worldbook_entry', { index: 0 });
    assert.equal(r.pendingConfirm, true);
    assert.equal(bridge.state.worldbook.length, 1);
    var applied = await ex.invoke('delete_worldbook_entry', { index: 0 }, { forceApply: true });
    assert.equal(applied.ok, true);
    assert.equal(bridge.state.worldbook.length, 0);
  });

  it('delete_worldbook_entry({ all: true }) 清空全部条目', async function() {
    var bridge = mockBridge({
      worldbook: [
        { comment: 'A', content: 'x', keys: [] },
        { comment: 'B', content: 'y', keys: [] },
        { comment: 'C', content: 'z', keys: [] },
      ],
    });
    var ex = createToolExecutor(bridge);
    var pending = await ex.invoke('delete_worldbook_entry', { all: true });
    assert.equal(pending.pendingConfirm, true);
    assert.equal(bridge.state.worldbook.length, 3);
    var applied = await ex.invoke('delete_worldbook_entry', { all: true }, { forceApply: true });
    assert.equal(applied.ok, true);
    assert.equal(applied.data.deleted, 3);
    assert.equal(applied.data.remaining, 0);
    assert.equal(applied.data.clearedAll, true);
    assert.equal(bridge.state.worldbook.length, 0);
  });

  it('delete_worldbook_entry({ all: true }) 空列表仍成功', async function() {
    var bridge = mockBridge({ worldbook: [] });
    var ex = createToolExecutor(bridge);
    var r = await ex.invoke('delete_worldbook_entry', { all: true }, { forceApply: true });
    assert.equal(r.ok, true);
    assert.equal(r.data.deleted, 0);
    assert.equal(r.data.clearedAll, true);
  });

  it('delete_worldbook_entry 无参数失败', async function() {
    var bridge = mockBridge({ worldbook: [{ comment: 'A', content: 'x', keys: [] }] });
    var ex = createToolExecutor(bridge);
    var r = await ex.invoke('delete_worldbook_entry', {}, { forceApply: true });
    assert.equal(r.ok, false);
    assert.match(r.error, /未指定可删除条目/);
    assert.equal(bridge.state.worldbook.length, 1);
  });

  it('定向扩写世界书：titleMatch / index', async function() {
    var bridge = mockBridge({
      worldbook: [
        { comment: '青云剑宗', content: '短', keys: [] },
        { comment: '禁地', content: '短', keys: [] },
      ],
    });
    var ex = createToolExecutor(bridge);
    var byTitle = await ex.invoke('expand_worldbook_entry', {
      target: { titleMatch: '剑宗' },
      instruction: '扩写',
    });
    assert.equal(byTitle.ok, true);
    assert.match(bridge.state.worldbook[0].content, /expand/);
    var byIndex = await ex.invoke('expand_worldbook_entry', { target: { index: 1 } }, { forceApply: true });
    assert.equal(byIndex.ok, true);
    assert.match(bridge.state.worldbook[1].content, /expand/);
  });

  it('开场白定向：主 / 备选 index', async function() {
    var bridge = mockBridge();
    var ex = createToolExecutor(bridge);
    var main = await ex.invoke('rewrite_greeting', { target: 'main', instruction: '更沉浸' }, { forceApply: true });
    assert.equal(main.ok, true);
    assert.match(bridge.state.character.firstMes, /主开场/);
    var alt = await ex.invoke('expand_greeting', { target: { alternate: 1 } }, { forceApply: true });
    assert.equal(alt.ok, true);
    assert.match(bridge.state.character.altGreetings[1], /备选1/);
  });

  it('小说真 await 与人物定向', async function() {
    var bridge = mockBridge();
    var ex = createToolExecutor(bridge);
    var split = await ex.invoke('novel_split_chapters', {}, { forceApply: true });
    assert.equal(split.ok, true);
    assert.equal(split.data.chapterCount, 3);
    assert.ok(!split.data.started);
    var chars = await ex.invoke('novel_extract_characters', {}, { forceApply: true });
    assert.equal(chars.data.characterCount, 2);
    var exp = await ex.invoke('novel_expand_character', {
      target: { name: '林月' },
      mode: 'expand',
    }, { forceApply: true });
    assert.equal(exp.ok, true);
    assert.equal(exp.data.name, '林月');
    var wbExp = await ex.invoke('novel_expand_worldbook', {
      target: { name: '青云宗' },
      mode: 'expand',
    }, { forceApply: true });
    assert.equal(wbExp.ok, true);
    assert.equal(wbExp.data.name, '青云宗');
    var sync = await ex.invoke('novel_sync_outputs', { target: 'worldbook', policy: 'merge' }, { forceApply: true });
    assert.equal(sync.data.applied, 1);
  });

  it('多卡 / MVU / 引擎选项', async function() {
    var bridge = mockBridge();
    var ex = createToolExecutor(bridge);
    var list = await ex.invoke('list_cards', {});
    assert.equal(list.data.cards.length, 2);
    var rename = await ex.invoke('rename_card', { id: 'draft_a', name: '新名' });
    assert.equal(rename.ok, true);
    var sw = await ex.invoke('switch_card', { id: 'draft_b' });
    assert.equal(sw.pendingConfirm, true);
    var sw2 = await ex.invoke('switch_card', { id: 'draft_b' }, { forceApply: true });
    assert.equal(sw2.data.id, 'draft_b');
    var eng = await ex.invoke('get_engine_options', {});
    assert.equal(eng.data.skeletonCount, 6);
    await ex.invoke('set_engine_options', { skeletonCount: 10 });
    assert.equal(bridge.state.engine.skeletonCount, 10);
    var patch = await ex.invoke('patch_mvu_node', { path: 'stat.hp', patch: { label: '生命' } });
    assert.equal(patch.ok, true);
    var chk = await ex.invoke('export_card_check', {});
    assert.match(chk.data.note, /不触发下载/);
  });

  it('analyze_chat_feedback 返回结构化 fixes', async function() {
    var bridge = mockBridge();
    var ex = createToolExecutor(bridge);
    var r = await ex.invoke('analyze_chat_feedback', {});
    assert.equal(r.ok, true);
    assert.equal(r.data.source, 'llm');
    assert.ok(Array.isArray(r.data.fixes));
    assert.ok(r.data.fixes[0].tool);
  });

  it('fix_from_lint 生成并应用补丁', async function() {
    var bridge = mockBridge({
      character: { charName: '测', charDesc: '短', firstMes: '', creatorNotes: '', wbName: '', tags: [], altGreetings: [] },
      worldbook: [{ comment: '骨架', content: '短', keys: [] }],
    });
    var ex = createToolExecutor(bridge);
    var preview = await ex.invoke('fix_from_lint', { apply: false }, { forceApply: true });
    assert.ok(preview.data.ops.length >= 1);
    var applied = await ex.invoke('fix_from_lint', {}, { forceApply: true });
    assert.equal(applied.data.applied, true);
  });

  it('apply_patch_bundle + undo 含小说桶', async function() {
    var bridge = mockBridge({
      worldbook: [{ comment: '旧', content: '1', keys: ['a'], strategy: 'selective' }],
    });
    var stack = createSnapshotStack(memoryStorage());
    var ex = createToolExecutor(bridge, {
      pushSnapshot: function(s) { return stack.push(s); },
      popSnapshot: function() { return stack.pop(); },
    });
    bridge.state.novel.novelBucket.sourceText = '改前';
    var r = await ex.invoke('apply_patch_bundle', {
      ops: [
        { op: 'update_character_fields', args: { fields: { charName: '补丁后' } } },
        { op: 'set_novel_source', args: { text: '改后原文' } },
      ],
    }, { forceApply: true });
    assert.equal(r.ok, true);
    assert.equal(bridge.state.character.charName, '补丁后');
    assert.equal(bridge.state.novel.novelBucket.sourceText, '改后原文');
    var u = await ex.invoke('undo_last_bundle', {}, { forceApply: true });
    assert.equal(u.ok, true);
    assert.equal(bridge.state.character.charName, '测试');
    assert.equal(bridge.state.novel.novelBucket.sourceText, '改前');
  });

  it('open_module 校验 view', async function() {
    var bridge = mockBridge();
    var ex = createToolExecutor(bridge);
    var bad = await ex.invoke('open_module', { view: 'nope' });
    assert.equal(bad.ok, false);
    var good = await ex.invoke('open_module', { view: 'worldbook' });
    assert.equal(good.ok, true);
    assert.equal(bridge.state.opened, 'worldbook');
  });

  it('search_card_content 可命中', async function() {
    var bridge = mockBridge({
      character: { charName: '秦月', charDesc: '剑修', firstMes: '', creatorNotes: '', wbName: '', altGreetings: [] },
      worldbook: [{ comment: '宗门', content: '青云剑宗', keys: ['剑宗'] }],
    });
    var ex = createToolExecutor(bridge);
    var r = await ex.invoke('search_card_content', { query: '剑' });
    assert.ok(r.data.hits.length >= 1);
  });
});

describe('assistant session', function() {
  it('会话读写使用固定 key', function() {
    var storage = memoryStorage();
    var store = createAssistantSessionStore(storage);
    store.append({ role: 'user', content: 'hi' });
    assert.ok(storage.getItem(ASSISTANT_SESSION_KEY));
    assert.equal(store.read().messages.length, 1);
    store.clear();
    assert.equal(store.read().messages.length, 0);
  });
});

describe('assistant tool trace summary', function() {
  it('get_worldbook_list 折叠摘要', function() {
    var s = summarizeToolTrace('get_worldbook_list', {
      ok: true,
      data: { count: 182, entries: [] },
    });
    assert.equal(s, '获取 182 条世界书');
  });

  it('delete_worldbook_entry 确认与结果摘要', function() {
    assert.equal(
      summarizePendingConfirm('delete_worldbook_entry', { all: true }, '工具: delete_worldbook_entry'),
      '待确认：清空全部世界书',
    );
    assert.equal(
      summarizePendingConfirm('generate_worldbook_entry', { direction: '女帝' }, '工具: generate_worldbook_entry\n参数: {}'),
      '待确认：生成并写入世界书条目',
    );
    assert.equal(
      summarizeToolTrace('delete_worldbook_entry', {
        ok: true,
        data: { deleted: 3, remaining: 0, clearedAll: true },
      }),
      '已清空全部 3 条',
    );
  });

  it('pendingConfirm 轨迹供会话恢复，不含重复确认文案', function() {
    var msg = buildToolUiMessage('generate_worldbook_entry', { direction: '女帝' }, {
      ok: true,
      risk: 'confirm',
      pendingConfirm: true,
      preview: '工具: generate_worldbook_entry\n参数: {"direction":"女帝"}',
      message: '此操作为大改，需用户确认后再应用。',
    });
    assert.equal(msg.pendingConfirm, true);
    assert.equal(msg.summary, '待确认：生成并写入世界书条目');
    assert.match(msg.detail, /generate_worldbook_entry/);
    assert.doesNotMatch(msg.detail, /此操作为大改/);
  });

  it('错误摘要取首行', function() {
    var s = summarizeToolTrace('update_character_fields', {
      ok: false,
      error: '未写入任何角色字段\navatarUrl 无效',
    });
    assert.equal(s, '未写入任何角色字段');
  });

  it('buildToolUiMessage 含折叠字段', function() {
    var msg = buildToolUiMessage('get_worldbook_list', {}, {
      ok: true,
      risk: 'none',
      data: { count: 2, entries: [{ index: 0, comment: 'A' }] },
    });
    assert.equal(msg.role, 'tool');
    assert.equal(msg.summary, '获取 2 条世界书');
    assert.match(msg.detail, /"count":\s*2/);
    assert.equal(msg.error, false);
  });

  it('旧版纯文本轨迹可恢复摘要', function() {
    var legacy = '⚙ get_worldbook_list [none]\n{"count":5,"entries":[]}';
    assert.equal(toolMessageSummary({ content: legacy }), '{"count":5,"entries":[]}');
  });
});

describe('assistant prompts & UI wiring', function() {
  it('提示词含定向修改与试聊结构化', function() {
    ['assistantSystem', 'assistantReactHint', 'assistantChatFeedback'].forEach(function(id) {
      assert.ok(DEFAULT_PROMPTS[id]);
      assert.ok(PROMPT_META.some(function(m) { return m.id === id; }));
    });
    assert.match(DEFAULT_PROMPTS.assistantSystem, /定向修改/);
    assert.match(DEFAULT_PROMPTS.assistantSystem, /禁止.*API Key|API Key/);
    assert.match(DEFAULT_PROMPTS.assistantSystem, /主次|制卡是主体/);
    assert.match(DEFAULT_PROMPTS.assistantSystem, /倾向引导|非强制/);
    assert.match(DEFAULT_PROMPTS.assistantReactHint, /勿强制|跳步/);
    assert.match(DEFAULT_PROMPTS.assistantChatFeedback, /fixes/);
  });

  it('右栏助手已挂载', function() {
    const index = readFileSync(join(root, 'src/pages/index.astro'), 'utf8');
    assert.match(index, /AssistantPanel/);
    const cmSrc = readCardManagerSources(root);
    assert.match(cmSrc, /__assistantCardApi__/);
    const wbSrc = readFileSync(join(root, 'src/lib/card-builder/panels/worldbook.mjs'), 'utf8');
    assert.match(wbSrc, /__assistantWbAi__/);
    const layout = readFileSync(join(root, 'src/layouts/Layout.astro'), 'utf8');
    assert.match(layout, /minmax\(300px,\s*380px\)/);
    const panel = readFileSync(join(root, 'src/components/AssistantPanel.astro'), 'utf8');
    assert.match(panel, /assistantPanel/);
    assert.match(panel, /assistant-mode-switch/);
    assert.match(panel, /__setAssistantPanelMode__/);
    assert.match(panel, /createToolExecutor/);
    assert.match(panel, /normalizeCharacterPatch|characterFields/);
    assert.match(panel, /CHARACTER_FIELD_HINT/);
    assert.match(panel, /mutateGreeting/);
    assert.match(panel, /captureBucket/);
    assert.match(panel, /height:\s*100%/);
    assert.match(panel, /assistant-panel__messages[\s\S]*?overflow-y:\s*auto/);
    assert.match(panel, /assistant-tool-card/);
    assert.match(panel, /buildToolUiMessage/);
    assert.match(panel, /renderToolTraceNode/);
  });

  it('小说桥接真 await，禁止 started-only', function() {
    const novel = readFileSync(join(root, 'src/lib/novel/browserApp.mjs'), 'utf8');
    assert.match(novel, /runScanCharacters/);
    assert.match(novel, /runExtractWorldbook/);
    assert.match(novel, /runDistillStyle/);
    assert.match(novel, /async function runScan/);
    assert.match(novel, /normalizeCharacterPatch/);
    assert.doesNotMatch(novel, /return \{ started: true, mode: 'worldbook' \}/);
  });

  it('助手 UI：无折叠、快捷填入、就绪绿点、未配置仅 tip', function() {
    const panel = readFileSync(join(root, 'src/components/AssistantPanel.astro'), 'utf8');
    assert.doesNotMatch(panel, /assistantCollapseBtn/);
    assert.doesNotMatch(panel, /is-collapsed/);
    assert.doesNotMatch(panel, /assistantChips/);
    assert.match(panel, /assistantQuickBtn/);
    assert.match(panel, /assistantQuickMenu/);
    assert.match(panel, /inputEl\.value\s*=\s*text/);
    assert.match(panel, /data-tool/);
    assert.match(panel, /assistantReadyDot/);
    assert.match(panel, /ensureAiConfigured/);
    assert.match(panel, /请先在「AI 配置」填写接口与模型/);
    assert.match(panel, /if\s*\(!ensureAiConfigured\(\)\)\s*return/);
    assert.doesNotMatch(panel, /id="assistantStatus"/);
    assert.match(panel, /assistant-tool-card__head/);
    assert.match(panel, /assistant-tool-card__header-row/);
    assert.match(panel, /assistant-tool-card__summary/);
    assert.match(panel, /assistant-tool-card__detail/);
    assert.match(panel, /renderToolTraceNode[\s\S]*?assistant-tool-card__header-row[\s\S]*?assistant-tool-card__summary[\s\S]*?assistant-tool-card__detail/);
    assert.match(panel, /<div class="assistant-panel__pending" id="assistantPendingBox"/);
    assert.match(panel, /assistant-panel__preview-wrap/);
    assert.doesNotMatch(panel, /pendingBox\.open/);
    assert.doesNotMatch(panel, /已准备大改预览/);
    assert.match(panel, /if \(result\.pendingConfirm\)[\s\S]*?return result;/);
    assert.match(panel, /if \(m\.pendingConfirm\) card\.open = true/);
    assert.match(panel, /id="assistantTokenCount"/);
    assert.match(panel, /assistant-token-count/);
    assert.match(panel, /updateTokenCount/);
    assert.match(panel, /tokenEstimate\.mjs/);
    assert.match(panel, /id="assistantRagPreviewBtn"/);
    assert.match(panel, /assistant-btn-rag-preview/);
    assert.match(panel, /id="assistantRagModal"/);
    assert.match(panel, /assistant-rag-modal/);
    assert.match(panel, /assistant-msg-rag-btn/);
    assert.match(panel, /renderUserMessageNode/);
    assert.match(panel, /openComposerRagPreview/);
    assert.match(panel, /openRagPreviewForMessage/);
    assert.match(panel, /ragPreview/);
    assert.match(panel, /resolveAssistantRag/);
    assert.match(panel, /\.assistant-msg\s*\{[^}]*word-break:\s*normal/s);
    assert.match(panel, /\.assistant-msg-wrap--user\s*\{[^}]*width:\s*fit-content/s);
    assert.match(panel, /\.assistant-msg-wrap--user\s*\{[^}]*max-width:\s*85%/s);
    assert.match(panel, /\.assistant-msg--user\s*\{[^}]*width:\s*max-content/s);
    assert.doesNotMatch(panel, /\.assistant-msg-wrap\s*\{[^}]*min-width:\s*0/s);
  });

  it('快捷浮层：默认 hidden，展开受控，选中后关闭', function() {
    const panel = readFileSync(join(root, 'src/components/AssistantPanel.astro'), 'utf8');
    assert.match(panel, /id="assistantQuickMenu"[^>]*\bhidden\b/);
    assert.match(panel, /aria-expanded="false"/);
    assert.match(panel, /\.assistant-quick-menu:not\(\[hidden\]\)\s*\{[^}]*display:\s*flex/s);
    assert.match(panel, /\.assistant-quick-menu\[hidden\]\s*\{[^}]*display:\s*none\s*!important/s);
    assert.match(panel, /setQuickOpen\(false\)/);
    assert.match(panel, /setQuickOpen\(quickMenu\.hidden\)/);
    assert.match(panel, /!quickMenu\.contains\(e\.target\)/);
  });

  it('README 含工具全表与定向约定', function() {
    const readme = readFileSync(join(root, 'README.md'), 'utf8');
    assert.match(readme, /助手工具全表/);
    assert.match(readme, /rewrite_worldbook_entry/);
    assert.match(readme, /定向修改/);
    assert.match(readme, /不做/);
  });
});
