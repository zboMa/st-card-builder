import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { waitForLazyPromise } from '../src/lib/idbReady.mjs';

describe('waitForLazyPromise', function() {
  it('已有 Promise 时直接等待其结果', async function() {
    var out = await waitForLazyPromise(function() {
      return Promise.resolve('ok');
    });
    assert.equal(out, 'ok');
  });

  it('已有 Promise reject 时得到 null', async function() {
    var out = await waitForLazyPromise(function() {
      return Promise.reject(new Error('fail'));
    });
    assert.equal(out, null);
  });

  it('稍后挂载的 Promise 会被等到', async function() {
    var slot = null;
    setTimeout(function() {
      slot = Promise.resolve('late');
    }, 40);
    var out = await waitForLazyPromise(function() { return slot; }, {
      timeoutMs: 1000,
      intervalMs: 10,
    });
    assert.equal(out, 'late');
  });

  it('超时未挂载时返回 null', async function() {
    var out = await waitForLazyPromise(function() { return null; }, {
      timeoutMs: 50,
      intervalMs: 10,
    });
    assert.equal(out, null);
  });
});
