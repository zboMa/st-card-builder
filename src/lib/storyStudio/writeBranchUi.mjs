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
import { WRITE_STEPS } from './writePipeline.mjs';
import { showSsPrompt, showSsModal } from './dialogs.mjs';
import { state, ui, $, setStatus, escapeHtml } from './shared.mjs';

export function setWriteProgress(activeStep) {
  var box = $('ssWriteProgress');
  if (!box) return;
  if (!activeStep) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  WRITE_STEPS.forEach(function(s) {
    var el = box.querySelector('[data-ss-step="' + s + '"]');
    if (!el) return;
    el.classList.toggle('is-active', s === activeStep);
    el.classList.toggle('is-done', WRITE_STEPS.indexOf(s) < WRITE_STEPS.indexOf(activeStep));
  });
}
export function closeBranchTreePopover() {
  ui.ssBranchTreeOpen = false;
  var pop = $('ssBranchTreePopover');
  var btn = $('btnSsBranchTreeOpen');
  if (pop) {
    pop.hidden = true;
    pop.style.left = '';
    pop.style.top = '';
  }
  if (btn) btn.setAttribute('aria-expanded', 'false');
  if (ui.ssBranchPopoverDocHandler) {
    document.removeEventListener('mousedown', ui.ssBranchPopoverDocHandler, true);
    ui.ssBranchPopoverDocHandler = null;
  }
}

export function positionBranchTreePopover() {
  var pop = $('ssBranchTreePopover');
  var btn = $('btnSsBranchTreeOpen');
  if (!pop || !btn || pop.hidden) return;
  if (!pop._home) pop._home = pop.parentNode;
  if (pop.parentNode !== document.body) document.body.appendChild(pop);
  var rect = btn.getBoundingClientRect();
  var vw = window.innerWidth || 0;
  var vh = window.innerHeight || 0;
  var w = Math.min(360, vw - 16);
  pop.style.width = w + 'px';
  var left = rect.right - w;
  if (left < 8) left = 8;
  var top = rect.bottom + 6;
  var h = pop.offsetHeight || 320;
  if (top + h > vh - 8) top = Math.max(8, rect.top - h - 6);
  pop.style.left = Math.round(left) + 'px';
  pop.style.top = Math.round(top) + 'px';
}

export function openBranchTreePopover() {
  var pop = $('ssBranchTreePopover');
  var btn = $('btnSsBranchTreeOpen');
  if (!pop) return;
  ui.ssBranchTreeOpen = true;
  pop.hidden = false;
  if (btn) btn.setAttribute('aria-expanded', 'true');
  renderBranchTree();
  positionBranchTreePopover();
  setTimeout(function() {
    ui.ssBranchPopoverDocHandler = function(ev) {
      var p = $('ssBranchTreePopover');
      var b = $('btnSsBranchTreeOpen');
      if (p && p.contains(ev.target)) return;
      if (b && (ev.target === b || b.contains(ev.target))) return;
      closeBranchTreePopover();
    };
    document.addEventListener('mousedown', ui.ssBranchPopoverDocHandler, true);
  }, 0);
}

