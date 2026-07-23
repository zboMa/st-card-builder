import {
  CORRUPTION_PRESETS,
  CORRUPTION_ARC_BRIEFS,
  DEFAULT_CORRUPTION_PRESET,
  normalizeCorruptionConfig,
  resolveStageNames,
  parseStageNamesFromAiText,
  pickCorruptionTargets,
  buildRulesWorldbookEntry,
  buildArchiveWorldbookEntry,
  buildCustomStagesSystemPrompt,
  buildCustomStagesUserPrompt,
  buildArchiveSystemPrompt,
  buildArchiveExpandSystemPrompt,
  buildArchiveUserPrompt,
  upsertWorldbookByComment,
  ensureCorruptionModuleInDesign,
  buildCorruptionExportIssues,
  findWorldbookPersonContext,
  evaluateArchiveRichness,
  CORRUPTION_MIN_CHARS_PER_STAGE,
} from '../../corruptionProgress.mjs';
import {
  isPersonWorldbookComment,
  personNameFromWorldbookComment,
} from '../../novel/sync.mjs';
import { buildPlaceholderPaths, normalizeDesign } from '../../statusBar.mjs';
import { buildAdultCanonDigest, formatCorruptionArchiveDigests } from '../../adult/canon.mjs';
import { CORRUPTION_EXPAND_WB } from '../../novel/contextBudgets.mjs';
import {
  listWorldviewPresetsByGroup,
  getWorldviewPreset,
  normalizeWorldviewPresetItems,
  primaryWorldviewPresetId,
  MAX_WORLDVIEW_PRESET_ITEMS,
} from '../../presets/worldviews/index.mjs';

/**
 * 成人配置：共享闭包 helpers（拆自 adultConfig）
 */
