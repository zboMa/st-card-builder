/**
 * 卡面列表：manifest + 内容寻址 blob（每卡最多 20 张，2048/512 与 avatarIdb 一致）
 */
import {
  idbGetJson,
  idbSetJson,
  idbGetBlob,
  idbSetBlob,
  idbDeleteBlob,
} from '../idbStore.mjs';
import {
  AVATAR_FULL_MAX_DIM,
  AVATAR_THUMB_MAX_DIM,
  AVATAR_FULL_JPEG_QUALITY,
  AVATAR_THUMB_JPEG_QUALITY,
  drawImageToCanvas,
} from '../avatarIdb.mjs';
import { crc32 } from '../utils.mjs';

export var MAX_AVATARS_PER_CARD = 20;

function manifestKey(cardId) {
  return 'cardAvatarsV1:' + String(cardId || '').trim();
}

function blobKey(hash) {
  return 'avatar:blob:' + String(hash || '').trim();
}

function thumbKey(hash) {
  return 'avatar:thumb:' + String(hash || '').trim();
}

function emptyManifest() {
  return { schema: 1, items: [], manifestRev: computeManifestRev([]) };
}

export function computeManifestRev(items) {
  var list = (Array.isArray(items) ? items : []).map(function(it) {
    return String(it.id || '') + ':' + String(it.hash || '') + ':' + (it.primary ? '1' : '0');
  }).sort();
  var bytes = new TextEncoder().encode(JSON.stringify(list));
  return crc32(bytes).toString(16).padStart(8, '0');
}

async function sha256Hex(buffer) {
  if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
    var dig = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(dig)).map(function(b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  }
  var bytes = new Uint8Array(buffer);
  return crc32(bytes).toString(16).padStart(8, '0');
}

function newAvatarGalleryId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return 'av_' + crypto.randomUUID().replace(/-/g, '');
  }
  return 'av_' + String(Date.now()) + '_' + Math.random().toString(36).slice(2, 10);
}

function canvasToJpegBlob(canvas, quality) {
  return new Promise(function(resolve, reject) {
    canvas.toBlob(function(blob) {
      if (!blob) reject(new Error('canvas_to_blob_failed'));
      else resolve(blob);
    }, 'image/jpeg', quality);
  });
}

export async function loadAvatarManifest(cardId) {
  var id = String(cardId || '').trim();
  if (!id) return emptyManifest();
  var raw = await idbGetJson(manifestKey(id)).catch(function() { return null; });
  if (!raw || !Array.isArray(raw.items)) return emptyManifest();
  var items = raw.items.slice();
  var seenIds = Object.create(null);
  var repaired = false;
  items = items.filter(function(it) { return it && it.id && it.hash; }).map(function(it) {
    var copy = Object.assign({}, it);
    if (seenIds[copy.id]) {
      copy.id = newAvatarGalleryId();
      repaired = true;
    }
    seenIds[copy.id] = true;
    return copy;
  });
  if (repaired) {
    await saveAvatarManifest(id, { schema: 1, items: items });
  }
  return {
    schema: 1,
    items: items,
    manifestRev: raw.manifestRev || computeManifestRev(items),
  };
}

export async function saveAvatarManifest(cardId, manifest) {
  var id = String(cardId || '').trim();
  if (!id) return false;
  var items = Array.isArray(manifest.items) ? manifest.items : [];
  var next = {
    schema: 1,
    items: items,
    manifestRev: computeManifestRev(items),
  };
  await idbSetJson(manifestKey(id), next);
  try {
    var metaMod = await import('../sync/cardCloudMeta.mjs');
    metaMod.touchLocalManifestRevs(id, { localAvatarsManifestRev: next.manifestRev });
  } catch (eMeta) { /* ignore */ }
  return next;
}

export function getPrimaryAvatarId(manifest) {
  var items = manifest && Array.isArray(manifest.items) ? manifest.items : [];
  var primary = items.find(function(it) { return it && it.primary; });
  if (primary && primary.id) return primary.id;
  return items[0] && items[0].id ? items[0].id : '';
}

export function findManifestItem(manifest, avatarId) {
  var aid = String(avatarId || '').trim();
  if (!aid) return null;
  var items = manifest && Array.isArray(manifest.items) ? manifest.items : [];
  for (var i = 0; i < items.length; i++) {
    if (items[i] && items[i].id === aid) return items[i];
  }
  return null;
}

async function ensureBlobPair(fullBlob) {
  var buf = await fullBlob.arrayBuffer();
  var hash = await sha256Hex(buf);
  var existing = await idbGetBlob(blobKey(hash)).catch(function() { return null; });
  if (!existing) {
    await idbSetBlob(blobKey(hash), fullBlob, 'image/jpeg');
    var bmp = await createImageBitmap(fullBlob);
    try {
      var thumbCanvas = drawImageToCanvas(bmp, AVATAR_THUMB_MAX_DIM);
      var thumbBlob = await canvasToJpegBlob(thumbCanvas, AVATAR_THUMB_JPEG_QUALITY);
      await idbSetBlob(thumbKey(hash), thumbBlob, 'image/jpeg');
    } finally {
      if (bmp.close) bmp.close();
    }
  }
  return hash;
}

