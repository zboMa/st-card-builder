/**
 * 常见 ST 宏替换（{{char}} / {{user}} 等大小写变体）
 */

/**
 * @param {string} text
 * @param {{ charName?: string, userName?: string }} [ctx]
 * @returns {string}
 */
export function applyMacros(text, ctx) {
  var s = text == null ? '' : String(text);
  var charName = ctx && ctx.charName != null ? String(ctx.charName) : 'Character';
  var userName = ctx && ctx.userName != null ? String(ctx.userName) : 'User';
  // 常见大小写：{{char}} {{Char}} {{CHAR}} {{user}} {{User}} {{USER}}
  s = s.replace(/\{\{\s*char\s*\}\}/gi, charName);
  s = s.replace(/\{\{\s*user\s*\}\}/gi, userName);
  return s;
}
