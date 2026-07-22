/**
 * 角色卡云端状态元数据（本地）
 * 三种：local_only | cloud_dirty | cloud_synced
 */
export var CARD_CLOUD_META_KEY = 'st_v3_card_cloud_meta_v1';

export var CLOUD_STATUS = {
  LOCAL_ONLY: 'local_only',
  CLOUD_DIRTY: 'cloud_dirty',
  CLOUD_SYNCED: 'cloud_synced',
};

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
    lastSyncedAt: null,
  });
}

export function markCardSynced(cardId, cloudUpdatedAt, localUpdatedAt) {
  return setCardCloudMeta(cardId, {
    onCloud: true,
    cloudUpdatedAt: cloudUpdatedAt || localUpdatedAt || null,
    localSyncedAt: localUpdatedAt || cloudUpdatedAt || null,
    lastSyncedAt: new Date().toISOString(),
  });
}

/**
 * @param {object} draft 本地草稿
 * @param {object|null} meta
 * @returns {'local_only'|'cloud_dirty'|'cloud_synced'}
 */
export function resolveCardCloudStatus(draft, meta) {
  if (draft && draft._cloudStub) return CLOUD_STATUS.CLOUD_DIRTY;
  if (!meta || !meta.onCloud) return CLOUD_STATUS.LOCAL_ONLY;
  var localAt = String((draft && draft.updatedAt) || '');
  var cloudAt = String(meta.cloudUpdatedAt || '');
  var syncedLocal = String(meta.localSyncedAt || '');
  // 有 pending 标记
  if (meta.pendingUpload || meta.pendingDownload) return CLOUD_STATUS.CLOUD_DIRTY;
  // 本地时间相对上次同步基线有变化
  if (syncedLocal && localAt && localAt !== syncedLocal) return CLOUD_STATUS.CLOUD_DIRTY;
  // 已知云端时间与本地不一致
  if (cloudAt && localAt && cloudAt !== localAt) return CLOUD_STATUS.CLOUD_DIRTY;
  return CLOUD_STATUS.CLOUD_SYNCED;
}

export function cloudStatusLabel(status) {
  if (status === CLOUD_STATUS.CLOUD_SYNCED) return '上云已同步';
  if (status === CLOUD_STATUS.CLOUD_DIRTY) return '上云未同步';
  return '未上云';
}

/** 合并云端索引摘要到 meta（对齐后调用） */
export function mergeCloudIndexIntoMeta(cards) {
  var list = Array.isArray(cards) ? cards : [];
  var all = readAll();
  var seen = Object.create(null);
  list.forEach(function(c) {
    if (!c || !c.id) return;
    seen[c.id] = true;
    var prev = all[c.id] || {};
    all[c.id] = Object.assign({}, prev, {
      cardId: c.id,
      onCloud: true,
      cloudUpdatedAt: c.updatedAt || prev.cloudUpdatedAt || null,
      updatedAt: new Date().toISOString(),
    });
  });
  writeAll(all);
  return Object.keys(seen).length;
}

export function readAllCardCloudMeta() {
  return readAll();
}
