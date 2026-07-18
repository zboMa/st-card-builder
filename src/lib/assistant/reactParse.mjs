/**
 * ReAct 响应解析：从模型输出中提取 tool / final JSON
 */

/**
 * 尝试从文本中提取 JSON 对象（支持 ```json 围栏）
 * @returns {object|null}
 */
export function extractJsonObject(text) {
  var raw = String(text == null ? '' : text).trim();
  if (!raw) return null;

  // 优先围栏
  var fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      var f = JSON.parse(fence[1].trim());
      if (f && typeof f === 'object' && !Array.isArray(f)) return f;
    } catch (e) { /* continue */ }
  }

  // 全文解析
  try {
    var all = JSON.parse(raw);
    if (all && typeof all === 'object' && !Array.isArray(all)) return all;
  } catch (e) { /* continue */ }

  // 扫描首个 { ... }
  var start = raw.indexOf('{');
  if (start < 0) return null;
  var depth = 0;
  var inStr = false;
  var esc = false;
  for (var i = start; i < raw.length; i++) {
    var ch = raw[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          var obj = JSON.parse(raw.slice(start, i + 1));
          if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj;
        } catch (e2) {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * 规范化一步 ReAct 动作
 * @returns {{ type: 'tool'|'final'|'unknown', thought?: string, tool?: string, args?: object, final?: string, raw?: object }}
 */
export function parseReactStep(text) {
  var obj = extractJsonObject(text);
  if (!obj) {
    // 无 JSON 时当作最终回复
    var plain = String(text || '').trim();
    if (plain) return { type: 'final', final: plain, thought: '' };
    return { type: 'unknown' };
  }

  if (obj.final != null || obj.answer != null || obj.message != null) {
    return {
      type: 'final',
      thought: obj.thought || obj.reasoning || '',
      final: String(obj.final != null ? obj.final : (obj.answer != null ? obj.answer : obj.message)),
      raw: obj,
    };
  }

  if (obj.tool || obj.action || obj.name) {
    return {
      type: 'tool',
      thought: obj.thought || obj.reasoning || '',
      tool: String(obj.tool || obj.action || obj.name),
      args: obj.args || obj.action_input || obj.input || {},
      raw: obj,
    };
  }

  // 兼容 { tool_calls: [...] } 取第一个
  if (Array.isArray(obj.tool_calls) && obj.tool_calls[0]) {
    var tc = obj.tool_calls[0];
    var fn = tc.function || tc;
    var args = fn.arguments || fn.args || {};
    if (typeof args === 'string') {
      try { args = JSON.parse(args); } catch (e) { args = { raw: args }; }
    }
    return {
      type: 'tool',
      thought: obj.thought || '',
      tool: String(fn.name || tc.name || ''),
      args: args,
      raw: obj,
    };
  }

  return { type: 'unknown', raw: obj };
}
