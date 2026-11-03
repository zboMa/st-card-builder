/**
 * 原始资料面板：快照发布 + 无 DOM API
 * 注意：NSFW/NTL/worldframe 由卡侧 AdultConfig 经 nsfw-config-changed 下推；
 * 本面板 render 不得回写口味（避免冲掉多选 note）。
 */
import { DEFAULT_EXPAND_BUDGET } from '../recall.mjs';
import { createDefaultNovelState } from '../state.mjs';
import { engineTryAllowed } from '../../actionEngine/helpers.mjs';
import { novelSourceStore, patchNovelSource } from '../../store/novelSourceStore.mjs';
import { buildSourceView } from './sourceViewModel.mjs';

/**
 * @param {object} ctx — 小说工坊上下文
 */
export function registerSource(ctx) {
  var panel = {};

  function publish() {
    var gates = typeof ctx.gates === 'function' ? ctx.gates() : null;
    patchNovelSource(buildSourceView(ctx.state, gates, novelSourceStore.get()));
  }

  function setStatus(msg) {
    patchNovelSource({ status: String(msg || '') });
  }

  function refreshAfterWrite() {
    if (ctx.save) ctx.save();
    if (ctx.renderGatesFn) ctx.renderGatesFn();
    publish();
  }

  panel.render = function() {
    publish();
  };

  /**
   * 单字段更新；Vue 输入直接走这里，不再读写 DOM。
   * @param {string} key
   * @param {any} value
   */
  function setField(key, value) {
    var state = ctx.state;
    if (key === 'sourceText' || key === 'contextText') {
      state[key] = String(value != null ? value : '');
    } else if (key === 'narrativeMode') {
      state.narrativeMode = String(value || 'story');
    } else if (key === 'concurrency') {
      state.concurrency = Math.max(1, parseInt(value, 10) || 3);
    } else if (key === 'expandBudget') {
      state.expandBudget = Math.max(1000, parseInt(value, 10) || DEFAULT_EXPAND_BUDGET);
    } else if (key === 'strictQuality') {
      state.strictQuality = value === true || value === 'true';
    } else {
      return false;
    }
    refreshAfterWrite();
    return true;
  }

  function renderAllAfterWrite() {
    if (ctx.renderAll) ctx.renderAll();
    else refreshAfterWrite();
  }

  function loadFile(file) {
    if (!file) return false;
    if (!engineTryAllowed('lifecycle.novel.source.upload').ok) return false;
    var reader = new FileReader();
    reader.onload = function(ev) {
      ctx.state.fileText = String(ev.target.result || '');
      ctx.state.fileMeta = { name: file.name };
      renderAllAfterWrite();
      setStatus('已导入 ' + file.name);
      publish();
    };
    reader.readAsText(file);
    return true;
  }

  function clearFile() {
    if (!engineTryAllowed('lifecycle.novel.source.clear').ok) return false;
    ctx.state.fileText = '';
    ctx.state.fileMeta = null;
    renderAllAfterWrite();
    return true;
  }

  function resetAll() {
    if (!engineTryAllowed('lifecycle.novel.source.reset').ok) return false;
    if (!confirm('重置并清空结果：清空章节/人物/世界书草稿/知识图谱/文风等产出，保留原文与分片等配置？')) return false;
    var state = ctx.state;
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
    var next = Object.assign(createDefaultNovelState(), keep);
    Object.keys(state).forEach(function(key) { delete state[key]; });
    Object.assign(state, next);
    renderAllAfterWrite();
    publish();
    return true;
  }

  function setDragging(dragging) {
    patchNovelSource({ dragging: !!dragging });
  }

  panel.bind = function() {
    window.__novelSourceApi__ = {
      refresh: function() { publish(); },
      setField: setField,
      loadFile: loadFile,
      clearFile: clearFile,
      resetAll: resetAll,
      setDragging: setDragging,
    };
    publish();
  };

  ctx.panels.source = panel;
  return panel;
}
