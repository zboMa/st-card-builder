/**
 * Story Studio 写作页 / 分支浮层 UI（拆自 browserApp）
 */

import { getActiveChapters } from './state.mjs';
import { detectMvuStatusBarDesign } from './mvuHook.mjs';
import {
  resolveBranchLedger,
  getBranch,
  buildBranchTree,
  BRANCH_KIND_ENDING,
} from './branch.mjs';
import { listChapterCheckpoints } from './checkpoint.mjs';
import { tensionCurveFromChapters } from './quality.mjs';
import { WRITE_STEPS, WRITE_STEP_LABELS } from './writePipeline.mjs';
import { showSsPrompt, showSsModal } from './dialogs.mjs';
import { state, ui, $, setStatus, escapeHtml } from './shared.mjs';

var LEDGER_STATUS_LABELS = {
  open: '未收束',
  planted: '已埋设',
  paid: '已回收',
  dropped: '已放弃',
};

export function setWriteProgress(activeStep) {
  var box = $('ssWriteProgress');
  if (!box) return;
  if (!activeStep) {
    if (!ui.writeBusy) box.hidden = true;
    return;
  }
  box.hidden = false;
  WRITE_STEPS.forEach(function(s) {
    var el = box.querySelector('[data-ss-step="' + s + '"]');
    if (!el) return;
    el.classList.toggle('is-active', s === activeStep);
    el.classList.toggle('is-done', WRITE_STEPS.indexOf(s) < WRITE_STEPS.indexOf(activeStep));
    el.classList.toggle('is-skip', false);
  });
  syncWriteSessionBar();
}

export function syncWriteSessionBar() {
  var box = $('ssWriteProgress');
  var meta = $('ssWriteProgressMeta');
  if (!box) return;
  if (ui.writeBusy || (ui.writeSession && ui.writeSession.step)) {
    box.hidden = false;
  } else if (!ui.writeBusy) {
    box.hidden = true;
  }
  if (!meta) return;
  var session = ui.writeSession;
  if (!session) {
    meta.textContent = ui.writeBusy ? '写作进行中…' : '';
    return;
  }
  var stepLabel = WRITE_STEP_LABELS[session.step] || session.step || '';
  var batch = '';
  if (session.batchTotal > 1) {
    batch = ' · 第 ' + (session.batchIndex || 1) + '/' + session.batchTotal + ' 章';
  }
  meta.textContent = (session.modeLabel || '写作')
    + (stepLabel ? ' · ' + stepLabel : '')
    + batch;
}

export function applyStreamContent(text) {
  var contentEl = $('ssWriteChapterContent');
  if (!contentEl) return;
  contentEl.value = String(text || '');
  try {
    contentEl.scrollTop = contentEl.scrollHeight;
  } catch (e) { /* ignore */ }
}

export function showCenteredModal(id) {
  var el = $(id);
  if (!el) return;
  el.hidden = false;
  if (el.parentNode !== document.body) {
    if (!el._home) el._home = el.parentNode;
    document.body.appendChild(el);
  }
}

export function hideCenteredModal(id) {
  var el = $(id);
  if (!el) return;
  el.hidden = true;
  if (el._home && el.parentNode !== el._home) el._home.appendChild(el);
}

export function closeBranchTreePopover() {
  ui.ssBranchTreeOpen = false;
  hideCenteredModal('ssBranchTreeModal');
  ['btnSsBranchTag', 'btnSsReadBranchTag', 'btnSsOutlineBranchTag'].forEach(function(id) {
    var btn = $(id);
    if (btn) btn.setAttribute('aria-expanded', 'false');
  });
}

