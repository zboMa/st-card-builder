/**
 * 导出前完成清单（纯函数，可供 UI / 助手 export_card_check 复用）
 */

/**
 * @param {object} input
 * @param {string} [input.charName]
 * @param {string} [input.charDesc]
 * @param {string} [input.firstMes]
 * @param {string} [input.creatorNotes]
 * @param {boolean} [input.hasAvatar]
 * @param {number} [input.worldbookCount]
 * @param {number} [input.worldbookNoKeys]
 * @param {number} [input.novelUnsyncedCount]
 * @param {number} [input.altGreetingCount]
 * @param {Array<{level?:string,message?:string,code?:string}>} [input.extraIssues]
 * @returns {{
 *   ok: boolean,
 *   canExportJson: boolean,
 *   canExportPng: boolean,
 *   critical: number,
 *   warning: number,
 *   items: Array<{id:string,level:string,message:string,view?:string}>
 * }}
 */
export function buildExportChecklist(input) {
  var d = input || {};
  var items = [];

  function push(id, level, message, view) {
    items.push({ id: id, level: level, message: message, view: view || '' });
  }

  var name = String(d.charName || '').trim();
  var desc = String(d.charDesc || '');
  var first = String(d.firstMes || '').trim();
  var wbCount = Number(d.worldbookCount) || 0;
  var noKeys = Number(d.worldbookNoKeys) || 0;
  var unsynced = Number(d.novelUnsyncedCount) || 0;
  var hasAvatar = !!d.hasAvatar;

  if (!name) push('no_name', 'critical', '缺少角色名', 'character');
  if (desc.trim().length < 40) {
    push('short_desc', desc.trim() ? 'warning' : 'critical',
      desc.trim() ? '角色描述偏短（建议 ≥40 字）' : '缺少角色描述', 'character');
  }
  if (!first) push('no_first_mes', 'warning', '缺少主开场白', 'greetings');
  if (!wbCount) push('no_worldbook', 'warning', '世界书尚无条目', 'worldbook');
  if (noKeys > 0) {
    push('wb_no_keys', 'warning', noKeys + ' 条世界书缺少触发词', 'worldbook');
  }
  if (!hasAvatar) {
    push('no_avatar', 'warning', '未设置头像（导出 PNG 需要头像）', 'character');
  }
  if (unsynced > 0) {
    push('novel_unsynced', 'warning',
      '小说工坊有 ' + unsynced + ' 项未同步到主卡（导出不含小说桶）',
      'novel-characters');
  }

  var extras = Array.isArray(d.extraIssues) ? d.extraIssues : [];
  extras.forEach(function(x, i) {
    if (!x) return;
    push(x.code || ('extra_' + i), x.level || 'info', x.message || String(x.title || x), x.view || '');
  });

  var critical = items.filter(function(x) { return x.level === 'critical'; }).length;
  var warning = items.filter(function(x) { return x.level === 'warning'; }).length;

  return {
    ok: critical === 0,
    canExportJson: critical === 0,
    canExportPng: critical === 0 && hasAvatar,
    critical: critical,
    warning: warning,
    items: items,
    summary: critical === 0
      ? (warning ? ('可导出 JSON；另有 ' + warning + ' 条提醒') : '检查通过，可导出')
      : ('有 ' + critical + ' 项必须修复后再导出'),
  };
}
