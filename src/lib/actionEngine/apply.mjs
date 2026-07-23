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
  if (view.reason) el.setAttribute('title', view.reason);
  else if (!disable) el.removeAttribute('title');

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
 * @param {string} tipId
 * @param {string} msg
 */
export function applyTip(tipId, msg) {
  if (typeof document === 'undefined' || !tipId) return;
  var el = document.getElementById(tipId);
  if (el) el.textContent = msg || '';
}

/**
 * @param {string} gateId
 * @param {boolean} show
 * @param {string} text
 */
export function applyGateBanner(gateId, show, text) {
  if (typeof document === 'undefined' || !gateId) return;
  var el = document.getElementById(gateId);
  if (!el) return;
  if (show) {
    el.style.display = 'block';
    if (text) el.textContent = text;
  } else {
    el.style.display = 'none';
  }
}

/**
 * 小说工坊门控条
 * @param {{ hasSource?: boolean, canExtract?: boolean, reasons?: string[] }} gates
 */
export function applyNovelGateBanners(gates) {
  var g = gates || {};
  var chapterGate = 'novelChapterGate';
  var others = [
    'novelSetupGate', 'novelGreetGate', 'novelCharGate',
    'novelWbGate', 'novelStyleGate', 'novelAnalyzeGate',
  ];
  applyGateBanner(
    chapterGate,
    !g.hasSource,
    (g.reasons && g.reasons[0]) || '请先导入原始资料'
  );
  others.forEach(function(id) {
    applyGateBanner(
      id,
      !g.canExtract,
      (g.reasons && g.reasons.join('；')) || '请先完成原始资料与拆章'
    );
  });
}
