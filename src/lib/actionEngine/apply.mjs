/**
 * 将 viewState 应用到 DOM
 */

/**
 * @param {HTMLElement} el
 * @param {import('./types.mjs').ActionViewState} view
 * @param {{ idleLabel?: string }} [meta]
 */
export function applyViewToEl(el, view, meta) {
  if (!el || !view) return;
  var m = meta || {};
  var disable = view.enabled === false;
  if ('disabled' in el) {
    el.disabled = disable;
  }
  el.setAttribute('aria-disabled', disable ? 'true' : 'false');
  if (!disable) el.removeAttribute('title');

  if (view.visible === false) {
    el.hidden = true;
    el.style.display = 'none';
  }

  if (view.label != null && view.label !== '') {
    if (el.dataset.idleLabel == null) {
      el.dataset.idleLabel = m.idleLabel != null ? m.idleLabel : (el.textContent || '');
    }
    el.textContent = view.label;
  } else if (el.dataset.idleLabel != null && view.enabled !== false) {
    el.textContent = el.dataset.idleLabel;
    delete el.dataset.idleLabel;
  }
}

/**
 * 小说工坊门控条（已弃用：前置条件改在点击时检测，进页不展示横幅）
 */
export function applyNovelGateBanners() {
  /* intentional no-op */
}
