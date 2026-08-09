/**
 * 头像：gallery 门面 + 旧 per-card IDB 迁移
 */
import {
  idbAvatarFullKey,
  idbAvatarThumbKey,
  idbSetBlob,
  idbGetBlob,
  idbDeleteBlob,
  idbCopyBlob,
  blobToDataUrl,
} from './idbStore.mjs';
import {
  addGalleryAvatarFromImage,
  loadAvatarManifest,
  loadAvatarThumbObjectUrl as galleryThumbUrl,
  loadAvatarFullDataUrl as galleryFullUrl,
  getPrimaryAvatarId,
  findManifestItem,
  setGalleryPrimary,
} from './card-builder/cardAvatarGallery.mjs';
import { getDraftsMapSync } from './draftsStore.mjs';

export const AVATAR_FULL_MAX_DIM = 2048;
export const AVATAR_THUMB_MAX_DIM = 512;
export const AVATAR_FULL_JPEG_QUALITY = 0.92;
export const AVATAR_THUMB_JPEG_QUALITY = 0.85;

/** 计算缩放后尺寸（纯函数，便于单测） */
export function computeScaledSize(width, height, maxDim) {
  var w = Number(width) || 0;
  var h = Number(height) || 0;
  var max = Number(maxDim) || 1;
  if (!w || !h) return { width: 1, height: 1, scale: 1 };
  var scale = Math.min(1, max / Math.max(w, h));
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
    scale: scale,
  };
}

/** 将图片画到 canvas（浏览器） */
export function drawImageToCanvas(img, maxDim) {
  var w = img.naturalWidth || img.width;
  var h = img.naturalHeight || img.height;
  var size = computeScaledSize(w, h, maxDim);
  var cv = document.createElement('canvas');
  cv.width = size.width;
  cv.height = size.height;
  cv.getContext('2d').drawImage(img, 0, 0, size.width, size.height);
  return cv;
}

function canvasToJpegBlob(canvas, quality) {
  return new Promise(function(resolve, reject) {
    canvas.toBlob(function(blob) {
      if (!blob) {
        reject(new Error('canvas_to_blob_failed'));
        return;
      }
      resolve(blob);
    }, 'image/jpeg', quality);
  });
}

function readDraftActiveAvatarId(draftId) {
  try {
    var dr = getDraftsMapSync() || {};
    var d = dr[draftId];
    if (d && d.activeAvatarId) return String(d.activeAvatarId).trim();
  } catch (e) { /* ignore */ }
  return '';
}

