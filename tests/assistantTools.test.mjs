/**
 * AI 助手工具全覆盖执行测试：74 个 ASSISTANT_TOOLS + 空参校验 + 桥接缺口
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ASSISTANT_TOOLS } from '../src/lib/assistant/tools.mjs';
import { createToolExecutor, resolveWorldbookIndex } from '../src/lib/assistant/executor.mjs';

/** 每个工具的最小合法参数（executeConfirmed 直跑，绕过 confirm） */
const TOOL_MIN_ARGS = {
  get_character_fields: {},
  get_character_summary: {},
  get_worldbook_list: {},
  get_worldbook_entry: { index: 0 },
  get_mvu_state: {},
  get_novel_workspace: {},
  get_export_preview: {},
  export_card_check: {},
  search_card_content: { query: '测' },
  search_novel_passages: { query: '林' },
  list_novel_entities: {},
  get_novel_entity: { target: { id: 'e1' } },
  audit_worldbook: {},
  lint_for_sillytavern: {},
  get_chat_feedback: {},
  list_cards: {},
  get_engine_options: {},
  get_prompt_ids: {},
  novel_list_outputs: {},
  update_character_fields: { fields: { charName: '新名' } },
  replace_character_section: { field: 'charDesc', content: '新描述' },
  expand_character_field: { field: 'charDesc' },
  create_worldbook_entry: { entry: { comment: '新条', content: '内容' } },
  update_worldbook_entry: { index: 0, patch: { content: '改' } },
  delete_worldbook_entry: { index: 0 },
  rewrite_greeting: { target: 'main' },
  expand_greeting: { target: { alternate: 0 } },
  update_alternate_greeting: { index: 0, content: '新备选' },
  generate_character_draft: {},
  generate_worldbook_skeleton: {},
  generate_worldbook_entry: {},
  organize_worldbook: { apply: false },
  batch_fill_worldbook_keys: {},
  rewrite_worldbook_entry: { target: { index: 0 } },
  expand_worldbook_entry: { target: { index: 0 } },
  fix_from_lint: { apply: false },
  open_module: { view: 'worldbook' },
  apply_patch_bundle: { ops: [{ op: 'get_character_fields', args: {} }] },
  undo_last_bundle: {},
  suggest_fixes: {},
  switch_card: { id: 'draft_a' },
  create_card: { name: '新卡' },
  duplicate_card: {},
  rename_card: { name: '改名' },
  delete_card: { id: 'draft_b' },
  import_card: { cardJson: { charName: '导入', charDesc: '描述', firstMes: 'hi' } },
  set_novel_source: { text: '原文' },
  run_novel_extract_step: { mode: 'split' },
  novel_split_chapters: {},
  novel_extract_characters: {},
  novel_extract_worldbook: {},
  run_novel_rag_index: {},
  run_novel_analyze: {},
  enrich_novel_entity: { target: { id: 'e1' } },
  patch_novel_entity: { target: { id: 'e1' }, patch: { name: '改' } },
  merge_novel_entities: { keep: { id: 'e1' }, drop: { id: 'e2' } },
  sync_novel_entities: {},
  set_novel_adult_mode: { enabled: true },
  set_novel_ntl_mode: { enabled: false },
  draft_nsfw_statusbar: {},
  generate_corruption_lore: { templateOnly: true, selectedNames: ['测试'] },
  novel_distill_style: {},
  novel_patch_chapters: { action: 'enable', id: 'ch1' },
  novel_expand_character: { target: { name: '林月' } },
  novel_rewrite_character: { target: { id: 'c1' } },
  novel_expand_worldbook: { target: { index: 0 } },
  novel_sync_outputs: { target: 'worldbook' },
  apply_novel_result_to_card: {},
  upsert_mvu_design: { design: { variables: [] } },
  upsert_mvu_variables: { design: { variables: [] } },
  clear_mvu: {},
  patch_mvu_node: { path: 'stat.hp', patch: { label: '生命' } },
  set_engine_options: { skeletonCount: 8 },
  analyze_chat_feedback: {},
  apply_chat_feedback_fixes: { fixes: [{ tool: 'get_character_fields', args: {} }] },
};

