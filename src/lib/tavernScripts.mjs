/**
 * tavern_helper.scripts（ScriptTree）规范化与列表操作
 */

/**
 * @returns {string}
 */
export function newTavernScriptId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'th_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

/**
 * 空 ScriptTree
 * @param {object} [partial]
 */
export function createEmptyTavernScript(partial) {
  var p = partial || {};
  return normalizeTavernScript({
    type: p.type || 'script',
    enabled: p.enabled !== false,
    name: p.name != null ? p.name : '新脚本',
    id: p.id || newTavernScriptId(),
    content: p.content != null ? p.content : '',
    info: p.info != null ? p.info : '',
    button: p.button,
    data: p.data,
  });
}

/**
 * 规范化单条脚本；保留 button / data 结构
 * @param {any} script
 */
export function normalizeTavernScript(script) {
  var s = script && typeof script === 'object' ? script : {};
  var button = s.button && typeof s.button === 'object'
    ? {
        enabled: s.button.enabled !== false,
        buttons: Array.isArray(s.button.buttons) ? s.button.buttons : [],
      }
    : { enabled: true, buttons: [] };
  var data = s.data && typeof s.data === 'object' && !Array.isArray(s.data) ? s.data : {};
  return {
    type: s.type ? String(s.type) : 'script',
    enabled: s.enabled !== false,
    name: String(s.name != null ? s.name : ''),
    id: String(s.id || newTavernScriptId()),
    content: String(s.content != null ? s.content : ''),
    info: String(s.info != null ? s.info : ''),
    button: button,
    data: data,
  };
}

/**
 * @param {any} list
 * @returns {object[]}
 */
export function normalizeTavernScriptList(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeTavernScript);
}

/**
 * 按 name upsert
 * @param {object[]} list
 * @param {object} script
 */
export function upsertTavernScriptByName(list, script) {
  var next = normalizeTavernScriptList(list);
  var item = normalizeTavernScript(script);
  var idx = -1;
  for (var i = 0; i < next.length; i++) {
    if (next[i].name === item.name) { idx = i; break; }
  }
  if (idx >= 0) {
    // 同名更新时保留原 id（除非显式传入）
    if (!script || !script.id) item.id = next[idx].id;
    next[idx] = item;
  } else {
    next.push(item);
  }
  return next;
}

/**
 * @param {object[]} list
 * @param {string} name
 */
export function removeTavernScriptByName(list, name) {
  var n = String(name || '');
  return normalizeTavernScriptList(list).filter(function(s) {
    return s.name !== n;
  });
}

/**
 * @param {object[]} list
 * @param {number} from
 * @param {number} to
 */
export function moveTavernScript(list, from, to) {
  var next = normalizeTavernScriptList(list);
  if (from < 0 || to < 0 || from >= next.length || to >= next.length || from === to) return next;
  var item = next.splice(from, 1)[0];
  next.splice(to, 0, item);
  return next;
}

/**
 * 组装导出用 tavern_helper：覆盖 scripts，保留 variables 等其它字段
 * @param {object[]} scripts
 * @param {object} [prevHelper] 既有 extensions.tavern_helper
 */
export function buildTavernHelperExtension(scripts, prevHelper) {
  var prev = prevHelper && typeof prevHelper === 'object' ? prevHelper : {};
  var vars = prev.variables && typeof prev.variables === 'object' ? prev.variables : {};
  var out = Object.assign({}, prev, {
    scripts: normalizeTavernScriptList(scripts),
    variables: vars,
  });
  return out;
}
