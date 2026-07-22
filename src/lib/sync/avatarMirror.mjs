/**
 * 角色卡头像 ↔ Pouch（随用户数据通道同步）
 * IDB blob → base64 文档 avatar/{cardId}/full|thumb
 */
import { avatarDocId } from './docIds.mjs';
import { putDoc, getDoc, getCardIndex } from './pouch.mjs';
import {
  idbAvatarFullKey,
  idbAvatarThumbKey,
  idbSetBlob,
  idbGetBlob,
} from '../idbStore.mjs';

function blobToBase64(blob) {
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

function base64ToBlob(b64, contentType) {
  var bin = atob(String(b64 || ''));
  var len = bin.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: contentType || 'image/jpeg' });
}

async function mirrorOneKind(cardId, kind) {
  var id = String(cardId || '').trim();
  if (!id) return false;
  var key = kind === 'thumb' ? idbAvatarThumbKey(id) : idbAvatarFullKey(id);
  var rec = await idbGetBlob(key);
  if (!rec || !rec.blob) return false;
  var b64 = await blobToBase64(rec.blob);
  if (!b64) return false;
  var ctype = rec.contentType || (rec.blob && rec.blob.type) || 'image/jpeg';
  await putDoc({
    _id: avatarDocId(id, kind),
    type: 'avatar',
    cardId: id,
    kind: kind === 'thumb' ? 'thumb' : 'full',
    contentType: ctype,
    encoding: 'base64',
    data: b64,
    updatedAt: new Date().toISOString(),
  });
  return true;
}

/** 将本机 IDB 头像写入 Pouch（供后续全量 sync 上云） */
export async function mirrorAvatarToPouch(cardId) {
  var id = String(cardId || '').trim();
  if (!id) return { full: false, thumb: false };
  var full = await mirrorOneKind(id, 'full').catch(function(e) {
    console.warn('[sync] avatar full', e);
    return false;
  });
  var thumb = await mirrorOneKind(id, 'thumb').catch(function(e) {
    console.warn('[sync] avatar thumb', e);
    return false;
  });
  return { full: !!full, thumb: !!thumb };
}

async function hydrateOneKind(cardId, kind) {
  var id = String(cardId || '').trim();
  if (!id) return false;
  var doc = await getDoc(avatarDocId(id, kind));
  if (!doc || !doc.data) return false;
  var ctype = doc.contentType || 'image/jpeg';
  var blob = base64ToBlob(doc.data, ctype);
  var key = kind === 'thumb' ? idbAvatarThumbKey(id) : idbAvatarFullKey(id);
  await idbSetBlob(key, blob, ctype);
  return true;
}

/** 从 Pouch 灌回 IDB（缺本地图时） */
export async function hydrateAvatarFromPouch(cardId) {
  var id = String(cardId || '').trim();
  if (!id) return { full: false, thumb: false };
  var existingFull = await idbGetBlob(idbAvatarFullKey(id));
  var existingThumb = await idbGetBlob(idbAvatarThumbKey(id));
  var full = false;
  var thumb = false;
  if (!existingFull || !existingFull.blob) {
    full = await hydrateOneKind(id, 'full').catch(function() { return false; });
  }
  if (!existingThumb || !existingThumb.blob) {
    thumb = await hydrateOneKind(id, 'thumb').catch(function() { return false; });
  }
  return { full: !!full, thumb: !!thumb };
}

/** 同步完成后：按卡索引批量灌头像 */
export async function hydrateAvatarsFromCardIndex() {
  var idx = await getCardIndex();
  var n = 0;
  for (var i = 0; i < idx.length; i++) {
    var meta = idx[i];
    if (!meta || !meta.id) continue;
    var r = await hydrateAvatarFromPouch(meta.id);
    if (r.full || r.thumb) n += 1;
  }
  return n;
}
