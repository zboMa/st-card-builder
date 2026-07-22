/**
 * 世界书面板：渲染、绑定、AI 抽取/扩展、搜索/筛选、新建/编辑/同步
 */
import { WB_FOCUS_OPTIONS } from '../state.mjs';
import { buildExtractShards, estimateExtractCalls } from '../chapters.mjs';
import { strategyLabelZh } from '../../utils.mjs';
import { buildRecallPayload, DEFAULT_EXPAND_BUDGET } from '../recall.mjs';
import {
  getAdultMode,
  getNtlMode,
  ADULT_RAG_BOOST_TERMS,
  NTL_RAG_BOOST_TERMS,
  mergeAdultAttrs,
  buildModeHintBlocks,
  buildContentModeFlags,
  buildNsfwFlavorHint,
  getNsfwFlavorItems,
  evaluateFlavorRichness,
  buildFlavorExpandSystemPrompt,
  buildFlavorExpandUserPrompt,
  NSFW_FLAVOR_PRESETS,
  NTL_TABOO_TYPES,
  getNtlTabooTypes,
  buildNtlTabooHint,
  evaluateNtlRichness,
  buildNtlExpandSystemPrompt,
  buildNtlExpandUserPrompt,
  buildAdultCanonDigest,
  ADULT_CANON_BUDGET,
  resolveWorldframe,
  evaluateVesselRichness,
  buildVesselExpandSystemPrompt,
  buildVesselExpandUserPrompt,
  buildVesselHintForState,
} from '../nsfwSupport.mjs';
import { PRIOR_WB_EXTRACT_PER, RAG_ENTITY_BUDGET, ENTITY_SUMMARY_STORE } from '../contextBudgets.mjs';
import { findEntityMatch, upsertEntity, projectEntitiesToLegacy, isEntityEnriched, ingestLegacyIntoEntities } from '../entityStore.mjs';
import { applyDraftsToWorldbook } from '../sync.mjs';
import { escapeHtml, truncatePreviewLine, parseJsonLoose, normalizeNameList } from '../../utils.mjs';

export { normalizeNameList };

var ENTITY_TYPE_ZH = {
  person: '人物',
  faction: '势力',
  location: '地点',
  item: '物品',
  event: '事件',
  lore: '设定',
  nsfw: 'NSFW',
};

function wbCategoryToEntityType(cat) {
  var c = String(cat || 'setting');
  if (c === 'faction' || c === 'location' || c === 'item' || c === 'event' || c === 'nsfw') return c;
  return 'lore';
}

/** 已抽取世界书条目摘要，供下一步分片注入参考 */
export function formatPriorWbExtractRef(entries) {
  if (!entries || !entries.length) return '';
  var lines = entries.map(function(e) {
    return '- [' + (e.category || 'setting') + '] ' + e.name + ': '
      + String(e.content || '').substring(0, PRIOR_WB_EXTRACT_PER);
  }).join('\n');
  return '\n【已抽取条目（勿重复同名；可补充完善 content/keys）】\n' + lines;
}

/** 合并单条抽取：同名保留更长 content，合并 keys */
export function mergeWbExtractEntry(all, entry) {
  if (!entry || !entry.name) return;
  var cat = String(entry.category || 'setting');
  if (cat === 'character' || cat === 'relation') return;
  var name = String(entry.name).trim();
  if (!name) return;
  var keys = normalizeNameList(name, entry.keys);
  if (!keys.length) keys = [name];
  var key = cat + '::' + name;
  var found = null;
  for (var i = 0; i < all.length; i++) {
    var e = all[i];
    if ((e.category || 'setting') + '::' + e.name === key) { found = e; break; }
  }
  if (!found) {
    all.push({
      category: cat,
      name: name,
      content: entry.content || '',
      keys: keys,
      layer: entry.layer,
      attrs: entry.attrs && typeof entry.attrs === 'object' ? Object.assign({}, entry.attrs) : undefined,
    });
    return;
  }
  if (String(entry.content || '').length > String(found.content || '').length) {
    found.content = entry.content;
  }
  found.keys = Array.from(new Set((found.keys || []).concat(keys)));
  if (entry.layer) found.layer = entry.layer;
  if (entry.attrs && typeof entry.attrs === 'object') {
    found.attrs = Object.assign({}, found.attrs || {}, entry.attrs);
    if (entry.attrs.adult || (found.attrs && found.attrs.adult)) {
      found.attrs.adult = mergeAdultAttrs(found.attrs.adult, entry.attrs.adult);
    }
  }
}

/** 草稿列表条目形态（抽取过程中逐步预览用） */
function toWbDraftEntry(e, prev) {
  var cat = e.category || 'setting';
  var name = e.name;
  var keys = normalizeNameList(name, e.keys);
  if (!keys.length) keys = [name];
  return {
    category: cat,
    name: name,
    content: e.content || '',
    keys: keys,
    layer: e.layer || (cat === 'setting' || cat === 'worldview' ? 'blue' : 'green'),
    comment: '[小说' + cat + '] ' + name,
    selected: prev && prev.selected != null ? prev.selected : true,
    syncStatus: (prev && prev.syncStatus) || 'unsynced',
    strategy: (e.layer === 'blue' || cat === 'setting' || cat === 'worldview') ? 'constant' : 'selective',
    attrs: e.attrs || (prev && prev.attrs) || undefined,
  };
}

