/**
 * 小说创作提示组装（含禁止儿童性化）
 */

import { packChapterContext } from './tokenBudget.mjs';

export var CHILD_SAFETY_RULE =
  '【硬性禁令】禁止儿童性化：所有情欲/亲密描写仅限明确成年角色；不得涉及未成年外貌或性暗示。';

/**
 * @param {object} vars
 */
export function buildOutlineUserPrompt(vars) {
  var v = vars || {};
  var parts = [];
  parts.push('【小说标题】' + (v.title || '未命名'));
  if (v.direction) parts.push('【创作方向】' + v.direction);
  if (v.branchHint) parts.push('【分支方向】' + v.branchHint);
  if (v.graphBrief) parts.push('【人物·地点摘要】\n' + v.graphBrief);
  if (v.existingOutline) parts.push('【已有大纲】\n' + v.existingOutline);
  if (v.feedForwardBrief) parts.push('【已写章记忆】\n' + v.feedForwardBrief);
  if (v.segmentHint) parts.push('【本段任务】' + v.segmentHint);
  parts.push('请输出 JSON：{ "chapters": [ { "title":"章节名", "summary":"80～200字摘要" } ] }');
  parts.push(CHILD_SAFETY_RULE);
  return parts.join('\n');
}

/**
 * 章文提示：洋葱上下文 + 本章要素
 */
export function buildChapterUserPrompt(vars) {
  var v = vars || {};
  var packed = packChapterContext({
    branchHint: v.branchHint,
    graphBrief: v.graphBrief,
    outlineBrief: v.outlineBrief,
    ledgerBrief: v.ledgerBrief,
    feedForwards: v.feedForwards,
    prevContent: v.prevContent,
    budget: v.tokenBudget,
  });

  var parts = [];
  parts.push('【小说标题】' + (v.title || '未命名'));
  parts.push('【本章标题】' + (v.chapterTitle || ''));
  if (v.chapterSummary) parts.push('【本章摘要】' + v.chapterSummary);
  if (v.advancePrompt) parts.push('【本章推进提示】' + v.advancePrompt);
  packed.blocks.forEach(function(b) { parts.push(b); });
  parts.push('请撰写本章完整正文（中文，1500～4000字为宜），只输出正文，不要前言后语。');
  parts.push(CHILD_SAFETY_RULE);
  return parts.join('\n');
}

export function graphBriefFromNovel(novel) {
  if (!novel || !novel.graph) return '';
  var nodes = (novel.graph.nodes || []).slice(0, 40);
  if (!nodes.length) return '';
  return nodes.map(function(n) {
    return '- [' + (n.type || 'other') + '] ' + n.name + (n.note ? '：' + String(n.note).slice(0, 60) : '');
  }).join('\n');
}

export function outlineBriefFromNovel(novel, aroundIndex, outlineOverride) {
  var outline = Array.isArray(outlineOverride)
    ? outlineOverride
    : (novel && Array.isArray(novel.outline) ? novel.outline : []);
  if (!outline.length) return '';
  var i = typeof aroundIndex === 'number' ? aroundIndex : 0;
  var start = Math.max(0, i - 2);
  var end = Math.min(outline.length, i + 3);
  return outline.slice(start, end).map(function(o, idx) {
    return (start + idx + 1) + '. ' + o.title + ' — ' + String(o.summary || '').slice(0, 120);
  }).join('\n');
}

/** 尝试从 AI 文本解析大纲 JSON */
export function parseOutlineAiText(text) {
  var raw = String(text || '').trim();
  if (!raw) return [];
  var jsonStr = raw;
  var fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) jsonStr = fence[1].trim();
  var start = jsonStr.indexOf('{');
  var end = jsonStr.lastIndexOf('}');
  if (start >= 0 && end > start) jsonStr = jsonStr.slice(start, end + 1);
  try {
    var obj = JSON.parse(jsonStr);
    var list = Array.isArray(obj) ? obj : (obj && obj.chapters);
    if (!Array.isArray(list)) return [];
    return list.map(function(item, idx) {
      if (typeof item === 'string') return { title: item, summary: '' };
      return {
        title: String((item && (item.title || item.name)) || ('第' + (idx + 1) + '章')),
        summary: String((item && (item.summary || item.blurb || item.desc)) || ''),
      };
    }).filter(function(x) { return x.title; });
  } catch (e) {
    return [];
  }
}
