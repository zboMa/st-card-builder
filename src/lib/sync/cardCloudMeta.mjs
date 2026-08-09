/**
 * 角色卡云端状态元数据（localStorage sidecar）
 */
import { draftLocalContentRev } from './contentRev.mjs';

export var CARD_CLOUD_META_KEY = 'st_v3_card_cloud_meta_v1';

export var CLOUD_STATUS = {
  LOCAL_ONLY: 'local_only',
  CLOUD_SYNCED: 'cloud_synced',
  DIRTY_LOCAL: 'dirty_local',
  DIRTY_REMOTE: 'dirty_remote',
  DIRTY_BOTH: 'dirty_both',
};

export var CLOUD_DIRTY = CLOUD_STATUS.DIRTY_LOCAL;

function readAll() {
  if (typeof localStorage === 'undefined') return {};
  try {
    var raw = JSON.parse(localStorage.getItem(CARD_CLOUD_META_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch (e) {
    return {};
  }
}

function writeAll(map) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CARD_CLOUD_META_KEY, JSON.stringify(map || {}));
  } catch (e) {
    console.warn('[cloud-meta] write failed', e);
  }
}

export function getCardCloudMeta(cardId) {
  var id = String(cardId || '').trim();
  if (!id) return null;
  var all = readAll();
  return all[id] || null;
}

export function setCardCloudMeta(cardId, patch) {
  var id = String(cardId || '').trim();
  if (!id) return null;
  var all = readAll();
  var prev = all[id] || {};
  var next = Object.assign({}, prev, patch || {}, {
    cardId: id,
    updatedAt: new Date().toISOString(),
  });
  all[id] = next;
  writeAll(all);
  return next;
}

export function clearCardCloudMeta(cardId) {
  var id = String(cardId || '').trim();
  if (!id) return;
  var all = readAll();
  delete all[id];
  writeAll(all);
}

export function markCardOnCloud(cardId, cloudUpdatedAt) {
  return setCardCloudMeta(cardId, {
    onCloud: true,
    cloudUpdatedAt: cloudUpdatedAt || null,
    lastSyncedAt: new Date().toISOString(),
  });
}

export function markCardLocalOnly(cardId) {
  return setCardCloudMeta(cardId, {
    onCloud: false,
    cloudUpdatedAt: null,
    localSyncedAt: null,
    syncedContentRev: null,
    cloudContentRev: null,
    syncedAvatarsManifestRev: null,
    cloudAvatarsManifestRev: null,
    localAvatarsManifestRev: null,
    syncedVersionsManifestRev: null,
    cloudVersionsManifestRev: null,
    localVersionsManifestRev: null,
    syncedBundleTouch: null,
    bundleTouch: null,
    lastSyncedAt: null,
    pendingUpload: false,
    pendingDownload: false,
  });
}

export function markCardSynced(cardId, cloudUpdatedAt, localUpdatedAt, syncBaseline) {
  syncBaseline = syncBaseline || {};
  var prev = getCardCloudMeta(cardId) || {};
  var bundleTouch = syncBaseline.bundleTouch != null
    ? syncBaseline.bundleTouch
    : (prev.bundleTouch != null ? prev.bundleTouch : 0);
  var syncedRev = syncBaseline.contentRev || null;
  var avRev = syncBaseline.avatarsManifestRev != null
    ? syncBaseline.avatarsManifestRev
    : prev.localAvatarsManifestRev;
  var verRev = syncBaseline.versionsManifestRev != null
    ? syncBaseline.versionsManifestRev
    : prev.localVersionsManifestRev;
  return setCardCloudMeta(cardId, {
    onCloud: true,
    cloudUpdatedAt: cloudUpdatedAt || localUpdatedAt || null,
    localSyncedAt: localUpdatedAt || cloudUpdatedAt || null,
    syncedContentRev: syncedRev,
    cloudContentRev: syncedRev,
    syncedAvatarsManifestRev: avRev,
    cloudAvatarsManifestRev: avRev,
    localAvatarsManifestRev: avRev,
    syncedVersionsManifestRev: verRev,
    cloudVersionsManifestRev: verRev,
    localVersionsManifestRev: verRev,
    syncedBundleTouch: bundleTouch,
    lastSyncedAt: new Date().toISOString(),
    pendingUpload: false,
    pendingDownload: false,
  });
}

function revLocalDirty(localRev, syncedRev) {
  if (!syncedRev) return false;
  return !!localRev && localRev !== syncedRev;
}

function revRemoteDirty(cloudRev, syncedRev, localRev) {
  if (!syncedRev || !cloudRev) return false;
  if (cloudRev === syncedRev) return false;
  if (localRev && localRev !== syncedRev) return false;
  return cloudRev !== syncedRev;
}

function revBothDirty(localRev, cloudRev, syncedRev) {
  if (!syncedRev || !localRev || !cloudRev) return false;
  return localRev !== syncedRev && cloudRev !== syncedRev && localRev !== cloudRev;
}

