/**
 * 小号 select：复用 chromeBoot.enhanceSelect（大 select 同款）并把增强后的 wrap 标记为小号变体。
 * 时序处理：
 * - 若 select 已被 chromeBoot 增强（带 cs-hidden）→ 直接打 cs-mini 标记
 * - 若 chromeBoot 尚未就绪 → 轮询等待后增强或打标
 * 增强后原 select 保留（值/change 语义不变），cs 组件自动跟随 options 变化。
 */

function markMini(sel, extraClass) {
  var w = sel.parentNode;
  if (!w || !w.classList || !w.classList.contains('cs-wrap')) return;
  w.classList.add('cs-mini');
  if (extraClass) w.classList.add(extraClass);
  // 下拉面板 portal 到 body 后脱离 wrap，用独立标记保持小号样式
  var dd = w.querySelector('.cs-dropdown');
  if (dd) dd.classList.add('cs-mini-dd');
}

/**
 * @param {HTMLSelectElement} sel
 * @param {string} [extraClass] 附加宽度类：cs-w148（弹窗分组） / cs-fill（弹窗条目）
 */
export function enhanceSelectMini(sel, extraClass) {
  if (!sel || typeof window === 'undefined' || sel._csMiniApplied) return;

  if (sel.classList.contains('cs-hidden')) {
    markMini(sel, extraClass);
    sel._csMiniApplied = true;
    return;
  }

  if (typeof window.__enhanceSelect__ !== 'function') {
    // chromeBoot 未就绪：轮询重试（最多 ~10s），避免 readyState 判断漏掉
    var tries = sel._csMiniTries || 0;
    if (tries >= 100) return;
    sel._csMiniTries = tries + 1;
    setTimeout(function() { enhanceSelectMini(sel, extraClass); }, 100);
    return;
  }

  window.__enhanceSelect__(sel);
  markMini(sel, extraClass);
  sel._csMiniApplied = true;
}

/** 程序化设置 select.value 后同步增强层 label（cs 组件不监听纯 value 赋值） */
export function syncEnhancedSelectLabel(sel) {
  if (!sel || typeof window === 'undefined') return;
  var w = sel.parentNode;
  if (!w || !w.classList || !w.classList.contains('cs-wrap')) return;
  var lbl = w.querySelector('.cs-label');
  if (lbl) {
    lbl.textContent = sel.options[sel.selectedIndex]
      ? sel.options[sel.selectedIndex].text
      : (sel.value || '');
  }
}
