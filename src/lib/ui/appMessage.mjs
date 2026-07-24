/**
 * 全局轻量提示（message toast）
 */
export function showAppMessage(message, options) {
  var opts = options || {};
  var text = String(message || '').trim();
  if (!text || typeof document === 'undefined') return;
  var host = document.getElementById('appToastHost');
  if (!host) {
    host = document.createElement('div');
    host.id = 'appToastHost';
    host.className = 'app-toast-host';
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  var toast = document.createElement('div');
  toast.className = 'app-toast'
    + (opts.level === 'error' ? ' is-error' : (opts.level === 'warn' ? ' is-warn' : ''));
  toast.textContent = text;
  host.appendChild(toast);
  var ms = opts.duration != null ? opts.duration : 2600;
  setTimeout(function() {
    toast.classList.add('is-leaving');
    setTimeout(function() { toast.remove(); }, 220);
  }, ms);
}

export function inferStatusLevel(msg) {
  var s = String(msg || '');
  if (/失败|错误|不能|无效|禁止|熔断/.test(s)) return 'error';
  if (/警告|未生效|请先|取消|跳过/.test(s)) return 'warn';
  return '';
}
