/**
 * 版本 snapshot 指纹（单 ver 是否需同步）
 */
import { crc32 } from '../utils.mjs';

function stableSnapshotPayload(snap) {
  if (!snap || typeof snap !== 'object') return '{}';
  var o = {
    ver: snap.ver,
    title: snap.title,
    cardJson: snap.cardJson,
    avatarRef: snap.avatarRef || null,
    published: !!snap.published,
  };
  return JSON.stringify(o);
}

export function computeVersionSnapshotRev(snap) {
  var bytes = new TextEncoder().encode(stableSnapshotPayload(snap));
  return crc32(bytes).toString(16).padStart(8, '0');
}

export function buildVersionSnapshotEntry(snap, meta) {
  meta = meta || {};
  var inner = {
    ver: snap.ver,
    title: snap.title,
    published: !!meta.published,
    publishedAt: meta.publishedAt || null,
    updatedAt: meta.updatedAt || new Date().toISOString(),
    snapshotRev: computeVersionSnapshotRev(snap),
    cardJson: snap.cardJson,
    avatarRef: snap.avatarRef || { type: 'asset', avatarId: '' },
  };
  return inner;
}
