/**
 * 成人 Canon 联动块：已生成人物/NTL/世界书/恶堕/文风 → 生成时对齐
 * 预算默认 40k，硬顶 50k（见 contextBudgets.mjs）
 * 注意：不依赖 nsfwSupport，避免循环引用
 */
import {
  ADULT_CANON_BUDGET,
  CONTEXT_HARD_CAP,
  FIELD_PERSON_NSFW,
  FIELD_PERSON_NTL,
  FIELD_SUMMARY,
  LIST_KINKS,
  LIST_LIMITS,
  LIST_TABOO,
  CORRUPTION_SIBLING_PER,
  CORRUPTION_SIBLING_BUDGET,
  STYLE_NSFW_SLICE,
  STYLE_ADULT_FALLBACK,
  clampBudget,
} from '../novel/contextBudgets.mjs';
import { countTokens, truncateToTokens } from '../assistant/contextManager.mjs';
import { formatVesselCanonBlock } from './vessels/worldVessels.mjs';

var ADULT_SIDE_TYPES = { item: 1, location: 1, lore: 1, faction: 1 };

function isPlaceholderText(s) {
  var t = String(s == null ? '' : s).trim();
  if (!t) return true;
  if (t === '（原文未提及）' || t === '原文未提及' || t === '未提及' || t === '无' || t === 'N/A') return true;
  return false;
}

/** 字段摘录：按 tiktoken 截断 */
function take(s, n) {
  var t = String(s == null ? '' : s).trim();
  if (!t) return '';
  var cap = Math.max(0, Math.floor(Number(n) || 0));
  if (!cap) return '';
  if (countTokens(t) <= cap) return t;
  return truncateToTokens(t, cap);
}

function tokLen(s) {
  return countTokens(s);
}

function asList(v) {
  if (Array.isArray(v)) return v.map(function(x) { return String(x || '').trim(); }).filter(Boolean);
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
}

/**
 * 从世界书条目摘恶堕档案摘要（互见）
 */
