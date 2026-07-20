/**
 * 制卡主侧状态工厂 — 纯 JS 层，不含 DOM/持久化
 */
import { normalizeCharTags } from '../charTags.mjs';

export const DRAFTS_KEY = 'st_v3_builder_drafts';
export const CURRENT_KEY = 'st_v3_builder_current_id';
export const AI_KEY = 'st_v3_builder_ai_config';

export function createDefaultCardState() {
  return {
    draftId: '',
    charName: '',
    wbName: '',
    charDesc: '',
    firstMes: '',
    creatorNotes: '',
    charTags: [],
    worldbookEntries: [],
    regexScripts: [],
    tavernHelperScripts: [],
    cardBuilderExtensions: {},
    avatarBase64: '',
    avatarInIdb: false,
    altGreetings: [],
    nsfwEnabled: false,
    nsfwFlavor: '',
    nsfwFlavorItems: [],
    eroticPostureItems: [],
    eroticSpeechItems: [],
    ntlEnabled: false,
    ntlTabooTypes: [],
    ntlTabooItems: [],
    worldviewPresetItems: [],
    adultWorldframe: '',
    adultWorldframeForced: '',
    corruptionEnabled: false,
    corruptionPreset: '5',
    corruptionCustomBrief: '',
    corruptionExtraNotes: '',
    corruptionStageNames: [],
    corruptionSelectedNames: [],
    corruptionDefaultFemaleOnly: true,
    corruptionSyncStatusBar: true,
  };
}

export function genId() {
  return 'draft_' + Date.now();
}

export function draftDisplayName(d) {
  var n = (d && (d.charName || d.name)) || '';
  return n.trim() || '未命名';
}

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
    updatedAt: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
  };
}

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

export function tagsFromImportJson(json) {
  if (!json || typeof json !== 'object') return [];
  if (json.data && Array.isArray(json.data.tags)) return normalizeTags(json.data.tags);
  if (Array.isArray(json.tags)) return normalizeTags(json.tags);
  return [];
}

export function getDefaultWBEntry() {
  return {
    comment: '',
    content: '',
    keys: [],
    strategy: 'selective',
    position: 4,
    depth: 4,
    role: 0,
    order: 100,
    prob: 100,
  };
}

export function clampInt(value, fallback, min, max) {
  var v = parseInt(value, 10);
  if (isNaN(v)) return fallback;
  if (min !== undefined && v < min) return min;
  if (max !== undefined && v > max) return max;
  return v;
}

export function normalizeWBEntry(entry) {
  var base = getDefaultWBEntry();
  entry = entry || {};
  return {
    comment: String(entry.comment || ''),
    content: String(entry.content || ''),
    keys: Array.isArray(entry.keys) ? entry.keys.filter(function(k) { return String(k || '').trim(); }) : [],
    strategy: ['constant', 'selective', 'vectorized'].indexOf(entry.strategy) >= 0 ? entry.strategy : base.strategy,
    position: clampInt(entry.position, base.position, 0, 6),
    depth: clampInt(entry.depth, base.depth, 0, 999),
    role: clampInt(entry.role, base.role, 0, 2),
    order: clampInt(entry.order, base.order, 0, 999),
    prob: clampInt(entry.prob, base.prob, 1, 100),
  };
}

export function buildCardJSONFromDraft(d) {
  d = d || {};
  var entries = Array.isArray(d.worldbookEntries) ? d.worldbookEntries : [];
  var fe = entries.map(function(e, i) {
    return {
      id: i,
      keys: e.keys || [],
      secondary_keys: [],
      comment: e.comment,
      content: e.content,
      constant: e.strategy === 'constant',
      selective: e.strategy === 'selective' || e.strategy === 'vectorized',
      insertion_order: e.order || 100,
      enabled: e.enabled !== false,
      position: 'before_char',
      use_regex: false,
      extensions: {
        position: e.position,
        exclude_recursion: false,
        display_index: i,
        probability: e.prob || 100,
        useProbability: true,
        depth: e.depth || 4,
        selectiveLogic: 0,
        outlet_name: '',
        group: '',
        group_override: false,
        group_weight: 100,
        prevent_recursion: false,
        delay_until_recursion: false,
        role: e.role || 0,
        vectorized: e.strategy === 'vectorized',
      },
    };
  });
  var cn = String(d.charName || '').trim() || '无名角色';
  var wn = String(d.wbName || '').trim() || '无名世界书';
  var ext = Object.assign({}, d.cardBuilderExtensions || {});
  ext.world = wn;
  if (d.regexScripts && d.regexScripts.length > 0) ext.regex_scripts = d.regexScripts;
  else delete ext.regex_scripts;
  if (d.tavernHelperScripts && d.tavernHelperScripts.length > 0) {
    var prevTh = (ext.tavern_helper && typeof ext.tavern_helper === 'object') ? ext.tavern_helper : {};
    var thVars = (prevTh.variables && typeof prevTh.variables === 'object') ? prevTh.variables : {};
    ext.tavern_helper = Object.assign({}, prevTh, {
      scripts: d.tavernHelperScripts,
      variables: thVars,
    });
  } else if (ext.tavern_helper && ext.tavern_helper.variables
      && typeof ext.tavern_helper.variables === 'object'
      && Object.keys(ext.tavern_helper.variables).length) {
    ext.tavern_helper = Object.assign({}, ext.tavern_helper, { scripts: [] });
  } else {
    delete ext.tavern_helper;
  }
  var altG = (d.altGreetings || []).filter(function(g) { return g && String(g).trim(); });
  var tags = normalizeTags(d.charTags || d.tags || []);
  return {
    name: cn,
    description: d.charDesc || '',
    personality: '',
    scenario: '',
    first_mes: d.firstMes || '',
    mes_example: '',
    creatorcomment: d.creatorNotes || '',
    avatar: 'none',
    talkativeness: '0.5',
    fav: false,
    tags: tags,
    spec: 'chara_card_v3',
    spec_version: '3.0',
    data: {
      name: cn,
      description: d.charDesc || '',
      personality: '',
      scenario: '',
      first_mes: d.firstMes || '',
      mes_example: '',
      creator_notes: d.creatorNotes || '',
      system_prompt: '',
      post_history_instructions: '',
      tags: tags.slice(),
      creator: '',
      character_version: '1.0',
      alternate_greetings: altG,
      extensions: ext,
      character_book: { name: wn, entries: fe },
    },
  };
}

export function generateCardJSON(state) {
  return buildCardJSONFromDraft({
    charName: state.charName,
    wbName: state.wbName,
    charDesc: state.charDesc,
    firstMes: state.firstMes,
    creatorNotes: state.creatorNotes,
    charTags: state.charTags,
    worldbookEntries: state.worldbookEntries,
    regexScripts: state.regexScripts,
    tavernHelperScripts: state.tavernHelperScripts,
    cardBuilderExtensions: state.cardBuilderExtensions,
    altGreetings: state.altGreetings || [],
  });
}
