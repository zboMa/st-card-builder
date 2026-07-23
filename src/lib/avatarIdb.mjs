/**
 * 头像：高清 + 缩略图存 IndexedDB，草稿 JSON 仅存 avatarInIdb 标记
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

/** 保存高清 + 封面缩略图 */
export async function saveAvatarFromImage(draftId, img) {
  if (!draftId || !img) return false;
  var fullCanvas = drawImageToCanvas(img, AVATAR_FULL_MAX_DIM);
  var thumbCanvas = drawImageToCanvas(img, AVATAR_THUMB_MAX_DIM);
  var fullBlob = await canvasToJpegBlob(fullCanvas, AVATAR_FULL_JPEG_QUALITY);
  var thumbBlob = await canvasToJpegBlob(thumbCanvas, AVATAR_THUMB_JPEG_QUALITY);
  await idbSetBlob(idbAvatarFullKey(draftId), fullBlob, 'image/jpeg');
  await idbSetBlob(idbAvatarThumbKey(draftId), thumbBlob, 'image/jpeg');
  try {
    var revMod = await import('./sync/contentRev.mjs');
    revMod.bumpCardBundleTouch(draftId);
  } catch (eRev) { /* ignore */ }
  try {
    var sync = await import('./sync/avatarMirror.mjs');
    await sync.mirrorAvatarToPouch(draftId);
  } catch (e) {
    console.warn('[avatar] pouch mirror', e);
  }
  return true;
}

/** 读取高清 data URL（角色设定预览 / PNG 导出） */
export async function loadAvatarFullDataUrl(draftId) {
  var rec = await idbGetBlob(idbAvatarFullKey(draftId));
  if (!rec) return '';
  return blobToDataUrl(rec.blob);
}

/** 读取封面 object URL（调用方需在适当时机 revoke；缺缩略图时回退高清） */
export async function loadAvatarThumbObjectUrl(draftId) {
  var rec = await idbGetBlob(idbAvatarThumbKey(draftId));
  if (!rec) rec = await idbGetBlob(idbAvatarFullKey(draftId));
  if (!rec) return '';
  return URL.createObjectURL(rec.blob);
}

export async function copyAvatarDraft(fromDraftId, toDraftId) {
  if (!fromDraftId || !toDraftId || fromDraftId === toDraftId) return false;
  var okFull = await idbCopyBlob(idbAvatarFullKey(fromDraftId), idbAvatarFullKey(toDraftId));
  var okThumb = await idbCopyBlob(idbAvatarThumbKey(fromDraftId), idbAvatarThumbKey(toDraftId));
  if (okFull || okThumb) {
    try {
      var sync = await import('./sync/avatarMirror.mjs');
      await sync.mirrorAvatarToPouch(toDraftId);
    } catch (e) {
      console.warn('[avatar] pouch mirror copy', e);
    }
  }
  return okFull || okThumb;
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

/** 旧草稿 avatarBase64 → IndexedDB */
export async function migrateAvatarBase64ToIdb(draftId, base64) {
  if (!draftId || !base64) return false;
  return new Promise(function(resolve) {
    var img = new Image();
    img.onload = function() {
      saveAvatarFromImage(draftId, img).then(function() { resolve(true); }).catch(function() { resolve(false); });
    };
    img.onerror = function() { resolve(false); };
    img.src = base64;
  });
}
