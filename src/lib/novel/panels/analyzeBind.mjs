import { projectEntitiesToLegacy } from '../entityStore.mjs';
import { relayoutGraph } from '../graphViz.mjs';
import {
  buildStatusBarNsfwDraftFromEntities, buildStatusBarNtlDraftFromEntities,
  buildStatusBarVesselDraftFromEntities, resolveWorldframe,
} from '../nsfwSupport.mjs';

/**
 * attachNovelAnalyzeBind（拆自原模块）
 */
export function attachNovelAnalyzeBind(ctx, panel, graphRef) {
  panel.bind = function() {
    var $ = ctx.$;
    var mode = $('novelAnalyzeShardMode');
    if (mode) mode.addEventListener('change', function() {
      var state = ctx.state;
      state.analyzeShardMode = mode.value === 'chapters' ? 'chapters' : 'chars';
      if (ctx.syncShardModeUi) ctx.syncShardModeUi('novelAnalyze', state.analyzeShardMode);
      ctx.save();
      if (ctx.updateExtractCallEstimates) ctx.updateExtractCallEstimates();
    });
    var chunk = $('novelAnalyzeChunkSize');
    if (chunk) chunk.addEventListener('change', function() {
      ctx.state.analyzeChunkSize = parseInt(chunk.value, 10) || 8000;
      ctx.save();
      if (ctx.updateExtractCallEstimates) ctx.updateExtractCallEstimates();
    });
    var per = $('novelAnalyzeChaptersPerShard');
    if (per) {
      per.addEventListener('change', function() {
        ctx.state.analyzeChaptersPerShard = Math.max(1, Math.floor(parseInt(per.value, 10) || 1));
        per.value = String(ctx.state.analyzeChaptersPerShard);
        ctx.save();
        if (ctx.updateExtractCallEstimates) ctx.updateExtractCallEstimates();
      });
      per.addEventListener('input', function() {
        ctx.state.analyzeChaptersPerShard = Math.max(1, Math.floor(parseInt(per.value, 10) || 1));
        if (ctx.updateExtractCallEstimates) ctx.updateExtractCallEstimates();
      });
    }
    var skOnly = $('novelAnalyzeSkeletonOnly');
    if (skOnly) skOnly.addEventListener('change', function() {
      if (ctx.updateExtractCallEstimates) ctx.updateExtractCallEstimates();
    });
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
      var state = ctx.state;
      showStatusBarDraft(
        buildStatusBarNsfwDraftFromEntities(state.entities, state.setupCharName || ''),
        'st_v3_nsfw_status_draft'
      );
    });
    var ntlDraftBtn = $('btnNovelNtlStatusDraft');
    if (ntlDraftBtn) ntlDraftBtn.addEventListener('click', function() {
      var state = ctx.state;
      showStatusBarDraft(
        buildStatusBarNtlDraftFromEntities(state.entities, state.setupCharName || ''),
        'st_v3_ntl_status_draft'
      );
    });
    var vesselDraftBtn = $('btnNovelVesselStatusDraft');
    if (vesselDraftBtn) vesselDraftBtn.addEventListener('click', function() {
      var state = ctx.state;
      var wf = resolveWorldframe(state);
      showStatusBarDraft(
        buildStatusBarVesselDraftFromEntities(state.entities, { worldframe: wf.id }),
        'st_v3_vessel_status_draft'
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
    if (allBtn) allBtn.addEventListener('click', function() {
      var state = ctx.state;
      var modeEl = $('novelAnalyzeShardMode');
      var chunk = $('novelAnalyzeChunkSize');
      var per = $('novelAnalyzeChaptersPerShard');
      if (modeEl) modeEl.value = state.analyzeShardMode === 'chapters' ? 'chapters' : 'chars';
      if (chunk) chunk.value = String(state.analyzeChunkSize || 8000);
      if (per) per.value = String(state.analyzeChaptersPerShard || 1);
      if (ctx.syncShardModeUi) ctx.syncShardModeUi('novelAnalyze', state.analyzeShardMode);
      if (ctx.updateExtractCallEstimates) ctx.updateExtractCallEstimates();
      var skOnly = $('novelAnalyzeSkeletonOnly');
      if (skOnly) skOnly.checked = false;
      ctx.openNovelModal('novelModalAnalyze');
    });
    var analyzeConfirm = $('btnNovelAnalyzeConfirm');
    if (analyzeConfirm) analyzeConfirm.addEventListener('click', async function() {
      if (ctx.busyFlags.analyzeAll || ctx.busyFlags.analyzeSkeleton) return;
      var skOnly = $('novelAnalyzeSkeletonOnly');
      ctx.closeNovelModal('novelModalAnalyze');
      try {
        if (skOnly && skOnly.checked) await panel.runAnalyzeSkeleton();
        else await panel.runAnalyzeAll();
      } catch (e) {
        if (!ctx.isTrackedAbort(e)) {
          alert((skOnly && skOnly.checked ? '骨架' : '完整') + '分析失败: ' + (e.message || e));
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
      relayoutGraph(graphRef.cy);
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


}
