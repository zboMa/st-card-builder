/**
 * 小说创作模块控制器：boot + 事件绑定
 * 渲染 / CRUD / 写作流水线已拆至同目录模块。
 */

import { genStoryId, syncChaptersFromOutline, discardOutlineFrom, getActiveChapters, getActiveOutline } from './state.mjs';
import { restoreChapterCheckpoint } from './checkpoint.mjs';
import { createLedgerItem } from './plotLedger.mjs';
import { setActiveBranch, getBranch } from './branch.mjs';
import { showSsConfirm, showSsPrompt } from './dialogs.mjs';
import { relayoutStoryGraph } from './graphView.mjs';
import {
  state,
  ui,
  $,
  setStatus,
  persistNovel,
  reloadCatalog,
} from './shared.mjs';
import {
  renderAll,
  renderGraph,
  renderOutline,
  renderRead,
  setReadTocOpen,
} from './renderViews.mjs';
import {
  closeBranchTreePopover,
  openBranchTreePopover,
  closeLedgerPopover,
  openLedgerPopover,
  closeAllWriteToolPopovers,
  openWriteToolPopover,
  renderBranchTree,
  renderWrite,
  setWriteTocOpen,
  enterWriteContentEdit,
} from './writeBranchUi.mjs';
import {
  openNovel,
  createNovel,
  renameNovel,
  removeNovel,
  bumpNovel,
  publishNovel,
  openNovelVersionMenu,
  shareNovel,
  unshareNovel,
  exportNovel,
} from './manageActions.mjs';
import {
  collectOutlineFromDom,
  collectWriteFromDom,
  collectLedgerFromDom,
  seedGraph,
  promptAndGenerateOutline,
  generateOutline,
  forkCurrentChapterBranch,
} from './writeActions.mjs';
import {
  onWritePrimaryClick,
  runWriteSession,
  saveWriteManually,
  closeWriteConfig,
  updateWriteModeUi,
} from './writeSession.mjs';
import {
  bindStoryGraphUi,
  openEditNodeDialog,
  openEditEdgeDialog,
} from './graphUi.mjs';

