/**
 * 试聊 fixes apply 前校验（§6.3.7 · D15）
 */

var ALLOWED_TOOLS = [
  'update_character_fields',
  'expand_character_field',
  'rewrite_worldbook_entry',
  'update_worldbook_entry',
  'batch_fill_worldbook_keys',
  'expand_greeting',
  'rewrite_greeting',
  'fix_from_lint',
];

var MVU_WRITE_TOOLS = [
  'upsert_mvu_design',
  'upsert_mvu_variables',
  'patch_mvu_node',
];

/**
 * @param {{ tool?: string, op?: string, args?: object }} fix
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateChatFeedbackFix(fix) {
  var tool = String((fix && (fix.tool || fix.op)) || '').trim();
  if (!tool) return { ok: false, reason: 'fix 缺少 tool' };

  if (MVU_WRITE_TOOLS.indexOf(tool) >= 0) {
    return { ok: false, reason: '禁止通过试聊回流写入 MVU 运行时终值（卡无状态）' };
  }

  if (tool === 'create_worldbook_entry') {
    var content = String((fix.args && fix.args.entry && fix.args.entry.content) || (fix.args && fix.args.content) || '');
    if (/本局|transcript|对话摘要|试聊/.test(content)) {
      return { ok: false, reason: '禁止将试聊 transcript 摘要写入 worldbook；请用归档 Story' };
    }
  }

  if (tool === 'replace_character_section') {
    return { ok: false, reason: '禁止整段灌入对话摘录到角色字段' };
  }

  if (tool === 'expand_character_field') {
    var field = String((fix.args && fix.args.field) || '');
    var instr = String((fix.args && fix.args.instruction) || '');
    if (field === 'charDesc' && /NPC|人物传记|角色小传|传记/.test(instr)) {
      return { ok: false, reason: 'NPC 传记应写入 worldbook person，非 charDesc' };
    }
  }

  var wbTools = ['rewrite_worldbook_entry', 'update_worldbook_entry', 'expand_worldbook_entry'];
  if (wbTools.indexOf(tool) >= 0) {
    var args = fix.args || {};
    var hasTarget = args.target != null || args.index != null || args.id != null
      || args.comment != null || args.titleMatch != null || args.name != null;
    if (!hasTarget) {
      return { ok: false, reason: 'worldbook fix 须带可解析 target/index' };
    }
  }

  if (ALLOWED_TOOLS.indexOf(tool) < 0) {
    return { ok: false, reason: '试聊回流不允许工具: ' + tool };
  }

  return { ok: true };
}

/** @param {object[]} fixes */
export function validateChatFeedbackFixes(fixes) {
  var list = Array.isArray(fixes) ? fixes : [];
  var results = [];
  for (var i = 0; i < list.length; i++) {
    var v = validateChatFeedbackFix(list[i]);
    results.push({ index: i, fix: list[i], ok: v.ok, reason: v.reason || '' });
    if (!v.ok) break;
  }
  return results;
}
