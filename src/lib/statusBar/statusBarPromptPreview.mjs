/**
 * 状态栏 AI 任务提示词预览（与 panelBoot 生成链路共用 vars 语义）
 */
import { appendStylePreset } from '../statusBarBuild.mjs';

/**
 * @param {string} tpl
 * @param {Record<string, string>} vars
 */
export function applyStatusBarPromptTemplate(tpl, vars) {
  return String(tpl || '').replace(/\{\{(\w+)\}\}/g, function(_, k) {
    return vars && vars[k] != null ? String(vars[k]) : '';
  });
}

/**
 * @param {{ title: string, body: string }[]} sections
 */
export function formatStatusBarPromptSections(sections) {
  return (sections || [])
    .filter(function(s) { return s && String(s.body || '').trim(); })
    .map(function(s) {
      return '── ' + String(s.title || '段落') + ' ──\n' + String(s.body || '');
    })
    .join('\n\n');
}

/**
 * @param {{
 *   dialogTitle: string,
 *   promptId: string,
 *   taskType: string,
 *   metaLines?: string[],
 *   systemTpl: string,
 *   vars: Record<string, string>,
 *   userMessage: string,
 *   presetsStr?: string,
 *   applyTemplate?: (tpl: string, vars: Record<string, string>) => string,
 * }} opts
 * @returns {{ title: string, text: string }}
 */
export function composeStatusBarPromptPreview(opts) {
  var o = opts || {};
  var apply = o.applyTemplate || applyStatusBarPromptTemplate;
  var sys = appendStylePreset(apply(o.systemTpl, o.vars || {}), o.presetsStr);
  var sections = [];
  if (o.metaLines && o.metaLines.length) {
    sections.push({ title: '元信息', body: o.metaLines.join('\n') });
  }
  sections.push({
    title: '系统提示（' + (o.promptId || 'template') + '）',
    body: sys,
  });
  sections.push({
    title: '用户消息（' + (o.taskType || 'task') + '）',
    body: String(o.userMessage || '').trim() || '（空）',
  });
  return {
    title: o.dialogTitle || '状态栏提示词',
    text: formatStatusBarPromptSections(sections),
  };
}
