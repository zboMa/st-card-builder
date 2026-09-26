/**
 * 全局用户反馈：message toast + notification + 少量 inline 白名单
 * 契约见 docs/ui/design-system.md「操作反馈」
 */
import { escapeHtml } from '../utils.mjs';

/** 允许 appFeedback channel:inline 写入的 DOM id（上下文态，非操作结果） */
export const FEEDBACK_INLINE_IDS = Object.freeze([
  'syncStatusLine',
  'vcStatus',
  'imgComfyDetectHint',
  'aiStatus',
  'imgGenStatus',
  'auditStatus',
  'fetchModelsStatus',
  'rxTestTip',
]);

function pickAutoChannel(opts) {
  var msg = String(opts.message || '').trim();
  var level = opts.level || 'info';
  if (opts.important || level === 'error') return 'notify';
  if (msg.length > 120 || /\n/.test(msg)) return 'notify';
  return 'toast';
}

/** @internal 单测用 */
export function pickAutoChannelForTest(opts) {
  return pickAutoChannel(opts || {});
}

/**
 * @param {object|null} ctx 制卡/小说 ctx（可选，用于 bind showAppMessage）
 * @param {object} opts
 * @param {string} opts.message
 * @param {string} [opts.title]
 * @param {'info'|'success'|'warn'|'error'} [opts.level]
 * @param {'toast'|'notify'|'inline'|'auto'} [opts.channel]
 * @param {string} [opts.inlineId]
 * @param {number} [opts.duration]
 * @param {boolean} [opts.important]
 */
export function appFeedback(ctx, opts) {
  var o = opts || {};
  var message = String(o.message || '').trim();
  if (!message) return;
  var channel = o.channel || 'auto';
  if (channel === 'auto') {
    channel = pickAutoChannel(o);
    // 短 warn 走 toast，避免与 error 一样弹 notification
    if (channel === 'notify' && o.level === 'warn' && !o.important && String(o.message || '').length <= 120) {
      channel = 'toast';
    }
  }
  if (channel === 'inline') {
    var id = o.inlineId;
    if (!id || FEEDBACK_INLINE_IDS.indexOf(id) < 0) channel = pickAutoChannel(o);
  }
  if (channel === 'inline') {
    writeInline(o.inlineId, message, o.level);
    return;
  }
  if (channel === 'notify') {
    var level = o.level === 'error' ? 'error' : (o.level === 'warn' ? 'warn' : 'info');
    var title = o.title;
    if (!title) {
      if (level === 'error') title = '操作未完成';
      else if (level === 'warn') title = '请注意';
      else title = '提示';
    }
    showAppNotification({ title: title, message: message, level: level, duration: o.duration });
    return;
  }
  var toastLevel = o.level === 'error' ? 'error' : (o.level === 'warn' ? 'warn' : undefined);
  var duration = o.duration;
  if (duration == null) {
    if (o.level === 'error') duration = 4200;
    else if (o.level === 'success') duration = 3200;
  }
  var show = ctx && ctx.showAppMessage ? ctx.showAppMessage.bind(ctx) : showAppMessage;
  show(message, { level: toastLevel, duration: duration });
}

/** ok | warn | err → appFeedback */
export function feedbackFromKind(ctx, text, kind, extra) {
  var level = kind === 'err' ? 'error' : (kind === 'warn' ? 'warn' : (kind === 'ok' ? 'success' : 'info'));
  appFeedback(ctx, Object.assign({}, extra || {}, { message: text, level: level }));
}

/** @deprecated 使用 feedbackFromKind */
export function showStatusAsAppMessage(ctx, text, kind) {
  feedbackFromKind(ctx, text, kind);
}

function writeInline(id, text, level) {
  if (typeof document === 'undefined') return;
  var el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.classList.remove('is-warn', 'is-ok', 'is-err', 'is-error');
  if (level === 'warn') el.classList.add('is-warn');
  if (level === 'error') el.classList.add('is-err');
  if (level === 'success') el.classList.add('is-ok');
}

/**
 * 轻量提示（message toast），自动消失
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

/** 重要提示（notification），可手动关闭 */
export function showAppNotification(options) {
  var opts = options || {};
  var title = String(opts.title || '注意');
  var message = String(opts.message || '').trim();
  if (!message || typeof document === 'undefined') return;
  var host = document.getElementById('appNotifyHost');
  if (!host) {
    host = document.createElement('div');
    host.id = 'appNotifyHost';
    host.className = 'app-notify-host';
    host.setAttribute('aria-live', 'assertive');
    document.body.appendChild(host);
  }
  var level = opts.level === 'error' ? 'error' : (opts.level === 'warn' ? 'warn' : 'info');
  var card = document.createElement('div');
  card.className = 'app-notify app-notify--' + level;
  card.setAttribute('role', 'alert');
  card.innerHTML =
    '<div class="app-notify__body">' +
      '<div class="app-notify__title">' + escapeHtml(title) + '</div>' +
      '<div class="app-notify__message">' + escapeHtml(message) + '</div>' +
    '</div>' +
    '<button type="button" class="app-notify__close" aria-label="关闭">×</button>';
  host.appendChild(card);
  var closed = false;
  function close() {
    if (closed) return;
    closed = true;
    card.classList.add('is-leaving');
    setTimeout(function() { card.remove(); }, 220);
  }
  card.querySelector('.app-notify__close').addEventListener('click', close);
  var ms = opts.duration != null ? opts.duration : 8000;
  if (ms > 0) setTimeout(close, ms);
}

/** AI 任务中心 run() 开始时：notify + 任务列表 */
export function notifyAiTaskStarted(task) {
  if (!task || typeof document === 'undefined') return;
  var parts = [];
  if (task.title) parts.push(String(task.title));
  if (task.target) parts.push(String(task.target));
  var line = parts.join(' · ');
  var msg = (line ? line + '。' : '') + '可在任务中心查看进度或取消。';
  showAppNotification({
    title: '任务已开始',
    message: msg || (task.typeLabel || 'AI 任务'),
    level: 'info',
    duration: 6500,
  });
}

export function inferStatusLevel(msg) {
  var s = String(msg || '');
  if (/失败|错误|不能|无效|禁止|熔断/.test(s)) return 'error';
  if (/警告|未生效|请先|取消|跳过/.test(s)) return 'warn';
  return '';
}
