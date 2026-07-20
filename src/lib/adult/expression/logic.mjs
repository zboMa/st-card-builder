/**
 * 表达层：姿势语言 + 情趣话风（多选、不占口味槽）
 * 边界：禁止儿童性化；其余成人合意写法由条目自身写清。
 */

/** 表达层字数：约为口味/世界观硬线的一半（条目更短、更可点选） */
export var EXPRESSION_DESC_MIN = 150;
export var EXPRESSION_DESC_MAX = 225;
export var EXPRESSION_GUIDE_MIN = 175;
export var EXPRESSION_GUIDE_MAX = 250;
export var EXPRESSION_SUMMARY_MIN = 12;
export var EXPRESSION_SUMMARY_MAX = 28;

export function normalizeExpressionItems(raw) {
  if (!Array.isArray(raw)) return [];
  var out = [];
  var seen = Object.create(null);
  raw.forEach(function(it) {
    var id = String((it && it.id) || '').trim();
    if (!id || seen[id]) return;
    seen[id] = true;
    out.push({ id: id, note: String((it && it.note) || '').trim() });
  });
  return out;
}

export function getPreset(map, id) {
  if (!map || !id) return null;
  return map[id] || null;
}

/**
 * @param {Array<{id:string,note?:string}>} items
 * @param {Record<string, object>} presets
 * @param {{ kind: 'posture'|'speech', intro?: string }} opts
 */
export function buildExpressionHintFromItems(items, presets, opts) {
  opts = opts || {};
  var list = normalizeExpressionItems(items);
  if (!list.length || !presets) return '';
  var kindLabel = opts.kind === 'speech' ? '情趣话风' : '姿势语言';
  var lines = [];
  lines.push('\n【表达层·' + kindLabel + '】（与口味叠加；不替代 Limits / 安全词）');
  if (opts.intro) lines.push(String(opts.intro));
  list.forEach(function(it, idx) {
    var p = presets[it.id];
    var lab = (p && p.label) || it.id;
    var sm = (p && p.summary) || '';
    lines.push((idx + 1) + '. ' + lab + (sm ? ' — ' + sm : ''));
    if (p && p.description) lines.push('   质地：' + String(p.description).slice(0, 220) + (p.description.length > 220 ? '…' : ''));
    if (p && p.writingGuide) lines.push('   写法：' + String(p.writingGuide).slice(0, 260) + (p.writingGuide.length > 260 ? '…' : ''));
    if (it.note) lines.push('   用户补充：' + it.note);
  });
  lines.push('禁止儿童性化；表达层只改「怎么做 / 怎么说」，不取消叫停与否决。');
  return lines.join('\n');
}

export function checkExpressionEntryQuality(p) {
  var issues = [];
  if (!p || typeof p !== 'object') return ['条目为空'];
  var desc = String(p.description || '');
  var guide = String(p.writingGuide || '');
  var summary = String(p.summary || '');
  if (desc.length < EXPRESSION_DESC_MIN || desc.length > EXPRESSION_DESC_MAX) {
    issues.push('description 字数 ' + desc.length + ' 不在 ' + EXPRESSION_DESC_MIN + '-' + EXPRESSION_DESC_MAX);
  }
  if (guide.length < EXPRESSION_GUIDE_MIN || guide.length > EXPRESSION_GUIDE_MAX) {
    issues.push('writingGuide 字数 ' + guide.length + ' 不在 ' + EXPRESSION_GUIDE_MIN + '-' + EXPRESSION_GUIDE_MAX);
  }
  if (summary && (summary.length < EXPRESSION_SUMMARY_MIN || summary.length > EXPRESSION_SUMMARY_MAX)) {
    issues.push('summary 字数 ' + summary.length + ' 不在 ' + EXPRESSION_SUMMARY_MIN + '-' + EXPRESSION_SUMMARY_MAX);
  }
  var ap = p.antiPatterns;
  if (!Array.isArray(ap) || ap.length < 4 || ap.length > 6) {
    issues.push('antiPatterns 条数应 4-6');
  }
  return issues;
}
