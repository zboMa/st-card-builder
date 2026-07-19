/**
 * 助手工具轨迹：折叠摘要与展开详情
 */

/** @type {Record<string, string>} */
var PENDING_TOOL_LABELS = {
  generate_worldbook_entry: '生成并写入世界书条目',
  generate_worldbook_skeleton: '生成世界书骨架',
  generate_character_draft: '生成角色草稿',
  organize_worldbook: '整理世界书',
  switch_card: '切换卡片',
  rewrite_worldbook_entry: '重写世界书条目',
  replace_character_section: '替换角色段落',
  delete_worldbook_entry: '删除世界书条目',
  apply_patch_bundle: '应用补丁包',
};

/**
 * @param {string} toolName
 * @param {object} result
 * @param {object} [args]
 * @returns {string}
 */
export function summarizeToolTrace(toolName, result, args) {
  var a = args || {};
  var r = result || {};

  if (r.pendingConfirm) {
    return summarizePendingConfirm(toolName, a, r.preview || r.message);
  }

  if (!r.ok) {
    var err = String(r.error || 'unknown');
    return err.split('\n')[0].slice(0, 120);
  }

  var data = r.data != null ? r.data : r;

  if (toolName === 'get_worldbook_list') {
    var n = data.count != null
      ? data.count
      : (Array.isArray(data.entries) ? data.entries.length : null);
    return n != null ? ('获取 ' + n + ' 条世界书') : '获取世界书列表';
  }

  if (toolName === 'get_worldbook_entry') {
    var entry = data.entry || {};
    var title = entry.comment || entry.name || ('#' + (data.index != null ? data.index : '?'));
    return '读取条目：' + title;
  }

  if (toolName === 'delete_worldbook_entry') {
    if (data.clearedAll) {
      return '已清空全部 ' + (data.deleted != null ? data.deleted : 0) + ' 条';
    }
    return '删除 ' + (data.deleted != null ? data.deleted : '?') + ' 条，剩余 '
      + (data.remaining != null ? data.remaining : '?');
  }

  if (toolName === 'get_character_fields') {
    return '读取角色字段';
  }

  if (toolName === 'lint_card' || toolName === 'audit_worldbook') {
    var issues = Array.isArray(data.issues) ? data.issues.length : null;
    if (issues != null) return '诊断 ' + issues + ' 项问题';
  }

  return summarizeJsonData(data);
}

/**
 * @param {string} toolName
 * @param {object} [args]
 * @param {string} [preview]
 * @returns {string}
 */
export function summarizePendingConfirm(toolName, args, preview) {
  var a = args || {};
  if (toolName === 'delete_worldbook_entry') {
    if (a.all === true || a.indices === 'all' || a.indices === '*') {
      return '待确认：清空全部世界书';
    }
    if (typeof a.index === 'number') return '待确认：删除世界书条目 #' + a.index;
    if (a.target && a.target.titleMatch) return '待确认：删除「' + a.target.titleMatch + '」';
    return '待确认：删除世界书条目';
  }
  if (PENDING_TOOL_LABELS[toolName]) {
    return '待确认：' + PENDING_TOOL_LABELS[toolName];
  }
  if (preview) {
    var first = String(preview).split('\n').find(function(line) { return line.trim(); }) || '';
    if (first.indexOf('工具: ') === 0) first = first.slice(4).trim();
    if (first) return '待确认：' + first.slice(0, 72);
  }
  return '待确认：' + toolName;
}

/**
 * @param {*} data
 * @returns {string}
 */
export function summarizeJsonData(data) {
  try {
    var s = JSON.stringify(data, null, 0);
    if (!s || s === '{}') return '完成';
    if (s.length > 80) return s.slice(0, 77) + '… · 点击展开';
    return s;
  } catch (e) {
    return '完成';
  }
}

/**
 * @param {string} toolName
 * @param {object} result
 * @param {object} [args]
 * @returns {string}
 */
export function buildToolTraceDetail(toolName, result, args) {
  var r = result || {};
  if (r.pendingConfirm) {
    var lines = [];
    if (r.preview) lines.push(String(r.preview));
    else if (args && Object.keys(args).length) {
      try { lines.push('参数: ' + JSON.stringify(args, null, 2)); } catch (e) { console.warn('Stringifying tool args for trace failed', e); }
    } else {
      lines.push(r.message || '等待用户确认');
    }
    return lines.join('\n');
  }
  if (!r.ok) {
    return '错误: ' + (r.error || 'unknown');
  }
  try {
    var data = r.data != null ? r.data : r;
    return JSON.stringify(data, null, 2);
  } catch (e) {
    return 'ok';
  }
}

/**
 * @param {string} toolName
 * @param {object} args
 * @param {object} result
 * @returns {object}
 */
export function buildToolUiMessage(toolName, args, result) {
  var r = result || {};
  var risk = r.risk || '?';
  var summary = summarizeToolTrace(toolName, r, args);
  var detail = buildToolTraceDetail(toolName, r, args);
  var header = toolName + ' [' + risk + ']';
  return {
    role: 'tool',
    toolName: toolName,
    risk: risk,
    summary: summary,
    detail: detail,
    content: header + '\n' + detail,
    error: !r.ok && !r.pendingConfirm,
    pendingConfirm: !!r.pendingConfirm,
  };
}

/**
 * 从旧版纯文本轨迹解析工具名（会话恢复兼容）
 * @param {string} content
 * @returns {string|null}
 */
export function parseToolNameFromLegacy(content) {
  if (!content) return null;
  var m = String(content).match(/^⚙\s*(\S+)/);
  return m ? m[1] : null;
}

/**
 * @param {string} content
 * @returns {string|null}
 */
export function parseRiskFromLegacy(content) {
  if (!content) return null;
  var m = String(content).match(/\[(\w+)\]/);
  return m ? m[1] : null;
}

/**
 * @param {object} msg
 * @returns {string}
 */
export function toolMessageSummary(msg) {
  if (msg.summary) return msg.summary;
  var content = String(msg.content || '');
  if (/等待确认|需确认/.test(content)) {
    return content.split('\n')[1] || content.split('\n')[0].replace(/^⚙\s*/, '');
  }
  if (/^错误:/.test(content.split('\n').slice(1).join('\n'))) {
    return content.split('\n').find(function(l) { return l.indexOf('错误:') === 0; }) || content.slice(0, 80);
  }
  var body = content.replace(/^[^\n]+\n?/, '');
  if (body.length > 80) return body.slice(0, 77) + '… · 点击展开';
  return body || content.slice(0, 80);
}
