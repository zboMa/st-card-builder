/**
 * Story Studio 五视图渲染（拆自 browserApp）
 */

import { getActiveChapters, getActiveOutline } from './state.mjs';
import { buildDisplayVersion } from './version.mjs';
import { getBranch } from './branch.mjs';
import { tensionCurveFromChapters } from './quality.mjs';
import { mountStoryGraph, destroyStoryGraph } from './graphView.mjs';
import { state, ui, $, getCharacterVersion, escapeHtml } from './shared.mjs';
import { renderWrite } from './writeBranchUi.mjs';
import {
  storyGraphUi,
  formatStoryGraphDetail,
  openStoryGraphCtxMenu,
} from './graphUi.mjs';

export function buildNovelActionsHtml(item) {
  function iconBtn(act, label, extraClass, svg) {
    var cls = 'btn-icon btn-icon--sm ss-novel-icon' + (extraClass ? ' ' + extraClass : '');
    return '<button type="button" class="' + cls + '" data-ss-act="' + act
      + '" title="' + label + '" aria-label="' + label + '">' + svg + '</button>';
  }
  function textBtn(act, label, title) {
    return '<button type="button" class="btn btn-ghost btn-inline" data-ss-act="'
      + act + '"' + (title ? ' title="' + title + '"' : '') + '>' + label + '</button>';
  }
  var exportSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M8 11l4 4 4-4"/><path d="M5 19h14"/></svg>';
  var deleteSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M10 11v6M14 11v6"/><path d="M7 7l1 12a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9l1-12"/></svg>';
  return ''
    + '<div class="ss-novel-item__actions-group">'
    + iconBtn('export', '导出 TXT', 'ss-novel-icon--export', exportSvg)
    + iconBtn('delete', '删除', 'ss-novel-icon--danger btn-icon--danger', deleteSvg)
    + '</div>'
    + '<div class="ss-novel-item__share">'
    + textBtn('versions', '版本', '版本列表与切换')
    + textBtn('bump', '增版', '写入版本列表并升草稿版号（不发布）')
    + textBtn('publish', '发布', '写入已发布版本，草稿自动再升一版')
    + textBtn('share', '分享')
    + (item.shareToken ? textBtn('reset-share', '重置链接', '作废旧链接并生成新 token') : '')
    + (item.shareToken ? textBtn('unshare', '停分享') : '')
    + '</div>';
}
export function renderManage() {
  var list = $('ssNovelList');
  if (!list) return;
  if (!state.catalog.length) {
    list.innerHTML = '<p class="ss-empty ss-empty--panel ui-empty-tip">尚无小说。点击右上角「新建」开始。</p>';
    return;
  }
  var activeId = state.novel ? state.novel.id : '';
  var charVer = getCharacterVersion();
  list.innerHTML = state.catalog.map(function(item) {
    var active = item.id === activeId;
    var workVer = buildDisplayVersion(charVer, item.novelVersion || '1');
    var pub = item.publishedDisplayVersion
      ? ('已发布 ' + item.publishedDisplayVersion)
      : '未发布';
    var stale = item.publishedDisplayVersion
      && item.publishedDisplayVersion !== workVer
      ? ' · 草稿已超前'
      : '';
    var share = item.shareToken ? ' · 分享中' : '';
    return (
      '<div class="ss-novel-item' + (active ? ' is-active' : '') + '" data-novel-id="' + escapeHtml(item.id) + '">'
      + '<div class="ss-novel-item__main">'
      + '<div class="ss-novel-item__title-row">'
      + '<button type="button" class="ss-novel-title" data-ss-act="rename" title="点击重命名">'
      + escapeHtml(item.title || '未命名') + '</button>'
      + (active ? '<span class="ss-novel-badge">当前</span>' : '')
      + '</div>'
      + '<button type="button" class="ss-novel-meta" data-ss-act="open" title="打开">'
      + (item.chapterCount || 0) + ' 章 · '
      + (item.outlineCount || 0) + ' 大纲'
      + (item.branchCount > 1 ? (' · ' + item.branchCount + ' 分支') : '')
      + ' · 工作 ' + escapeHtml(workVer)
      + ' · ' + escapeHtml(pub) + escapeHtml(stale) + escapeHtml(share) + '</button>'
      + '</div>'
      + '<div class="ss-novel-item__actions">'
      + buildNovelActionsHtml(item)
      + '</div></div>'
    );
  }).join('');
}
export function renderGraph() {
  var stats = $('ssGraphStats');
  var detail = $('ssGraphDetail');
  var depthEl = $('ssGraphHighlightDepth');
  var personEl = $('ssGraphPersonOnly');
  if (depthEl && document.activeElement !== depthEl) {
    depthEl.value = String(storyGraphUi.highlightDepth);
  }
  if (personEl && document.activeElement !== personEl) {
    personEl.checked = !!storyGraphUi.personOnly;
  }
  if (!state.novel) {
    if (stats) stats.textContent = '节点 0 · 边 0';
    if (detail) detail.textContent = '打开小说后可查看图谱';
    destroyStoryGraph();
    return;
  }
  var g = state.novel.graph || { nodes: [], edges: [] };
  var viewNodes = g.nodes || [];
  var viewEdges = g.edges || [];
  if (storyGraphUi.personOnly) {
    viewNodes = viewNodes.filter(function(n) { return n && n.type === 'character'; });
    var ids = {};
    viewNodes.forEach(function(n) { ids[String(n.id)] = true; });
    viewEdges = viewEdges.filter(function(e) {
      return e && ids[String(e.from)] && ids[String(e.to)];
    });
  }
  if (stats) {
    stats.textContent = '节点 ' + viewNodes.length + ' · 边 ' + viewEdges.length
      + (storyGraphUi.personOnly ? '（仅人物）' : '');
  }

  var cy = $('ssGraphCy');
  if (cy) {
    mountStoryGraph(cy, g, {
      personOnly: !!storyGraphUi.personOnly,
      highlightDegree: storyGraphUi.highlightDepth,
      onSelect: function(payload) {
        var d = $('ssGraphDetail');
        if (!d) return;
        if (!payload) {
          d.textContent = '点击节点或边查看详情';
          return;
        }
        d.innerHTML = formatStoryGraphDetail(payload);
      },
      onNodeContextMenu: function(payload) {
        openStoryGraphCtxMenu(payload);
      },
      onEdgeContextMenu: function(payload) {
        openStoryGraphCtxMenu(payload);
      },
    });
  }
}
export function renderOutline() {
  var box = $('ssOutlineList');
  var tensionEl = $('ssOutlineTension');
  var branchTag = $('btnSsOutlineBranchTag');
  if (!box) return;
  if (!state.novel) {
    box.innerHTML = '<div class="ss-empty ui-empty-tip">请先打开一部小说</div>';
    if (tensionEl) tensionEl.hidden = true;
    if (branchTag) branchTag.textContent = '—';
    hideCenteredWizard();
    return;
  }
  var br = getBranch(state.novel, state.novel.activeBranchId);
  if (branchTag) {
    branchTag.textContent = (state.novel.title || '未命名')
      + ' · ' + ((br && br.name) || '主线');
  }
  renderWizardChrome();
  var items = getActiveOutline(state.novel);
  box.innerHTML = items.map(function(o, i) {
    return (
      '<div class="ss-outline-item" data-ol-idx="' + i + '" data-ol-id="' + escapeHtml(o.id) + '">'
      + '<div class="ss-outline-item__head">'
      + '<span class="ss-ol-idx">#' + (i + 1) + '</span>'
      + '<button type="button" class="ss-ol-title-btn" data-ss-ol-edit-title title="点击编辑标题">'
      + escapeHtml(o.title || '未命名') + '</button>'
      + '<button type="button" class="btn btn-ghost btn-inline" data-ss-ol-discard title="从此章起废弃后续">废弃后续</button>'
      + '<button type="button" class="btn btn-ghost btn-inline" data-ss-ol-del>删</button>'
      + '</div>'
      + '<textarea class="ss-ol-summary" rows="2" placeholder="摘要">' + escapeHtml(o.summary) + '</textarea>'
      + '</div>'
    );
  }).join('') || '<div class="ss-empty ui-empty-tip">暂无大纲。可分段生成或手动添加。</div>';

  var chapters = getActiveChapters(state.novel);
  var curve = tensionCurveFromChapters(chapters);
  if (tensionEl) {
    var hasT = curve.some(function(x) { return x.tension != null; });
    tensionEl.hidden = !hasT;
    if (hasT) {
      tensionEl.innerHTML = '<div class="ui-label-row"><span>张力曲线</span><span class="ui-hint ui-hint--inline">1～10</span></div>'
        + '<div class="ss-tension-bars">'
        + curve.map(function(x) {
          var t = x.tension != null ? x.tension : 0;
          var h = Math.max(4, t * 8);
          return '<div class="ss-tension-bar" title="' + escapeHtml((x.order + 1) + '. ' + x.title + ' · ' + (x.tension != null ? x.tension : '—'))
            + '" style="height:' + h + 'px"></div>';
        }).join('')
        + '</div>';
    }
  }
}

