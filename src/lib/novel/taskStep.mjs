/** 把一步的摘要、输入、输出写进当前任务。无任务中心时静默跳过。 */
export function noteTaskStep(task, step) {
  var center = typeof window !== 'undefined' ? window.__aiTaskCenter__ : null;
  if (!center || !task || !task.id || typeof center.appendStep !== 'function') return false;
  return center.appendStep(task.id, step);
}
