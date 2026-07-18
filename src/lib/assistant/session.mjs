/**
 * 助手会话持久化（localStorage）
 */

export const ASSISTANT_SESSION_KEY = 'st_v3_builder_assistant_session';
export const ASSISTANT_SNAPSHOT_KEY = 'st_v3_builder_assistant_snapshots';
export const MAX_SESSION_MESSAGES = 80;
export const MAX_SNAPSHOTS = 12;

/**
 * @param {Storage|null|undefined} storage
 */
export function createAssistantSessionStore(storage) {
  function readSession() {
    if (!storage) return { messages: [], ragInjectedIds: [], updatedAt: 0 };
    try {
      var raw = storage.getItem(ASSISTANT_SESSION_KEY);
      if (!raw) return { messages: [], ragInjectedIds: [], updatedAt: 0 };
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.messages)) return { messages: [], ragInjectedIds: [], updatedAt: 0 };
      return {
        messages: parsed.messages,
        ragInjectedIds: Array.isArray(parsed.ragInjectedIds) ? parsed.ragInjectedIds : [],
        updatedAt: parsed.updatedAt || 0,
      };
    } catch (e) {
      return { messages: [], ragInjectedIds: [], updatedAt: 0 };
    }
  }

  function writeSession(session) {
    if (!storage) return;
    try {
      var prev = readSession();
      var msgs = (session.messages != null ? session.messages : prev.messages || []).slice(-MAX_SESSION_MESSAGES);
      var ragInjectedIds = session.ragInjectedIds != null
        ? session.ragInjectedIds
        : (prev.ragInjectedIds || []);
      storage.setItem(ASSISTANT_SESSION_KEY, JSON.stringify({
        messages: msgs,
        ragInjectedIds: ragInjectedIds,
        updatedAt: Date.now(),
      }));
    } catch (e) { /* quota */ }
  }

  function appendMessage(msg) {
    var s = readSession();
    s.messages.push(msg);
    writeSession(s);
    return s;
  }

  function clearSession() {
    writeSession({ messages: [], ragInjectedIds: [], updatedAt: Date.now() });
  }

  function setMessages(messages) {
    writeSession({ messages: messages || [], updatedAt: Date.now() });
  }

  function setRagInjectedIds(ids) {
    var s = readSession();
    s.ragInjectedIds = Array.isArray(ids) ? ids : [];
    writeSession(s);
  }

  return {
    KEY: ASSISTANT_SESSION_KEY,
    read: readSession,
    write: writeSession,
    append: appendMessage,
    clear: clearSession,
    setMessages: setMessages,
    setRagInjectedIds: setRagInjectedIds,
  };
}

/**
 * 补丁快照栈（用于 undo_last_bundle）
 * @param {Storage|null|undefined} storage
 */
export function createSnapshotStack(storage) {
  function read() {
    if (!storage) return [];
    try {
      var raw = storage.getItem(ASSISTANT_SNAPSHOT_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function write(stack) {
    if (!storage) return;
    try {
      storage.setItem(ASSISTANT_SNAPSHOT_KEY, JSON.stringify((stack || []).slice(-MAX_SNAPSHOTS)));
    } catch (e) { /* quota */ }
  }

  function push(snapshot) {
    var stack = read();
    stack.push(Object.assign({ at: Date.now() }, snapshot));
    write(stack);
    return stack.length;
  }

  function pop() {
    var stack = read();
    if (!stack.length) return null;
    var last = stack.pop();
    write(stack);
    return last;
  }

  function peek() {
    var stack = read();
    return stack.length ? stack[stack.length - 1] : null;
  }

  return { KEY: ASSISTANT_SNAPSHOT_KEY, read: read, write: write, push: push, pop: pop, peek: peek };
}
