/**
 * 卡内世界书条目 → 运行时形状
 *
 * ST selectiveLogic：
 *   AND_ANY: 0, NOT_ALL: 1, NOT_ANY: 2, AND_ALL: 3
 */

export var SELECTIVE_LOGIC = {
  AND_ANY: 0,
  NOT_ALL: 1,
  NOT_ANY: 2,
  AND_ALL: 3,
};

/**
 * @param {any} v
 * @param {number} fallback
 * @param {number} [min]
 * @param {number} [max]
 */
function clampInt(v, fallback, min, max) {
  var n = parseInt(v, 10);
  if (isNaN(n)) n = fallback;
  if (min !== undefined && n < min) n = min;
  if (max !== undefined && n > max) n = max;
  return n;
}

/**
 * @param {any} raw
 * @returns {string[]}
 */
function toStringArray(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(function(k) { return String(k == null ? '' : k).trim(); }).filter(Boolean);
}

/**
 * 将卡内 / 草稿条目规范为运行时 Entry
 * @param {any} raw
 * @param {number} [index]
 */
export function normalizeWorldInfoEntry(raw, index) {
  var e = raw && typeof raw === 'object' ? raw : {};
  var strategy = e.strategy;
  if (strategy !== 'constant' && strategy !== 'selective' && strategy !== 'vectorized') {
    if (e.constant === true) strategy = 'constant';
    else if (e.vectorized === true || (e.extensions && e.extensions.vectorized)) strategy = 'vectorized';
    else strategy = 'selective';
  }

  var ext = e.extensions && typeof e.extensions === 'object' ? e.extensions : {};
  var secondaryKeys = toStringArray(
    e.secondaryKeys != null ? e.secondaryKeys
      : (e.secondary_keys != null ? e.secondary_keys : [])
  );

  var prob = e.prob != null ? e.prob
    : (e.probability != null ? e.probability
      : (ext.probability != null ? ext.probability : 100));

  var order = e.order != null ? e.order
    : (e.insertion_order != null ? e.insertion_order : 100);

  var position = e.position;
  if (typeof position === 'string') {
    // ST 导出偶发字符串槽名；本仓库 UI 用 0–6
    position = ext.position != null ? ext.position : 4;
  }
  if (ext.position != null && (e.position === 'before_char' || position == null)) {
    position = ext.position;
  }

  var selectiveLogic = e.selectiveLogic != null ? e.selectiveLogic
    : (ext.selectiveLogic != null ? ext.selectiveLogic : 0);

  return {
    id: e.id != null ? e.id : (index != null ? index : 0),
    comment: String(e.comment != null ? e.comment : ''),
    content: String(e.content != null ? e.content : ''),
    keys: toStringArray(e.keys),
    secondaryKeys: secondaryKeys,
    strategy: strategy,
    constant: strategy === 'constant',
    enabled: e.enabled !== false,
    position: clampInt(position, 4, 0, 6),
    depth: clampInt(e.depth != null ? e.depth : ext.depth, 4, 0, 999),
    role: clampInt(e.role != null ? e.role : ext.role, 0, 0, 2),
    order: clampInt(order, 100, 0, 99999),
    prob: clampInt(prob, 100, 0, 100),
    useProbability: e.useProbability != null ? !!e.useProbability
      : (ext.useProbability != null ? !!ext.useProbability : true),
    selectiveLogic: clampInt(selectiveLogic, 0, 0, 3),
    useRegex: !!(e.useRegex || e.use_regex),
    preventRecursion: !!(e.preventRecursion || e.prevent_recursion
      || ext.prevent_recursion || ext.preventRecursion),
    delayUntilRecursion: !!(e.delayUntilRecursion || e.delay_until_recursion
      || ext.delay_until_recursion || ext.delayUntilRecursion),
    group: String(
      e.group != null ? e.group
        : (ext.group != null ? ext.group : '')
    ),
    groupWeight: clampInt(
      e.groupWeight != null ? e.groupWeight
        : (e.group_weight != null ? e.group_weight
          : (ext.group_weight != null ? ext.group_weight : 100)),
      100,
      0,
      99999
    ),
    groupOverride: !!(e.groupOverride || e.group_override
      || ext.group_override || ext.groupOverride),
  };
}

/**
 * @param {any[]} list
 * @returns {object[]}
 */
export function normalizeWorldInfoEntries(list) {
  if (!Array.isArray(list)) return [];
  return list.map(function(e, i) { return normalizeWorldInfoEntry(e, i); });
}
