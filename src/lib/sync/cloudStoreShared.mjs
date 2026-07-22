/**
 * 云端存储：共享状态与 outbox 桥（拆自 cloudStore）
 */
import * as api from './cloudApi.mjs';
import { enqueueOutbox, flushOutbox, getOutboxSize } from './outbox.mjs';
import { DOC, buildCardIndexFromDrafts, catalogNovelsList } from './docIds.mjs';
import {
  idbGetJson,
  idbSetJson,
  idbGetBlob,
  idbSetBlob,
  idbNovelKey,
  idbAvatarFullKey,
  idbAvatarThumbKey,
} from '../idbStore.mjs';

var DRAFTS_KEY = 'st_v3_builder_drafts';
var cloudEnabled = false;
var lastCloudAt = null;
var lastCloudError = null;
var syncing = false;
var listeners = [];

export function onCloudEvent(fn) {
  listeners.push(fn);
  return function() {
    listeners = listeners.filter(function(x) { return x !== fn; });
  };
}

export function emit(type, detail) {
  listeners.forEach(function(fn) {
    try { fn({ type: type, detail: detail }); } catch (e) { /* ignore */ }
  });
}

export function setCloudEnabled(on) {
  cloudEnabled = !!on;
}

export function isCloudEnabled() {
  return !!cloudEnabled;
}

export function getCloudStatus() {
  return {
    enabled: cloudEnabled,
    syncing: syncing,
    lastCloudAt: lastCloudAt,
    lastCloudError: lastCloudError,
    outboxSize: getOutboxSize(),
  };
}

export function readDrafts() {
  try {
    return JSON.parse(localStorage.getItem(DRAFTS_KEY) || '{}') || {};
  } catch (e) {
    return {};
  }
}

export function writeDrafts(drafts) {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts || {}));
}

export function blobToBase64(blob) {
  return new Promise(function(resolve, reject) {
    if (!blob) {
      resolve('');
      return;
    }
    var reader = new FileReader();
    reader.onload = function() {
      var s = String(reader.result || '');
      var i = s.indexOf(',');
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    reader.onerror = function() {
      reject(reader.error || new Error('blob_read_failed'));
    };
    reader.readAsDataURL(blob);
  });
}

export function base64ToBlob(b64, contentType) {
  var bin = atob(String(b64 || ''));
  var len = bin.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: contentType || 'image/jpeg' });
}

export async function readLocalAvatarParts(cardId) {
  var full = await idbGetBlob(idbAvatarFullKey(cardId)).catch(function() { return null; });
  var thumb = await idbGetBlob(idbAvatarThumbKey(cardId)).catch(function() { return null; });
  var out = { full: null, thumb: null };
  if (full && full.blob) {
    out.full = {
      data: await blobToBase64(full.blob),
      contentType: full.mime || full.blob.type || 'image/jpeg',
    };
  }
  if (thumb && thumb.blob) {
    out.thumb = {
      data: await blobToBase64(thumb.blob),
      contentType: thumb.mime || thumb.blob.type || 'image/jpeg',
    };
  }
  return out;
}

export async function withCloudOrOutbox(op, runner, outboxItem) {
  if (!cloudEnabled) {
    if (outboxItem) enqueueOutbox(outboxItem);
    return { queued: true, offline: true };
  }
  try {
    var result = await runner();
    lastCloudAt = new Date().toISOString();
    lastCloudError = null;
    return result;
  } catch (e) {
    lastCloudError = String(e && e.message || e);
    if (e && e.status === 401) {
      cloudEnabled = false;
      throw e;
    }
    if (outboxItem) enqueueOutbox(outboxItem);
    emit('queued', { op: op, error: lastCloudError });
    return { queued: true, error: lastCloudError };
  }
}
export async function handleOutboxItem(item) {
  switch (item.op) {
    case 'putCard':
      return api.putCardDraft(item.cardId, item.body && item.body.data);
    case 'putBundle':
      return api.putCardBundle(item.cardId, item.body && item.body.bundle);
    case 'deleteCard':
      return api.deleteCloudCard(item.cardId, {
        deleteStories: !!(item.body && item.body.deleteStories),
      });
    case 'putNovel':
      return api.putNovel(item.cardId, item.body && item.body.data);
    case 'putRag':
      return api.putRag(item.cardId, item.body && item.body.data);
    case 'putAvatar':
      return api.putAvatar(item.cardId, item.body.kind, item.body.data, item.body.contentType);
    case 'putStoryCatalog':
      return api.putStoryCatalog(item.cardId, item.body && item.body.data);
    case 'putStoryNovel':
      return api.putStoryNovel(item.cardId, item.body && item.body.data);
    case 'putStoryActive':
      return api.putStoryActive(item.cardId, item.body && item.body.novelId);
    case 'putStoryRelease':
      return api.putStoryRelease(item.cardId, item.body && item.body.novelId, item.body && item.body.data);
    case 'deleteStoryNovel':
      return api.deleteStoryNovel(item.cardId, item.body && item.body.novelId);
    case 'putPrefs':
      return api.putPrefs(item.body.kind, item.body.data);
    case 'putDoc':
      return api.putCloudDoc(item.body);
    case 'putSecrets':
      return api.putAiSecretsEnc(item.body.enc, item.body.packageVersion);
    case 'deleteSecrets':
      return api.deleteAiSecretsEnc();
    default:
      console.warn('[cloud] unknown outbox op', item.op);
  }
}

export function markCloudSyncedAt(iso) {
  lastCloudAt = iso;
  lastCloudError = null;
}

export function setCloudError(msg) {
  lastCloudError = msg;
}

export function setSyncing(on) {
  syncing = !!on;
}

export function getCloudEnabledRef() {
  return cloudEnabled;
}

export function disableCloudOnAuth() {
  cloudEnabled = false;
}

export { flushOutbox, getOutboxSize, enqueueOutbox, DOC, buildCardIndexFromDrafts, catalogNovelsList };