function hideCenteredWizard() {
  var modal = $('ssWizardModal');
  if (!modal) return;
  modal.hidden = true;
  if (modal._home && modal.parentNode !== modal._home) modal._home.appendChild(modal);
}

export function openWizardModal() {
  var modal = $('ssWizardModal');
  if (!modal) return;
  if (modal.parentNode !== document.body) {
    if (!modal._home) modal._home = modal.parentNode;
    document.body.appendChild(modal);
  }
  modal.hidden = false;
  renderWizardChrome();
}

export function closeWizardModal() {
  hideCenteredWizard();
}

export function renderWizardChrome() {
  var wizBox = $('ssWizardBox');
  var modal = $('ssWizardModal');
  if (!wizBox || !state.novel) return;
  var step = (state.novel.wizard && state.novel.wizard.step) || '';
  /* 有向导步骤时保持弹窗可开；关闭按钮只关 UI，不清除 wizard 状态 */
  wizBox.querySelectorAll('[data-wiz]').forEach(function(el) {
    var s = el.getAttribute('data-wiz');
    el.classList.toggle('is-active', s === step);
    el.classList.toggle('is-done',
      (step === 'outline' && s === 'direction')
      || (step === 'ready' && (s === 'direction' || s === 'outline'))
    );
  });
  var dirEl = $('ssOutlineDirection');
  if (dirEl && state.novel.wizard && state.novel.wizard.direction && !dirEl.value) {
    dirEl.value = state.novel.wizard.direction;
  }
  if (modal && !modal.hidden && !step) {
    /* 跳过/完成后可自动关 */
  }
}
export function renderRead() {
  var title = $('btnSsReadBranchTag') || $('ssReadTitle');
  var body = $('ssReadBody');
  var toc = $('ssReadToc');
  var modeSel = $('ssReadMode');
  var modeBtn = $('btnSsReadMode');
  var pageInfo = $('ssReadPageInfo');
  if (!state.novel) {
    if (title) title.textContent = '—';
    if (body) body.innerHTML = '<div class="ss-empty ui-empty-tip">请先在「管理」打开一部小说</div>';
    if (toc) toc.innerHTML = '';
    return;
  }
  var br = getBranch(state.novel, state.novel.activeBranchId);
  if (title) {
    title.textContent = (state.novel.title || '未命名')
      + (br && br.name ? ' · ' + br.name : '');
  }
  var aside = $('ssReadAside');
  if (aside) aside.hidden = !ui.ssReadTocOpen;
  var tocBtn = $('btnSsReadToc');
  if (tocBtn) tocBtn.setAttribute('aria-expanded', ui.ssReadTocOpen ? 'true' : 'false');
  var chapters = getActiveChapters(state.novel);
  var rs = state.novel.readState || {};
  var idx = chapters.findIndex(function(c) { return c.id === rs.chapterId; });
  if (idx < 0) idx = 0;
  var ch = chapters[idx];
  var mode = rs.mode || 'swipe';
  if (modeSel) modeSel.value = mode;
  if (modeBtn) {
    modeBtn.textContent = mode === 'page' ? '分页' : '滑动';
  }
  var modeList = $('ssReadModeList');
  if (modeList) {
    modeList.querySelectorAll('[data-ss-mode]').forEach(function(opt) {
      opt.classList.toggle('is-active', opt.getAttribute('data-ss-mode') === mode);
      opt.setAttribute('aria-selected', opt.getAttribute('data-ss-mode') === mode ? 'true' : 'false');
    });
  }

  if (toc) {
    toc.innerHTML = chapters.map(function(c, i) {
      return '<button type="button" class="ss-toc-item' + (i === idx ? ' is-active' : '') + '" data-ch-id="'
        + escapeHtml(c.id) + '">' + (i + 1) + '. ' + escapeHtml(c.title || '未命名') + '</button>';
    }).join('') || '<div class="ss-empty ui-empty-tip">暂无章节</div>';
  }

  if (!ch) {
    if (body) body.innerHTML = '<div class="ss-empty ui-empty-tip">暂无章节</div>';
    if (pageInfo) pageInfo.textContent = '';
    return;
  }

  var text = String(ch.content || '').trim();
  var display = text;
  var isSummary = false;
  if (!display) {
    display = String(ch.summary || '').trim() || '（本章暂无正文与摘要）';
    isSummary = true;
  }

  if (mode === 'page' && text) {
    var pageSize = 900;
    var pages = [];
    for (var p = 0; p < text.length; p += pageSize) pages.push(text.slice(p, p + pageSize));
    if (!pages.length) pages = [display];
    var pi = Math.min(Math.max(0, rs.pageIndex || 0), pages.length - 1);
    state.novel.readState.pageIndex = pi;
    display = pages[pi];
    if (pageInfo) pageInfo.textContent = '第 ' + (idx + 1) + '/' + chapters.length + ' 章 · '
      + (ch.title || '未命名')
      + ' · 页 ' + (pi + 1) + '/' + pages.length;
    if (body) {
      body.innerHTML = '<div class="ss-read-page" data-page-mode="page">'
        + '<h3>' + escapeHtml(ch.title) + '</h3>'
        + '<div class="ss-read-text">' + escapeHtml(display).replace(/\n/g, '<br/>') + '</div>'
        + '</div>';
    }
  } else {
    if (pageInfo) pageInfo.textContent = '第 ' + (idx + 1) + '/' + chapters.length + ' 章 · '
      + (ch.title || '未命名');
    if (body) {
      var sumBlock = isSummary
        ? ('<div class="ss-summary-card"><p class="ss-read-summary-tag">摘要（无正文）</p>'
          + '<div class="ss-read-text">' + escapeHtml(display).replace(/\n/g, '<br/>') + '</div></div>')
        : ('<div class="ss-read-text">' + escapeHtml(display).replace(/\n/g, '<br/>') + '</div>');
      body.innerHTML = '<div class="ss-read-page" data-page-mode="swipe">'
        + '<h3>' + escapeHtml(ch.title) + '</h3>'
        + sumBlock
        + '</div>';
    }
  }

  // bookmarks
  var bmBox = $('ssReadBookmarks');
  if (bmBox) {
    var bms = state.novel.bookmarks || [];
    bmBox.innerHTML = bms.map(function(b) {
      var c = chapters.find(function(x) { return x.id === b.chapterId; })
        || (state.novel.chapters || []).find(function(x) { return x.id === b.chapterId; });
      return '<button type="button" class="ss-bm-item" data-bm-ch="' + escapeHtml(b.chapterId) + '">'
        + escapeHtml((c && c.title) || '书签') + (b.note ? ' · ' + escapeHtml(b.note) : '')
        + '</button>';
    }).join('') || '<span class="ss-muted">暂无书签</span>';
  }
}
export function setReadTocOpen(open) {
  ui.ssReadTocOpen = !!open;
  var aside = $('ssReadAside');
  var btn = $('btnSsReadToc');
  if (aside) aside.hidden = !ui.ssReadTocOpen;
  if (btn) btn.setAttribute('aria-expanded', ui.ssReadTocOpen ? 'true' : 'false');
}
export function renderAll() {
  renderManage();
  renderGraph();
  renderOutline();
  renderWrite();
  renderRead();
}