/** 空参应明确失败（非 read/none 类误操作） */
const EMPTY_ARGS_SHOULD_FAIL = new Set([
  'update_character_fields',
  'replace_character_section',
  'expand_character_field',
  'create_worldbook_entry',
  'update_worldbook_entry',
  'delete_worldbook_entry',
  'update_alternate_greeting',
  'open_module',
  'patch_mvu_node',
  'novel_patch_chapters',
  'merge_novel_entities',
  'import_card',
  'get_novel_entity',
  'get_worldbook_entry',
  'run_novel_extract_step',
]);

function createFullMockBridge(seed) {
  var state = {
    character: Object.assign({
      charName: '测试',
      charDesc: '描述够长'.repeat(10),
      firstMes: '你好',
      creatorNotes: '',
      wbName: '',
      tags: [],
      altGreetings: ['备选甲', '备选乙'],
    }, (seed && seed.character) || {}),
    worldbook: ((seed && seed.worldbook) || [
      { comment: '条', content: '内容', keys: ['k'], id: 'wb1' },
    ]).slice(),
    mvu: { design: { variables: [{ path: 'stat.hp', label: 'HP' }] } },
    novel: {
      available: true,
      draftCount: 0,
      chapters: [{ id: 'ch1', title: '第一章', enabled: true }],
      characters: [{ id: 'c1', name: '林月', profile: { 'Chinese name': '林月' } }],
      wbEntries: [{ name: '青云宗', content: '短设定', keys: ['青云'] }],
      entities: [
        { id: 'e1', name: '实体甲', type: 'char' },
        { id: 'e2', name: '实体乙', type: 'char' },
      ],
      novelBucket: { sourceText: '原文', chapters: [] },
    },
    cards: [{ id: 'draft_a', name: '卡A', current: true }, { id: 'draft_b', name: '卡B', current: false }],
    engine: { skeletonCount: 6 },
    opened: null,
    snapshots: [],
  };

  return {
    state: state,
    getCharacter: function() {
      return Object.assign({}, state.character, {
        altGreetings: (state.character.altGreetings || []).slice(),
      });
    },
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
      state.novel.novelBucket.sourceText = (p && p.text) || '';
      return { sourceLen: String((p && p.text) || '').length };
    },
    runNovelExtract: async function(opts) {
      var mode = (opts && opts.mode) || 'characters';
      if (mode === 'split') return { mode: 'split', chapterCount: 3 };
      if (mode === 'worldbook') return { mode: 'worldbook', draftCount: 2 };
      if (mode === 'style') return { mode: 'style', styleLen: 120 };
      return { mode: 'characters', characterCount: 2 };
    },
    searchNovelPassages: async function(query) {
      return { hits: [{ text: String(query || ''), score: 1 }] };
    },
    listNovelEntities: function() { return state.novel.entities.slice(); },
    getNovelEntity: function(key) {
      return state.novel.entities.find(function(e) {
        return e.id === key || e.name === key;
      }) || null;
    },
    patchNovelEntity: function(opts) {
      return { target: opts.target, patchKeys: Object.keys(opts.patch || {}) };
    },
    mergeNovelEntities: function() { return { merged: true }; },
    runNovelRagIndex: async function() { return { indexed: true }; },
    runNovelAnalyze: async function() { return { analyzed: true }; },
    enrichNovelEntity: async function() { return { enriched: true }; },
    syncNovelEntities: function() { return { synced: true }; },
    syncNovelOutputs: function(opts) {
      return { target: (opts && opts.target) || 'worldbook', applied: 1 };
    },
    applyNovel: function(opts) { return this.syncNovelOutputs(opts); },
    setNovelAdultMode: function(on) { state.novel.adultMode = on; return on; },
    setNovelNtlMode: function(on) { state.novel.ntlMode = on; return on; },
    draftNsfwStatusBar: function() { return { draft: true, variables: [] }; },
    generateCorruptionLore: async function(opts) {
      return {
        ok: true,
        stageNames: ['未触碰', '动摇', '越界', '沉沦', '彻底恶堕'],
        archiveCount: (opts && opts.selectedNames && opts.selectedNames.length) || 1,
        usedAi: false,
        templateOnly: !!(opts && opts.templateOnly),
      };
    },
    getNsfwConfig: function() {
      return { enabled: true, corruptionEnabled: true, corruptionPreset: '5' };
    },
    setNsfwConfig: function() { return true; },
    patchNovelChapters: function(opts) { return { action: opts.action, ok: true }; },
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
        return e.name === t.name;
      });
      if (idx < 0 || !list[idx]) throw new Error('世界书条目未找到');
      return { index: idx, name: list[idx].name };
    },
    getExportPreview: function() {
      return { name: state.character.charName, worldbookCount: state.worldbook.length };
    },
    exportCardCheck: function() {
      return { ok: true, issues: [], note: '仅校验，不触发下载' };
    },
    auditWorldbook: function() {
      var noKeys = state.worldbook.filter(function(e) { return !e.keys || !e.keys.length; }).length;
      return { total: state.worldbook.length, noKeys: noKeys, skeleton: 0 };
    },
    lintCard: function() {
      return { ok: true, issues: [] };
    },
    getChatFeedback: function() {
      return { messages: [{ role: 'user', content: 'hi' }], started: true };
    },
    analyzeChatFeedback: async function() {
      return { source: 'llm', issues: [], fixes: [] };
    },
    openModule: function(v) { state.opened = v; },
    listCards: function() { return { currentId: 'draft_a', cards: state.cards }; },
    manageCard: async function(action, args) {
      args = args || {};
      if (action === 'import_card' && args.cardJson == null && args.json == null) {
        throw new Error('缺少 cardJson');
      }
      if (action === 'rename_card') return { id: args.id || 'draft_a', name: args.name };
      if (action === 'create_card') return { id: 'draft_new', name: args.name || '未命名' };
      if (action === 'switch_card') return { id: args.id || 'draft_b' };
      if (action === 'delete_card') return { deleted: args.id };
      if (action === 'duplicate_card') return { id: 'draft_dup' };
      if (action === 'import_card') return { id: 'draft_imp', name: args.cardJson.charName || '导入' };
      throw new Error('unknown ' + action);
    },
    getEngineOptions: function() { return Object.assign({ note: '不含 API Key' }, state.engine); },
    setEngineOptions: function(o) {
      if (o.skeletonCount != null) state.engine.skeletonCount = o.skeletonCount;
      return { skeletonCount: state.engine.skeletonCount };
    },
    getPromptIds: function() { return { ids: ['assistantSystem'] }; },
    generateCharacter: async function() { return { charName: '生成' }; },
    generateSkeleton: async function() { return { added: 1 }; },
    generateWorldbookEntry: async function() { return { added: 1 }; },
    organizeWorldbook: async function(opts) { return { applied: opts.apply !== false }; },
    batchFillWorldbookKeys: async function() { return { updated: 1 }; },
    mutateWorldbookEntry: async function(opts) {
      var idx = resolveWorldbookIndex(state.worldbook, opts);
      if (idx < 0) throw new Error('条目未找到');
      return { index: idx, mode: opts.mode || 'expand' };
    },
    expandEntry: async function(opts) {
      return this.mutateWorldbookEntry(Object.assign({}, opts, { mode: 'expand' }));
    },
    expandCharacterField: async function(opts) {
      return { field: opts.field, length: 10 };
    },
    mutateGreeting: async function(opts) {
      return { target: opts.target || 'main', mode: opts.mode || 'rewrite' };
    },
    captureSnapshot: function() {
      return {
        character: Object.assign({}, state.character),
        worldbook: state.worldbook.slice(),
        novel: JSON.parse(JSON.stringify(state.novel.novelBucket)),
        at: Date.now(),
      };
    },
    restoreSnapshot: function(s) {
      state.character = Object.assign({}, s.character);
      state.worldbook = (s.worldbook || []).slice();
      if (s.novel) state.novel.novelBucket = s.novel;
    },
  };
}

