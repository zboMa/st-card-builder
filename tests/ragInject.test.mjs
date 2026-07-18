/**
 * 助手 RAG 注入：去重键、过滤、user 消息绑定
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  snippetKey,
  filterNewSnippets,
  collectSnippetKeys,
  buildRagUserBlock,
  buildRagPreviewPayload,
  buildUserModelContent,
  messageContentForModel,
  messageContentForDisplay,
  pickRelatedEntities,
  formatRagPreviewMeta,
  formatIndexStatusHint,
  formatRelationContextLines,
} from '../src/lib/assistant/ragInject.mjs';

describe('ragInject', function() {
  it('snippetKey 优先 id，否则指纹', function() {
    assert.equal(snippetKey({ id: 'chk_1_0' }), 'chk_1_0');
    assert.equal(
      snippetKey({ chapterId: 'c1', start: 10, text: 'hello world' }),
      'c1:10:hello world',
    );
  });

  it('filterNewSnippets 排除已注入片段', function() {
    var snippets = [
      { id: 'a', text: 'one' },
      { id: 'b', text: 'two' },
      { id: 'c', text: 'three' },
    ];
    var fresh = filterNewSnippets(snippets, ['a', 'c']);
    assert.deepEqual(fresh.map(function(s) { return s.id; }), ['b']);
  });

  it('buildUserModelContent 拼接 RAG 块', function() {
    var full = buildUserModelContent('问题', '【相关小说原文】\nx');
    assert.match(full, /^问题\n\n【相关小说原文】/);
    assert.equal(buildUserModelContent('仅问题', ''), '仅问题');
  });

  it('messageContentForModel / display 分离', function() {
    var msg = { content: '显示', modelContent: '显示\n\nRAG' };
    assert.equal(messageContentForDisplay(msg), '显示');
    assert.equal(messageContentForModel(msg), '显示\n\nRAG');
  });

  it('buildRagUserBlock 含实体与模式', function() {
    var block = buildRagUserBlock({
      snippets: [{ id: 'x', chapterTitle: '第一章', text: '片段' }],
      mode: 'hybrid',
      relatedEntities: [{ type: 'char', name: 'Alice', summary: '主角' }],
      ragHint: '提示',
    });
    assert.match(block, /提示/);
    assert.match(block, /hybrid/);
    assert.match(block, /Alice/);
    assert.match(block, /片段/);
  });

  it('collectSnippetKeys 收集键', function() {
    assert.deepEqual(
      collectSnippetKeys([{ id: 'a' }, { chapterId: 'c', start: 0, text: 't' }]),
      ['a', 'c:0:t'],
    );
  });

  it('pickRelatedEntities 按查询词匹配', function() {
    var ents = [
      { name: '林月', aliases: [], summary: '剑修' },
      { name: '青云宗', aliases: ['剑宗'], summary: '门派' },
      { name: '路人', aliases: [], summary: '无关' },
    ];
    var related = pickRelatedEntities('林月 剑宗', ents, { limit: 4, fallback: 1 });
    assert.ok(related.some(function(e) { return e.name === '林月'; }));
    assert.ok(related.some(function(e) { return e.name === '青云宗'; }));
    assert.equal(pickRelatedEntities('xyz', ents, { fallback: 2 }).length, 2);
  });

  it('buildRagPreviewPayload 含去重统计', function() {
    var payload = buildRagPreviewPayload({
      snippets: [{ id: 'b', text: 'two' }],
      allSnippets: [{ id: 'a', text: 'one' }, { id: 'b', text: 'two' }],
      mode: 'hybrid',
      relatedEntities: [{ type: 'char', name: 'Alice' }],
      source: 'preview',
      query: '测试',
    });
    assert.equal(payload.dedupeSkipped, 1);
    assert.equal(payload.dedupeTotal, 2);
    assert.match(payload.ragBody, /hybrid/);
    assert.deepEqual(payload.injectedKeys, ['b']);
  });

  it('buildRagPreviewPayload 预览模式展示全部片段', function() {
    var payload = buildRagPreviewPayload({
      snippets: [{ id: 'b', text: 'two' }],
      allSnippets: [{ id: 'a', text: 'one' }, { id: 'b', text: 'two' }],
      previewOnly: true,
      mode: 'keyword',
    });
    assert.equal((payload.displaySnippets || []).length, 2);
    assert.match(payload.ragBody, /one/);
    assert.match(payload.ragBody, /two/);
  });

  it('formatIndexStatusHint 索引未就绪提示', function() {
    var hint = formatIndexStatusHint({ indexStatus: 'idle', indexReady: false, chunkCount: 0 });
    assert.match(hint, /未就绪/);
    assert.equal(formatIndexStatusHint({ indexReady: true }), '');
  });

  it('pickRelatedEntities 经 relations 扩展邻居', function() {
    var ents = [
      { id: 'e1', name: '林月', type: 'person', summary: '剑修' },
      { id: 'e2', name: '青云宗', type: 'faction', summary: '门派' },
      { id: 'e3', name: '路人', type: 'person', summary: '无关' },
    ];
    var relations = [{ fromId: 'e1', toId: 'e2', rel: '隶属', evidence: ['卷一'] }];
    var related = pickRelatedEntities('林月', ents, { relations: relations, limit: 6 });
    assert.ok(related.some(function(e) { return e.name === '林月'; }));
    assert.ok(related.some(function(e) { return e.name === '青云宗'; }));
    var lines = formatRelationContextLines(related, relations, ents);
    assert.ok(lines.some(function(l) { return l.indexOf('隶属') >= 0; }));
  });

  it('formatRagPreviewMeta 含索引状态', function() {
    var meta = formatRagPreviewMeta({
      mode: 'keyword',
      snippets: [{ id: 'a' }],
      indexMeta: { indexReady: false, indexStatus: 'idle' },
      source: 'preview',
    });
    assert.match(meta, /索引未就绪/);
  });

  it('formatRagPreviewMeta 汇总预览信息', function() {
    var meta = formatRagPreviewMeta({
      mode: 'keyword',
      snippets: [{ id: 'a' }],
      dedupeTotal: 2,
      dedupeSkipped: 1,
      relatedEntities: [{ name: 'A' }, { name: 'B' }],
      source: 'preview',
      query: '问',
    });
    assert.match(meta, /keyword/);
    assert.match(meta, /1\/2/);
    assert.match(meta, /去重跳过 1/);
    assert.match(meta, /实体 2/);
    assert.match(meta, /预览/);
  });
});
