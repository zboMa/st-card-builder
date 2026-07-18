/**
 * 小说工坊浏览器端：状态、UI 绑定、AI 调用、助手桥接
 */
import {
  createDefaultNovelState,
  getPipelineGates,
  getFullSourceText,
  summarizeNovelState,
  writeNovelBucket,
  writeNovelBucketIdb,
  loadNovelStateForCardIdb,
  WB_FOCUS_OPTIONS,
} from './state.mjs';
import {
  splitIntoChapters,
  mergeChapters,
  splitChapterAt,
  renameChapter,
  moveChapter,
  setChapterEnabled,
  exportSelectedChapters,
  buildExtractShards,
  estimateExtractCalls,
  buildSetupCorpus,
  chaptersSourceFingerprint,
} from './chapters.mjs';
import { buildRecallPayload, DEFAULT_EXPAND_BUDGET } from './recall.mjs';
import {
  normalizeCharacterProfile,
  emptyCharacterProfile,
  profileContentDigest,
} from './schema.mjs';
import {
  profileToCharacterFields,
  applyDraftsToWorldbook,
  profileToWorldbookDraft,
  entityPersonToCharacterFields,
  entityPersonToWorldbookDraft,
  styleToWorldbookDraft,
  syncEntitiesToWorldbook,
} from './sync.mjs';
import { buildNovelRagIndex } from './rag/indexBuild.mjs';
import { hybridSearch } from './rag/hybridSearch.mjs';
import { extractQueryTerms } from './rag/keywordSearch.mjs';
import { buildRagInjectBlock, pickRelatedEntities } from './rag/inject.mjs';
import { loadRagIndex } from './rag/store.mjs';
import {
  getEmbeddingConfig,
  EMBEDDING_API_URL_KEY,
  EMBEDDING_API_KEY_KEY,
  EMBEDDING_MODEL_KEY,
} from './rag/embeddingConfig.mjs';
import {
  upsertEntity,
  findEntityMatch,
  projectEntitiesToLegacy,
  ingestLegacyIntoEntities,
  countEntitiesByType,
  normalizeAliases,
  isEntityEnriched,
  ENTITY_TYPES,
} from './entityStore.mjs';
import {
  applySkeletonResult,
  applyEnrichResult,
  listEntitiesNeedingEnrich,
  buildSkeletonPriorBlock,
} from './analyzePipeline.mjs';
import { emptyKnowledgeGraph } from './graphMerge.mjs';
import { mountOrUpdateGraph, relayoutGraph } from './graphViz.mjs';
import {
  getAdultMode,
  setAdultMode,
  getNtlMode,
  setNtlMode,
  boostAdultSearchQuery,
  buildAdultContextDigests,
  extractStyleNsfwSection,
  buildModeHintBlocks,
  buildContentModeFlags,
  buildStatusBarNsfwDraftFromEntities,
  mergeAdultAttrs,
} from './nsfwSupport.mjs';
import { applyTemplate } from '../promptStore.mjs';
import { normalizeCharacterPatch } from '../assistant/characterFields.mjs';

function uid(prefix) {
  return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 10);
}

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncatePreviewLine(text, maxLen) {
  var cap = maxLen || 100;
  var one = String(text || '').replace(/\s+/g, ' ').trim();
  if (!one) return '';
  return one.length > cap ? one.slice(0, cap) + '…' : one;
}

function promptText(id, fallback) {
  if (window.__promptStore__ && window.__promptStore__.get) {
    var t = window.__promptStore__.get(id);
    if (t) return t;
  }
  return fallback || '';
}

async function callAI(userContent, systemExtra, signal) {
  var apiUrlEl = $('apiUrl');
  var apiKeyEl = $('apiKey');
  var modelEl = $('modelSelect');
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
  return String(text || '');
}

/** 经全局任务中心登记后执行（无中心时直跑） */
function runTracked(meta, fn) {
  var center = window.__aiTaskCenter__;
  if (center && typeof center.run === 'function') return center.run(meta, fn);
  return fn({ signal: undefined, id: null });
}

function isTrackedAbort(err) {
  if (window.__isAiAbortError__) return window.__isAiAbortError__(err);
  return !!(err && (err.name === 'AbortError' || /abort|取消|已停止/i.test(String(err.message || ''))));
}

function parseJsonLoose(text) {
  var fence = String(text || '').match(/```(?:json)?\s*([\s\S]*?)```/i);
  var raw = fence ? fence[1] : text;
  try {
    return JSON.parse(raw);
  } catch (e) {
    var first = String(raw).indexOf('{');
    var last = String(raw).lastIndexOf('}');
    if (first >= 0 && last > first) return JSON.parse(String(raw).slice(first, last + 1));
    var a0 = String(raw).indexOf('[');
    var a1 = String(raw).lastIndexOf(']');
    if (a0 >= 0 && a1 > a0) return JSON.parse(String(raw).slice(a0, a1 + 1));
    throw new Error('JSON 解析失败');
  }
}

/**
 * 并行池；可选 signal：取消后不再领取新分片（进行中的 fetch 靠同一 signal 中断）
 * @param {any[]} items
 * @param {number} concurrency
 * @param {(item: any, index: number) => Promise<any>} worker
 * @param {AbortSignal} [signal]
 */
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

/** 供测试：分片并行 + 可中断 */
export { mapPool };

/** 已扫描人物摘要，供下一步分片注入（参考 + 可补 aliases/identity） */
function formatPriorCharScanRef(chars) {
  if (!chars || !chars.length) return '';
  var lines = chars.map(function(c) {
    var alias = (c.aliases || []).length ? ' aliases=' + c.aliases.join('/') : '';
    return '- ' + c.name + alias + (c.note ? ' · ' + String(c.note).substring(0, 80) : '');
  }).join('\n');
  return '\n【已扫描人物（勿重复同名；可补 aliases/identity，可完善说明）】\n' + lines;
}

/** 规范化别名/触发词列表：拆分字符串、去空、去与主名重复 */
function normalizeNameList(primary, raw) {
  var name = String(primary || '').trim();
  var out = [];
  function add(t) {
    var s = String(t == null ? '' : t).trim();
    if (!s || s === name) return;
    if (out.indexOf(s) < 0) out.push(s);
  }
  if (Array.isArray(raw)) {
    raw.forEach(function(item) {
      String(item == null ? '' : item).split(/[,，、／/|;；\s]+/).forEach(add);
    });
  } else if (raw != null && String(raw).trim()) {
    String(raw).split(/[,，、／/|;；\s]+/).forEach(add);
  }
  return out;
}

/** 已抽取世界书条目摘要，供下一步分片注入参考 */
function formatPriorWbExtractRef(entries) {
  if (!entries || !entries.length) return '';
  var lines = entries.map(function(e) {
    return '- [' + (e.category || 'setting') + '] ' + e.name + ': ' + String(e.content || '').substring(0, 140);
  }).join('\n');
  return '\n【已抽取条目（勿重复同名；可补充完善 content/keys）】\n' + lines;
}

