/**
 * 正则管道：基于 regexScripts.mjs，按 placement / ephemerality / depth 过滤
 */

import {
  compileFindRegex,
  normalizeRegexScript,
  PLACEMENT_USER,
  PLACEMENT_AI,
  PLACEMENT_WORLD,
} from '../../regexScripts.mjs';

export { PLACEMENT_USER, PLACEMENT_AI, PLACEMENT_WORLD };

/**
 * 单条脚本是否适用于当前 ephemerality
 * markdownOnly → 仅 display；promptOnly → 仅 prompt；皆 false → both
 * @param {object} script
 * @param {'prompt'|'display'|'both'} ephemerality
 */
export function matchesEphemerality(script, ephemerality) {
  var md = !!script.markdownOnly;
  var po = !!script.promptOnly;
  var eph = ephemerality || 'both';
  if (!md && !po) return true;
  if (eph === 'both') return true;
  if (md && !po) return eph === 'display';
  if (po && !md) return eph === 'prompt';
  // 两者都 true：ST 语义少见，两边都应用
  return true;
}

/**
 * @param {object} script
 * @param {number|null|undefined} messageDepth  0 = 最新
 */
export function matchesDepth(script, messageDepth) {
  if (messageDepth == null) return true;
  var d = Number(messageDepth);
  if (isNaN(d)) return true;
  if (script.minDepth != null && !isNaN(Number(script.minDepth)) && d < Number(script.minDepth)) {
    return false;
  }
  if (script.maxDepth != null && !isNaN(Number(script.maxDepth)) && d > Number(script.maxDepth)) {
    return false;
  }
  return true;
}

/**
 * @param {string} text
 * @param {object} script 已 normalize
 * @returns {{ ok: boolean, text: string }}
 */
function applyOne(text, script) {
  if (!script.findRegex) return { ok: false, text: text };
  var re = compileFindRegex(script.findRegex);
  if (!re) return { ok: false, text: text };
  try {
    var repl = String(script.replaceString || '')
      .replace(/\{\{match\}\}/gi, '$$&')
      .replace(/\$0/g, '$$&');
    return { ok: true, text: String(text).replace(re, repl) };
  } catch (err) {
    return { ok: false, text: text };
  }
}

/**
 * @param {string} text
 * @param {any[]} scripts
 * @param {{
 *   placement: number,
 *   messageDepth?: number|null,
 *   ephemerality?: 'prompt'|'display'|'both'
 * }} opts
 * @returns {{ text: string, applied: { name: string, before: string, after: string }[] }}
 */
export function applyRegexPipeline(text, scripts, opts) {
  var o = opts || {};
  var placement = Number(o.placement);
  var ephemerality = o.ephemerality || 'both';
  var messageDepth = o.messageDepth;
  var cur = text == null ? '' : String(text);
  var list = Array.isArray(scripts) ? scripts : [];
  var applied = [];

  for (var i = 0; i < list.length; i++) {
    var script = normalizeRegexScript(list[i]);
    if (script.disabled) continue;
    if (!script.placement || script.placement.indexOf(placement) < 0) continue;
    if (!matchesEphemerality(script, ephemerality)) continue;
    if (!matchesDepth(script, messageDepth)) continue;

    var before = cur;
    var res = applyOne(cur, script);
    if (!res.ok) continue;
    cur = res.text;
    if (cur !== before) {
      applied.push({
        name: script.scriptName || script.id || ('rx_' + i),
        before: before,
        after: cur,
      });
    }
  }

  return { text: cur, applied: applied };
}

/**
 * 对 user/assistant 消息按从末尾算的 depth 应用 USER/AI placement
 * @param {{ role: string, content: string }[]} messages
 * @param {any[]} scripts
 * @param {'prompt'|'display'|'both'} ephemerality
 * @returns {{ messages: { role: string, content: string }[], applied: object[] }}
 */
export function applyRegexToMessages(messages, scripts, ephemerality) {
  var list = Array.isArray(messages) ? messages : [];
  var out = [];
  var allApplied = [];
  var eph = ephemerality || 'prompt';

  // depth：从末尾数，仅对 user/assistant 计 depth 索引
  // ST：messageDepth 0 = 最新消息。对整条 messages 数组从末尾算索引。
  for (var i = 0; i < list.length; i++) {
    var m = list[i];
    var role = m && m.role;
    var content = m && m.content != null ? String(m.content) : '';
    var depthFromEnd = list.length - 1 - i;

    if (role === 'user') {
      var u = applyRegexPipeline(content, scripts, {
        placement: PLACEMENT_USER,
        messageDepth: depthFromEnd,
        ephemerality: eph,
      });
      content = u.text;
      for (var ui = 0; ui < u.applied.length; ui++) {
        allApplied.push(Object.assign({ role: 'user', depth: depthFromEnd }, u.applied[ui]));
      }
    } else if (role === 'assistant') {
      var a = applyRegexPipeline(content, scripts, {
        placement: PLACEMENT_AI,
        messageDepth: depthFromEnd,
        ephemerality: eph,
      });
      content = a.text;
      for (var ai = 0; ai < a.applied.length; ai++) {
        allApplied.push(Object.assign({ role: 'assistant', depth: depthFromEnd }, a.applied[ai]));
      }
    }

    out.push({ role: role, content: content });
  }

  return { messages: out, applied: allApplied };
}
