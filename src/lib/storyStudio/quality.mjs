/**
 * 软质检：启发式俗套/AI 味扫描 + AI 质检结果解析
 */

var CLICHE_PATTERNS = [
  { id: 'eyes_light', re: /眼中闪过一丝|眸中闪过|眼底闪过/g, label: '眼神闪过一丝…' },
  { id: 'not_know', re: /不知为何|莫名地|下意识地/g, label: '莫名/下意识' },
  { id: 'heartbeat', re: /心跳漏了一拍|心头一紧|心头一震/g, label: '心跳套话' },
  { id: 'air_freeze', re: /空气仿佛凝固|气氛陡然/g, label: '气氛凝固' },
  { id: 'smile_curve', re: /嘴角微微上扬|勾起一抹/g, label: '嘴角微扬' },
  { id: 'deep_breath', re: /深吸一口气|缓缓吐出一口气/g, label: '深吸一口气' },
  { id: 'ai_meta', re: /作为AI|作为人工智能|我无法|抱歉，我/g, label: 'AI 元话语' },
  { id: 'summary_tone', re: /总而言之|综上所述|值得一提的是/g, label: '总结腔' },
];

/**
 * @param {string} content
 * @returns {{ score: number, hits: { id: string, label: string, count: number }[], ok: boolean }}
 */
export function scanClicheHeuristics(content) {
  var text = String(content || '');
  var hits = [];
  var total = 0;
  CLICHE_PATTERNS.forEach(function(p) {
    var m = text.match(p.re);
    var count = m ? m.length : 0;
    if (count > 0) {
      hits.push({ id: p.id, label: p.label, count: count });
      total += count;
    }
  });
  // 0～10，命中越多分越低
  var score = Math.max(0, Math.min(10, 10 - total));
  return {
    score: score,
    hits: hits,
    ok: score >= 6 && total < 5,
    hitCount: total,
  };
}

/**
 * @param {string} text
 * @returns {{ ok: boolean, score: number, issues: string[], rewriteHint: string }}
 */
export function parseQualityAiText(text) {
  var raw = String(text || '').trim();
  var fallback = { ok: true, score: 7, issues: [], rewriteHint: '' };
  if (!raw) return fallback;
  var jsonStr = raw;
  var fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) jsonStr = fence[1].trim();
  var start = jsonStr.indexOf('{');
  var end = jsonStr.lastIndexOf('}');
  if (start >= 0 && end > start) jsonStr = jsonStr.slice(start, end + 1);
  try {
    var obj = JSON.parse(jsonStr);
    if (!obj || typeof obj !== 'object') return fallback;
    var issues = obj.issues || obj.problems || [];
    if (!Array.isArray(issues)) issues = [String(issues)];
    var score = Number(obj.score != null ? obj.score : 7);
    if (!Number.isFinite(score)) score = 7;
    score = Math.max(0, Math.min(10, Math.round(score)));
    var ok = obj.ok != null ? !!obj.ok : score >= 6;
    return {
      ok: ok,
      score: score,
      issues: issues.map(function(x) { return String(x).trim(); }).filter(Boolean).slice(0, 8),
      rewriteHint: String(obj.rewriteHint || obj.hint || obj.fix || '').trim(),
    };
  } catch (e) {
    return fallback;
  }
}

/**
 * 合并启发式与 AI 结果
 */
export function mergeQualityResult(heuristic, ai) {
  var h = heuristic || scanClicheHeuristics('');
  var a = ai || { ok: true, score: 7, issues: [], rewriteHint: '' };
  var issues = (a.issues || []).slice();
  (h.hits || []).forEach(function(hit) {
    issues.push('俗套「' + hit.label + '」×' + hit.count);
  });
  var score = Math.round(((h.score || 0) + (a.score || 0)) / 2);
  var ok = score >= 6 && (a.ok !== false) && (h.hitCount || 0) < 6;
  return {
    ok: ok,
    score: score,
    issues: issues.slice(0, 10),
    rewriteHint: a.rewriteHint || (ok ? '' : '减少套话，增强具体动作与对白差异。'),
    heuristic: h,
    ai: a,
    updatedAt: Date.now(),
  };
}

export function buildQualityUserPrompt(vars) {
  var v = vars || {};
  var parts = [];
  parts.push('【章节标题】' + (v.chapterTitle || ''));
  parts.push('【正文】\n' + String(v.content || '').slice(0, 5000));
  parts.push('请评审：是否空洞、重复套话、AI 味、节奏塌陷、人设漂移。');
  parts.push('输出 JSON：{ "ok":true/false, "score":0～10, "issues":["问题"], "rewriteHint":"定向改写提示" }');
  return parts.join('\n');
}

export function buildRewriteUserPrompt(vars) {
  var v = vars || {};
  var parts = [];
  parts.push('【章节标题】' + (v.chapterTitle || ''));
  if (v.rewriteHint) parts.push('【改写要求】' + v.rewriteHint);
  if (v.issues && v.issues.length) parts.push('【需修正】\n- ' + v.issues.join('\n- '));
  parts.push('【原文】\n' + String(v.content || '').slice(0, 7000));
  parts.push('请按要求改写全文，只输出正文。');
  return parts.join('\n');
}

/** 张力曲线：按章节 order 取 tension */
export function tensionCurveFromChapters(chapters) {
  return (Array.isArray(chapters) ? chapters : []).map(function(c, i) {
    var ff = c && c.feedForward;
    var t = ff && typeof ff.tension === 'number' ? ff.tension : null;
    return {
      order: typeof c.order === 'number' ? c.order : i,
      title: (c && c.title) || '',
      tension: t,
      hasContent: !!(c && String(c.content || '').trim()),
    };
  });
}
