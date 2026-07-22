/**
 * 小说工坊浏览器端：状态、UI 绑定、AI 调用、助手桥接
 */
import {
  createDefaultNovelState,
  getPipelineGates,
  getFullSourceText,
  summarizeNovelState,
} from './state.mjs';
import { createNovelStateMachine } from './stateMachine.mjs';
import {
  splitIntoChapters,
  chaptersSourceFingerprint,
  buildSetupCorpus,
} from './chapters.mjs';
import { buildRecallPayload, DEFAULT_EXPAND_BUDGET } from './recall.mjs';
import {
  normalizeCharacterProfile,
  emptyCharacterProfile,
  profileContentDigest,
} from './schema.mjs';
import {
  profileToCharacterFields,
  entityPersonToCharacterFields,
  styleToWorldbookDraft,
} from './sync.mjs';
import { buildRagInjectBlock, pickRelatedEntities } from './rag/inject.mjs';
import { hybridSearch } from './rag/hybridSearch.mjs';
import { extractQueryTerms } from './rag/keywordSearch.mjs';
import {
  upsertEntity,
  findEntityMatch,
  projectEntitiesToLegacy,
} from './entityStore.mjs';
import {
  getAdultMode,
  setAdultMode,
  getNtlMode,
  setNtlMode,
  boostAdultSearchQuery,
  extractStyleNsfwSection,
  buildModeHintBlocks,
  buildContentModeFlags,
  getNsfwFlavor,
  setNsfwFlavor,
  setNsfwFlavorItems,
  getNtlTabooTypes,
  setNtlTabooTypes,
  setNtlTabooItems,
  setAdultWorldframe,
  suggestAdultWorldframe,
} from './nsfwSupport.mjs';
import { applyTemplate } from '../promptStore.mjs';
import { normalizeCharacterPatch } from '../assistant/characterFields.mjs';
import { SETUP_ENTITY_SUMMARY } from './contextBudgets.mjs';

import { uid, escapeHtml, parseJsonLoose, normalizeNameList } from '../utils.mjs';
import { createNovelAppContext } from './shared/context.mjs';
import { registerStyle } from './panels/style.mjs';
import { registerCharacters } from './panels/characters.mjs';
import { registerSource } from './panels/source.mjs';
import { registerChapters } from './panels/chapters.mjs';
import { registerSetup } from './panels/setup.mjs';
import { registerAnalyze } from './panels/analyze.mjs';
import { registerWorldbook, formatPriorWbExtractRef, mergeWbExtractEntry } from './panels/worldbook.mjs';
import { createBridge, setCharacterFields as bridgeSetCharFields, syncOutputs as bridgeSyncOutputs } from './shared/bridge.mjs';
import { attachNovelBootSetup } from './bootSetupGreetings.mjs';
import { attachNovelBootEvents } from './bootEvents.mjs';
import { estimateExtractCalls, buildExtractShards } from './chapters.mjs';
import { listEntitiesNeedingEnrich } from './analyzePipeline.mjs';

// Re-export for backward compatibility (used by tests)
export { formatPriorWbExtractRef, mergeWbExtractEntry, normalizeNameList };

/** 已扫描人物摘要，供下一步分片注入（参考 + 可补 aliases/identity） */
export function formatPriorCharScanRef(chars) {
  if (!chars || !chars.length) return '';
  var lines = chars.map(function(c) {
    var alias = (c.aliases || []).length ? ' aliases=' + c.aliases.join('/') : '';
    return '- ' + c.name + alias + (c.note ? ' · ' + String(c.note).substring(0, 80) : '');
  }).join('\n');
  return '\n【已扫描人物（勿重复同名；可补 aliases/identity，可完善说明）】\n' + lines;
}

function promptText(id, fallback) {
  if (window.__promptStore__ && window.__promptStore__.get) {
    var t = window.__promptStore__.get(id);
    if (t) return t;
  }
  return fallback || '';
}

async function callAI(userContent, systemExtra, signal) {
  var apiUrlEl = document.getElementById('apiUrl');
  var apiKeyEl = document.getElementById('apiKey');
  var modelEl = document.getElementById('modelSelect');
  if (!apiUrlEl || !modelEl || !modelEl.value) throw new Error('未配置 AI 模型（请先到「AI 配置」）');
  var messages = [];
  if (systemExtra) messages.push({ role: 'system', content: systemExtra });
  messages.push({ role: 'user', content: userContent });
  var res = await fetch(String(apiUrlEl.value).replace(/\/$/, '') + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + (apiKeyEl ? apiKeyEl.value.trim() : ''),
    },
    body: JSON.stringify({ model: modelEl.value, messages: messages, temperature: 0.2 }),
    signal: signal,
  });
  if (!res.ok) throw new Error(res.status === 429 ? '429 限流' : 'HTTP ' + res.status);
  var data = await res.json();
  var text = data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : '';
  text = String(text || '').trim();
  if (!text) throw new Error('模型返回空内容（可能被安全过滤或上下文过长）');
  return text;
}

