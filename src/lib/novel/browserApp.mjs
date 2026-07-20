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
  ctx._runGenerateCharSetup = runGenerateCharSetup;
  ctx._runGenerateGreetings = runGenerateGreetings;

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

  // ===== 角色设定 / 开场白（留在 browserApp — 涉及 setCharacterFields bridge） =====

  function fillPersonEntityPick(selectId, currentName) {
    var sel = $(selectId);
    if (!sel) return;
    var persons = (state.entities || []).filter(function(e) { return e && e.type === 'person'; });
    var cur = String(currentName || '').trim();
    var html = '<option value="">— 手填角色名 —</option>';
    persons.forEach(function(e) {
      var selected = cur && (e.name === cur || (e.aliases || []).indexOf(cur) >= 0) ? ' selected' : '';
      html += '<option value="' + escapeHtml(e.id) + '"' + selected + '>'
        + escapeHtml(e.name) + '</option>';
    });
    sel.innerHTML = html;
  }

  function syncRangeModeUi(prefix, mode) {
    var charsWrap = $(prefix + 'CharLimitWrap');
    var chWrap = $(prefix + 'ChapterCountWrap');
    var isCh = mode === 'chapters';
    if (charsWrap) charsWrap.style.display = isCh ? 'none' : '';
    if (chWrap) chWrap.style.display = isCh ? '' : 'none';
  }

  async function resolveSetupCorpus(kind, charName, signal) {
    var isGreet = kind === 'greet';
    var budget = isGreet
      ? (state.greetCharLimit || state.expandBudget || DEFAULT_EXPAND_BUDGET)
      : (state.setupCharLimit || state.expandBudget || DEFAULT_EXPAND_BUDGET);
    var name = String(charName || '').trim();
    var ent = name ? findEntityMatch(state.entities, name, []) : null;
    if (ent && ent.type !== 'person') ent = null;
    if (!ent && name) {
      ent = (state.entities || []).find(function(e) {
        return e && e.type === 'person' && String(e.name || '') === name;
      }) || null;
    }

    var fallback = buildSetupCorpus(state.chapters, isGreet
      ? { mode: state.greetRangeMode, charLimit: state.greetCharLimit, chapterCount: state.greetChapterCount }
      : { mode: state.setupRangeMode, charLimit: state.setupCharLimit, chapterCount: state.setupChapterCount });

    if (!name) {
      return Object.assign({}, fallback, { source: 'range', entity: null });
    }

    try {
      var api = getApiConfig();
      var cardId = sm.getBoundCardId();
      var query = ent
        ? [ent.name].concat(ent.aliases || []).join(' ')
        : name;
      var search = await hybridSearch({
        chapters: state.chapters,
        query: query,
        cardId: cardId,
        budget: budget,
        apiUrl: api.apiUrl,
        apiKey: api.apiKey,
        embedModel: api.embedModel,
        signal: signal,
      });
      var body = search && search.body ? String(search.body).trim() : '';
      if (body.length >= 120) {
        var related = ent ? [ent] : pickRelatedEntities(state.entities, query, 4);
        var inject = buildRagInjectBlock(search, related, { entityBudget: 2000 });
        return {
          text: inject,
          charCount: body.length,
          chapterCount: (search.snippets && search.snippets.length) || 0,
          mode: 'rag',
          source: 'rag',
          entity: ent,
        };
      }
    } catch (e) {
      if (isTrackedAbort(e)) throw e;
    }
    return Object.assign({}, fallback, { source: 'range', entity: ent });
  }

  function renderSetupCorpusPreview(kind) {
    var isGreet = kind === 'greet';
    var corpus = buildSetupCorpus(state.chapters, isGreet
      ? { mode: state.greetRangeMode, charLimit: state.greetCharLimit, chapterCount: state.greetChapterCount }
      : { mode: state.setupRangeMode, charLimit: state.setupCharLimit, chapterCount: state.setupChapterCount });
    var meta = $(isGreet ? 'novelGreetPreviewMeta' : 'novelSetupPreviewMeta');
    var prev = $(isGreet ? 'novelGreetPreview' : 'novelSetupPreview');
    var name = String(isGreet ? state.greetCharName : state.setupCharName || '').trim();
    var ent = name ? findEntityMatch(state.entities, name, []) : null;
    var hint = ent && ent.type === 'person' ? ' · 已匹配实体，生成时优先 RAG' : ' · 生成时无命中则用此范围';
    if (meta) {
      meta.textContent = '范围预览 ' + corpus.charCount + ' 字 · ' + corpus.chapterCount + ' 章' + hint;
    }
    if (prev) prev.textContent = corpus.text || '（暂无启用章节文本）';
    return corpus;
  }

  function renderCharacterSetup() {
    var name = $('novelSetupCharName');
    var mode = $('novelSetupRangeMode');
    var limit = $('novelSetupCharLimit');
    var chN = $('novelSetupChapterCount');
    if (name && document.activeElement !== name) name.value = state.setupCharName || '';
    if (mode) mode.value = state.setupRangeMode || 'chars';
    if (limit) limit.value = String(state.setupCharLimit || 16000);
    if (chN && document.activeElement !== chN) chN.value = String(state.setupChapterCount || 3);
    fillPersonEntityPick('novelSetupEntityPick', state.setupCharName);
    syncRangeModeUi('novelSetup', state.setupRangeMode || 'chars');
    renderSetupCorpusPreview('setup');
  }

  function renderGreetingsGen() {
    var name = $('novelGreetCharName');
    var mode = $('novelGreetRangeMode');
    var limit = $('novelGreetCharLimit');
    var chN = $('novelGreetChapterCount');
    var count = $('novelGreetCount');
    if (name && document.activeElement !== name) name.value = state.greetCharName || '';
    if (mode) mode.value = state.greetRangeMode || 'chars';
    if (limit) limit.value = String(state.greetCharLimit || 16000);
    if (chN && document.activeElement !== chN) chN.value = String(state.greetChapterCount || 3);
    if (count && document.activeElement !== count) count.value = String(state.greetCount || 3);
    fillPersonEntityPick('novelGreetEntityPick', state.greetCharName || state.setupCharName);
    syncRangeModeUi('novelGreet', state.greetRangeMode || 'chars');
    renderSetupCorpusPreview('greet');
  }

  async function runGenerateCharSetup() {
    var g = gates();
    if (!g.canExtract) throw new Error((g.reasons || []).join('\n') || '前置未完成');
    if (!isAiConfigured()) throw new Error('未配置 AI 模型（请先到「AI 配置」）');
    var charName = String(state.setupCharName || '').trim();
    if (!charName) throw new Error('请先填写角色名称');

    setStatus('novelSetupStatus', '准备原文…');
    var btn = $('btnNovelGenCharSetup');
    ctx.busyFlags.charSetup = true;
    ctx.setBtnBusy(btn, true, '生成中…');
    try {
      return await runTracked({
        type: 'novel_char_setup',
        title: '小说角色设定 · ' + charName,
        target: charName,
      }, async function(task) {
        if (task.signal && task.signal.aborted) throw new DOMException('已取消', 'AbortError');
        var corpus = await resolveSetupCorpus('setup', charName, task.signal);
        if (!corpus.text || !String(corpus.text).trim()) throw new Error('无可用原文（RAG 与范围截取均空）');
        var meta = $('novelSetupPreviewMeta');
        var prev = $('novelSetupPreview');
        if (meta) meta.textContent = (corpus.source === 'rag' ? 'RAG 召回 ' : '范围截取 ') + corpus.charCount + ' 字 · ' + (corpus.chapterCount || 0) + (corpus.entity ? ' 章 · 实体 ' + corpus.entity.name : ' 章');
        if (prev) prev.textContent = corpus.text;
        var head = promptText('novelCharSetup', '你是 SillyTavern 角色卡写手。仅根据提供的小说原文，为指定角色生成角色设定。只输出 JSON：{ charName, wbName, charDesc, creatorNotes }');
        var user = head + '\n角色名称: ' + charName + (corpus.entity ? '\n实体摘要: ' + String(corpus.entity.summary || '').slice(0, SETUP_ENTITY_SUMMARY) : '') + '\nContext: ' + (state.contextText || '无') + '\n\n【原文】\n' + corpus.text;
        var text = await callAI(user, null, task.signal);
        var data = parseJsonLoose(text);
        var fields = { charName: String(data.charName || charName).trim() || charName, wbName: String(data.wbName || '').trim(), charDesc: String(data.charDesc || '').trim(), creatorNotes: String(data.creatorNotes || '').trim() };
        if (!fields.charDesc) throw new Error('模型未返回角色描述');
        bridgeSetCharFields(fields, $);
        setStatus('novelSetupStatus', '已写入当前卡：' + fields.charName + '（描述 ' + fields.charDesc.length + ' 字 · 语料 ' + corpus.source + '）');
        return { charName: fields.charName, descLen: fields.charDesc.length, corpusChars: corpus.charCount, corpusSource: corpus.source };
      });
    } catch (e) {
      if (isTrackedAbort(e)) setStatus('novelSetupStatus', '⏹ 已取消生成');
      throw e;
    } finally {
      ctx.busyFlags.charSetup = false;
      ctx.setBtnBusy(btn, false);
      renderGates();
    }
  }

  async function runGenerateGreetings() {
    var g = gates();
    if (!g.canExtract) throw new Error((g.reasons || []).join('\n') || '前置未完成');
    if (!isAiConfigured()) throw new Error('未配置 AI 模型（请先到「AI 配置」）');
    var charName = String(state.greetCharName || state.setupCharName || '').trim();
    if (!charName) throw new Error('请先填写角色名称');
    var total = Math.max(1, Math.min(12, Number(state.greetCount) || 3));
    var altCount = Math.max(0, total - 1);

    setStatus('novelGreetStatus', '准备原文…');
    var btn = $('btnNovelGenGreetings');
    ctx.busyFlags.greetings = true;
    ctx.setBtnBusy(btn, true, '生成中…');
    try {
      return await runTracked({
        type: 'novel_greetings',
        title: '小说开场白 · ' + charName + ' ×' + total,
        target: charName,
      }, async function(task) {
        if (task.signal && task.signal.aborted) throw new DOMException('已取消', 'AbortError');
        var corpus = await resolveSetupCorpus('greet', charName, task.signal);
        if (!corpus.text || !String(corpus.text).trim()) throw new Error('无可用原文（RAG 与范围截取均空）');
        var meta = $('novelGreetPreviewMeta');
        var prev = $('novelGreetPreview');
        if (meta) meta.textContent = (corpus.source === 'rag' ? 'RAG 召回 ' : '范围截取 ') + corpus.charCount + ' 字 · ' + (corpus.chapterCount || 0) + (corpus.entity ? ' 章 · 实体 ' + corpus.entity.name : ' 章');
        if (prev) prev.textContent = corpus.text;
        var headTpl = promptText('novelGreetingsGen', '你是 SillyTavern 开场白写手。只输出 JSON：{ "firstMes":"...", "altGreetings":[...] }，altGreetings 长度必须刚好为 {{altCount}}。');
        var head = applyTemplate(headTpl, { altCount: altCount });
        var user = head + '\n角色名称: ' + charName + (corpus.entity ? '\n实体摘要: ' + String(corpus.entity.summary || '').slice(0, SETUP_ENTITY_SUMMARY) : '') + '\n开场白总数: ' + total + '（主开场 1 + 备选 ' + altCount + '）' + '\nContext: ' + (state.contextText || '无') + '\n\n【原文】\n' + corpus.text;
        var text = await callAI(user, null, task.signal);
        var data = parseJsonLoose(text);
        var firstMes = String(data.firstMes || data.first_mes || '').trim();
        var alts = Array.isArray(data.altGreetings) ? data.altGreetings : (Array.isArray(data.alternate_greetings) ? data.alternate_greetings : []);
        alts = alts.map(function(s) { return String(s || '').trim(); }).filter(Boolean);
        while (alts.length < altCount) alts.push('');
        if (alts.length > altCount) alts = alts.slice(0, altCount);
        if (!firstMes) throw new Error('模型未返回主开场白');
        // Use setGreetingFields
        if (firstMes != null && $('firstMes')) { $('firstMes').value = String(firstMes); $('firstMes').dispatchEvent(new Event('input', { bubbles: true })); }
        window.__altGreetings__ = Array.isArray(alts) ? alts.slice() : [];
        if (typeof window.__renderAltGreetings__ === 'function') window.__renderAltGreetings__();
        window.dispatchEvent(new Event('card-builder-data-changed'));
        setStatus('novelGreetStatus', '已写入当前卡：主开场 + 备选 ' + alts.length + ' 条 · 语料 ' + corpus.source);
        return { firstMesLen: firstMes.length, altCount: alts.length, corpusChars: corpus.charCount, corpusSource: corpus.source };
      });
    } catch (e) {
      if (isTrackedAbort(e)) setStatus('novelGreetStatus', '⏹ 已取消生成');
      throw e;
    } finally {
      ctx.busyFlags.greetings = false;
      ctx.setBtnBusy(btn, false);
      renderGates();
    }
  }

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

  // ===== 事件绑定 =====

  function bindCharacterSetup() {
    var pick = $('novelSetupEntityPick');
    if (pick) pick.addEventListener('change', function() {
      var id = pick.value;
      var ent = (state.entities || []).find(function(e) { return e.id === id; });
      if (ent) {
        state.setupCharName = ent.name;
        var nameEl = $('novelSetupCharName');
        if (nameEl) nameEl.value = ent.name;
        ctx.save();
        renderSetupCorpusPreview('setup');
      }
    });
    var name = $('novelSetupCharName');
    if (name) name.addEventListener('input', function() { state.setupCharName = name.value; ctx.save(); renderSetupCorpusPreview('setup'); });
    var mode = $('novelSetupRangeMode');
    if (mode) mode.addEventListener('change', function() { state.setupRangeMode = mode.value === 'chapters' ? 'chapters' : 'chars'; ctx.save(); renderCharacterSetup(); });
    var limit = $('novelSetupCharLimit');
    if (limit) limit.addEventListener('change', function() { state.setupCharLimit = parseInt(limit.value, 10) || 16000; ctx.save(); renderSetupCorpusPreview('setup'); });
    var chN = $('novelSetupChapterCount');
    if (chN) chN.addEventListener('input', function() { state.setupChapterCount = Math.max(1, parseInt(chN.value, 10) || 1); ctx.save(); renderSetupCorpusPreview('setup'); });
    var gen = $('btnNovelGenCharSetup');
    if (gen) gen.addEventListener('click', async function() { try { await runGenerateCharSetup(); } catch (e) { if (!isTrackedAbort(e)) alert('生成失败: ' + (e.message || e)); } });
  }

  function bindGreetingsGen() {
    var pick = $('novelGreetEntityPick');
    if (pick) pick.addEventListener('change', function() {
      var id = pick.value;
      var ent = (state.entities || []).find(function(e) { return e.id === id; });
      if (ent) {
        state.greetCharName = ent.name;
        var nameEl = $('novelGreetCharName');
        if (nameEl) nameEl.value = ent.name;
        ctx.save();
        renderSetupCorpusPreview('greet');
      }
    });
    var name = $('novelGreetCharName');
    if (name) name.addEventListener('input', function() { state.greetCharName = name.value; ctx.save(); renderSetupCorpusPreview('greet'); });
    var mode = $('novelGreetRangeMode');
    if (mode) mode.addEventListener('change', function() { state.greetRangeMode = mode.value === 'chapters' ? 'chapters' : 'chars'; ctx.save(); renderGreetingsGen(); });
    var limit = $('novelGreetCharLimit');
    if (limit) limit.addEventListener('change', function() { state.greetCharLimit = parseInt(limit.value, 10) || 16000; ctx.save(); renderSetupCorpusPreview('greet'); });
    var chN = $('novelGreetChapterCount');
    if (chN) chN.addEventListener('input', function() { state.greetChapterCount = Math.max(1, parseInt(chN.value, 10) || 1); ctx.save(); renderSetupCorpusPreview('greet'); });
    var count = $('novelGreetCount');
    if (count) count.addEventListener('input', function() { state.greetCount = Math.max(1, Math.min(12, parseInt(count.value, 10) || 3)); ctx.save(); });
    var gen = $('btnNovelGenGreetings');
    if (gen) gen.addEventListener('click', async function() { try { await runGenerateGreetings(); } catch (e) { if (!isTrackedAbort(e)) alert('生成失败: ' + (e.message || e)); } });
  }

  // ===== 助手桥接 =====

  window.__novelWorkshopBridge__ = createBridge(ctx);

  // ===== 初始化 =====

  ctx.bindNovelModals();
  if (ctx.panels.source) ctx.panels.source.bind();
  if (ctx.panels.chapters) ctx.panels.chapters.bind();
  bindCharacterSetup();
  bindGreetingsGen();
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
}
