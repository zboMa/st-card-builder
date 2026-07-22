import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  enqueueOutbox,
  flushOutbox,
  getOutboxSize,
  clearOutbox,
  peekOutbox,
  OUTBOX_KEY,
} from '../src/lib/sync/outbox.mjs';

function mockStorage() {
  var map = {};
  return {
    getItem: function(k) { return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null; },
    setItem: function(k, v) { map[k] = String(v); },
    removeItem: function(k) { delete map[k]; },
  };
}

describe('cloud outbox', function() {
  var prev;
  beforeEach(function() {
    prev = globalThis.localStorage;
    globalThis.localStorage = mockStorage();
    clearOutbox();
  });
  afterEach(function() {
    globalThis.localStorage = prev;
  });

  it('enqueue dedupes by key', function() {
    enqueueOutbox({ op: 'putCard', cardId: 'a', body: { data: { v: 1 } }, dedupeKey: 'putCard:a' });
    enqueueOutbox({ op: 'putCard', cardId: 'a', body: { data: { v: 2 } }, dedupeKey: 'putCard:a' });
    assert.equal(getOutboxSize(), 1);
    assert.equal(peekOutbox()[0].body.data.v, 2);
  });

  it('flush success clears queue', async function() {
    enqueueOutbox({ op: 'putCard', cardId: 'a', dedupeKey: 'putCard:a' });
    var r = await flushOutbox(async function() { return; });
    assert.equal(r.flushed, 1);
    assert.equal(r.remaining, 0);
    assert.equal(getOutboxSize(), 0);
  });

  it('flush keeps item on network-like error', async function() {
    enqueueOutbox({ op: 'putCard', cardId: 'a', dedupeKey: 'putCard:a' });
    var r = await flushOutbox(async function() {
      var e = new Error('offline');
      throw e;
    });
    assert.equal(r.flushed, 0);
    assert.equal(r.remaining, 1);
  });

  it('uses OUTBOX_KEY', function() {
    enqueueOutbox({ op: 'x', dedupeKey: 'x' });
    assert.ok(localStorage.getItem(OUTBOX_KEY));
  });
});
