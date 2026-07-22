/**
 * 头像 ↔ 云端（本地仍用 IndexedDB）
 */
import { cloudSaveAvatar, ensureCardBundleLocal, isCloudEnabled } from './cloudStore.mjs';
import {
  idbAvatarFullKey,
  idbAvatarThumbKey,
  idbGetBlob,
} from '../idbStore.mjs';

export async function mirrorAvatarToPouch(cardId) {
  return cloudSaveAvatar(cardId);
}

export async function hydrateAvatarFromPouch(cardId) {
  var id = String(cardId || '').trim();
  if (!id) return { full: false, thumb: false };
  var existingFull = await idbGetBlob(idbAvatarFullKey(id));
  var existingThumb = await idbGetBlob(idbAvatarThumbKey(id));
  if ((existingFull && existingFull.blob) && (existingThumb && existingThumb.blob)) {
    return { full: false, thumb: false };
  }
  if (!isCloudEnabled()) return { full: false, thumb: false };
  try {
    await ensureCardBundleLocal(id, { force: true });
  } catch (e) {
    return { full: false, thumb: false };
  }
  var full2 = await idbGetBlob(idbAvatarFullKey(id));
  var thumb2 = await idbGetBlob(idbAvatarThumbKey(id));
  return {
    full: !!(full2 && full2.blob) && !(existingFull && existingFull.blob),
    thumb: !!(thumb2 && thumb2.blob) && !(existingThumb && existingThumb.blob),
  };
}

export async function hydrateAvatarsFromCardIndex() {
  // bundle 水合时已带头像；此处不再全库扫描
  return 0;
}
