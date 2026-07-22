/**
 * 小说创作模块控制器：boot + 事件绑定
 * 渲染 / CRUD / 写作流水线已拆至同目录模块。
 */

import { genStoryId, syncChaptersFromOutline, discardOutlineFrom, getActiveChapters, getActiveOutline } from './state.mjs';
import { restoreChapterCheckpoint } from './checkpoint.mjs';
import { createLedgerItem } from './plotLedger.mjs';
import { setActiveBranch, getBranch, patchBranch, BRANCH_KIND_ENDING } from './branch.mjs';
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
  renderBranchTree,
  openBranchChapterModal,
  renderWrite,
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
  collectGraphFromDom,
  collectOutlineFromDom,
  collectWriteFromDom,
  collectLedgerFromDom,
  seedGraph,
  promptAndGenerateOutline,
  generateOutline,
  writeChapter,
  writeBatchChapters,
  forkCurrentChapterBranch,
} from './writeActions.mjs';

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
    btnAddNode.addEventListener('click', async function() {
      if (!state.novel) return;
      collectGraphFromDom();
      state.novel.graph.nodes.push({
        id: genStoryId('node'),
        type: 'character',
        name: '新节点',
        note: '',
      });
      await persistNovel();
      renderGraph();
    });
  }

  var btnAddEdge = $('btnSsAddEdge');
  if (btnAddEdge) {
    btnAddEdge.addEventListener('click', async function() {
      if (!state.novel || !state.novel.graph.nodes.length) return;
      collectGraphFromDom();
      var a = state.novel.graph.nodes[0];
      var b = state.novel.graph.nodes[1] || a;
      state.novel.graph.edges.push({
        id: genStoryId('edge'),
        from: a.id,
        to: b.id,
        label: '关系',
      });
      await persistNovel();
      renderGraph();
    });
  }

  var btnSaveGraph = $('btnSsSaveGraph');
  if (btnSaveGraph) {
    btnSaveGraph.addEventListener('click', async function() {
      if (!state.novel) return;
      collectGraphFromDom();
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

  var graphNodes = $('ssGraphNodes');
  if (graphNodes) {
    graphNodes.addEventListener('click', async function(ev) {
      var del = ev.target.closest('[data-ss-node-del]');
      if (!del) return;
      var row = del.closest('[data-node-idx]');
      if (!row || !state.novel) return;
      collectGraphFromDom();
      var i = Number(row.getAttribute('data-node-idx'));
      state.novel.graph.nodes.splice(i, 1);
      await persistNovel();
      renderGraph();
    });
  }
  var graphEdges = $('ssGraphEdges');
  if (graphEdges) {
    graphEdges.addEventListener('click', async function(ev) {
      var del = ev.target.closest('[data-ss-edge-del]');
      if (!del) return;
      var row = del.closest('[data-edge-idx]');
      if (!row || !state.novel) return;
      collectGraphFromDom();
      var i = Number(row.getAttribute('data-edge-idx'));
      state.novel.graph.edges.splice(i, 1);
      await persistNovel();
      renderGraph();
    });
  }

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
      collectWriteFromDom();
      renderWrite();
    });
  }
  var branchSel = $('ssWriteBranchSelect');
  if (branchSel) {
    branchSel.addEventListener('change', async function() {
      if (!state.novel) return;
      collectWriteFromDom();
      collectLedgerFromDom();
      try {
        state.novel = setActiveBranch(state.novel, branchSel.value);
        await persistNovel();
        setStatus('已切换分支');
        renderAll();
      } catch (e) {
        setStatus(e.message || String(e));
      }
    });
  }
  var btnFork = $('btnSsForkBranch');
  if (btnFork) btnFork.addEventListener('click', function() { forkCurrentChapterBranch(); });

  var btnBrOpen = $('btnSsBranchTreeOpen');
  if (btnBrOpen) {
    btnBrOpen.addEventListener('click', function(ev) {
      ev.preventDefault();
      if (ui.ssBranchTreeOpen) closeBranchTreePopover();
      else openBranchTreePopover();
    });
  }
  var btnBrClose = $('btnSsBranchTreeClose');
  if (btnBrClose) btnBrClose.addEventListener('click', function() { closeBranchTreePopover(); });

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
      titleChip.textContent = next;
      await persistNovel();
      renderWrite();
      renderOutline();
    });
  }

  var branchTree = $('ssBranchTree');
  if (branchTree) {
    branchTree.addEventListener('click', async function(ev) {
      if (!state.novel) return;
      var row = ev.target.closest('[data-branch-id]');
      if (!row) return;
      var id = row.getAttribute('data-branch-id');
      if (ev.target.closest('[data-ss-br-expand]')) {
        ui.ssBranchExpandedId = ui.ssBranchExpandedId === id ? '' : id;
        renderBranchTree();
        return;
      }
      if (ev.target.closest('[data-ss-br-open-ch]')) {
        await openBranchChapterModal(id);
        return;
      }
      if (ev.target.closest('[data-ss-br-switch]')) {
        try {
          state.novel = setActiveBranch(state.novel, id);
          await persistNovel();
          setStatus('已切换分支');
          renderAll();
        } catch (e) {
          setStatus(e.message || String(e));
        }
        return;
      }
      if (ev.target.closest('[data-ss-br-edit]')) {
        var br = getBranch(state.novel, id);
        var label = await showSsPrompt({ title: '读者选项文案', message: '选线时显示', defaultValue: br.choiceLabel || br.name || '' });
        if (label === null) return;
        var teaser = await showSsPrompt({ title: '选项短提示', message: '可选', defaultValue: br.choiceTeaser || br.direction || '', select: false });
        if (teaser === null) return;
        var endingTitle = br.kind === BRANCH_KIND_ENDING
          ? await showSsPrompt({ title: '结局标题', defaultValue: br.endingTitle || br.name || '' })
          : br.endingTitle;
        if (endingTitle === null) return;
        state.novel = patchBranch(state.novel, id, {
          choiceLabel: label,
          choiceTeaser: teaser,
          endingTitle: endingTitle,
        });
        await persistNovel();
        renderBranchTree();
        setStatus('已更新分支文案');
        return;
      }
      if (ev.target.closest('[data-ss-br-ending]')) {
        var cur = getBranch(state.novel, id);
        var nextKind = cur.kind === BRANCH_KIND_ENDING ? 'path' : BRANCH_KIND_ENDING;
        var et = cur.endingTitle;
        if (nextKind === BRANCH_KIND_ENDING && !et) {
          et = (await showSsPrompt({ title: '结局标题', defaultValue: cur.choiceLabel || cur.name || '结局' })) || cur.name;
        }
        state.novel = patchBranch(state.novel, id, {
          kind: nextKind,
          endingTitle: nextKind === BRANCH_KIND_ENDING ? et : '',
        });
        await persistNovel();
        renderBranchTree();
        setStatus(nextKind === BRANCH_KIND_ENDING ? '已标为结局支' : '已取消结局标记');
      }
    });
    branchTree.addEventListener('change', async function(ev) {
      if (!state.novel) return;
      var ready = ev.target.closest('[data-ss-br-ready]');
      if (!ready) return;
      var row = ready.closest('[data-branch-id]');
      if (!row) return;
      state.novel = patchBranch(state.novel, row.getAttribute('data-branch-id'), {
        publishReady: !!ready.checked,
      });
      await persistNovel();
      setStatus(ready.checked ? '已纳入发布' : '已移出发布');
    });
  }

  var btnWrite = $('btnSsWriteChapter');
  if (btnWrite) btnWrite.addEventListener('click', function() { writeChapter(false); });
  var btnWriteNext = $('btnSsWriteAutoNext');
  if (btnWriteNext) btnWriteNext.addEventListener('click', function() { writeChapter(true); });
  var btnWriteBatch = $('btnSsWriteBatch');
  if (btnWriteBatch) btnWriteBatch.addEventListener('click', function() { writeBatchChapters(); });
  var btnWriteQa = $('btnSsWriteQa');
  if (btnWriteQa) {
    btnWriteQa.addEventListener('click', function() {
      writeChapter(false, { skipDraft: true, skipFeed: true });
    });
  }
  var btnWriteRewrite = $('btnSsWriteRewrite');
  if (btnWriteRewrite) {
    btnWriteRewrite.addEventListener('click', function() {
      writeChapter(false, { rewriteOnly: true });
    });
  }
  var btnWriteSave = $('btnSsWriteSave');
  if (btnWriteSave) {
    btnWriteSave.addEventListener('click', async function() {
      collectWriteFromDom();
      collectLedgerFromDom();
      await persistNovel();
      setStatus('章节已保存');
      renderRead();
    });
  }
  var syncEl = $('ssWriteSyncMvu');
  if (syncEl) {
    syncEl.addEventListener('change', function() {
      collectWriteFromDom();
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
    reload: reloadCatalog,
    render: renderAll,
  };
}