export function resolveCardCloudStatus(draft, meta, ctx) {
  ctx = ctx || {};
  if (draft && draft._cloudStub) return CLOUD_STATUS.DIRTY_LOCAL;
  if (!meta || !meta.onCloud) return CLOUD_STATUS.LOCAL_ONLY;
  var syncedLocal = String(meta.localSyncedAt || '');
  if (!syncedLocal && !meta.syncedContentRev) return CLOUD_STATUS.LOCAL_ONLY;
  if (meta.pendingUpload) return CLOUD_STATUS.DIRTY_LOCAL;
  if (meta.pendingDownload) return CLOUD_STATUS.DIRTY_REMOTE;

  var localWork = draftLocalContentRev(draft);
  var syncedWork = String(meta.syncedContentRev || '');
  var cloudWork = String(meta.cloudContentRev || '').trim();

  var localAv = String(ctx.avatarsManifestRev || meta.localAvatarsManifestRev || '');
  var syncedAv = String(meta.syncedAvatarsManifestRev || '');
  var cloudAv = String(meta.cloudAvatarsManifestRev || '');

  var localVer = String(ctx.versionsManifestRev || meta.localVersionsManifestRev || '');
  var syncedVer = String(meta.syncedVersionsManifestRev || '');
  var cloudVer = String(meta.cloudVersionsManifestRev || '');

  var hasLocal = [
    revLocalDirty(localWork, syncedWork),
    revLocalDirty(localAv, syncedAv),
    revLocalDirty(localVer, syncedVer),
    meta.syncedBundleTouch != null && meta.bundleTouch != null && meta.bundleTouch !== meta.syncedBundleTouch,
  ].some(Boolean);

  var hasRemote = [
    revRemoteDirty(cloudWork, syncedWork, localWork),
    revRemoteDirty(cloudAv, syncedAv, localAv),
    revRemoteDirty(cloudVer, syncedVer, localVer),
  ].some(Boolean);

  var hasBoth = [
    revBothDirty(localWork, cloudWork, syncedWork),
    revBothDirty(localAv, cloudAv, syncedAv),
    revBothDirty(localVer, cloudVer, syncedVer),
  ].some(Boolean);

  if (!meta.syncedContentRev) {
    var localAt = String((draft && draft.updatedAt) || '');
    if (localAt && localAt !== syncedLocal) hasLocal = true;
  }

  if (hasBoth || (hasLocal && hasRemote)) return CLOUD_STATUS.DIRTY_BOTH;
  if (hasRemote) return CLOUD_STATUS.DIRTY_REMOTE;
  if (hasLocal) return CLOUD_STATUS.DIRTY_LOCAL;
  return CLOUD_STATUS.CLOUD_SYNCED;
}

export function cloudStatusLabel(status) {
  if (status === CLOUD_STATUS.CLOUD_SYNCED) return '上云已同步';
  if (status === CLOUD_STATUS.DIRTY_LOCAL) return '本地有新改动';
  if (status === CLOUD_STATUS.DIRTY_REMOTE) return '云端有更新';
  if (status === CLOUD_STATUS.DIRTY_BOTH) return '本地与云端均有新改动';
  return '未上云';
}

export function resolveCardCloudQuickAction(status) {
  if (status === CLOUD_STATUS.CLOUD_SYNCED) return null;
  if (status === CLOUD_STATUS.DIRTY_REMOTE || status === CLOUD_STATUS.DIRTY_BOTH) {
    return { action: 'cloud-download', label: '从云端更新' };
  }
  return { action: 'cloud-upload', label: '同步上云' };
}

export function mergeCloudIndexIntoMeta(cards) {
  var list = Array.isArray(cards) ? cards : [];
  var all = readAll();
  list.forEach(function(c) {
    if (!c || !c.id) return;
    var prev = all[c.id] || {};
    all[c.id] = Object.assign({}, prev, {
      cardId: c.id,
      cloudUpdatedAt: c.updatedAt || prev.cloudUpdatedAt || null,
      cloudContentRev: c.contentRev != null ? String(c.contentRev) : (prev.cloudContentRev || null),
      cloudAvatarsManifestRev: c.avatarsManifestRev != null
        ? String(c.avatarsManifestRev) : (prev.cloudAvatarsManifestRev || null),
      cloudVersionsManifestRev: c.versionsManifestRev != null
        ? String(c.versionsManifestRev) : (prev.cloudVersionsManifestRev || null),
      updatedAt: new Date().toISOString(),
    });
  });
  writeAll(all);
  return list.length;
}

export function readAllCardCloudMeta() {
  return readAll();
}

export function touchLocalManifestRevs(cardId, patch) {
  return setCardCloudMeta(cardId, patch || {});
}

export function isCloudOutOfSync(status) {
  return status !== CLOUD_STATUS.CLOUD_SYNCED && status !== CLOUD_STATUS.LOCAL_ONLY;
}
