/**
 * 备选开场白写入位置。
 * index 小于当前条数：改已有。等于当前条数且允许追加：新开一条。跳号拒绝。
 * @param {number} count 当前备选条数
 * @param {number} index 目标序号
 * @param {boolean} allowCreate 生成工具可在下一号追加；短改不可以
 * @returns {{ ok: true, index: number, create: boolean } | { ok: false, error: string }}
 */
export function resolveAlternateGreetingSlot(count, index, allowCreate) {
  var n = Math.max(0, Math.floor(Number(count) || 0));
  var bad = typeof index !== 'number' || !Number.isFinite(index) || index < 0 || index % 1 !== 0
    || index > n || (index === n && !allowCreate);
  if (bad) {
    return { ok: false, error: '备选开场白序号越界（当前 ' + n + ' 条，下一号是 ' + n + '）' };
  }
  return { ok: true, index: index, create: index === n };
}
