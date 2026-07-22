/**
 * 小说工坊助手桥接 + 产出同步
 */
import { createDefaultNovelState } from '../state.mjs';
import { splitIntoChapters } from '../chapters.mjs';
import { normalizeCharacterPatch } from '../../assistant/characterFields.mjs';
import { deepCopy } from '../../utils.mjs';
import {
  profileToCharacterFields,
  applyDraftsToWorldbook,
  profileToWorldbookDraft,
  entityPersonToCharacterFields,
  entityPersonToWorldbookDraft,
  styleToWorldbookDraft,
  syncEntitiesToWorldbook,
} from '../sync.mjs';
import { findEntityMatch, upsertEntity, projectEntitiesToLegacy, isEntityEnriched } from '../entityStore.mjs';
import {
  getAdultMode,
  setAdultMode,
  getNtlMode,
  setNtlMode,
  getNsfwFlavor,
  setNsfwFlavor,
  getNsfwFlavorItems,
  setNsfwFlavorItems,
  getNtlTabooTypes,
  setNtlTabooTypes,
  getNtlTabooItems,
  setNtlTabooItems,
  buildStatusBarNsfwDraftFromEntities,
  buildStatusBarNtlDraftFromEntities,
  setAdultWorldframe,
  suggestAdultWorldframe,
  resolveWorldframe,
  NSFW_FLAVOR_PRESETS,
  NTL_TABOO_TYPES,
  MAX_NSFW_FLAVOR_ITEMS,
} from '../nsfwSupport.mjs';

export function setCharacterFields(fields, $) {
  if (!fields) return;
  var norm = normalizeCharacterPatch(fields);
  fields = norm.fields;
  if (!Object.keys(fields).length) return;
  if (fields.charName != null && $('charName')) {
    $('charName').value = fields.charName;
    $('charName').dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (fields.wbName != null && $('wbName')) {
    $('wbName').value = fields.wbName;
    $('wbName').dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (fields.charDesc != null && $('charDesc')) {
    $('charDesc').value = fields.charDesc;
    $('charDesc').dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (fields.creatorNotes != null && $('creatorNotes')) {
    $('creatorNotes').value = fields.creatorNotes;
    $('creatorNotes').dispatchEvent(new Event('input', { bubbles: true }));
  }
  window.dispatchEvent(new Event('card-builder-data-changed'));
}

export function setGreetingFields(firstMes, altGreetings, $) {
  if (firstMes != null && $('firstMes')) {
    $('firstMes').value = String(firstMes);
    $('firstMes').dispatchEvent(new Event('input', { bubbles: true }));
  }
  window.__altGreetings__ = Array.isArray(altGreetings) ? altGreetings.slice() : [];
  if (typeof window.__renderAltGreetings__ === 'function') window.__renderAltGreetings__();
  window.dispatchEvent(new Event('card-builder-data-changed'));
}

export function applyRagOptionsFromUi(ctx, opts) {
  opts = opts || {};
  var state = ctx.state;
  if (!state.rag) state.rag = {};
  if (opts.enabled != null) state.rag.enabled = !!opts.enabled;
  if (opts.budget != null) state.rag.budget = Math.max(2000, Math.floor(Number(opts.budget) || 12000));
  ctx.save();
}

export function syncRagOptionsToAiPanel(ctx) {
  var state = ctx.state;
  var $ = ctx.$;
  if (!state.rag) return;
  try {
    var enableEl = $('assistantNovelRagEnable');
    var budgetEl = $('assistantNovelRagBudget');
    if (enableEl) enableEl.checked = state.rag.enabled !== false;
    if (budgetEl) budgetEl.value = String(state.rag.budget || 12000);
    localStorage.setItem('st_v3_builder_novel_rag', JSON.stringify({
      enabled: state.rag.enabled !== false,
      budget: state.rag.budget || 12000,
    }));
  } catch (e) { /* ignore */ }
}

export { syncOutputs } from './bridgeSyncOutputs.mjs';