/** 从 Image 或 File 解码后的 img 追加卡面 */
export async function addGalleryAvatarFromImage(cardId, img, opts) {
  opts = opts || {};
  var id = String(cardId || '').trim();
  if (!id || !img) throw new Error('missing_card_or_image');
  var manifest = await loadAvatarManifest(id);
  if (manifest.items.length >= MAX_AVATARS_PER_CARD) {
    throw new Error('avatar_gallery_full');
  }
  var fullCanvas = drawImageToCanvas(img, AVATAR_FULL_MAX_DIM);
  var fullBlob = await canvasToJpegBlob(fullCanvas, AVATAR_FULL_JPEG_QUALITY);
  var hash = await ensureBlobPair(fullBlob);
  var avatarId = newAvatarGalleryId();
  var isFirst = manifest.items.length === 0;
  manifest.items.push({
    id: avatarId,
    hash: hash,
    label: String(opts.label || '').slice(0, 40),
    createdAt: new Date().toISOString(),
    primary: isFirst || !!opts.primary,
  });
  if (opts.primary) {
    manifest.items.forEach(function(it) { it.primary = it.id === avatarId; });
  }
  await saveAvatarManifest(id, manifest);
  return { avatarId: avatarId, hash: hash, manifest: manifest };
}

export async function setGalleryPrimary(cardId, avatarId) {
  var manifest = await loadAvatarManifest(cardId);
  var found = false;
  manifest.items.forEach(function(it) {
    if (it.id === avatarId) {
      it.primary = true;
      found = true;
    } else {
      it.primary = false;
    }
  });
  if (!found) throw new Error('avatar_not_found');
  return saveAvatarManifest(cardId, manifest);
}

export async function removeGalleryAvatar(cardId, avatarId, opts) {
  opts = opts || {};
  var blocked = opts.blockedIds || [];
  if (blocked.indexOf(avatarId) >= 0) throw new Error('avatar_in_use_published');
  var manifest = await loadAvatarManifest(cardId);
  var nextItems = manifest.items.filter(function(it) { return it.id !== avatarId; });
  if (nextItems.length === manifest.items.length) throw new Error('avatar_not_found');
  if (!nextItems.length) throw new Error('avatar_gallery_empty');
  if (!nextItems.some(function(it) { return it.primary; })) nextItems[0].primary = true;
  manifest.items = nextItems;
  return saveAvatarManifest(cardId, manifest);
}

export async function loadAvatarThumbObjectUrl(cardId, avatarId) {
  var manifest = await loadAvatarManifest(cardId);
  var aid = String(avatarId || '').trim();
  var item = aid ? findManifestItem(manifest, aid) : null;
  if (!item) item = findManifestItem(manifest, getPrimaryAvatarId(manifest));
  if (!item || !item.hash) return '';
  var rec = await idbGetBlob(thumbKey(item.hash)).catch(function() { return null; });
  if (!rec || !rec.blob) {
    rec = await idbGetBlob(blobKey(item.hash)).catch(function() { return null; });
  }
  if (!rec || !rec.blob) return '';
  return URL.createObjectURL(rec.blob);
}

export async function loadAvatarFullDataUrl(cardId, avatarId) {
  var manifest = await loadAvatarManifest(cardId);
  var aid = String(avatarId || '').trim();
  var item = aid ? findManifestItem(manifest, aid) : null;
  if (!item) item = findManifestItem(manifest, getPrimaryAvatarId(manifest));
  if (!item || !item.hash) return '';
  var rec = await idbGetBlob(blobKey(item.hash)).catch(function() { return null; });
  if (!rec || !rec.blob) return '';
  return new Promise(function(resolve, reject) {
    var r = new FileReader();
    r.onload = function() { resolve(String(r.result || '')); };
    r.onerror = function() { reject(r.error); };
    r.readAsDataURL(rec.blob);
  });
}

export function avatarRefForDraft(activeAvatarId) {
  return { type: 'asset', avatarId: String(activeAvatarId || '').trim() };
}

export async function exportBlobForSync(hash) {
  var blob = await idbGetBlob(blobKey(hash)).catch(function() { return null; });
  if (!blob) return null;
  var buf = await blob.arrayBuffer();
  var bin = '';
  var u8 = new Uint8Array(buf);
  for (var i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return {
    hash: hash,
    contentType: 'image/jpeg',
    data: btoa(bin),
  };
}

export async function importBlobFromSync(payload) {
  if (!payload || !payload.hash || !payload.data) return false;
  var hash = String(payload.hash);
  var raw = atob(String(payload.data));
  var u8 = new Uint8Array(raw.length);
  for (var i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i);
  var blob = new Blob([u8], { type: payload.contentType || 'image/jpeg' });
  await idbSetBlob(blobKey(hash), blob, 'image/jpeg');
  var bmp = await createImageBitmap(blob);
  try {
    var thumbCanvas = drawImageToCanvas(bmp, AVATAR_THUMB_MAX_DIM);
    var thumbBlob = await canvasToJpegBlob(thumbCanvas, AVATAR_THUMB_JPEG_QUALITY);
    await idbSetBlob(thumbKey(hash), thumbBlob, 'image/jpeg');
  } finally {
    if (bmp.close) bmp.close();
  }
  return true;
}
