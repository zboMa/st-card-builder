/**
 * 虚拟列表适配层：基于 @tanstack/virtual-core（开源 headless）
 * API 供拆章 / 世界书列表复用；行用 absolute + translateY，避免 flex 压缩。
 */
import {
  Virtualizer,
  elementScroll,
  observeElementOffset,
  observeElementRect,
  measureElement,
} from '@tanstack/virtual-core';

/**
 * @param {{
 *   viewport: HTMLElement,
 *   rowHeight: number,
 *   overscan?: number,
 *   gap?: number,
 *   renderRow: (item: any, index: number) => string,
 *   emptyHtml?: string,
 * }} opts
 */
export function createVirtualList(opts) {
  var viewport = opts.viewport;
  var estimate = Math.max(1, Number(opts.rowHeight) || 64);
  var overscan = opts.overscan != null ? Math.max(0, Number(opts.overscan)) : 12;
  var gap = opts.gap != null ? Math.max(0, Number(opts.gap)) : 8;
  var renderRow = opts.renderRow;
  var emptyHtml = opts.emptyHtml || '';
  var items = [];
  var virtualizer = null;
  var unsubMount = null;
  var destroyed = false;

  function paint() {
    if (destroyed || !viewport || !virtualizer) return;
    var n = items.length;
    if (!n) {
      viewport.innerHTML = emptyHtml;
      return;
    }
    var vItems = virtualizer.getVirtualItems();
    var total = virtualizer.getTotalSize();
    var html = '';
    for (var i = 0; i < vItems.length; i++) {
      var v = vItems[i];
      var rowHtml = renderRow(items[v.index], v.index);
      // 包一层定位壳，便于 measureElement
      html += '<div class="vl-item" data-index="' + v.index + '" style="'
        + 'position:absolute;top:0;left:0;width:100%;'
        + 'transform:translateY(' + v.start + 'px);'
        + '">' + rowHtml + '</div>';
    }
    viewport.innerHTML =
      '<div class="vl-inner" style="height:' + total + 'px;width:100%;position:relative;">'
      + html
      + '</div>';

    // 测量可见行，修正动态高度
    var nodes = viewport.querySelectorAll('.vl-item[data-index]');
    for (var j = 0; j < nodes.length; j++) {
      virtualizer.measureElement(nodes[j]);
    }
  }

  function ensureVirtualizer() {
    if (virtualizer) return virtualizer;
    virtualizer = new Virtualizer({
      count: items.length,
      getScrollElement: function() { return viewport; },
      estimateSize: function() { return estimate; },
      overscan: overscan,
      gap: gap,
      indexAttribute: 'data-index',
      scrollToFn: elementScroll,
      observeElementRect: observeElementRect,
      observeElementOffset: observeElementOffset,
      measureElement: measureElement,
      onChange: function(_inst, sync) {
        if (sync) paint();
        else requestAnimationFrame(paint);
      },
    });
    unsubMount = virtualizer._didMount();
    virtualizer._willUpdate();
    return virtualizer;
  }

  function setItems(next, opts2) {
    items = Array.isArray(next) ? next : [];
    if (opts2 && opts2.resetScroll) {
      try { viewport.scrollTop = 0; } catch (e) { /* ignore */ }
    }
    if (!items.length) {
      if (virtualizer) {
        virtualizer.setOptions(Object.assign({}, virtualizer.options, { count: 0 }));
        virtualizer._willUpdate();
      }
      viewport.innerHTML = emptyHtml;
      return;
    }
    var vz = ensureVirtualizer();
    vz.setOptions(Object.assign({}, vz.options, { count: items.length }));
    vz._willUpdate();
    paint();
  }

  function refresh() {
    if (!virtualizer) {
      paint();
      return;
    }
    virtualizer.measure();
    virtualizer._willUpdate();
    paint();
  }

  function scrollToIndex(index) {
    var vz = ensureVirtualizer();
    var i = Math.max(0, Math.min(items.length - 1, Number(index) || 0));
    vz.scrollToIndex(i, { align: 'center' });
    paint();
  }

  function mount() {
    destroyed = false;
    if (!viewport) return;
    viewport.classList.add('is-vl');
    ensureVirtualizer();
    paint();
  }

  function destroy() {
    destroyed = true;
    if (typeof unsubMount === 'function') {
      try { unsubMount(); } catch (e) { /* ignore */ }
      unsubMount = null;
    }
    virtualizer = null;
    items = [];
    if (viewport) {
      try { viewport.classList.remove('is-vl'); } catch (e2) { /* ignore */ }
    }
  }

  return {
    mount: mount,
    setItems: setItems,
    refresh: refresh,
    scrollToIndex: scrollToIndex,
    destroy: destroy,
    getItems: function() { return items; },
    getRowHeight: function() { return estimate; },
  };
}

/**
 * 纯函数切片（单测 / 无 DOM）；与 TanStack estimate 语义对齐的简易版
 * @param {{ length: number, rowHeight: number, scrollTop: number, clientHeight: number, overscan?: number, gap?: number }} p
 */
export function computeVirtualRange(p) {
  var n = p.length | 0;
  var rowHeight = Math.max(1, Number(p.rowHeight) || 56);
  var gap = p.gap != null ? Math.max(0, Number(p.gap)) : 0;
  var stride = rowHeight + gap;
  var overscan = p.overscan != null ? Math.max(0, Number(p.overscan)) : 10;
  if (!n) return { start: 0, end: 0, topPad: 0, bottomPad: 0 };
  var st = Math.max(0, Number(p.scrollTop) || 0);
  var vh = Math.max(0, Number(p.clientHeight) || 0);
  var start = Math.max(0, Math.floor(st / stride) - overscan);
  var end = Math.min(n, Math.ceil((st + vh) / stride) + overscan);
  if (end < start) end = start;
  return {
    start: start,
    end: end,
    topPad: start * stride,
    bottomPad: Math.max(0, (n - end) * stride),
  };
}