/** 旧单卡头像 → gallery（一次性） */
export async function maybeMigrateLegacyAvatarToGallery(draftId) {
  var id = String(draftId || '').trim();
  if (!id) return null;
  var manifest = await loadAvatarManifest(id);
  if (manifest.items.length) return manifest;
  var full = await idbGetBlob(idbAvatarFullKey(id)).catch(function() { return null; });
  if (!full || !full.blob) return manifest;
  var url = URL.createObjectURL(full.blob);
  try {
    var img = await new Promise(function(resolve, reject) {
      var im = new Image();
      im.onload = function() { resolve(im); };
      im.onerror = function() { reject(new Error('decode_failed')); };
      im.src = url;
    });
    var added = await addGalleryAvatarFromImage(id, img, { primary: true, label: '迁移' });
    return added.manifest;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function resolveAvatarId(draftId, avatarId) {
  await maybeMigrateLegacyAvatarToGallery(draftId);
  var aid = String(avatarId || readDraftActiveAvatarId(draftId) || '').trim();
  if (aid) return aid;
  var manifest = await loadAvatarManifest(draftId);
  return getPrimaryAvatarId(manifest);
}

/** 保存高清 + 设为当前卡面；返回 avatarId */
export async function saveAvatarFromImage(draftId, img, opts) {
  if (!draftId || !img) return '';
  opts = opts || {};
  var added = await addGalleryAvatarFromImage(draftId, img, {
    primary: opts.primary !== false,
    label: opts.label || '',
  });
  if (opts.primary !== false) {
    await setGalleryPrimary(draftId, added.avatarId);
  }
  try {
    var sync = await import('./sync/avatarMirror.mjs');
    await sync.mirrorAvatarToPouch(draftId);
  } catch (e) {
    console.warn('[avatar] pouch mirror', e);
  }
  return added.avatarId;
}

/** 读取高清 data URL（角色设定预览 / PNG 导出） */
export async function loadAvatarFullDataUrl(draftId, avatarId) {
  var aid = await resolveAvatarId(draftId, avatarId);
  if (!aid) return '';
  return galleryFullUrl(draftId, aid);
}

/** 读取封面 object URL */
export async function loadAvatarThumbObjectUrl(draftId, avatarId) {
  var aid = await resolveAvatarId(draftId, avatarId);
  if (!aid) return '';
  return galleryThumbUrl(draftId, aid);
}

/** 云 bundle 兼容：按 active 卡面导出 base64 */
export async function readActiveAvatarPartsForCloud(draftId, draft) {
  var id = String(draftId || '').trim();
  await maybeMigrateLegacyAvatarToGallery(id);
  var aid = String((draft && draft.activeAvatarId) || readDraftActiveAvatarId(id) || '').trim();
  var manifest = await loadAvatarManifest(id);
  var item = findManifestItem(manifest, aid) || findManifestItem(manifest, getPrimaryAvatarId(manifest));
  var out = { full: null, thumb: null };
  if (!item || !item.hash) {
    var full = await idbGetBlob(idbAvatarFullKey(id)).catch(function() { return null; });
    var thumb = await idbGetBlob(idbAvatarThumbKey(id)).catch(function() { return null; });
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
  var blobKey = 'avatar:blob:' + item.hash;
  var thumbKey = 'avatar:thumb:' + item.hash;
  var fullRec = await idbGetBlob(blobKey).catch(function() { return null; });
  var thumbRec = await idbGetBlob(thumbKey).catch(function() { return null; });
  if (fullRec && fullRec.blob) {
    out.full = {
      data: await blobToBase64(fullRec.blob),
      contentType: fullRec.mime || fullRec.blob.type || 'image/jpeg',
    };
  }
  if (thumbRec && thumbRec.blob) {
    out.thumb = {
      data: await blobToBase64(thumbRec.blob),
      contentType: thumbRec.mime || thumbRec.blob.type || 'image/jpeg',
    };
  }
  return out;
}

async function blobToBase64(blob) {
  var buf = await blob.arrayBuffer();
  var bin = '';
  var u8 = new Uint8Array(buf);
  for (var i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin);
}

/** 把任意图片 data URL 重编码为 PNG data URL（导出卡需要真 PNG 底图） */
export function dataUrlToPngDataUrl(dataUrl) {
  return new Promise(function(resolve, reject) {
    var img = new Image();
    img.onload = function() {
      try {
        var cv = document.createElement('canvas');
        cv.width = img.naturalWidth || img.width;
        cv.height = img.naturalHeight || img.height;
        cv.getContext('2d').drawImage(img, 0, 0);
        resolve(cv.toDataURL('image/png'));
      } catch (e) {
        reject(new Error('头像转 PNG 失败'));
      }
    };
    img.onerror = function() { reject(new Error('头像图片无法解码')); };
    img.src = dataUrl;
  });
}

export async function copyAvatarDraft(fromDraftId, toDraftId) {
  if (!fromDraftId || !toDraftId || fromDraftId === toDraftId) return false;
  await maybeMigrateLegacyAvatarToGallery(fromDraftId);
  var manifest = await loadAvatarManifest(fromDraftId);
  if (!manifest.items.length) {
    var okFull = await idbCopyBlob(idbAvatarFullKey(fromDraftId), idbAvatarFullKey(toDraftId));
    var okThumb = await idbCopyBlob(idbAvatarThumbKey(fromDraftId), idbAvatarThumbKey(toDraftId));
    return okFull || okThumb;
  }
  var { saveAvatarManifest, computeManifestRev } = await import('./card-builder/cardAvatarGallery.mjs');
  var copied = manifest.items.map(function(it) {
    return Object.assign({}, it, {
      id: 'av_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    });
  });
  if (copied.length && !copied.some(function(it) { return it.primary; })) copied[0].primary = true;
  await saveAvatarManifest(toDraftId, { items: copied });
  return copied.length > 0;
}

export async function deleteAvatarDraft(draftId) {
  if (!draftId) return;
  await idbDeleteBlob(idbAvatarFullKey(draftId));
  await idbDeleteBlob(idbAvatarThumbKey(draftId));
  try {
    var revMod = await import('./sync/contentRev.mjs');
    revMod.bumpCardBundleTouch(draftId);
  } catch (eRev) { /* ignore */ }
}

/** 旧草稿 avatarBase64 → gallery */
export async function migrateAvatarBase64ToIdb(draftId, base64) {
  if (!draftId || !base64) return false;
  return new Promise(function(resolve) {
    var img = new Image();
    img.onload = function() {
      saveAvatarFromImage(draftId, img, { primary: true }).then(function() { resolve(true); }).catch(function() { resolve(false); });
    };
    img.onerror = function() { resolve(false); };
    img.src = base64;
  });
}
