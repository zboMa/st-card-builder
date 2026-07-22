/**
 * 助手工具执行器：依赖 bridge 读写卡片状态，纯逻辑可单测
 */
import { getToolByName, VALID_VIEWS } from './tools.mjs';
import { classifyToolRisk, buildChangePreview } from './risk.mjs';
import {
  CHARACTER_CANONICAL_KEYS,
  normalizeCharacterFieldKey,
  normalizeCharacterPatch,
} from './characterFields.mjs';

/**
 * 解析定向目标：支持 target 对象或扁平 index/id/comment/titleMatch/name
 * @returns {{ index?: number, id?: string, titleMatch?: string, comment?: string, name?: string }}
 */
export function normalizeTarget(args) {
  var a = args || {};
  var t = a.target;
  if (t == null) {
    return {
      index: typeof a.index === 'number' ? a.index : undefined,
      id: a.id != null ? String(a.id) : undefined,
      titleMatch: a.titleMatch != null ? String(a.titleMatch) : undefined,
      comment: a.comment != null ? String(a.comment) : undefined,
      name: a.name != null ? String(a.name) : undefined,
    };
  }
  if (typeof t === 'number') return { index: t };
  if (typeof t === 'string') {
    // main | 纯数字序号 | 标题关键字
    if (t === 'main') return { index: -1, name: 'main' };
    if (/^\d+$/.test(t)) return { index: parseInt(t, 10) };
    return { titleMatch: t, name: t, comment: t };
  }
  if (typeof t === 'object') {
    return {
      index: typeof t.index === 'number' ? t.index
        : (typeof t.alternate === 'number' ? t.alternate : undefined),
      id: t.id != null ? String(t.id) : undefined,
      titleMatch: t.titleMatch != null ? String(t.titleMatch) : (t.title != null ? String(t.title) : undefined),
      comment: t.comment != null ? String(t.comment) : undefined,
      name: t.name != null ? String(t.name) : (t === 'main' || t.main ? 'main' : undefined),
      alternate: typeof t.alternate === 'number' ? t.alternate : undefined,
      isMain: t === 'main' || t.main === true || t.kind === 'main',
    };
  }
  return {};
}

/**
 * 在世界书列表中定位条目（id / 精确 comment / 标题包含 / 序号）
 * @returns {number} 索引，未找到 -1
 */
export function resolveWorldbookIndex(entries, args) {
  var list = entries || [];
  var t = normalizeTarget(args);
  if (typeof t.index === 'number' && t.index >= 0 && t.index < list.length) return t.index;
  if (t.id) {
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].uid || list[i].id || '') === t.id) return i;
    }
  }
  if (t.comment) {
    for (var j = 0; j < list.length; j++) {
      if ((list[j].comment || '') === t.comment) return j;
    }
  }
  if (t.titleMatch) {
    var q = t.titleMatch.toLowerCase();
    var hits = [];
    for (var k = 0; k < list.length; k++) {
      if (String(list[k].comment || '').toLowerCase().indexOf(q) >= 0) hits.push(k);
    }
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) return hits[0]; // 多命中取第一条，调用方应提示
  }
  // 兼容旧参数
  if (typeof args.index === 'number') return args.index;
  if (args.comment) {
    for (var m = 0; m < list.length; m++) {
      if ((list[m].comment || '') === args.comment) return m;
    }
  }
  return -1;
}
