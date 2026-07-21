/**
 * 角色卡发布快照（仅 character_version；不含 WIP）
 */
import { buildCardJSONFromDraft } from './state.mjs';

export function normalizeCharacterVersion(raw) {
  var s = String(raw == null ? '' : raw).trim();
  return s || '1.0';
}

/**
 * @param {object} draft 本地草稿
 * @param {{ publishedAt?: number, pngEnabled?: boolean }} [opts]
 */
export function buildCardReleasePayload(draft, opts) {
  opts = opts || {};
  var d = draft && typeof draft === 'object' ? draft : {};
  var json = buildCardJSONFromDraft(d);
  var characterVersion = normalizeCharacterVersion(
    (json.data && json.data.character_version) || d.characterVersion
  );
  if (json.data) json.data.character_version = characterVersion;
  var publishedAt = typeof opts.publishedAt === 'number' ? opts.publishedAt : Date.now();
  return {
    type: 'card-release',
    cardId: String(d.draftId || d.id || ''),
    title: String((json.data && json.data.name) || json.name || d.charName || '未命名'),
    characterVersion: characterVersion,
    publishedAt: publishedAt,
    pngEnabled: !!opts.pngEnabled,
    cardJson: json,
  };
}
