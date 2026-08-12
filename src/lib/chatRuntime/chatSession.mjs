/**
 * 试聊 session 持久化（§6.3.7 · D15）
 * localStorage: st_v3_chat_playground_session:{draftId}
 */

export var CHAT_SESSION_PREFIX = 'st_v3_chat_playground_session:';
export var CHAT_SESSION_TRIM = 80;
export var CHAT_ANALYZE_DEFAULT = 16;

export function chatSessionKey(draftId) {
  var id = String(draftId || '').trim();
  if (!id) return '';
  return CHAT_SESSION_PREFIX + id;
}

export function genChatMessageId() {
  return 'msg_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

export function emptyChatSession() {
  return {
    messages: [],
    selection: { messageIds: [], updatedAt: 0 },
    focusNpc: '',
    updatedAt: Date.now(),
  };
}

export function normalizeChatSession(raw) {
  var base = emptyChatSession();
  if (!raw || typeof raw !== 'object') return base;
  var msgs = Array.isArray(raw.messages) ? raw.messages : [];
  base.messages = msgs.map(function(m, i) {
    if (!m || typeof m !== 'object') return null;
    var role = m.role === 'user' ? 'user' : 'assistant';
    return {
      id: String(m.id || genChatMessageId() + '_' + i),
      role: role,
      content: String(m.content || ''),
      at: typeof m.at === 'number' ? m.at : 0,
    };
  }).filter(Boolean);
  if (base.messages.length > CHAT_SESSION_TRIM) {
    base.messages = base.messages.slice(-CHAT_SESSION_TRIM);
  }
  var sel = raw.selection && typeof raw.selection === 'object' ? raw.selection : {};
  base.selection = {
    messageIds: Array.isArray(sel.messageIds) ? sel.messageIds.map(String) : [],
    updatedAt: typeof sel.updatedAt === 'number' ? sel.updatedAt : 0,
  };
  base.focusNpc = raw.focusNpc != null ? String(raw.focusNpc) : '';
  base.updatedAt = typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now();
  return base;
}

export function loadChatSession(draftId) {
  var key = chatSessionKey(draftId);
  if (!key || typeof localStorage === 'undefined') return emptyChatSession();
  try {
    var raw = JSON.parse(localStorage.getItem(key) || 'null');
    return normalizeChatSession(raw);
  } catch (e) {
    return emptyChatSession();
  }
}

export function saveChatSession(draftId, session) {
  var key = chatSessionKey(draftId);
  if (!key || typeof localStorage === 'undefined') return false;
  var norm = normalizeChatSession(session);
  norm.updatedAt = Date.now();
  try {
    localStorage.setItem(key, JSON.stringify(norm));
    return true;
  } catch (e) {
    return false;
  }
}

export function deleteChatSession(draftId) {
  var key = chatSessionKey(draftId);
  if (!key || typeof localStorage === 'undefined') return false;
  try {
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    return false;
  }
}

/** @param {string[]} messageIds */
export function resolveSessionMessages(session, messageIds) {
  var s = normalizeChatSession(session);
  var ids = Array.isArray(messageIds) ? messageIds.map(String) : [];
  if (!ids.length) {
    return s.messages.slice(-CHAT_ANALYZE_DEFAULT);
  }
  var map = {};
  s.messages.forEach(function(m) { map[m.id] = m; });
  var out = [];
  ids.forEach(function(id) {
    if (map[id]) out.push(map[id]);
  });
  return out;
}

export function countValidSelection(session) {
  var s = normalizeChatSession(session);
  var ids = s.selection.messageIds || [];
  if (!ids.length) return 0;
  var set = {};
  s.messages.forEach(function(m) { set[m.id] = true; });
  return ids.filter(function(id) { return set[id]; }).length;
}
