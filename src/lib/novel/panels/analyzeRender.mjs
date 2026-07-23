import { getPipelineGates, WB_FOCUS_OPTIONS } from '../state.mjs';
import { buildExtractShards, estimateExtractCalls, chaptersSourceFingerprint } from '../chapters.mjs';
import { emptyKnowledgeGraph } from '../graphMerge.mjs';
import { mountOrUpdateGraph, relayoutGraph, filterKnowledgeGraphByTypes } from '../graphViz.mjs';
import { countEntitiesByType, isEntityEnriched, ENTITY_TYPES, projectEntitiesToLegacy } from '../entityStore.mjs';
import { getAdultMode } from '../nsfwSupport.mjs';
import { escapeHtml } from '../../utils.mjs';
import { getEmbeddingConfig, EMBEDDING_API_URL_KEY, EMBEDDING_API_KEY_KEY, EMBEDDING_MODEL_KEY } from '../rag/embeddingConfig.mjs';
import { ENTITY_TYPE_ZH } from './analyzeShared.mjs';

/**
 * attachNovelAnalyzeRender（拆自原模块）
 */
export function attachNovelAnalyzeRender(ctx, panel, graphRef) {

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
    if (ctx.syncShardModeUi) {
      ctx.syncShardModeUi(prefix, mode);
      return;
    }
    var $ = ctx.$;
    var byChars = mode !== 'chapters';
    var sizeWrap = $(prefix + 'ChunkSizeWrap');
    var chWrap = $(prefix + 'ChaptersPerShardWrap');
    var modeEl = $(prefix + 'ShardMode');
    var grid = modeEl && modeEl.closest ? modeEl.closest('.grid-3') : null;
    if (grid) grid.setAttribute('data-shard-mode', byChars ? 'chars' : 'chapters');
    if (sizeWrap) {
      sizeWrap.hidden = !byChars;
      sizeWrap.style.display = byChars ? '' : 'none';
    }
    if (chWrap) {
      chWrap.hidden = byChars;
      chWrap.style.display = byChars ? 'none' : '';
    }
  }

  function gates() {
    var state = ctx.state;
    return getPipelineGates(state);
  }

  panel.getApiConfig = getApiConfig;
  panel.isRagIndexStale = isRagIndexStale;
  panel.analyzeShardOpts = analyzeShardOpts;
  panel.pushFailedShard = pushFailedShard;
  panel.clearFailedShards = clearFailedShards;

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
      var groups = [];
      var head = '索引：' + statusZh;
      if (rag.chunkCount) head += ' · ' + rag.chunkCount + ' 块';
      groups.push(head);
      if (rag.embedModel) groups.push(String(rag.embedModel));
      if (rag.indexUpdatedAt) groups.push(String(rag.indexUpdatedAt).slice(0, 19).replace('T', ' '));
      if (stale && status === 'ready') groups.push('章节已变，请重建');
      ragInfo.innerHTML = groups.map(function(t) {
        return '<span class="novel-meta-group">' + escapeHtml(t) + '</span>';
      }).join('');
    }

    var failed = state.failedShards || [];
    var failTag = $('btnNovelAnalyzeFailTag');
    var failCount = $('novelAnalyzeFailCount');
    var retryBtn = $('btnNovelRetryFailed');
    if (failCount) failCount.textContent = String(failed.length);
    if (failTag) {
      failTag.hidden = !failed.length;
      failTag.title = failed.length ? ('失败 ' + failed.length + ' 项，点击查看') : '无失败项';
    }
    if (retryBtn) retryBtn.hidden = !failed.length;
    panel.renderFailedShardsList();

    var personOnlyEl = $('novelGraphPersonOnly');
    if (personOnlyEl && document.activeElement !== personOnlyEl) {
      personOnlyEl.checked = !!ctx.editState.graphPersonOnly;
    }

    var counts = countEntitiesByType(state.entities);
    var relN = (state.relations || []).length;
    var enriched = (state.entities || []).filter(function(e) {
      return isEntityEnriched(e, !!state.strictQuality, getAdultMode(state));
    }).length;
    var summary = $('novelAnalyzeSummary');
    if (summary) {
      summary.textContent = '实体 ' + ((state.entities || []).length) + '（已丰满 ' + enriched + '）';
    }
    var breakdown = $('novelAnalyzeTypeBreakdown');
    if (breakdown) {
      var parts = ENTITY_TYPES.filter(function(t) { return counts[t]; }).map(function(t) {
        return (ENTITY_TYPE_ZH[t] || t) + ' ' + counts[t];
      });
      if (relN) parts.push('关系 ' + relN);
      breakdown.textContent = parts.length ? parts.join(' · ') : '—';
    }
  };

  panel.renderFailedShardsList = function() {
    var state = ctx.state;
    var $ = ctx.$;
    var failed = state.failedShards || [];
    var summary = $('novelAnalyzeFailsSummary');
    var list = $('novelAnalyzeFailsList');
    if (summary) {
      summary.textContent = failed.length
        ? ('共 ' + failed.length + ' 项失败。可关闭后点标题旁徽章再次打开，或直接「重跑失败」。')
        : '暂无失败项';
    }
    if (!list) return;
    if (!failed.length) {
      list.innerHTML = '<li class="novel-fail-empty">暂无失败记录</li>';
      return;
    }
    var phaseZh = { skeleton: '骨架', enrich: '丰满', relations: '关系', rag: '索引' };
    list.innerHTML = failed.map(function(f) {
      var phase = phaseZh[f.phase] || f.phase || '未知';
      var label = f.label || f.entityId || (f.shardIndex != null ? ('分片 #' + f.shardIndex) : '（无标签）');
      var err = f.error || '未知错误';
      return '<li>'
        + '<span class="novel-fail-phase">' + escapeHtml(phase) + '</span>'
        + '<span class="novel-fail-label">' + escapeHtml(String(label)) + '</span>'
        + '<span class="novel-fail-error">' + escapeHtml(String(err)) + '</span>'
        + '</li>';
    }).join('');
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
    if (ctx.editState.graphPersonOnly) {
      g = filterKnowledgeGraphByTypes(g, ['person']);
    }
    var n = (g.nodes || []).length;
    var e = (g.edges || []).length;
    var stats = $('novelGraphStats');
    if (stats) stats.textContent = '节点 ' + n + ' · 边 ' + e;

    var container = $('novelGraphCy');
    if (!container) return;
    graphRef.cy = mountOrUpdateGraph(container, g, graphRef.cy, {
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


}
