/**
 * 卡面 gallery 增量上云 / 下拉
 */
import { putCloudDoc, getCloudDoc } from './cloudApi.mjs';
import {
  loadAvatarManifest,
  saveAvatarManifest,
  computeManifestRev,
  exportBlobForSync,
  importBlobFromSync,
} from '../card-builder/cardAvatarGallery.mjs';
import { setCardCloudMeta, getCardCloudMeta } from './cardCloudMeta.mjs';

function manifestDocId(cardId) {
  return 'card/' + String(cardId || '').trim() + '/avatars/manifest';
}

function blobDocId(hash) {
  return 'avatar/blobs/' + String(hash || '').trim();
}

export async function fetchRemoteAvatarManifest(cardId) {
  try {
    var res = await getCloudDoc(manifestDocId(cardId));
    return res && res.doc ? res.doc : null;
  } catch (e) {
    if (e && e.status === 404) return null;
    throw e;
  }
}

export async function syncAvatarGalleryUpload(cardId) {
  var id = String(cardId || '').trim();
  if (!id) return { ok: false };
  var local = await loadAvatarManifest(id);
  var remote = await fetchRemoteAvatarManifest(id);
  var remoteItems = remote && Array.isArray(remote.items) ? remote.items : [];
  var remoteHashes = Object.create(null);
  remoteItems.forEach(function(it) {
    if (it && it.hash) remoteHashes[it.hash] = true;
  });
  for (var i = 0; i < local.items.length; i++) {
    var h = local.items[i].hash;
    if (!h || remoteHashes[h]) continue;
    var payload = await exportBlobForSync(h);
    if (!payload) continue;
    await putCloudDoc({
      _id: blobDocId(h),
      type: 'avatar-blob',
      hash: h,
      contentType: payload.contentType,
      encoding: 'base64',
      data: payload.data,
      updatedAt: new Date().toISOString(),
    }, { force: true });
  }
  await putCloudDoc({
    _id: manifestDocId(id),
    type: 'card-avatars-manifest',
    cardId: id,
    schema: 1,
    items: local.items,
    manifestRev: local.manifestRev || computeManifestRev(local.items),
    updatedAt: new Date().toISOString(),
  }, { force: true });
  var rev = local.manifestRev || computeManifestRev(local.items);
  setCardCloudMeta(id, {
    syncedAvatarsManifestRev: rev,
    cloudAvatarsManifestRev: rev,
  });
  return { ok: true, manifestRev: rev };
}

export async function syncAvatarGalleryDownload(cardId) {
  var id = String(cardId || '').trim();
  var remote = await fetchRemoteAvatarManifest(id);
  if (!remote || !Array.isArray(remote.items)) return { ok: false, skipped: true };
  var remoteItems = remote.items;
  var local = await loadAvatarManifest(id);
  var localHashes = Object.create(null);
  local.items.forEach(function(it) { if (it.hash) localHashes[it.hash] = true; });
  for (var i = 0; i < remoteItems.length; i++) {
    var rh = remoteItems[i].hash;
    if (!rh || localHashes[rh]) continue;
    try {
      var doc = await getCloudDoc(blobDocId(rh));
      var d = doc && doc.doc;
      if (d && d.data) {
        await importBlobFromSync({
          hash: rh,
          contentType: d.contentType || 'image/jpeg',
          data: d.data,
        });
      }
    } catch (eB) { /* skip missing blob */ }
  }
  await saveAvatarManifest(id, { items: remoteItems });
  var rev = remote.manifestRev || computeManifestRev(remoteItems);
  setCardCloudMeta(id, {
    syncedAvatarsManifestRev: rev,
    cloudAvatarsManifestRev: rev,
  });
  return { ok: true, manifestRev: rev };
}

export function resolveAvatarsSyncDirty(cardId, localManifest) {
  var meta = getCardCloudMeta(cardId) || {};
  var localRev = localManifest.manifestRev || computeManifestRev(localManifest.items || []);
  var synced = String(meta.syncedAvatarsManifestRev || '');
  var cloud = String(meta.cloudAvatarsManifestRev || '');
  var localDirty = synced && localRev !== synced;
  var remoteDirty = cloud && synced && cloud !== synced;
  return { localDirty: localDirty, remoteDirty: remoteDirty, localRev: localRev, syncedRev: synced, cloudRev: cloud };
}
