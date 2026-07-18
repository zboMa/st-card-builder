/**
 * 角色卡 tags 工具：对齐 ST chara_card_v3 的 tags / data.tags
 */

/** 标签 AI 生成时上下文默认字数上限（约 12k） */
export const DEFAULT_TAG_CONTEXT_CHARS = 12000;

/** 规范化标签：trim、去空、保序去重 */
export function normalizeCharTags(input) {
  var list = Array.isArray(input) ? input : [];
  var seen = Object.create(null);
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var t = String(list[i] == null ? '' : list[i]).trim();
    if (!t || seen[t]) continue;
    seen[t] = true;
    out.push(t);
  }
  return out;
}

/** 合并标签：保留已有，追加新标签并去重 */
export function mergeCharTags(existing, incoming) {
  return normalizeCharTags([].concat(existing || [], incoming || []));
}

/** 从导入 JSON 读取标签（优先 data.tags，其次顶层 tags） */
export function tagsFromCardJson(json) {
  if (!json || typeof json !== 'object') return [];
  if (json.data && Array.isArray(json.data.tags)) return normalizeCharTags(json.data.tags);
  if (Array.isArray(json.tags)) return normalizeCharTags(json.tags);
  return [];
}

/** 钳制标签生成上下文字数（过小回退默认，过大封顶） */
export function clampTagContextChars(n) {
  var v = parseInt(n, 10);
  if (isNaN(v) || v < 1000) return DEFAULT_TAG_CONTEXT_CHARS;
  if (v > 200000) return 200000;
  return v;
}

/**
 * 组装标签 AI 上下文：角色设定 + 开场白 + 世界书（按字数上限截断）
 * @param {{ description?: string, firstMes?: string, altGreetings?: string[], worldbookEntries?: { comment?: string, content?: string }[] }} input
 * @param {number} [maxChars]
 */
export function buildTagGenContext(input, maxChars) {
  var src = input || {};
  // 显式上限优先；非法则回退默认（配置钳制见 clampTagContextChars）
  var limit = parseInt(maxChars, 10);
  if (isNaN(limit) || limit < 1) limit = DEFAULT_TAG_CONTEXT_CHARS;
  if (limit > 200000) limit = 200000;
  var sections = [];
  var desc = String(src.description || '').trim();
  var first = String(src.firstMes || '').trim();
  var alts = Array.isArray(src.altGreetings) ? src.altGreetings : [];
  var altText = alts.map(function(s) { return String(s || '').trim(); }).filter(Boolean).join('\n---\n');

  if (desc) sections.push('【角色设定】\n' + desc);
  if (first) sections.push('【开场白】\n' + first);
  if (altText) sections.push('【备选开场】\n' + altText);

  var head = sections.join('\n\n');
  var budget = Math.max(0, limit - (head ? head.length + 2 : 0) - 20);
  var wbParts = [];
  var used = 0;
  var entries = Array.isArray(src.worldbookEntries) ? src.worldbookEntries : [];

  for (var i = 0; i < entries.length; i++) {
    if (budget <= 0) break;
    var e = entries[i] || {};
    var block = '[标题:' + String(e.comment || '') + ']\n' + String(e.content || '');
    if (used + block.length > budget) {
      var remain = budget - used;
      if (remain > 40) wbParts.push(block.slice(0, remain) + '…');
      break;
    }
    wbParts.push(block);
    used += block.length + 2;
  }

  if (wbParts.length) {
    head = (head ? head + '\n\n' : '') + '【世界书（截断）】\n' + wbParts.join('\n\n');
  }
  if (head.length > limit) return head.slice(0, limit);
  return head;
}

/** 解析 AI 返回的标签列表（JSON 数组 / {tags} / 逗号分行兜底） */
export function parseTagsFromAiText(text) {
  var raw = String(text == null ? '' : text).trim();
  if (!raw) return [];

  function fromParsed(v) {
    if (Array.isArray(v)) return normalizeCharTags(v);
    if (v && typeof v === 'object' && Array.isArray(v.tags)) return normalizeCharTags(v.tags);
    return null;
  }

  try {
    var direct = fromParsed(JSON.parse(raw));
    if (direct) return direct;
  } catch (e) { /* 非纯 JSON */ }

  var m = raw.match(/\[[\s\S]*\]/);
  if (m) {
    try {
      var arr = fromParsed(JSON.parse(m[0]));
      if (arr) return arr;
    } catch (e2) { /* 截取失败 */ }
  }

  var objMatch = raw.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      var obj = fromParsed(JSON.parse(objMatch[0]));
      if (obj) return obj;
    } catch (e3) { /* ignore */ }
  }

  return normalizeCharTags(raw.split(/[\n,，、|;；]/));
}
