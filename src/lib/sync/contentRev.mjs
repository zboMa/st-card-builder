/**
 * 云 dirty 主判据：草稿正文指纹 + 绑卡 bundle 附属变更计数
 */
import { buildDraftSnapshot } from '../card-builder/state.mjs';
import { crc32 } from '../utils.mjs';
import { getCardCloudMeta, setCardCloudMeta } from './cardCloudMeta.mjs';

function stableDraftPayload(draft) {
  var snap = buildDraftSnapshot(draft);
  delete snap.updatedAt;
  delete snap.contentRev;
  delete snap._cloudStub;
  return JSON.stringify(snap);
}

/** @param {object|null|undefined} draft */
export function computeDraftContentRev(draft) {
  if (!draft || typeof draft !== 'object') return '';
  var bytes = new TextEncoder().encode(stableDraftPayload(draft));
  return crc32(bytes).toString(16).padStart(8, '0');
}

/** 云状态判定用：缺 contentRev 时按正文现算（与 IDB 落盘一致） */
export function draftLocalContentRev(draft) {
  if (!draft || typeof draft !== 'object') return '';
  var rev = String(draft.contentRev || '').trim();
  if (rev) return rev;
  return computeDraftContentRev(draft);
}

/** 写入/合并 draft 时附带 contentRev */
export function attachContentRevToDraft(draft) {
  if (!draft || typeof draft !== 'object') return draft;
  var next = Object.assign({}, draft);
  next.contentRev = computeDraftContentRev(next);
  return next;
}

/** 工坊 / 头像 / RAG 等非 LS 草稿变更 → 递增 bundleTouch */
export function bumpCardBundleTouch(cardId) {
  var id = String(cardId || '').trim();
  if (!id) return 0;
  var prev = getCardCloudMeta(id) || {};
  var next = (prev.bundleTouch || 0) + 1;
  setCardCloudMeta(id, { bundleTouch: next });
  return next;
}

/**
 * 成功上云 / 拉云对齐时写入 meta 基线
 * @param {object|null} draft
 * @param {object|null} meta
 */
export function collectSyncBaseline(draft, meta) {
  meta = meta || {};
  return {
    contentRev: (draft && draft.contentRev) || computeDraftContentRev(draft),
    bundleTouch: meta.bundleTouch != null ? meta.bundleTouch : 0,
    avatarsManifestRev: meta.localAvatarsManifestRev != null
      ? meta.localAvatarsManifestRev
      : (meta.syncedAvatarsManifestRev != null ? meta.syncedAvatarsManifestRev : null),
    versionsManifestRev: meta.localVersionsManifestRev != null
      ? meta.localVersionsManifestRev
      : (meta.syncedVersionsManifestRev != null ? meta.syncedVersionsManifestRev : null),
  };
}
