/**
 * AI 任务队列 UI（助手标题旁）
 */

export function formatAiTaskCenterLine() {
  var center = typeof window !== 'undefined' ? window.__aiTaskCenter__ : null;
  if (!center || typeof center.snapshot !== 'function') return '';
  var snap = center.snapshot();
  var list = (snap && snap.tasks) || [];
  var running = 0;
  var queued = 0;
  list.forEach(function(t) {
    if (!t) return;
    if (t.status === 'running') running++;
    if (t.status === 'queued') queued++;
  });
  if (!running && !queued) return '';
  if (running && queued) return 'AI 任务：运行 ' + running + ' · 排队 ' + queued;
  if (running) return 'AI 任务：运行 ' + running;
  return 'AI 任务：排队 ' + queued;
}

export function mountAiTaskCenterBadge(subEl) {
  if (!subEl) return function() {};
  function refresh() {
    var line = formatAiTaskCenterLine();
    if (!line) {
      subEl.textContent = subEl.getAttribute('data-default-sub') || subEl.textContent;
      return;
    }
    if (!subEl.getAttribute('data-default-sub')) {
      subEl.setAttribute('data-default-sub', subEl.textContent || '');
    }
    subEl.textContent = line;
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('ai-task-center-changed', refresh);
  }
  refresh();
  return refresh;
}
