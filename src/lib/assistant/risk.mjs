/**
 * 变更风险分级：小改自动应用；大改需用户确认
 */
import { getToolByName } from './tools.mjs';
import { normalizeCharacterFieldKey, normalizeCharacterPatch } from './characterFields.mjs';

/** 整段覆盖视为大改的角色字段 */
export const SECTION_FIELDS = ['charDesc', 'firstMes', 'creatorNotes'];

/** 单字段小改字符上限（超出升为 confirm） */
export const SMALL_TEXT_LIMIT = 400;

/**
 * 根据工具名与参数判定最终风险
 * @returns {'none'|'auto'|'confirm'}
 */
export function classifyToolRisk(toolName, args) {
  var meta = getToolByName(toolName);
  if (!meta) return 'confirm';
  if (meta.risk === 'none') return 'none';

  var a = args || {};

  if (toolName === 'update_character_fields') {
    var fields = a.fields || {};
    var keys = Object.keys(fields);
    if (!keys.length) return 'auto';
    if (keys.length > 3) return 'confirm';
    for (var i = 0; i < keys.length; i++) {
      var k = normalizeCharacterFieldKey(keys[i]) || keys[i];
      var v = fields[keys[i]];
      if (SECTION_FIELDS.indexOf(k) >= 0 && String(v || '').length > SMALL_TEXT_LIMIT) {
        return 'confirm';
      }
      if (String(v || '').length > SMALL_TEXT_LIMIT * 2) return 'confirm';
    }
    return 'auto';
  }

  if (toolName === 'replace_character_section') return 'confirm';
  if (toolName === 'delete_worldbook_entry') return 'confirm';
  if (toolName === 'delete_card') return 'confirm';
  if (toolName === 'switch_card' || toolName === 'create_card' || toolName === 'duplicate_card' || toolName === 'import_card') {
    return 'confirm';
  }

  if (toolName === 'update_worldbook_entry') {
    var patch = a.patch || {};
    if (Array.isArray(a.indices) && a.indices.length > 1) return 'confirm';
    if (String(patch.content || '').length > 8000) return 'confirm';
    return 'auto';
  }

  if (toolName === 'create_worldbook_entry') {
    if (Array.isArray(a.entries) && a.entries.length > 3) return 'confirm';
    return 'auto';
  }

  if (toolName === 'update_alternate_greeting') {
    if (String(a.content || '').length > SMALL_TEXT_LIMIT) return 'confirm';
    return 'auto';
  }

  if (toolName === 'novel_patch_chapters') {
    var action = String(a.action || '');
    // 批量删除/合并视为大改
    if (action === 'delete' || action === 'merge') {
      var ids = Array.isArray(a.ids) ? a.ids : [];
      if (ids.length > 1 || action === 'merge') return 'confirm';
    }
    return 'auto';
  }

  if (toolName === 'patch_mvu_node') {
    if (String((a.patch && a.patch.description) || a.patch || '').length > 2000) return 'confirm';
    return 'auto';
  }

  if (toolName === 'rename_card' || toolName === 'set_engine_options') return 'auto';

  if (toolName === 'apply_patch_bundle' || toolName === 'fix_from_lint') {
    var ops = Array.isArray(a.ops) ? a.ops : [];
    if (toolName === 'fix_from_lint') return 'confirm';
    if (ops.length === 0) return 'auto';
    if (ops.length === 1) {
      return classifyToolRisk(ops[0].op || ops[0].tool, ops[0].args || ops[0]);
    }
    return 'confirm';
  }

  // expand 单条世界书：默认 auto；rewrite 或显式 rewrite mode → confirm
  if (toolName === 'expand_worldbook_entry') {
    if (a.mode === 'rewrite') return 'confirm';
    return 'auto';
  }

  if (meta.risk === 'confirm') return 'confirm';
  return meta.risk || 'confirm';
}

/**
 * 生成变更预览摘要（供 UI / 确认卡）
 */
export function buildChangePreview(toolName, args, beforeHint) {
  var a = args || {};
  var lines = [];
  lines.push('工具: ' + toolName);
  if (beforeHint) lines.push('上下文: ' + beforeHint);

  if (toolName === 'update_character_fields' || toolName === 'replace_character_section' || toolName === 'expand_character_field') {
    var fields = a.fields || {};
    if (toolName === 'replace_character_section' && a.field) {
      fields = {};
      fields[normalizeCharacterFieldKey(a.field) || a.field] = a.content;
    }
    if (toolName === 'expand_character_field' && a.field) {
      lines.push('· 字段: ' + (normalizeCharacterFieldKey(a.field) || a.field) + ' · mode=' + (a.mode || 'expand'));
      if (a.instruction) lines.push('· 要求: ' + String(a.instruction).slice(0, 200));
    }
    Object.keys(fields).forEach(function(k) {
      var text = String(fields[k] == null ? '' : fields[k]);
      lines.push('· ' + k + ' → ' + (text.length > 120 ? text.slice(0, 120) + '…' : text));
    });
  } else if (
    toolName.indexOf('worldbook') >= 0
    || toolName === 'create_worldbook_entry'
    || toolName === 'update_worldbook_entry'
    || toolName === 'delete_worldbook_entry'
    || toolName === 'fix_from_lint'
  ) {
    lines.push('参数: ' + JSON.stringify(a).slice(0, 500));
  } else if (toolName === 'apply_patch_bundle') {
    var ops = Array.isArray(a.ops) ? a.ops : [];
    lines.push('补丁数: ' + ops.length + (a.summary ? '；' + a.summary : ''));
    ops.slice(0, 8).forEach(function(op, i) {
      lines.push('  ' + (i + 1) + '. ' + (op.op || op.tool || '?'));
    });
  } else if (toolName.indexOf('greeting') >= 0) {
    lines.push('target: ' + JSON.stringify(a.target != null ? a.target : a.index));
    if (a.instruction) lines.push('要求: ' + String(a.instruction).slice(0, 200));
  } else {
    try {
      lines.push('参数: ' + JSON.stringify(a).slice(0, 400));
    } catch (e) {
      lines.push('参数: [不可序列化]');
    }
  }
  return lines.join('\n');
}
