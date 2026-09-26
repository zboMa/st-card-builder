/**
 * 助手工具轨迹：折叠摘要与展开详情
 */
import { entryDisplayLabel } from '../worldbook/worldbookEntryBridge.mjs';
import { getToolByName, toolTitleOf } from './tools.mjs';

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
    var title = entry.comment || entryDisplayLabel(entry) || entry.name
      || ('#' + (data.index != null ? data.index : '?'));
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

  if (toolName === 'lint_for_sillytavern' || toolName === 'lint_card' || toolName === 'audit_worldbook') {
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
  return '待确认：' + toolTitleOf(toolName);
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
 * 送模只用返回或错误。调用参数留在上一句模型自己的工具调用里，也留在卡片的 toolArgs 上。
 * @param {string} toolName
 * @param {object} [args]
 * @param {object} result
 * @returns {string}
 */
export function buildToolModelDetail(toolName, args, result) {
  var r = result || {};
  if (r.pendingConfirm) {
    return '状态: 待确认\n' + (r.message || '等待用户确认');
  }
  if (!r.ok) {
    return '返回: 错误 — ' + (r.error || 'unknown');
  }
  try {
    var data = r.data != null ? r.data : r;
    return '返回: ' + JSON.stringify(data, null, 2);
  } catch (e2) {
    return '返回: ok';
  }
}

function isLegacyCallEcho(text) {
  var s = String(text || '');
  return /(^|\n)调用:\s*/.test(s) && /(^|\n)参数:\s*/.test(s);
}

/** 旧会话的 modelDetail 把参数又写了一遍。发送时只留「返回」。 */
export function stripToolCallEcho(text) {
  var s = String(text || '').trim();
  if (!isLegacyCallEcho(s)) return s;
  var m = s.match(/(?:^|\n)(返回:[\s\S]*)$/);
  return m ? m[1].trim() : s;
}

/** 送模的工具正文：优先纯返回 detail；否则从旧的「调用+参数+返回」里剥掉参数。 */
export function toolResultBodyForModel(msg) {
  if (!msg || msg.running) return '';
  var detail = String(msg.detail || '').trim();
  if (detail && !isLegacyCallEcho(detail)) return detail;
  return stripToolCallEcho(msg.modelDetail || msg.content || '');
}

/** 送模摘要。界面用的「点击展开」和截断 JSON 不进模型。 */
export function modelFacingToolSummary(msg) {
  var s = String((msg && msg.summary) || '').trim().replace(/\s*·\s*点击展开\s*$/, '');
  if (!s || /点击展开/.test(String((msg && msg.summary) || '')) || s.length > 80) {
    return toolTitleOf(msg && msg.toolName);
  }
  return s;
}

/** 执行中的工具卡。不送模；结果回来后就地换成 buildToolUiMessage。 */
export function buildRunningToolMessage(toolName, args) {
  var meta = getToolByName(toolName);
  return {
    role: 'tool',
    toolName: toolName,
    toolArgs: args && typeof args === 'object' ? args : {},
    risk: (meta && meta.risk) || 'confirm',
    summary: '执行中…',
    detail: '',
    modelDetail: '',
    content: '',
    running: true,
    error: false,
    pendingConfirm: false,
  };
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
  var modelDetail = buildToolModelDetail(toolName, args, r);
  var header = toolName + ' [' + risk + ']';
  return {
    role: 'tool',
    toolName: toolName,
    toolArgs: args && typeof args === 'object' ? args : {},
    risk: risk,
    summary: summary,
    detail: detail,
    /** 送模正文：只有返回或错误，不含调用参数 */
    modelDetail: modelDetail,
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
