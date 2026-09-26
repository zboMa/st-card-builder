import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pickAutoChannelForTest, FEEDBACK_INLINE_IDS } from '../src/lib/ui/appMessage.mjs';

describe('appFeedback routing', function() {
  it('exports inline whitelist', function() {
    assert.ok(FEEDBACK_INLINE_IDS.indexOf('syncStatusLine') >= 0);
    assert.ok(FEEDBACK_INLINE_IDS.indexOf('auditStatus') >= 0);
    assert.equal(FEEDBACK_INLINE_IDS.indexOf('assistantStatusTip'), -1);
  });

  it('auto picks notify for error', function() {
    assert.equal(pickAutoChannelForTest({ message: 'x', level: 'error' }), 'notify');
  });

  it('auto picks toast for short success', function() {
    assert.equal(pickAutoChannelForTest({ message: '已保存', level: 'success' }), 'toast');
  });

  it('auto picks notify for long text', function() {
    var long = 'a'.repeat(130);
    assert.equal(pickAutoChannelForTest({ message: long, level: 'info' }), 'notify');
  });
});