function createExecutorWithStack(bridge) {
  var stack = [];
  return {
    stack: stack,
    ex: createToolExecutor(bridge, {
      pushSnapshot: function(s) { stack.push(s); },
      popSnapshot: function() { return stack.pop(); },
    }),
  };
}

describe('assistant tools execution audit', function() {
  it('注册表与 TOOL_MIN_ARGS 一一对应', function() {
    assert.equal(Object.keys(TOOL_MIN_ARGS).length, ASSISTANT_TOOLS.length);
    ASSISTANT_TOOLS.forEach(function(t) {
      assert.ok(TOOL_MIN_ARGS[t.name], '缺少最小参数映射: ' + t.name);
    });
  });

  for (var ti = 0; ti < ASSISTANT_TOOLS.length; ti++) {
    (function(toolMeta) {
      it('execute: ' + toolMeta.name, async function() {
        var bridge = createFullMockBridge();
        var ctx = createExecutorWithStack(bridge);
        var args = Object.assign({}, TOOL_MIN_ARGS[toolMeta.name]);

        if (toolMeta.name === 'undo_last_bundle') {
          ctx.stack.push(bridge.captureSnapshot());
        }

        var r = await ctx.ex.executeConfirmed(toolMeta.name, args);
        assert.equal(r.ok, true, toolMeta.name + ' 失败: ' + (r.error || ''));
      });
    })(ASSISTANT_TOOLS[ti]);
  }

  it('patch_novel_entity 缺 patch 时不泄漏 target', async function() {
    var captured = null;
    var bridge = createFullMockBridge();
    bridge.patchNovelEntity = function(opts) {
      captured = opts;
      return { ok: true };
    };
    var ex = createToolExecutor(bridge);
    var r = await ex.executeConfirmed('patch_novel_entity', { target: { id: 'e1' } });
    assert.equal(r.ok, true);
    assert.deepEqual(captured.patch, {});
    assert.deepEqual(captured.target, { id: 'e1' });

    var r2 = await ex.executeConfirmed('patch_novel_entity', {
      target: { id: 'e1' },
      patch: { name: '改' },
    });
    assert.equal(r2.ok, true);
    assert.deepEqual(captured.patch, { name: '改' });
    assert.ok(!('target' in captured.patch));
  });

  it('空参应失败的工具', async function() {
    var bridge = createFullMockBridge();
    var ex = createToolExecutor(bridge);
    for (var i = 0; i < ASSISTANT_TOOLS.length; i++) {
      var name = ASSISTANT_TOOLS[i].name;
      if (!EMPTY_ARGS_SHOULD_FAIL.has(name)) continue;
      var r = await ex.executeConfirmed(name, {});
      assert.equal(r.ok, false, name + ' 空参应失败');
      assert.ok(r.error, name + ' 应有 error 信息');
    }
  });

  it('桥接缺失时返回明确错误', async function() {
    var bare = {
      getCharacter: function() { return {}; },
      setCharacter: function() {},
      getWorldbook: function() { return []; },
      setWorldbook: function() {},
    };
    var ex = createToolExecutor(bare);
    var cases = [
      ['search_novel_passages', { query: 'x' }, /小说检索桥接未就绪/],
      ['list_novel_entities', {}, /知识库桥接未就绪/],
      ['list_cards', {}, /多卡桥接未就绪/],
      ['expand_character_field', { field: 'charDesc' }, /角色字段扩写桥接未就绪/],
      ['rewrite_greeting', { target: 'main' }, /开场白桥接未就绪/],
    ];
    for (var ci = 0; ci < cases.length; ci++) {
      var c = cases[ci];
      var r = await ex.executeConfirmed(c[0], c[1]);
      assert.equal(r.ok, false);
      assert.match(r.error, c[2]);
    }
  });
});
