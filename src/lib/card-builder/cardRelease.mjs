/**
 * 角色卡发布快照（仅 character_version；不含 WIP）
 */
import { buildCardJSONFromDraft } from './state.mjs';

export function normalizeCharacterVersion(raw) {
  var s = String(raw == null ? '' : raw).trim();
  return s || '1.0';
}

/**
 * 解析 major.minor（仅取前两段数字；其余忽略）。无法解析时回退 1.0。
 * @returns {{ major: number, minor: number, display: string }}
 */
export function parseCharacterVersion(raw) {
  var s = normalizeCharacterVersion(raw);
  var m = String(s).match(/^(\d+)(?:\.(\d+))?/);
  var major = m ? parseInt(m[1], 10) : 1;
  var minor = m && m[2] != null ? parseInt(m[2], 10) : 0;
  if (!Number.isFinite(major) || major < 0) major = 1;
  if (!Number.isFinite(minor) || minor < 0) minor = 0;
  return { major: major, minor: minor, display: major + '.' + minor };
}

/** 大版本 +1，小版本归零 → (major+1).0 */
export function bumpCharacterVersionMajor(raw) {
  var p = parseCharacterVersion(raw);
  return (p.major + 1) + '.0';
}

/** 小版本 +1 → major.(minor+1) */
export function bumpCharacterVersionMinor(raw) {
  var p = parseCharacterVersion(raw);
  return p.major + '.' + (p.minor + 1);
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