export function renderBranchTree() {
  var box = $('ssBranchTree');
  if (!box) return;
  if (!state.novel) {
    box.innerHTML = '<div class="ss-empty ui-empty-tip">请先打开小说</div>';
    return;
  }
  var rows = buildBranchTree(state.novel);
  var chapters = state.novel.chapters || [];
  box.innerHTML = rows.map(function(row) {
    var b = row.branch;
    var pad = Math.max(0, row.depth) * 14;
    var active = b.id === state.novel.activeBranchId ? ' is-active' : '';
    var kindTag = b.kind === BRANCH_KIND_ENDING ? '结局' : '支线';
    var expanded = ui.ssBranchExpandedId === b.id;
    var brChapters = chapters.filter(function(c) {
      return c && c.branchId === b.id;
    }).sort(function(a, c) { return (a.order || 0) - (c.order || 0); });
    var summaryBits = brChapters.slice(0, 3).map(function(c) {
      return (c.title || '未命名') + '：' + String(c.summary || c.content || '').slice(0, 60);
    }).join(' / ') || (b.direction || b.choiceTeaser || '暂无章节摘要');
    var card = '';
    if (expanded) {
      card = '<div class="ss-branch-card">'
        + '<div><strong>' + escapeHtml(b.name) + '</strong> · ' + kindTag
        + (b.parentBranchId ? (' · 自第' + (b.forkOrder + 1) + '章') : ' · 根')
        + '</div>'
        + '<div style="margin-top:6px;">' + escapeHtml(summaryBits) + '</div>'
        + '<div class="ss-branch-card__actions">'
        + '<button type="button" class="btn btn-ghost btn-inline" data-ss-br-switch>切换到此分支</button>'
        + '<button type="button" class="btn btn-ghost btn-inline" data-ss-br-open-ch>查看章节全文</button>'
        + '<label class="ss-branch-ready"><input type="checkbox" data-ss-br-ready '
        + (b.publishReady ? 'checked' : '') + ' />发布</label>'
        + '<button type="button" class="btn btn-ghost btn-inline" data-ss-br-edit>选项文案</button>'
        + '<button type="button" class="btn btn-ghost btn-inline" data-ss-br-ending">'
        + (b.kind === BRANCH_KIND_ENDING ? '取消结局' : '标为结局') + '</button>'
        + '</div></div>';
    }
    return (
      '<div class="ss-branch-node' + active + '" data-branch-id="' + escapeHtml(b.id) + '" style="margin-left:' + pad + 'px">'
      + '<div class="ss-branch-node__row">'
      + '<button type="button" class="btn btn-ghost btn-inline" data-ss-br-expand title="展开摘要卡片">'
      + escapeHtml(b.name) + '</button>'
      + '<span class="ss-branch-meta">' + kindTag
      + (b.parentBranchId ? (' · 自第' + (b.forkOrder + 1) + '章') : ' · 根')
      + '</span>'
      + '</div>'
      + card
      + '</div>'
    );
  }).join('') || '<div class="ss-empty ui-empty-tip">暂无分支</div>';
  if (ui.ssBranchTreeOpen) positionBranchTreePopover();
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
export function renderWrite() {
  var sel = $('ssWriteChapterSelect');
  var titleEl = $('ssWriteChapterTitle');
  var summaryEl = $('ssWriteChapterSummary');
  var contentEl = $('ssWriteChapterContent');
  var advEl = $('ssWriteAdvancePrompt');
  var syncEl = $('ssWriteSyncMvu');
  var warnEl = $('ssWriteMvuWarn');
  var branchSel = $('ssWriteBranchSelect');
  var batchEl = $('ssWriteBatchCount');
  var feedEl = $('ssWriteRunFeed');
  var qaEl = $('ssWriteRunQa');
  var stopEl = $('ssWriteStopOnQa');
  var qaBox = $('ssWriteQaBox');
  var tensionEl = $('ssWriteTension');
  var cpBox = $('ssWriteCheckpointList');
  var ledgerBox = $('ssWriteLedger');

  if (!state.novel) {
    if (sel) sel.innerHTML = '<option value="">请先打开小说</option>';
    if (branchSel) branchSel.innerHTML = '';
    renderBranchTree();
    return;
  }

  var ws = state.novel.writeSettings || {};
  if (batchEl) batchEl.value = String(ws.batchCount || 3);
  if (feedEl) feedEl.checked = ws.runFeedForward !== false;
  if (qaEl) qaEl.checked = ws.runQuality !== false;
  if (stopEl) stopEl.checked = !!ws.stopOnQualityFail;

  if (branchSel) {
    var branches = state.novel.branches || [];
    branchSel.innerHTML = branches.map(function(b) {
      var label = b.name + (b.parentBranchId ? '（分叉）' : '');
      return '<option value="' + escapeHtml(b.id) + '"'
        + (b.id === state.novel.activeBranchId ? ' selected' : '') + '>'
        + escapeHtml(label) + '</option>';
    }).join('');
  }

  var chapters = getActiveChapters(state.novel);
  var curId = sel && sel.value ? sel.value : (chapters[0] && chapters[0].id) || '';
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
  var ch = chapters.find(function(c) { return c.id === curId; });
  if (titleEl) titleEl.value = ch ? ch.title : '';
  var titleBtn = $('ssWriteChapterTitleBtn');
  if (titleBtn) titleBtn.textContent = (ch && ch.title) ? ch.title : '未命名';
  var branchLabel = $('ssWriteBranchLabel');
  if (branchLabel) {
    var brCur = getBranch(state.novel, state.novel.activeBranchId);
    branchLabel.textContent = (brCur && brCur.name) || '—';
  }
  if (summaryEl) {
    var sum = ch ? ch.summary : '';
    if (ch && ch.feedForward && ch.feedForward.summary && !sum) sum = ch.feedForward.summary;
    summaryEl.value = sum;
  }
  if (contentEl) contentEl.value = ch ? ch.content : '';
  if (advEl) advEl.value = ch ? ch.advancePrompt : '';
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

  if (tensionEl) {
    var curve = tensionCurveFromChapters(chapters);
    var hasT = curve.some(function(x) { return x.tension != null && x.hasContent; });
    tensionEl.hidden = !hasT;
    if (hasT) {
      tensionEl.innerHTML = '<div class="ui-label-row"><span>张力曲线</span><span class="ui-hint ui-hint--inline">分支内</span></div>'
        + '<div class="ss-tension-bars">'
        + curve.map(function(x) {
          var t = x.tension != null ? x.tension : 0;
          return '<div class="ss-tension-bar" style="height:' + Math.max(4, t * 8) + 'px" title="'
            + escapeHtml((x.order + 1) + '. ' + (x.tension != null ? x.tension : '—')) + '"></div>';
        }).join('')
        + '</div>';
    }
  }

  if (cpBox) {
    var cps = ch ? listChapterCheckpoints(ch) : [];
    cpBox.innerHTML = cps.length
      ? ('<div class="ui-label-row"><span>章节快照</span><span class="ui-hint ui-hint--inline">最多 5</span></div>'
        + cps.map(function(cp) {
          return '<button type="button" class="btn btn-ghost btn-inline" data-ss-cp="'
            + escapeHtml(cp.id) + '">' + escapeHtml(cp.label || '快照')
            + ' · ' + new Date(cp.createdAt || 0).toLocaleString() + '</button>';
        }).join(' '))
      : '';
  }

  if (ledgerBox) {
    var items = resolveBranchLedger(state.novel, state.novel.activeBranchId);
    ledgerBox.innerHTML = items.map(function(it) {
      return (
        '<div class="ss-ledger-item" data-ledger-id="' + escapeHtml(it.id) + '">'
        + '<input class="ss-ledger-title" value="' + escapeHtml(it.title) + '" />'
        + '<select class="ss-ledger-status">'
        + ['open', 'planted', 'paid', 'dropped'].map(function(s) {
          return '<option value="' + s + '"' + (it.status === s ? ' selected' : '') + '>' + s + '</option>';
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
