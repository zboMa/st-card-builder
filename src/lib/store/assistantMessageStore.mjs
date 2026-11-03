import { atom } from 'nanostores';

var seq = 0;

export function createAssistantMessageId() {
  seq += 1;
  return 'msg-' + Date.now().toString(36) + '-' + seq.toString(36) + '-' + Math.random().toString(36).slice(2, 6);
}

function emptyRecord() {
  return { order: [], byId: {} };
}

function normalizeMessage(message) {
  var msg = message && typeof message === 'object' && !Array.isArray(message)
    ? Object.assign({}, message)
    : { role: 'assistant', content: message == null ? '' : String(message) };
  if (!msg.id || typeof msg.id !== 'string') msg.id = createAssistantMessageId();
  return msg;
}

function buildRecord(messages) {
  var order = [];
  var byId = {};
  (Array.isArray(messages) ? messages : []).forEach(function(message) {
    var msg = normalizeMessage(message);
    if (byId[msg.id]) msg.id = createAssistantMessageId();
    order.push(msg.id);
    byId[msg.id] = msg;
  });
  return { order: order, byId: byId };
}

function cloneRecord(record) {
  return { order: record.order.slice(), byId: Object.assign({}, record.byId) };
}

export const assistantMessagesStore = atom(emptyRecord());
export const assistantMessageViewsStore = atom([]);

export function setAssistantMessageViews(list) {
  assistantMessageViewsStore.set(Array.isArray(list) ? list : []);
}

export function getMessages() {
  var record = assistantMessagesStore.get();
  return record.order.map(function(id) { return record.byId[id]; });
}

export function getMessageCount() {
  return assistantMessagesStore.get().order.length;
}

export function getMessageAt(index) {
  var record = assistantMessagesStore.get();
  var id = record.order[Number(index)];
  return id ? record.byId[id] : null;
}

export function getMessageById(id) {
  if (!id) return null;
  return assistantMessagesStore.get().byId[String(id)] || null;
}

export function replaceAllMessages(messages) {
  assistantMessagesStore.set(buildRecord(messages));
}

export function appendMessage(message) {
  var record = cloneRecord(assistantMessagesStore.get());
  var msg = normalizeMessage(message);
  if (record.byId[msg.id]) msg.id = createAssistantMessageId();
  record.order.push(msg.id);
  record.byId[msg.id] = msg;
  assistantMessagesStore.set(record);
  return msg;
}

export function insertMessageAt(index, message) {
  var record = cloneRecord(assistantMessagesStore.get());
  var msg = normalizeMessage(message);
  if (record.byId[msg.id]) msg.id = createAssistantMessageId();
  var at = Number(index);
  if (!Number.isFinite(at)) at = record.order.length;
  at = Math.max(0, Math.min(record.order.length, at));
  record.order.splice(at, 0, msg.id);
  record.byId[msg.id] = msg;
  assistantMessagesStore.set(record);
  return msg;
}

export function replaceMessageAt(index, message) {
  var record = cloneRecord(assistantMessagesStore.get());
  var at = Number(index);
  if (!Number.isFinite(at) || at < 0 || at >= record.order.length) return null;
  var id = record.order[at];
  var msg = normalizeMessage(message);
  msg.id = id;
  record.byId[id] = msg;
  assistantMessagesStore.set(record);
  return msg;
}

export function patchMessageAt(index, patch) {
  var current = getMessageAt(index);
  if (!current) return null;
  return replaceMessageAt(index, Object.assign({}, current, patch || {}));
}

export function removeMessageAt(index) {
  var record = cloneRecord(assistantMessagesStore.get());
  var at = Number(index);
  if (!Number.isFinite(at) || at < 0 || at >= record.order.length) return false;
  var id = record.order.splice(at, 1)[0];
  delete record.byId[id];
  assistantMessagesStore.set(record);
  return true;
}

export function clearMessages() {
  assistantMessagesStore.set(emptyRecord());
}
