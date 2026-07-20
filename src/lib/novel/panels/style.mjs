/**
 * 文风面板：渲染、绑定、蒸馏
 */
import { buildSetupCorpus, chaptersSourceFingerprint } from '../chapters.mjs';
import { styleToWorldbookDraft } from '../sync.mjs';
import {
  getAdultMode,
  getNtlMode,
  buildContentModeFlags,
  buildModeHintBlocks,
  buildAdultContextDigests,
  buildNtlTabooHint,
  buildPaletteGuidanceBlock,
  buildNsfwFlavorHint,
} from '../nsfwSupport.mjs';
import { parseJsonLoose } from '../../utils.mjs';

/**
 * @param {object} ctx — 小说工坊上下文（由 shared/context.mjs 创建，含 $、save、busyFlags 等）
 */
export function registerStyle(ctx) {
  var panel = {};

  panel.render = function() {
    var state = ctx.state;
    var custom = ctx.$('novelStyleCustom');
    var text = ctx.$('novelStyleText');
    var chunk = ctx.$('novelStyleChunkSize');
    var policy = ctx.$('novelStyleConflictPolicy');
    var badge = ctx.$('novelStyleSyncBadge');
    if (custom) custom.value = state.styleCustomReq || '';
    if (text && document.activeElement !== text) text.value = state.styleText || '';
    if (chunk) chunk.value = String(state.styleChunkSize || 16000);
    if (policy) policy.value = state.conflictPolicy || 'merge';
    if (badge) {
      badge.className = 'novel-sync-badge ' + (state.styleSyncStatus || 'unsynced');
      badge.textContent = state.styleSyncStatus === 'synced' ? '已同步' : (state.styleSyncStatus === 'dirty' ? '有本地修改' : '未同步');
    }
  };

  panel.bind = function() {
    var state = ctx.state;
    var custom = ctx.$('novelStyleCustom');
    if (custom) custom.addEventListener('input', function() { state.styleCustomReq = custom.value; ctx.save(); });

    var styleChunk = ctx.$('novelStyleChunkSize');
    if (styleChunk) styleChunk.addEventListener('change', function() {
      state.styleChunkSize = parseInt(styleChunk.value, 10) || 16000;
      ctx.save();
    });

    var stylePolicy = ctx.$('novelStyleConflictPolicy');
    if (stylePolicy) stylePolicy.addEventListener('change', function() {
      state.conflictPolicy = stylePolicy.value;
      ctx.save();
      if (ctx.panels.characters) ctx.panels.characters.render();
      if (ctx.panels.worldbook) ctx.panels.worldbook.render();
    });

    var text = ctx.$('novelStyleText');
    if (text) text.addEventListener('input', function() {
      state.styleText = text.value;
      state.styleSyncStatus = state.styleSyncStatus === 'synced' ? 'dirty' : (state.styleSyncStatus || 'unsynced');
      ctx.save();
      panel.render();
    });

    var distill = ctx.$('btnStyleDistill');
    if (distill) distill.addEventListener('click', async function() {
      if (ctx.busyFlags.styleDistill) return;
      try {
        await panel.runDistill();
      } catch (e) {
        if (!ctx.isTrackedAbort(e)) {
          alert('蒸馏失败: ' + e.message);
          ctx.setStatus('novelStyleStatus', '蒸馏失败');
        }
      }
    });

    var syncStyle = ctx.$('btnSyncStyle');
    if (syncStyle) syncStyle.addEventListener('click', function() {
      try {
        var r = ctx.syncOutputs({ target: 'style' });
        if (r.skipped) ctx.setStatus('novelStyleStatus', '文风已跳过（冲突策略=跳过）');
        else ctx.setStatus('novelStyleStatus', '已同步为世界书「文风」条目');
      } catch (e) {
        alert(e.message || '同步失败');
      }
    });

    var copy = ctx.$('btnStyleCopy');
    if (copy) copy.addEventListener('click', async function() {
      try {
        await navigator.clipboard.writeText(state.styleText || '');
        ctx.setStatus('novelStyleStatus', '已复制');
      } catch (e) {
        alert('复制失败');
      }
    });

    var dl = ctx.$('btnStyleDownload');
    if (dl) dl.addEventListener('click', function() {
      var blob = new Blob([state.styleText || ''], { type: 'text/markdown;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'novel-style.md';
      a.click();
    });
  };

  /** 文风蒸馏 */
  panel.runDistill = async function() {
    var state = ctx.state;
    var g = ctx.gates();
    if (!g.canExtract) throw new Error((g.reasons || []).join('\n') || '前置未完成');
      ctx.setStatus('novelStyleStatus', '蒸馏中...');
    var styleBtn = ctx.$('btnStyleDistill');
    ctx.busyFlags.styleDistill = true;
    ctx.setBtnBusy(styleBtn, true, '蒸馏中…');
    try {
      return await ctx.runTracked({
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
        var head = ctx.promptText(
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
          + (adultOn ? buildPaletteGuidanceBlock(state) : '')
          + (adultOn ? buildNsfwFlavorHint(state) : '')
          + buildNtlTabooHint(state)
          + buildAdultContextDigests(state.entities, 4000, getNtlMode(state));
        var out = await ctx.callAI(user, null, task.signal);
        state.styleText = out.trim();
        state.styleSyncStatus = 'unsynced';
        ctx.save();
        ctx.renderAll();
        ctx.setStatus('novelStyleStatus', '蒸馏完成');
        return { styleLen: state.styleText.length };
      });
    } catch (e) {
      if (ctx.isTrackedAbort(e)) ctx.setStatus('novelStyleStatus', '⏹ 已取消蒸馏');
      throw e;
    } finally {
      ctx.busyFlags.styleDistill = false;
      ctx.setBtnBusy(styleBtn, false);
      if (ctx.renderGatesFn) ctx.renderGatesFn();
    }
  };

  // 挂载到 ctx
  ctx.panels.style = panel;
  return panel;
}
