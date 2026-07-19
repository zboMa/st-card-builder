/**
 * 等待「稍后挂到 window 上的 IDB Promise」（事件驱动优化 + 轮询回退）
 */

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