export function closeLedgerPopover() {
  ui.ssLedgerOpen = false;
  hideCenteredModal('ssLedgerPopover');
  var btn = $('btnSsLedgerOpen');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

export function closeMoreMenu() {
  /* ⋯ 菜单已移除，保留空实现兼容 */
  ui.ssMoreMenuOpen = false;
}

export function openMoreMenu() {
  /* no-op */
}

export function closeAllWriteToolPopovers() {
  ['ssQaPopover', 'ssTensionPopover', 'ssSummaryPopover', 'ssCheckpointPopover'].forEach(hideCenteredModal);
  ui.ssWriteToolPop = '';
  if (ui.ssWriteToolPopHandler) {
    document.removeEventListener('mousedown', ui.ssWriteToolPopHandler, true);
    ui.ssWriteToolPopHandler = null;
  }
  ['btnSsQaOpen', 'btnSsTensionOpen', 'btnSsSummaryOpen', 'btnSsCheckpointOpen'].forEach(function(id) {
    var b = $(id);
    if (b) b.setAttribute('aria-expanded', 'false');
  });
}

export function openWriteToolPopover(popId, btnId) {
  var pop = $(popId);
  var btn = $(btnId);
  if (!pop) return;
  closeLedgerPopover();
  closeBranchTreePopover();
  if (ui.ssWriteToolPop === popId && !pop.hidden) {
    closeAllWriteToolPopovers();
    return;
  }
  closeAllWriteToolPopovers();
  ui.ssWriteToolPop = popId;
  if (popId === 'ssQaPopover' || popId === 'ssTensionPopover' || popId === 'ssCheckpointPopover') {
    renderWrite();
  }
  showCenteredModal(popId);
  if (btn) btn.setAttribute('aria-expanded', 'true');
}

export function positionBranchTreePopover() { /* centered modal */ }
export function positionLedgerPopover() { /* centered modal */ }

export function openBranchTreePopover() {
  closeLedgerPopover();
  closeAllWriteToolPopovers();
  ui.ssBranchTreeOpen = true;
  renderBranchTree();
  showCenteredModal('ssBranchTreeModal');
  ['btnSsBranchTag', 'btnSsReadBranchTag', 'btnSsOutlineBranchTag'].forEach(function(id) {
    var btn = $(id);
    if (btn) btn.setAttribute('aria-expanded', 'true');
  });
}

export function openLedgerPopover() {
  closeBranchTreePopover();
  closeAllWriteToolPopovers();
  ui.ssLedgerOpen = true;
  renderWrite();
  showCenteredModal('ssLedgerPopover');
  var btn = $('btnSsLedgerOpen');
  if (btn) btn.setAttribute('aria-expanded', 'true');
}

function buildBranchForestHtml(novel) {
  var rows = buildBranchTree(novel);
  var byParent = {};
  rows.forEach(function(row) {
    var b = row.branch;
    var pid = b.parentBranchId || '';
    if (!byParent[pid]) byParent[pid] = [];
    byParent[pid].push(b);
  });

  function renderNode(b) {
    var active = b.id === novel.activeBranchId ? ' is-active' : '';
    var kind = b.kind === BRANCH_KIND_ENDING ? '结局' : (b.parentBranchId ? '支线' : '主线');
    var kids = byParent[b.id] || [];
    var html = '<li class="ss-btree-item">'
      + '<button type="button" class="ss-btree-node' + active + '" data-branch-id="'
      + escapeHtml(b.id) + '" data-ss-br-switch title="切换到此分支">'
      + '<span class="ss-btree-node__name">' + escapeHtml(b.name || '未命名') + '</span>'
      + '<span class="ss-btree-node__meta">' + kind
      + (b.parentBranchId ? (' · 自第' + ((b.forkOrder || 0) + 1) + '章') : '')
      + '</span>'
      + '</button>';
    if (kids.length) {
      html += '<ul class="ss-btree">' + kids.map(renderNode).join('') + '</ul>';
    }
    html += '</li>';
    return html;
  }

  var roots = byParent[''] || [];
  if (!roots.length && rows.length) {
    return '<ul class="ss-btree">' + rows.map(function(r) { return renderNode(r.branch); }).join('') + '</ul>';
  }
  return '<ul class="ss-btree ss-btree--root">'
    + roots.map(renderNode).join('')
    + '</ul>';
}

export function renderBranchTree() {
  var box = $('ssBranchTree');
  if (!box) return;
  if (!state.novel) {
    box.innerHTML = '<div class="ss-empty ui-empty-tip">请先打开小说</div>';
    return;
  }
  box.innerHTML = buildBranchForestHtml(state.novel)
    || '<div class="ss-empty ui-empty-tip">暂无分支</div>';
}

export async function openBranchChapterModal(branchId) {
  if (!state.novel) return;
  var chapters = (state.novel.chapters || []).filter(function(c) {
    return c && c.branchId === branchId;
  }).sort(function(a, b) { return (a.order || 0) - (b.order || 0); });
  if (!chapters.length) {
    setStatus('该分支暂无章节');
    return;
  }
  var options = chapters.map(function(c, i) {
    return (i + 1) + '. ' + (c.title || '未命名');
  }).join('\n');
  var pick = await showSsPrompt({
    icon: '📖',
    title: '查看章节全文',
    message: '输入章节序号（1～' + chapters.length + '）：\n' + options.slice(0, 400),
    defaultValue: '1',
    okText: '打开',
  });
  if (pick === null) return;
  var n = parseInt(String(pick).trim(), 10);
  if (!Number.isFinite(n) || n < 1 || n > chapters.length) {
    setStatus('章节序号无效');
    return;
  }
  var ch = chapters[n - 1];
  var body = String(ch.content || '').trim()
    || ('（无正文）\n\n摘要：\n' + String(ch.summary || '—'));
  await showSsModal({
    title: (ch.title || '未命名') + ' · 全文',
    bodyHtml: '<div class="ss-read-text">' + escapeHtml(body).replace(/\n/g, '<br/>') + '</div>',
  });
}

function syncWriteEmptyPreview(ch) {
  var wrap = document.querySelector('.ss-write-content-wrap');
  var preview = $('ssWriteEmptyPreview');
  var contentEl = $('ssWriteChapterContent');
  if (!wrap || !preview) return;
  var forceEdit = !!ui.writeForceEdit || !!ui.writeBusy;
  var raw = contentEl ? String(contentEl.value || '') : (ch ? String(ch.content || '') : '');
  var hasBody = !!String(raw).trim();
  if (forceEdit || hasBody || !ch) {
    wrap.classList.remove('is-empty-preview');
    preview.hidden = true;
    preview.innerHTML = '';
    return;
  }
  var sum = String(ch.summary || '').trim();
  if (ch.feedForward && ch.feedForward.summary && !sum) sum = String(ch.feedForward.summary).trim();
  var display = sum || '（本章暂无正文与摘要）';
  preview.innerHTML = '<div class="ss-read-page">'
    + '<h3>' + escapeHtml(ch.title || '未命名') + '</h3>'
    + '<div class="ss-summary-card"><p class="ss-read-summary-tag">摘要（无正文）</p>'
    + '<div class="ss-read-text">' + escapeHtml(display).replace(/\n/g, '<br/>') + '</div></div>'
    + '<p class="ui-hint ui-hint--inline ss-write-empty-hint">点击此处开始撰写正文</p>'
    + '</div>';
  preview.hidden = false;
  wrap.classList.add('is-empty-preview');
}

export function enterWriteContentEdit() {
  ui.writeForceEdit = true;
  var wrap = document.querySelector('.ss-write-content-wrap');
  var preview = $('ssWriteEmptyPreview');
  var contentEl = $('ssWriteChapterContent');
  if (wrap) wrap.classList.remove('is-empty-preview');
  if (preview) {
    preview.hidden = true;
    preview.innerHTML = '';
  }
  if (contentEl) {
    try { contentEl.focus(); } catch (e) { /* ignore */ }
  }
}

export function renderWrite() {
  var sel = $('ssWriteChapterSelect');
  var titleEl = $('ssWriteChapterTitle');
  var summaryEl = $('ssWriteChapterSummary');
  var contentEl = $('ssWriteChapterContent');
  var advEl = $('ssWriteAdvancePrompt');
  var syncEl = $('ssWriteSyncMvu');
  var warnEl = $('ssWriteMvuWarn');
  var batchEl = $('ssWriteBatchCount');
  var feedEl = $('ssWriteRunFeed');
  var qaEl = $('ssWriteRunQa');
  var stopEl = $('ssWriteStopOnQa');
  var qaBox = $('ssWriteQaBox');
  var tensionEl = $('ssWriteTension');
  var cpBox = $('ssWriteCheckpointList');
  var ledgerBox = $('ssWriteLedger');
  var branchTag = $('btnSsBranchTag');
  var prevBtn = $('btnSsChapPrev');
  var nextBtn = $('btnSsChapNext');
  var chapIndex = $('ssWriteChapIndex');
  var writeToc = $('ssWriteToc');
  var writeAside = $('ssWriteAside');
  var writeTocBtn = $('btnSsWriteToc');

  if (writeAside) writeAside.hidden = !ui.ssWriteTocOpen;
  if (writeTocBtn) writeTocBtn.setAttribute('aria-expanded', ui.ssWriteTocOpen ? 'true' : 'false');

  if (!state.novel) {
    if (sel) sel.innerHTML = '<option value="">请先打开小说</option>';
    if (branchTag) branchTag.textContent = '—';
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    if (chapIndex) chapIndex.textContent = '第 — 章';
    if (writeToc) writeToc.innerHTML = '';
    ui.writeChapterId = '';
    syncWriteEmptyPreview(null);
    renderBranchTree();
    return;
  }

  var ws = state.novel.writeSettings || {};
  if (batchEl) batchEl.value = String(ws.batchCount || 3);
  if (feedEl) feedEl.checked = ws.runFeedForward !== false;
  if (qaEl) qaEl.checked = ws.runQuality !== false;
  if (stopEl) stopEl.checked = !!ws.stopOnQualityFail;

  var brCur = getBranch(state.novel, state.novel.activeBranchId);
  if (branchTag) {
    branchTag.textContent = (state.novel.title || '未命名')
      + ' · ' + ((brCur && brCur.name) || '主线');
  }

  var chapters = getActiveChapters(state.novel);
  var curId = ui.writeChapterId || (sel && sel.value) || (chapters[0] && chapters[0].id) || '';
  if (curId && !chapters.some(function(c) { return c.id === curId; })) {
    curId = (chapters[0] && chapters[0].id) || '';
  }
  if (sel) {
    sel.innerHTML = chapters.map(function(c, i) {
      return '<option value="' + escapeHtml(c.id) + '"'
        + (c.id === curId ? ' selected' : '') + '>'
        + (i + 1) + '. ' + escapeHtml(c.title || '未命名')
        + (c.content ? '' : '（空）')
        + '</option>';
    }).join('') || '<option value="">无章节（请先做大纲）</option>';
    curId = sel.value;
  }
  ui.writeChapterId = curId;
  var chIdx = chapters.findIndex(function(c) { return c.id === curId; });
  if (prevBtn) prevBtn.disabled = chIdx <= 0;
  if (nextBtn) nextBtn.disabled = chIdx < 0 || chIdx >= chapters.length - 1;
  if (chapIndex) {
    chapIndex.textContent = chapters.length
      ? ('第 ' + (chIdx >= 0 ? chIdx + 1 : '—') + '/' + chapters.length + ' 章')
      : '第 — 章';
  }
  var ch = chapters.find(function(c) { return c.id === curId; });
  if (titleEl) titleEl.value = ch ? ch.title : '';
  var titleBtn = $('ssWriteChapterTitleBtn');
  if (titleBtn) titleBtn.textContent = ch ? (ch.title || '未命名') : '未命名';

  if (writeToc) {
    writeToc.innerHTML = chapters.map(function(c, i) {
      return '<button type="button" class="ss-toc-item' + (c.id === curId ? ' is-active' : '') + '" data-ss-write-ch="'
        + escapeHtml(c.id) + '">' + (i + 1) + '. ' + escapeHtml(c.title || '未命名') + '</button>';
    }).join('') || '<div class="ss-empty ui-empty-tip">暂无章节</div>';
  }
  if (summaryEl) {
    var sum = ch ? ch.summary : '';
    if (ch && ch.feedForward && ch.feedForward.summary && !sum) sum = ch.feedForward.summary;
    summaryEl.value = sum;
  }
  /* 流式写作中勿用空/旧 content 覆盖 textarea */
  if (contentEl && !ui.writeBusy) contentEl.value = ch ? ch.content : '';
  if (advEl) advEl.value = ch ? ch.advancePrompt : '';

  syncWriteEmptyPreview(ch);
  if (syncEl) syncEl.checked = !!(state.novel.writeSettings && state.novel.writeSettings.syncMvuStatusBar);

  var detect = detectMvuStatusBarDesign(window.__getCardExtension__);
  if (warnEl) {
    if (syncEl && syncEl.checked && !detect.ok) {
      warnEl.hidden = false;
      warnEl.textContent = detect.warning || '缺少 MVU/状态栏 design，同步不会生效。';
    } else {
      warnEl.hidden = true;
      warnEl.textContent = '';
    }
  }

  if (qaBox) {
    if (ch && ch.quality) {
      qaBox.hidden = false;
      var q = ch.quality;
      qaBox.innerHTML = '<div class="ui-label-row"><strong>质检</strong>'
        + '<span class="ui-hint ui-hint--inline">' + (q.ok ? '通过' : '需改') + ' · ' + (q.score != null ? q.score : '—') + '/10</span></div>'
        + (q.issues && q.issues.length
          ? ('<ul class="ss-qa-issues">' + q.issues.map(function(x) {
            return '<li>' + escapeHtml(x) + '</li>';
          }).join('') + '</ul>')
          : '<p class="ss-muted">无明显问题</p>')
        + (q.rewriteHint ? ('<p class="ss-qa-hint">' + escapeHtml(q.rewriteHint) + '</p>') : '');
    } else {
      qaBox.hidden = true;
      qaBox.innerHTML = '';
    }
  }
  var qaEmpty = $('ssWriteQaEmpty');
  if (qaEmpty) qaEmpty.hidden = !!(qaBox && !qaBox.hidden);

  if (tensionEl) {
    var curve = tensionCurveFromChapters(chapters);
    var hasT = curve.some(function(x) { return x.tension != null && x.hasContent; });
    tensionEl.hidden = !hasT;
    if (hasT) {
      tensionEl.innerHTML = '<div class="ss-tension-bars">'
        + curve.map(function(x) {
          var t = x.tension != null ? x.tension : 0;
          return '<div class="ss-tension-bar" style="height:' + Math.max(4, t * 8) + 'px" title="'
            + escapeHtml((x.order + 1) + '. ' + (x.tension != null ? x.tension : '—')) + '"></div>';
        }).join('')
        + '</div>';
    } else {
      tensionEl.innerHTML = '';
    }
  }
  var tensionEmpty = $('ssWriteTensionEmpty');
  if (tensionEmpty) tensionEmpty.hidden = !!(tensionEl && !tensionEl.hidden);

  if (cpBox) {
    var cps = ch ? listChapterCheckpoints(ch) : [];
    cpBox.innerHTML = cps.length
      ? cps.map(function(cp) {
          return '<button type="button" class="btn btn-ghost btn-inline" data-ss-cp="'
            + escapeHtml(cp.id) + '">' + escapeHtml(cp.label || '快照')
            + ' · ' + new Date(cp.createdAt || 0).toLocaleString() + '</button>';
        }).join(' ')
      : '';
  }
  var cpEmpty = $('ssWriteCheckpointEmpty');
  if (cpEmpty) cpEmpty.hidden = !!(cpBox && cpBox.innerHTML);

  if (ledgerBox) {
    var items = resolveBranchLedger(state.novel, state.novel.activeBranchId);
    ledgerBox.innerHTML = items.map(function(it) {
      return (
        '<div class="ss-ledger-item" data-ledger-id="' + escapeHtml(it.id) + '">'
        + '<input class="ss-ledger-title" value="' + escapeHtml(it.title) + '" />'
        + '<select class="ss-ledger-status">'
        + ['open', 'planted', 'paid', 'dropped'].map(function(s) {
          return '<option value="' + s + '"' + (it.status === s ? ' selected' : '') + '>'
            + (LEDGER_STATUS_LABELS[s] || s) + '</option>';
        }).join('')
        + '</select>'
        + '<input class="ss-ledger-note" value="' + escapeHtml(it.note) + '" placeholder="说明" />'
        + '<button type="button" class="btn btn-ghost btn-inline" data-ss-ledger-del>删</button>'
        + '</div>'
      );
    }).join('') || '<div class="ss-empty ui-empty-tip">暂无伏笔。写章后可自动收录，或手动添加。</div>';
  }
  renderBranchTree();
}

export function setWriteTocOpen(open) {
  ui.ssWriteTocOpen = !!open;
  var aside = $('ssWriteAside');
  var btn = $('btnSsWriteToc');
  if (aside) aside.hidden = !ui.ssWriteTocOpen;
  if (btn) btn.setAttribute('aria-expanded', ui.ssWriteTocOpen ? 'true' : 'false');
}
