/**
 * 草稿快照归一化（与 src/lib/card-builder/state.mjs buildDraftSnapshot 保持一致）
 * 服务端部署仅含 server/，不可 import 仓库根 src/
 */

export function normalizeTags(input) {
  var list = Array.isArray(input) ? input : [];
  var seen = Object.create(null);
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var t = String(list[i] == null ? '' : list[i]).trim();
    if (!t || seen[t]) continue;
    seen[t] = true;
    out.push(t);
  }
  return out;
}

/** @param {object|null|undefined} state */
export function buildDraftSnapshot(state) {
  var s = state || {};
  return {
    charName: (s.charName || '').trim(),
    wbName: (s.wbName || '').trim(),
    charDesc: (s.charDesc || '').trim(),
    firstMes: (s.firstMes || '').trim(),
    creatorNotes: (s.creatorNotes || '').trim(),
    charTags: normalizeTags(s.charTags),
    worldbookEntries: s.worldbookEntries || [],
    regexScripts: s.regexScripts || [],
    tavernHelperScripts: s.tavernHelperScripts || [],
    cardBuilderExtensions: Object.assign({}, s.cardBuilderExtensions || {}),
    avatarInIdb: !!s.avatarInIdb,
    avatarBase64: s.avatarInIdb ? '' : (s.avatarBase64 || ''),
    altGreetings: s.altGreetings || [],
    nsfwEnabled: !!s.nsfwEnabled,
    nsfwFlavor: s.nsfwFlavor || '',
    nsfwFlavorItems: Array.isArray(s.nsfwFlavorItems)
      ? s.nsfwFlavorItems.map(function(it) {
          return { id: String((it && it.id) || ''), note: String((it && it.note) || '') };
        }).filter(function(it) { return it.id; })
      : (s.nsfwFlavor ? [{ id: s.nsfwFlavor, note: '' }] : []),
    eroticPostureItems: Array.isArray(s.eroticPostureItems)
      ? s.eroticPostureItems.map(function(it) {
          return { id: String((it && it.id) || ''), note: String((it && it.note) || '') };
        }).filter(function(it) { return it.id; })
      : [],
    eroticSpeechItems: Array.isArray(s.eroticSpeechItems)
      ? s.eroticSpeechItems.map(function(it) {
          return { id: String((it && it.id) || ''), note: String((it && it.note) || '') };
        }).filter(function(it) { return it.id; })
      : [],
    ntlEnabled: !!s.ntlEnabled,
    ntlTabooTypes: (s.ntlTabooTypes || []).slice(),
    ntlTabooItems: Array.isArray(s.ntlTabooItems)
      ? s.ntlTabooItems.map(function(it) {
          return { id: String((it && it.id) || ''), note: String((it && it.note) || '') };
        }).filter(function(it) { return it.id; })
      : (s.ntlTabooTypes || []).map(function(id) { return { id: String(id), note: '' }; }),
    worldviewPresetItems: Array.isArray(s.worldviewPresetItems)
      ? s.worldviewPresetItems.map(function(it) {
          return { id: String((it && it.id) || ''), note: String((it && it.note) || '') };
        }).filter(function(it) { return it.id; })
      : [],
    adultWorldframe: s.adultWorldframe || '',
    adultWorldframeForced: s.adultWorldframeForced || '',
    corruptionEnabled: !!s.corruptionEnabled,
    corruptionPreset: s.corruptionPreset || '5',
    corruptionCustomBrief: s.corruptionCustomBrief || '',
    corruptionExtraNotes: s.corruptionExtraNotes || '',
    corruptionStageNames: Array.isArray(s.corruptionStageNames) ? s.corruptionStageNames.slice() : [],
    corruptionSelectedNames: Array.isArray(s.corruptionSelectedNames) ? s.corruptionSelectedNames.slice() : [],
    corruptionDefaultFemaleOnly: s.corruptionDefaultFemaleOnly !== false,
    corruptionSyncStatusBar: s.corruptionSyncStatusBar !== false,
    characterVersion: String(s.characterVersion != null ? s.characterVersion : '1.0').trim() || '1.0',
    versions: Array.isArray(s.versions) ? s.versions : [],
    updatedAt: s.updatedAt || '',
  };
}