export function formatCorruptionArchiveDigests(worldbookEntries, opts) {
  opts = opts || {};
  var exclude = String(opts.excludeName || '').trim();
  var budget = clampBudget(opts.budget, CORRUPTION_SIBLING_BUDGET, CONTEXT_HARD_CAP);
  var per = Math.max(400, Math.floor(Number(opts.perArchive) || CORRUPTION_SIBLING_PER));
  var prefix = '恶堕档案·';
  var lines = ['【已有恶堕档案（气质/阶段须对齐，禁止互相矛盾）】'];
  var used = tokLen(lines[0]);
  (Array.isArray(worldbookEntries) ? worldbookEntries : []).forEach(function(e) {
    if (!e) return;
    var comment = String(e.comment || '').trim();
    if (comment.indexOf(prefix) !== 0) return;
    var name = comment.slice(prefix.length).trim();
    if (!name || (exclude && name === exclude)) return;
    var body = String(e.content || '').trim();
    if (!body) return;
    var stages = [];
    body.replace(/^##\s*(.+)$/gm, function(_, s) { stages.push(String(s).trim()); return _; });
    var excerpt = take(body.replace(/^#+\s*.+$/gm, '').trim(), per);
    var line = '- ' + name
      + (stages.length ? ' | 阶段:' + stages.slice(0, 9).join('/') : '')
      + '\n  ' + excerpt;
    var lineTok = tokLen(line);
    if (used + lineTok > budget) return;
    lines.push(line);
    used += lineTok;
  });
  if (lines.length < 2) return '';
  return '\n' + lines.join('\n');
}

function formatPersonCanonBlock(ent, fieldNsfw, fieldNtl) {
  if (!ent || ent.type !== 'person') return '';
  var lines = ['### ' + ent.name];
  if (ent.summary) lines.push('摘要：' + take(ent.summary, FIELD_SUMMARY));
  var prof = ent.attrs && ent.attrs.profile;
  var n = prof && prof.NSFW_information;
  if (n && typeof n === 'object') {
    if (n.sexual_personality && !isPlaceholderText(n.sexual_personality)) {
      lines.push('情欲性格：' + take(n.sexual_personality, fieldNsfw));
    }
    if (n.contrast && !isPlaceholderText(n.contrast)) {
      lines.push('反差：' + take(n.contrast, fieldNsfw));
    }
    var kinks = [].concat(n.Kinks || [], n.xp_kinks || []).filter(Boolean).slice(0, LIST_KINKS);
    if (kinks.length) lines.push('XP：' + kinks.join('、'));
    var limits = (n.Limits || []).filter(Boolean).slice(0, LIST_LIMITS);
    if (limits.length) lines.push('Limits：' + limits.join('、'));
    if (n.desire_palette) {
      lines.push('欲望调色盘：' + take(JSON.stringify(n.desire_palette), fieldNsfw));
    }
    if (n.inner_erotic_thoughts && !isPlaceholderText(n.inner_erotic_thoughts)) {
      lines.push('内心：' + take(n.inner_erotic_thoughts, fieldNsfw));
    }
  }
  var ntl = (ent.attrs && ent.attrs.ntl) || {};
  var power = ntl.powerDynamic;
  var themes = asList(ntl.tabooThemes);
  if (!isPlaceholderText(power) || themes.length) {
    if (!isPlaceholderText(power)) lines.push('NTL权力：' + take(power, fieldNtl));
    if (themes.length) lines.push('NTL禁忌：' + themes.slice(0, LIST_TABOO).join('、'));
    if (!isPlaceholderText(ntl.coercionHint)) lines.push('胁迫：' + take(ntl.coercionHint, fieldNtl));
    if (ntl.dominantRole) lines.push('主导角色：' + String(ntl.dominantRole));
    if (!isPlaceholderText(ntl.moralConflict)) lines.push('道德冲突：' + take(ntl.moralConflict, fieldNtl));
    if (!isPlaceholderText(ntl.emotionalCost)) lines.push('情绪代价：' + take(ntl.emotionalCost, fieldNtl));
    var secrets = asList(ntl.secrets);
    if (secrets.length) lines.push('秘密：' + secrets.slice(0, 8).join('、'));
  }
  if (ent.content && String(ent.content).trim().length > 40) {
    lines.push('人物正文摘录：' + take(ent.content, Math.max(fieldNsfw, 800)));
  }
  return lines.length > 1 ? lines.join('\n') : '';
}

function extractStyleSlice(styleText) {
  var t = String(styleText || '');
  if (!t.trim()) return '';
  var m = t.match(/##\s*NSFW\s*文风指令([\s\S]*?)(?=\n##\s|$)/i);
  if (m && m[1] && m[1].trim()) {
    return '\n【文风 NSFW 指令（人物描写须对齐）】\n' + take(m[1].trim(), STYLE_NSFW_SLICE);
  }
  var m2 = t.match(/##\s*NTL\s*文风指令([\s\S]*?)(?=\n##\s|$)/i);
  if (m2 && m2[1] && m2[1].trim()) {
    return '\n【文风 NTL 指令（禁忌张力须对齐）】\n' + take(m2[1].trim(), STYLE_NSFW_SLICE);
  }
  if (/情欲|身体描写|敏感|NSFW|禁忌|NTL/i.test(t)) {
    return '\n【文风片段（含成人向）】\n' + take(t, STYLE_ADULT_FALLBACK);
  }
  return '';
}

/**
 * @param {{
 *   entities?: object[],
 *   worldbookEntries?: object[],
 *   styleText?: string,
 *   excludeNames?: string[],
 *   focusName?: string,
 *   budget?: number,
 *   includeCorruption?: boolean,
 *   includeStyle?: boolean,
 *   includeVessels?: boolean,
 *   worldframeLabel?: string,
 * }} opts
 */
export function buildAdultCanonDigest(opts) {
  opts = opts || {};
  var budget = clampBudget(opts.budget, ADULT_CANON_BUDGET, CONTEXT_HARD_CAP);
  var excludeSet = Object.create(null);
  (opts.excludeNames || []).forEach(function(n) {
    var k = String(n || '').trim();
    if (k) excludeSet[k] = true;
  });
  var focus = String(opts.focusName || '').trim();
  var includeCorruption = opts.includeCorruption !== false;
  var includeStyle = opts.includeStyle !== false;
  var includeVessels = opts.includeVessels !== false;

  var parts = [];
  parts.push('\n【成人 Canon·已生成内容联动】');
  parts.push('以下为卡内已有成人相关事实。新生成内容必须与之对齐并写出互动关系；冲突时保留已确认的 Limits / 权力结构 / 恶堕阶段气质，禁止另起互不相关的禁忌体系。');

  var used = tokLen(parts.join('\n'));
  var remain = function() { return budget - used; };

  var persons = (opts.entities || []).filter(function(e) {
    return e && e.type === 'person' && e.name && !excludeSet[e.name];
  });
  persons.sort(function(a, b) {
    if (focus && a.name === focus) return -1;
    if (focus && b.name === focus) return 1;
    return 0;
  });

  var personBudget = Math.floor(budget * 0.55);
  var personParts = ['## 人物成人层'];
  var pUsed = tokLen(personParts[0]);
  persons.forEach(function(ent) {
    if (pUsed >= personBudget || remain() < 200) return;
    var block = formatPersonCanonBlock(ent, FIELD_PERSON_NSFW, FIELD_PERSON_NTL);
    if (!block) return;
    var blockTok = tokLen(block);
    if (pUsed + blockTok + 2 > personBudget) {
      block = take(block, Math.max(200, personBudget - pUsed - 10));
      blockTok = tokLen(block);
    }
    personParts.push(block);
    pUsed += blockTok + 2;
  });
  if (personParts.length > 1) {
    parts.push(personParts.join('\n'));
    used = tokLen(parts.join('\n'));
  }

  var nsfwEntBudget = Math.floor(budget * 0.12);
  var nsfwLines = ['## NSFW 世界设定'];
  var nUsed = tokLen(nsfwLines[0]);
  (opts.entities || []).filter(function(e) { return e && e.type === 'nsfw'; }).forEach(function(e) {
    if (nUsed >= nsfwEntBudget || remain() < 100) return;
    var a = e.attrs || {};
    var line = '- [' + (a.kind || 'rule') + '] ' + e.name
      + (e.summary ? '：' + take(e.summary, FIELD_SUMMARY) : '')
      + (e.content ? '\n  ' + take(e.content, 600) : '')
      + (asList(a.limits).length ? '\n  禁：' + asList(a.limits).slice(0, LIST_LIMITS).join('、') : '');
    nsfwLines.push(line);
    nUsed += tokLen(line);
  });
  if (nsfwLines.length > 1) {
    parts.push(nsfwLines.join('\n'));
    used = tokLen(parts.join('\n'));
  }

  var sideBudget = Math.floor(budget * 0.1);
  var sideLines = ['## 条目成人向用法'];
  var sUsed = tokLen(sideLines[0]);
  (opts.entities || []).filter(function(e) {
    return e && ADULT_SIDE_TYPES[e.type] && e.attrs && e.attrs.adult;
  }).forEach(function(e) {
    if (sUsed >= sideBudget || remain() < 80) return;
    var a = e.attrs.adult || {};
    if (isPlaceholderText(a.eroticRole) && !asList(a.playIdeas).length) return;
    var line = '- [' + e.type + '] ' + e.name
      + (a.eroticRole ? '：' + take(a.eroticRole, FIELD_SUMMARY) : '')
      + (asList(a.limits).length ? ' | 禁：' + asList(a.limits).slice(0, 8).join('、') : '')
      + (asList(a.relatedPersons).length ? ' | 相关：' + asList(a.relatedPersons).slice(0, 8).join('、') : '');
    sideLines.push(line);
    sUsed += tokLen(line);
  });
  if (sideLines.length > 1) {
    parts.push(sideLines.join('\n'));
    used = tokLen(parts.join('\n'));
  }

  if (includeVessels && remain() > 400) {
    var vesselBlock = formatVesselCanonBlock(opts.entities, {
      budget: Math.min(Math.floor(budget * 0.18), remain()),
      worldframeLabel: opts.worldframeLabel || '',
    });
    if (vesselBlock) {
      parts.push(vesselBlock);
      used = tokLen(parts.join('\n'));
    }
  }

  if (includeCorruption && remain() > 400) {
    var corr = formatCorruptionArchiveDigests(opts.worldbookEntries, {
      excludeName: focus || (opts.excludeNames && opts.excludeNames[0]) || '',
      budget: Math.min(CORRUPTION_SIBLING_BUDGET, remain()),
    });
    if (corr) {
      parts.push(corr.trim());
      used = tokLen(parts.join('\n'));
    }
  }

  var wbBudget = Math.floor(budget * 0.15);
  if (remain() > 300 && Array.isArray(opts.worldbookEntries)) {
    var wbLines = ['## 世界书人物条摘录'];
    var wUsed = tokLen(wbLines[0]);
    opts.worldbookEntries.forEach(function(e) {
      if (!e || wUsed >= wbBudget || remain() < 100) return;
      var comment = String(e.comment || '');
      if (comment.indexOf('[小说人物]') !== 0 && comment.indexOf('[人物]') !== 0) return;
      var name = comment.replace(/^\[小说人物\]\s*|^\[人物\]\s*/, '').trim();
      if (!name || excludeSet[name]) return;
      var line = '- ' + name + '\n  ' + take(e.content, 900);
      wbLines.push(line);
      wUsed += tokLen(line);
    });
    if (wbLines.length > 1) {
      parts.push(wbLines.join('\n'));
      used = tokLen(parts.join('\n'));
    }
  }

  if (includeStyle && opts.styleText && remain() > 200) {
    var stylePart = extractStyleSlice(opts.styleText);
    if (stylePart) {
      if (tokLen(stylePart) > remain()) stylePart = take(stylePart, remain() - 20);
      parts.push(stylePart.trim());
    }
  }

  parts.push('【联动硬约束】新内容须与上列 Limits/NTL/恶堕气质/世界观载体可对读；写出与他人及法器/异能/场所等载体的互动，禁止孤立设定或错位道具体系。');

  var out = parts.join('\n');
  if (tokLen(out) > budget) out = take(out, budget);
  return out;
}
