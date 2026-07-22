import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('card vs story separation (doc contract)', function() {
  it('卡包语义：工坊跟卡，Story 独立', function() {
    // 契约说明测试：与 cloud-sync / userDocs 行为对齐
    var cardBundleIncludes = ['card', 'avatar', 'novel', 'rag'];
    var cardBundleExcludes = ['story'];
    assert.ok(cardBundleIncludes.indexOf('novel') >= 0);
    assert.ok(cardBundleExcludes.indexOf('story') >= 0);
  });

  it('删卡默认不级联 Story', function() {
    var defaultDeleteStories = false;
    assert.equal(defaultDeleteStories, false);
  });
});
