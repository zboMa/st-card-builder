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
    var active = item.id === activeId ? ' is-active' : '';
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
      '<div class="ss-novel-item' + active + '" data-novel-id="' + escapeHtml(item.id) + '">'
      + '<div class="ss-novel-item__main">'
      + '<button type="button" class="ss-novel-title" data-ss-act="rename" title="点击重命名">'
      + escapeHtml(item.title || '未命名') + '</button>'
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
  var box = $('ssGraphNodes');
  var edgeBox = $('ssGraphEdges');
  var title = $('ssCurrentNovelTitle');
  var stats = $('ssGraphStats');
  var detail = $('ssGraphDetail');
  if (title) title.textContent = state.novel ? state.novel.title : '（未打开小说）';
  if (!state.novel) {
    if (box) box.innerHTML = '<div class="ss-empty ui-empty-tip">请先在「管理」打开一部小说</div>';
    if (edgeBox) edgeBox.innerHTML = '';
    if (stats) stats.textContent = '节点 0 · 边 0';
    if (detail) detail.textContent = '打开小说后可查看图谱';
    destroyStoryGraph();
    return;
  }
  var g = state.novel.graph || { nodes: [], edges: [] };
  if (stats) stats.textContent = '节点 ' + (g.nodes || []).length + ' · 边 ' + (g.edges || []).length;

  if (box) {
    box.innerHTML = (g.nodes || []).map(function(n, i) {
      return (
        '<div class="ss-graph-row" data-node-idx="' + i + '">'
        + '<select class="ss-node-type" data-f="type">'
        + '<option value="character"' + (n.type === 'character' ? ' selected' : '') + '>人物</option>'
        + '<option value="location"' + (n.type === 'location' ? ' selected' : '') + '>地点</option>'
        + '<option value="other"' + (n.type === 'other' ? ' selected' : '') + '>其他</option>'
        + '</select>'
        + '<input class="ss-node-name" data-f="name" value="' + escapeHtml(n.name) + '" placeholder="名称" />'
        + '<input class="ss-node-note" data-f="note" value="' + escapeHtml(n.note) + '" placeholder="备注" />'
        + '<button type="button" class="btn btn-ghost btn-inline" data-ss-node-del>删</button>'
        + '</div>'
      );
    }).join('') || '<div class="ss-empty ui-empty-tip">暂无节点。可从卡面种子生成。</div>';
  }

  var nodeOpts = (g.nodes || []).map(function(n) {
    return '<option value="' + escapeHtml(n.id) + '">' + escapeHtml(n.name) + '</option>';
  }).join('');
  if (edgeBox) {
    edgeBox.innerHTML = (g.edges || []).map(function(e, i) {
      return (
        '<div class="ss-graph-row" data-edge-idx="' + i + '">'
        + '<select data-f="from">' + nodeOpts.replace(
          'value="' + escapeHtml(e.from) + '"',
          'value="' + escapeHtml(e.from) + '" selected'
        ) + '</select>'
        + '<input data-f="label" value="' + escapeHtml(e.label) + '" placeholder="关系" />'
        + '<select data-f="to">' + nodeOpts.replace(
          'value="' + escapeHtml(e.to) + '"',
          'value="' + escapeHtml(e.to) + '" selected'
        ) + '</select>'
        + '<button type="button" class="btn btn-ghost btn-inline" data-ss-edge-del>删</button>'
        + '</div>'
      );
    }).join('') || '<div class="ss-empty ui-empty-tip">暂无关系边</div>';
  }

  var cy = $('ssGraphCy');
  if (cy) {
    mountStoryGraph(cy, g, function(payload) {
      var d = $('ssGraphDetail');
      if (!d) return;
      if (!payload) {
        d.textContent = '点击节点或边查看详情';
        return;
      }
      if (payload.kind === 'node') {
        var note = (payload.attrs && payload.attrs.note) || '';
        d.textContent = '节点 · ' + payload.label + '（' + payload.type + '）'
          + (note ? ' — ' + note : '');
      } else {
        d.textContent = '关系 · ' + (payload.label || '') + '：' + payload.source + ' → ' + payload.target;
      }
    });
  }
}
export function renderOutline() {
  var box = $('ssOutlineList');
  var tensionEl = $('ssOutlineTension');
  var wizBox = $('ssWizardBox');
  if (!box) return;
  if (!state.novel) {
    box.innerHTML = '<div class="ss-empty ui-empty-tip">请先打开一部小说</div>';
    if (tensionEl) tensionEl.hidden = true;
    if (wizBox) wizBox.hidden = true;
    return;
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

export function renderWizardChrome() {
  var wizBox = $('ssWizardBox');
  if (!wizBox || !state.novel) return;
  var step = (state.novel.wizard && state.novel.wizard.step) || '';
  wizBox.hidden = !step;
  if (!step) return;
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
}
export function renderRead() {
  var title = $('ssReadTitle');
  var body = $('ssReadBody');
  var toc = $('ssReadToc');
  var modeSel = $('ssReadMode');
  var pageInfo = $('ssReadPageInfo');
  if (!state.novel) {
    if (title) title.textContent = '未打开小说';
    if (body) body.innerHTML = '<div class="ss-empty ui-empty-tip">请先在「管理」打开一部小说</div>';
    if (toc) toc.innerHTML = '';
    return;
  }
  var br = getBranch(state.novel, state.novel.activeBranchId);
  if (title) title.textContent = state.novel.title + (br && br.name ? ' · ' + br.name : '');
  var aside = $('ssReadAside');
  if (aside) aside.hidden = !ui.ssReadTocOpen;
  var tocBtn = $('btnSsReadToc');
  if (tocBtn) tocBtn.setAttribute('aria-expanded', ui.ssReadTocOpen ? 'true' : 'false');
  var chapters = getActiveChapters(state.novel);
  var rs = state.novel.readState || {};
  var idx = chapters.findIndex(function(c) { return c.id === rs.chapterId; });
  if (idx < 0) idx = 0;
  var ch = chapters[idx];
  if (modeSel) modeSel.value = rs.mode || 'swipe';

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
    isSummary = !!ch.summary;
  }

  var mode = rs.mode || 'swipe';
  if (mode === 'page' && text) {
    var pageSize = 900;
    var pages = [];
    for (var p = 0; p < text.length; p += pageSize) pages.push(text.slice(p, p + pageSize));
    if (!pages.length) pages = [display];
    var pi = Math.min(Math.max(0, rs.pageIndex || 0), pages.length - 1);
    state.novel.readState.pageIndex = pi;
    display = pages[pi];
    if (pageInfo) pageInfo.textContent = '第 ' + (idx + 1) + '/' + chapters.length + ' 章 · 页 '
      + (pi + 1) + '/' + pages.length;
    if (body) {
      body.innerHTML = '<div class="ss-read-page" data-page-mode="page">'
        + '<h3>' + escapeHtml(ch.title) + '</h3>'
        + (isSummary ? '<p class="ss-read-summary-tag">摘要</p>' : '')
        + '<div class="ss-read-text">' + escapeHtml(display).replace(/\n/g, '<br/>') + '</div>'
        + '</div>';
    }
  } else {
    if (pageInfo) pageInfo.textContent = '第 ' + (idx + 1) + '/' + chapters.length + ' 章';
    if (body) {
      body.innerHTML = '<div class="ss-read-page" data-page-mode="swipe">'
        + '<h3>' + escapeHtml(ch.title) + '</h3>'
        + (isSummary ? '<p class="ss-read-summary-tag">摘要（无正文）</p>' : '')
        + '<div class="ss-read-text">' + escapeHtml(display).replace(/\n/g, '<br/>') + '</div>'
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
