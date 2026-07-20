/**
 * 原始资料面板：渲染、绑定、输入同步
 * 注意：NSFW/NTL/worldframe 由卡侧 AdultConfig 经 nsfw-config-changed 下推；
 * 本面板 render 不得回写口味（避免冲掉多选 note）。
 */
import { escapeHtml } from '../../utils.mjs';
import { DEFAULT_EXPAND_BUDGET } from '../recall.mjs';
import { createDefaultNovelState } from '../state.mjs';

/**
 * @param {object} ctx — 小说工坊上下文（由 shared/context.mjs 创建，含 $、save、busyFlags 等）
 */
export function registerSource(ctx) {
  var panel = {};

  panel.render = function() {
    var state = ctx.state;
    var src = ctx.$('novelSourceText');
    var ctxEl = ctx.$('novelContextText');
    if (src) src.value = state.sourceText || '';
    if (ctxEl) ctxEl.value = state.contextText || '';
    var mode = ctx.$('novelNarrativeMode');
    var conc = ctx.$('novelConcurrency');
    var budget = ctx.$('novelExpandBudget');
    var strict = ctx.$('novelStrictQuality');
    if (mode) mode.value = state.narrativeMode || 'story';
    if (conc) conc.value = String(state.concurrency || 3);
    if (budget) budget.value = String(state.expandBudget || DEFAULT_EXPAND_BUDGET);
    if (strict) strict.checked = !!state.strictQuality;

    var summary = ctx.$('novelFileSummary');
    var clearBtn = ctx.$('btnNovelClearFile');
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

    var bar = ctx.$('novelStatsBar');
    if (bar) {
      var g = ctx.gates();
      bar.innerHTML = [
        '<span class="novel-stat-chip">' + (g.sourceLen ? (g.sourceLen + ' 字') : '等待导入文本') + '</span>',
        '<span class="novel-stat-chip">章节 ' + g.enabledChapterCount + '/' + g.chapterCount + '</span>',
        '<span class="novel-stat-chip">人物 ' + g.characterCount + '</span>',
        '<span class="novel-stat-chip">世界书草稿 ' + g.wbEntryCount + '</span>',
      ].join('');
    }
  };

  panel.syncInputs = function() {
    var state = ctx.state;
    var src = ctx.$('novelSourceText');
    var ctxEl = ctx.$('novelContextText');
    if (src) state.sourceText = src.value;
    if (ctxEl) state.contextText = ctxEl.value;
    var mode = ctx.$('novelNarrativeMode');
    var conc = ctx.$('novelConcurrency');
    var budget = ctx.$('novelExpandBudget');
    var strict = ctx.$('novelStrictQuality');
    if (mode) state.narrativeMode = mode.value;
    if (conc) state.concurrency = Math.max(1, parseInt(conc.value, 10) || 3);
    if (budget) state.expandBudget = Math.max(1000, parseInt(budget.value, 10) || DEFAULT_EXPAND_BUDGET);
    if (strict) state.strictQuality = !!strict.checked;
    ctx.save();
    ctx.renderGatesFn();
    panel.render();
  };

  panel.bind = function() {
    var state = ctx.state;

    ['novelSourceText', 'novelContextText', 'novelNarrativeMode', 'novelConcurrency', 'novelExpandBudget', 'novelStrictQuality']
      .forEach(function(id) {
        var el = ctx.$(id);
        if (!el) return;
        el.addEventListener('change', panel.syncInputs);
        el.addEventListener('input', panel.syncInputs);
      });

    var fileEl = ctx.$('novelSourceFile');
    var drop = ctx.$('novelDropzone');
    function loadFile(f) {
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function(ev) {
        state.fileText = String(ev.target.result || '');
        state.fileMeta = { name: f.name };
        ctx.save();
        ctx.renderAll();
        ctx.setStatus('novelSourceStatus', '已导入 ' + f.name);
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
    var clearBtn = ctx.$('btnNovelClearFile');
    if (clearBtn) clearBtn.addEventListener('click', function() {
      state.fileText = '';
      state.fileMeta = null;
      if (fileEl) fileEl.value = '';
      ctx.save();
      ctx.renderAll();
    });
    var reset = ctx.$('btnNovelResetAll');
    if (reset) reset.addEventListener('click', function() {
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
      };
      state = Object.assign(createDefaultNovelState(), keep);
      ctx.state = state;
      ctx.save();
      ctx.renderAll();
    });
  };

  ctx.panels.source = panel;
  return panel;
}
