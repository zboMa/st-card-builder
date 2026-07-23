/**
 * 小说 RAG / Entity Store 单元测试
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chunkChapters } from '../src/lib/novel/rag/chunker.mjs';
import { cosineSimilarity, vectorSearchChunks } from '../src/lib/novel/rag/vectorSearch.mjs';
import { rrfMerge, truncateByBudget } from '../src/lib/novel/rag/hybridSearch.mjs';
import { extractQueryTerms, keywordSearchChapters } from '../src/lib/novel/rag/keywordSearch.mjs';
import { hybridSearch } from '../src/lib/novel/rag/hybridSearch.mjs';
import { buildRagInjectBlock, pickRelatedEntities, expandEntitiesViaRelations, formatRelationContextLines } from '../src/lib/novel/rag/inject.mjs';
import {
  upsertEntity,
  findEntityMatch,
  projectEntitiesToLegacy,
  countEntitiesByType,
  isEntityEnriched,
} from '../src/lib/novel/entityStore.mjs';
import { applySkeletonResult } from '../src/lib/novel/analyzePipeline.mjs';
import { createDefaultNovelState } from '../src/lib/novel/state.mjs';

describe('novel RAG', function() {
  it('chunkChapters 按窗口切块并重叠', function() {
    var chapters = [{ id: '1', title: '一', text: '甲'.repeat(1000), enabled: true }];
    var chunks = chunkChapters(chapters, { chunkSize: 400, overlap: 50 });
    assert.ok(chunks.length >= 2);
    assert.equal(chunks[0].chapterId, '1');
    assert.ok(chunks[0].text.length <= 400);
  });

  it('extractQueryTerms / keywordSearch 可命中', function() {
    var terms = extractQueryTerms('秦月在长安城遇见了月儿');
    assert.ok(terms.indexOf('秦月') >= 0 || terms.some(function(t) { return t.indexOf('秦') >= 0; }));
    var nlTerms = extractQueryTerms('主角和女主第一次见面的场景');
    assert.ok(nlTerms.indexOf('见面') >= 0, '应拆出 见面，得 ' + JSON.stringify(nlTerms));
    assert.ok(nlTerms.some(function(t) { return t.indexOf('女主') >= 0 || t === '女主'; }), '应拆出女主相关词');
    var chapters = [
      { id: '1', title: '一', text: '秦月走在长安街上，月儿在身后叫她。', enabled: true },
    ];
    var hits = keywordSearchChapters(chapters, '秦月 长安', { budget: 5000 });
    assert.ok(hits.length >= 1);
    assert.match(hits[0].text, /秦月|长安/);
    var boosted = keywordSearchChapters(chapters, '怎么样', {
      budget: 5000,
      extraTerms: ['秦月'],
    });
    assert.ok(boosted.length >= 1);
    assert.match(boosted[0].text, /秦月/);
  });

  it('自然语言问句可命中关键词（非整句字面匹配）', function() {
    var chapters = [
      {
        id: '1',
        title: '初遇',
        text: '林月与陈锋在长安街角初次见面。两人目光交汇，林月微微一笑。',
        enabled: true,
      },
    ];
    var hits = keywordSearchChapters(chapters, '主角和女主第一次见面的场景', {
      budget: 5000,
      extraTerms: ['林月', '陈锋'],
    });
    assert.ok(hits.length >= 1, '自然语言 query 应通过拆词+实体名命中');
    assert.match(hits[0].text, /见面|林月|陈锋/);
  });

  it('expandEntitiesViaRelations 图谱 1-hop 扩展', function() {
    var ents = [
      { id: 'p1', name: '甲', type: 'person' },
      { id: 'f1', name: '乙派', type: 'faction' },
    ];
    var rels = [{ fromId: 'p1', toId: 'f1', rel: '隶属' }];
    var expanded = expandEntitiesViaRelations([ents[0]], ents, rels, 4);
    assert.equal(expanded.length, 2);
    var lines = formatRelationContextLines(expanded, rels, ents);
    assert.match(lines[0], /隶属/);
  });

  it('cosineSimilarity / vectorSearch / RRF', function() {
    assert.ok(cosineSimilarity([1, 0], [1, 0]) > 0.99);
    assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
    var chunks = [
      { id: 'a', text: 'A', embedding: [1, 0, 0] },
      { id: 'b', text: 'B', embedding: [0.9, 0.1, 0] },
      { id: 'c', text: 'C', embedding: [0, 1, 0] },
    ];
    var top = vectorSearchChunks([1, 0, 0], chunks, { topK: 2 });
    assert.equal(top[0].id, 'a');
    var merged = rrfMerge([
      [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
      [{ id: 'b', text: 'B' }, { id: 'c', text: 'C' }],
    ]);
    assert.ok(merged[0].id === 'b' || merged[0].rrf > 0);
    var cut = truncateByBudget([{ text: 'x'.repeat(100) }, { text: 'y'.repeat(100) }], 150);
    assert.ok(cut.totalChars <= 150, 'budget truncate got ' + cut.totalChars);
    assert.ok(cut.snippets.length >= 1);
  });

  it('searchPassages 实体二次检索：匹配 query 的实体才 boost，无匹配时不应固定回退', async function() {
    var chapters = [
      { id: '1', title: '一', text: '林月走在长安街上，剑光闪动。', enabled: true },
      { id: '2', title: '二', text: '王强在东海捕鱼，遇见风暴。', enabled: true },
    ];
    var entities = [
      { name: '林月', aliases: [], summary: '女主' },
      { name: '王强', aliases: [], summary: '渔夫' },
      { name: '青云宗', aliases: ['剑宗'], summary: '门派' },
    ];
    var emptyIndex = { chunks: [] };

    async function searchLikePassages(query) {
      var q = String(query || '').trim();
      var search = await hybridSearch({ chapters: chapters, query: q, budget: 5000, topK: 8, index: emptyIndex });
      if (!search.snippets.length && q && entities.length) {
        var seeds = pickRelatedEntities(entities, q, 4, { fallback: 0 });
        var entityTerms = [];
        seeds.forEach(function(e) {
          if (e && e.name) entityTerms.push(e.name);
          (e.aliases || []).forEach(function(a) { if (a) entityTerms.push(a); });
        });
        if (entityTerms.length) {
          search = await hybridSearch({
            chapters: chapters,
            query: entityTerms.slice(0, 8).join(' '),
            budget: 5000,
            topK: 8,
            index: emptyIndex,
            entityBoost: true,
          });
        }
      }
      return search.body;
    }

    var bodyLin = await searchLikePassages('林月');
    var bodyWang = await searchLikePassages('王强');
    assert.notEqual(bodyLin, bodyWang);
    assert.match(bodyLin, /林月/);
    assert.match(bodyWang, /王强/);

    var unrelatedA = await searchLikePassages('今天天气怎么样');
    var unrelatedB = await searchLikePassages('帮我写一段大纲');
    assert.equal(unrelatedA, '');
    assert.equal(unrelatedB, '');
    assert.equal(unrelatedA, unrelatedB);
  });

  it('buildRagInjectBlock 含原文与规则', function() {
    var block = buildRagInjectBlock(
      { body: '片段正文', mode: 'hybrid' },
      [{ type: 'person', name: '秦月', summary: '女主' }]
    );
    assert.match(block, /相关小说原文/);
    assert.match(block, /秦月/);
    assert.match(block, /使用规则/);
    var picked = pickRelatedEntities(
      [{ name: '秦月', type: 'person', summary: '女主' }, { name: '长安', type: 'location' }],
      '秦月怎么样',
      5
    );
    assert.equal(picked[0].name, '秦月');
  });
});

describe('novel entityStore', function() {
  it('upsert 别名合并 + 投影', function() {
    var entities = [];
    upsertEntity(entities, { type: 'person', name: '秦月', aliases: ['月儿'], summary: '女主' });
    var longContent = '这是足够长的人物条目正文，用于通过丰满度字数门槛与溯源检查要求。'.repeat(5);
    var r = upsertEntity(entities, {
      type: 'person',
      name: '月儿',
      content: longContent,
      provenance: [{ quote: '原文摘录' }],
      profile: { 'Chinese name': '秦月', identity: ['女主'] },
    });
    assert.equal(r.action, 'merge');
    assert.equal(entities.length, 1);
    assert.ok(findEntityMatch(entities, '秦月', []));
    assert.ok(entities[0].content.length >= 120);
    assert.ok((entities[0].provenance || []).length >= 1);
    assert.ok(isEntityEnriched(entities[0], true), 'enriched check failed');
    // event：strict 需 when/where/participants + cause|effect
    var evBare = {
      type: 'event',
      content: '这是足够长的事件正文用于通过字数门槛检查一二三四五六七八九十。'.repeat(4),
      provenance: [{ quote: '宴' }],
      attrs: { participants: ['秦月'], effect: '结识' },
    };
    assert.equal(isEntityEnriched(evBare, true), false);
    evBare.attrs.when = '夜';
    evBare.attrs.where = '长安';
    assert.ok(isEntityEnriched(evBare, true));

    var state = createDefaultNovelState();
    state.entities = entities;
    state.relations = [{ id: 'r1', fromId: entities[0].id, toId: 'x', rel: '相关', evidence: [] }];
    upsertEntity(state.entities, { type: 'location', name: '长安', content: '帝都设定正文足够长度啦啦啦啦啦啦啦啦啦啦啦啦啦啦啦' });
    // 修关系指向存在的地点
    var loc = findEntityMatch(state.entities, '长安', []);
    state.relations[0].toId = loc.id;
    projectEntitiesToLegacy(state);
    assert.equal(state.characters.length, 1);
    assert.ok(state.wbEntries.some(function(w) { return w.name === '长安'; }));
    assert.ok(state.knowledgeGraph.nodes.length >= 2);
    var counts = countEntitiesByType(state.entities);
    assert.equal(counts.person, 1);
    assert.equal(counts.location, 1);
  });

  it('applySkeletonResult 增量写入 event', function() {
    var state = createDefaultNovelState();
    applySkeletonResult(state, {
      entities: [
        { type: 'person', name: '秦月', aliases: ['月儿'] },
        { type: 'event', name: '长安夜宴', summary: '宴会', attrs: { participants: ['秦月'], effect: '结识权贵' } },
      ],
      relations: [{ from: '秦月', to: '长安夜宴', rel: '参与', evidence: ['卷一'] }],
    });
    assert.ok(state.entities.length >= 2);
    assert.ok(state.entities.some(function(e) { return e.type === 'event'; }));
    assert.ok(state.relations.length >= 1);
  });

  it('主角锚点不进人物列表，关系端点保留', function() {
    var state = createDefaultNovelState();
    state.setupCharName = '秦月';
    applySkeletonResult(state, {
      entities: [
        { type: 'person', name: '秦月', aliases: ['月儿'] },
        { type: 'person', name: '李长青' },
        { type: 'faction', name: '青云门', summary: '门派' },
      ],
      relations: [
        { from: '秦月', to: '李长青', rel: '师徒', evidence: ['卷一'] },
        { from: '李长青', to: '青云门', rel: '隶属', evidence: ['卷一'] },
      ],
    });
    assert.equal(state.characters.some(function(c) { return c.name === '秦月'; }), false);
    assert.ok(state.characters.some(function(c) { return c.name === '李长青'; }));
    var protag = state.entities.find(function(e) {
      return e.type === 'person' && (e.role === 'protagonist' || (e.attrs && e.attrs.role === 'protagonist'));
    });
    assert.ok(protag);
    assert.equal(protag.name, '秦月');
    assert.ok(state.knowledgeGraph.nodes.some(function(n) { return n.id === protag.id; }));
    assert.ok(state.relations.some(function(r) {
      return r.fromId === protag.id || r.toId === protag.id;
    }));
    assert.equal(state.entities.filter(function(e) {
      return e.type === 'person' && e.name === '秦月';
    }).length, 1);
  });

  it('event.participants 投影为跨类型边', function() {
    var state = createDefaultNovelState();
    applySkeletonResult(state, {
      entities: [
        { type: 'person', name: '李长青' },
        {
          type: 'event',
          name: '长安夜宴',
          summary: '宴会',
          attrs: { participants: ['李长青'], where: '长安', effect: '结识' },
        },
        { type: 'location', name: '长安', summary: '帝都' },
      ],
      relations: [],
    });
    assert.ok(state.relations.some(function(r) { return r.rel === '参与'; }));
    assert.ok(state.relations.some(function(r) { return r.rel === '发生于'; }));
  });

  it('analyzeFocus 过滤未勾选类型的新建', function() {
    var state = createDefaultNovelState();
    state.analyzeFocus = ['person', 'event'];
    applySkeletonResult(state, {
      entities: [
        { type: 'person', name: '甲' },
        { type: 'item', name: '神剑' },
        { type: 'event', name: '决战' },
      ],
    });
    assert.ok(state.entities.some(function(e) { return e.name === '甲'; }));
    assert.ok(state.entities.some(function(e) { return e.name === '决战'; }));
    assert.equal(state.entities.some(function(e) { return e.name === '神剑'; }), false);
  });

  it('工坊无名时 resolveProtagonistName 回退主卡', async function() {
    var { resolveProtagonistName } = await import('../src/lib/novel/protagonist.mjs');
    var state = createDefaultNovelState();
    state.setupCharName = '';
    globalThis.window = {
      __getCharacterFields__: function() { return { charName: '卡面主角' }; },
    };
    var p = resolveProtagonistName(state);
    assert.equal(p.name, '卡面主角');
    assert.equal(p.source, 'card');
    delete globalThis.window;
  });
});