/** @param {object} ctx */
export function createAdultConfigShared(ctx) {
  var escapeHtml = ctx.escapeHtml;
  var corruptionTargetsCache = [];

  function ensureWorldviewPresetItemsOnState() {
    ctx.state.worldviewPresetItems = normalizeWorldviewPresetItems(ctx.state.worldviewPresetItems || []);
    return ctx.state.worldviewPresetItems;
  }

  function syncWorldframeFromPresets() {
    if (ctx.state.adultWorldframeForced) return;
    var items = ensureWorldviewPresetItemsOnState();
    var primaryId = primaryWorldviewPresetId(items);
    var p = getWorldviewPreset(primaryId);
    if (!p || !p.mapsToWorldframe) return;
    ctx.state.adultWorldframe = p.mapsToWorldframe;
  }

  function maxFlavorItems() {
    var data = window.__nsfwFlavorData__;
    return (data && data.maxItems) || 5;
  }

  function ensureNtlItemsOnState() {
    var data = window.__nsfwFlavorData__;
    var valid = (data && data.tabooIds) || [];
    var raw = Array.isArray(ctx.state.ntlTabooItems) ? ctx.state.ntlTabooItems : [];
    var legacy = Array.isArray(ctx.state.ntlTabooTypes) ? ctx.state.ntlTabooTypes : [];
    var items = [];
    var seen = Object.create(null);
    (raw.length ? raw : legacy.map(function(id) { return { id: id, note: '' }; })).forEach(function(it) {
      var id = typeof it === 'string' ? it : String((it && it.id) || '');
      if (!id || seen[id] || (valid.length && valid.indexOf(id) < 0)) return;
      seen[id] = true;
      items.push({
        id: id,
        note: typeof it === 'string' ? '' : String((it && it.note) || ''),
      });
    });
    ctx.state.ntlTabooItems = items;
    ctx.state.ntlTabooTypes = items.map(function(it) { return it.id; });
    return items;
  }

  function normalizeFlavorItems(raw, legacy) {
    var data = window.__nsfwFlavorData__;
    if (data && typeof data.normalizeItems === 'function') {
      return data.normalizeItems(raw, legacy);
    }
    var out = [];
    var seen = Object.create(null);
    (Array.isArray(raw) ? raw : []).forEach(function(it) {
      var id = it && it.id ? String(it.id) : '';
      if (!id || seen[id]) return;
      if (data && data.ids && data.ids.indexOf(id) < 0) return;
      seen[id] = true;
      out.push({ id: id, note: String((it && it.note) || '') });
    });
    if (!out.length && legacy && (!data || !data.ids || data.ids.indexOf(legacy) >= 0)) {
      out.push({ id: String(legacy), note: '' });
    }
    return out.slice(0, maxFlavorItems());
  }

  function normalizeExpressionItemsByKind(raw, kind) {
    var data = window.__nsfwFlavorData__;
    var validIds = kind === 'speech'
      ? ((data && data.speechIds) || [])
      : ((data && data.postureIds) || []);
    var base = (data && typeof data.normalizeExpressionItems === 'function')
      ? data.normalizeExpressionItems(raw)
      : (Array.isArray(raw) ? raw : []).map(function(it) {
          return {
            id: String((it && it.id) || '').trim(),
            note: String((it && it.note) || '').trim(),
          };
        }).filter(function(it) { return it.id; });
    if (!validIds.length) return base;
    return base.filter(function(it) {
      return validIds.indexOf(it.id) >= 0;
    });
  }

  function ensureFlavorItemsOnState() {
    var items = normalizeFlavorItems(ctx.state.nsfwFlavorItems, ctx.state.nsfwFlavor);
    ctx.state.nsfwFlavorItems = items;
    ctx.state.nsfwFlavor = items.length ? items[0].id : '';
    return items;
  }

  function ensurePostureItemsOnState() {
    ctx.state.eroticPostureItems = normalizeExpressionItemsByKind(ctx.state.eroticPostureItems, 'posture');
    return ctx.state.eroticPostureItems;
  }

  function ensureSpeechItemsOnState() {
    ctx.state.eroticSpeechItems = normalizeExpressionItemsByKind(ctx.state.eroticSpeechItems, 'speech');
    return ctx.state.eroticSpeechItems;
  }

  function buildNsfwFlavorHint() {
    var data = window.__nsfwFlavorData__;
    if (!ctx.state.nsfwEnabled || !data) return '';
    var items = ensureFlavorItemsOnState();
    if (!items.length) return '';
    if (typeof data.buildHintFromItems === 'function') {
      return data.buildHintFromItems(items, {
        intro: '（仅用于世界书人物/恶堕，勿写入主角设定）',
      });
    }
    return '';
  }

  function buildNtlHintForPrompt() {
    var data = window.__nsfwFlavorData__;
    if (!ctx.state.ntlEnabled || !data) return '';
    var items = ensureNtlItemsOnState();
    if (!items.length) return '';
    if (typeof data.buildNtlHintFromTypes === 'function') {
      return data.buildNtlHintFromTypes(items, {
        tabooTypes: data.tabooTypes,
        intro: '（仅用于世界书人物/恶堕，勿写入主角设定）',
      });
    }
    return '';
  }

  function buildPostureHintForPrompt() {
    var data = window.__nsfwFlavorData__;
    if (!ctx.state.nsfwEnabled || !data || typeof data.buildPostureHintFromItems !== 'function') return '';
    var items = ensurePostureItemsOnState();
    if (!items.length) return '';
    return data.buildPostureHintFromItems(items, {
      intro: '（仅用于世界书人物/恶堕，勿写入主角设定）',
    });
  }

  function buildSpeechHintForPrompt() {
    var data = window.__nsfwFlavorData__;
    if (!ctx.state.nsfwEnabled || !data || typeof data.buildSpeechHintFromItems !== 'function') return '';
    var items = ensureSpeechItemsOnState();
    if (!items.length) return '';
    return data.buildSpeechHintFromItems(items, {
      intro: '（仅用于世界书人物/恶堕，勿写入主角设定）',
    });
  }

  function inferWorldframeFromCard() {
    var data = window.__nsfwFlavorData__;
    if (!data || typeof data.inferWorldframe !== 'function') {
      return { id: 'generic', label: '通用/未识别', confidence: 0, source: 'unavailable' };
    }
    var novelBridge = window.__novelWorkshopBridge__;
    var novelEntities = (novelBridge && typeof novelBridge.listEntities === 'function')
      ? (novelBridge.listEntities({}) || [])
      : [];
    var novelState = (novelBridge && typeof novelBridge.getState === 'function')
      ? (novelBridge.getState() || {})
      : {};
    return data.inferWorldframe({
      forced: ctx.state.adultWorldframeForced || '',
      contextText: novelState.contextText || ctx.state.creatorNotes || '',
      entities: novelEntities,
      worldbookEntries: ctx.state.worldbookEntries || [],
    });
  }

  function withAppScrollPreserved(fn) {
    var scroller = document.querySelector('.app-container');
    var savedScroll = scroller ? scroller.scrollTop : 0;
    try {
      fn();
    } finally {
      if (scroller) {
        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            scroller.scrollTop = savedScroll;
          });
        });
      }
    }
  }

  function confirmAdultOp(messageOrOpts) {
    var opts = typeof messageOrOpts === 'string'
      ? { message: messageOrOpts }
      : Object.assign({}, messageOrOpts || {});
    if (!opts.message && typeof messageOrOpts === 'string') {
      opts.message = messageOrOpts;
    }
    return ctx.showConfirmDialog({
      icon: opts.icon || '⚠️',
      title: opts.title || '确认操作',
      message: opts.message || '确认执行此操作？',
      detail: opts.detail || '',
      okText: opts.okText || '确认',
      cancelText: opts.cancelText || '取消',
    }).then(function(result) { return !!result; });
  }

  function confirmAdultRemove(opts) {
    var o = typeof opts === 'string' ? { label: opts } : (opts || {});
    return confirmAdultOp({
      icon: '🗑️',
      title: o.title || ('移除' + (o.kind ? o.kind : '') + '？'),
      message: o.message || ('即将移除「' + (o.label || '') + '」。'),
      okText: '移除',
      cancelText: '取消',
    });
  }

  function labelFlavor(id) {
    var data = window.__nsfwFlavorData__;
    var p = data && data.presets && data.presets[id];
    return (p && p.label) || id;
  }

  function labelExpression(kind, id) {
    var data = window.__nsfwFlavorData__;
    var map = kind === 'speech'
      ? (data && data.speechPresets)
      : (data && data.posturePresets);
    var p = map && map[id];
    return (p && p.label) || id;
  }

  function labelNtl(id) {
    var data = window.__nsfwFlavorData__;
    var t = data && data.tabooTypes && data.tabooTypes[id];
    return (t && t.label) || id;
  }


  return {
    ensureWorldviewPresetItemsOnState: ensureWorldviewPresetItemsOnState,
    syncWorldframeFromPresets: syncWorldframeFromPresets,
    maxFlavorItems: maxFlavorItems,
    ensureNtlItemsOnState: ensureNtlItemsOnState,
    normalizeFlavorItems: normalizeFlavorItems,
    normalizeExpressionItemsByKind: normalizeExpressionItemsByKind,
    ensureFlavorItemsOnState: ensureFlavorItemsOnState,
    ensurePostureItemsOnState: ensurePostureItemsOnState,
    ensureSpeechItemsOnState: ensureSpeechItemsOnState,
    buildNsfwFlavorHint: buildNsfwFlavorHint,
    buildNtlHintForPrompt: buildNtlHintForPrompt,
    buildPostureHintForPrompt: buildPostureHintForPrompt,
    buildSpeechHintForPrompt: buildSpeechHintForPrompt,
    inferWorldframeFromCard: inferWorldframeFromCard,
    withAppScrollPreserved: withAppScrollPreserved,
    confirmAdultOp: confirmAdultOp,
    confirmAdultRemove: confirmAdultRemove,
    labelFlavor: labelFlavor,
    labelExpression: labelExpression,
    labelNtl: labelNtl,
    get corruptionTargetsCache() { return corruptionTargetsCache; },
    set corruptionTargetsCache(v) { corruptionTargetsCache = v; },
    escapeHtml: escapeHtml,
  };
}
