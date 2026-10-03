import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { waitForLazyPromise, runWhenIdbReady, markIdbReady, IDB_READY_FLAG } from '../src/lib/idbReady.mjs';

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

describe('runWhenIdbReady', function() {
  it('旗标已置位时立刻跑，不再听事件', function() {
    var n = 0;
    var listened = false;
    var win = { addEventListener: function() { listened = true; } };
    win[IDB_READY_FLAG] = true;
    runWhenIdbReady(function() { n += 1; }, win);
    assert.equal(n, 1);
    assert.equal(listened, false);
  });

  it('句柄已挂上时立刻跑', function() {
    var n = 0;
    runWhenIdbReady(function() { n += 1; }, { __idbReady__: Promise.resolve(null) });
    assert.equal(n, 1);
  });

  it('尚未就绪时等事件，同一轮只跑一次', function() {
    var n = 0;
    var listeners = [];
    var win = {
      addEventListener: function(type, fn) { listeners.push(fn); },
      dispatchEvent: function(ev) {
        listeners.slice().forEach(function(fn) { fn(ev); });
      },
    };
    runWhenIdbReady(function() { n += 1; }, win);
    assert.equal(n, 0);
    markIdbReady(win);
    markIdbReady(win);
    assert.equal(n, 1);
    assert.equal(win[IDB_READY_FLAG], true);
  });
});
