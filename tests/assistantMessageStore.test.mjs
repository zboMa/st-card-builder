import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendMessage,
  clearMessages,
  getMessageAt,
  getMessageById,
  getMessages,
  insertMessageAt,
  patchMessageAt,
  removeMessageAt,
  replaceAllMessages,
  replaceMessageAt,
} from '../src/lib/store/assistantMessageStore.mjs';

describe('assistantMessageStore', function() {
  beforeEach(function() {
    clearMessages();
  });

  it('normalizes legacy messages with stable ids', function() {
    replaceAllMessages([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ]);
    var list = getMessages();
    assert.equal(list.length, 2);
    assert.equal(typeof list[0].id, 'string');
    assert.notEqual(list[0].id, list[1].id);
    assert.equal(getMessageById(list[1].id).content, 'hi');
    assert.equal(getMessageAt(0).content, 'hello');
  });

  it('appends and patches without replacing unchanged records', function() {
    var first = appendMessage({ role: 'user', content: 'hello' });
    var second = appendMessage({ role: 'assistant', content: 'hi' });
    var before = getMessages();
    assert.equal(before[0], first);
    assert.equal(before[1], second);

    var patched = patchMessageAt(1, { content: 'hello again' });
    var after = getMessages();
    assert.equal(after[0], first);
    assert.notEqual(after[1], second);
    assert.equal(after[1], patched);
    assert.equal(after[1].content, 'hello again');
  });

  it('replaces by index while keeping the row id', function() {
    var first = appendMessage({ role: 'tool', content: 'running' });
    var replaced = replaceMessageAt(0, { role: 'tool', content: 'done' });
    assert.equal(replaced.id, first.id);
    assert.equal(getMessages()[0].id, first.id);
    assert.equal(getMessages()[0].content, 'done');
  });

  it('inserts and removes records by order', function() {
    appendMessage({ id: 'a', role: 'user', content: 'a' });
    appendMessage({ id: 'c', role: 'assistant', content: 'c' });
    insertMessageAt(1, { id: 'b', role: 'assistant', content: 'b' });
    assert.deepEqual(getMessages().map(function(m) { return m.id; }), ['a', 'b', 'c']);

    assert.equal(removeMessageAt(1), true);
    assert.deepEqual(getMessages().map(function(m) { return m.id; }), ['a', 'c']);
    assert.equal(removeMessageAt(9), false);
  });
});