/** 合并单条抽取：同名保留更长 content，合并 keys */
function mergeWbExtractEntry(all, entry) {
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
  // 合并成人维 attrs.adult，供投影入库
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

export { formatPriorCharScanRef, formatPriorWbExtractRef, mergeWbExtractEntry, normalizeNameList };

export function initNovelWorkshop() {
  if (window.__novelWorkshopReady__) return;
  window.__novelWorkshopReady__ = true;

  var boundCardId = '';
  var state = createDefaultNovelState();
  var editingCharId = null;
  var editingWbIndex = -1;
  var isCreatingWbEntry = false;
  var novelWbSearchQuery = '';
  /** 世界书条目类型筛选（不写入 state 桶） */
  var novelWbTypeFilter = '';
  var editingEntityId = null;
  /** 进行中的长 AI：阻止 renderGates 误启按钮 */
  var busyFlags = {
    charScan: false,
    wbExtract: false,
    styleDistill: false,
    charSetup: false,
    greetings: false,
    ragIndex: false,
    analyzeSkeleton: false,
    analyzeEnrich: false,
    analyzeRelations: false,
    analyzeAll: false,
  };
  /** @type {import('@antv/g6').Graph|null} */
  var graphCy = null;
  // 人物档案 / 章节预览 / AI 扩展确认 / 世界书条目编辑
  var NOVEL_MODAL_IDS = ['novelModalChapter', 'novelModalProfile', 'novelModalExpandConfirm', 'novelModalWb', 'novelModalEntity'];
  /** @type {{ resolve: (ok: boolean) => void } | null} */
  var pendingExpandConfirm = null;

  /** 按钮进入/退出 loading（保留原 label 供恢复） */
  function setBtnBusy(btn, busy, loadingText) {
    if (!btn) return;
    if (busy) {
      if (btn.dataset.idleLabel == null) btn.dataset.idleLabel = btn.textContent || '';
      btn.disabled = true;
      if (loadingText) btn.textContent = loadingText;
    } else {
      btn.disabled = false;
      if (btn.dataset.idleLabel != null) {
        btn.textContent = btn.dataset.idleLabel;
        delete btn.dataset.idleLabel;
      }
    }
  }

  /** 图标按钮：title 作悬停提示 */
  function iconBtn(attrs, icon, title, extraClass) {
    return '<button type="button" class="novel-icon-btn' + (extraClass ? ' ' + extraClass : '')
      + '" title="' + title + '" aria-label="' + title + '" ' + attrs + '>' + icon + '</button>';
  }

  /** 世界书内容是否仍为骨架（未 AI 扩展） */
  function isUnexpandedWbContent(content) {
    var c = String(content || '').trim();
    return c.length < 60 || c.indexOf('待展开') >= 0;
  }

  /** 真弹窗：挂到 body，避免 panel overflow 裁切 */
  function openNovelModal(id) {
    var el = $(id);
    if (!el) return;
    if (!el._novelModalHome) el._novelModalHome = el.parentNode;
    document.body.appendChild(el);
    el.hidden = false;
    el.setAttribute('aria-hidden', 'false');
    document.body.classList.add('novel-modal-open');
  }

  function closeNovelModal(id) {
    var el = $(id);
    if (!el) return;
    el.hidden = true;
    el.setAttribute('aria-hidden', 'true');
    if (el._novelModalHome && el.parentNode !== el._novelModalHome) {
      el._novelModalHome.appendChild(el);
    }
    if (id === 'novelModalProfile') editingCharId = null;
    if (id === 'novelModalWb') {
      editingWbIndex = -1;
      isCreatingWbEntry = false;
    }
    if (id === 'novelModalEntity') editingEntityId = null;
    if (id === 'novelModalExpandConfirm' && pendingExpandConfirm) {
      var rej = pendingExpandConfirm;
      pendingExpandConfirm = null;
      rej.resolve(false);
    }
    var anyOpen = NOVEL_MODAL_IDS.some(function(mid) {
      var m = $(mid);
      return m && !m.hidden;
    });
    if (!anyOpen) document.body.classList.remove('novel-modal-open');
  }

  /**
   * AI 扩展前确认弹窗：展示原文摘录与字数；silent/skipConfirm 跳过
   * @returns {Promise<boolean>}
   */
  function confirmExpandRecall(opts) {
    opts = opts || {};
    if (opts.silent || opts.skipConfirm) return Promise.resolve(true);
    var titleEl = $('novelModalExpandTitle');
    var metaEl = $('novelModalExpandMeta');
    var bodyEl = $('novelModalExpandBody');
    if (!bodyEl) return Promise.resolve(true);
    if (titleEl) titleEl.textContent = opts.title || 'AI 扩展确认';
    if (metaEl) {
      metaEl.textContent = '将使用原文约 ' + (opts.totalChars || 0) + ' 字'
        + (opts.snippetCount != null ? '（' + opts.snippetCount + ' 片段）' : '')
        + (opts.truncated ? ' · 已按预算抽样' : '')
        + (opts.terms && opts.terms.length ? ' · 匹配词：' + opts.terms.join('、') : '');
    }
    bodyEl.value = opts.body || '（无摘录）';
    return new Promise(function(resolve) {
      if (pendingExpandConfirm) pendingExpandConfirm.resolve(false);
      pendingExpandConfirm = { resolve: resolve };
      openNovelModal('novelModalExpandConfirm');
    });
  }

  function bindNovelModals() {
    document.querySelectorAll('[data-novel-modal-close]').forEach(function(el) {
      el.addEventListener('click', function() {
        closeNovelModal(el.getAttribute('data-novel-modal-close'));
      });
    });
    var confirmBtn = $('btnNovelExpandConfirm');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', function() {
        var pending = pendingExpandConfirm;
        pendingExpandConfirm = null;
        closeNovelModal('novelModalExpandConfirm');
        if (pending) pending.resolve(true);
      });
    }
    document.addEventListener('keydown', function(e) {
      if (e.key !== 'Escape') return;
      NOVEL_MODAL_IDS.forEach(closeNovelModal);
    });
  }

  /** 人物扫描分片参数（预估与真实抽取共用） */
  function charShardOpts() {
    return {
      mode: state.charShardMode === 'chapters' ? 'chapters' : 'chars',
      chunkSize: state.charChunkSize || state.chunkSize || 8000,
      chaptersPerShard: state.charChaptersPerShard || 1,
    };
  }

  /** 世界书抽取分片参数 */
  function wbShardOpts() {
    return {
      mode: state.wbShardMode === 'chapters' ? 'chapters' : 'chars',
      chunkSize: state.wbChunkSize || state.chunkSize || 8000,
      chaptersPerShard: state.wbChaptersPerShard || 1,
    };
  }

  /** 统一小说分析分片参数 */
  function analyzeShardOpts() {
    return {
      mode: state.analyzeShardMode === 'chapters' ? 'chapters' : 'chars',
      chunkSize: state.analyzeChunkSize || state.chunkSize || 8000,
      chaptersPerShard: state.analyzeChaptersPerShard || 1,
    };
  }

  /** 读取 Embedding 配置（独立 URL/Key 留空则回退主 Chat API） */
  function getApiConfig() {
    var apiUrlEl = $('apiUrl');
    var apiKeyEl = $('apiKey');
    var embedUrlEl = $('embeddingApiUrl');
    var embedKeyEl = $('embeddingApiKey');
    var embedEl = $('embeddingModel');
    var embeddingApiUrl = embedUrlEl ? String(embedUrlEl.value || '').trim() : '';
    var embeddingApiKey = embedKeyEl ? String(embedKeyEl.value || '').trim() : '';
    var embeddingModel = embedEl ? String(embedEl.value || '').trim() : '';
    try {
      if (!embeddingApiUrl) embeddingApiUrl = localStorage.getItem(EMBEDDING_API_URL_KEY) || '';
      if (!embeddingApiKey) embeddingApiKey = localStorage.getItem(EMBEDDING_API_KEY_KEY) || '';
      if (!embeddingModel) embeddingModel = localStorage.getItem(EMBEDDING_MODEL_KEY) || '';
    } catch (e) { /* ignore */ }
    var resolved = getEmbeddingConfig({
      embeddingApiUrl: embeddingApiUrl,
      embeddingApiKey: embeddingApiKey,
      embeddingModel: embeddingModel,
      apiUrl: apiUrlEl ? String(apiUrlEl.value || '') : '',
      apiKey: apiKeyEl ? String(apiKeyEl.value || '').trim() : '',
    });
    return {
      apiUrl: resolved.apiUrl,
      apiKey: resolved.apiKey,
      embedModel: resolved.embeddingModel,
    };
  }

  /** 实体类型中文标签 */
  var ENTITY_TYPE_ZH = {
    person: '人物',
    faction: '势力',
    location: '地点',
    item: '物品',
    event: '事件',
    lore: '设定',
    nsfw: 'NSFW',
  };

  /** 按方式显示字数/章节数配置 */
  function syncShardModeUi(prefix, mode) {
    var byChars = mode !== 'chapters';
    var sizeWrap = $(prefix + 'ChunkSizeWrap');
    var chWrap = $(prefix + 'ChaptersPerShardWrap');
    if (sizeWrap) sizeWrap.hidden = !byChars;
    if (chWrap) chWrap.hidden = byChars;
  }

  /** 按钮文案前缀：约 N 次 · …（方式/数值或章节变化时重算；busy 时不覆盖 loading） */
  function updateExtractCallEstimates() {
    var charN = estimateExtractCalls(state.chapters, charShardOpts());
    var wbN = estimateExtractCalls(state.chapters, wbShardOpts());
    var scanBtn = $('btnCharScan');
    if (scanBtn && !busyFlags.charScan) {
      scanBtn.textContent = '约 ' + charN + ' 次 · 扫描全书';
      if (scanBtn.dataset.idleLabel != null) scanBtn.dataset.idleLabel = scanBtn.textContent;
    }
    var extractBtn = $('btnWbExtract');
    if (extractBtn && !busyFlags.wbExtract) {
      extractBtn.textContent = '约 ' + wbN + ' 次 · AI 抽取';
      if (extractBtn.dataset.idleLabel != null) extractBtn.dataset.idleLabel = extractBtn.textContent;
    }
    var analyzeShards = estimateExtractCalls(state.chapters, analyzeShardOpts());
    var enrichN = listEntitiesNeedingEnrich(state.entities, state.strictQuality, getAdultMode(state)).length;
    var analyzeAllBtn = $('btnNovelAnalyzeAll');
    if (analyzeAllBtn && !busyFlags.analyzeAll && !busyFlags.analyzeSkeleton && !busyFlags.analyzeEnrich) {
      var analyzeAllN = analyzeShards + enrichN + 2;
      analyzeAllBtn.textContent = '约 ' + analyzeAllN + ' 次 · 开始完整分析';
      if (analyzeAllBtn.dataset.idleLabel != null) analyzeAllBtn.dataset.idleLabel = analyzeAllBtn.textContent;
    }
  }

  function currentCardId() {
    if (typeof window.__getCurrentDraftId__ === 'function') {
      return String(window.__getCurrentDraftId__() || '').trim();
    }
    return boundCardId;
  }

  var persistTimer = null;

  /** 按 cardId 分桶写入 IndexedDB；失败时回退 localStorage */
  function persistNovelState() {
    var id = boundCardId || currentCardId();
    if (!id) return;
    clearTimeout(persistTimer);
    persistTimer = setTimeout(function() {
      writeNovelBucketIdb(id, state).catch(function(err) {
        console.warn('[novel] IndexedDB 保存失败，回退 localStorage', err);
        writeNovelBucket(localStorage, id, state);
      });
    }, 280);
  }

  /** 按 cardId 分桶读写；导出角色卡不含本状态 */
  function save() {
    var id = boundCardId || currentCardId();
    if (id) boundCardId = id;
    persistNovelState();
    var summary = summarizeNovelState(state);
    summary.cardId = boundCardId || '';
    window.dispatchEvent(new CustomEvent('novel-state-changed', { detail: summary }));
  }

  /** 切换角色卡时加载对应桶；新建卡为空状态 */
  function bindCard(cardId, opts) {
    bindCardAsync(cardId, opts).catch(function(err) {
      console.warn('[novel] bindCard failed', err);
    });
  }

  async function bindCardAsync(cardId, opts) {
    opts = opts || {};
    var nextId = String(cardId || '').trim();
    if (!nextId) return;
    if (boundCardId && boundCardId === nextId && !opts.force) return;
    if (boundCardId && boundCardId !== nextId) {
      try {
        await writeNovelBucketIdb(boundCardId, state);
      } catch (e) {
        writeNovelBucket(localStorage, boundCardId, state);
      }
    }
    var loaded = await loadNovelStateForCardIdb(nextId, localStorage);
    boundCardId = nextId;
    state = loaded.state;
    editingCharId = null;
    // 加载后修复投影：旧桶仅有 characters/wb 时 ingest；始终刷新图谱
    if (!(state.entities || []).length
      && (((state.characters || []).length) || ((state.wbEntries || []).length))) {
      ingestLegacyIntoEntities(state, 'legacy_scan');
    }
    projectEntitiesToLegacy(state);
    syncRagOptionsToAiPanel();
    save();
    if (opts.render !== false && typeof renderAll === 'function') renderAll();
  }

  /** 小说 state.rag ↔ AI 配置面板对齐 */
  function syncRagOptionsToAiPanel() {
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

  function applyRagOptionsFromUi(opts) {
    opts = opts || {};
    if (!state.rag) state.rag = {};
    if (opts.enabled != null) state.rag.enabled = !!opts.enabled;
    if (opts.budget != null) state.rag.budget = Math.max(2000, Math.floor(Number(opts.budget) || 12000));
    save();
  }

  /** 索引是否缺失或与章节指纹不一致 */
  function isRagIndexStale() {
    if (!state.rag || state.rag.indexStatus !== 'ready') return true;
    if (!(state.rag.chunkCount > 0)) return true;
    var fp = chaptersSourceFingerprint(state.chapters);
    return fp !== String(state.rag.sourceFingerprint || '');
  }

  function pushFailedShard(rec) {
    if (!Array.isArray(state.failedShards)) state.failedShards = [];
    state.failedShards.push(Object.assign({ at: new Date().toISOString() }, rec || {}));
  }

  function clearFailedShards(phase) {
    if (!phase) {
      state.failedShards = [];
      return;
    }
    state.failedShards = (state.failedShards || []).filter(function(f) { return f.phase !== phase; });
  }

  /** 填充实体人物下拉 */
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

  /**
   * 设定/开场白语料：优先实体匹配 + RAG；无命中回退范围截取
   * @returns {Promise<{ text, charCount, chapterCount, mode, source, entity }>}
   */
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
      var cardId = boundCardId || currentCardId();
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
      // RAG 失败则回退
    }
    return Object.assign({}, fallback, { source: 'range', entity: ent });
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

  function setAiTip(id, msg) {
    var el = $(id);
    if (el) el.textContent = msg || '';
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
    var analyzeBusy = busyFlags.ragIndex || busyFlags.analyzeSkeleton || busyFlags.analyzeEnrich
      || busyFlags.analyzeRelations || busyFlags.analyzeAll;
    var scanBtn = $('btnCharScan');
    if (scanBtn) scanBtn.disabled = extractDisabled || busyFlags.charScan;
    var extractBtn = $('btnWbExtract');
    if (extractBtn) extractBtn.disabled = extractDisabled || busyFlags.wbExtract;
    var styleBtn = $('btnStyleDistill');
    if (styleBtn) styleBtn.disabled = extractDisabled || busyFlags.styleDistill;
    var setupBtn = $('btnNovelGenCharSetup');
    if (setupBtn) setupBtn.disabled = extractDisabled || busyFlags.charSetup;
    var greetBtn = $('btnNovelGenGreetings');
    if (greetBtn) greetBtn.disabled = extractDisabled || busyFlags.greetings;
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
    // 未配 AI：tip 提示，按钮仍可点（点击再拦截）
    var tip = isAiConfigured() ? '' : '未配置 AI，请先到「AI 配置」选择模型';
    setAiTip('novelSetupAiTip', tip);
    setAiTip('novelGreetAiTip', tip);
  }

  function renderSource() {
    var src = $('novelSourceText');
    var ctx = $('novelContextText');
    if (src) src.value = state.sourceText || '';
    if (ctx) ctx.value = state.contextText || '';
    var mode = $('novelNarrativeMode');
    var conc = $('novelConcurrency');
    var budget = $('novelExpandBudget');
    var strict = $('novelStrictQuality');
    if (mode) mode.value = state.narrativeMode || 'story';
    if (conc) conc.value = String(state.concurrency || 3);
    if (budget) budget.value = String(state.expandBudget || DEFAULT_EXPAND_BUDGET);
    if (strict) strict.checked = !!state.strictQuality;
    // 内容模式仅在原始资料·全局配置
    var globalAdult = $('novelGlobalAdult');
    var globalNtl = $('novelGlobalNtl');
    if (globalAdult) globalAdult.checked = getAdultMode(state);
    if (globalNtl) globalNtl.checked = getNtlMode(state);

    var summary = $('novelFileSummary');
    var clearBtn = $('btnNovelClearFile');
    if (state.fileText && state.fileMeta) {
      if (summary) {
        summary.style.display = 'inline-block';
        summary.innerHTML = '<strong>' + escapeHtml(state.fileMeta.name) + '</strong> · ' + state.fileText.length + ' 字';
      }
      if (clearBtn) clearBtn.style.display = 'inline-block';
    } else {
      if (summary) summary.style.display = 'none';
      if (clearBtn) clearBtn.style.display = 'none';
    }

    var bar = $('novelStatsBar');
    if (bar) {
      var g = gates();
      bar.innerHTML = [
        '<span class="novel-stat-chip">' + (g.sourceLen ? (g.sourceLen + ' 字') : '等待导入文本') + '</span>',
        '<span class="novel-stat-chip">章节 ' + g.enabledChapterCount + '/' + g.chapterCount + '</span>',
        '<span class="novel-stat-chip">人物 ' + g.characterCount + '</span>',
        '<span class="novel-stat-chip">世界书草稿 ' + g.wbEntryCount + '</span>',
      ].join('');
    }
  }

  function selectedChapterIds() {
    return (state.chapters || []).filter(function(c) { return c.selected; }).map(function(c) { return c.id; });
  }

  /** 章节正文：居中遮罩弹窗预览 */
  function showChapterPreview(ch) {
    if (!ch) return;
    var title = $('novelModalChapterTitle');
    var body = $('novelModalChapterBody');
    if (title) title.textContent = ch.title || '章节预览';
    if (body) body.textContent = ch.text || '';
    openNovelModal('novelModalChapter');
  }

  function downloadChapterMarkdown(text, filename) {
    if (!text) return alert('没有可导出章节');
    var blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'novel-chapters.md';
    a.click();
  }

  function renderChapters() {
    var list = $('novelChapterList');
    var count = $('novelChapterCount');
    if (count) count.textContent = (state.chapters || []).length + ' 章';
    var mode = $('novelChapterSplitMode');
    if (mode) mode.value = state.chapterSplitMode || 'title';
    var chunk = $('novelChunkSize');
    if (chunk) chunk.value = String(state.chunkSize || 8000);
    if (!list) return;
    if (!(state.chapters || []).length) {
      list.innerHTML = '<div class="novel-status-text">尚未拆章。请先导入资料后点击「自动拆章」。</div>';
      return;
    }
    // 左：勾选 + 标题/字数；右：图标操作（不换到标题下方）
    list.innerHTML = state.chapters.map(function(c, i) {
      var disabled = c.enabled === false;
      return '<div class="novel-chapter-row' + (disabled ? ' is-disabled' : '') + '" data-ch-id="' + c.id + '">'
        + '<input type="checkbox" data-ch-sel="' + c.id + '"' + (c.selected ? ' checked' : '') + ' />'
        + '<div class="novel-chapter-main">'
        + '<button type="button" class="novel-chapter-title" data-ch-preview="' + c.id + '" title="预览正文">'
        + escapeHtml(c.title) + '</button>'
        + '<span class="novel-chapter-meta">#' + (i + 1) + ' · ' + (c.text || '').length + ' 字 · '
        + (disabled ? '已禁用' : '启用') + '</span>'
        + '</div>'
        + '<div class="novel-chapter-actions">'
        + iconBtn('data-ch-preview="' + c.id + '"', '◎', '预览')
        + iconBtn('data-ch-split="' + c.id + '"', '½', '对半拆分')
        + iconBtn('data-ch-rename="' + c.id + '"', '✎', '重命名')
        + iconBtn('data-ch-up="' + c.id + '"', '↑', '上移')
        + iconBtn('data-ch-down="' + c.id + '"', '↓', '下移')
        + iconBtn('data-ch-toggle="' + c.id + '"', disabled ? '▶' : '⏸', disabled ? '启用' : '禁用')
        + iconBtn('data-ch-export="' + c.id + '"', '⬇', '导出')
        + iconBtn('data-ch-delete="' + c.id + '"', '×', '删除', 'is-danger')
        + '</div></div>';
    }).join('');
    list.querySelectorAll('[data-ch-sel]').forEach(function(cb) {
      cb.addEventListener('change', function() {
        var id = cb.getAttribute('data-ch-sel');
        state.chapters = state.chapters.map(function(c) {
          return c.id === id ? Object.assign({}, c, { selected: cb.checked }) : c;
        });
        save();
      });
    });
    list.querySelectorAll('[data-ch-preview]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-ch-preview');
        var ch = state.chapters.find(function(c) { return c.id === id; });
        showChapterPreview(ch);
      });
    });
    list.querySelectorAll('[data-ch-split]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-ch-split');
        var ch = state.chapters.find(function(c) { return c.id === id; });
        if (!ch) return;
        state.chapters = splitChapterAt(state.chapters, id, Math.floor(ch.text.length / 2));
        save();
        renderAll();
      });
    });
    list.querySelectorAll('[data-ch-rename]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-ch-rename');
        var ch = state.chapters.find(function(c) { return c.id === id; });
        if (!ch) return;
        var title = prompt('新标题', ch.title || '');
        if (title == null) return;
        state.chapters = renameChapter(state.chapters, id, title);
        save();
        renderAll();
      });
    });
    list.querySelectorAll('[data-ch-up]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        state.chapters = moveChapter(state.chapters, btn.getAttribute('data-ch-up'), -1);
        save();
        renderAll();
      });
    });
    list.querySelectorAll('[data-ch-down]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        state.chapters = moveChapter(state.chapters, btn.getAttribute('data-ch-down'), 1);
        save();
        renderAll();
      });
    });
    list.querySelectorAll('[data-ch-toggle]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-ch-toggle');
        var ch = state.chapters.find(function(c) { return c.id === id; });
        if (!ch) return;
        state.chapters = setChapterEnabled(state.chapters, id, ch.enabled === false);
        save();
        renderAll();
      });
    });
    list.querySelectorAll('[data-ch-export]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-ch-export');
        var text = exportSelectedChapters(state.chapters, [id]);
        var ch = state.chapters.find(function(c) { return c.id === id; });
        downloadChapterMarkdown(text, (ch && ch.title ? ch.title : 'chapter') + '.md');
      });
    });
    list.querySelectorAll('[data-ch-delete]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-ch-delete');
        if (!confirm('确定删除该章节？')) return;
        state.chapters = state.chapters.filter(function(c) { return c.id !== id; });
        save();
        renderAll();
      });
    });
  }

  function syncBadge(status) {
    var s = status || 'unsynced';
    var label = s === 'synced' ? '已同步' : (s === 'dirty' ? '有本地修改' : '未同步');
    return '<span class="novel-sync-badge ' + s + '">' + label + '</span>';
  }

  /** 按人物 id/名找实体 */
  function findPersonEntityForChar(ch) {
    if (!ch) return null;
    var byId = (state.entities || []).find(function(e) { return e.id === ch.id && e.type === 'person'; });
    if (byId) return byId;
    return findEntityMatch(state.entities, ch.name, ch.aliases || []);
  }

  /** 世界书 category → 实体 type */
  function wbCategoryToEntityType(cat) {
    var c = String(cat || 'setting');
    if (c === 'faction' || c === 'location' || c === 'item' || c === 'event' || c === 'nsfw') return c;
    return 'lore';
  }

  function renderCharacters() {
    var grid = $('novelCharGrid');
    var idCheck = $('novelScanIdentity');
    var stage = $('novelSplitStage');
    var modeEl = $('novelCharShardMode');
    var chunk = $('novelCharChunkSize');
    var perCh = $('novelCharChaptersPerShard');
    var policy = $('novelCharConflictPolicy');
    if (idCheck) idCheck.checked = !!state.scanWithIdentity;
    if (stage) stage.checked = !!state.splitByStage;
    if (modeEl) modeEl.value = state.charShardMode === 'chapters' ? 'chapters' : 'chars';
    if (chunk) chunk.value = String(state.charChunkSize || 8000);
    if (perCh) perCh.value = String(state.charChaptersPerShard || 1);
    syncShardModeUi('novelChar', state.charShardMode);
    if (policy) policy.value = state.conflictPolicy || 'merge';
    if (!grid) return;
    if (!(state.characters || []).length) {
      grid.innerHTML = '<div class="novel-status-text">暂无人物。请先「小说分析」，或手动添加 / 扫描全书。</div>';
      return;
    }
    // 左：勾选 + 名称/状态；右：丰满/扩展 / 同步
    grid.innerHTML = state.characters.map(function(c) {
      var ent = findPersonEntityForChar(c);
      var enriched = ent ? isEntityEnriched(ent, !!state.strictQuality, getAdultMode(state)) : !!c.profile;
      var note = c.note || (c.profile ? '已扩展' : '待扩展');
      // 有档案或实体正文即可落卡
      var canSync = !!(c.profile || (ent && String(ent.content || ent.summary || '').trim()));
      var needExpand = !c.profile;
      return '<div class="novel-list-row" data-char-id="' + c.id + '">'
        + '<input type="checkbox" data-char-sel="' + c.id + '"' + (c.selected ? ' checked' : '') + ' />'
        + '<div class="novel-list-main">'
        + '<button type="button" class="novel-list-title" data-char-edit="' + c.id + '" title="查看/编辑档案">'
        + escapeHtml(c.name) + '</button>'
        + '<div>' + syncBadge(c.syncStatus)
        + (enriched ? '' : ' <span class="novel-sync-badge unsynced">待丰满</span>')
        + '</div>'
        + '<div class="novel-list-meta">' + escapeHtml(note).slice(0, 80)
        + ' · 出现约 ' + (c.hits || 0) + ' 段'
        + (c.aliases && c.aliases.length ? ' · 别名 ' + escapeHtml(c.aliases.join('、')) : '')
        + '</div></div>'
        + '<div class="novel-list-actions">'
        + (canSync
          ? iconBtn('data-char-sync-char="' + c.id + '"', '⇢', '同步到角色设定')
            + iconBtn('data-char-sync-wb="' + c.id + '"', '📖', '同步到世界书')
          : '')
        + (ent
          ? iconBtn(
            'data-char-enrich="' + escapeHtml(ent.id) + '"',
            '✦',
            enriched ? '重新丰满' : 'AI 丰满',
            enriched ? '' : 'btn-ai-expand'
          )
          : iconBtn(
            'data-char-expand="' + c.id + '"',
            '✦',
            needExpand ? 'AI 扩展（未扩展）' : 'AI 重写',
            needExpand ? 'btn-ai-expand' : ''
          ))
        + iconBtn('data-char-edit="' + c.id + '"', '✎', '编辑档案')
        + iconBtn('data-char-del="' + c.id + '"', '×', '删除', 'is-danger')
        + '</div></div>';
    }).join('');

    grid.querySelectorAll('[data-char-sel]').forEach(function(cb) {
      cb.addEventListener('change', function() {
        var id = cb.getAttribute('data-char-sel');
        state.characters = state.characters.map(function(c) {
          return c.id === id ? Object.assign({}, c, { selected: cb.checked }) : c;
        });
        var ent = (state.entities || []).find(function(e) { return e.id === id; })
          || findPersonEntityForChar(state.characters.find(function(c) { return c.id === id; }));
        if (ent) ent.selected = cb.checked;
        save();
      });
    });
    grid.querySelectorAll('[data-char-del]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-char-del');
        var ch = state.characters.find(function(c) { return c.id === id; });
        var ent = findPersonEntityForChar(ch);
        state.characters = state.characters.filter(function(c) { return c.id !== id; });
        if (ent) {
          state.entities = (state.entities || []).filter(function(e) { return e.id !== ent.id; });
          state.relations = (state.relations || []).filter(function(r) {
            return r.fromId !== ent.id && r.toId !== ent.id;
          });
        }
        save();
        renderAll();
      });
    });
    grid.querySelectorAll('[data-char-enrich]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        runAnalyzeEnrich({ ids: [btn.getAttribute('data-char-enrich')] }).catch(function(e) {
          if (!isTrackedAbort(e)) alert('丰满失败: ' + (e.message || e));
        });
      });
    });
    grid.querySelectorAll('[data-char-expand]').forEach(function(btn) {
      btn.addEventListener('click', function() { expandCharacter(btn.getAttribute('data-char-expand')); });
    });
    grid.querySelectorAll('[data-char-edit]').forEach(function(btn) {
      btn.addEventListener('click', function() { openProfileEditor(btn.getAttribute('data-char-edit')); });
    });
    grid.querySelectorAll('[data-char-sync-char]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        syncOutputs({ target: 'character', ids: [btn.getAttribute('data-char-sync-char')], selected: false });
        setStatus('novelCharStatus', '已同步到角色设定');
      });
    });
    grid.querySelectorAll('[data-char-sync-wb]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        syncOutputs({ target: 'character_worldbook', ids: [btn.getAttribute('data-char-sync-wb')], selected: false });
        setStatus('novelCharStatus', '已同步到世界书');
      });
    });
  }

  function renderWbFocus() {
    var box = $('novelWbFocusTags');
    if (!box) return;
    box.innerHTML = WB_FOCUS_OPTIONS.map(function(opt) {
      var active = (state.wbFocus || []).indexOf(opt.id) >= 0;
      return '<button type="button" class="novel-focus-tag' + (active ? ' active' : '') + '" data-wb-focus="' + opt.id + '">' + opt.label + '</button>';
    }).join('');
    box.querySelectorAll('[data-wb-focus]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-wb-focus');
        var idx = (state.wbFocus || []).indexOf(id);
        if (idx >= 0) state.wbFocus.splice(idx, 1);
        else state.wbFocus.push(id);
        save();
        renderWbFocus();
      });
    });
  }

  /** 策略 UI 标签（导出仍用 constant / selective） */
  function strategyLabelZh(strategy) {
    return strategy === 'constant' ? '常驻' : '可选';
  }

  function renderStrategyTag(strategy) {
    var s = strategy === 'constant' ? 'constant' : 'selective';
    var cls = s === 'constant' ? 'is-constant' : 'is-selective';
    return '<span class="wb-strategy-tag ' + cls + '">'
      + '<span class="wb-strategy-dot" aria-hidden="true"></span>'
      + escapeHtml(strategyLabelZh(s))
      + '</span>';
  }

  /** 弹窗表单字段（标题 / 触发词 / 内容 / 常驻·可选） */
  function renderWbEditorFields(index, entry, isNew) {
    var e = entry || {};
    var strategy = e.strategy || 'selective';
    return '<div class="novel-wb-inline" data-wb-editor="' + index + '">'
      + '<div class="form-group"><label>标题</label>'
      + '<input type="text" data-field="name" value="' + escapeHtml(e.name || '') + '" placeholder="条目标题" /></div>'
      + '<div class="form-group"><label>触发词（逗号分隔，空则常驻更合适）</label>'
      + '<input type="text" data-field="keys" value="' + escapeHtml((e.keys || []).join(', ')) + '" /></div>'
      + '<div class="form-group"><label>内容</label>'
      + '<textarea data-field="content" rows="8">' + escapeHtml(e.content || '') + '</textarea></div>'
      + '<div class="form-group"><label>触发策略</label>'
      + '<select data-field="strategy">'
      + '<option value="constant"' + (strategy === 'constant' ? ' selected' : '') + '>常驻</option>'
      + '<option value="selective"' + (strategy === 'selective' ? ' selected' : '') + '>可选</option>'
      + '</select></div>'
      + '</div>';
  }

  function readWbInlineEditor(root) {
    if (!root) return null;
    function val(f) {
      var el = root.querySelector('[data-field="' + f + '"]');
      return el ? el.value : '';
    }
    var name = val('name').trim();
    var keys = val('keys').split(/[,，]/).map(function(k) { return k.trim(); }).filter(Boolean);
    var strategy = val('strategy') || 'selective';
    return {
      name: name,
      content: val('content'),
      keys: keys,
      strategy: strategy,
      layer: strategy === 'constant' ? 'blue' : 'green',
    };
  }

  /** 打开新建/编辑弹窗 */
  function openWbEditModal(index, entry, isNew) {
    var titleEl = $('novelModalWbTitle');
    var bodyEl = $('novelModalWbBody');
    var saveBtn = $('btnNovelWbModalSave');
    if (!bodyEl) return;
    if (titleEl) titleEl.textContent = isNew ? '新建世界书条目' : '编辑世界书条目';
    if (saveBtn) saveBtn.textContent = isNew ? '保存新条目' : '保存';
    bodyEl.innerHTML = renderWbEditorFields(index, entry, isNew);
    openNovelModal('novelModalWb');
    setTimeout(function() {
      var input = bodyEl.querySelector('[data-field="name"]');
      if (input) input.focus();
    }, 0);
  }

  function editWbEntry(index) {
    if (editingWbIndex === index && !isCreatingWbEntry) {
      closeNovelModal('novelModalWb');
      return;
    }
    editingWbIndex = index;
    isCreatingWbEntry = false;
    openWbEditModal(index, state.wbEntries[index] || {}, false);
  }

  function saveWbInline(index) {
    var root = document.querySelector('[data-wb-editor="' + index + '"]');
    var patch = readWbInlineEditor(root);
    if (!patch || !patch.content.trim()) return alert('内容不能为空');
    var saved;
    if (index < 0) {
      var cat = 'setting';
      saved = {
        category: cat,
        name: patch.name || '未命名',
        content: patch.content,
        keys: patch.keys.length ? patch.keys : [patch.name || '未命名'],
        layer: patch.layer,
        comment: '[小说' + cat + '] ' + (patch.name || '未命名'),
        selected: true,
        syncStatus: 'unsynced',
        strategy: patch.strategy,
      };
      state.wbEntries.push(saved);
      isCreatingWbEntry = false;
    } else {
      var e = state.wbEntries[index];
      if (!e) return;
      e.name = patch.name || e.name;
      e.content = patch.content;
      e.keys = patch.keys.length ? patch.keys : [e.name];
      e.strategy = patch.strategy;
      e.layer = patch.layer;
      e.comment = '[小说' + (e.category || 'setting') + '] ' + e.name;
      e.syncStatus = e.syncStatus === 'synced' ? 'dirty' : (e.syncStatus || 'unsynced');
      saved = e;
    }
    // 草稿写回实体库，保持分析路径一致
    if (saved) {
      if (!state.entities) state.entities = [];
      var entType = wbCategoryToEntityType(saved.category);
      var attrs = {};
      if (entType === 'lore' && saved.category) attrs.aspect = saved.category;
      upsertEntity(state.entities, {
        type: entType,
        name: saved.name,
        aliases: [],
        summary: String(saved.content || '').slice(0, 120),
        content: saved.content,
        keys: saved.keys,
        layer: saved.layer,
        attrs: attrs,
      }, { source: 'manual' });
      projectEntitiesToLegacy(state);
    }
    editingWbIndex = -1;
    closeNovelModal('novelModalWb');
    save();
    renderAll();
    setStatus('novelWbStatus', '已保存条目');
  }

  function renderWb() {
    // 世界书名称改由角色设定 wbName 配置，本面板不再绑定
    var modeEl = $('novelWbShardMode');
    var chunk = $('novelWbChunkSize');
    var perCh = $('novelWbChaptersPerShard');
    var policy = $('novelWbConflictPolicy');
    var typeEl = $('novelWbTypeFilter');
    if (modeEl) modeEl.value = state.wbShardMode === 'chapters' ? 'chapters' : 'chars';
    if (chunk) chunk.value = String(state.wbChunkSize || 8000);
    if (perCh) perCh.value = String(state.wbChaptersPerShard || 1);
    syncShardModeUi('novelWb', state.wbShardMode);
    if (policy) policy.value = state.conflictPolicy || 'merge';
    if (typeEl && document.activeElement !== typeEl) typeEl.value = novelWbTypeFilter || '';
    renderWbFocus();

    var searchInput = $('novelWbSearchInput');
    var searchClear = $('novelWbSearchClear');
    if (searchInput && searchInput.value !== novelWbSearchQuery) {
      // 保持输入框与查询同步（避免重渲清空）
      if (document.activeElement !== searchInput) searchInput.value = novelWbSearchQuery;
    }
    if (searchClear) searchClear.style.display = novelWbSearchQuery ? '' : 'none';

    var prev = $('novelWbPreview');
    if (!prev) return;
    var q = String(novelWbSearchQuery || '').trim().toLowerCase();
    var html = '';
    if (!(state.wbEntries || []).length) {
      prev.innerHTML = '<div class="novel-status-text">暂无条目。请先「小说分析」，或 AI 抽取 / 新建。</div>';
      return;
    }
    state.wbEntries.forEach(function(e, i) {
      if (novelWbTypeFilter && (e.category || '') !== novelWbTypeFilter) return;
      var hay = ((e.name || '') + ' ' + (e.comment || '') + ' ' + (e.keys || []).join(' ') + ' ' + (e.content || '')).toLowerCase();
      if (q && hay.indexOf(q) < 0) return;
      var strategyBadge = renderStrategyTag(e.strategy);
      var needExpand = isUnexpandedWbContent(e.content);
      var ent = e.id
        ? (state.entities || []).find(function(x) { return x.id === e.id; })
        : findEntityMatch(state.entities, e.name, []);
      var enriched = ent ? isEntityEnriched(ent, !!state.strictQuality, getAdultMode(state)) : !needExpand;
      var previewLine = truncatePreviewLine(e.content);
      html += '<div class="entry-item fade-in" data-wb-index="' + i + '">'
        + '<div class="entry-item-header">'
        + '<input type="checkbox" data-wb-sel="' + i + '"' + (e.selected !== false ? ' checked' : '')
        + ' onclick="event.stopPropagation()" />'
        + '<div class="entry-info">'
        + '<div class="entry-info-title-row"><button type="button" class="novel-list-title" data-wb-edit="' + i + '" title="编辑条目">'
        + escapeHtml(e.name || e.comment || '未命名') + '</button>'
        + strategyBadge + syncBadge(e.syncStatus)
        + (enriched ? '' : ' <span class="novel-sync-badge unsynced">待丰满</span>')
        + '</div>'
        + (previewLine ? '<p class="entry-preview-line">' + escapeHtml(previewLine) + '</p>' : '')
        + '<p class="entry-meta-line">' + escapeHtml(e.category || '')
        + ' · ' + String(e.content || '').length + ' 字'
        + ((e.keys || []).length ? ' · 触发词 ' + escapeHtml((e.keys || []).slice(0, 4).join(', ')) : '')
        + '</p>'
        + '</div>'
        + '<div class="entry-actions">'
        + (ent
          ? iconBtn(
            'data-wb-enrich="' + escapeHtml(ent.id) + '"',
            '✦',
            enriched ? '重新丰满' : 'AI 丰满',
            enriched ? '' : 'btn-ai-expand'
          )
          : iconBtn(
            'data-wb-expand="' + i + '"',
            '✦',
            needExpand ? 'AI 扩展（未扩展）' : 'AI 重写',
            needExpand ? 'btn-ai-expand' : ''
          ))
        + iconBtn('data-wb-edit="' + i + '"', '✎', '编辑')
        + iconBtn('data-wb-sync="' + i + '"', '⇢', '同步到主世界书')
        + iconBtn('data-wb-del="' + i + '"', '×', '删除', 'is-danger')
        + '</div></div>'
        + '</div>';
    });
    prev.innerHTML = html || '<div class="novel-status-text">无匹配条目</div>';

    prev.querySelectorAll('[data-wb-sel]').forEach(function(cb) {
      cb.addEventListener('change', function() {
        var i = Number(cb.getAttribute('data-wb-sel'));
        if (state.wbEntries[i]) {
          state.wbEntries[i].selected = cb.checked;
          var ent = state.wbEntries[i].id
            ? (state.entities || []).find(function(x) { return x.id === state.wbEntries[i].id; })
            : findEntityMatch(state.entities, state.wbEntries[i].name, []);
          if (ent) ent.selected = cb.checked;
        }
        save();
      });
    });
    prev.querySelectorAll('[data-wb-edit]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        editWbEntry(Number(btn.getAttribute('data-wb-edit')));
      });
    });
    prev.querySelectorAll('[data-wb-enrich]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        runAnalyzeEnrich({ ids: [btn.getAttribute('data-wb-enrich')] }).catch(function(err) {
          if (!isTrackedAbort(err)) alert('丰满失败: ' + (err.message || err));
        });
      });
    });
    prev.querySelectorAll('[data-wb-expand]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        expandWbEntry(Number(btn.getAttribute('data-wb-expand')));
      });
    });
    prev.querySelectorAll('[data-wb-sync]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var i = Number(btn.getAttribute('data-wb-sync'));
        var entry = state.wbEntries[i];
        if (!entry) return;
        if (!window.__getWorldbookEntries__ || !window.__setWorldbookEntries__) {
          return alert('世界书环境未就绪');
        }
        var cur = window.__getWorldbookEntries__() || [];
        var r = applyDraftsToWorldbook(cur, [entry], state.conflictPolicy);
        window.__setWorldbookEntries__(r.entries);
        window.dispatchEvent(new Event('worldbook-changed'));
        window.dispatchEvent(new Event('card-builder-data-changed'));
        entry.syncStatus = 'synced';
        save();
        renderAll();
        setStatus('novelWbStatus', '已同步「' + (entry.name || '') + '」：新增 ' + r.added + ' / 更新 ' + r.updated + ' / 跳过 ' + r.skipped);
      });
    });
    prev.querySelectorAll('[data-wb-del]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var i = Number(btn.getAttribute('data-wb-del'));
        var entry = state.wbEntries[i];
        var entId = entry && entry.id;
        if (!entId && entry) {
          var hit = findEntityMatch(state.entities, entry.name, []);
          if (hit) entId = hit.id;
        }
        state.wbEntries.splice(i, 1);
        if (entId) {
          state.entities = (state.entities || []).filter(function(x) { return x.id !== entId; });
          state.relations = (state.relations || []).filter(function(r) {
            return r.fromId !== entId && r.toId !== entId;
          });
        }
        if (editingWbIndex === i) closeNovelModal('novelModalWb');
        else if (editingWbIndex > i) editingWbIndex--;
        save();
        renderAll();
      });
    });
  }

  function renderStyle() {
    var custom = $('novelStyleCustom');
    var text = $('novelStyleText');
    var chunk = $('novelStyleChunkSize');
    var policy = $('novelStyleConflictPolicy');
    var badge = $('novelStyleSyncBadge');
    if (custom) custom.value = state.styleCustomReq || '';
    if (text && document.activeElement !== text) text.value = state.styleText || '';
    if (chunk) chunk.value = String(state.styleChunkSize || 16000);
    if (policy) policy.value = state.conflictPolicy || 'merge';
    if (badge) {
      badge.className = 'novel-sync-badge ' + (state.styleSyncStatus || 'unsynced');
      badge.textContent = state.styleSyncStatus === 'synced' ? '已同步' : (state.styleSyncStatus === 'dirty' ? '有本地修改' : '未同步');
    }
  }

  /** 切换字数 / 前 N 章控件显隐 */
  function syncRangeModeUi(prefix, mode) {
    var charsWrap = $(prefix + 'CharLimitWrap');
    var chWrap = $(prefix + 'ChapterCountWrap');
    var isCh = mode === 'chapters';
    if (charsWrap) charsWrap.style.display = isCh ? 'none' : '';
    if (chWrap) chWrap.style.display = isCh ? '' : 'none';
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

  /** 小说分析面板：分片配置、RAG 状态、实体统计 */
  function renderAnalyze() {
    var modeEl = $('novelAnalyzeShardMode');
    var chunk = $('novelAnalyzeChunkSize');
    var perCh = $('novelAnalyzeChaptersPerShard');
    if (modeEl) modeEl.value = state.analyzeShardMode === 'chapters' ? 'chapters' : 'chars';
    if (chunk) chunk.value = String(state.analyzeChunkSize || 8000);
    if (perCh) perCh.value = String(state.analyzeChaptersPerShard || 1);
    syncShardModeUi('novelAnalyze', state.analyzeShardMode);

    var rag = state.rag || {};
    var ragInfo = $('novelRagIndexInfo');
    if (ragInfo) {
      var status = rag.indexStatus || 'idle';
      var stale = isRagIndexStale();
      var statusZh = status === 'ready'
        ? (stale ? '过期' : '就绪')
        : (status === 'building' ? '构建中' : (status === 'error' ? '失败' : '未建'));
      ragInfo.textContent = '索引：' + statusZh
        + (rag.chunkCount ? ' · ' + rag.chunkCount + ' 块' : '')
        + (rag.embedModel ? ' · ' + rag.embedModel : '')
        + (rag.indexUpdatedAt ? ' · ' + String(rag.indexUpdatedAt).slice(0, 19).replace('T', ' ') : '')
        + (stale && status === 'ready' ? ' · 章节已变，请重建' : '');
    }

    var failed = state.failedShards || [];
    var failInfo = $('novelFailedShardsInfo');
    var retryBtn = $('btnNovelRetryFailed');
    if (failInfo) {
      if (failed.length) {
        failInfo.style.display = '';
        failInfo.textContent = '失败 ' + failed.length + ' 项：'
          + failed.slice(0, 4).map(function(f) {
            return (f.phase || '?') + '/' + (f.label || f.entityId || f.shardIndex || '');
          }).join('；')
          + (failed.length > 4 ? '…' : '');
      } else {
        failInfo.style.display = 'none';
        failInfo.textContent = '';
      }
    }
    if (retryBtn) retryBtn.hidden = !failed.length;

    var counts = countEntitiesByType(state.entities);
    var relN = (state.relations || []).length;
    var enriched = (state.entities || []).filter(function(e) {
      return isEntityEnriched(e, !!state.strictQuality, getAdultMode(state));
    }).length;
    var summary = $('novelAnalyzeSummary');
    if (summary) {
      var parts = ENTITY_TYPES.filter(function(t) { return counts[t]; }).map(function(t) {
        return (ENTITY_TYPE_ZH[t] || t) + ' ' + counts[t];
      });
      summary.textContent = '实体 ' + ((state.entities || []).length) + '（已丰满 ' + enriched + '）'
        + (parts.length ? ' · ' + parts.join(' · ') : '')
        + ' · 关系 ' + relN
        + (failed.length ? ' · 失败 ' + failed.length : '');
    }
  }

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

  /** 关系图谱：统计 + G6 画布 + 选中详情（挂在小说分析面板） */
  function renderGraph() {
    var g = state.knowledgeGraph || emptyKnowledgeGraph();
    var n = (g.nodes || []).length;
    var e = (g.edges || []).length;
    var stats = $('novelGraphStats');
    if (stats) stats.textContent = '节点 ' + n + ' · 边 ' + e;

    var container = $('novelGraphCy');
    if (!container) return;
    graphCy = mountOrUpdateGraph(container, g, graphCy, {
      onSelect: function(payload) {
        var detail = $('novelGraphDetail');
        if (!detail) return;
        if (!payload) {
          detail.textContent = '点击节点或边查看详情';
          return;
        }
        if (payload.kind === 'node') {
          var attrs = payload.attrs || {};
          var attrKeys = Object.keys(attrs);
          var attrHtml = attrKeys.length
            ? '<ul class="novel-graph-attr-list">' + attrKeys.slice(0, 12).map(function(k) {
              return '<li><span>' + escapeHtml(k) + '</span> ' + escapeHtml(String(attrs[k])) + '</li>';
            }).join('') + '</ul>'
            : '';
          var typeZh = ENTITY_TYPE_ZH[payload.type] || payload.type || '';
          detail.innerHTML = '<strong>' + escapeHtml(payload.label || payload.id) + '</strong>'
            + ' <span class="novel-graph-type">' + escapeHtml(typeZh) + '</span>'
            + attrHtml;
          return;
        }
        var ev = (payload.evidence || []).slice(0, 3).map(function(x) { return escapeHtml(String(x)); }).join(' · ');
        detail.innerHTML = '<strong>' + escapeHtml(payload.source) + '</strong>'
          + ' → <em>' + escapeHtml(payload.label || 'related') + '</em> → '
          + '<strong>' + escapeHtml(payload.target) + '</strong>'
          + (ev ? '<div class="novel-graph-evidence">' + ev + '</div>' : '');
      },
    });
  }

  function syncInputsFromSource() {
    var src = $('novelSourceText');
    var ctx = $('novelContextText');
    if (src) state.sourceText = src.value;
    if (ctx) state.contextText = ctx.value;
    var mode = $('novelNarrativeMode');
    var conc = $('novelConcurrency');
    var budget = $('novelExpandBudget');
    var strict = $('novelStrictQuality');
    if (mode) state.narrativeMode = mode.value;
    if (conc) state.concurrency = Math.max(1, parseInt(conc.value, 10) || 3);
    if (budget) state.expandBudget = Math.max(1000, parseInt(budget.value, 10) || DEFAULT_EXPAND_BUDGET);
    if (strict) state.strictQuality = !!strict.checked;
    var globalAdult = $('novelGlobalAdult');
    var globalNtl = $('novelGlobalNtl');
    if (globalAdult) setAdultMode(state, !!globalAdult.checked);
    if (globalNtl) setNtlMode(state, !!globalNtl.checked);
    save();
    renderGates();
    renderSource();
  }

  function bindSource() {
    ['novelSourceText', 'novelContextText', 'novelNarrativeMode', 'novelConcurrency', 'novelExpandBudget', 'novelStrictQuality', 'novelGlobalAdult', 'novelGlobalNtl']
      .forEach(function(id) {
        var el = $(id);
        if (!el) return;
        el.addEventListener('change', syncInputsFromSource);
        el.addEventListener('input', syncInputsFromSource);
      });

    var fileEl = $('novelSourceFile');
    var drop = $('novelDropzone');
    function loadFile(f) {
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function(ev) {
        state.fileText = String(ev.target.result || '');
        state.fileMeta = { name: f.name };
        save();
        renderAll();
        setStatus('novelSourceStatus', '已导入 ' + f.name);
      };
      reader.readAsText(f);
    }
    if (fileEl) fileEl.addEventListener('change', function(e) { loadFile(e.target.files && e.target.files[0]); });
    if (drop) {
      drop.addEventListener('dragover', function(e) { e.preventDefault(); drop.classList.add('is-dragover'); });
      drop.addEventListener('dragleave', function() { drop.classList.remove('is-dragover'); });
      drop.addEventListener('drop', function(e) {
        e.preventDefault();
        drop.classList.remove('is-dragover');
        loadFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
      });
    }
    var clearBtn = $('btnNovelClearFile');
    if (clearBtn) clearBtn.addEventListener('click', function() {
      state.fileText = '';
      state.fileMeta = null;
      if (fileEl) fileEl.value = '';
      save();
      renderAll();
    });
    var reset = $('btnNovelResetAll');
    if (reset) reset.addEventListener('click', function() {
      // 文案与按钮「重置并清空结果」对齐；保留原文与分片等配置
      if (!confirm('重置并清空结果：清空章节/人物/世界书草稿/知识图谱/文风等产出，保留原文与分片等配置？')) return;
      var keep = {
        sourceText: state.sourceText,
        fileText: state.fileText,
        fileMeta: state.fileMeta,
        contextText: state.contextText,
        narrativeMode: state.narrativeMode,
        chunkSize: state.chunkSize,
        charShardMode: state.charShardMode,
        wbShardMode: state.wbShardMode,
        graphShardMode: state.graphShardMode,
        charChunkSize: state.charChunkSize,
        wbChunkSize: state.wbChunkSize,
        graphChunkSize: state.graphChunkSize,
        charChaptersPerShard: state.charChaptersPerShard,
        wbChaptersPerShard: state.wbChaptersPerShard,
        graphChaptersPerShard: state.graphChaptersPerShard,
        styleChunkSize: state.styleChunkSize,
        concurrency: state.concurrency,
        expandBudget: state.expandBudget,
        strictQuality: state.strictQuality,
        adultMode: !!state.adultMode,
        ntlMode: !!state.ntlMode,
        analyzeIncludeAdult: !!state.adultMode,
        includeAdult: !!state.adultMode,
        styleIncludeNSFW: !!state.adultMode,
      };
      state = Object.assign(createDefaultNovelState(), keep);
      save();
      renderAll();
    });
  }

  function bindChapters() {
    var splitMode = $('novelChapterSplitMode');
    if (splitMode) splitMode.addEventListener('change', function() {
      state.chapterSplitMode = splitMode.value;
      save();
    });
    var chunkEl = $('novelChunkSize');
    if (chunkEl) chunkEl.addEventListener('change', function() {
      state.chunkSize = parseInt(chunkEl.value, 10) || 8000;
      save();
    });
    var splitBtn = $('btnNovelSplitChapters');
    if (splitBtn) splitBtn.addEventListener('click', function() {
      syncInputsFromSource();
      if (chunkEl) state.chunkSize = parseInt(chunkEl.value, 10) || 8000;
      var full = getFullSourceText(state).trim();
      if (!full) return alert('请先导入原始资料');
      state.chapters = splitIntoChapters(full, {
        mode: state.chapterSplitMode || 'title',
        chunkSize: state.chunkSize || 8000,
      });
      save();
      renderAll();
      setStatus('novelChapterStatus', '已拆为 ' + state.chapters.length + ' 章');
    });

    function withSelected(fn) {
      var ids = selectedChapterIds();
      if (!ids.length) return alert('请先勾选章节');
      fn(ids);
      save();
      renderAll();
    }

    // 顶栏仅批量：合并 / 启停所选 / 导出选中 / 删除所选；单条操作在行内
    var mergeBtn = $('btnChMerge');
    if (mergeBtn) mergeBtn.addEventListener('click', function() {
      withSelected(function(ids) {
        if (ids.length < 2) return alert('请至少选择两章合并');
        state.chapters = mergeChapters(state.chapters, ids);
      });
    });
    var en = $('btnChEnable');
    if (en) en.addEventListener('click', function() {
      withSelected(function(ids) {
        ids.forEach(function(id) { state.chapters = setChapterEnabled(state.chapters, id, true); });
      });
    });
    var dis = $('btnChDisable');
    if (dis) dis.addEventListener('click', function() {
      withSelected(function(ids) {
        ids.forEach(function(id) { state.chapters = setChapterEnabled(state.chapters, id, false); });
      });
    });
    var exp = $('btnChExport');
    if (exp) exp.addEventListener('click', function() {
      downloadChapterMarkdown(exportSelectedChapters(state.chapters, selectedChapterIds()), 'novel-chapters.md');
    });
    var del = $('btnChDelete');
    if (del) del.addEventListener('click', function() {
      withSelected(function(ids) {
        var set = {};
        ids.forEach(function(id) { set[id] = true; });
        state.chapters = state.chapters.filter(function(c) { return !set[c.id]; });
      });
    });
  }

  function addCharactersByNames(names, note) {
    if (!state.entities) state.entities = [];
    (names || []).forEach(function(raw) {
      var name = String(raw || '').trim();
      if (!name) return;
      if (state.characters.some(function(c) { return c.name === name; })) return;
      upsertEntity(state.entities, {
        type: 'person',
        name: name,
        aliases: [],
        summary: note || '',
      }, { source: 'manual' });
    });
    projectEntitiesToLegacy(state);
  }

  /** 按 id/名定位人物 */
  function findCharacter(target) {
    var t = target || {};
    if (typeof t === 'string') t = { id: t, name: t };
    var id = t.id != null ? String(t.id) : '';
    var name = t.name != null ? String(t.name) : (t.titleMatch != null ? String(t.titleMatch) : '');
    if (id) {
      var byId = state.characters.find(function(c) { return c.id === id; });
      if (byId) return byId;
    }
    if (name) {
      var exact = state.characters.find(function(c) { return c.name === name; });
      if (exact) return exact;
      var q = name.toLowerCase();
      return state.characters.find(function(c) {
        return String(c.name || '').toLowerCase().indexOf(q) >= 0;
      }) || null;
    }
    return null;
  }

  /**
   * await 人物 AI 扩展/重写（附录1）；供 UI 与助手共用
   * @param {string|object} targetIdOrOpts
   * @param {{ mode?: string, instruction?: string, openEditor?: boolean, silent?: boolean, skipConfirm?: boolean }} [opts]
   */
  async function expandCharacter(targetIdOrOpts, opts) {
    var options = opts || {};
    var target = targetIdOrOpts;
    if (typeof targetIdOrOpts === 'string') target = { id: targetIdOrOpts };
    else if (targetIdOrOpts && (targetIdOrOpts.mode || targetIdOrOpts.instruction) && !targetIdOrOpts.id && !targetIdOrOpts.name) {
      options = targetIdOrOpts;
      target = { id: options.id, name: options.name };
    }
    var g = gates();
    if (!g.canExtract) {
      var reason = (g.reasons || []).join('\n') || '前置未完成';
      if (!options.silent) alert(reason);
      throw new Error(reason);
    }
    var ch = findCharacter(target);
    if (!ch) throw new Error('人物未找到（请用 id 或 name）');
    var mode = options.mode || 'expand';
    setStatus('novelCharStatus', '正在为「' + ch.name + '」匹配原文…');
    var adultOnExpand = getAdultMode(state);
    var ntlOnExpand = getNtlMode(state);
    var expandAliases = (ch.aliases || []).slice();
    // NSFW/NTL：辅助匹配词（仍以人名为准）
    if (adultOnExpand) {
      ['身体', '亲密', '情欲'].forEach(function(t) {
        if (expandAliases.indexOf(t) < 0) expandAliases.push(t);
      });
    }
    if (ntlOnExpand) {
      ['禁忌', '权力', '服从'].forEach(function(t) {
        if (expandAliases.indexOf(t) < 0) expandAliases.push(t);
      });
    }
    var recall = buildRecallPayload(
      state.chapters,
      ch.name,
      expandAliases,
      state.expandBudget || DEFAULT_EXPAND_BUDGET,
      180
    );
    if (!recall.snippetCount) {
      var miss = '未在启用章节中匹配到「' + ch.name + '」及其别名';
      setStatus('novelCharStatus', '未命中原文');
      if (!options.silent) alert(miss);
      throw new Error(miss);
    }
    var ok = await confirmExpandRecall({
      title: '人物 AI 扩展 · ' + ch.name,
      body: recall.body,
      totalChars: recall.totalChars,
      snippetCount: recall.snippetCount,
      truncated: recall.truncated,
      terms: recall.terms,
      silent: options.silent,
      skipConfirm: options.skipConfirm,
    });
    if (!ok) {
      setStatus('novelCharStatus', '已取消「' + ch.name + '」扩展');
      throw new DOMException('已取消', 'AbortError');
    }
    // 行内按钮 loading，防止重复点击
    var expandBtn = document.querySelector('[data-char-expand="' + ch.id + '"]');
    var expandOld = expandBtn ? expandBtn.innerHTML : '';
    if (expandBtn) {
      expandBtn.disabled = true;
      expandBtn.innerHTML = '…';
    }
    try {
      return await runTracked({
        type: 'novel_char_expand',
        title: mode === 'rewrite' ? '人物 AI 重写' : '人物 AI 扩展',
        target: ch.name,
      }, async function(task) {
        setStatus('novelCharStatus', '正在为「' + ch.name + '」' + (mode === 'rewrite' ? '重写' : '扩展') + '...');
        var head = promptText(
          'novelCharExpand',
          '你是小说人物档案专家。优先依据原文；原文未写明的字段须根据已有性格/外貌/关系等合理虚构补全，禁止留空或写「（原文未提及）」。只输出 JSON 对象。'
        );
        var modeHint = mode === 'rewrite'
          ? '\n【模式】重写：在原文与合理虚构上重建完整档案，可覆盖旧档案。'
          : (mode === 'patch'
            ? '\n【模式】定向修改：保留未提及字段，仅按要求改动。'
            : '\n【模式】扩写：在已有档案基础上补全空白与细节；空白处合理虚构。');
        var adultOn = getAdultMode(state);
        var user = head
          + modeHint
          + (options.instruction ? '\n【用户要求】' + options.instruction : '')
          + (ch.profile && mode !== 'rewrite' ? '\n【现有档案】\n' + JSON.stringify(ch.profile) : '')
          + (adultOn ? extractStyleNsfwSection(state.styleText) : '')
          + buildModeHintBlocks(state, 'expand')
          + (adultOn ? buildAdultContextDigests(state.entities, 2000) : '')
          + '\n\n角色名: ' + ch.name
          + '\n别名: ' + (ch.aliases || []).join('、')
          + buildContentModeFlags(state)
          + '\nContext: ' + (state.contextText || '')
          + '\n召回字数: ' + recall.totalChars + (recall.truncated ? '（已抽样截断）' : '')
          + '\n匹配词: ' + recall.terms.join('、')
          + '\n\n【原文片段】\n' + recall.body
          + '\n\n请输出附录1完整 JSON，字段须含: Chinese name, Nickname, age, gender, identity, key_events, relationships, turning_points, appearance, personality, values_and_drives, hidden_motives, goals, weakness, likes, dislikes, skills, speech_style, NSFW_information（含 body/erogenous_zones/sexual_personality/contrast/xp_kinks/sensitive_triggers/inner_erotic_thoughts/Sex_related_traits/Kinks/Limits）。'
          + (adultOn ? '\nAdultMode=true：NSFW_information 禁止整块「原文未提及」，须填 Limits 与 Kinks/xp_kinks；无原文则据已有档案推断。' : '');
        var text = await callAI(user, null, task.signal);
        var json = parseJsonLoose(text);
        var profile = normalizeCharacterProfile(json.profile || json, ch.name);
        if (mode === 'patch' && ch.profile) {
          profile = Object.assign({}, ch.profile, profile);
        }
        ch.profile = profile;
        ch.hits = recall.hitCount;
        ch.note = String(profile.identity && profile.identity[0] ? profile.identity[0] : '已 AI 扩展');
        ch.syncStatus = 'unsynced';
        if (typeof profile.Nickname === 'string') {
          ch.aliases = profile.Nickname.split(/[,，、]/).map(function(s) { return s.trim(); }).filter(Boolean);
        }
        // 回写实体库，避免仅 characters 有档案、投影后丢失
        if (!state.entities) state.entities = [];
        upsertEntity(state.entities, {
          type: 'person',
          name: ch.name,
          aliases: ch.aliases,
          summary: ch.note,
          attrs: { profile: profile },
          content: profileContentDigest(profile, ch.name),
        }, { source: 'expand' });
        projectEntitiesToLegacy(state);
        save();
        renderAll();
        if (options.openEditor !== false && !options.silent) openProfileEditor(ch.id);
        setStatus('novelCharStatus', '「' + ch.name + '」扩展完成（召回 ' + recall.totalChars + ' 字 / ' + recall.snippetCount + ' 片段）');
        return { id: ch.id, name: ch.name, mode: mode, recallChars: recall.totalChars };
      });
    } catch (e) {
      if (!isTrackedAbort(e)) {
        setStatus('novelCharStatus', '扩展失败: ' + e.message);
        if (!options.silent) alert('AI 扩展失败: ' + e.message);
      } else {
        setStatus('novelCharStatus', '已取消「' + ch.name + '」扩展');
      }
      throw e;
    } finally {
      if (expandBtn) {
        expandBtn.disabled = false;
        expandBtn.innerHTML = expandOld || '✦';
      }
    }
  }

  /**
   * 世界书条目 AI 扩展：标题/触发词匹配原文，按 expandBudget 召回后扩写 content
   * @param {number|object} indexOrOpts
   * @param {{ mode?: string, instruction?: string, silent?: boolean, skipConfirm?: boolean }} [opts]
   */
  async function expandWbEntry(indexOrOpts, opts) {
    var options = opts || {};
    var index = typeof indexOrOpts === 'number' ? indexOrOpts : Number(indexOrOpts && indexOrOpts.index);
    if (indexOrOpts && typeof indexOrOpts === 'object' && indexOrOpts.index == null && indexOrOpts.name) {
      options = Object.assign({}, options, indexOrOpts);
      index = (state.wbEntries || []).findIndex(function(e) {
        return e.name === indexOrOpts.name || e.comment === indexOrOpts.name;
      });
    }
    var g = gates();
    if (!g.canExtract) {
      var reason = (g.reasons || []).join('\n') || '前置未完成';
      if (!options.silent) alert(reason);
      throw new Error(reason);
    }
    var entry = state.wbEntries && state.wbEntries[index];
    if (!entry) throw new Error('世界书条目未找到');
    var mode = options.mode || 'expand';
    var matchName = entry.name || entry.comment || '';
    var matchKeys = Array.isArray(entry.keys) ? entry.keys : [];
    setStatus('novelWbStatus', '正在为「' + matchName + '」匹配原文…');
    var recall = buildRecallPayload(
      state.chapters,
      matchName,
      matchKeys,
      state.expandBudget || DEFAULT_EXPAND_BUDGET,
      180
    );
    if (!recall.snippetCount) {
      var miss = '未在启用章节中匹配到「' + matchName + '」及其触发词';
      setStatus('novelWbStatus', '未命中原文');
      if (!options.silent) alert(miss);
      throw new Error(miss);
    }
    var ok = await confirmExpandRecall({
      title: '世界书 AI 扩展 · ' + matchName,
      body: recall.body,
      totalChars: recall.totalChars,
      snippetCount: recall.snippetCount,
      truncated: recall.truncated,
      terms: recall.terms,
      silent: options.silent,
      skipConfirm: options.skipConfirm,
    });
    if (!ok) {
      setStatus('novelWbStatus', '已取消「' + matchName + '」扩展');
      throw new DOMException('已取消', 'AbortError');
    }
    var expandBtn = document.querySelector('[data-wb-expand="' + index + '"]');
    var expandOld = expandBtn ? expandBtn.innerHTML : '';
    if (expandBtn) {
      expandBtn.disabled = true;
      expandBtn.innerHTML = '…';
    }
    try {
      return await runTracked({
        type: 'novel_wb_expand',
        title: mode === 'rewrite' ? '世界书条目 AI 重写' : '世界书条目 AI 扩展',
        target: matchName,
      }, async function(task) {
        setStatus('novelWbStatus', '正在扩写「' + matchName + '」…');
        var head = promptText(
          'novelWbExpand',
          '你是小说世界书扩写专家。仅根据原文片段扩写条目描述，禁止臆造。只输出 JSON：{ "name", "content", "keys" }'
        );
        var modeHint = mode === 'rewrite'
          ? '\n【模式】重写：依据原文重建内容，可大幅改写。'
          : '\n【模式】扩写：在已有内容上补全细节，保留可靠事实。';
        var adultWbExp = getAdultMode(state);
        var user = head
          + modeHint
          + (options.instruction ? '\n【用户要求】' + options.instruction : '')
          + buildModeHintBlocks(state, 'expand')
          + (adultWbExp ? buildAdultContextDigests(state.entities, 1500) : '')
          + '\n条目标题: ' + matchName
          + '\n类别: ' + (entry.category || 'setting')
          + '\n现有触发词: ' + matchKeys.join('、')
          + (entry.content && mode !== 'rewrite' ? '\n【现有内容】\n' + entry.content : '')
          + (entry.attrs ? '\n【现有 attrs】\n' + JSON.stringify(entry.attrs) : '')
          + buildContentModeFlags(state)
          + '\nContext: ' + (state.contextText || '')
          + '\n召回字数: ' + recall.totalChars + (recall.truncated ? '（已抽样截断）' : '')
          + '\n匹配词: ' + recall.terms.join('、')
          + '\n\n【原文片段】\n' + recall.body
          + '\n\n请输出 JSON（AdultMode 时含 attrs.adult；NtlMode 时可含 attrs.ntl）。';
        var text = await callAI(user, null, task.signal);
        var json = parseJsonLoose(text);
        if (json.name) entry.name = String(json.name).trim() || entry.name;
        if (json.content) entry.content = String(json.content);
        if (Array.isArray(json.keys) && json.keys.length) {
          entry.keys = json.keys.map(function(k) { return String(k).trim(); }).filter(Boolean);
        }
        if (json.attrs && typeof json.attrs === 'object') {
          entry.attrs = Object.assign({}, entry.attrs || {}, json.attrs);
          if (json.attrs.adult) {
            entry.attrs.adult = mergeAdultAttrs(entry.attrs.adult, json.attrs.adult);
          }
        }
        entry.comment = '[小说' + (entry.category || 'setting') + '] ' + entry.name;
        entry.syncStatus = entry.syncStatus === 'synced' ? 'dirty' : (entry.syncStatus || 'unsynced');
        // 回写实体库（含成人维）
        if (!state.entities) state.entities = [];
        var wbType = wbCategoryToEntityType(entry.category);
        upsertEntity(state.entities, {
          type: wbType === 'nsfw' ? 'nsfw' : wbType,
          name: entry.name,
          content: entry.content,
          keys: entry.keys,
          summary: String(entry.content || '').slice(0, 80),
          attrs: entry.attrs || {},
          layer: entry.layer,
        }, { source: 'expand' });
        projectEntitiesToLegacy(state);
        save();
        renderAll();
        setStatus('novelWbStatus', '「' + entry.name + '」扩展完成（召回 ' + recall.totalChars + ' 字）');
        return { index: index, name: entry.name, mode: mode, recallChars: recall.totalChars };
      });
    } catch (e) {
      if (!isTrackedAbort(e)) {
        setStatus('novelWbStatus', '扩展失败: ' + e.message);
        if (!options.silent) alert('AI 扩展失败: ' + e.message);
      } else {
        setStatus('novelWbStatus', '已取消「' + matchName + '」扩展');
      }
      throw e;
    } finally {
      if (expandBtn) {
        expandBtn.disabled = false;
        expandBtn.innerHTML = expandOld || '✦';
      }
    }
  }

  /** 打开实体编辑弹窗 */
  function openEntityEditor(id) {
    var ent = (state.entities || []).find(function(e) { return e.id === id; });
    if (!ent) return;
    editingEntityId = id;
    var title = $('novelModalEntityTitle');
    var nameEl = $('novelEntityName');
    var typeEl = $('novelEntityType');
    var aliasesEl = $('novelEntityAliases');
    var sumEl = $('novelEntitySummary');
    var keysEl = $('novelEntityKeys');
    var contentEl = $('novelEntityContent');
    if (title) title.textContent = '编辑实体 · ' + ent.name;
    if (nameEl) nameEl.value = ent.name || '';
    if (typeEl) typeEl.value = ent.type || 'lore';
    if (aliasesEl) aliasesEl.value = (ent.aliases || []).join(', ');
    if (sumEl) sumEl.value = ent.summary || '';
    if (keysEl) keysEl.value = (ent.keys || []).join(', ');
    if (contentEl) contentEl.value = ent.content || '';
    openNovelModal('novelModalEntity');
  }

  /** 分析步进后刷新预览 */
  function flushAnalyzePreview() {
    projectEntitiesToLegacy(state);
    save();
    renderAnalyze();
    renderCharacters();
    renderWb();
    renderGraph();
  }

  /** 重建 RAG 索引（向量失败可 keywordOnly） */
  async function runBuildRagIndex(opts) {
    opts = opts || {};
    var cardId = boundCardId || currentCardId();
    if (!cardId) throw new Error('未绑定角色卡');
    var g = gates();
    if (!g.canExtract) throw new Error((g.reasons || []).join('\n') || '前置未完成');
    var api = getApiConfig();
    var btn = $('btnNovelRagIndex');
    busyFlags.ragIndex = true;
    setBtnBusy(btn, true, '建索引…');
    if (!state.rag) state.rag = {};
    state.rag.indexStatus = 'building';
    save();
    renderAnalyze();
    try {
      return await runTracked({
        type: 'novel_rag_index',
        title: '小说 RAG 索引',
        target: cardId,
      }, async function(task) {
        var result = await buildNovelRagIndex({
          cardId: cardId,
          chapters: state.chapters,
          apiUrl: api.apiUrl,
          apiKey: api.apiKey,
          embedModel: api.embedModel,
          signal: task.signal,
          keywordOnly: !!opts.keywordOnly,
          onProgress: function(ratio, label) {
            setStatus('novelAnalyzeStatus', label || '建索引…');
            if (window.__aiTaskCenter__ && task.id) {
              window.__aiTaskCenter__.setProgress(task.id, ratio, label || '');
            }
          },
        });
        state.rag.indexStatus = 'ready';
        state.rag.indexUpdatedAt = new Date().toISOString();
        state.rag.chunkCount = result.chunkCount || 0;
        state.rag.embedModel = (result.index && result.index.embedModel) || api.embedModel;
        state.rag.sourceFingerprint = chaptersSourceFingerprint(state.chapters);
        save();
        renderAnalyze();
        setStatus('novelAnalyzeStatus', '索引就绪 · ' + (result.mode || 'keyword') + ' · ' + (result.chunkCount || 0) + ' 块');
        return result;
      });
    } catch (e) {
      if (state.rag) state.rag.indexStatus = 'error';
      save();
      renderAnalyze();
      throw e;
    } finally {
      busyFlags.ragIndex = false;
      setBtnBusy(btn, false);
      renderGates();
    }
  }

  /**
   * Step1：骨架扫描（增量 upsert，禁止清空实体库）
   * @param {{ shardIndexes?: number[], clearFailed?: boolean }} [opts]
   */
  async function runAnalyzeSkeleton(opts) {
    opts = opts || {};
    var g = gates();
    if (!g.canExtract) throw new Error((g.reasons || []).join('\n') || '前置未完成');
    var shards = buildExtractShards(state.chapters, analyzeShardOpts());
    if (!shards.length) throw new Error('无启用章节文本可分析');
    var indexes = null;
    if (opts.shardIndexes && opts.shardIndexes.length) {
      indexes = opts.shardIndexes.filter(function(i) { return i >= 0 && i < shards.length; });
      if (!indexes.length) throw new Error('无有效失败片可重跑');
    }
    if (opts.clearFailed !== false && !indexes) clearFailedShards('skeleton');
    var queue = $('novelAnalyzeQueue');
    if (queue) queue.style.display = 'block';
    var btn = $('btnNovelAnalyzeSkeleton');
    busyFlags.analyzeSkeleton = true;
    setBtnBusy(btn, true, '骨架扫描…');
    var totalRuns = indexes ? indexes.length : shards.length;
    setStatus('novelAnalyzeStatus', '骨架扫描中（约 ' + totalRuns + ' 次）…');
    try {
      return await runTracked({
        type: 'novel_analyze_skeleton',
        title: indexes ? '骨架重跑失败片' : '小说骨架扫描',
        target: totalRuns + ' 次',
      }, async function(task) {
        var head = promptText('novelAnalyzeSkeleton', '输出 entities + relations 骨架 JSON');
        var totals = { add: 0, merge: 0, relAdd: 0, failed: 0 };
        var runList = indexes || shards.map(function(_, i) { return i; });
        for (var ri = 0; ri < runList.length; ri++) {
          var idx = runList[ri];
          if (task.signal && task.signal.aborted) throw new DOMException('已取消', 'AbortError');
          var shard = shards[idx];
          if (queue) {
            queue.textContent = '骨架 ' + (ri + 1) + '/' + runList.length
              + ' · 实体 ' + (state.entities || []).length;
          }
          var prior = buildSkeletonPriorBlock(state);
          var adultOn = getAdultMode(state);
          var user = head
            + prior
            + buildModeHintBlocks(state, 'skeleton')
            + (adultOn ? buildAdultContextDigests(state.entities, 2500) : '')
            + buildContentModeFlags(state)
            + '\nMode: ' + state.narrativeMode
            + '\nContext: ' + (state.contextText || '')
            + '\n【章节 ' + shard.chapterTitle + (shard.part > 1 ? ' · 片' + shard.part : '') + '】\n' + shard.text;
          try {
            var text = await callAI(user, null, task.signal);
            var parsed = parseJsonLoose(text);
            var st = applySkeletonResult(state, parsed);
            totals.add += st.add;
            totals.merge += st.merge;
            totals.relAdd += st.relAdd;
            // 重跑成功则去掉该片失败记录
            state.failedShards = (state.failedShards || []).filter(function(f) {
              return !(f.phase === 'skeleton' && f.shardIndex === idx);
            });
          } catch (e) {
            if (isTrackedAbort(e)) throw e;
            totals.failed++;
            pushFailedShard({
              phase: 'skeleton',
              shardIndex: idx,
              label: (shard.chapterTitle || '章') + (shard.part > 1 ? '#' + shard.part : ''),
              error: String(e.message || e),
            });
          }
          flushAnalyzePreview();
          if (window.__aiTaskCenter__ && task.id) {
            window.__aiTaskCenter__.setProgress(task.id, (ri + 1) / runList.length, (ri + 1) + '/' + runList.length);
          }
          setStatus('novelAnalyzeStatus', '骨架 ' + (ri + 1) + '/' + runList.length
            + ' · 实体 ' + (state.entities || []).length
            + (totals.failed ? ' · 失败 ' + totals.failed : ''));
        }
        setStatus('novelAnalyzeStatus', '骨架完成 · 实体 ' + (state.entities || []).length
          + '（+' + totals.add + '/合' + totals.merge + '）· 关系 +' + totals.relAdd
          + (totals.failed ? ' · 失败 ' + totals.failed : ''));
        renderAnalyze();
        return totals;
      });
    } catch (e) {
      if (isTrackedAbort(e)) setStatus('novelAnalyzeStatus', '⏹ 已取消骨架扫描');
      throw e;
    } finally {
      busyFlags.analyzeSkeleton = false;
      setBtnBusy(btn, false);
      if (queue) queue.style.display = 'none';
      updateExtractCallEstimates();
      renderGates();
      renderAnalyze();
    }
  }

  /** Step2：实体丰满（RAG 注入原文） */
  async function runAnalyzeEnrich(opts) {
    opts = opts || {};
    var g = gates();
    if (!g.canExtract) throw new Error((g.reasons || []).join('\n') || '前置未完成');
    var api = getApiConfig();
    var cardId = boundCardId || currentCardId();
    var queue = (state.entities || []).slice();
    if (opts.ids && opts.ids.length) {
      var want = {};
      opts.ids.forEach(function(id) { want[id] = true; });
      queue = queue.filter(function(e) { return want[e.id]; });
    } else {
      queue = listEntitiesNeedingEnrich(state.entities, state.strictQuality, getAdultMode(state));
    }
    if (!queue.length) {
      setStatus('novelAnalyzeStatus', '无待丰满实体');
      return { enriched: 0 };
    }
    if (opts.clearFailed !== false && !(opts.ids && opts.ids.length)) clearFailedShards('enrich');
    var btn = $('btnNovelAnalyzeEnrich');
    busyFlags.analyzeEnrich = true;
    setBtnBusy(btn, true, '丰满中…');
    setStatus('novelAnalyzeStatus', '实体丰满 ' + queue.length + ' 项…');
    var head = promptText('novelEnrichEntity', '单实体丰满 JSON');
    var done = 0;
    var failed = 0;
    try {
      return await runTracked({
        type: 'novel_analyze_enrich',
        title: '实体丰满化',
        target: queue.length + ' 项',
      }, async function(task) {
        for (var i = 0; i < queue.length; i++) {
          if (task.signal && task.signal.aborted) throw new DOMException('已取消', 'AbortError');
          var ent = queue[i];
          var live = (state.entities || []).find(function(e) { return e.id === ent.id; }) || ent;
          var adultOn = getAdultMode(state);
          var ntlOn = getNtlMode(state);
          var query = boostAdultSearchQuery(
            [live.name].concat(live.aliases || []).join(' '),
            adultOn,
            ntlOn
          );
          try {
            var search = await hybridSearch({
              chapters: state.chapters,
              query: query,
              cardId: cardId,
              budget: state.expandBudget || DEFAULT_EXPAND_BUDGET,
              apiUrl: api.apiUrl,
              apiKey: api.apiKey,
              embedModel: api.embedModel,
              signal: task.signal,
            });
            var related = pickRelatedEntities(state.entities, query, 8);
            var inject = buildRagInjectBlock(search, related, { entityBudget: 3000 });
            var styleNsfw = adultOn ? extractStyleNsfwSection(state.styleText) : '';
            var user = head
              + '\n\n' + inject
              + styleNsfw
              + buildModeHintBlocks(state, 'enrich')
              + (adultOn ? buildAdultContextDigests(state.entities, 3000) : '')
              + '\n\n【待丰满实体】\n'
              + JSON.stringify({
                type: live.type,
                name: live.name,
                aliases: live.aliases,
                summary: live.summary,
                attrs: live.attrs || {},
              }, null, 2)
              + buildContentModeFlags(state)
              + '\nStrictQuality: ' + (!!state.strictQuality)
              + '\nContext: ' + (state.contextText || '');
            var text = await callAI(user, null, task.signal);
            var parsed = parseJsonLoose(text);
            applyEnrichResult(state, live.id, parsed);
            done++;
            state.failedShards = (state.failedShards || []).filter(function(f) {
              return !(f.phase === 'enrich' && f.entityId === live.id);
            });
          } catch (e) {
            if (isTrackedAbort(e)) throw e;
            failed++;
            pushFailedShard({
              phase: 'enrich',
              entityId: live.id,
              label: live.name,
              error: String(e.message || e),
            });
          }
          flushAnalyzePreview();
          if (window.__aiTaskCenter__ && task.id) {
            window.__aiTaskCenter__.setProgress(task.id, (i + 1) / queue.length, (i + 1) + '/' + queue.length);
          }
          setStatus('novelAnalyzeStatus', '丰满 ' + (i + 1) + '/' + queue.length + ' · ' + live.name
            + (failed ? ' · 失败 ' + failed : ''));
        }
        setStatus('novelAnalyzeStatus', '丰满完成 · ' + done + '/' + queue.length
          + (failed ? ' · 失败 ' + failed : ''));
        setStatus('novelCharStatus', '已丰满 ' + done + ' 项');
        setStatus('novelWbStatus', '已丰满 ' + done + ' 项');
        renderAnalyze();
        return { enriched: done, total: queue.length, failed: failed };
      });
    } catch (e) {
      if (isTrackedAbort(e)) setStatus('novelAnalyzeStatus', '⏹ 已取消丰满');
      throw e;
    } finally {
      busyFlags.analyzeEnrich = false;
      setBtnBusy(btn, false);
      updateExtractCallEstimates();
      renderGates();
      renderAnalyze();
    }
  }

  /** 仅重跑失败的骨架片 / 丰满实体 */
  async function runRetryFailedShards() {
    var failed = (state.failedShards || []).slice();
    if (!failed.length) {
      setStatus('novelAnalyzeStatus', '无失败项');
      return { retried: 0 };
    }
    var skIdx = failed.filter(function(f) { return f.phase === 'skeleton'; })
      .map(function(f) { return f.shardIndex; })
      .filter(function(i) { return typeof i === 'number'; });
    var enIds = failed.filter(function(f) { return f.phase === 'enrich' && f.entityId; })
      .map(function(f) { return f.entityId; });
    var out = { skeleton: null, enrich: null };
    if (skIdx.length) {
      out.skeleton = await runAnalyzeSkeleton({ shardIndexes: skIdx, clearFailed: false });
    }
    if (enIds.length) {
      out.enrich = await runAnalyzeEnrich({ ids: enIds, clearFailed: false });
    }
    setStatus('novelAnalyzeStatus', '失败项重跑完成'
      + (skIdx.length ? ' · 骨架 ' + skIdx.length : '')
      + (enIds.length ? ' · 丰满 ' + enIds.length : ''));
    renderAnalyze();
    return out;
  }

  /** Step3：关系补全 */
  async function runAnalyzeRelations() {
    var g = gates();
    if (!g.canExtract) throw new Error((g.reasons || []).join('\n') || '前置未完成');
    if (!(state.entities || []).length) throw new Error('请先运行骨架扫描');
    var api = getApiConfig();
    var cardId = boundCardId || currentCardId();
    busyFlags.analyzeRelations = true;
    setStatus('novelAnalyzeStatus', '关系补全中…');
    try {
      return await runTracked({
        type: 'novel_analyze_relations',
        title: '关系补全',
        target: '1 次',
      }, async function(task) {
        var adultOn = getAdultMode(state);
        var ntlOn = getNtlMode(state);
        var sampleNames = (state.entities || []).slice(0, 24).map(function(e) { return e.name; }).join('、');
        var search = await hybridSearch({
          chapters: state.chapters,
          query: boostAdultSearchQuery(sampleNames, adultOn, ntlOn),
          cardId: cardId,
          budget: state.expandBudget || DEFAULT_EXPAND_BUDGET,
          apiUrl: api.apiUrl,
          apiKey: api.apiKey,
          embedModel: api.embedModel,
          signal: task.signal,
        });
        var prior = buildSkeletonPriorBlock(state);
        var inject = buildRagInjectBlock(search, state.entities.slice(0, 20), { entityBudget: 4000 });
        var head = promptText('novelAnalyzeRelations', '补全 relations JSON');
        var user = head
          + prior
          + buildModeHintBlocks(state, 'relations')
          + (adultOn ? buildAdultContextDigests(state.entities, 2000) : '')
          + '\n\n' + inject
          + buildContentModeFlags(state)
          + '\nContext: ' + (state.contextText || '');
        var text = await callAI(user, null, task.signal);
        var parsed = parseJsonLoose(text);
        var st = applySkeletonResult(state, { relations: parsed.relations || parsed.edges || [] });
        flushAnalyzePreview();
        setStatus('novelAnalyzeStatus', '关系补全完成 · +' + st.relAdd + ' 条');
        return st;
      });
    } catch (e) {
      if (isTrackedAbort(e)) setStatus('novelAnalyzeStatus', '⏹ 已取消关系补全');
      throw e;
    } finally {
      busyFlags.analyzeRelations = false;
      renderGates();
    }
  }

  /** 完整分析：索引（过期才建）→ 骨架 → 丰满 → 关系 */
  async function runAnalyzeAll() {
    var g = gates();
    if (!g.canExtract) throw new Error((g.reasons || []).join('\n') || '前置未完成');
    var btn = $('btnNovelAnalyzeAll');
    busyFlags.analyzeAll = true;
    setBtnBusy(btn, true, '完整分析…');
    try {
      clearFailedShards();
      if (isRagIndexStale()) {
        setStatus('novelAnalyzeStatus', 'Step0 · 建索引…');
        try {
          await runBuildRagIndex({});
        } catch (e) {
          if (isTrackedAbort(e)) throw e;
          setStatus('novelAnalyzeStatus', '向量索引失败，降级关键词…');
          await runBuildRagIndex({ keywordOnly: true });
        }
      } else {
        setStatus('novelAnalyzeStatus', 'Step0 · 索引仍有效，跳过重建');
      }
      setStatus('novelAnalyzeStatus', 'Step1 · 骨架扫描…');
      await runAnalyzeSkeleton();
      setStatus('novelAnalyzeStatus', 'Step2 · 实体丰满…');
      await runAnalyzeEnrich({});
      setStatus('novelAnalyzeStatus', 'Step3 · 关系补全…');
      await runAnalyzeRelations();
      setStatus('novelAnalyzeStatus', '完整分析完成'
        + ((state.failedShards || []).length ? '（有 ' + state.failedShards.length + ' 项失败可重跑）' : ''));
      return {
        entityCount: (state.entities || []).length,
        relationCount: (state.relations || []).length,
        failed: (state.failedShards || []).length,
      };
    } finally {
      busyFlags.analyzeAll = false;
      setBtnBusy(btn, false);
      updateExtractCallEstimates();
      renderGates();
    }
  }

  /** await 人物扫描（逐步分片，每步注入已扫描参考并刷新列表预览）；侧栏任务中心可停 */
  async function runScanCharacters() {
    var g = gates();
    if (!g.canExtract) throw new Error((g.reasons || []).join('\n') || '前置未完成');
    var shards = buildExtractShards(state.chapters, charShardOpts());
    if (!shards.length) throw new Error('无启用章节文本可扫描');
    setStatus('novelCharStatus', '逐步扫描人物中（约 ' + shards.length + ' 次）...');
    var scanBtn = $('btnCharScan');
    busyFlags.charScan = true;
    setBtnBusy(scanBtn, true, '扫描中…');
    try {
      return await runTracked({
        type: 'novel_char_scan',
        title: '人物扫描',
        target: shards.length + ' 次',
      }, async function(task) {
        var head = promptText(
          'novelCharScan',
          '从文本中抽取出场人物与别名。只输出 JSON：{ "characters": [ { "name": "准确称呼", "aliases": ["别名"], "identity": "一句话身份", "stage": "" } ] }。不要虚构路人。'
        );
        // 本轮累积列表：逐步注入参考；每步 flush 到 state 供预览
        var scanAccum = (state.characters || []).map(function(c) {
          return { name: c.name, aliases: (c.aliases || []).slice(), note: c.note || '', hits: c.hits || 0 };
        });

        function upsertScanHit(item) {
          if (!item || !item.name) return;
          var name = String(item.name || item.Chinese_name || '').trim();
          if (!name) return;
          var note = item.identity || '';
          if (state.splitByStage && item.stage) {
            name = name + '（' + item.stage + '）';
            note = (item.stage + ' · ') + note;
          }
          var aliases = normalizeNameList(name, item.aliases);
          var existing = scanAccum.find(function(c) { return c.name === name; });
          if (existing) {
            existing.hits = (existing.hits || 0) + 1;
            if (note && (!existing.note || String(note).length > String(existing.note).length)) {
              existing.note = note;
            }
            existing.aliases = Array.from(new Set((existing.aliases || []).concat(aliases)));
          } else {
            scanAccum.push({
              name: name,
              aliases: aliases,
              note: note,
              hits: 1,
            });
          }
        }

        /** 把累积结果写回 state 并刷新列表（过程中可预览） */
        function flushScanPreview() {
          scanAccum.forEach(function(hit) {
            var existing = state.characters.find(function(c) { return c.name === hit.name; });
            if (existing) {
              existing.hits = Math.max(existing.hits || 0, hit.hits || 0);
              if (hit.note && (!existing.note || String(hit.note).length > String(existing.note || '').length)) {
                existing.note = hit.note;
              }
              existing.aliases = Array.from(new Set((existing.aliases || []).concat(hit.aliases || [])));
            } else {
              state.characters.push({
                id: uid('char'),
                name: hit.name,
                aliases: hit.aliases || [],
                note: hit.note || '',
                hits: hit.hits || 1,
                selected: false,
                profile: null,
                syncStatus: 'unsynced',
              });
            }
          });
          // 降级扫描结果投影到统一实体库
          ingestLegacyIntoEntities(state, 'legacy_scan');
          projectEntitiesToLegacy(state);
          save();
          renderAll();
        }

        for (var idx = 0; idx < shards.length; idx++) {
          if (task.signal && task.signal.aborted) throw new DOMException('已取消', 'AbortError');
          var shard = shards[idx];
          var priorRef = formatPriorCharScanRef(scanAccum);
          var user = head
            + priorRef
            + '\nMode: ' + state.narrativeMode
            + '\n需要身份说明: ' + (!!state.scanWithIdentity)
            + '\n按阶段拆分: ' + (!!state.splitByStage)
            + '\nContext: ' + (state.contextText || '')
            + '\n【章节 ' + shard.chapterTitle + (shard.part > 1 ? ' · 片' + shard.part : '') + '】\n' + shard.text;
          try {
            var text = await callAI(user, null, task.signal);
            var parsed = parseJsonLoose(text);
            (parsed.characters || []).forEach(upsertScanHit);
          } catch (e) {
            if (isTrackedAbort(e)) throw e;
          }
          flushScanPreview();
          if (window.__aiTaskCenter__ && task.id) {
            window.__aiTaskCenter__.setProgress(task.id, (idx + 1) / shards.length, (idx + 1) + '/' + shards.length);
          }
          setStatus('novelCharStatus', '扫描中 ' + (idx + 1) + '/' + shards.length + ' · 已发现 ' + state.characters.length + ' 人');
        }

        setStatus('novelCharStatus', '扫描完成，当前 ' + state.characters.length + ' 人（' + shards.length + ' 步）');
        return { characterCount: state.characters.length, shardsScanned: shards.length };
      });
    } catch (e) {
      if (isTrackedAbort(e)) setStatus('novelCharStatus', '⏹ 已取消扫描');
      throw e;
    } finally {
      busyFlags.charScan = false;
      setBtnBusy(scanBtn, false);
      updateExtractCallEstimates();
      renderGates();
    }
  }

  /** await 世界书抽取（逐步分片，每步注入已抽取参考并刷新列表预览）；侧栏任务中心可停 */
  async function runExtractWorldbook() {
    var g = gates();
    if (!g.canExtract) throw new Error((g.reasons || []).join('\n') || '前置未完成');
    if (!(state.wbFocus || []).length) throw new Error('请至少勾选一类内容');
    var shards = buildExtractShards(state.chapters, wbShardOpts());
    if (!shards.length) throw new Error('无启用章节文本可抽取');
    setStatus('novelWbStatus', '逐步抽取世界书中（约 ' + shards.length + ' 次）...');
    var queue = $('novelWbQueue');
    if (queue) queue.style.display = 'block';
    var extractBtn = $('btnWbExtract');
    busyFlags.wbExtract = true;
    setBtnBusy(extractBtn, true, '抽取中…');
    try {
      return await runTracked({
        type: 'novel_wb_extract',
        title: '世界书条目抽取',
        target: shards.length + ' 次 · ' + ((state.wbFocus || []).join(',') || ''),
      }, async function(task) {
        var head = promptText(
          'novelWbExtract',
          '从小说片段抽取非人物世界书事实。禁止输出人物角色卡。keys 尽量挖全。只输出 JSON：{ "entries": [ { "category": "worldview|faction|location|setting|history|item|nsfw", "name": "...", "content": "...", "keys": ["..."], "layer": "green|blue" } ] }'
        );
        var all = (state.wbEntries || []).map(function(e) {
          return {
            category: e.category,
            name: e.name,
            content: e.content,
            keys: e.keys,
            layer: e.layer,
          };
        });

        /** 每步刷到列表并投影实体库（增量，不清空已有） */
        function flushWbPreview() {
          var prevByKey = {};
          (state.wbEntries || []).forEach(function(e) {
            prevByKey[(e.category || 'setting') + '::' + e.name] = e;
          });
          state.wbEntries = all.map(function(e) {
            var k = (e.category || 'setting') + '::' + e.name;
            return toWbDraftEntry(e, prevByKey[k]);
          });
          ingestLegacyIntoEntities(state, 'legacy_wb');
          projectEntitiesToLegacy(state);
          save();
          renderAll();
        }

        for (var idx = 0; idx < shards.length; idx++) {
          if (task.signal && task.signal.aborted) throw new DOMException('已取消', 'AbortError');
          var shard = shards[idx];
          if (queue) queue.textContent = '进度 ' + (idx + 1) + '/' + shards.length + ' · 已 ' + all.length + ' 条';
          var priorRef = formatPriorWbExtractRef(all);
          var adultWb = getAdultMode(state);
          var user = head
            + priorRef
            + buildModeHintBlocks(state, 'extract')
            + (adultWb ? buildAdultContextDigests(state.entities, 2000) : '')
            + '\nFocus: ' + (state.wbFocus || []).join(',')
            + buildContentModeFlags(state)
            + '\nMode: ' + state.narrativeMode
            + '\nContext: ' + (state.contextText || '')
            + '\n【章节 ' + shard.chapterTitle + (shard.part > 1 ? ' · 片' + shard.part : '') + '】\n' + shard.text;
          try {
            var text = await callAI(user, null, task.signal);
            var json = parseJsonLoose(text);
            (json.entries || []).forEach(function(e) { mergeWbExtractEntry(all, e); });
          } catch (e) {
            if (isTrackedAbort(e)) throw e;
          }
          flushWbPreview();
          if (window.__aiTaskCenter__ && task.id) {
            window.__aiTaskCenter__.setProgress(task.id, (idx + 1) / shards.length, (idx + 1) + '/' + shards.length);
          }
          setStatus('novelWbStatus', '抽取中 ' + (idx + 1) + '/' + shards.length + ' · 已 ' + state.wbEntries.length + ' 条');
        }
        setStatus('novelWbStatus', '已生成 ' + state.wbEntries.length + ' 条草稿（' + shards.length + ' 步）');
        return { draftCount: state.wbEntries.length, shardsScanned: shards.length };
      });
    } catch (e) {
      if (isTrackedAbort(e)) setStatus('novelWbStatus', '⏹ 已取消抽取');
      throw e;
    } finally {
      busyFlags.wbExtract = false;
      setBtnBusy(extractBtn, false);
      if (queue) queue.style.display = 'none';
      updateExtractCallEstimates();
      renderGates();
    }
  }

  /** 生成角色设定并直接写入当前卡（优先实体 + RAG） */
  async function runGenerateCharSetup() {
    var g = gates();
    if (!g.canExtract) throw new Error((g.reasons || []).join('\n') || '前置未完成');
    if (!isAiConfigured()) {
      setAiTip('novelSetupAiTip', '未配置 AI，请先到「AI 配置」选择模型');
      throw new Error('未配置 AI 模型（请先到「AI 配置」）');
    }
    var charName = String(state.setupCharName || '').trim();
    if (!charName) throw new Error('请先填写角色名称');

    setStatus('novelSetupStatus', '准备原文…');
    var btn = $('btnNovelGenCharSetup');
    busyFlags.charSetup = true;
    setBtnBusy(btn, true, '生成中…');
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
        if (meta) {
          meta.textContent = (corpus.source === 'rag' ? 'RAG 召回 ' : '范围截取 ')
            + corpus.charCount + ' 字 · ' + (corpus.chapterCount || 0)
            + (corpus.entity ? ' 章 · 实体 ' + corpus.entity.name : ' 章');
        }
        if (prev) prev.textContent = corpus.text;
        var head = promptText(
          'novelCharSetup',
          '你是 SillyTavern 角色卡写手。仅根据提供的小说原文，为指定角色生成角色设定。只输出 JSON：{ charName, wbName, charDesc, creatorNotes }'
        );
        var user = head
          + '\n角色名称: ' + charName
          + (corpus.entity ? '\n实体摘要: ' + String(corpus.entity.summary || '').slice(0, 200) : '')
          + '\nContext: ' + (state.contextText || '无')
          + '\n\n【原文】\n' + corpus.text;
        var text = await callAI(user, null, task.signal);
        var data = parseJsonLoose(text);
        var fields = {
          charName: String(data.charName || charName).trim() || charName,
          wbName: String(data.wbName || '').trim(),
          charDesc: String(data.charDesc || '').trim(),
          creatorNotes: String(data.creatorNotes || '').trim(),
        };
        if (!fields.charDesc) throw new Error('模型未返回角色描述');
        setCharacterFields(fields);
        setStatus('novelSetupStatus', '已写入当前卡：' + fields.charName
          + '（描述 ' + fields.charDesc.length + ' 字 · 语料 ' + corpus.source + '）');
        return {
          charName: fields.charName,
          descLen: fields.charDesc.length,
          corpusChars: corpus.charCount,
          corpusSource: corpus.source,
        };
      });
    } catch (e) {
      if (isTrackedAbort(e)) setStatus('novelSetupStatus', '⏹ 已取消生成');
      throw e;
    } finally {
      busyFlags.charSetup = false;
      setBtnBusy(btn, false);
      renderGates();
    }
  }

  /** 生成开场白并写入 first_mes + alternate_greetings（优先实体 + RAG） */
  async function runGenerateGreetings() {
    var g = gates();
    if (!g.canExtract) throw new Error((g.reasons || []).join('\n') || '前置未完成');
    if (!isAiConfigured()) {
      setAiTip('novelGreetAiTip', '未配置 AI，请先到「AI 配置」选择模型');
      throw new Error('未配置 AI 模型（请先到「AI 配置」）');
    }
    var charName = String(state.greetCharName || state.setupCharName || '').trim();
    if (!charName) throw new Error('请先填写角色名称');
    var total = Math.max(1, Math.min(12, Number(state.greetCount) || 3));
    var altCount = Math.max(0, total - 1);

    setStatus('novelGreetStatus', '准备原文…');
    var btn = $('btnNovelGenGreetings');
    busyFlags.greetings = true;
    setBtnBusy(btn, true, '生成中…');
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
        if (meta) {
          meta.textContent = (corpus.source === 'rag' ? 'RAG 召回 ' : '范围截取 ')
            + corpus.charCount + ' 字 · ' + (corpus.chapterCount || 0)
            + (corpus.entity ? ' 章 · 实体 ' + corpus.entity.name : ' 章');
        }
        if (prev) prev.textContent = corpus.text;
        var headTpl = promptText(
          'novelGreetingsGen',
          '你是 SillyTavern 开场白写手。只输出 JSON：{ "firstMes":"...", "altGreetings":[...] }，altGreetings 长度必须刚好为 {{altCount}}。'
        );
        var head = applyTemplate(headTpl, { altCount: altCount });
        var user = head
          + '\n角色名称: ' + charName
          + (corpus.entity ? '\n实体摘要: ' + String(corpus.entity.summary || '').slice(0, 200) : '')
          + '\n开场白总数: ' + total + '（主开场 1 + 备选 ' + altCount + '）'
          + '\nContext: ' + (state.contextText || '无')
          + '\n\n【原文】\n' + corpus.text;
        var text = await callAI(user, null, task.signal);
        var data = parseJsonLoose(text);
        var firstMes = String(data.firstMes || data.first_mes || '').trim();
        var alts = Array.isArray(data.altGreetings)
          ? data.altGreetings
          : (Array.isArray(data.alternate_greetings) ? data.alternate_greetings : []);
        alts = alts.map(function(s) { return String(s || '').trim(); }).filter(Boolean);
        while (alts.length < altCount) alts.push('');
        if (alts.length > altCount) alts = alts.slice(0, altCount);
        if (!firstMes) throw new Error('模型未返回主开场白');
        setGreetingFields(firstMes, alts);
        setStatus('novelGreetStatus', '已写入当前卡：主开场 + 备选 ' + alts.length
          + ' 条 · 语料 ' + corpus.source);
        return {
          firstMesLen: firstMes.length,
          altCount: alts.length,
          corpusChars: corpus.charCount,
          corpusSource: corpus.source,
        };
      });
    } catch (e) {
      if (isTrackedAbort(e)) setStatus('novelGreetStatus', '⏹ 已取消生成');
      throw e;
    } finally {
      busyFlags.greetings = false;
      setBtnBusy(btn, false);
      renderGates();
    }
  }

  /** await 文风蒸馏；侧栏任务中心可停 */
  async function runDistillStyle() {
    var g = gates();
    if (!g.canExtract) throw new Error((g.reasons || []).join('\n') || '前置未完成');
    setStatus('novelStyleStatus', '蒸馏中...');
    var styleBtn = $('btnStyleDistill');
    busyFlags.styleDistill = true;
    setBtnBusy(styleBtn, true, '蒸馏中…');
    try {
      return await runTracked({
        type: 'novel_style',
        title: '文风蒸馏',
        target: '',
      }, async function(task) {
        if (task.signal && task.signal.aborted) throw new DOMException('已取消', 'AbortError');
        var chapters = state.chapters.filter(function(c) { return c.enabled !== false; });
        var sample = [];
        var budget = Math.max(4000, state.styleChunkSize || 16000);
        var step = Math.max(1, Math.floor(chapters.length / 6));
        var sliceLen = Math.min(4000, Math.floor(budget / 4) || 2000);
        for (var i = 0; i < chapters.length && sample.join('').length < budget; i += step) {
          if (task.signal && task.signal.aborted) throw new DOMException('已取消', 'AbortError');
          sample.push('【' + chapters[i].title + '】\n' + chapters[i].text.slice(0, sliceLen));
        }
        var head = promptText(
          'novelStyleDistill',
          '你是文风分析师。根据样章抽象写作风格（视角、句式、用词、节奏、情感表达），产出可复用的「文风提示词」。不要抄袭原文句子。输出 Markdown 纯文本。'
        );
        var adultOn = getAdultMode(state);
        var user = head
          + buildContentModeFlags(state)
          + '\n包含情欲文风: ' + adultOn
          + '\n自定义要求: ' + (state.styleCustomReq || '无')
          + '\nContext: ' + (state.contextText || '')
          + buildModeHintBlocks(state, 'style')
          + (adultOn ? buildAdultContextDigests(state.entities, 4000) : '')
          + '\n\n【样章】\n' + sample.join('\n\n');
        var out = await callAI(user, null, task.signal);
        state.styleText = out.trim();
        state.styleSyncStatus = 'unsynced';
        save();
        renderAll();
        setStatus('novelStyleStatus', '蒸馏完成');
        return { styleLen: state.styleText.length };
      });
    } catch (e) {
      if (isTrackedAbort(e)) setStatus('novelStyleStatus', '⏹ 已取消蒸馏');
      throw e;
    } finally {
      busyFlags.styleDistill = false;
      setBtnBusy(styleBtn, false);
      renderGates();
    }
  }

  /** 章节补丁（合并/启停/调序/删/重命名/拆分） */
  function patchChapters(opts) {
    opts = opts || {};
    var action = String(opts.action || '');
    var ids = Array.isArray(opts.ids) ? opts.ids.slice() : [];
    if (opts.id) ids.push(opts.id);
    if (action === 'merge') {
      if (ids.length < 2) throw new Error('合并至少需要两章 id');
      state.chapters = mergeChapters(state.chapters, ids);
    } else if (action === 'enable' || action === 'disable') {
      ids.forEach(function(id) {
        state.chapters = setChapterEnabled(state.chapters, id, action === 'enable');
      });
    } else if (action === 'delete') {
      var drop = {};
      ids.forEach(function(id) { drop[id] = true; });
      state.chapters = state.chapters.filter(function(c) { return !drop[c.id]; });
    } else if (action === 'rename') {
      if (!ids[0] || opts.title == null) throw new Error('rename 需要 id 与 title');
      state.chapters = renameChapter(state.chapters, ids[0], String(opts.title));
    } else if (action === 'move') {
      var delta = opts.delta != null ? Number(opts.delta) : (opts.dir === 'up' ? -1 : 1);
      state.chapters = moveChapter(state.chapters, ids[0], delta);
    } else if (action === 'split') {
      var ch = state.chapters.find(function(c) { return c.id === ids[0]; });
      if (!ch) throw new Error('章节未找到');
      var at = opts.at != null ? Number(opts.at) : Math.floor(ch.text.length / 2);
      state.chapters = splitChapterAt(state.chapters, ids[0], at);
    } else if (action === 'select') {
      var setSel = {};
      ids.forEach(function(id) { setSel[id] = true; });
      state.chapters = state.chapters.map(function(c) {
        return Object.assign({}, c, { selected: !!setSel[c.id] });
      });
    } else {
      throw new Error('未知 action: ' + action + '（merge|enable|disable|delete|rename|move|split|select）');
    }
    save();
    renderAll();
    return { action: action, chapterCount: state.chapters.length };
  }

  /** 程序化同步产出（不 click） */
  function syncOutputs(opts) {
    opts = opts || {};
    var target = opts.target || 'worldbook';
    if (opts.policy) state.conflictPolicy = opts.policy;
    var selectedOnly = opts.selected !== false;

    if (target === 'character' || target === 'characters') {
      function charCanSync(c) {
        if (!c) return false;
        if (c.profile) return true;
        var ent = findPersonEntityForChar(c);
        return !!(ent && String(ent.content || ent.summary || '').trim());
      }
      var sel = state.characters.filter(function(c) {
        return charCanSync(c) && (!selectedOnly || c.selected);
      });
      if (opts.ids || opts.names) {
        var want = {};
        (opts.ids || []).forEach(function(id) { want[id] = true; });
        var names = (opts.names || []).map(function(n) { return String(n).toLowerCase(); });
        sel = state.characters.filter(function(c) {
          if (!charCanSync(c)) return false;
          if (want[c.id]) return true;
          return names.indexOf(String(c.name || '').toLowerCase()) >= 0;
        });
      }
      if (!sel.length) throw new Error('没有可同步的人物（需档案或实体正文）');
      var curDesc = ($('charDesc') && $('charDesc').value) || '';
      var applied = 0;
      sel.forEach(function(c, idx) {
        // 多人：仅首人写 charName；后续强制 merge，避免 overwrite 互相覆盖
        var policyOne = idx === 0 ? state.conflictPolicy : 'merge';
        var descNow = idx === 0 ? curDesc : (($('charDesc') && $('charDesc').value) || '');
        var fieldOpts = { setCharName: idx === 0 };
        var r = c.profile
          ? profileToCharacterFields(c.profile, c.name, policyOne, descNow, fieldOpts)
          : entityPersonToCharacterFields(findPersonEntityForChar(c), policyOne, descNow, fieldOpts);
        if (r.skipped) return;
        setCharacterFields(r.fields);
        c.syncStatus = 'synced';
        var entSync = findPersonEntityForChar(c);
        if (entSync) entSync.syncStatus = 'synced';
        applied++;
      });
      save();
      renderAll();
      return { target: 'character', applied: applied, policy: state.conflictPolicy };
    }

    if (target === 'character_worldbook' || target === 'chars_wb') {
      if (!window.__getWorldbookEntries__ || !window.__setWorldbookEntries__) throw new Error('世界书环境未就绪');
      function charCanSyncWb(c) {
        if (!c) return false;
        if (c.profile) return true;
        var ent = findPersonEntityForChar(c);
        return !!(ent && String(ent.content || ent.summary || '').trim());
      }
      var selC = state.characters.filter(function(c) {
        return charCanSyncWb(c) && (!selectedOnly || c.selected);
      });
      if (opts.ids || opts.names) {
        var wantC = {};
        (opts.ids || []).forEach(function(id) { wantC[id] = true; });
        var namesC = (opts.names || []).map(function(n) { return String(n).toLowerCase(); });
        selC = state.characters.filter(function(c) {
          if (!charCanSyncWb(c)) return false;
          if (wantC[c.id]) return true;
          return namesC.indexOf(String(c.name || '').toLowerCase()) >= 0;
        });
      }
      if (!selC.length) throw new Error('没有可同步的人物（需档案或实体正文）');
      var drafts = selC.map(function(c) {
        if (c.profile) return profileToWorldbookDraft(c.profile, c.name);
        return entityPersonToWorldbookDraft(findPersonEntityForChar(c));
      }).filter(Boolean);
      var cur = window.__getWorldbookEntries__() || [];
      var r1 = applyDraftsToWorldbook(cur, drafts, state.conflictPolicy);
      // skip 且无写入时不标 synced
      if (r1.added || r1.updated) {
        window.__setWorldbookEntries__(r1.entries);
        window.dispatchEvent(new Event('worldbook-changed'));
        window.dispatchEvent(new Event('card-builder-data-changed'));
        if (state.conflictPolicy !== 'skip') {
          selC.forEach(function(c) {
            c.syncStatus = 'synced';
            var entW = findPersonEntityForChar(c);
            if (entW) entW.syncStatus = 'synced';
          });
        }
        save();
        renderAll();
      }
      return Object.assign({ target: 'character_worldbook' }, r1);
    }

    // 文风 → 主世界书固定标题「文风」
    if (target === 'style') {
      if (!state.styleText || !state.styleText.trim()) throw new Error('暂无文风文本');
      if (!window.__getWorldbookEntries__ || !window.__setWorldbookEntries__) throw new Error('世界书环境未就绪');
      var styleDraft = styleToWorldbookDraft(state.styleText);
      var curStyleWb = window.__getWorldbookEntries__() || [];
      var rStyle = applyDraftsToWorldbook(curStyleWb, [styleDraft], state.conflictPolicy);
      if (rStyle.skipped && !rStyle.added && !rStyle.updated) {
        return { target: 'style', skipped: true, policy: state.conflictPolicy, comment: styleDraft.comment };
      }
      window.__setWorldbookEntries__(rStyle.entries);
      window.dispatchEvent(new Event('worldbook-changed'));
      window.dispatchEvent(new Event('card-builder-data-changed'));
      state.styleSyncStatus = 'synced';
      save();
      renderAll();
      return Object.assign({ target: 'style', comment: styleDraft.comment, policy: state.conflictPolicy }, rStyle);
    }

    // 知识库实体 → 主卡（人物 + 世界书）
    if (target === 'entities' || target === 'knowledge') {
      if (!window.__getWorldbookEntries__ || !window.__setWorldbookEntries__) throw new Error('世界书环境未就绪');
      var ents = (state.entities || []).slice();
      if (opts.ids && opts.ids.length) {
        var wantE = {};
        opts.ids.forEach(function(id) { wantE[id] = true; });
        ents = ents.filter(function(e) { return wantE[e.id]; });
      }
      if (opts.types && opts.types.length) {
        ents = ents.filter(function(e) { return opts.types.indexOf(e.type) >= 0; });
      }
      if (selectedOnly) ents = ents.filter(function(e) { return e.selected !== false; });
      if (!ents.length) throw new Error('没有可同步的实体');

      var charApplied = 0;
      var personWbDrafts = [];
      var curDesc = ($('charDesc') && $('charDesc').value) || '';
      var persons = ents.filter(function(e) { return e.type === 'person'; });
      persons.forEach(function(e, idx) {
        var policyOne = idx === 0 ? state.conflictPolicy : 'merge';
        var r = entityPersonToCharacterFields(
          e,
          policyOne,
          idx === 0 ? curDesc : (($('charDesc') && $('charDesc').value) || ''),
          { setCharName: idx === 0 }
        );
        if (!r.skipped && r.fields) {
          setCharacterFields(r.fields);
          e.syncStatus = 'synced';
          charApplied++;
        }
        var pd = entityPersonToWorldbookDraft(e);
        if (pd) personWbDrafts.push(pd);
      });

      var wbEnts = ents.filter(function(e) { return e.type !== 'person'; });
      var curEntWb = window.__getWorldbookEntries__() || [];
      var rEnt = syncEntitiesToWorldbook(curEntWb, wbEnts, state.conflictPolicy, { selectedOnly: false });
      if (personWbDrafts.length) {
        var rPersonWb = applyDraftsToWorldbook(rEnt.entries, personWbDrafts, state.conflictPolicy);
        rEnt.entries = rPersonWb.entries;
        rEnt.added += rPersonWb.added;
        rEnt.updated += rPersonWb.updated;
        rEnt.skipped += rPersonWb.skipped;
      }
      var wroteWb = !!(rEnt.added || rEnt.updated);
      if (wroteWb) {
        window.__setWorldbookEntries__(rEnt.entries);
        window.dispatchEvent(new Event('worldbook-changed'));
        window.dispatchEvent(new Event('card-builder-data-changed'));
      }
      // 仅实际写入时标 synced；skip 未写则保持原状
      if (wroteWb && state.conflictPolicy !== 'skip') {
        wbEnts.forEach(function(e) { e.syncStatus = 'synced'; });
        persons.forEach(function(e) {
          if (personWbDrafts.some(function(d) { return d && d.name === e.name; })) {
            e.syncStatus = 'synced';
          }
        });
      }
      save();
      renderAll();
      return Object.assign({
        target: target,
        policy: state.conflictPolicy,
        charApplied: charApplied,
        personWb: personWbDrafts.length,
      }, rEnt);
    }

    // 默认世界书草稿
    if (!window.__getWorldbookEntries__ || !window.__setWorldbookEntries__) throw new Error('世界书环境未就绪');
    var wbDrafts = (state.wbEntries || []).filter(function(e) {
      return selectedOnly ? e.selected !== false : true;
    });
    if (!wbDrafts.length) throw new Error('没有可同步的世界书草稿');
    var curWb = window.__getWorldbookEntries__() || [];
    var r2 = applyDraftsToWorldbook(curWb, wbDrafts, state.conflictPolicy);
    if (r2.added || r2.updated) {
      window.__setWorldbookEntries__(r2.entries);
      window.dispatchEvent(new Event('worldbook-changed'));
      window.dispatchEvent(new Event('card-builder-data-changed'));
      if (state.conflictPolicy !== 'skip') {
        wbDrafts.forEach(function(e) { e.syncStatus = 'synced'; });
      }
      save();
      renderAll();
    }
    return Object.assign({ target: 'worldbook', policy: state.conflictPolicy }, r2);
  }

  function openProfileEditor(id) {
    var ch = state.characters.find(function(c) { return c.id === id; });
    if (!ch) return;
    editingCharId = id;
    var title = $('novelModalProfileTitle');
    var aliases = $('novelCharAliases');
    var jsonEl = $('novelCharProfileJson');
    if (title) title.textContent = '人物档案 · ' + ch.name;
    if (aliases) aliases.value = (ch.aliases || []).join(', ');
    if (jsonEl) jsonEl.value = JSON.stringify(ch.profile || emptyCharacterProfile(ch.name), null, 2);
    openNovelModal('novelModalProfile');
  }

  function bindCharacters() {
    var addBtn = $('btnCharAdd');
    if (addBtn) addBtn.addEventListener('click', function() {
      var input = $('novelCharManual');
      var raw = input ? input.value : '';
      var names = String(raw).split(/[,，、\s]+/).map(function(s) { return s.trim(); }).filter(Boolean);
      addCharactersByNames(names, '手动添加');
      if (input) input.value = '';
      save();
      renderAll();
    });

    var scanBtn = $('btnCharScan');
    if (scanBtn) scanBtn.addEventListener('click', async function() {
      if (busyFlags.charScan) return;
      try {
        await runScanCharacters();
      } catch (e) {
        if (!isTrackedAbort(e)) {
          alert('扫描失败: ' + e.message);
          setStatus('novelCharStatus', '扫描失败');
        }
      }
    });

    var mergeBtn = $('btnCharMerge');
    if (mergeBtn) mergeBtn.addEventListener('click', function() {
      var sel = state.characters.filter(function(c) { return c.selected; });
      if (sel.length < 2) return alert('请选择至少两个角色合并');
      var primary = sel[0];
      var aliases = (primary.aliases || []).slice();
      var dropEntIds = {};
      sel.slice(1).forEach(function(c) {
        aliases.push(c.name);
        (c.aliases || []).forEach(function(a) { if (aliases.indexOf(a) < 0) aliases.push(a); });
        primary.hits = (primary.hits || 0) + (c.hits || 0);
        var de = findPersonEntityForChar(c);
        if (de) dropEntIds[de.id] = true;
      });
      primary.aliases = aliases;
      var drop = {};
      sel.slice(1).forEach(function(c) { drop[c.id] = true; });
      state.characters = state.characters.filter(function(c) { return !drop[c.id]; });
      primary.selected = false;
      // 合并写回实体库
      if (!state.entities) state.entities = [];
      upsertEntity(state.entities, {
        type: 'person',
        name: primary.name,
        aliases: primary.aliases,
        summary: primary.note || '',
        attrs: primary.profile ? { profile: primary.profile } : {},
      }, { source: 'manual' });
      if (Object.keys(dropEntIds).length) {
        var keep = findPersonEntityForChar(primary);
        state.entities = (state.entities || []).filter(function(e) {
          return !dropEntIds[e.id] || (keep && e.id === keep.id);
        });
        state.relations = (state.relations || []).map(function(r) {
          var from = dropEntIds[r.fromId] && keep ? keep.id : r.fromId;
          var to = dropEntIds[r.toId] && keep ? keep.id : r.toId;
          return Object.assign({}, r, { fromId: from, toId: to });
        });
      }
      projectEntitiesToLegacy(state);
      save();
      renderAll();
    });

    var clearBtn = $('btnCharClear');
    if (clearBtn) clearBtn.addEventListener('click', function() {
      if (!confirm('清空人物列表？')) return;
      state.characters = [];
      state.entities = (state.entities || []).filter(function(e) { return e.type !== 'person'; });
      state.relations = (state.relations || []).filter(function(r) {
        var ids = {};
        (state.entities || []).forEach(function(e) { ids[e.id] = true; });
        return ids[r.fromId] && ids[r.toId];
      });
      save();
      renderAll();
    });

    var enrichSel = $('btnCharEnrichSelected');
    if (enrichSel) enrichSel.addEventListener('click', async function() {
      var ids = state.characters.filter(function(c) { return c.selected; }).map(function(c) {
        var ent = findPersonEntityForChar(c);
        return ent ? ent.id : '';
      }).filter(Boolean);
      if (!ids.length) return alert('请先勾选已有实体的人物（建议先跑小说分析）');
      try {
        await runAnalyzeEnrich({ ids: ids });
      } catch (e) {
        if (!isTrackedAbort(e)) alert('丰满失败: ' + (e.message || e));
      }
    });

    var idCheck = $('novelScanIdentity');
    if (idCheck) idCheck.addEventListener('change', function() {
      state.scanWithIdentity = idCheck.checked;
      save();
    });
    var stage = $('novelSplitStage');
    if (stage) stage.addEventListener('change', function() {
      state.splitByStage = stage.checked;
      save();
    });
    var charMode = $('novelCharShardMode');
    if (charMode) charMode.addEventListener('change', function() {
      state.charShardMode = charMode.value === 'chapters' ? 'chapters' : 'chars';
      syncShardModeUi('novelChar', state.charShardMode);
      save();
      updateExtractCallEstimates();
    });
    var charChunk = $('novelCharChunkSize');
    if (charChunk) charChunk.addEventListener('change', function() {
      state.charChunkSize = parseInt(charChunk.value, 10) || 8000;
      save();
      updateExtractCallEstimates();
    });
    var charPer = $('novelCharChaptersPerShard');
    if (charPer) {
      charPer.addEventListener('change', function() {
        state.charChaptersPerShard = Math.max(1, Math.floor(parseInt(charPer.value, 10) || 1));
        charPer.value = String(state.charChaptersPerShard);
        save();
        updateExtractCallEstimates();
      });
      charPer.addEventListener('input', function() {
        state.charChaptersPerShard = Math.max(1, Math.floor(parseInt(charPer.value, 10) || 1));
        updateExtractCallEstimates();
      });
    }
    var charPolicy = $('novelCharConflictPolicy');
    if (charPolicy) charPolicy.addEventListener('change', function() {
      state.conflictPolicy = charPolicy.value;
      save();
      renderStyle();
      renderWb();
    });

    var syncChars = $('btnSyncCharsSelected');
    if (syncChars) syncChars.addEventListener('click', function() {
      try {
        var r = syncOutputs({ target: 'character', selected: true });
        setStatus('novelCharStatus', '已同步 ' + (r.applied || 0) + ' 人到角色设定');
      } catch (e) {
        alert(e.message || '同步失败');
      }
    });
    var syncCharsWb = $('btnSyncCharsWb');
    if (syncCharsWb) syncCharsWb.addEventListener('click', function() {
      try {
        var r = syncOutputs({ target: 'character_worldbook', selected: true });
        setStatus('novelCharStatus', '人物→世界书：新增 ' + r.added + ' / 更新 ' + r.updated + ' / 跳过 ' + r.skipped);
      } catch (e) {
        alert(e.message || '同步失败');
      }
    });

    var saveProfile = $('btnNovelProfileSave');
    if (saveProfile) saveProfile.addEventListener('click', function() {
      if (!editingCharId) return;
      var ch = state.characters.find(function(c) { return c.id === editingCharId; });
      if (!ch) return;
      try {
        var aliasesEl = $('novelCharAliases');
        var jsonEl = $('novelCharProfileJson');
        ch.aliases = String(aliasesEl && aliasesEl.value || '')
          .split(/[,，、]/).map(function(s) { return s.trim(); }).filter(Boolean);
        ch.profile = normalizeCharacterProfile(JSON.parse(jsonEl.value), ch.name);
        ch.syncStatus = ch.syncStatus === 'synced' ? 'dirty' : 'unsynced';
        ch.note = '档案已编辑';
        if (!state.entities) state.entities = [];
        upsertEntity(state.entities, {
          type: 'person',
          name: ch.name,
          aliases: ch.aliases,
          summary: ch.note,
          attrs: { profile: ch.profile },
          content: profileContentDigest(ch.profile, ch.name),
        }, { source: 'manual' });
        // 投影会覆盖 characters.syncStatus，需写回实体
        var savedEnt = findPersonEntityForChar(ch);
        if (savedEnt) savedEnt.syncStatus = ch.syncStatus;
        projectEntitiesToLegacy(state);
        save();
        renderAll();
        closeNovelModal('novelModalProfile');
        setStatus('novelCharStatus', '已保存「' + ch.name + '」档案');
      } catch (e) {
        alert('JSON 无效: ' + e.message);
      }
    });
  }

  function bindWorldbook() {
    var wbMode = $('novelWbShardMode');
    if (wbMode) wbMode.addEventListener('change', function() {
      state.wbShardMode = wbMode.value === 'chapters' ? 'chapters' : 'chars';
      syncShardModeUi('novelWb', state.wbShardMode);
      save();
      updateExtractCallEstimates();
    });
    var wbChunk = $('novelWbChunkSize');
    if (wbChunk) wbChunk.addEventListener('change', function() {
      state.wbChunkSize = parseInt(wbChunk.value, 10) || 8000;
      save();
      updateExtractCallEstimates();
    });
    var wbPer = $('novelWbChaptersPerShard');
    if (wbPer) {
      wbPer.addEventListener('change', function() {
        state.wbChaptersPerShard = Math.max(1, Math.floor(parseInt(wbPer.value, 10) || 1));
        wbPer.value = String(state.wbChaptersPerShard);
        save();
        updateExtractCallEstimates();
      });
      wbPer.addEventListener('input', function() {
        state.wbChaptersPerShard = Math.max(1, Math.floor(parseInt(wbPer.value, 10) || 1));
        updateExtractCallEstimates();
      });
    }
    var wbPolicy = $('novelWbConflictPolicy');
    if (wbPolicy) wbPolicy.addEventListener('change', function() {
      state.conflictPolicy = wbPolicy.value;
      save();
      renderCharacters();
      renderStyle();
    });

    var typeEl = $('novelWbTypeFilter');
    if (typeEl) typeEl.addEventListener('change', function() {
      novelWbTypeFilter = typeEl.value || '';
      renderWb();
    });

    var searchInput = $('novelWbSearchInput');
    var searchClear = $('novelWbSearchClear');
    if (searchInput) {
      searchInput.addEventListener('input', function() {
        novelWbSearchQuery = searchInput.value || '';
        renderWb();
      });
    }
    if (searchClear) searchClear.addEventListener('click', function() {
      novelWbSearchQuery = '';
      if (searchInput) searchInput.value = '';
      renderWb();
    });

    var createBtn = $('btnWbCreateEntry');
    if (createBtn) createBtn.addEventListener('click', function() {
      if (isCreatingWbEntry) {
        closeNovelModal('novelModalWb');
        return;
      }
      isCreatingWbEntry = true;
      editingWbIndex = -1;
      openWbEditModal(-1, { name: '', content: '', keys: [], strategy: 'selective' }, true);
    });

    var wbSaveBtn = $('btnNovelWbModalSave');
    if (wbSaveBtn) {
      wbSaveBtn.addEventListener('click', function() {
        saveWbInline(isCreatingWbEntry ? -1 : editingWbIndex);
      });
    }

    var extractBtn = $('btnWbExtract');
    if (extractBtn) extractBtn.addEventListener('click', async function() {
      if (busyFlags.wbExtract) return;
      try {
        await runExtractWorldbook();
      } catch (e) {
        if (!isTrackedAbort(e)) {
          alert('抽取失败: ' + e.message);
          setStatus('novelWbStatus', '抽取失败');
        }
      }
    });

    var enrichWb = $('btnWbEnrichSelected');
    if (enrichWb) enrichWb.addEventListener('click', async function() {
      var ids = (state.wbEntries || []).filter(function(e) { return e.selected !== false; }).map(function(e) {
        if (e.id) return e.id;
        var hit = findEntityMatch(state.entities, e.name, []);
        return hit ? hit.id : '';
      }).filter(Boolean);
      if (!ids.length) return alert('请先勾选已有实体的条目（建议先跑小说分析）');
      try {
        await runAnalyzeEnrich({ ids: ids });
      } catch (e) {
        if (!isTrackedAbort(e)) alert('丰满失败: ' + (e.message || e));
      }
    });

    var clear = $('btnWbClear');
    if (clear) clear.addEventListener('click', function() {
      if (!confirm('清空世界书条目（非人物实体）？')) return;
      state.wbEntries = [];
      state.entities = (state.entities || []).filter(function(e) { return e.type === 'person'; });
      state.relations = (state.relations || []).filter(function(r) {
        var ids = {};
        (state.entities || []).forEach(function(e) { ids[e.id] = true; });
        return ids[r.fromId] && ids[r.toId];
      });
      editingWbIndex = -1;
      isCreatingWbEntry = false;
      save();
      renderAll();
    });

    var syncWb = $('btnSyncWbSelected');
    if (syncWb) syncWb.addEventListener('click', function() {
      try {
        // 实体 + 纯 wbEntries 草稿合并落卡（按 comment 去重）
        var types = ['faction', 'location', 'item', 'event', 'lore', 'nsfw'];
        var hasEnt = (state.entities || []).some(function(e) {
          return types.indexOf(e.type) >= 0 && e.selected !== false && (e.content || e.summary);
        });
        var totals = { added: 0, updated: 0, skipped: 0 };
        if (hasEnt) {
          var rEnt = syncOutputs({
            target: 'entities',
            selected: true,
            types: types,
          });
          totals.added += rEnt.added || 0;
          totals.updated += rEnt.updated || 0;
          totals.skipped += rEnt.skipped || 0;
        }
        // 未进实体库的草稿条（或实体路径未覆盖的 comment）一并写入
        var covered = {};
        (state.entities || []).forEach(function(e) {
          if (!e || e.type === 'person') return;
          var cat = e.type === 'lore'
            ? ((e.attrs && e.attrs.aspect) || 'setting')
            : e.type;
          covered['[小说' + cat + '] ' + e.name] = true;
        });
        var orphanDrafts = (state.wbEntries || []).filter(function(w) {
          if (!w || w.selected === false) return false;
          var cmt = w.comment || ('[小说' + (w.category || 'setting') + '] ' + w.name);
          return !covered[cmt];
        });
        if (orphanDrafts.length) {
          if (!window.__getWorldbookEntries__ || !window.__setWorldbookEntries__) throw new Error('世界书环境未就绪');
          var rOrphan = applyDraftsToWorldbook(
            window.__getWorldbookEntries__() || [],
            orphanDrafts,
            state.conflictPolicy
          );
          if (rOrphan.added || rOrphan.updated) {
            window.__setWorldbookEntries__(rOrphan.entries);
            window.dispatchEvent(new Event('worldbook-changed'));
            window.dispatchEvent(new Event('card-builder-data-changed'));
            orphanDrafts.forEach(function(w) {
              if (state.conflictPolicy !== 'skip') w.syncStatus = 'synced';
            });
            save();
            renderAll();
          }
          totals.added += rOrphan.added || 0;
          totals.updated += rOrphan.updated || 0;
          totals.skipped += rOrphan.skipped || 0;
        }
        if (!hasEnt && !orphanDrafts.length) {
          var rWb = syncOutputs({ target: 'worldbook', selected: true });
          totals = rWb;
        }
        setStatus('novelWbStatus', '世界书同步：新增 ' + (totals.added || 0) + ' / 更新 ' + (totals.updated || 0) + ' / 跳过 ' + (totals.skipped || 0));
      } catch (e) {
        alert(e.message || '同步失败');
      }
    });

    // 实体编辑弹窗（非人物）
    var saveEnt = $('btnNovelEntitySave');
    if (saveEnt) saveEnt.addEventListener('click', function() {
      if (!editingEntityId) return;
      var ent = (state.entities || []).find(function(e) { return e.id === editingEntityId; });
      if (!ent) return;
      var nameEl = $('novelEntityName');
      var typeEl2 = $('novelEntityType');
      var aliasesEl = $('novelEntityAliases');
      var sumEl = $('novelEntitySummary');
      var keysEl = $('novelEntityKeys');
      var contentEl = $('novelEntityContent');
      upsertEntity(state.entities, {
        type: typeEl2 ? typeEl2.value : ent.type,
        name: nameEl ? nameEl.value : ent.name,
        aliases: normalizeAliases(nameEl ? nameEl.value : ent.name, aliasesEl ? aliasesEl.value : ''),
        summary: sumEl ? sumEl.value : ent.summary,
        keys: normalizeNameList(nameEl ? nameEl.value : ent.name, keysEl ? keysEl.value : ''),
        content: contentEl ? contentEl.value : ent.content,
      }, { source: 'manual' });
      projectEntitiesToLegacy(state);
      save();
      closeNovelModal('novelModalEntity');
      renderAll();
      setStatus('novelWbStatus', '已保存 · ' + (nameEl ? nameEl.value : ent.name));
    });
  }

  function bindAnalyze() {
    var mode = $('novelAnalyzeShardMode');
    if (mode) mode.addEventListener('change', function() {
      state.analyzeShardMode = mode.value === 'chapters' ? 'chapters' : 'chars';
      syncShardModeUi('novelAnalyze', state.analyzeShardMode);
      save();
      updateExtractCallEstimates();
    });
    var chunk = $('novelAnalyzeChunkSize');
    if (chunk) chunk.addEventListener('change', function() {
      state.analyzeChunkSize = parseInt(chunk.value, 10) || 8000;
      save();
      updateExtractCallEstimates();
    });
    var per = $('novelAnalyzeChaptersPerShard');
    if (per) {
      per.addEventListener('change', function() {
        state.analyzeChaptersPerShard = Math.max(1, Math.floor(parseInt(per.value, 10) || 1));
        per.value = String(state.analyzeChaptersPerShard);
        save();
        updateExtractCallEstimates();
      });
      per.addEventListener('input', function() {
        state.analyzeChaptersPerShard = Math.max(1, Math.floor(parseInt(per.value, 10) || 1));
        updateExtractCallEstimates();
      });
    }
    var sbDraft = $('btnNovelNsfwStatusDraft');
    if (sbDraft) sbDraft.addEventListener('click', function() {
      var draft = buildStatusBarNsfwDraftFromEntities(state.entities, state.setupCharName || '');
      var box = $('novelNsfwStatusDraft');
      if (box) {
        box.style.display = '';
        box.textContent = draft.note + '\n'
          + draft.paths.map(function(p) {
            return p.path + ' | ' + p.label + ' = ' + p.value;
          }).join('\n');
      }
      setStatus('novelAnalyzeStatus', draft.note);
      try {
        sessionStorage.setItem('st_v3_nsfw_status_draft', JSON.stringify(draft));
      } catch (e) { /* ignore */ }
    });
    var ragBtn = $('btnNovelRagIndex');
    if (ragBtn) ragBtn.addEventListener('click', async function() {
      if (busyFlags.ragIndex) return;
      try {
        await runBuildRagIndex({});
      } catch (e) {
        if (!isTrackedAbort(e)) {
          alert('建索引失败: ' + (e.message || e));
          setStatus('novelAnalyzeStatus', '索引失败');
        }
      }
    });
    var allBtn = $('btnNovelAnalyzeAll');
    if (allBtn) allBtn.addEventListener('click', async function() {
      if (busyFlags.analyzeAll) return;
      try {
        await runAnalyzeAll();
      } catch (e) {
        if (!isTrackedAbort(e)) {
          alert('完整分析失败: ' + (e.message || e));
          setStatus('novelAnalyzeStatus', '分析失败');
        }
      }
    });
    var skBtn = $('btnNovelAnalyzeSkeleton');
    if (skBtn) skBtn.addEventListener('click', async function() {
      if (busyFlags.analyzeSkeleton || busyFlags.analyzeAll) return;
      try {
        await runAnalyzeSkeleton();
      } catch (e) {
        if (!isTrackedAbort(e)) {
          alert('骨架扫描失败: ' + (e.message || e));
          setStatus('novelAnalyzeStatus', '骨架失败');
        }
      }
    });
    var enBtn = $('btnNovelAnalyzeEnrich');
    if (enBtn) enBtn.addEventListener('click', async function() {
      if (busyFlags.analyzeEnrich || busyFlags.analyzeAll) return;
      try {
        await runAnalyzeEnrich({});
      } catch (e) {
        if (!isTrackedAbort(e)) {
          alert('丰满失败: ' + (e.message || e));
          setStatus('novelAnalyzeStatus', '丰满失败');
        }
      }
    });
    var retryBtn = $('btnNovelRetryFailed');
    if (retryBtn) retryBtn.addEventListener('click', async function() {
      if (busyFlags.analyzeSkeleton || busyFlags.analyzeEnrich || busyFlags.analyzeAll) return;
      try {
        await runRetryFailedShards();
      } catch (e) {
        if (!isTrackedAbort(e)) {
          alert('重跑失败: ' + (e.message || e));
          setStatus('novelAnalyzeStatus', '重跑失败');
        }
      }
    });
  }

  /** 图谱控件（挂在小说分析面板） */
  function bindGraphControls() {
    var relayout = $('btnGraphRelayout');
    if (relayout) relayout.addEventListener('click', function() {
      relayoutGraph(graphCy);
    });
    var clear = $('btnGraphClear');
    if (clear) clear.addEventListener('click', function() {
      if (!confirm('清空关系图谱？实体（人物/世界书）保留，仅清除关系与图。')) return;
      state.relations = [];
      projectEntitiesToLegacy(state);
      save();
      var detail = $('novelGraphDetail');
      if (detail) detail.textContent = '点击节点或边查看详情';
      renderGraph();
      setStatus('novelAnalyzeStatus', '已清空图谱关系');
    });
  }

  function bindCharacterSetup() {
    var pick = $('novelSetupEntityPick');
    if (pick) pick.addEventListener('change', function() {
      var id = pick.value;
      var ent = (state.entities || []).find(function(e) { return e.id === id; });
      if (ent) {
        state.setupCharName = ent.name;
        var nameEl = $('novelSetupCharName');
        if (nameEl) nameEl.value = ent.name;
        save();
        renderSetupCorpusPreview('setup');
      }
    });
    var name = $('novelSetupCharName');
    if (name) name.addEventListener('input', function() {
      state.setupCharName = name.value;
      save();
      renderSetupCorpusPreview('setup');
    });
    var mode = $('novelSetupRangeMode');
    if (mode) mode.addEventListener('change', function() {
      state.setupRangeMode = mode.value === 'chapters' ? 'chapters' : 'chars';
      save();
      renderCharacterSetup();
    });
    var limit = $('novelSetupCharLimit');
    if (limit) limit.addEventListener('change', function() {
      state.setupCharLimit = parseInt(limit.value, 10) || 16000;
      save();
      renderSetupCorpusPreview('setup');
    });
    var chN = $('novelSetupChapterCount');
    if (chN) chN.addEventListener('input', function() {
      state.setupChapterCount = Math.max(1, parseInt(chN.value, 10) || 1);
      save();
      renderSetupCorpusPreview('setup');
    });
    var gen = $('btnNovelGenCharSetup');
    if (gen) gen.addEventListener('click', async function() {
      try {
        await runGenerateCharSetup();
      } catch (e) {
        if (!isTrackedAbort(e)) alert('生成失败: ' + (e.message || e));
      }
    });
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
        save();
        renderSetupCorpusPreview('greet');
      }
    });
    var name = $('novelGreetCharName');
    if (name) name.addEventListener('input', function() {
      state.greetCharName = name.value;
      save();
      renderSetupCorpusPreview('greet');
    });
    var mode = $('novelGreetRangeMode');
    if (mode) mode.addEventListener('change', function() {
      state.greetRangeMode = mode.value === 'chapters' ? 'chapters' : 'chars';
      save();
      renderGreetingsGen();
    });
    var limit = $('novelGreetCharLimit');
    if (limit) limit.addEventListener('change', function() {
      state.greetCharLimit = parseInt(limit.value, 10) || 16000;
      save();
      renderSetupCorpusPreview('greet');
    });
    var chN = $('novelGreetChapterCount');
    if (chN) chN.addEventListener('input', function() {
      state.greetChapterCount = Math.max(1, parseInt(chN.value, 10) || 1);
      save();
      renderSetupCorpusPreview('greet');
    });
    var count = $('novelGreetCount');
    if (count) count.addEventListener('input', function() {
      state.greetCount = Math.max(1, Math.min(12, parseInt(count.value, 10) || 3));
      save();
    });
    var gen = $('btnNovelGenGreetings');
    if (gen) gen.addEventListener('click', async function() {
      try {
        await runGenerateGreetings();
      } catch (e) {
        if (!isTrackedAbort(e)) alert('生成失败: ' + (e.message || e));
      }
    });
  }

  function bindStyle() {
    var custom = $('novelStyleCustom');
    if (custom) custom.addEventListener('input', function() { state.styleCustomReq = custom.value; save(); });
    var styleChunk = $('novelStyleChunkSize');
    if (styleChunk) styleChunk.addEventListener('change', function() {
      state.styleChunkSize = parseInt(styleChunk.value, 10) || 16000;
      save();
    });
    var stylePolicy = $('novelStyleConflictPolicy');
    if (stylePolicy) stylePolicy.addEventListener('change', function() {
      state.conflictPolicy = stylePolicy.value;
      save();
      renderCharacters();
      renderWb();
    });
    var text = $('novelStyleText');
    if (text) text.addEventListener('input', function() {
      state.styleText = text.value;
      state.styleSyncStatus = state.styleSyncStatus === 'synced' ? 'dirty' : (state.styleSyncStatus || 'unsynced');
      save();
      renderStyle();
    });

    var distill = $('btnStyleDistill');
    if (distill) distill.addEventListener('click', async function() {
      if (busyFlags.styleDistill) return;
      try {
        await runDistillStyle();
      } catch (e) {
        if (!isTrackedAbort(e)) {
          alert('蒸馏失败: ' + e.message);
          setStatus('novelStyleStatus', '蒸馏失败');
        }
      }
    });

    var syncStyle = $('btnSyncStyle');
    if (syncStyle) syncStyle.addEventListener('click', function() {
      try {
        var r = syncOutputs({ target: 'style' });
        if (r.skipped) setStatus('novelStyleStatus', '文风已跳过（冲突策略=跳过）');
        else setStatus('novelStyleStatus', '已同步为世界书「文风」条目');
      } catch (e) {
        alert(e.message || '同步失败');
      }
    });

    var copy = $('btnStyleCopy');
    if (copy) copy.addEventListener('click', async function() {
      try {
        await navigator.clipboard.writeText(state.styleText || '');
        setStatus('novelStyleStatus', '已复制');
      } catch (e) {
        alert('复制失败');
      }
    });
    var dl = $('btnStyleDownload');
    if (dl) dl.addEventListener('click', function() {
      var blob = new Blob([state.styleText || ''], { type: 'text/markdown;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'novel-style.md';
      a.click();
    });
  }

  function setCharacterFields(fields) {
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

  /** 写入主开场 + 备选（对齐 GreetingPanel） */
  function setGreetingFields(firstMes, altGreetings) {
    if (firstMes != null && $('firstMes')) {
      $('firstMes').value = String(firstMes);
      $('firstMes').dispatchEvent(new Event('input', { bubbles: true }));
    }
    window.__altGreetings__ = Array.isArray(altGreetings) ? altGreetings.slice() : [];
    if (typeof window.__renderAltGreetings__ === 'function') window.__renderAltGreetings__();
    window.dispatchEvent(new Event('card-builder-data-changed'));
  }

  // 助手桥接：真 await API，禁止只 click 返回 started
  window.__novelWorkshopBridge__ = {
    getState: function() {
      var s = summarizeNovelState(state);
      s.cardId = boundCardId || currentCardId();
      if (s.rag) s.rag.stale = isRagIndexStale();
      return s;
    },
    getRawState: function() { return state; },
    getBoundCardId: function() { return boundCardId || currentCardId(); },
    /** 助手 / AI 配置：与 state.rag 对齐 */
    getRagOptions: function() {
      return {
        enabled: !state.rag || state.rag.enabled !== false,
        budget: (state.rag && state.rag.budget) || 12000,
        embedModel: (state.rag && state.rag.embedModel) || '',
      };
    },
    setRagOptions: function(opts) {
      applyRagOptionsFromUi(opts || {});
      syncRagOptionsToAiPanel();
      return this.getRagOptions();
    },
    bindCard: bindCard,
    /** 快照小说桶（撤销用） */
    captureBucket: function() {
      return JSON.parse(JSON.stringify(state));
    },
    restoreBucket: function(snap) {
      if (!snap || typeof snap !== 'object') return;
      state = Object.assign(createDefaultNovelState(), snap);
      save();
      renderAll();
    },
    setSource: function(payload) {
      payload = payload || {};
      if (payload.text != null) state.sourceText = String(payload.text);
      if (payload.context != null) state.contextText = String(payload.context);
      save();
      renderAll();
      return { sourceLen: getFullSourceText(state).length, contextLen: String(state.contextText || '').length };
    },
    runSplitChapters: function(opts) {
      opts = opts || {};
      if (opts.mode) state.chapterSplitMode = opts.mode;
      var full = getFullSourceText(state).trim();
      if (!full) throw new Error('无原始资料');
      state.chapters = splitIntoChapters(full, {
        mode: state.chapterSplitMode || 'title',
        chunkSize: state.chunkSize || 8000,
      });
      save();
      renderAll();
      return { chapterCount: state.chapters.length, mode: state.chapterSplitMode };
    },
    runExtract: async function(opts) {
      opts = opts || {};
      var mode = opts.mode || 'characters';
      if (mode === 'chapters' || mode === 'split') {
        return Object.assign({ mode: 'split' }, this.runSplitChapters(opts));
      }
      if (mode === 'worldbook' || mode === 'wb') {
        return Object.assign({ mode: 'worldbook' }, await runExtractWorldbook());
      }
      if (mode === 'graph' || mode === 'knowledge_graph' || mode === 'unified' || mode === 'analyze') {
        return Object.assign({ mode: 'analyze' }, await runAnalyzeAll());
      }
      if (mode === 'style') {
        return Object.assign({ mode: 'style' }, await runDistillStyle());
      }
      if (mode === 'character_setup' || mode === 'char_setup' || mode === 'setup') {
        return Object.assign({ mode: 'character_setup' }, await runGenerateCharSetup());
      }
      if (mode === 'greetings' || mode === 'greeting') {
        return Object.assign({ mode: 'greetings' }, await runGenerateGreetings());
      }
      return Object.assign({ mode: 'characters' }, await runScanCharacters());
    },
    runGenerateCharSetup: runGenerateCharSetup,
    runGenerateGreetings: runGenerateGreetings,
    patchChapters: patchChapters,
    expandCharacter: function(opts) {
      opts = opts || {};
      return expandCharacter(
        { id: opts.id, name: opts.name || opts.titleMatch },
        { mode: opts.mode || 'expand', instruction: opts.instruction || '', silent: true, skipConfirm: true, openEditor: false }
      );
    },
    mutateCharacter: function(opts) {
      opts = opts || {};
      var t = opts.target || opts;
      return expandCharacter(
        { id: t.id, name: t.name || t.titleMatch },
        { mode: opts.mode || 'expand', instruction: opts.instruction || '', silent: true, skipConfirm: true, openEditor: false }
      );
    },
    expandWorldbookEntry: function(opts) {
      opts = opts || {};
      var t = opts.target || opts;
      var index = t.index != null ? Number(t.index) : opts.index;
      return expandWbEntry(
        index != null && !Number.isNaN(index) ? index : { name: t.name || t.titleMatch || opts.name },
        { mode: opts.mode || 'expand', instruction: opts.instruction || '', silent: true, skipConfirm: true }
      );
    },
    listOutputs: function() {
      return {
        characters: (state.characters || []).filter(function(c) { return c.profile; }).map(function(c) {
          return { id: c.id, name: c.name, selected: !!c.selected, syncStatus: c.syncStatus };
        }),
        worldbook: (state.wbEntries || []).map(function(e, i) {
          return { index: i, name: e.name, comment: e.comment, selected: e.selected !== false, syncStatus: e.syncStatus };
        }),
        styleLen: String(state.styleText || '').length,
        styleSyncStatus: state.styleSyncStatus,
        conflictPolicy: state.conflictPolicy,
      };
    },
    syncOutputs: syncOutputs,
    applyResult: function(opts) {
      return syncOutputs(opts || {});
    },
    /** 混合检索原文片段 */
    searchPassages: async function(query, opts) {
      opts = opts || {};
      var api = getApiConfig();
      var cardId = boundCardId || currentCardId();
      var enabledChapters = (state.chapters || []).filter(function(c) {
        return c && c.enabled !== false && String(c.text || '').trim();
      });
      var chapters = enabledChapters.length ? enabledChapters : (state.chapters || []);
      var index = cardId ? await loadRagIndex(cardId) : null;
      var indexStatus = (state.rag && state.rag.indexStatus) || 'idle';
      var stale = isRagIndexStale();
      var indexReady = indexStatus === 'ready' && !stale;
      var budget = opts.budget != null ? opts.budget : ((state.rag && state.rag.budget) || 12000);
      var hybridOpts = {
        chapters: chapters,
        query: String(query || ''),
        cardId: cardId,
        index: index,
        budget: budget,
        topK: opts.limit || 24,
        apiUrl: api.apiUrl,
        apiKey: api.apiKey,
        embedModel: api.embedModel || (state.rag && state.rag.embedModel) || '',
      };
      var q = String(query || '').trim();
      var extraTerms = [];
      if (q && (state.entities || []).length) {
        var entitySeeds = pickRelatedEntities(state.entities, q, 4, {
          fallback: 0,
          relations: state.relations,
        });
        entitySeeds.forEach(function(e) {
          if (e && e.name) extraTerms.push(e.name);
          (e.aliases || []).forEach(function(a) { if (a) extraTerms.push(a); });
        });
      }
      if (extraTerms.length) hybridOpts.extraTerms = extraTerms;
      var search = await hybridSearch(hybridOpts);
      // 仅当用户 query 非空且首轮无命中时，用「与 query 匹配的实体名」二次检索；
      // 禁止 fallback 到固定前 N 个实体（否则任意 query 都会命中相同段落）。
      if (!search.snippets.length && q && (state.entities || []).length) {
        var seeds = pickRelatedEntities(state.entities, q, 4, { fallback: 0 });
        var entityTerms = [];
        seeds.forEach(function(e) {
          if (e && e.name) entityTerms.push(e.name);
          (e.aliases || []).forEach(function(a) { if (a) entityTerms.push(a); });
        });
        if (entityTerms.length) {
          search = await hybridSearch(Object.assign({}, hybridOpts, {
            query: entityTerms.slice(0, 8).join(' '),
            entityBoost: true,
          }));
        }
      }
      return Object.assign({}, search, {
        indexStatus: indexStatus,
        indexStale: stale,
        indexReady: indexReady,
        chunkCount: (state.rag && state.rag.chunkCount) || search.indexChunkCount || 0,
        enabledChapterCount: enabledChapters.length,
        cardId: cardId,
      });
    },
    listEntities: function(opts) {
      opts = opts || {};
      var list = (state.entities || []).slice();
      if (opts.type) list = list.filter(function(e) { return e.type === opts.type; });
      if (opts.query) {
        var q = String(opts.query).toLowerCase();
        list = list.filter(function(e) {
          return ((e.name || '') + ' ' + (e.aliases || []).join(' ')).toLowerCase().indexOf(q) >= 0;
        });
      }
      return list.map(function(e) {
        return {
          id: e.id,
          type: e.type,
          name: e.name,
          aliases: e.aliases,
          summary: e.summary,
          selected: e.selected !== false,
          syncStatus: e.syncStatus,
          enriched: isEntityEnriched(e, !!state.strictQuality, getAdultMode(state)),
        };
      });
    },
    getEntity: function(idOrName) {
      var s = String(idOrName || '').trim();
      if (!s) return null;
      var byId = (state.entities || []).find(function(e) { return e.id === s; });
      if (byId) return byId;
      return findEntityMatch(state.entities, s, []);
    },
    patchEntity: function(opts) {
      opts = opts || {};
      var t = opts.target || opts;
      var ent = t.id
        ? (state.entities || []).find(function(e) { return e.id === t.id; })
        : findEntityMatch(state.entities, t.name || t.titleMatch || opts.name, []);
      if (!ent) throw new Error('未找到实体');
      var patch = opts.patch || opts.fields || opts;
      upsertEntity(state.entities, Object.assign({
        type: ent.type,
        name: patch.name || ent.name,
      }, patch), { source: 'assistant' });
      projectEntitiesToLegacy(state);
      save();
      renderAll();
      return findEntityMatch(state.entities, patch.name || ent.name, patch.aliases) || ent;
    },
    mergeEntities: function(opts) {
      opts = opts || {};
      function resolveEnt(ref) {
        if (!ref) return null;
        if (typeof ref === 'string') {
          return (state.entities || []).find(function(e) { return e.id === ref; })
            || findEntityMatch(state.entities, ref, []);
        }
        if (ref.id) return (state.entities || []).find(function(e) { return e.id === ref.id; });
        return findEntityMatch(state.entities, ref.name || ref.titleMatch, []);
      }
      var a = resolveEnt(opts.keep) || (state.entities || []).find(function(e) {
        return e.id === (opts.primaryId || opts.intoId || opts.targetId);
      });
      var b = resolveEnt(opts.drop) || (state.entities || []).find(function(e) {
        return e.id === (opts.secondaryId || opts.fromId || opts.sourceId);
      });
      if (!a || !b) throw new Error('实体不存在');
      var primaryId = a.id;
      var secondaryId = b.id;
      a.aliases = Array.from(new Set((a.aliases || []).concat(b.aliases || [], [b.name])));
      if (String(b.content || '').length > String(a.content || '').length) a.content = b.content;
      if (String(b.summary || '').length > String(a.summary || '').length) a.summary = b.summary;
      a.provenance = (a.provenance || []).concat(b.provenance || []);
      a.syncStatus = 'dirty';
      state.entities = (state.entities || []).filter(function(e) { return e.id !== secondaryId; });
      state.relations = (state.relations || []).map(function(r) {
        return Object.assign({}, r, {
          fromId: r.fromId === secondaryId ? primaryId : r.fromId,
          toId: r.toId === secondaryId ? primaryId : r.toId,
        });
      });
      projectEntitiesToLegacy(state);
      save();
      renderAll();
      return a;
    },
    runRagIndex: function(opts) { return runBuildRagIndex(opts || {}); },
    retryFailedShards: function() { return runRetryFailedShards(); },
    isRagIndexStale: isRagIndexStale,
    getAdultMode: function() { return getAdultMode(state); },
    setAdultMode: function(on) {
      setAdultMode(state, on);
      save();
      renderAll();
      return getAdultMode(state);
    },
    getNtlMode: function() { return getNtlMode(state); },
    setNtlMode: function(on) {
      setNtlMode(state, on);
      save();
      renderAll();
      return getNtlMode(state);
    },
    /** 状态栏 NSFW 变量草案（不自动写入） */
    buildNsfwStatusDraft: function(opts) {
      opts = opts || {};
      return buildStatusBarNsfwDraftFromEntities(
        state.entities,
        opts.name || opts.charName || state.setupCharName || ''
      );
    },
    runAnalyze: function(phase) {
      var p = String(phase || 'all').toLowerCase();
      if (p === 'skeleton') return runAnalyzeSkeleton();
      if (p === 'enrich') return runAnalyzeEnrich({});
      if (p === 'relations') return runAnalyzeRelations();
      return runAnalyzeAll();
    },
    enrichEntity: function(opts) {
      opts = opts || {};
      var ids = opts.ids || (opts.id ? [opts.id] : []);
      if (!ids.length && opts.name) {
        var hit = findEntityMatch(state.entities, opts.name, []);
        if (hit) ids = [hit.id];
      }
      return runAnalyzeEnrich({ ids: ids });
    },
    syncEntities: function(opts) {
      return syncOutputs(Object.assign({ target: 'entities' }, opts || {}));
    },
  };

  bindNovelModals();
  bindSource();
  bindChapters();
  bindCharacterSetup();
  bindGreetingsGen();
  bindCharacters();
  bindWorldbook();
  bindAnalyze();
  bindGraphControls();
  bindStyle();

  // 切卡 / 新建卡时换桶（index 派发 card-draft-changed）
  window.addEventListener('card-draft-changed', function(ev) {
    var id = ev && ev.detail && ev.detail.cardId;
    if (!id && typeof window.__getCurrentDraftId__ === 'function') {
      id = window.__getCurrentDraftId__();
    }
    bindCard(id, { render: true });
  });

  bindCardAsync(currentCardId(), { force: true, render: false }).then(function() {
    renderAll();
  }).catch(function(err) {
    console.warn('[novel] init bind failed', err);
    renderAll();
  });
}
