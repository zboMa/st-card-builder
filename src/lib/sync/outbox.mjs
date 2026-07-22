/**
 * 离线 outbox：未登录 / 断网时排队，上线后 flush
 * 存 localStorage，保证全离线能力不丢云端意图
 */
var OUTBOX_KEY = 'st_v3_cloud_outbox_v1';
var MAX_ITEMS = 200;

function readQueue() {
  if (typeof localStorage === 'undefined') return [];
  try {
    var raw = JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch (e) {
    return [];
  }
}

function writeQueue(items) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(items.slice(-MAX_ITEMS)));
  } catch (e) {
    console.warn('[cloud] outbox write failed', e);
  }
}

export function getOutboxSize() {
  return readQueue().length;
}

export function peekOutbox() {
  return readQueue().slice();
}

export function clearOutbox() {
  writeQueue([]);
}

/**
 * @param {{ op: string, path?: string, body?: object, cardId?: string, dedupeKey?: string }} item
 */
export function enqueueOutbox(item) {
  if (!item || !item.op) return;
  var q = readQueue();
  var key = item.dedupeKey || (item.op + ':' + (item.path || '') + ':' + (item.cardId || ''));
  // 同 key 只保留最新
  q = q.filter(function(x) { return x && x.dedupeKey !== key; });
  q.push({
    op: item.op,
    path: item.path || '',
    body: item.body || null,
    cardId: item.cardId || '',
    dedupeKey: key,
    enqueuedAt: new Date().toISOString(),
  });
  writeQueue(q);
  return q.length;
}

/**
 * @param {(item: object) => Promise<void>} handler
 */
export async function flushOutbox(handler) {
  var q = readQueue();
  if (!q.length) return { flushed: 0, remaining: 0 };
  var remain = [];
  var flushed = 0;
  for (var i = 0; i < q.length; i++) {
    var item = q[i];
    try {
      await handler(item);
      flushed += 1;
    } catch (e) {
      if (e && e.status === 401) {
        remain = remain.concat(q.slice(i));
        break;
      }
      // 临时网络错误：保留后续重试；明确 4xx（非 401/409）丢弃避免死循环
      var st = e && e.status;
      if (st && st >= 400 && st < 500 && st !== 409) {
        console.warn('[cloud] outbox drop', item && item.dedupeKey, e);
        continue;
      }
      remain.push(item);
    }
  }
  writeQueue(remain);
  return { flushed: flushed, remaining: remain.length };
}

export { OUTBOX_KEY };
