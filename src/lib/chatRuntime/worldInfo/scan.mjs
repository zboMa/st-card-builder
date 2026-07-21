/**
 * 世界书扫描（对齐 ST 1.18 核心行为的轻量实现）
 *
 * DIFF: vectorized 一期当作 selective（见 stCompat）。
 * DIFF: 递归仅一轮；group 取 override / 最高 weight。
 */

import { normalizeWorldInfoEntries, SELECTIVE_LOGIC } from './normalize.mjs';

/**
 * 解析 key：明文子串（默认大小写不敏感）或 /regex/flags
 * @param {string} key
 * @returns {{ type: 'plain'|'regex', value: string, re?: RegExp|null }}
 */
function parseKey(key) {
  var k = String(key || '');
  if (k.charAt(0) === '/') {
    var last = k.lastIndexOf('/');
    if (last > 0) {
      var body = k.slice(1, last);
      var flags = k.slice(last + 1);
      try {
        return { type: 'regex', value: k, re: new RegExp(body, flags) };
      } catch (err) {
        return { type: 'regex', value: k, re: null };
      }
    }
  }
  return { type: 'plain', value: k };
}

/**
 * @param {string} buffer
 * @param {string} key
 * @returns {boolean}
 */
export function matchKey(buffer, key) {
  var parsed = parseKey(key);
  if (parsed.type === 'regex') {
    if (!parsed.re) return false;
    parsed.re.lastIndex = 0;
    return parsed.re.test(buffer);
  }
  if (!parsed.value) return false;
  return buffer.toLowerCase().indexOf(parsed.value.toLowerCase()) >= 0;
}

/**
 * 任一 key 命中
 * @param {string} buffer
 * @param {string[]} keys
 */
function anyKeyMatch(buffer, keys) {
  if (!keys || !keys.length) return false;
  for (var i = 0; i < keys.length; i++) {
    if (matchKey(buffer, keys[i])) return true;
  }
  return false;
}

/**
 * 全部 key 命中
 * @param {string} buffer
 * @param {string[]} keys
 */
function allKeysMatch(buffer, keys) {
  if (!keys || !keys.length) return false;
  for (var i = 0; i < keys.length; i++) {
    if (!matchKey(buffer, keys[i])) return false;
  }
  return true;
}

/**
 * 主 keys 已命中后，按 selectiveLogic 检查 secondaryKeys
 * 无 secondaryKeys 时视为通过（与 ST：无次要键则不额外约束）
 * @param {string} buffer
 * @param {object} entry
 */
export function matchSecondaryLogic(buffer, entry) {
  var sec = entry.secondaryKeys || [];
  if (!sec.length) return true;
  var logic = entry.selectiveLogic;
  if (logic === SELECTIVE_LOGIC.AND_ANY) {
    return anyKeyMatch(buffer, sec);
  }
  if (logic === SELECTIVE_LOGIC.NOT_ALL) {
    return !allKeysMatch(buffer, sec);
  }
  if (logic === SELECTIVE_LOGIC.NOT_ANY) {
    return !anyKeyMatch(buffer, sec);
  }
  if (logic === SELECTIVE_LOGIC.AND_ALL) {
    return allKeysMatch(buffer, sec);
  }
  return anyKeyMatch(buffer, sec);
}

/**
 * @param {object} entry
 * @param {string} buffer
 * @param {{ allowSelectiveScan: boolean, recursionPass: boolean }} opts
 */
function isTriggered(entry, buffer, opts) {
  if (!entry.enabled) return false;
  // delayUntilRecursion：仅递归轮激活
  if (entry.delayUntilRecursion && !opts.recursionPass) return false;
  // 递归轮：跳过 preventRecursion
  if (opts.recursionPass && entry.preventRecursion) return false;

  if (entry.strategy === 'constant' || entry.constant) {
    return true;
  }

  // selective / vectorized（一期等同 selective）
  if (!opts.allowSelectiveScan) return false;
  if (!anyKeyMatch(buffer, entry.keys || [])) return false;
  return matchSecondaryLogic(buffer, entry);
}

/**
 * @param {() => number} [rng] 返回 [0,1)
 * @param {object} entry
 */
function passProbability(entry, rng) {
  if (entry.useProbability === false) return true;
  var p = Number(entry.prob);
  if (isNaN(p)) p = 100;
  if (p >= 100) return true;
  if (p <= 0) return false;
  var r = typeof rng === 'function' ? rng() : Math.random();
  return r < p / 100;
}

/**
 * 同 group 只留一条：groupOverride 优先，否则最高 groupWeight；同权稳序先到
 * @param {object[]} activated
 */