function bindEvents() {
  var root = document.getElementById('storyStudioRoot') || document;

  var btnNew = $('btnSsNewNovel');
  if (btnNew) btnNew.addEventListener('click', function() { createNovel(); });
  var btnNewWiz = $('btnSsNewNovelWizard');
  if (btnNewWiz) btnNewWiz.addEventListener('click', function() { createNovel({ wizard: true }); });

  var list = $('ssNovelList');
  if (list) {
    list.addEventListener('click', function(ev) {
      var btn = ev.target.closest('[data-ss-act]');
      if (!btn) return;
      var item = btn.closest('[data-novel-id]');
      if (!item) return;
      var id = item.getAttribute('data-novel-id');
      var act = btn.getAttribute('data-ss-act');
      if (act === 'open') openNovel(id);
      else if (act === 'rename') renameNovel(id);
      else if (act === 'bump') bumpNovel(id);
      else if (act === 'publish') publishNovel(id);
      else if (act === 'versions') openNovelVersionMenu(btn, id);
      else if (act === 'share') shareNovel(id);
      else if (act === 'reset-share') shareNovel(id, { resetToken: true });
      else if (act === 'unshare') unshareNovel(id);
      else if (act === 'export') exportNovel(id);
      else if (act === 'delete') removeNovel(id);
    });
    list.addEventListener('keydown', function(ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      var openBtn = ev.target.closest('[data-ss-act="open"]');
      if (!openBtn) return;
      ev.preventDefault();
      var item = openBtn.closest('[data-novel-id]');
      if (!item) return;
      openNovel(item.getAttribute('data-novel-id'));
    });
  }

  var btnSeed = $('btnSsSeedGraph');
  if (btnSeed) btnSeed.addEventListener('click', function() { seedGraph(); });

  var btnAddNode = $('btnSsAddNode');
  if (btnAddNode) {
    btnAddNode.addEventListener('click', function() {
      if (!state.novel) {
        setStatus('请先打开小说', true);
        return;
      }
      openEditNodeDialog(null);
    });
  }

  var btnAddEdge = $('btnSsAddEdge');
  if (btnAddEdge) {
    btnAddEdge.addEventListener('click', function() {
      if (!state.novel) {
        setStatus('请先打开小说', true);
        return;
      }
      openEditEdgeDialog({});
    });
  }

  var btnSaveGraph = $('btnSsSaveGraph');
  if (btnSaveGraph) {
    btnSaveGraph.addEventListener('click', async function() {
      if (!state.novel) return;
      await persistNovel();
      setStatus('图谱已保存');
      renderGraph();
    });
  }
  var btnRelayout = $('btnSsGraphRelayout');
  if (btnRelayout) {
    btnRelayout.addEventListener('click', function() {
      relayoutStoryGraph();
      setStatus('已重新布局');
    });
  }

  bindStoryGraphUi();

  var btnOlGen = $('btnSsOutlineGen');
  if (btnOlGen) btnOlGen.addEventListener('click', function() { promptAndGenerateOutline('segment'); });
  var btnOlCont = $('btnSsOutlineContinue');
  if (btnOlCont) btnOlCont.addEventListener('click', function() { promptAndGenerateOutline('continue'); });
  var btnOlAdd = $('btnSsOutlineAdd');
  if (btnOlAdd) {
    btnOlAdd.addEventListener('click', async function() {
      if (!state.novel) return;
      collectOutlineFromDom();
      var branchId = state.novel.activeBranchId;
      var visible = getActiveOutline(state.novel);
      var nextOrder = visible.length
        ? (typeof visible[visible.length - 1].order === 'number'
          ? visible[visible.length - 1].order + 1
          : visible.length)
        : 0;
      state.novel.outline.push({
        id: genStoryId('ol'),
        title: '第' + (visible.length + 1) + '章',
        summary: '',
        order: nextOrder,
        branchId: branchId,
      });
      state.novel = syncChaptersFromOutline(state.novel);
      await persistNovel();
      renderOutline();
      renderWrite();
    });
  }
  var btnOlSave = $('btnSsOutlineSave');
  if (btnOlSave) {
    btnOlSave.addEventListener('click', async function() {
      if (!state.novel) return;
      collectOutlineFromDom();
      state.novel = syncChaptersFromOutline(state.novel);
      await persistNovel();
      setStatus('大纲已保存');
      renderAll();
    });
  }

  var olList = $('ssOutlineList');
  if (olList) {
    olList.addEventListener('click', async function(ev) {
      if (!state.novel) return;
      var editTitle = ev.target.closest('[data-ss-ol-edit-title]');
      var discard = ev.target.closest('[data-ss-ol-discard]');
      var del = ev.target.closest('[data-ss-ol-del]');
      var row = ev.target.closest('[data-ol-idx]');
      if (!row) return;
      var i = Number(row.getAttribute('data-ol-idx'));
      if (editTitle) {
        collectOutlineFromDom();
        var visible = getActiveOutline(state.novel);
        var target = visible[i];
        if (!target) return;
        var nextTitle = await showSsPrompt({
          icon: '✏️',
          title: '编辑章节标题',
          message: '第 ' + (i + 1) + ' 章',
          defaultValue: target.title || '',
          okText: '保存',
        });
        if (nextTitle === null) return;
        nextTitle = String(nextTitle).trim();
        if (!nextTitle) {
          setStatus('标题不能为空');
          return;
        }
        target.title = nextTitle;
        state.novel = syncChaptersFromOutline(state.novel);
        await persistNovel();
        renderOutline();
        renderWrite();
        return;
      }
      if (discard) {
        var okDiscard = await showSsConfirm({
          icon: '🗑️',
          title: '废弃后续？',
          message: '从此章起清空后续大纲与对应章节，不可恢复。',
          okText: '废弃后续',
          cancelText: '取消',
          danger: true,
        });
        if (!okDiscard) return;
        collectOutlineFromDom();
        state.novel = discardOutlineFrom(state.novel, i);
        await persistNovel();
        setStatus('已废弃后续');
        renderAll();
        return;
      }
      if (del) {
        collectOutlineFromDom();
        var visible = getActiveOutline(state.novel);
        var target = visible[i];
        if (!target) return;
        var br = getBranch(state.novel, state.novel.activeBranchId);
        // 不可删继承自父线的章
        if (br.parentBranchId && target.branchId !== br.id) {
          setStatus('继承章不可删；请开分支后编辑分支私有部分');
          return;
        }
        state.novel.outline = state.novel.outline.filter(function(o) { return o.id !== target.id; });
        state.novel.chapters = state.novel.chapters.filter(function(c) {
          return !(c.branchId === target.branchId && c.order === target.order);
        });
        state.novel = syncChaptersFromOutline(state.novel);
        await persistNovel();
        renderAll();
      }
    });
  }

  var writeSel = $('ssWriteChapterSelect');
  if (writeSel) {
    writeSel.addEventListener('change', function() {
      var nextId = String(writeSel.value || '');
      var prevId = String(ui.writeChapterId || '');
      if (prevId && prevId !== nextId) {
        collectWriteFromDom({ chapterId: prevId });
      }
      ui.writeChapterId = nextId;
      renderWrite();
    });
  }

  function goChapter(delta) {
    if (!state.novel) return;
    collectWriteFromDom();
    var chapters = getActiveChapters(state.novel);
    var curId = ui.writeChapterId || (writeSel && writeSel.value) || '';
    var idx = chapters.findIndex(function(c) { return c.id === curId; });
    var next = chapters[idx + delta];
    if (!next) return;
    if (writeSel) writeSel.value = next.id;
    ui.writeChapterId = next.id;
    ui.writeForceEdit = false;
    renderWrite();
  }
  var btnChapPrev = $('btnSsChapPrev');
  if (btnChapPrev) btnChapPrev.addEventListener('click', function() { goChapter(-1); });
  var btnChapNext = $('btnSsChapNext');
  if (btnChapNext) btnChapNext.addEventListener('click', function() { goChapter(1); });

  var btnWriteToc = $('btnSsWriteToc');
  if (btnWriteToc) {
    btnWriteToc.addEventListener('click', function() {
      setWriteTocOpen(!ui.ssWriteTocOpen);
    });
  }
  var btnWriteTocClose = $('btnSsWriteTocClose');
  if (btnWriteTocClose) {
    btnWriteTocClose.addEventListener('click', function() { setWriteTocOpen(false); });
  }
  var writeTocBox = $('ssWriteToc');
  if (writeTocBox) {
    writeTocBox.addEventListener('click', function(ev) {
      var btn = ev.target.closest('[data-ss-write-ch]');
      if (!btn || !state.novel) return;
      collectWriteFromDom();
      var id = btn.getAttribute('data-ss-write-ch');
      if (writeSel) writeSel.value = id;
      ui.writeChapterId = id;
      ui.writeForceEdit = false;
      setWriteTocOpen(false);
      renderWrite();
    });
  }

  var emptyPreview = $('ssWriteEmptyPreview');
  if (emptyPreview) {
    emptyPreview.addEventListener('click', function() { enterWriteContentEdit(); });
  }

  var btnFork = $('btnSsForkBranch');
  if (btnFork) btnFork.addEventListener('click', function() { forkCurrentChapterBranch(); });

  var btnBranchTag = $('btnSsBranchTag');
  if (btnBranchTag) {
    btnBranchTag.addEventListener('click', function(ev) {
      ev.preventDefault();
      if (ui.ssBranchTreeOpen) closeBranchTreePopover();
      else openBranchTreePopover();
    });
  }
  var btnReadBranchTag = $('btnSsReadBranchTag');
  if (btnReadBranchTag) {
    btnReadBranchTag.addEventListener('click', function(ev) {
      ev.preventDefault();
      if (ui.ssBranchTreeOpen) closeBranchTreePopover();
      else openBranchTreePopover();
    });
  }
  var btnBrClose = $('btnSsBranchTreeClose');
  if (btnBrClose) btnBrClose.addEventListener('click', function() { closeBranchTreePopover(); });
  var branchModal = $('ssBranchTreeModal');
  if (branchModal) {
    branchModal.addEventListener('click', function(ev) {
      if (ev.target === branchModal) closeBranchTreePopover();
    });
  }

  var btnLedgerOpen = $('btnSsLedgerOpen');
  if (btnLedgerOpen) {
    btnLedgerOpen.addEventListener('click', async function(ev) {
      ev.preventDefault();
      if (ui.ssLedgerOpen) {
        collectLedgerFromDom();
        await persistNovel();
        closeLedgerPopover();
      } else {
        openLedgerPopover();
      }
    });
  }
  var btnLedgerClose = $('btnSsLedgerClose');
  if (btnLedgerClose) {
    btnLedgerClose.addEventListener('click', async function() {
      collectLedgerFromDom();
      await persistNovel();
      closeLedgerPopover();
    });
  }
  var ledgerModal = $('ssLedgerPopover');
  if (ledgerModal) {
    ledgerModal.addEventListener('click', async function(ev) {
      if (ev.target !== ledgerModal) return;
      collectLedgerFromDom();
      await persistNovel();
      closeLedgerPopover();
    });
  }

  var titleChip = $('ssWriteChapterTitleBtn');
  if (titleChip) {
    titleChip.addEventListener('click', async function() {
      if (!state.novel) return;
      collectWriteFromDom();
      var sel = $('ssWriteChapterSelect');
      var ch = state.novel.chapters.find(function(c) { return c.id === (sel && sel.value); });
      if (!ch) return;
      var next = await showSsPrompt({
        icon: '✏️',
        title: '编辑章节标题',
        message: '点击保存后写回本章。',
        defaultValue: ch.title || '',
        okText: '保存',
      });
      if (next === null) return;
      next = String(next).trim();
      if (!next) return;
      ch.title = next;
      var hidden = $('ssWriteChapterTitle');
      if (hidden) hidden.value = next;
      await persistNovel();
      renderWrite();
      renderOutline();
    });
  }

  var branchTree = $('ssBranchTree');
  if (branchTree) {
    branchTree.addEventListener('click', async function(ev) {
      if (!state.novel) return;
      var node = ev.target.closest('[data-ss-br-switch][data-branch-id]');
      if (!node) return;
      var id = node.getAttribute('data-branch-id');
      collectWriteFromDom();
      collectLedgerFromDom();
      try {
        state.novel = setActiveBranch(state.novel, id);
        await persistNovel();
        closeBranchTreePopover();
        setStatus('已切换分支', { panel: 'write' });
        renderAll();
      } catch (e) {
        setStatus(e.message || String(e), { panel: 'write' });
      }
    });
  }

  var btnWriteStart = $('btnSsWriteStart');
  if (btnWriteStart) btnWriteStart.addEventListener('click', function() { onWritePrimaryClick(); });
  var btnWriteRun = $('btnSsWriteRun');
  if (btnWriteRun) btnWriteRun.addEventListener('click', function() { runWriteSession(); });
  var btnWriteCancel = $('btnSsWriteConfigCancel');
  if (btnWriteCancel) btnWriteCancel.addEventListener('click', function() { closeWriteConfig(); });
  var writeCfgModal = $('ssWriteConfigModal');
  if (writeCfgModal) {
    writeCfgModal.addEventListener('click', function(ev) {
      if (ev.target === writeCfgModal || ev.target.getAttribute('data-ss-write-cfg') === 'cancel') closeWriteConfig();
    });
  }
  document.querySelectorAll('[data-ss-write-cfg="cancel"]').forEach(function(btn) {
    btn.addEventListener('click', function() { closeWriteConfig(); });
  });
  document.querySelectorAll('input[name="ssWriteMode"]').forEach(function(radio) {
    radio.addEventListener('change', function() { updateWriteModeUi(); });
  });
  var btnQaOpen = $('btnSsQaOpen');
  if (btnQaOpen) {
    btnQaOpen.addEventListener('click', function(ev) {
      ev.preventDefault();
      openWriteToolPopover('ssQaPopover', 'btnSsQaOpen');
    });
  }
  var btnTensionOpen = $('btnSsTensionOpen');
  if (btnTensionOpen) {
    btnTensionOpen.addEventListener('click', function(ev) {
      ev.preventDefault();
      openWriteToolPopover('ssTensionPopover', 'btnSsTensionOpen');
    });
  }
  var btnSummaryOpen = $('btnSsSummaryOpen');
  if (btnSummaryOpen) {
    btnSummaryOpen.addEventListener('click', function(ev) {
      ev.preventDefault();
      openWriteToolPopover('ssSummaryPopover', 'btnSsSummaryOpen');
    });
  }
  var btnCheckpointOpen = $('btnSsCheckpointOpen');
  if (btnCheckpointOpen) {
    btnCheckpointOpen.addEventListener('click', function(ev) {
      ev.preventDefault();
      openWriteToolPopover('ssCheckpointPopover', 'btnSsCheckpointOpen');
    });
  }
  document.querySelectorAll('[data-ss-pop-close]').forEach(function(btn) {
    btn.addEventListener('click', async function() {
      var id = btn.getAttribute('data-ss-pop-close');
      if (id === 'ssSummaryPopover') {
        collectWriteFromDom({ skipContent: true });
        await persistNovel();
      }
      closeAllWriteToolPopovers();
    });
  });
  ['ssQaPopover', 'ssTensionPopover', 'ssSummaryPopover', 'ssCheckpointPopover'].forEach(function(id) {
    var el = $(id);
    if (!el) return;
    el.addEventListener('click', async function(ev) {
      if (ev.target !== el) return;
      if (id === 'ssSummaryPopover') {
        collectWriteFromDom({ skipContent: true });
        await persistNovel();
      }
      closeAllWriteToolPopovers();
    });
  });
  var btnWriteSave = $('btnSsWriteSave');
  if (btnWriteSave) {
    btnWriteSave.addEventListener('click', function() { saveWriteManually(); });
  }
  var syncEl = $('ssWriteSyncMvu');
  if (syncEl) {
    syncEl.addEventListener('change', function() {
      collectWriteFromDom({ skipContent: true });
      renderWrite();
      persistNovel();
    });
  }

  var btnLedgerAdd = $('btnSsLedgerAdd');
  if (btnLedgerAdd) {
    btnLedgerAdd.addEventListener('click', async function() {
      if (!state.novel) return;
      collectLedgerFromDom();
      if (!Array.isArray(state.novel.plotLedger)) state.novel.plotLedger = [];
      state.novel.plotLedger.push(createLedgerItem({
        title: '新伏笔',
        status: 'open',
        branchId: state.novel.activeBranchId,
      }));
      await persistNovel();
      renderWrite();
    });
  }
  var ledgerBox = $('ssWriteLedger');
  if (ledgerBox) {
    ledgerBox.addEventListener('click', async function(ev) {
      var del = ev.target.closest('[data-ss-ledger-del]');
      if (!del || !state.novel) return;
      collectLedgerFromDom();
      var row = del.closest('[data-ledger-id]');
      if (!row) return;
      var id = row.getAttribute('data-ledger-id');
      state.novel.plotLedger = (state.novel.plotLedger || []).filter(function(x) { return x.id !== id; });
      await persistNovel();
      renderWrite();
    });
  }
  var cpBox = $('ssWriteCheckpointList');
  if (cpBox) {
    cpBox.addEventListener('click', async function(ev) {
      var btn = ev.target.closest('[data-ss-cp]');
      if (!btn || !state.novel) return;
      var sel = $('ssWriteChapterSelect');
      if (!sel || !sel.value) return;
      var ch = state.novel.chapters.find(function(c) { return c.id === sel.value; });
      if (!ch) return;
      var okCp = await showSsConfirm({
        icon: '⏪',
        title: '恢复快照？',
        message: '恢复到该快照？当前正文会先自动存一份。',
        okText: '恢复',
        cancelText: '取消',
      });
      if (!okCp) return;
      if (restoreChapterCheckpoint(ch, btn.getAttribute('data-ss-cp'))) {
        await persistNovel();
        setStatus('已恢复快照');
        renderWrite();
      }
    });
  }

  // Wizard
  var btnWizStart = $('btnSsWizardStart');
  if (btnWizStart) {
    btnWizStart.addEventListener('click', async function() {
      if (!state.novel) return;
      var dirEl = $('ssOutlineDirection');
      state.novel.wizard = {
        step: 'direction',
        direction: dirEl ? dirEl.value : '',
        approvedOutline: false,
      };
      await persistNovel();
      renderOutline();
      setStatus('向导已启动：请确认方向');
    });
  }
  var btnWizDir = $('btnSsWizardApproveDir');
  if (btnWizDir) {
    btnWizDir.addEventListener('click', async function() {
      if (!state.novel) return;
      var dirEl = $('ssOutlineDirection');
      if (!state.novel.wizard) state.novel.wizard = {};
      state.novel.wizard.direction = dirEl ? dirEl.value : '';
      state.novel.wizard.step = 'direction';
      await persistNovel();
      await generateOutline(getActiveOutline(state.novel).length ? 'continue' : 'segment');
    });
  }
  var btnWizOl = $('btnSsWizardApproveOl');
  if (btnWizOl) {
    btnWizOl.addEventListener('click', async function() {
      if (!state.novel) return;
      if (!state.novel.wizard) state.novel.wizard = {};
      state.novel.wizard.approvedOutline = true;
      state.novel.wizard.step = 'ready';
      await persistNovel();
      setStatus('大纲已批准，可以开始写作');
      renderOutline();
      try {
        if (window.__setAppView__) window.__setAppView__('story-write');
      } catch (e) { /* ignore */ }
    });
  }
  var btnWizSkip = $('btnSsWizardSkip');
  if (btnWizSkip) {
    btnWizSkip.addEventListener('click', async function() {
      if (!state.novel) return;
      state.novel.wizard = { step: '', direction: '', approvedOutline: true };
      await persistNovel();
      renderOutline();
      setStatus('已跳过向导');
    });
  }

  // Read
  var btnToc = $('btnSsReadToc');
  if (btnToc) {
    btnToc.addEventListener('click', function() {
      setReadTocOpen(!ui.ssReadTocOpen);
    });
  }
  var btnTocClose = $('btnSsReadTocClose');
  if (btnTocClose) {
    btnTocClose.addEventListener('click', function() { setReadTocOpen(false); });
  }
  var toc = $('ssReadToc');
  if (toc) {
    toc.addEventListener('click', async function(ev) {
      var btn = ev.target.closest('[data-ch-id]');
      if (!btn || !state.novel) return;
      state.novel.readState.chapterId = btn.getAttribute('data-ch-id');
      state.novel.readState.pageIndex = 0;
      await persistNovel();
      renderRead();
    });
  }
  var modeSel = $('ssReadMode');
  if (modeSel) {
    modeSel.addEventListener('change', async function() {
      if (!state.novel) return;
      state.novel.readState.mode = modeSel.value;
      state.novel.readState.pageIndex = 0;
      await persistNovel();
      renderRead();
    });
  }
  var btnPrev = $('btnSsReadPrev');
  if (btnPrev) {
    btnPrev.addEventListener('click', async function() {
      if (!state.novel) return;
      var chapters = getActiveChapters(state.novel);
      var idx = chapters.findIndex(function(c) { return c.id === state.novel.readState.chapterId; });
      if (idx < 0) idx = 0;
      var mode = state.novel.readState.mode || 'swipe';
      if (mode === 'page' && state.novel.readState.pageIndex > 0) {
        state.novel.readState.pageIndex -= 1;
      } else if (idx > 0) {
        state.novel.readState.chapterId = chapters[idx - 1].id;
        state.novel.readState.pageIndex = 0;
      }
      await persistNovel();
      renderRead();
    });
  }
  var btnNext = $('btnSsReadNext');
  if (btnNext) {
    btnNext.addEventListener('click', async function() {
      if (!state.novel) return;
      var chapters = getActiveChapters(state.novel);
      var idx = chapters.findIndex(function(c) { return c.id === state.novel.readState.chapterId; });
      if (idx < 0) idx = 0;
      var mode = state.novel.readState.mode || 'swipe';
      var ch = chapters[idx];
      if (mode === 'page' && ch && ch.content) {
        var pageSize = 900;
        var pages = Math.max(1, Math.ceil(ch.content.length / pageSize));
        if ((state.novel.readState.pageIndex || 0) + 1 < pages) {
          state.novel.readState.pageIndex = (state.novel.readState.pageIndex || 0) + 1;
          await persistNovel();
          renderRead();
          return;
        }
      }
      if (idx + 1 < chapters.length) {
        state.novel.readState.chapterId = chapters[idx + 1].id;
        state.novel.readState.pageIndex = 0;
        await persistNovel();
        renderRead();
      }
    });
  }
  var btnBm = $('btnSsReadBookmark');
  if (btnBm) {
    btnBm.addEventListener('click', async function() {
      if (!state.novel) return;
      var chapters = getActiveChapters(state.novel);
      var chId = state.novel.readState.chapterId || (chapters[0] && chapters[0].id);
      if (!chId) return;
      state.novel.bookmarks = state.novel.bookmarks || [];
      var exists = state.novel.bookmarks.some(function(b) { return b.chapterId === chId; });
      if (!exists) {
        state.novel.bookmarks.push({
          id: genStoryId('bm'),
          chapterId: chId,
          note: '',
          createdAt: Date.now(),
        });
      }
      await persistNovel();
      setStatus('已添加书签');
      renderRead();
    });
  }
  var bmBox = $('ssReadBookmarks');
  if (bmBox) {
    bmBox.addEventListener('click', async function(ev) {
      var btn = ev.target.closest('[data-bm-ch]');
      if (!btn || !state.novel) return;
      state.novel.readState.chapterId = btn.getAttribute('data-bm-ch');
      state.novel.readState.pageIndex = 0;
      await persistNovel();
      renderRead();
    });
  }
  var btnFs = $('btnSsReadFullscreen');
  if (btnFs) {
    btnFs.addEventListener('click', function() {
      var el = $('ssReadStage');
      if (!el) return;
      if (!document.fullscreenElement) {
        if (el.requestFullscreen) el.requestFullscreen();
      } else if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    });
  }

  // swipe on read body
  var readBody = $('ssReadBody');
  if (readBody) {
    var touchX = 0;
    readBody.addEventListener('touchstart', function(ev) {
      if (ev.changedTouches && ev.changedTouches[0]) touchX = ev.changedTouches[0].clientX;
    }, { passive: true });
    readBody.addEventListener('touchend', function(ev) {
      if (!ev.changedTouches || !ev.changedTouches[0]) return;
      var dx = ev.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) < 60) return;
      if (dx < 0 && btnNext) btnNext.click();
      else if (dx > 0 && btnPrev) btnPrev.click();
    }, { passive: true });
  }

  window.addEventListener('card-draft-changed', function() {
    reloadCatalog().then(renderAll);
  });
  window.addEventListener('app-view-changed', function(ev) {
    var v = ev && ev.detail && ev.detail.view;
    if (v && String(v).indexOf('story-') === 0) {
      reloadCatalog().then(renderAll);
    }
  });
}

export async function initStoryStudio() {
  if (window.__storyStudioReady__) return;
  window.__storyStudioReady__ = true;
  bindEvents();
  try {
    await reloadCatalog();
  } catch (e) {
    console.warn('[storyStudio] load failed', e);
  }
  renderAll();
  window.__storyStudio__ = {
    getState: function() { return state; },
    getCurrentNovelId: function() {
      return state.novel && state.novel.id ? String(state.novel.id) : '';
    },
    reload: reloadCatalog,
    render: renderAll,
  };
  if (window.__actionEngine__ && typeof window.__actionEngine__.setProviders === 'function') {
    window.__actionEngine__.setProviders({
      getStoryId: function() {
        return state.novel && state.novel.id ? String(state.novel.id) : '';
      },
    });
    window.__actionEngine__.refresh();
  }
}