function runTracked(meta, fn) {
  var center = window.__aiTaskCenter__;
  if (center && typeof center.run === 'function') return center.run(meta, fn);
  return fn({ signal: undefined, id: null });
}

function isTrackedAbort(err) {
  if (window.__isAiAbortError__) return window.__isAiAbortError__(err);
  return !!(err && (err.name === 'AbortError' || /abort|取消|已停止/i.test(String(err.message || ''))));
}

async function mapPool(items, concurrency, worker, signal) {
  var list = items || [];
  var out = new Array(list.length);
  var i = 0;
  var n = Math.max(1, concurrency || 1);
  async function run() {
    while (i < list.length) {
      if (signal && signal.aborted) throw new DOMException('已取消', 'AbortError');
      var idx = i++;
      out[idx] = await worker(list[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, list.length) }, function() { return run(); }));
  return out;
}

export { mapPool };

export function initNovelWorkshop() {
  if (window.__novelWorkshopReady__) return;
  window.__novelWorkshopReady__ = true;

  var sm = createNovelStateMachine({ getCardId: currentCardId });
  var state = sm.state;
  var ctx = createNovelAppContext(sm);

  registerStyle(ctx);
  registerSource(ctx);
  registerChapters(ctx);
  registerCharacters(ctx);
  registerSetup(ctx);
  registerAnalyze(ctx);
  registerWorldbook(ctx);

  function $(id) { return document.getElementById(id); }

  // ===== 共享工具（注入 ctx） =====

  function isRagIndexStale() {
    if (!state.rag || state.rag.indexStatus !== 'ready') return true;
    if (!(state.rag.chunkCount > 0)) return true;
    var fp = chaptersSourceFingerprint(state.chapters);
    return fp !== String(state.rag.sourceFingerprint || '');
  }

  function getApiConfig() {
    var embedUrlEl = $('embeddingApiUrl');
    var embedKeyEl = $('embeddingApiKey');
    var embedEl = $('embeddingModel');
    var embeddingApiUrl = embedUrlEl ? String(embedUrlEl.value || '').trim() : '';
    var embeddingApiKey = embedKeyEl ? String(embedKeyEl.value || '').trim() : '';
    var embeddingModel = embedEl ? String(embedEl.value || '').trim() : '';
    try {
      var EMBEDDING_API_URL_KEY = 'st_v3_embedding_api_url';
      var EMBEDDING_API_KEY_KEY = 'st_v3_embedding_api_key';
      var EMBEDDING_MODEL_KEY = 'st_v3_embedding_model';
      if (!embeddingApiUrl) embeddingApiUrl = localStorage.getItem(EMBEDDING_API_URL_KEY) || '';
      if (!embeddingApiKey) embeddingApiKey = localStorage.getItem(EMBEDDING_API_KEY_KEY) || '';
      if (!embeddingModel) embeddingModel = localStorage.getItem(EMBEDDING_MODEL_KEY) || '';
    } catch (e) { /* ignore */ }
    var apiUrlEl = $('apiUrl');
    var apiKeyEl = $('apiKey');
    return {
      apiUrl: String(apiUrlEl.value || '').replace(/\/$/, ''),
      apiKey: apiKeyEl ? String(apiKeyEl.value || '').trim() : '',
      embeddingApiUrl: embeddingApiUrl,
      embeddingApiKey: embeddingApiKey,
      embedModel: embeddingModel,
    };
  }

  function syncShardModeUi(prefix, mode) {
    var byChars = mode !== 'chapters';
    var sizeWrap = $(prefix + 'ChunkSizeWrap');
    var chWrap = $(prefix + 'ChaptersPerShardWrap');
    if (sizeWrap) sizeWrap.hidden = !byChars;
    if (chWrap) chWrap.hidden = byChars;
  }

  function updateExtractCallEstimates() {
    var charN = estimateExtractCalls(state.chapters, { mode: state.charShardMode === 'chapters' ? 'chapters' : 'chars', chunkSize: state.charChunkSize || state.chunkSize || 8000, chaptersPerShard: state.charChaptersPerShard || 1 });
    var wbN = estimateExtractCalls(state.chapters, { mode: state.wbShardMode === 'chapters' ? 'chapters' : 'chars', chunkSize: state.wbChunkSize || state.chunkSize || 8000, chaptersPerShard: state.wbChaptersPerShard || 1 });
    var scanBtn = $('btnCharScan');
    if (scanBtn && !ctx.busyFlags.charScan) {
      scanBtn.textContent = '约 ' + charN + ' 次 · 扫描全书';
      if (scanBtn.dataset.idleLabel != null) scanBtn.dataset.idleLabel = scanBtn.textContent;
    }
    var extractBtn = $('btnWbExtract');
    if (extractBtn && !ctx.busyFlags.wbExtract) {
      extractBtn.textContent = '约 ' + wbN + ' 次 · AI 抽取';
      if (extractBtn.dataset.idleLabel != null) extractBtn.dataset.idleLabel = extractBtn.textContent;
    }
    var analyzeShards = estimateExtractCalls(state.chapters, { mode: state.analyzeShardMode === 'chapters' ? 'chapters' : 'chars', chunkSize: state.analyzeChunkSize || state.chunkSize || 8000, chaptersPerShard: state.analyzeChaptersPerShard || 1 });
    var enrichN = listEntitiesNeedingEnrich(state.entities, state.strictQuality, getAdultMode(state), getNtlMode(state)).length;
    var analyzeAllBtn = $('btnNovelAnalyzeAll');
    if (analyzeAllBtn && !ctx.busyFlags.analyzeAll && !ctx.busyFlags.analyzeSkeleton && !ctx.busyFlags.analyzeEnrich) {
      var analyzeAllN = analyzeShards + enrichN + 2;
      analyzeAllBtn.textContent = '约 ' + analyzeAllN + ' 次 · 开始完整分析';
      if (analyzeAllBtn.dataset.idleLabel != null) analyzeAllBtn.dataset.idleLabel = analyzeAllBtn.textContent;
    }
  }

  function gates() {
    return getPipelineGates(state);
  }

  function setStatus(id, msg) {
    var el = $(id);
    if (el) el.textContent = msg || '';
  }

  function isAiConfigured() {
    var modelEl = $('modelSelect');
    return !!(modelEl && modelEl.value);
  }

  function renderGates() {
    var g = gates();
    ['novelChapterGate', 'novelSetupGate', 'novelGreetGate', 'novelCharGate', 'novelWbGate', 'novelStyleGate', 'novelAnalyzeGate'].forEach(function(id) {
      var el = $(id);
      if (!el) return;
      if (id === 'novelChapterGate') {
        if (!g.hasSource) {
          el.style.display = 'block';
          el.textContent = g.reasons[0] || '请先导入原始资料';
        } else el.style.display = 'none';
        return;
      }
      if (!g.canExtract) {
        el.style.display = 'block';
        el.textContent = g.reasons.join('；') || '请先完成原始资料与拆章';
      } else el.style.display = 'none';
    });
    var extractDisabled = !g.canExtract;
    var analyzeBusy = ctx.busyFlags.ragIndex || ctx.busyFlags.analyzeSkeleton || ctx.busyFlags.analyzeEnrich
      || ctx.busyFlags.analyzeRelations || ctx.busyFlags.analyzeAll;
    var scanBtn = $('btnCharScan');
    if (scanBtn) scanBtn.disabled = extractDisabled || ctx.busyFlags.charScan;
    var extractBtn = $('btnWbExtract');
    if (extractBtn) extractBtn.disabled = extractDisabled || ctx.busyFlags.wbExtract;
    var styleBtn = $('btnStyleDistill');
    if (styleBtn) styleBtn.disabled = extractDisabled || ctx.busyFlags.styleDistill;
    var setupBtn = $('btnNovelGenCharSetup');
    if (setupBtn) setupBtn.disabled = extractDisabled || ctx.busyFlags.charSetup;
    var greetBtn = $('btnNovelGenGreetings');
    if (greetBtn) greetBtn.disabled = extractDisabled || ctx.busyFlags.greetings;
    var splitBtn = $('btnNovelSplitChapters');
    if (splitBtn) splitBtn.disabled = !g.hasSource;
    var ragBtn = $('btnNovelRagIndex');
    if (ragBtn) ragBtn.disabled = extractDisabled || analyzeBusy;
    var analyzeAllBtn = $('btnNovelAnalyzeAll');
    if (analyzeAllBtn) analyzeAllBtn.disabled = extractDisabled || analyzeBusy;
    var skBtn = $('btnNovelAnalyzeSkeleton');
    if (skBtn) skBtn.disabled = extractDisabled || analyzeBusy;
    var enBtn = $('btnNovelAnalyzeEnrich');
    if (enBtn) enBtn.disabled = extractDisabled || analyzeBusy;
    var enrichSelBtn = $('btnKnowledgeEnrichSelected');
    if (enrichSelBtn) enrichSelBtn.disabled = extractDisabled || analyzeBusy;
    var graphRelayoutBtn = $('btnGraphRelayout');
    if (graphRelayoutBtn) graphRelayoutBtn.disabled = analyzeBusy;
    var graphClearBtn = $('btnGraphClear');
    if (graphClearBtn) graphClearBtn.disabled = analyzeBusy;
    var tip = isAiConfigured() ? '' : '未配置 AI，请先到「AI 配置」选择模型';
    var setAiTip = function(id, msg) { var el = $(id); if (el) el.textContent = msg || ''; };
    setAiTip('novelSetupAiTip', tip);
    setAiTip('novelGreetAiTip', tip);
  }

  function currentCardId() {
    if (typeof window.__getCurrentDraftId__ === 'function') {
      return String(window.__getCurrentDraftId__() || '').trim();
    }
    return sm.getBoundCardId();
  }

  // ===== 注入 ctx =====

  ctx.gates = gates;
  ctx.renderGatesFn = renderGates;
  ctx.setStatus = setStatus;
  ctx.updateExtractCallEstimates = updateExtractCallEstimates;
  ctx.syncShardModeUi = syncShardModeUi;
  ctx.syncOutputs = function(opts) { return bridgeSyncOutputs(ctx, opts); };
  ctx._getApiConfig = getApiConfig;
  ctx._isRagIndexStale = isRagIndexStale;
  ctx._chaptersSourceFingerprint = chaptersSourceFingerprint;
  ctx._summarizeState = summarizeNovelState;

  // ===== 委托函数 =====

  function renderAnalyze() { if (ctx.panels.analyze) ctx.panels.analyze.render(); }
  function flushAnalyzePreview() { if (ctx.panels.analyze) ctx.panels.analyze.flushAnalyzePreview(); }
  function renderGraph() { if (ctx.panels.analyze) ctx.panels.analyze.renderGraph(); }
  function bindAnalyze() { if (ctx.panels.analyze) ctx.panels.analyze.bind(); }
  function bindGraphControls() { if (ctx.panels.analyze) ctx.panels.analyze.bindGraphControls(); }

  function renderWbFocus() { if (ctx.panels.worldbook) ctx.panels.worldbook.renderWbFocus(); }
  function renderStrategyTag(strategy) { return ctx.panels.worldbook ? ctx.panels.worldbook.renderStrategyTag(strategy) : ''; }
  function renderWbEditorFields(index, entry, isNew) { return ctx.panels.worldbook ? ctx.panels.worldbook.renderWbEditorFields(index, entry, isNew) : ''; }
  function readWbInlineEditor(root) { return ctx.panels.worldbook ? ctx.panels.worldbook.readWbInlineEditor(root) : null; }
  function openWbEditModal(index, entry, isNew) { if (ctx.panels.worldbook) ctx.panels.worldbook.openWbEditModal(index, entry, isNew); }
  function editWbEntry(index) { if (ctx.panels.worldbook) ctx.panels.worldbook.editWbEntry(index); }
  function saveWbInline(index) { if (ctx.panels.worldbook) ctx.panels.worldbook.saveWbInline(index); }
  function renderWb() { if (ctx.panels.worldbook) ctx.panels.worldbook.render(); }
  function bindWorldbook() { if (ctx.panels.worldbook) ctx.panels.worldbook.bind(); }
  function expandWbEntry(indexOrOpts, opts) { return ctx.panels.worldbook ? ctx.panels.worldbook.expandWbEntry(indexOrOpts, opts) : Promise.reject(new Error('未挂载')); }
  function runExtractWorldbook() { return ctx.panels.worldbook ? ctx.panels.worldbook.runExtractWorldbook() : Promise.reject(new Error('未挂载')); }

  function renderSource() { if (ctx.panels.source) ctx.panels.source.render(); }
  function renderChapters() { if (ctx.panels.chapters) ctx.panels.chapters.render(); }
  function renderCharacters() { if (ctx.panels.characters) ctx.panels.characters.render(); }
  function renderStyle() { if (ctx.panels.style) ctx.panels.style.render(); }
  function bindChapters() { if (ctx.panels.chapters) ctx.panels.chapters.bind(); }
  function bindSource() { if (ctx.panels.source) ctx.panels.source.bind(); }
  function patchChapters(opts) { return ctx.panels.chapters ? ctx.panels.chapters.patch(opts) : null; }
  async function runScanCharacters() { return ctx.panels.characters ? ctx.panels.characters.runScan() : Promise.reject(new Error('未挂载')); }
  async function runDistillStyle() { return ctx.panels.style ? ctx.panels.style.runDistill() : Promise.reject(new Error('未挂载')); }

  var setupBoot = attachNovelBootSetup(ctx, {
    state: state, sm: sm, $: $, gates: gates, setStatus: setStatus,
    isAiConfigured: isAiConfigured, getApiConfig: getApiConfig,
    renderGates: renderGates, promptText: promptText, callAI: callAI,
    runTracked: runTracked, isTrackedAbort: isTrackedAbort,
    bridgeSetCharFields: bridgeSetCharFields,
  });
  var fillPersonEntityPick = setupBoot.fillPersonEntityPick;
  var renderCharacterSetup = setupBoot.renderCharacterSetup;
  var renderGreetingsGen = setupBoot.renderGreetingsGen;
  var runGenerateCharSetup = setupBoot.runGenerateCharSetup;
  var runGenerateGreetings = setupBoot.runGenerateGreetings;
  ctx._runGenerateCharSetup = runGenerateCharSetup;
  ctx._runGenerateGreetings = runGenerateGreetings;

  // ===== 全局 renderAll（供事件/init 使用） =====

  function renderAll() {
    renderGates();
    renderSource();
    renderChapters();
    renderCharacterSetup();
    renderGreetingsGen();
    renderAnalyze();
    renderCharacters();
    renderWb();
    renderGraph();
    renderStyle();
    updateExtractCallEstimates();
  }

  attachNovelBootEvents({
    bindCharacterSetup: setupBoot.bindCharacterSetup,
    bindGreetingsGen: setupBoot.bindGreetingsGen,
  });

  // ===== 助手桥接 =====

  window.__novelWorkshopBridge__ = createBridge(ctx);

  // ===== 初始化 =====

  ctx.bindNovelModals();
  if (ctx.panels.source) ctx.panels.source.bind();
  if (ctx.panels.chapters) ctx.panels.chapters.bind();
  setupBoot.bindCharacterSetup();
  setupBoot.bindGreetingsGen();
  if (ctx.panels.characters) ctx.panels.characters.bind();
  bindWorldbook();
  bindAnalyze();
  bindGraphControls();
  if (ctx.panels.style) ctx.panels.style.bind();

  window.addEventListener('card-draft-changed', function(ev) {
    var id = ev && ev.detail && ev.detail.cardId;
    if (!id && typeof window.__getCurrentDraftId__ === 'function') {
      id = window.__getCurrentDraftId__();
    }
    ctx.bindCard(id, { render: true });
  });

  window.addEventListener('nsfw-config-changed', function(ev) {
    var cfg = ev && ev.detail;
    if (cfg) {
      if (typeof cfg.enabled === 'boolean') setAdultMode(state, cfg.enabled);
      if (Array.isArray(cfg.flavorItems)) {
        setNsfwFlavorItems(state, cfg.flavorItems);
      } else if (typeof cfg.flavor === 'string') {
        setNsfwFlavor(state, cfg.flavor);
      }
      if (typeof cfg.ntlEnabled === 'boolean') setNtlMode(state, cfg.ntlEnabled);
      if (Array.isArray(cfg.ntlTabooItems)) {
        setNtlTabooItems(state, cfg.ntlTabooItems);
      } else if (Array.isArray(cfg.ntlTabooTypes)) {
        setNtlTabooTypes(state, cfg.ntlTabooTypes);
      }
      if (typeof cfg.adultWorldframeForced === 'string' && cfg.adultWorldframeForced) {
        setAdultWorldframe(state, cfg.adultWorldframeForced);
      } else if (typeof cfg.adultWorldframe === 'string' && cfg.adultWorldframe) {
        suggestAdultWorldframe(state, cfg.adultWorldframe);
      }
      ctx.save();
      renderGates();
    }
  });

  ctx.bindCard(currentCardId(), { force: true, render: false }).then(function() {
    renderAll();
  }).catch(function(err) {
    console.warn('[novel] init bind failed', err);
    renderAll();
  });

  function flushNovelSaves() {
    try {
      if (sm && typeof sm.save === 'function') sm.save();
    } catch (e) { /* ignore */ }
  }
  window.addEventListener('pagehide', flushNovelSaves);
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') flushNovelSaves();
  });
}
