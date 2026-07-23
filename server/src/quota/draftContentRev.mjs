/**
 * 与服务端 bundle 索引一致的 contentRev（复用前端 buildDraftSnapshot + crc32）
 */
import { buildDraftSnapshot } from '../../../src/lib/card-builder/state.mjs';
import { crc32 } from '../../../src/lib/utils.mjs';

function stableDraftPayload(draft) {
  var snap = buildDraftSnapshot(draft);
  delete snap.updatedAt;
  delete snap.contentRev;
  delete snap._cloudStub;
  return JSON.stringify(snap);
}

export function computeDraftContentRev(draft) {
  if (!draft || typeof draft !== 'object') return '';
  var bytes = new TextEncoder().encode(stableDraftPayload(draft));
  return crc32(bytes).toString(16).padStart(8, '0');
}

/** 估算 PUT bundle JSON 体积（字节） */
export function estimateBundleBytes(bundle) {
  try {
    return new TextEncoder().encode(JSON.stringify(bundle || {})).length;
  } catch (e) {
    return 0;
  }
}
