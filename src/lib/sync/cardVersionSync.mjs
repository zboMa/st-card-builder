/**
 * 版本表增量上云 / 下拉
 */
import { putCloudDoc, getCloudDoc } from './cloudApi.mjs';
import {
  loadCardVersionsStore,
  saveCardVersionsStore,
  computeVersionsManifestRev,
  buildVersionsManifest,
} from '../card-builder/cardVersionsStore.mjs';
import { setCardCloudMeta, getCardCloudMeta } from './cardCloudMeta.mjs';
import { normalizeCharacterVersion } from '../card-builder/cardRelease.mjs';

function manifestDocId(cardId) {
  return 'card/' + String(cardId || '').trim() + '/versions/manifest';
}

function snapshotDocId(cardId, ver) {
  return 'card/' + String(cardId || '').trim() + '/versions/snapshots/'
    + encodeURIComponent(normalizeCharacterVersion(ver));
}

export async function fetchRemoteVersionsManifest(cardId) {
  try {
    var res = await getCloudDoc(manifestDocId(cardId));
    return res && res.doc ? res.doc : null;
  } catch (e) {
    if (e && e.status === 404) return null;
    throw e;
  }
}

export async function syncVersionsUpload(cardId) {
  var id = String(cardId || '').trim();
  var store = await loadCardVersionsStore(id);
  var entries = store.entries || [];
  var remote = await fetchRemoteVersionsManifest(id);
  var remoteMap = Object.create(null);
  (remote && Array.isArray(remote.items) ? remote.items : []).forEach(function(it) {
    if (it && it.ver) remoteMap[normalizeCharacterVersion(it.ver)] = it.snapshotRev;
  });
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    var ver = normalizeCharacterVersion(e.ver);
    if (remoteMap[ver] === e.snapshotRev) continue;
    await putCloudDoc({
      _id: snapshotDocId(id, ver),
      type: 'card-version-snapshot',
      cardId: id,
      ver: ver,
      entry: e,
      updatedAt: new Date().toISOString(),
    }, { force: true });
  }
  var manifest = buildVersionsManifest(entries);
  await putCloudDoc(Object.assign({ _id: manifestDocId(id), type: 'card-versions-manifest', cardId: id }, manifest), {
    force: true,
  });
  setCardCloudMeta(id, {
    syncedVersionsManifestRev: manifest.manifestRev,
    cloudVersionsManifestRev: manifest.manifestRev,
  });
  return { ok: true, manifestRev: manifest.manifestRev };
}

export async function syncVersionsDownload(cardId) {
  var id = String(cardId || '').trim();
  var remote = await fetchRemoteVersionsManifest(id);
  if (!remote || !Array.isArray(remote.items)) return { ok: false, skipped: true };
  var store = await loadCardVersionsStore(id);
  var localMap = Object.create(null);
  (store.entries || []).forEach(function(e) {
    localMap[normalizeCharacterVersion(e.ver)] = e.snapshotRev;
  });
  var merged = store.entries.slice();
  for (var i = 0; i < remote.items.length; i++) {
    var ri = remote.items[i];
    var ver = normalizeCharacterVersion(ri.ver);
    if (localMap[ver] === ri.snapshotRev) continue;
    try {
      var snap = await getCloudDoc(snapshotDocId(id, ver));
      var entry = snap && snap.doc && snap.doc.entry;
      if (!entry) continue;
      var idx = merged.findIndex(function(x) { return normalizeCharacterVersion(x.ver) === ver; });
      if (idx >= 0) merged[idx] = entry;
      else merged.push(entry);
    } catch (eS) { /* skip */ }
  }
  await saveCardVersionsStore(id, { entries: merged });
  var rev = remote.manifestRev || computeVersionsManifestRev(merged);
  setCardCloudMeta(id, {
    syncedVersionsManifestRev: rev,
    cloudVersionsManifestRev: rev,
  });
  return { ok: true, manifestRev: rev, entries: merged };
}

export function resolveVersionsSyncDirty(cardId, entries) {
  var meta = getCardCloudMeta(cardId) || {};
  var localRev = computeVersionsManifestRev(entries || []);
  var synced = String(meta.syncedVersionsManifestRev || '');
  var cloud = String(meta.cloudVersionsManifestRev || '');
  return {
    localDirty: synced && localRev !== synced,
    remoteDirty: cloud && synced && cloud !== synced,
    localRev: localRev,
    syncedRev: synced,
    cloudRev: cloud,
  };
}
