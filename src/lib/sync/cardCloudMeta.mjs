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
    localSyncedAt: null,
    lastSyncedAt: null,
    pendingUpload: false,
    pendingDownload: false,
  });
}

export function markCardSynced(cardId, cloudUpdatedAt, localUpdatedAt) {
  return setCardCloudMeta(cardId, {
    onCloud: true,
    cloudUpdatedAt: cloudUpdatedAt || localUpdatedAt || null,
    localSyncedAt: localUpdatedAt || cloudUpdatedAt || null,
    lastSyncedAt: new Date().toISOString(),
    // 成功同步后清掉挂起标记，否则会永远显示「未同步」
    pendingUpload: false,
    pendingDownload: false,
  });
}

/**
 * @param {object} draft 本地草稿
 * @param {object|null} meta
 * @returns {'local_only'|'cloud_dirty'|'cloud_synced'}
 *
 * 判定以「本地是否相对上次成功同步基线有变化」为准。
 * 不把 cloudUpdatedAt 与 draft.updatedAt 直接比字符串：云索引可能是 ISO，
 * 本地草稿常用 locale 时分秒，硬比会永远 dirty。
 */
export function resolveCardCloudStatus(draft, meta) {
  if (draft && draft._cloudStub) return CLOUD_STATUS.CLOUD_DIRTY;
  if (!meta || !meta.onCloud) return CLOUD_STATUS.LOCAL_ONLY;
  var syncedLocal = String(meta.localSyncedAt || '');
  // 从未 markCardSynced 成功：仅云端索引/onCloud 标记不算「已上云」
  if (!syncedLocal) return CLOUD_STATUS.LOCAL_ONLY;
  if (meta.pendingUpload || meta.pendingDownload) return CLOUD_STATUS.CLOUD_DIRTY;
  var localAt = String((draft && draft.updatedAt) || '');
  if (localAt && localAt !== syncedLocal) return CLOUD_STATUS.CLOUD_DIRTY;
  return CLOUD_STATUS.CLOUD_SYNCED;
}

export function cloudStatusLabel(status) {
  if (status === CLOUD_STATUS.CLOUD_SYNCED) return '上云已同步';
  if (status === CLOUD_STATUS.CLOUD_DIRTY) return '上云未同步';
  return '未上云';
}

/**
 * 卡底栏「更多」左侧的云快捷操作（⋯ 菜单内云项不变）。
 * 已同步：不显示；未上云 / 未同步：同步上云。
 * @returns {{ action: string, label: string }|null}
 */
export function resolveCardCloudQuickAction(status) {
  if (status === CLOUD_STATUS.CLOUD_SYNCED) return null;
  return { action: 'cloud-upload', label: '同步上云' };
}

/** 合并云端索引摘要到 meta（对齐后调用；不擅自置 onCloud，避免误报未同步） */
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
