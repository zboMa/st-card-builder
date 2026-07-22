/**
 * 小说分析面板：分片配置、RAG、骨架、丰满、关系、图谱
 */
import { getPipelineGates, WB_FOCUS_OPTIONS } from '../state.mjs';
import { buildExtractShards, estimateExtractCalls, chaptersSourceFingerprint } from '../chapters.mjs';
import { emptyKnowledgeGraph } from '../graphMerge.mjs';
import { mountOrUpdateGraph, relayoutGraph } from '../graphViz.mjs';
import {
  countEntitiesByType,
  isEntityEnriched,
  ENTITY_TYPES,
  projectEntitiesToLegacy,
} from '../entityStore.mjs';
import {
  applySkeletonResult,
  applyEnrichResult,
  listEntitiesNeedingEnrich,
  buildSkeletonPriorBlock,
} from '../analyzePipeline.mjs';
import { buildNovelRagIndex } from '../rag/indexBuild.mjs';
import { hybridSearch } from '../rag/hybridSearch.mjs';
import { buildRagInjectBlock, pickRelatedEntities } from '../rag/inject.mjs';
import { getEmbeddingConfig, EMBEDDING_API_URL_KEY, EMBEDDING_API_KEY_KEY, EMBEDDING_MODEL_KEY } from '../rag/embeddingConfig.mjs';
import {
  getAdultMode,
  getNtlMode,
  boostAdultSearchQuery,
  extractStyleNsfwSection,
  buildModeHintBlocks,
  buildContentModeFlags,
  buildNsfwFlavorHint,
  buildNtlTabooHint,
  buildPaletteGuidanceBlock,
  getNsfwFlavorItems,
  evaluateFlavorRichness,
  buildFlavorExpandSystemPrompt,
  buildFlavorExpandUserPrompt,
  NSFW_FLAVOR_PRESETS,
  NTL_TABOO_TYPES,
  getNtlTabooTypes,
  evaluateNtlRichness,
  buildNtlExpandSystemPrompt,
  buildNtlExpandUserPrompt,
  buildAdultCanonDigest,
  ADULT_CANON_BUDGET,
  buildStatusBarNsfwDraftFromEntities,
  buildStatusBarNtlDraftFromEntities,
  buildStatusBarVesselDraftFromEntities,
  resolveWorldframe,
  evaluateVesselRichness,
  buildVesselExpandSystemPrompt,
  buildVesselExpandUserPrompt,
  buildVesselHintForState,
  listVesselEntities,
  personMentionsVessels,
} from '../nsfwSupport.mjs';
import { RAG_ENTITY_BUDGET } from '../contextBudgets.mjs';
import { escapeHtml, parseJsonLoose } from '../../utils.mjs';

function novelCanonBlock(state, focusName) {
  var wf = resolveWorldframe(state);
  return buildAdultCanonDigest({
    entities: state.entities,
    worldbookEntries: (state.wbEntries || []).map(function(e) {
      return {
        comment: e.comment || ('[小说' + (e.category || 'setting') + '] ' + e.name),
        content: e.content || '',
      };
    }),
    styleText: state.styleText,
    focusName: focusName || '',
    budget: ADULT_CANON_BUDGET,
    worldframeLabel: wf.label,
  });
}

function vesselOptsFromState(state) {
  var wf = resolveWorldframe(state);
  return {
    worldframe: wf.id,
    flavorItems: getAdultMode(state) ? getNsfwFlavorItems(state) : [],
    ntlItems: getNtlMode(state) ? getNtlTabooTypes(state).map(function(id) { return { id: id }; }) : [],
  };
}

var ENTITY_TYPE_ZH = {
  person: '人物',
  faction: '势力',
  location: '地点',
  item: '物品',
  event: '事件',
  lore: '设定',
  nsfw: 'NSFW',
};


export { novelCanonBlock, vesselOptsFromState, ENTITY_TYPE_ZH };
