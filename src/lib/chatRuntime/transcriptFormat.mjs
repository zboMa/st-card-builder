/**
 * 试聊 verbatim 正文格式（§6.3.8.1 · D12）
 */

/**
 * @param {{ id?: string, role: string, content: string }[]} messages
 * @param {{ userName?: string, sceneName?: string, episodeId?: string, date?: string }} opts
 */
export function formatChatTranscriptVerbatim(messages, opts) {
  var o = opts || {};
  var userName = String(o.userName != null ? o.userName : 'User');
  var sceneName = String(o.sceneName != null ? o.sceneName : '场景');
  var list = Array.isArray(messages) ? messages : [];
  var dateStr = o.date || new Date().toISOString().slice(0, 10);
  var episodeId = String(o.episodeId || '—');
  var lines = [
    '---',
    '试聊归档',
    'Episode: ' + episodeId,
    '消息: ' + list.length + ' 条 · ' + dateStr,
    '---',
    '',
  ];
  list.forEach(function(m) {
    if (!m) return;
    var label = m.role === 'user' ? userName : sceneName;
    lines.push('【' + label + '】');
    lines.push(String(m.content || '').trim());
    lines.push('');
  });
  return lines.join('\n').replace(/\n+$/, '');
}

/** @returns {{ messages: object[], skipped: number }} */
export function pickMessagesByIds(allMessages, messageIds) {
  var ids = Array.isArray(messageIds) ? messageIds.map(String) : [];
  var map = {};
  (allMessages || []).forEach(function(m) {
    if (m && m.id) map[m.id] = m;
  });
  var out = [];
  var skipped = 0;
  ids.forEach(function(id) {
    if (map[id]) out.push(map[id]);
    else skipped++;
  });
  return { messages: out, skipped: skipped };
}

export function transcriptDigestFromMessages(messages, maxLen) {
  var max = maxLen != null ? maxLen : 200;
  var text = (messages || []).map(function(m) {
    return (m.role === 'user' ? 'U: ' : 'A: ') + String(m.content || '').replace(/\s+/g, ' ').trim();
  }).join(' · ');
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}
