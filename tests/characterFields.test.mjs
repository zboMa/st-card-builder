/**
 * 角色字段别名归一：规范名、ST 遗留字段映射
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCharacterFieldKey,
  normalizeCharacterPatch,
} from '../src/lib/assistant/characterFields.mjs';

describe('characterFields normalize', function() {
  it('postHistoryInstructions → creatorNotes', function() {
    assert.equal(normalizeCharacterFieldKey('postHistoryInstructions'), 'creatorNotes');
    assert.equal(normalizeCharacterFieldKey('post_history_instructions'), 'creatorNotes');
    var norm = normalizeCharacterPatch({ postHistoryInstructions: '作者注' });
    assert.equal(norm.fields.creatorNotes, '作者注');
    assert.deepEqual(norm.mapped, [{ from: 'postHistoryInstructions', to: 'creatorNotes' }]);
    assert.deepEqual(norm.ignored, []);
  });

  it('规范名直通、tags 逗号拆分', function() {
    var norm = normalizeCharacterPatch({
      charName: '林月',
      charDesc: '剑修',
      tags: '奇幻,恋爱',
    });
    assert.equal(norm.fields.charName, '林月');
    assert.equal(norm.fields.charDesc, '剑修');
    assert.deepEqual(norm.fields.tags, ['奇幻', '恋爱']);
    assert.deepEqual(norm.ignored, []);
  });

  it('未知字段进入 ignored', function() {
    var norm = normalizeCharacterPatch({ fooBar: 'x', avatar: 'y' });
    assert.deepEqual(Object.keys(norm.fields), []);
    assert.deepEqual(norm.ignored.sort(), ['avatar', 'fooBar']);
  });
});
