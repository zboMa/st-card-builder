/**
 * 长文本只读预览弹窗（开场白 / 提示词配置等共用）
 * 复用 ui-patterns 的 panel-feature-modal；首次调用时挂到 document.body。
 */

var MODAL_ID = 'stTextPreviewModal';

/** 四角折线「展开预览」图标（Lucide Maximize 语义） */
export var TEXT_PREVIEW_EXPAND_ICON =
  '<svg class="icon-expand-corners" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="M8 3H5a2 2 0 0 0-2 2v3"/>'
  + '<path d="M21 8V5a2 2 0 0 0-2-2h-3"/>'
  + '<path d="M3 16v3a2 2 0 0 0 2 2h3"/>'
  + '<path d="M16 21h3a2 2 0 0 0 2-2v-3"/>'
  + '</svg>';

function ensureModal() {
  var existing = document.getElementById(MODAL_ID);
  if (existing) return existing;

  var root = document.createElement('div');
  root.id = MODAL_ID;
  root.className = 'panel-feature-modal text-preview-modal';
  root.hidden = true;
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML =
    '<div class="ui-modal-backdrop" data-text-preview-close aria-hidden="true"></div>'
    + '<div class="ui-modal-dialog panel-feature-modal__dialog panel-feature-modal__dialog--wide" role="dialog" aria-modal="true" aria-labelledby="textPreviewModalTitle" tabindex="-1">'
    + '<div class="panel-feature-modal__head">'
    + '<h2 id="textPreviewModalTitle">预览</h2>'
    + '<button type="button" class="btn-icon btn-icon--sm" data-text-preview-close aria-label="关闭">×</button>'
    + '</div>'
    + '<div class="panel-feature-modal__body text-preview-modal__body-wrap">'
    + '<pre id="textPreviewModalBody" class="text-preview-modal__body"></pre>'
    + '</div>'
    + '</div>';
  document.body.appendChild(root);

  function close() {
    root.hidden = true;
    root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('panel-feature-modal-open');
  }

  root.querySelectorAll('[data-text-preview-close]').forEach(function(el) {
    el.addEventListener('click', close);
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && !root.hidden) close();
  });

  return root;
}

/**
 * @param {{ title?: string, text?: string }} opts
 */
export function openTextPreview(opts) {
  opts = opts || {};
  var root = ensureModal();
  var titleEl = root.querySelector('#textPreviewModalTitle');
  var bodyEl = root.querySelector('#textPreviewModalBody');
  var dialog = root.querySelector('.panel-feature-modal__dialog');
  if (titleEl) titleEl.textContent = opts.title || '预览';
  if (bodyEl) {
    var text = String(opts.text == null ? '' : opts.text);
    bodyEl.textContent = text.trim() ? text : '（空）';
  }
  root.hidden = false;
  root.setAttribute('aria-hidden', 'false');
  document.body.classList.add('panel-feature-modal-open');
  if (dialog && typeof dialog.focus === 'function') {
    try { dialog.focus(); } catch (e) { /* ignore */ }
  }
}

/** 供 inline script 场景挂到 window */
export function installTextPreviewGlobal() {
  if (typeof window === 'undefined') return;
  window.__openTextPreview__ = openTextPreview;
}
