/**
 * 全站自定义确认弹窗（.app-confirm-*），禁止用原生 window.confirm。
 * @returns {Promise<boolean|{confirmed:boolean,checks:Object}>}
 */
import { escapeHtml } from '../utils.mjs';

export function showConfirmDialog(options) {
  var opts = options || {};
  var previousActiveElement = document.activeElement;
  var checks = Array.isArray(opts.checks) ? opts.checks : [];
  return new Promise(function(resolve) {
    var checksHtml = '';
    if (checks.length) {
      checksHtml = '<div class="app-confirm-checks">' + checks.map(function(c) {
        var id = String(c.id || '');
        var label = escapeHtml(c.label || id);
        var checked = c.checked ? ' checked' : '';
        return '<label class="app-confirm-check">'
          + '<input type="checkbox" data-confirm-check="' + escapeHtml(id) + '"' + checked + ' />'
          + '<span>' + label + '</span>'
          + '</label>';
      }).join('') + '</div>';
    }
    var okClass = opts.danger === false ? ' primary' : ' danger';
    var overlay = document.createElement('div');
    overlay.className = 'app-confirm-overlay';
    overlay.setAttribute('role', 'presentation');
    overlay.setAttribute('tabindex', '-1');
    overlay.innerHTML =
      '<div class="app-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="appConfirmTitle" tabindex="-1">' +
        '<div class="app-confirm-head">' +
          '<div class="app-confirm-icon">' + escapeHtml(opts.icon || '⚠️') + '</div>' +
          '<div>' +
            '<h3 id="appConfirmTitle" class="app-confirm-title">' + escapeHtml(opts.title || '确认操作') + '</h3>' +
            '<p class="app-confirm-message">' + escapeHtml(opts.message || '这个操作需要确认。') + '</p>' +
          '</div>' +
        '</div>' +
        (opts.detail ? '<div class="app-confirm-body">' + escapeHtml(opts.detail) + '</div>' : '') +
        checksHtml +
        '<div class="app-confirm-actions">' +
          '<button type="button" class="app-confirm-btn" data-confirm="cancel">' + escapeHtml(opts.cancelText || '取消') + '</button>' +
          '<button type="button" class="app-confirm-btn' + okClass + '" data-confirm="ok">' + escapeHtml(opts.okText || '确认') + '</button>' +
        '</div>' +
      '</div>';

    var focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    function trapFocus(dialogEl) {
      dialogEl.addEventListener('keydown', function(e) {
        if (e.key !== 'Tab') return;
        var focusable = dialogEl.querySelectorAll(focusableSelector);
        if (focusable.length === 0) return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      });
    }

    function restoreFocus() {
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        try { previousActiveElement.focus(); } catch (_) {}
      }
    }

    function collectChecks() {
      var out = {};
      checks.forEach(function(c) {
        var el = overlay.querySelector('[data-confirm-check="' + String(c.id || '') + '"]');
        out[c.id] = !!(el && el.checked);
      });
      return out;
    }

    function close(value) {
      document.removeEventListener('keydown', onKeydown);
      overlay.remove();
      restoreFocus();
      resolve(value);
    }

    function confirmOk() {
      if (checks.length) {
        close({ confirmed: true, checks: collectChecks() });
      } else {
        close(true);
      }
    }

    function onKeydown(event) {
      if (event.key === 'Escape') { close(false); return; }
      if (event.key === 'Enter') {
        var tag = event.target && event.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        confirmOk();
      }
    }

    overlay.addEventListener('click', function(event) {
      if (event.target === overlay) close(false);
    });
    overlay.querySelector('[data-confirm="cancel"]').addEventListener('click', function() { close(false); });
    overlay.querySelector('[data-confirm="ok"]').addEventListener('click', function() { confirmOk(); });
    document.addEventListener('keydown', onKeydown);
    document.body.appendChild(overlay);
    var dialogEl = overlay.querySelector('.app-confirm-dialog');
    trapFocus(dialogEl);
    overlay.querySelector('[data-confirm="cancel"]').focus();
  });
}
