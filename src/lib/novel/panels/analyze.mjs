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
  buildAdultContextDigests,
  extractStyleNsfwSection,
  buildModeHintBlocks,
  buildContentModeFlags,
  buildNsfwFlavorHint,
  buildPaletteGuidanceBlock,
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
  buildStatusBarNsfwDraftFromEntities,
  buildStatusBarNtlDraftFromEntities,
} from '../nsfwSupport.mjs';
import { escapeHtml, parseJsonLoose } from '../../utils.mjs';

var ENTITY_TYPE_ZH = {
  person: '人物',
  faction: '势力',
  location: '地点',
  item: '物品',
  event: '事件',
  lore: '设定',
  nsfw: 'NSFW',
};

export function registerAnalyze(ctx) {
  var panel = {};
  var graphCy = null;

  function getApiConfig() {
    if (ctx._getApiConfig) return ctx._getApiConfig();
    var $ = ctx.$;
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

  function isRagIndexStale() {
    var state = ctx.state;
    if (!state.rag || state.rag.indexStatus !== 'ready') return true;
    if (!(state.rag.chunkCount > 0)) return true;
    var fp = chaptersSourceFingerprint(state.chapters);
    return fp !== String(state.rag.sourceFingerprint || '');
  }

  function analyzeShardOpts() {
    var state = ctx.state;
    return {
      mode: state.analyzeShardMode === 'chapters' ? 'chapters' : 'chars',
      chunkSize: state.analyzeChunkSize || state.chunkSize || 8000,
      chaptersPerShard: state.analyzeChaptersPerShard || 1,
    };
  }

  function pushFailedShard(rec) {
    var state = ctx.state;
    if (!Array.isArray(state.failedShards)) state.failedShards = [];
    state.failedShards.push(Object.assign({ at: new Date().toISOString() }, rec || {}));
  }

  function clearFailedShards(phase) {
    var state = ctx.state;
    if (!phase) {
      state.failedShards = [];
      return;
    }
    state.failedShards = (state.failedShards || []).filter(function(f) { return f.phase !== phase; });
  }

  function syncShardModeUi(prefix, mode) {
    var $ = ctx.$;
    var byChars = mode !== 'chapters';
    var sizeWrap = $(prefix + 'ChunkSizeWrap');
    var chWrap = $(prefix + 'ChaptersPerShardWrap');
    if (sizeWrap) sizeWrap.hidden = !byChars;
    if (chWrap) chWrap.hidden = byChars;
  }

  function gates() {
    var state = ctx.state;
    return getPipelineGates(state);
  }

  panel.render = function() {
    var state = ctx.state;
    var $ = ctx.$;
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
  };

  panel.flushAnalyzePreview = function() {
    var state = ctx.state;
    projectEntitiesToLegacy(state);
    ctx.save();
    panel.render();
    if (ctx.panels.characters) ctx.panels.characters.render();
    if (ctx.panels.worldbook) ctx.panels.worldbook.render();
    panel.renderGraph();
  };

  panel.renderGraph = function() {
    var state = ctx.state;
    var $ = ctx.$;
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
  };

  panel.bind = function() {
    var state = ctx.state;
    var $ = ctx.$;
    var mode = $('novelAnalyzeShardMode');
    if (mode) mode.addEventListener('change', function() {
      state.analyzeShardMode = mode.value === 'chapters' ? 'chapters' : 'chars';
      syncShardModeUi('novelAnalyze', state.analyzeShardMode);
      ctx.save();
      if (ctx.updateExtractCallEstimates) ctx.updateExtractCallEstimates();
    });
    var chunk = $('novelAnalyzeChunkSize');
    if (chunk) chunk.addEventListener('change', function() {
      state.analyzeChunkSize = parseInt(chunk.value, 10) || 8000;
      ctx.save();
      if (ctx.updateExtractCallEstimates) ctx.updateExtractCallEstimates();
    });
    var per = $('novelAnalyzeChaptersPerShard');
    if (per) {
      per.addEventListener('change', function() {
        state.analyzeChaptersPerShard = Math.max(1, Math.floor(parseInt(per.value, 10) || 1));
        per.value = String(state.analyzeChaptersPerShard);
        ctx.save();
        if (ctx.updateExtractCallEstimates) ctx.updateExtractCallEstimates();
      });
      per.addEventListener('input', function() {
        state.analyzeChaptersPerShard = Math.max(1, Math.floor(parseInt(per.value, 10) || 1));
        if (ctx.updateExtractCallEstimates) ctx.updateExtractCallEstimates();
      });
    }
    function showStatusBarDraft(draft, storageKey) {
      var box = $('novelNsfwStatusDraft');
      if (box) {
        box.style.display = '';
        box.textContent = draft.note + '\n'
          + draft.paths.map(function(p) {
            return p.path + ' | ' + p.label + ' = ' + p.value;
          }).join('\n');
      }
      if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', draft.note);
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(draft));
      } catch (e) { /* ignore */ }
    }
    var sbDraft = $('btnNovelNsfwStatusDraft');
    if (sbDraft) sbDraft.addEventListener('click', function() {
      showStatusBarDraft(
        buildStatusBarNsfwDraftFromEntities(state.entities, state.setupCharName || ''),
        'st_v3_nsfw_status_draft'
      );
    });
    var ntlDraftBtn = $('btnNovelNtlStatusDraft');
    if (ntlDraftBtn) ntlDraftBtn.addEventListener('click', function() {
      showStatusBarDraft(
        buildStatusBarNtlDraftFromEntities(state.entities, state.setupCharName || ''),
        'st_v3_ntl_status_draft'
      );
    });
    var ragBtn = $('btnNovelRagIndex');
    if (ragBtn) ragBtn.addEventListener('click', async function() {
      if (ctx.busyFlags.ragIndex) return;
      try {
        await panel.runBuildRagIndex({});
      } catch (e) {
        if (!ctx.isTrackedAbort(e)) {
          alert('建索引失败: ' + (e.message || e));
          if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '索引失败');
        }
      }
    });
    var allBtn = $('btnNovelAnalyzeAll');
    if (allBtn) allBtn.addEventListener('click', async function() {
      if (ctx.busyFlags.analyzeAll) return;
      try {
        await panel.runAnalyzeAll();
      } catch (e) {
        if (!ctx.isTrackedAbort(e)) {
          alert('完整分析失败: ' + (e.message || e));
          if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '分析失败');
        }
      }
    });
    var skBtn = $('btnNovelAnalyzeSkeleton');
    if (skBtn) skBtn.addEventListener('click', async function() {
      if (ctx.busyFlags.analyzeSkeleton || ctx.busyFlags.analyzeAll) return;
      try {
        await panel.runAnalyzeSkeleton();
      } catch (e) {
        if (!ctx.isTrackedAbort(e)) {
          alert('骨架扫描失败: ' + (e.message || e));
          if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '骨架失败');
        }
      }
    });
    var enBtn = $('btnNovelAnalyzeEnrich');
    if (enBtn) enBtn.addEventListener('click', async function() {
      if (ctx.busyFlags.analyzeEnrich || ctx.busyFlags.analyzeAll) return;
      try {
        await panel.runAnalyzeEnrich({});
      } catch (e) {
        if (!ctx.isTrackedAbort(e)) {
          alert('丰满失败: ' + (e.message || e));
          if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '丰满失败');
        }
      }
    });
    var retryBtn = $('btnNovelRetryFailed');
    if (retryBtn) retryBtn.addEventListener('click', async function() {
      if (ctx.busyFlags.analyzeSkeleton || ctx.busyFlags.analyzeEnrich || ctx.busyFlags.analyzeAll) return;
      try {
        await panel.runRetryFailedShards();
      } catch (e) {
        if (!ctx.isTrackedAbort(e)) {
          alert('重跑失败: ' + (e.message || e));
          if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '重跑失败');
        }
      }
    });
  };

  panel.bindGraphControls = function() {
    var $ = ctx.$;
    var relayout = $('btnGraphRelayout');
    if (relayout) relayout.addEventListener('click', function() {
      relayoutGraph(graphCy);
    });
    var clear = $('btnGraphClear');
    if (clear) clear.addEventListener('click', function() {
      if (!confirm('清空关系图谱？实体（人物/世界书）保留，仅清除关系与图。')) return;
      ctx.state.relations = [];
      projectEntitiesToLegacy(ctx.state);
      ctx.save();
      var detail = $('novelGraphDetail');
      if (detail) detail.textContent = '点击节点或边查看详情';
      panel.renderGraph();
      if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '已清空图谱关系');
    });
  };

  panel.runBuildRagIndex = async function(opts) {
    opts = opts || {};
    var state = ctx.state;
    var cardId = ctx.sm.getBoundCardId();
    if (!cardId) throw new Error('未绑定角色卡');
    var g = gates();
    if (!g.canExtract) throw new Error((g.reasons || []).join('\n') || '前置未完成');
    var api = getApiConfig();
    var $ = ctx.$;
    var btn = $('btnNovelRagIndex');
    ctx.busyFlags.ragIndex = true;
    ctx.setBtnBusy(btn, true, '建索引…');
    if (!state.rag) state.rag = {};
    state.rag.indexStatus = 'building';
    ctx.save();
    panel.render();
    try {
      return await ctx.runTracked({
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
            if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', label || '建索引…');
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
        ctx.save();
        panel.render();
        if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '索引就绪 · ' + (result.mode || 'keyword') + ' · ' + (result.chunkCount || 0) + ' 块');
        return result;
      });
    } catch (e) {
      if (state.rag) state.rag.indexStatus = 'error';
      ctx.save();
      panel.render();
      throw e;
    } finally {
      ctx.busyFlags.ragIndex = false;
      ctx.setBtnBusy(btn, false);
      if (ctx.renderGatesFn) ctx.renderGatesFn();
    }
  };

  panel.runAnalyzeSkeleton = async function(opts) {
    opts = opts || {};
    var state = ctx.state;
    var $ = ctx.$;
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
    ctx.busyFlags.analyzeSkeleton = true;
    ctx.setBtnBusy(btn, true, '骨架扫描…');
    var totalRuns = indexes ? indexes.length : shards.length;
    if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '骨架扫描中（约 ' + totalRuns + ' 次）…');
    try {
      return await ctx.runTracked({
        type: 'novel_analyze_skeleton',
        title: indexes ? '骨架重跑失败片' : '小说骨架扫描',
        target: totalRuns + ' 次',
      }, async function(task) {
        var head = ctx.promptText('novelAnalyzeSkeleton', '输出 entities + relations 骨架 JSON');
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
            + buildAdultContextDigests(state.entities, 2500, getNtlMode(state))
            + buildContentModeFlags(state)
            + '\nMode: ' + state.narrativeMode
            + '\nContext: ' + (state.contextText || '')
            + '\n【章节 ' + shard.chapterTitle + (shard.part > 1 ? ' · 片' + shard.part : '') + '】\n' + shard.text;
          try {
            var text = await ctx.callAI(user, null, task.signal);
            var parsed = parseJsonLoose(text);
            var st = applySkeletonResult(state, parsed);
            totals.add += st.add;
            totals.merge += st.merge;
            totals.relAdd += st.relAdd;
            state.failedShards = (state.failedShards || []).filter(function(f) {
              return !(f.phase === 'skeleton' && f.shardIndex === idx);
            });
          } catch (e) {
            if (ctx.isTrackedAbort(e)) throw e;
            totals.failed++;
            pushFailedShard({
              phase: 'skeleton',
              shardIndex: idx,
              label: (shard.chapterTitle || '章') + (shard.part > 1 ? '#' + shard.part : ''),
              error: String(e.message || e),
            });
          }
          panel.flushAnalyzePreview();
          if (window.__aiTaskCenter__ && task.id) {
            window.__aiTaskCenter__.setProgress(task.id, (ri + 1) / runList.length, (ri + 1) + '/' + runList.length);
          }
          if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '骨架 ' + (ri + 1) + '/' + runList.length
            + ' · 实体 ' + (state.entities || []).length
            + (totals.failed ? ' · 失败 ' + totals.failed : ''));
        }
        if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '骨架完成 · 实体 ' + (state.entities || []).length
          + '（+' + totals.add + '/合' + totals.merge + '）· 关系 +' + totals.relAdd
          + (totals.failed ? ' · 失败 ' + totals.failed : ''));
        panel.render();
        return totals;
      });
    } catch (e) {
      if (ctx.isTrackedAbort(e) && ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '⏹ 已取消骨架扫描');
      throw e;
    } finally {
      ctx.busyFlags.analyzeSkeleton = false;
      ctx.setBtnBusy(btn, false);
      if (queue) queue.style.display = 'none';
      if (ctx.updateExtractCallEstimates) ctx.updateExtractCallEstimates();
      if (ctx.renderGatesFn) ctx.renderGatesFn();
      panel.render();
    }
  };

  panel.runAnalyzeEnrich = async function(opts) {
    opts = opts || {};
    var state = ctx.state;
    var $ = ctx.$;
    var g = gates();
    if (!g.canExtract) throw new Error((g.reasons || []).join('\n') || '前置未完成');
    var api = getApiConfig();
    var cardId = ctx.sm.getBoundCardId();
    var queue = (state.entities || []).slice();
    if (opts.ids && opts.ids.length) {
      var want = {};
      opts.ids.forEach(function(id) { want[id] = true; });
      queue = queue.filter(function(e) { return want[e.id]; });
    } else {
      queue = listEntitiesNeedingEnrich(state.entities, state.strictQuality, getAdultMode(state), getNtlMode(state));
    }
    if (!queue.length) {
      if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '无待丰满实体');
      return { enriched: 0 };
    }
    if (opts.clearFailed !== false && !(opts.ids && opts.ids.length)) clearFailedShards('enrich');
    var btn = $('btnNovelAnalyzeEnrich');
    ctx.busyFlags.analyzeEnrich = true;
    ctx.setBtnBusy(btn, true, '丰满中…');
    if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '实体丰满 ' + queue.length + ' 项…');
    var head = ctx.promptText('novelEnrichEntity', '单实体丰满 JSON');
    var done = 0;
    var failed = 0;
    try {
      return await ctx.runTracked({
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
              budget: state.expandBudget || 12000,
              apiUrl: api.apiUrl,
              apiKey: api.apiKey,
              embedModel: api.embedModel,
              signal: task.signal,
            });
            var related = pickRelatedEntities(state.entities, query, 8);
            var inject = buildRagInjectBlock(search, related, { entityBudget: 3000 });
            var styleNsfw = adultOn ? extractStyleNsfwSection(state.styleText) : '';
            var flavorItems = adultOn ? getNsfwFlavorItems(state) : [];
            var ntlTypes = ntlOn ? getNtlTabooTypes(state) : [];
            var needFlavor = flavorItems.length > 0 && (live.type === 'person' || live.type === 'nsfw');
            var needNtl = ntlTypes.length > 0 && live.type === 'person';
            var user = head
              + '\n\n' + inject
              + styleNsfw
              + buildModeHintBlocks(state, 'enrich')
              + (needFlavor || needNtl ? buildPaletteGuidanceBlock(state) : '')
              + (needFlavor ? buildNsfwFlavorHint(state) : '')
              + (needNtl ? buildNtlTabooHint(state) : '')
              + buildAdultContextDigests(state.entities, 3000, getNtlMode(state))
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
            var text = await ctx.callAI(user, null, task.signal);
            var parsed = parseJsonLoose(text);
            if (needFlavor) {
              var richness = evaluateFlavorRichness(parsed, flavorItems, { presets: NSFW_FLAVOR_PRESETS });
              if (!richness.ok) {
                var expandPrompt = buildFlavorExpandSystemPrompt(flavorItems, { presets: NSFW_FLAVOR_PRESETS })
                  + '\n\n' + buildFlavorExpandUserPrompt({
                    weakDimensions: richness.weakDimensions,
                    minChars: richness.minChars,
                    flavorHint: buildNsfwFlavorHint(state),
                    context: live.type + ' · ' + live.name,
                    text: JSON.stringify(parsed),
                  })
                  + '\n请输出加厚后的完整 JSON 实体（保持 type/name）。';
                var expandText = await ctx.callAI(expandPrompt, null, task.signal);
                var expanded = parseJsonLoose(expandText);
                var richness2 = evaluateFlavorRichness(expanded, flavorItems, { presets: NSFW_FLAVOR_PRESETS });
                if (richness2.total >= richness.total) parsed = expanded;
              }
            }
            if (needNtl) {
              var ntlRich = evaluateNtlRichness(parsed, ntlTypes, { tabooTypes: NTL_TABOO_TYPES });
              if (!ntlRich.ok) {
                var ntlExpandPrompt = buildNtlExpandSystemPrompt(ntlTypes, { tabooTypes: NTL_TABOO_TYPES })
                  + '\n\n' + buildNtlExpandUserPrompt({
                    weakDimensions: ntlRich.weakDimensions,
                    minChars: ntlRich.minChars,
                    ntlHint: buildNtlTabooHint(state),
                    context: live.type + ' · ' + live.name,
                    text: JSON.stringify(parsed),
                  })
                  + '\n请输出加厚后的完整 JSON 实体，写满 attrs.ntl。';
                var ntlExpandText = await ctx.callAI(ntlExpandPrompt, null, task.signal);
                var ntlExpanded = parseJsonLoose(ntlExpandText);
                var ntlRich2 = evaluateNtlRichness(ntlExpanded, ntlTypes, { tabooTypes: NTL_TABOO_TYPES });
                if (ntlRich2.total >= ntlRich.total) parsed = ntlExpanded;
              }
            }
            applyEnrichResult(state, live.id, parsed);
            done++;
            state.failedShards = (state.failedShards || []).filter(function(f) {
              return !(f.phase === 'enrich' && f.entityId === live.id);
            });
          } catch (e) {
            if (ctx.isTrackedAbort(e)) throw e;
            failed++;
            pushFailedShard({
              phase: 'enrich',
              entityId: live.id,
              label: live.name,
              error: String(e.message || e),
            });
          }
          panel.flushAnalyzePreview();
          if (window.__aiTaskCenter__ && task.id) {
            window.__aiTaskCenter__.setProgress(task.id, (i + 1) / queue.length, (i + 1) + '/' + queue.length);
          }
          if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '丰满 ' + (i + 1) + '/' + queue.length + ' · ' + live.name
            + (failed ? ' · 失败 ' + failed : ''));
        }
        if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '丰满完成 · ' + done + '/' + queue.length
          + (failed ? ' · 失败 ' + failed : ''));
        if (ctx.setStatus) ctx.setStatus('novelCharStatus', '已丰满 ' + done + ' 项');
        if (ctx.setStatus) ctx.setStatus('novelWbStatus', '已丰满 ' + done + ' 项');
        panel.render();
        return { enriched: done, total: queue.length, failed: failed };
      });
    } catch (e) {
      if (ctx.isTrackedAbort(e) && ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '⏹ 已取消丰满');
      throw e;
    } finally {
      ctx.busyFlags.analyzeEnrich = false;
      ctx.setBtnBusy(btn, false);
      if (ctx.updateExtractCallEstimates) ctx.updateExtractCallEstimates();
      if (ctx.renderGatesFn) ctx.renderGatesFn();
      panel.render();
    }
  };

  panel.runRetryFailedShards = async function() {
    var state = ctx.state;
    var failed = (state.failedShards || []).slice();
    if (!failed.length) {
      if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '无失败项');
      return { retried: 0 };
    }
    var skIdx = failed.filter(function(f) { return f.phase === 'skeleton'; })
      .map(function(f) { return f.shardIndex; })
      .filter(function(i) { return typeof i === 'number'; });
    var enIds = failed.filter(function(f) { return f.phase === 'enrich' && f.entityId; })
      .map(function(f) { return f.entityId; });
    var out = { skeleton: null, enrich: null };
    if (skIdx.length) {
      out.skeleton = await panel.runAnalyzeSkeleton({ shardIndexes: skIdx, clearFailed: false });
    }
    if (enIds.length) {
      out.enrich = await panel.runAnalyzeEnrich({ ids: enIds, clearFailed: false });
    }
    if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '失败项重跑完成'
      + (skIdx.length ? ' · 骨架 ' + skIdx.length : '')
      + (enIds.length ? ' · 丰满 ' + enIds.length : ''));
    panel.render();
    return out;
  };

  panel.runAnalyzeRelations = async function() {
    var state = ctx.state;
    var g = gates();
    if (!g.canExtract) throw new Error((g.reasons || []).join('\n') || '前置未完成');
    if (!(state.entities || []).length) throw new Error('请先运行骨架扫描');
    var api = getApiConfig();
    var cardId = ctx.sm.getBoundCardId();
    ctx.busyFlags.analyzeRelations = true;
    if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '关系补全中…');
    try {
      return await ctx.runTracked({
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
          budget: state.expandBudget || 12000,
          apiUrl: api.apiUrl,
          apiKey: api.apiKey,
          embedModel: api.embedModel,
          signal: task.signal,
        });
        var prior = buildSkeletonPriorBlock(state);
        var inject = buildRagInjectBlock(search, state.entities.slice(0, 20), { entityBudget: 4000 });
        var head = ctx.promptText('novelAnalyzeRelations', '补全 relations JSON');
        var user = head
          + prior
          + buildModeHintBlocks(state, 'relations')
          + buildAdultContextDigests(state.entities, 2000, getNtlMode(state))
          + '\n\n' + inject
          + buildContentModeFlags(state)
          + '\nContext: ' + (state.contextText || '');
        var text = await ctx.callAI(user, null, task.signal);
        var parsed = parseJsonLoose(text);
        var st = applySkeletonResult(state, { relations: parsed.relations || parsed.edges || [] });
        panel.flushAnalyzePreview();
        if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '关系补全完成 · +' + st.relAdd + ' 条');
        return st;
      });
    } catch (e) {
      if (ctx.isTrackedAbort(e) && ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '⏹ 已取消关系补全');
      throw e;
    } finally {
      ctx.busyFlags.analyzeRelations = false;
      if (ctx.renderGatesFn) ctx.renderGatesFn();
    }
  };

  panel.runAnalyzeAll = async function() {
    var state = ctx.state;
    var $ = ctx.$;
    var g = gates();
    if (!g.canExtract) throw new Error((g.reasons || []).join('\n') || '前置未完成');
    var btn = $('btnNovelAnalyzeAll');
    ctx.busyFlags.analyzeAll = true;
    ctx.setBtnBusy(btn, true, '完整分析…');
    try {
      clearFailedShards();
      if (isRagIndexStale()) {
        if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', 'Step0 · 建索引…');
        try {
          await panel.runBuildRagIndex({});
        } catch (e) {
          if (ctx.isTrackedAbort(e)) throw e;
          if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '向量索引失败，降级关键词…');
          await panel.runBuildRagIndex({ keywordOnly: true });
        }
      } else {
        if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', 'Step0 · 索引仍有效，跳过重建');
      }
      if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', 'Step1 · 骨架扫描…');
      await panel.runAnalyzeSkeleton();
      if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', 'Step2 · 实体丰满…');
      await panel.runAnalyzeEnrich({});
      if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', 'Step3 · 关系补全…');
      await panel.runAnalyzeRelations();
      if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '完整分析完成'
        + ((state.failedShards || []).length ? '（有 ' + state.failedShards.length + ' 项失败可重跑）' : ''));
      return {
        entityCount: (state.entities || []).length,
        relationCount: (state.relations || []).length,
        failed: (state.failedShards || []).length,
      };
    } finally {
      ctx.busyFlags.analyzeAll = false;
      ctx.setBtnBusy(btn, false);
      if (ctx.updateExtractCallEstimates) ctx.updateExtractCallEstimates();
      if (ctx.renderGatesFn) ctx.renderGatesFn();
    }
  };

  ctx.panels.analyze = panel;
}