function applyGroupFilter(activated) {
  var byGroup = Object.create(null);
  var noGroup = [];
  for (var i = 0; i < activated.length; i++) {
    var e = activated[i];
    var g = e.group != null ? String(e.group).trim() : '';
    if (!g) {
      noGroup.push(e);
      continue;
    }
    if (!byGroup[g]) {
      byGroup[g] = e;
      continue;
    }
    var cur = byGroup[g];
    if (e.groupOverride && !cur.groupOverride) {
      byGroup[g] = e;
    } else if (e.groupOverride === cur.groupOverride) {
      if (e.groupWeight > cur.groupWeight) byGroup[g] = e;
      // 同 weight：保留已有（稳序）
    }
    // cur 有 override 而 e 无：保留 cur
  }
  var grouped = Object.keys(byGroup).map(function(k) { return byGroup[k]; });
  return noGroup.concat(grouped);
}

/**
 * @param {{
 *   entries: any[],
 *   history: { role?: string, content?: string }[],
 *   scanDepth?: number,
 *   budgetChars?: number,
 *   rng?: () => number
 * }} opts
 * @returns {{ activated: object[], skipped: object[], scanBuffer: string }}
 */
export function scanWorldInfo(opts) {
  var o = opts || {};
  var entries = normalizeWorldInfoEntries(o.entries || []);
  var history = Array.isArray(o.history) ? o.history : [];
  var scanDepth = o.scanDepth == null ? 2 : Number(o.scanDepth);
  if (isNaN(scanDepth) || scanDepth < 0) scanDepth = 2;
  var rng = o.rng;
  var budgetChars = o.budgetChars != null ? Number(o.budgetChars) : null;

  // 从末尾取最近 N 条拼接；scanDepth=0 → 空缓冲（仅 constant / 递归路径）
  var bufferParts = [];
  if (scanDepth > 0 && history.length) {
    var start = Math.max(0, history.length - scanDepth);
    for (var hi = start; hi < history.length; hi++) {
      bufferParts.push(String(history[hi] && history[hi].content != null ? history[hi].content : ''));
    }
  }
  var scanBuffer = bufferParts.join('\n');
  if (budgetChars != null && !isNaN(budgetChars) && budgetChars >= 0 && scanBuffer.length > budgetChars) {
    scanBuffer = scanBuffer.slice(scanBuffer.length - budgetChars);
  }

  var allowSelectiveScan = scanDepth > 0;
  var activated = [];
  var activatedIds = Object.create(null);
  /** @type {Record<string, string>} */
  var skipReasons = Object.create(null);

  function tryActivate(entry, buffer, passOpts) {
    var idKey = String(entry.id);
    if (activatedIds[idKey]) return true;
    if (!isTriggered(entry, buffer, passOpts)) {
      skipReasons[idKey] = 'not_triggered';
      return false;
    }
    if (!passProbability(entry, rng)) {
      skipReasons[idKey] = 'probability';
      return false;
    }
    activated.push(entry);
    activatedIds[idKey] = true;
    delete skipReasons[idKey];
    return true;
  }

  // 第一轮
  for (var i = 0; i < entries.length; i++) {
    tryActivate(entries[i], scanBuffer, {
      allowSelectiveScan: allowSelectiveScan,
      recursionPass: false,
    });
  }

  // 轻量递归一轮：已激活 content 并入缓冲，再扫未激活且 delayUntilRecursion 可走 / 非 prevent
  if (activated.length) {
    var extra = activated.map(function(e) { return e.content || ''; }).join('\n');
    var recursionBuffer = scanBuffer + (extra ? '\n' + extra : '');
    if (budgetChars != null && !isNaN(budgetChars) && budgetChars >= 0 && recursionBuffer.length > budgetChars) {
      recursionBuffer = recursionBuffer.slice(recursionBuffer.length - budgetChars);
    }
    for (var j = 0; j < entries.length; j++) {
      var ent = entries[j];
      if (activatedIds[String(ent.id)]) continue;
      // 递归轮允许 selective 扫描（即使 scanDepth=0，用已激活内容作缓冲）
      tryActivate(ent, recursionBuffer, {
        allowSelectiveScan: true,
        recursionPass: true,
      });
    }
    scanBuffer = recursionBuffer;
  }

  activated = applyGroupFilter(activated);

  // 按 order 升序；同 order 稳序（原相对顺序）
  activated = activated
    .map(function(e, idx) { return { e: e, idx: idx }; })
    .sort(function(a, b) {
      if (a.e.order !== b.e.order) return a.e.order - b.e.order;
      return a.idx - b.idx;
    })
    .map(function(x) { return x.e; });

  var skipped = [];
  for (var si = 0; si < entries.length; si++) {
    var se = entries[si];
    var sk = String(se.id);
    if (!activatedIds[sk] && skipReasons[sk]) {
      skipped.push({ entry: se, reason: skipReasons[sk] });
    }
  }

  return { activated: activated, skipped: skipped, scanBuffer: scanBuffer };
}
