/**
 * 同一次任务内的自动重试。取消立即停止，不占第二次请求。
 */

export var ANALYZE_AUTO_ATTEMPTS = 2;
export var ANALYZE_AUTO_RETRY_DELAY_MS = 1000;

export function isRetryAbort(err, signal) {
  if (signal && signal.aborted) return true;
  if (!err) return false;
  if (err.name === 'AbortError') return true;
  var msg = String(err.message || err || '');
  return /abort|取消|已停止|The user aborted/i.test(msg);
}

function delay(ms, signal) {
  return new Promise(function(resolve, reject) {
    if (signal && signal.aborted) {
      reject(new DOMException('已取消', 'AbortError'));
      return;
    }
    var timer = setTimeout(function() {
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new DOMException('已取消', 'AbortError'));
    }
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * @param {(attempt: number) => Promise<any>} fn attempt 从 0 起
 * @param {{ signal?: AbortSignal, attempts?: number, delayMs?: number, onRetry?: (nextAttempt: number, err: Error) => void }} [opts]
 */
export async function runWithAutoRetry(fn, opts) {
  opts = opts || {};
  var attempts = opts.attempts || ANALYZE_AUTO_ATTEMPTS;
  var delayMs = opts.delayMs != null ? opts.delayMs : ANALYZE_AUTO_RETRY_DELAY_MS;
  var last = null;
  for (var i = 0; i < attempts; i++) {
    if (opts.signal && opts.signal.aborted) {
      throw new DOMException('已取消', 'AbortError');
    }
    try {
      return await fn(i);
    } catch (e) {
      if (isRetryAbort(e, opts.signal)) throw e;
      last = e;
      if (i + 1 < attempts) {
        if (typeof opts.onRetry === 'function') opts.onRetry(i + 1, e);
        if (delayMs > 0) await delay(delayMs, opts.signal);
      }
    }
  }
  throw last;
}
