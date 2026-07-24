/**
 * 写作会话：统一模式入口（写本章 / 进下一章 / 连写 N / 质检 / 改写）
 */

import { state, ui, $, setStatus, persistNovel } from './shared.mjs';
import {
  writeChapter,
  writeBatchChapters,
  collectWriteFromDom,
  collectLedgerFromDom,
} from './writeActions.mjs';
import { renderRead } from './renderViews.mjs';
import {
  renderWrite,
  setWriteProgress,
  syncWriteSessionBar,
  showCenteredModal,
  hideCenteredModal,
} from './writeBranchUi.mjs';

export var WRITE_MODES = {
  chapter: 'chapter',
  next: 'next',
  batch: 'batch',
  qa: 'qa',
  rewrite: 'rewrite',
};

export var WRITE_MODE_LABELS = {
  chapter: '写本章',
  next: '写完进下一章',
  batch: '连续写 N 章',
  qa: '仅质检',
  rewrite: '按质检改写',
};

export function getSelectedWriteMode() {
  var checked = document.querySelector('input[name="ssWriteMode"]:checked');
  var v = checked ? checked.value : WRITE_MODES.chapter;
  return WRITE_MODES[v] ? v : WRITE_MODES.chapter;
}

export function openWriteConfig() {
  var modal = $('ssWriteConfigModal');
  if (!modal) return;
  ui.writeConfigOpen = true;
  syncWriteConfigFromSettings();
  showCenteredModal('ssWriteConfigModal');
  var run = $('btnSsWriteRun');
  if (run) try { run.focus(); } catch (e) { /* ignore */ }
}

export function closeWriteConfig() {
  ui.writeConfigOpen = false;
  hideCenteredModal('ssWriteConfigModal');
}

export function toggleWriteConfig() {
  if (ui.writeConfigOpen) closeWriteConfig();
  else openWriteConfig();
}

export function syncWriteConfigFromSettings() {
  if (!state.novel) return;
  var ws = state.novel.writeSettings || {};
  var batchEl = $('ssWriteBatchCount');
  var feedEl = $('ssWriteRunFeed');
  var qaEl = $('ssWriteRunQa');
  var stopEl = $('ssWriteStopOnQa');
  var syncEl = $('ssWriteSyncMvu');
  var advEl = $('ssWriteAdvancePrompt');
  var sel = $('ssWriteChapterSelect');
  var ch = state.novel.chapters.find(function(c) {
    return c.id === (ui.writeChapterId || (sel && sel.value) || '');
  });
  if (advEl) advEl.value = ch ? (ch.advancePrompt || '') : '';
  if (batchEl) batchEl.value = String(ws.batchCount || 3);
  if (feedEl) feedEl.checked = ws.runFeedForward !== false;
  if (qaEl) qaEl.checked = ws.runQuality !== false;
  if (stopEl) stopEl.checked = !!ws.stopOnQualityFail;
  if (syncEl) syncEl.checked = !!ws.syncMvuStatusBar;
  updateWriteModeUi();
}

export function updateWriteModeUi() {
  var mode = getSelectedWriteMode();
  var batchRow = $('ssWriteBatchRow');
  if (batchRow) batchRow.hidden = mode !== WRITE_MODES.batch;
  var feedRow = $('ssWriteOptFeed');
  var qaRow = $('ssWriteOptQa');
  var stopRow = $('ssWriteOptStop');
  var hidePipelineOpts = mode === WRITE_MODES.qa || mode === WRITE_MODES.rewrite;
  if (feedRow) feedRow.hidden = hidePipelineOpts;
  if (qaRow) qaRow.hidden = mode === WRITE_MODES.qa;
  if (stopRow) stopRow.hidden = mode !== WRITE_MODES.batch;
}

export function applyWriteConfigToSettings() {
  if (!state.novel) return;
  collectWriteFromDom({ skipContent: true });
}

/** 主 CTA：打开配置弹窗 */
export async function onWritePrimaryClick() {
  if (ui.writeBusy) {
    setStatus('写作进行中，请到任务中心取消', { panel: 'write' });
    return;
  }
  openWriteConfig();
}

export async function runWriteSession() {
  if (ui.writeBusy) return;
  if (!state.novel) {
    setStatus('请先打开小说', { panel: 'write' });
    return;
  }
  applyWriteConfigToSettings();
  var mode = getSelectedWriteMode();
  var modeLabel = WRITE_MODE_LABELS[mode] || '写作';
  closeWriteConfig();

  ui.writeSession = {
    mode: mode,
    modeLabel: modeLabel,
    step: 'plan',
    batchIndex: 1,
    batchTotal: mode === WRITE_MODES.batch
      ? Math.max(1, Math.min(20, (state.novel.writeSettings && state.novel.writeSettings.batchCount) || 3))
      : 1,
  };
  syncWriteSessionBar();

  if (mode === WRITE_MODES.batch) {
    await writeBatchChapters();
  } else if (mode === WRITE_MODES.next) {
    await writeChapter(true);
  } else if (mode === WRITE_MODES.qa) {
    await writeChapter(false, { skipDraft: true, skipFeed: true });
  } else if (mode === WRITE_MODES.rewrite) {
    await writeChapter(false, { rewriteOnly: true });
  } else {
    await writeChapter(false);
  }

  ui.writeSession = null;
  setWriteProgress(null);
  syncWriteSessionBar();
}

export async function saveWriteManually() {
  if (ui.writeBusy) {
    setStatus('写作进行中，完成后才能保存手工修改', { panel: 'write' });
    return;
  }
  collectWriteFromDom();
  collectLedgerFromDom();
  await persistNovel();
  setStatus('章节已保存', { panel: 'write' });
  renderWrite();
  renderRead();
}
