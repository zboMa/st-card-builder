/**
 * 助手会话持久化（localStorage）
 */

export const ASSISTANT_SESSION_KEY = 'st_v3_builder_assistant_session';
export const ASSISTANT_SNAPSHOT_KEY = 'st_v3_builder_assistant_snapshots';
/** 旧全局会话 → 首张卡一次性迁移标记（v1） */
export const ASSISTANT_SESSION_MIGRATED_KEY = 'st_v3_builder_assistant_session_migrated_v1';
export const MAX_SESSION_MESSAGES = 80;
export const MAX_SNAPSHOTS = 12;

/** 按卡隔离的会话键；无卡（''）时回退全局键（兼容旧数据 / 未建卡前对话） */
export function assistantSessionKeyFor(cardId) {
  var id = String(cardId || '').trim();
  return id ? (ASSISTANT_SESSION_KEY + ':' + id) : ASSISTANT_SESSION_KEY;
}

/** 按卡隔离的快照键；无卡回退全局键 */
export function assistantSnapshotKeyFor(cardId) {
  var id = String(cardId || '').trim();
  return id ? (ASSISTANT_SNAPSHOT_KEY + ':' + id) : ASSISTANT_SNAPSHOT_KEY;
}

/**
 * 旧全局会话一次性迁移到指定卡：仅当该卡尚无会话且旧键有消息时执行一次。
 * @param {Storage|null|undefined} storage
 * @param {string} cardId
 */
export function migrateLegacyAssistantSession(storage, cardId) {
  var id = String(cardId || '').trim();
  if (!storage || !id) return false;
  try {
    if (storage.getItem(ASSISTANT_SESSION_MIGRATED_KEY) === '1') return false;
    var targetKey = assistantSessionKeyFor(id);
    var legacyRaw = storage.getItem(ASSISTANT_SESSION_KEY);
    if (!legacyRaw) {
      storage.setItem(ASSISTANT_SESSION_MIGRATED_KEY, '1');
      return false;
    }
    var parsed = null;
    try { parsed = JSON.parse(legacyRaw); } catch (e) { parsed = null; }
    if (!parsed || !Array.isArray(parsed.messages) || !parsed.messages.length) {
      storage.setItem(ASSISTANT_SESSION_MIGRATED_KEY, '1');
      return false;
    }
    if (storage.getItem(targetKey)) {
      storage.setItem(ASSISTANT_SESSION_MIGRATED_KEY, '1');
      return false;
    }
    storage.setItem(targetKey, legacyRaw);
    storage.setItem(ASSISTANT_SESSION_MIGRATED_KEY, '1');
    return true;
  } catch (e) { /* quota / privacy */ return false; }
}

/**
 * @param {Storage|null|undefined} storage
 * @param {string|(() => string)} [keyOrResolver] 固定键或按需解析函数（默认全局键）
 */
export function createAssistantSessionStore(storage, keyOrResolver) {
  function resolveKey() {
    if (typeof keyOrResolver === 'function') return String(keyOrResolver() || ASSISTANT_SESSION_KEY);
    return keyOrResolver || ASSISTANT_SESSION_KEY;
  }

  function readSession() {
    if (!storage) return { messages: [], ragInjectedIds: [], updatedAt: 0 };
    try {
      var raw = storage.getItem(resolveKey());
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
      storage.setItem(resolveKey(), JSON.stringify({
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
    currentKey: resolveKey,
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
 * @param {string|(() => string)} [keyOrResolver] 固定键或按需解析函数（默认全局键）
 */
export function createSnapshotStack(storage, keyOrResolver) {
  function resolveKey() {
    if (typeof keyOrResolver === 'function') return String(keyOrResolver() || ASSISTANT_SNAPSHOT_KEY);
    return keyOrResolver || ASSISTANT_SNAPSHOT_KEY;
  }

  function read() {
    if (!storage) return [];
    try {
      var raw = storage.getItem(resolveKey());
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function write(stack) {
    if (!storage) return;
    try {
      storage.setItem(resolveKey(), JSON.stringify((stack || []).slice(-MAX_SNAPSHOTS)));
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

  return { KEY: ASSISTANT_SNAPSHOT_KEY, currentKey: resolveKey, read: read, write: write, push: push, pop: pop, peek: peek };
}
