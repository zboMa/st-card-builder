/**
 * 助手 {{locationBlock}}（§6.5.5 · D13）
 */

import { countValidSelection, loadChatSession } from '../chatRuntime/chatSession.mjs';

var VIEW_LABELS = {
  character: '角色设定',
  worldbook: '世界书',
  'chat-playground': '角色试聊',
  'novel-source': '小说工坊',
  'story-studio': '小说创作',
  'card-manager': '卡管理',
  adult: '成人配置',
  statusbar: '状态栏',
  export: '导出',
};

export function viewLabelFor(viewId) {
  return VIEW_LABELS[String(viewId || '')] || String(viewId || '未知');
}

/**
 * @param {object} ctx
 * @param {string} ctx.viewId
 * @param {string} ctx.draftId
 * @param {string} [ctx.charName]
 * @param {string} [ctx.novelTitle]
 * @param {object} [ctx.cardProgress]
 */
export function buildLocationBlock(ctx) {
  var c = ctx || {};
  var draftId = String(c.draftId || '');
  var shortId = draftId.length > 8 ? draftId.slice(0, 8) + '…' : draftId;
  var session = draftId ? loadChatSession(draftId) : { messages: [], selection: { messageIds: [] } };
  var msgCount = (session.messages || []).length;
  var selCount = countValidSelection(session);
  var lines = [
    '【当前位置】',
    '· 侧栏：' + viewLabelFor(c.viewId) + '（' + String(c.viewId || '') + '）',
    '· 右栏：助手',
    '· 当前卡：' + String(c.charName || '未命名') + '（id:' + shortId + '）',
    '· Story：' + String(c.novelTitle || '未打开'),
    '· 试聊记录：' + msgCount + ' 条；已选段 ' + selCount + ' 条',
  ];
  if (c.cardProgress && c.cardProgress.phase) {
    lines.push('· 制作阶段：' + c.cardProgress.phase);
    var top = (c.cardProgress.suggestions || [])[0];
    if (top && top.label) lines.push('· 建议下一步：' + top.label);
  }
  return lines.join('\n');
}
