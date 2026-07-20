/**
 * 世界书注入
 *
 * position（与本仓库 worldbook.positionLabel 一致）:
 *   0 ↑ Char  1 ↓ Char  2 ↑ EM  3 ↓ EM  4 @D  5 ↑ AN  6 ↓ AN
 *
 * DIFF: 非 @D 简化为文本块槽；@D 按 depth 插入 history（Depth 0 = 栈底最近）。
 */

/**
 * role 数字 → Chat Completions role
 * @param {number} role
 * @returns {'system'|'user'|'assistant'}
 */
export function roleToChatRole(role) {
  var r = Number(role);
  if (r === 1) return 'user';
  if (r === 2) return 'assistant';
  return 'system';
}

/**
 * 将激活条目按插入槽分类；@D 单独列出（已按 order 升序假设）
 * @param {object[]} activated
 */
export function partitionActivated(activated) {
  var list = Array.isArray(activated) ? activated : [];
  var beforeChar = [];
  var afterChar = [];
  var beforeEM = [];
  var afterEM = [];
  var beforeAN = [];
  var afterAN = [];
  var depth = [];
  var other = [];

  for (var i = 0; i < list.length; i++) {
    var e = list[i];
    var p = Number(e.position);
    if (p === 0) beforeChar.push(e);
    else if (p === 1) afterChar.push(e);
    else if (p === 2) beforeEM.push(e);
    else if (p === 3) afterEM.push(e);
    else if (p === 4) depth.push(e);
    else if (p === 5) beforeAN.push(e);
    else if (p === 6) afterAN.push(e);
    else other.push(e);
  }

  return {
    beforeChar: beforeChar,
    afterChar: afterChar,
    beforeEM: beforeEM,
    afterEM: afterEM,
    beforeAN: beforeAN,
    afterAN: afterAN,
    depth: depth,
    other: other,
  };
}

/**
 * 拼接某槽位条目 content（按 order 已排序时保持顺序）
 * @param {object[]} entries
 * @returns {string}
 */
export function joinEntryContents(entries) {
  if (!entries || !entries.length) return '';
  return entries.map(function(e) { return String(e.content || ''); }).filter(Boolean).join('\n');
}

/**
 * 构建 @D 注入计划：按 depth 分组，同 depth 内保持 order 升序
 * ST：Depth 0 = 最底部（从末尾数第 0 条之前 = 紧挨最后一条消息之前？）
 *
 * SillyTavern：depth N 表示从聊天末尾往前数，在第 N 条消息「之前」插入。
 * depth 0 → 插入在最后一条消息之后（栈底最近 / 最新之后）—— 常见理解是
 * 作为独立消息出现在 history 末尾区域。
 *
 * 本实现：在 messages 数组中，于 index = length - depth 处插入
 * （depth 0 → index = length，即 append；depth 1 → 末条之前）。
 *
 * @param {object[]} activated
 * @returns {{ depth: number, role: string, content: string, entry: object }[]}
 */
export function buildDepthInjections(activated) {
  var parts = partitionActivated(activated);
  var depthEntries = parts.depth.slice();
  // 稳定：先按 depth 升序，同 depth 保持原 order 序
  depthEntries.sort(function(a, b) {
    var da = Number(a.depth) || 0;
    var db = Number(b.depth) || 0;
    if (da !== db) return da - db;
    if (a.order !== b.order) return a.order - b.order;
    return 0;
  });

  return depthEntries.map(function(e) {
    return {
      depth: Number(e.depth) || 0,
      role: roleToChatRole(e.role),
      content: String(e.content || ''),
      entry: e,
    };
  });
}

/**
 * 将 @D 条目插入 history 消息数组副本
 * @param {{ role: string, content: string }[]} messages
 * @param {object[]} activated
 * @returns {{ role: string, content: string }[]}
 */
export function injectDepthIntoHistory(messages, activated) {
  var out = (Array.isArray(messages) ? messages : []).map(function(m) {
    return { role: m.role, content: m.content };
  });
  var injections = buildDepthInjections(activated);
  // 从大 depth 到小 depth 插入，避免索引漂移；同 depth 按出现顺序从前往后插在同一锚点
  // 策略：按 depth 降序；同 depth 保持数组顺序依次 insertAt
  var byDepth = Object.create(null);
  for (var i = 0; i < injections.length; i++) {
    var inj = injections[i];
    var d = inj.depth;
    if (!byDepth[d]) byDepth[d] = [];
    byDepth[d].push(inj);
  }
  var depths = Object.keys(byDepth).map(Number).sort(function(a, b) { return b - a; });
  for (var di = 0; di < depths.length; di++) {
    var depth = depths[di];
    var group = byDepth[depth];
    // insertAt = length - depth；clamp 到 [0, length]
    var insertAt = out.length - depth;
    if (insertAt < 0) insertAt = 0;
    if (insertAt > out.length) insertAt = out.length;
    for (var gi = 0; gi < group.length; gi++) {
      var g = group[gi];
      out.splice(insertAt + gi, 0, { role: g.role, content: g.content });
    }
  }
  return out;
}

/**
 * @param {{
 *   messages: { role: string, content: string }[],
 *   activated: object[],
 *   chatHistoryLength?: number
 * }} opts
 * @returns {{
 *   messages: { role: string, content: string }[],
 *   slots: ReturnType<typeof partitionActivated>,
 *   depthInjections: ReturnType<typeof buildDepthInjections>
 * }}
 */
export function injectWorldInfo(opts) {
  var o = opts || {};
  var activated = Array.isArray(o.activated) ? o.activated : [];
  var slots = partitionActivated(activated);
  var depthInjections = buildDepthInjections(activated);
  var messages = injectDepthIntoHistory(o.messages || [], activated);
  return {
    messages: messages,
    slots: slots,
    depthInjections: depthInjections,
  };
}
