/**
 * 分析失败列表按「同一条」收口：骨架看分片号，丰满看实体 id。
 */

export function failedShardKey(rec) {
  var f = rec || {};
  if (f.phase === 'skeleton' && typeof f.shardIndex === 'number') return 'skeleton:' + f.shardIndex;
  if (f.phase === 'enrich' && f.entityId) return 'enrich:' + String(f.entityId);
  return String(f.phase || '') + ':' + String(f.label || '');
}

/** 同一键只留时间更新的一条。无时间时后写入的覆盖先写入的。 */
export function collapseFailedShards(list) {
  var out = [];
  var index = {};
  (list || []).forEach(function(f) {
    if (!f) return;
    var key = failedShardKey(f);
    var at = index[key];
    if (at == null) {
      index[key] = out.length;
      out.push(f);
      return;
    }
    var prevAt = String(out[at].at || '');
    var nextAt = String(f.at || '');
    if (!prevAt || (nextAt && nextAt >= prevAt)) out[at] = f;
  });
  return out;
}

export function upsertFailedShard(list, rec) {
  var next = Object.assign({ at: new Date().toISOString() }, rec || {});
  var key = failedShardKey(next);
  var kept = (list || []).filter(function(f) { return failedShardKey(f) !== key; });
  kept.push(next);
  return kept;
}
