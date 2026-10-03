/**
 * 等待「稍后挂到 window 上的 IDB Promise」（事件驱动优化 + 轮询回退）
 * `st-idb-ready` 只发一次，且可能早于制卡 boot 的监听。句柄挂上时置 `__stIdbReady__`，错过事件的一方直接跑。
 */

export var IDB_READY_EVENT = 'st-idb-ready';
export var IDB_READY_FLAG = '__stIdbReady__';

export function markIdbReady(win) {
  var w = win || (typeof window !== 'undefined' ? window : null);
  if (!w) return;
  w[IDB_READY_FLAG] = true;
  if (typeof w.dispatchEvent !== 'function') return;
  try {
    w.dispatchEvent(new CustomEvent(IDB_READY_EVENT));
  } catch (e) { /* ignore */ }
}

/** 句柄已在则立刻跑；否则听一次事件。同一次调用不会跑两遍。 */
export function runWhenIdbReady(run, win) {
  var w = win || (typeof window !== 'undefined' ? window : null);
  if (!w || typeof run !== 'function') return;
  var started = false;
  function once() {
    if (started) return;
    started = true;
    run();
  }
  if (w[IDB_READY_FLAG] || w.__idbReady__) {
    once();
    return;
  }
  if (typeof w.addEventListener === 'function') {
    w.addEventListener(IDB_READY_EVENT, once, { once: true });
  }
}

/**
 * @param {() => (Promise<any>|null|undefined)} getter 返回已挂载的 Promise，或尚未挂载时返回空
 * @param {{ timeoutMs?: number, intervalMs?: number }} [opts]
 * @returns {Promise<any|null>}
 */
export function waitForLazyPromise(getter, opts) {
  opts = opts || {};
  var timeoutMs = opts.timeoutMs != null ? opts.timeoutMs : 10000;
  var intervalMs = opts.intervalMs != null ? opts.intervalMs : 100;
  var existing = typeof getter === 'function' ? getter() : null;
  if (existing) {
    return Promise.resolve(existing).catch(function() { return null; });
  }
  return new Promise(function(resolve) {
    var resolved = false;
    var started = Date.now();
    var timer = setInterval(function() {
      if (resolved) return;
      var cur = typeof getter === 'function' ? getter() : null;
      if (cur) {
        resolved = true;
        clearInterval(timer);
        Promise.resolve(cur).then(resolve, function() { resolve(null); });
      } else if (Date.now() - started >= timeoutMs) {
        resolved = true;
        clearInterval(timer);
        resolve(null);
      }
    }, intervalMs);

    if (typeof window !== 'undefined') {
      window.addEventListener('st-idb-ready', function onReady() {
        if (resolved) return;
        resolved = true;
        clearInterval(timer);
        var cur = typeof getter === 'function' ? getter() : null;
        if (cur) {
          Promise.resolve(cur).then(resolve, function() { resolve(null); });
        } else {
          resolve(null);
        }
      }, { once: true });
    }
  });
}
