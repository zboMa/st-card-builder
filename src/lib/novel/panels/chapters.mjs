/**
 * 章节面板：渲染、绑定、补丁
 */
import { escapeHtml } from '../../utils.mjs';
import {
  splitIntoChapters,
  mergeChapters,
  splitChapterAt,
  renameChapter,
  moveChapter,
  setChapterEnabled,
  exportSelectedChapters,
} from '../chapters.mjs';
import { getFullSourceText } from '../state.mjs';

function selectedChapterIds(state) {
  return (state.chapters || []).filter(function(c) { return c.selected; }).map(function(c) { return c.id; });
}

function downloadChapterMarkdown(text, filename) {
  if (!text) return alert('没有可导出章节');
  var blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename || 'novel-chapters.md';
  a.click();
}

/**
 * @param {object} ctx — 小说工坊上下文（由 shared/context.mjs 创建，含 $、save、busyFlags 等）
 */
export function registerChapters(ctx) {
  var panel = {};

  function showChapterPreview(ch) {
    if (!ch) return;
    var title = ctx.$('novelModalChapterTitle');
    var body = ctx.$('novelModalChapterBody');
    if (title) title.textContent = ch.title || '章节预览';
    if (body) body.textContent = ch.text || '';
    ctx.openNovelModal('novelModalChapter');
  }

  function openChapterRename(ch) {
    if (!ch) return;
    ctx.editState.renamingChapterId = ch.id;
    var input = ctx.$('novelChapterRenameInput');
    if (input) {
      input.value = ch.title || '';
    }
    ctx.openNovelModal('novelModalChapterRename');
    setTimeout(function() {
      if (!input) return;
      try {
        input.focus();
        input.select();
      } catch (e) { /* ignore */ }
    }, 0);
  }

  function confirmChapterRename() {
    var id = ctx.editState.renamingChapterId;
    var input = ctx.$('novelChapterRenameInput');
    if (!id || !input) {
      ctx.closeNovelModal('novelModalChapterRename');
      return;
    }
    var title = String(input.value || '').trim();
    if (!title) {
      if (ctx.setStatus) ctx.setStatus('novelChapterStatus', '标题不能为空');
      try { input.focus(); } catch (e) { /* ignore */ }
      return;
    }
    ctx.state.chapters = renameChapter(ctx.state.chapters, id, title);
    ctx.editState.renamingChapterId = null;
    ctx.closeNovelModal('novelModalChapterRename');
    ctx.save();
    ctx.renderAll();
  }

  panel.render = function() {
    var state = ctx.state;
    var es = ctx.editState;
    var list = ctx.$('novelChapterList');
    var count = ctx.$('novelChapterCount');
    if (count) count.textContent = (state.chapters || []).length + ' 章';
    var mode = ctx.$('novelChapterSplitMode');
    if (mode) mode.value = state.chapterSplitMode || 'title';
    var chunk = ctx.$('novelChunkSize');
    if (chunk) chunk.value = String(state.chunkSize || 8000);

    var searchInput = ctx.$('novelChapterSearchInput');
    var searchClear = ctx.$('novelChapterSearchClear');
    if (searchInput && searchInput.value !== es.novelChapterSearchQuery) {
      if (document.activeElement !== searchInput) searchInput.value = es.novelChapterSearchQuery || '';
    }
    if (searchClear) searchClear.style.display = es.novelChapterSearchQuery ? '' : 'none';

    if (!list) return;
    if (!(state.chapters || []).length) {
      list.innerHTML = '<div class="novel-status-text">尚未拆章。请先导入资料后点击右上「自动拆章」。</div>';
      return;
    }
    var q = String(es.novelChapterSearchQuery || '').trim().toLowerCase();
    var rows = state.chapters.map(function(c, i) { return { c: c, i: i }; }).filter(function(row) {
      if (!q) return true;
      return String(row.c.title || '').toLowerCase().indexOf(q) >= 0;
    });
    if (!rows.length) {
      list.innerHTML = '<div class="novel-status-text">未找到匹配「' + escapeHtml(es.novelChapterSearchQuery) + '」的章节。</div>';
      return;
    }
    // 左：勾选 + 标题/字数；右：图标操作（不换到标题下方）
    list.innerHTML = rows.map(function(row) {
      var c = row.c;
      var i = row.i;
      var disabled = c.enabled === false;
      return '<div class="novel-chapter-row' + (disabled ? ' is-disabled' : '') + '" data-ch-id="' + c.id + '">'
        + '<input type="checkbox" data-ch-sel="' + c.id + '"' + (c.selected ? ' checked' : '') + ' />'
        + '<div class="novel-chapter-main">'
        + '<button type="button" class="novel-chapter-title" data-ch-preview="' + c.id + '" title="预览正文">'
        + escapeHtml(c.title) + '</button>'
        + '<span class="novel-chapter-meta">#' + (i + 1) + ' · ' + (c.text || '').length + ' 字 · '
        + (disabled ? '已禁用' : '启用') + '</span>'
        + '</div>'
        + '<div class="novel-chapter-actions">'
        + ctx.iconBtn('data-ch-preview="' + c.id + '"', '◎', '预览')
        + ctx.iconBtn('data-ch-split="' + c.id + '"', '½', '对半拆分')
        + ctx.iconBtn('data-ch-rename="' + c.id + '"', '✎', '重命名')
        + ctx.iconBtn('data-ch-up="' + c.id + '"', '↑', '上移')
        + ctx.iconBtn('data-ch-down="' + c.id + '"', '↓', '下移')
        + ctx.iconBtn('data-ch-toggle="' + c.id + '"', disabled ? '▶' : '⏸', disabled ? '启用' : '禁用')
        + ctx.iconBtn('data-ch-export="' + c.id + '"', '⬇', '导出')
        + ctx.iconBtn('data-ch-delete="' + c.id + '"', '×', '删除', 'is-danger')
        + '</div></div>';
    }).join('');
    list.querySelectorAll('[data-ch-sel]').forEach(function(cb) {
      cb.addEventListener('change', function() {
        var id = cb.getAttribute('data-ch-sel');
        state.chapters = state.chapters.map(function(c) {
          return c.id === id ? Object.assign({}, c, { selected: cb.checked }) : c;
        });
        ctx.save();
      });
    });
    list.querySelectorAll('[data-ch-preview]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-ch-preview');
        var ch = state.chapters.find(function(c) { return c.id === id; });
        showChapterPreview(ch);
      });
    });
    list.querySelectorAll('[data-ch-split]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-ch-split');
        var ch = state.chapters.find(function(c) { return c.id === id; });
        if (!ch) return;
        state.chapters = splitChapterAt(state.chapters, id, Math.floor(ch.text.length / 2));
        ctx.save();
        ctx.renderAll();
      });
    });
    list.querySelectorAll('[data-ch-rename]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-ch-rename');
        var ch = state.chapters.find(function(c) { return c.id === id; });
        if (!ch) return;
        openChapterRename(ch);
      });
    });
    list.querySelectorAll('[data-ch-up]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        state.chapters = moveChapter(state.chapters, btn.getAttribute('data-ch-up'), -1);
        ctx.save();
        ctx.renderAll();
      });
    });
    list.querySelectorAll('[data-ch-down]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        state.chapters = moveChapter(state.chapters, btn.getAttribute('data-ch-down'), 1);
        ctx.save();
        ctx.renderAll();
      });
    });
    list.querySelectorAll('[data-ch-toggle]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-ch-toggle');
        var ch = state.chapters.find(function(c) { return c.id === id; });
        if (!ch) return;
        state.chapters = setChapterEnabled(state.chapters, id, ch.enabled === false);
        ctx.save();
        ctx.renderAll();
      });
    });
    list.querySelectorAll('[data-ch-export]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-ch-export');
        var text = exportSelectedChapters(state.chapters, [id]);
        var ch = state.chapters.find(function(c) { return c.id === id; });
        downloadChapterMarkdown(text, (ch && ch.title ? ch.title : 'chapter') + '.md');
      });
    });
    list.querySelectorAll('[data-ch-delete]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-ch-delete');
        if (!confirm('确定删除该章节？')) return;
        state.chapters = state.chapters.filter(function(c) { return c.id !== id; });
        ctx.save();
        ctx.renderAll();
      });
    });
  };

  panel.bind = function() {
    var splitMode = ctx.$('novelChapterSplitMode');
    if (splitMode) splitMode.addEventListener('change', function() {
      ctx.state.chapterSplitMode = splitMode.value;
      ctx.save();
    });
    var chunkEl = ctx.$('novelChunkSize');
    if (chunkEl) chunkEl.addEventListener('change', function() {
      ctx.state.chunkSize = parseInt(chunkEl.value, 10) || 8000;
      ctx.save();
    });

    var searchInput = ctx.$('novelChapterSearchInput');
    var searchClear = ctx.$('novelChapterSearchClear');
    if (searchInput) {
      searchInput.addEventListener('input', function() {
        ctx.editState.novelChapterSearchQuery = searchInput.value || '';
        panel.render();
      });
    }
    if (searchClear) searchClear.addEventListener('click', function() {
      ctx.editState.novelChapterSearchQuery = '';
      if (searchInput) searchInput.value = '';
      panel.render();
    });

    function runSplit() {
      var state = ctx.state;
      if (ctx.syncInputsFromSource) ctx.syncInputsFromSource();
      var modeEl = ctx.$('novelChapterSplitMode');
      var sizeEl = ctx.$('novelChunkSize');
      if (modeEl) state.chapterSplitMode = modeEl.value || 'title';
      if (sizeEl) state.chunkSize = parseInt(sizeEl.value, 10) || 8000;
      var full = getFullSourceText(state).trim();
      if (!full) return alert('请先导入原始资料');
      state.chapters = splitIntoChapters(full, {
        mode: state.chapterSplitMode || 'title',
        chunkSize: state.chunkSize || 8000,
      });
      ctx.save();
      ctx.closeNovelModal('novelModalSplit');
      ctx.renderAll();
      if (ctx.setStatus) ctx.setStatus('novelChapterStatus', '已拆为 ' + state.chapters.length + ' 章');
    }

    var splitBtn = ctx.$('btnNovelSplitChapters');
    if (splitBtn) splitBtn.addEventListener('click', function() {
      var state = ctx.state;
      var modeEl = ctx.$('novelChapterSplitMode');
      var sizeEl = ctx.$('novelChunkSize');
      if (modeEl) modeEl.value = state.chapterSplitMode || 'title';
      if (sizeEl) sizeEl.value = String(state.chunkSize || 8000);
      ctx.openNovelModal('novelModalSplit');
    });
    var splitConfirm = ctx.$('btnNovelSplitConfirm');
    if (splitConfirm) splitConfirm.addEventListener('click', runSplit);

    var renameConfirm = ctx.$('btnNovelChapterRenameConfirm');
    if (renameConfirm) renameConfirm.addEventListener('click', confirmChapterRename);
    var renameInput = ctx.$('novelChapterRenameInput');
    if (renameInput) {
      renameInput.addEventListener('keydown', function(ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          confirmChapterRename();
        }
      });
    }

    function withSelected(fn) {
      var state = ctx.state;
      var ids = selectedChapterIds(state);
      if (!ids.length) return alert('请先勾选章节');
      fn(ids);
      ctx.save();
      ctx.renderAll();
    }

    // 顶栏仅批量：合并 / 启停所选 / 导出选中 / 删除所选；单条操作在行内
    var mergeBtn = ctx.$('btnChMerge');
    if (mergeBtn) mergeBtn.addEventListener('click', function() {
      withSelected(function(ids) {
        if (ids.length < 2) return alert('请至少选择两章合并');
        ctx.state.chapters = mergeChapters(ctx.state.chapters, ids);
      });
    });
    var en = ctx.$('btnChEnable');
    if (en) en.addEventListener('click', function() {
      withSelected(function(ids) {
        ids.forEach(function(id) { ctx.state.chapters = setChapterEnabled(ctx.state.chapters, id, true); });
      });
    });
    var dis = ctx.$('btnChDisable');
    if (dis) dis.addEventListener('click', function() {
      withSelected(function(ids) {
        ids.forEach(function(id) { ctx.state.chapters = setChapterEnabled(ctx.state.chapters, id, false); });
      });
    });
    var exp = ctx.$('btnChExport');
    if (exp) exp.addEventListener('click', function() {
      downloadChapterMarkdown(exportSelectedChapters(ctx.state.chapters, selectedChapterIds(ctx.state)), 'novel-chapters.md');
    });
    var del = ctx.$('btnChDelete');
    if (del) del.addEventListener('click', function() {
      withSelected(function(ids) {
        var set = {};
        ids.forEach(function(id) { set[id] = true; });
        ctx.state.chapters = ctx.state.chapters.filter(function(c) { return !set[c.id]; });
      });
    });
  };

  panel.patch = function(opts) {
    var state = ctx.state;
    opts = opts || {};
    var action = String(opts.action || '');
    var ids = Array.isArray(opts.ids) ? opts.ids.slice() : [];
    if (opts.id) ids.push(opts.id);
    if (action === 'merge') {
      if (ids.length < 2) throw new Error('合并至少需要两章 id');
      state.chapters = mergeChapters(state.chapters, ids);
    } else if (action === 'enable' || action === 'disable') {
      ids.forEach(function(id) {
        state.chapters = setChapterEnabled(state.chapters, id, action === 'enable');
      });
    } else if (action === 'delete') {
      var drop = {};
      ids.forEach(function(id) { drop[id] = true; });
      state.chapters = state.chapters.filter(function(c) { return !drop[c.id]; });
    } else if (action === 'rename') {
      if (!ids[0] || opts.title == null) throw new Error('rename 需要 id 与 title');
      state.chapters = renameChapter(state.chapters, ids[0], String(opts.title));
    } else if (action === 'move') {
      var delta = opts.delta != null ? Number(opts.delta) : (opts.dir === 'up' ? -1 : 1);
      state.chapters = moveChapter(state.chapters, ids[0], delta);
    } else if (action === 'split') {
      var ch = state.chapters.find(function(c) { return c.id === ids[0]; });
      if (!ch) throw new Error('章节未找到');
      var at = opts.at != null ? Number(opts.at) : Math.floor(ch.text.length / 2);
      state.chapters = splitChapterAt(state.chapters, ids[0], at);
    } else if (action === 'select') {
      var setSel = {};
      ids.forEach(function(id) { setSel[id] = true; });
      state.chapters = state.chapters.map(function(c) {
        return Object.assign({}, c, { selected: !!setSel[c.id] });
      });
    } else {
      throw new Error('未知 action: ' + action + '（merge|enable|disable|delete|rename|move|split|select）');
    }
    ctx.save();
    ctx.renderAll();
    return { action: action, chapterCount: state.chapters.length };
  };

  // 挂载到 ctx
  ctx.panels.chapters = panel;
  return panel;
}
