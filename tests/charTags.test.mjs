/**
 * 角色标签规范化、合并、上下文截断与 AI 解析契约
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCharTags,
  tagsFromCardJson,
  mergeCharTags,
  buildTagGenContext,
  parseTagsFromAiText,
  clampTagContextChars,
  DEFAULT_TAG_CONTEXT_CHARS,
} from '../src/lib/charTags.mjs';

describe('charTags helpers', function() {
  it('normalizeCharTags 去空、trim、保序去重', function() {
    assert.deepEqual(
      normalizeCharTags(['  奇幻 ', '恋爱', '奇幻', '', null, '恋爱']),
      ['奇幻', '恋爱']
    );
    assert.deepEqual(normalizeCharTags(null), []);
    assert.deepEqual(normalizeCharTags('x'), []);
  });

  it('tagsFromCardJson 优先 data.tags，否则顶层 tags', function() {
    assert.deepEqual(
      tagsFromCardJson({ tags: ['顶层'], data: { tags: ['data层', '  data层 '] } }),
      ['data层']
    );
    assert.deepEqual(tagsFromCardJson({ tags: ['仅顶层', ''] }), ['仅顶层']);
    assert.deepEqual(tagsFromCardJson({ data: {} }), []);
    assert.deepEqual(tagsFromCardJson(null), []);
  });

  it('mergeCharTags 保留已有并追加去重', function() {
    assert.deepEqual(
      mergeCharTags(['奇幻', '恋爱'], ['恋爱', '强势', ' 奇幻 ']),
      ['奇幻', '恋爱', '强势']
    );
    assert.deepEqual(mergeCharTags([], ['a', 'a']), ['a']);
  });

  it('clampTagContextChars 默认 12k', function() {
    assert.equal(DEFAULT_TAG_CONTEXT_CHARS, 12000);
    assert.equal(clampTagContextChars(undefined), 12000);
    assert.equal(clampTagContextChars(500), 12000);
    assert.equal(clampTagContextChars(8000), 8000);
    assert.equal(clampTagContextChars(999999), 200000);
  });

  it('buildTagGenContext 含设定/开场并按上限截断世界书', function() {
    var ctx = buildTagGenContext({
      description: '角色描述ABC',
      firstMes: '开场白XYZ',
      altGreetings: ['备选1'],
      worldbookEntries: [
        { comment: '条目1', content: '内容一'.repeat(20) },
        { comment: '条目2', content: '内容二'.repeat(20) },
      ],
    }, 80);
    assert.match(ctx, /【角色设定】/);
    assert.match(ctx, /【开场白】/);
    assert.ok(ctx.length <= 80);
    // 配置钳制仍默认 12k；build 可接受更小显式上限
    assert.equal(clampTagContextChars(80), 12000);
  });

  it('parseTagsFromAiText 支持数组/对象/逗号兜底', function() {
    assert.deepEqual(parseTagsFromAiText('["奇幻","恋爱"]'), ['奇幻', '恋爱']);
    assert.deepEqual(parseTagsFromAiText('前缀 {"tags":["A","B"]} 后缀'), ['A', 'B']);
    assert.deepEqual(parseTagsFromAiText('奇幻，恋爱、强势'), ['奇幻', '恋爱', '强势']);
    assert.deepEqual(parseTagsFromAiText(''), []);
  });
});
