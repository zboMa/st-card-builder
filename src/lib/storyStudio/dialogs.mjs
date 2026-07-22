/**
 * Story Studio 自定义弹窗（复用全站 .app-confirm-* / toast / notify 样式）
 */
import { escapeHtml } from '../utils.mjs';

function ensureHost(id, className, live) {
  var host = document.getElementById(id);
  if (host) return host;
  host = document.createElement('div');
  host.id = id;
  host.className = className;
  if (live) host.setAttribute('aria-live', live);
  document.body.appendChild(host);
  return host;
}

export function showSsConfirm(options) {
  var opts = options || {};
  var previousActiveElement = document.activeElement;
  return new Promise(function(resolve) {
    var overlay = document.createElement('div');
    overlay.className = 'app-confirm-overlay';
    overlay.setAttribute('role', 'presentation');
    overlay.innerHTML =
      '<div class="app-confirm-dialog" role="dialog" aria-modal="true" tabindex="-1">'
      + '<div class="app-confirm-head">'
      + '<div class="app-confirm-icon">' + escapeHtml(opts.icon || '⚠️') + '</div>'
      + '<div>'
      + '<h3 class="app-confirm-title">' + escapeHtml(opts.title || '确认') + '</h3>'
      + '<p class="app-confirm-message">' + escapeHtml(opts.message || '') + '</p>'
      + '</div></div>'
      + (opts.detail ? '<div class="app-confirm-body">' + escapeHtml(opts.detail) + '</div>' : '')
      + '<div class="app-confirm-actions">'
      + '<button type="button" class="app-confirm-btn" data-ss-dlg="cancel">'
      + escapeHtml(opts.cancelText || '取消') + '</button>'
      + '<button type="button" class="app-confirm-btn'
      + (opts.danger ? ' danger' : ' primary') + '" data-ss-dlg="ok">'
      + escapeHtml(opts.okText || '确定') + '</button>'
      + '</div></div>';

    function close(val) {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      try {
        if (previousActiveElement && previousActiveElement.focus) previousActiveElement.focus();
      } catch (e) { /* ignore */ }
      resolve(val);
    }
    function onKey(e) {
      if (e.key === 'Escape') close(false);
      else if (e.key === 'Enter') {
        var tag = e.target && e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        close(true);
      }
    }
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) close(false);
    });
    overlay.querySelector('[data-ss-dlg="cancel"]').addEventListener('click', function() { close(false); });
    overlay.querySelector('[data-ss-dlg="ok"]').addEventListener('click', function() { close(true); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    overlay.querySelector('[data-ss-dlg="cancel"]').focus();
  });
}

/** @returns {Promise<string|null>} */
export function showSsPrompt(options) {
  var opts = options || {};
  var previousActiveElement = document.activeElement;
  return new Promise(function(resolve) {
    var multiline = !!opts.multiline;
    var field = multiline
      ? '<textarea class="app-prompt-input" id="ssDlgInput" rows="'
        + (opts.rows || 4) + '" placeholder="' + escapeHtml(opts.placeholder || '') + '">'
        + escapeHtml(opts.defaultValue != null ? String(opts.defaultValue) : '')
        + '</textarea>'
      : '<input type="text" class="app-prompt-input" id="ssDlgInput" value="'
        + escapeHtml(opts.defaultValue != null ? String(opts.defaultValue) : '')
        + '" placeholder="' + escapeHtml(opts.placeholder || '') + '" autocomplete="off" />';

    var overlay = document.createElement('div');
    overlay.className = 'app-confirm-overlay';
    overlay.setAttribute('role', 'presentation');
    overlay.innerHTML =
      '<div class="app-confirm-dialog app-prompt-dialog" role="dialog" aria-modal="true" tabindex="-1">'
      + '<div class="app-confirm-head">'
      + '<div class="app-confirm-icon">' + escapeHtml(opts.icon || '✏️') + '</div>'
      + '<div>'
      + '<h3 class="app-confirm-title">' + escapeHtml(opts.title || '输入') + '</h3>'
      + '<p class="app-confirm-message">' + escapeHtml(opts.message || '') + '</p>'
      + '</div></div>'
      + '<div class="app-prompt-field-wrap">' + field + '</div>'
      + '<div class="app-confirm-actions">'
      + '<button type="button" class="app-confirm-btn" data-ss-dlg="cancel">'
      + escapeHtml(opts.cancelText || '取消') + '</button>'
      + '<button type="button" class="app-confirm-btn primary" data-ss-dlg="ok">'
      + escapeHtml(opts.okText || '确定') + '</button>'
      + '</div></div>';

    function close(val) {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      try {
        if (previousActiveElement && previousActiveElement.focus) previousActiveElement.focus();
      } catch (e) { /* ignore */ }
      resolve(val);
    }
    function confirmOk() {
      var input = overlay.querySelector('#ssDlgInput');
      close(input ? String(input.value) : '');
    }
    function onKey(e) {
      if (e.key === 'Escape') close(null);
      else if (e.key === 'Enter' && !multiline) {
        e.preventDefault();
        confirmOk();
      }
    }
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) close(null);
    });
    overlay.querySelector('[data-ss-dlg="cancel"]').addEventListener('click', function() { close(null); });
    overlay.querySelector('[data-ss-dlg="ok"]').addEventListener('click', confirmOk);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    var input = overlay.querySelector('#ssDlgInput');
    if (input) {
      input.focus();
      if (!multiline && opts.select !== false) {
        try { input.select(); } catch (e) { /* ignore */ }
      }
    }
  });
}

/** 通用内容弹窗（只读 HTML 或自定义 body） */
export function showSsModal(options) {
  var opts = options || {};
  return new Promise(function(resolve) {
    var overlay = document.createElement('div');
    overlay.className = 'app-confirm-overlay ss-modal-overlay';
    overlay.innerHTML =
      '<div class="app-confirm-dialog ss-modal-dialog" role="dialog" aria-modal="true" tabindex="-1">'
      + '<div class="ss-modal-head">'
      + '<h3 class="app-confirm-title">' + escapeHtml(opts.title || '') + '</h3>'
      + '<button type="button" class="btn-icon btn-icon--sm" data-ss-dlg="close" aria-label="关闭">×</button>'
      + '</div>'
      + '<div class="ss-modal-body">' + (opts.bodyHtml || '') + '</div>'
      + (opts.footerHtml ? ('<div class="app-confirm-actions">' + opts.footerHtml + '</div>') : '')
      + '</div>';
    function close() {
      overlay.remove();
      resolve();
    }
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) close();
      if (e.target.closest('[data-ss-dlg="close"]')) close();
    });
    document.body.appendChild(overlay);
    if (typeof opts.onMount === 'function') opts.onMount(overlay, close);
  });
}

export function showSsMessage(message, options) {
  var opts = options || {};
  var text = String(message || '').trim();
  if (!text) return;
  var host = ensureHost('appToastHost', 'app-toast-host', 'polite');
  var toast = document.createElement('div');
  toast.className = 'app-toast' + (opts.level === 'error' ? ' is-error' : (opts.level === 'warn' ? ' is-warn' : ''));
  toast.textContent = text;
  host.appendChild(toast);
  var ms = opts.duration != null ? opts.duration : 2600;
  setTimeout(function() {
    toast.classList.add('is-leaving');
    setTimeout(function() { toast.remove(); }, 220);
  }, ms);
}
