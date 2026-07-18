/**
 * ST regex_scripts 规范化与列表操作（面板 / 导出共用）
 * placement 与 SillyTavern regex_placement 对齐
 */

/** 用户输入 */
export var PLACEMENT_USER = 1;
/** AI 输出 */
export var PLACEMENT_AI = 2;
/** 快捷命令 */
export var PLACEMENT_SLASH = 3;
/** 世界书 */
export var PLACEMENT_WORLD = 5;
/** 推理 */
export var PLACEMENT_REASONING = 6;

/** 合法作用范围（不含已弃用的 0 / legacy 4） */
export var VALID_PLACEMENTS = [
  PLACEMENT_USER,
  PLACEMENT_AI,
  PLACEMENT_SLASH,
  PLACEMENT_WORLD,
  PLACEMENT_REASONING,
];

/**
 * 生成唯一 id（无 crypto 时回退）
 * @returns {string}
 */
export function newRegexId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'rx_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

/**
 * 规范化 placement：仅保留 ST 合法值；显式空数组保留（仅 slash 触发）
 * @param {any} raw
 * @returns {number[]}
 */
export function normalizePlacement(raw) {
  if (!Array.isArray(raw)) return [PLACEMENT_AI];
  var next = raw
    .map(function(n) { return Number(n); })
    .filter(function(n) { return VALID_PLACEMENTS.indexOf(n) >= 0; });
  // 原数组非空但全非法时回退 AI；原为空则保持空
  if (!next.length && raw.length) return [PLACEMENT_AI];
  return next;
}

/**
 * 空正则条目（ST 字段齐全）
 * @param {object} [partial]
 */
export function createEmptyRegexScript(partial) {
  var p = partial || {};
  return normalizeRegexScript({
    id: p.id || newRegexId(),
    scriptName: p.scriptName != null ? p.scriptName : '新正则',
    findRegex: p.findRegex != null ? p.findRegex : '',
    replaceString: p.replaceString != null ? p.replaceString : '',
    trimStrings: Array.isArray(p.trimStrings) ? p.trimStrings : [],
    placement: Array.isArray(p.placement) ? p.placement : [PLACEMENT_AI],
    disabled: p.disabled === true,
    markdownOnly: p.markdownOnly === true,
    promptOnly: p.promptOnly === true,
    runOnEdit: p.runOnEdit !== false,
    substituteRegex: p.substituteRegex === true,
    minDepth: p.minDepth == null ? null : p.minDepth,
    maxDepth: p.maxDepth == null ? null : p.maxDepth,
  });
}

/**
 * 规范化单条正则，补齐缺省字段
 * @param {any} rx
 */
export function normalizeRegexScript(rx) {
  var r = rx && typeof rx === 'object' ? rx : {};
  return {
    id: String(r.id || newRegexId()),
    scriptName: String(r.scriptName != null ? r.scriptName : ''),
    findRegex: String(r.findRegex != null ? r.findRegex : ''),
    replaceString: String(r.replaceString != null ? r.replaceString : ''),
    trimStrings: Array.isArray(r.trimStrings) ? r.trimStrings.map(String) : [],
    placement: normalizePlacement(r.placement),
    disabled: r.disabled === true,
    markdownOnly: r.markdownOnly === true,
    promptOnly: r.promptOnly === true,
    runOnEdit: r.runOnEdit !== false,
    substituteRegex: r.substituteRegex === true || Number(r.substituteRegex) > 0,
    minDepth: r.minDepth == null || r.minDepth === '' ? null : Number(r.minDepth),
    maxDepth: r.maxDepth == null || r.maxDepth === '' ? null : Number(r.maxDepth),
  };
}

/**
 * @param {any} list
 * @returns {object[]}
 */
export function normalizeRegexList(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeRegexScript);
}

/**
 * 按 scriptName upsert；同名覆盖，保留数组顺序
 * @param {object[]} list
 * @param {object} rx
 */
export function upsertRegexByName(list, rx) {
  var next = normalizeRegexList(list);
  var item = normalizeRegexScript(rx);
  var idx = -1;
  for (var i = 0; i < next.length; i++) {
    if (next[i].scriptName === item.scriptName) { idx = i; break; }
  }
  if (idx >= 0) next[idx] = item;
  else next.push(item);
  return next;
}

/**
 * @param {object[]} list
 * @param {string} scriptName
 */
export function removeRegexByName(list, scriptName) {
  var name = String(scriptName || '');
  return normalizeRegexList(list).filter(function(rx) {
    return rx.scriptName !== name;
  });
}

/**
 * 列表内移动
 * @param {object[]} list
 * @param {number} from
 * @param {number} to
 */
export function moveRegex(list, from, to) {
  var next = normalizeRegexList(list);
  if (from < 0 || to < 0 || from >= next.length || to >= next.length || from === to) return next;
  var item = next.splice(from, 1)[0];
  next.splice(to, 0, item);
  return next;
}

/**
 * 编译 findRegex：支持 /pattern/flags 或裸模式串
 * @param {string} findRegex
 * @returns {RegExp|null}
 */
export function compileFindRegex(findRegex) {
  var s = String(findRegex || '');
  if (!s) return null;
  if (s.charAt(0) === '/') {
    var last = s.lastIndexOf('/');
    if (last > 0) {
      try {
        return new RegExp(s.slice(1, last), s.slice(last + 1));
      } catch (e) {
        return null;
      }
    }
  }
  try {
    return new RegExp(s);
  } catch (e2) {
    return null;
  }
}

/**
 * 用单条正则对文本做替换（测试弹窗用；不模拟宏展开）
 * @param {object} rx
 * @param {string} text
 * @returns {{ ok: boolean, result: string, error?: string }}
 */
export function applyRegexScript(rx, text) {
  var script = normalizeRegexScript(rx);
  var input = String(text != null ? text : '');
  if (!script.findRegex) {
    return { ok: false, result: input, error: '匹配正则为空' };
  }
  var re = compileFindRegex(script.findRegex);
  if (!re) {
    return { ok: false, result: input, error: '匹配正则无效' };
  }
  try {
    // ST：{{match}}/$0 → 整匹配；写入字面 $& 供二次 replace 使用（$$ → $）
    var repl = String(script.replaceString || '')
      .replace(/\{\{match\}\}/gi, '$$&')
      .replace(/\$0/g, '$$&');
    var result = input.replace(re, repl);
    return { ok: true, result: result };
  } catch (e) {
    return { ok: false, result: input, error: String(e && e.message ? e.message : e) };
  }
}

/**
 * placement 中文摘要（列表 meta）
 * @param {number[]} placement
 * @returns {string}
 */
export function placementLabel(placement) {
  var map = {};
  map[PLACEMENT_USER] = '用户';
  map[PLACEMENT_AI] = 'AI';
  map[PLACEMENT_SLASH] = '命令';
  map[PLACEMENT_WORLD] = '世界书';
  map[PLACEMENT_REASONING] = '推理';
  var arr = Array.isArray(placement) ? placement : [];
  if (!arr.length) return '无（仅命令触发）';
  return arr.map(function(n) { return map[n] || String(n); }).join('·');
}
