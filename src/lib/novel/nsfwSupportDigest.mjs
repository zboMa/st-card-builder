/**
 * 小说工坊成人/NTL：摘要与互喂格式化（拆自 nsfwSupport）
 * 预算累计一律 tiktoken（createTokenBudgetAccumulator）
 */
import {
  ADULT_DIGEST_DEFAULT,
  FIELD_PERSON_NSFW,
  FIELD_PERSON_NTL,
  FIELD_SUMMARY,
  LIST_KINKS,
  LIST_LIMITS,
  LIST_TABOO,
} from './contextBudgets.mjs';
import {
  isPlaceholderText,
  normalizeAdultAttrs,
  normalizeNsfwEntityAttrs,
  normalizeNsfwMeta,
  normalizeNtlPersonAttrs,
  isAdultAttrsFilled,
  entityNeedsAdultAttrs,
} from './nsfwSupportAttrs.mjs';
import { createTokenBudgetAccumulator, truncateToTokens } from '../assistant/contextManager.mjs';

/** 成人维 → 可并入世界书 content 的短段 */
export function formatAdultAttrsForContent(adult) {
  var a = normalizeAdultAttrs(adult);
  if (!isAdultAttrsFilled(a) && isPlaceholderText(a.eroticRole) && !(a.playIdeas || []).length) {
    return '';
  }
  var lines = ['【成人向用法】'];
  if (!isPlaceholderText(a.eroticRole)) lines.push('角色定位：' + a.eroticRole);
  if (!isPlaceholderText(a.atmosphere)) lines.push('氛围：' + a.atmosphere);
  if (a.triggers && a.triggers.length) lines.push('触发：' + a.triggers.slice(0, 8).join('、'));
  if (a.playIdeas && a.playIdeas.length) lines.push('玩法：' + a.playIdeas.slice(0, 8).join('、'));
  if (a.limits && a.limits.length) lines.push('界限：' + a.limits.slice(0, 8).join('、'));
  if (a.relatedPersons && a.relatedPersons.length) {
    lines.push('相关人物：' + a.relatedPersons.slice(0, 6).join('、'));
  }
  return lines.length > 1 ? lines.join('\n') : '';
}

function digestPush(lines, acc, line) {
  if (!acc.tryAdd(line)) return false;
  lines.push(line);
  return true;
}

/** 从实体库摘人物 NSFW 摘要（文风互喂） */
export function formatPersonNsfwDigest(entities, maxTokens) {
  var budget = maxTokens || Math.floor(ADULT_DIGEST_DEFAULT * 0.4);
  var lines = ['【已有人物 NSFW 摘要（文风须对齐尺度与禁忌）】'];
  var acc = createTokenBudgetAccumulator(budget);
  acc.tryAdd(lines[0]);
  (entities || []).filter(function(e) { return e && e.type === 'person'; }).forEach(function(e) {
    var n = e.attrs && e.attrs.profile && e.attrs.profile.NSFW_information;
    if (!n) return;
    var kinks = [].concat(n.Kinks || [], n.xp_kinks || []).slice(0, LIST_KINKS).join('、');
    var limits = (n.Limits || []).slice(0, LIST_LIMITS).join('、');
    var meta = e.attrs && e.attrs.nsfwMeta ? normalizeNsfwMeta(e.attrs.nsfwMeta) : null;
    var line = '- ' + e.name
      + (n.sexual_personality && !isPlaceholderText(n.sexual_personality)
        ? ' | 情欲性格:' + truncateToTokens(String(n.sexual_personality), FIELD_PERSON_NSFW) : '')
      + (n.contrast && !isPlaceholderText(n.contrast)
        ? ' | 反差:' + truncateToTokens(String(n.contrast), FIELD_PERSON_NSFW) : '')
      + (kinks ? ' | XP:' + kinks : '')
      + (limits ? ' | Limits:' + limits : '')
      + (meta && meta.inferred ? ' | 推断' : '');
    digestPush(lines, acc, line);
  });
  if (lines.length < 2) return '';
  return '\n' + lines.join('\n');
}

/** 从实体库摘 nsfw 条目摘要 */
export function formatNsfwEntityDigest(entities, maxTokens) {
  var budget = maxTokens || Math.floor(ADULT_DIGEST_DEFAULT * 0.25);
  var lines = ['【已有 NSFW 世界设定】'];
  var acc = createTokenBudgetAccumulator(budget);
  acc.tryAdd(lines[0]);
  (entities || []).filter(function(e) { return e && e.type === 'nsfw'; }).forEach(function(e) {
    var a = normalizeNsfwEntityAttrs(e.attrs || {});
    var line = '- [' + a.kind + '] ' + e.name
      + (e.summary ? ': ' + truncateToTokens(String(e.summary), FIELD_SUMMARY) : '')
      + (e.content ? ' | ' + truncateToTokens(String(e.content), 400) : '')
      + (a.limits && a.limits.length ? ' | 禁:' + a.limits.slice(0, LIST_LIMITS).join('/') : '');
    digestPush(lines, acc, line);
  });
  if (lines.length < 2) return '';
  return '\n' + lines.join('\n');
}

/** 物品/地点/设定等 attrs.adult 摘要 */
export function formatAdultSideDigest(entities, maxTokens) {
  var budget = maxTokens || Math.floor(ADULT_DIGEST_DEFAULT * 0.25);
  var lines = ['【已有条目成人向用法（item/location/lore/faction）】'];
  var acc = createTokenBudgetAccumulator(budget);
  acc.tryAdd(lines[0]);
  (entities || []).filter(function(e) {
    return entityNeedsAdultAttrs(e) && e.attrs && e.attrs.adult;
  }).forEach(function(e) {
    var a = normalizeAdultAttrs(e.attrs.adult);
    if (isPlaceholderText(a.eroticRole) && !(a.playIdeas || []).length) return;
    var line = '- [' + e.type + (a.vesselKind ? '/' + a.vesselKind : '') + '] ' + e.name
      + (a.eroticRole ? ': ' + truncateToTokens(String(a.eroticRole), FIELD_SUMMARY) : '')
      + (a.powerLogic ? ' | 机制:' + truncateToTokens(String(a.powerLogic), FIELD_SUMMARY) : '')
      + (a.costOrRisk ? ' | 代价:' + truncateToTokens(String(a.costOrRisk), 80) : '')
      + (a.limits && a.limits.length ? ' | 禁:' + a.limits.slice(0, LIST_LIMITS).join('/') : '')
      + (a.relatedPersons && a.relatedPersons.length
        ? ' | 相关:' + a.relatedPersons.slice(0, 10).join('/') : '');
    digestPush(lines, acc, line);
  });
  if (lines.length < 2) return '';
  return '\n' + lines.join('\n');
}

/** 从实体库摘人物 NTL 摘要（文风互喂） */
export function formatPersonNtlDigest(entities, maxTokens) {
  var budget = maxTokens || Math.floor(ADULT_DIGEST_DEFAULT * 0.25);
  var lines = ['【已有人物 NTL 摘要（禁忌张力须对齐）】'];
  var acc = createTokenBudgetAccumulator(budget);
  acc.tryAdd(lines[0]);
  (entities || []).filter(function(e) { return e && e.type === 'person'; }).forEach(function(e) {
    var ntl = normalizeNtlPersonAttrs(e.attrs && e.attrs.ntl);
    if (isPlaceholderText(ntl.powerDynamic) && !ntl.tabooThemes.length) return;
    var line = '- ' + e.name
      + (ntl.powerDynamic && !isPlaceholderText(ntl.powerDynamic)
        ? ' | 权力动态:' + truncateToTokens(String(ntl.powerDynamic), FIELD_PERSON_NTL) : '')
      + (ntl.tabooThemes.length ? ' | 禁忌:' + ntl.tabooThemes.slice(0, LIST_TABOO).join('/') : '')
      + (ntl.coercionHint && !isPlaceholderText(ntl.coercionHint)
        ? ' | 胁迫:' + truncateToTokens(String(ntl.coercionHint), FIELD_PERSON_NTL) : '')
      + (ntl.moralConflict && !isPlaceholderText(ntl.moralConflict)
        ? ' | 道德:' + truncateToTokens(String(ntl.moralConflict), FIELD_PERSON_NTL) : '')
      + (ntl.emotionalCost && !isPlaceholderText(ntl.emotionalCost)
        ? ' | 代价:' + truncateToTokens(String(ntl.emotionalCost), FIELD_PERSON_NTL) : '')
      + (ntl.dominantRole ? ' | 角色:' + ntl.dominantRole : '')
      + (ntl.inferred ? ' | 推断' : '');
    digestPush(lines, acc, line);
  });
  if (lines.length < 2) return '';
  return '\n' + lines.join('\n');
}

/** 合并成人相关摘要块；预算默认已放宽。优先用 buildAdultCanonDigest 做完整联动 */
export function buildAdultContextDigests(entities, maxTokens, ntlMode) {
  var budget = maxTokens || ADULT_DIGEST_DEFAULT;
  var ntlBudget = ntlMode ? Math.floor(budget * 0.25) : 0;
  var mainBudget = budget - ntlBudget;
  var parts = [
    formatPersonNsfwDigest(entities, Math.floor(mainBudget * 0.45)),
    formatNsfwEntityDigest(entities, Math.floor(mainBudget * 0.25)),
    formatAdultSideDigest(entities, Math.floor(mainBudget * 0.3)),
    ntlMode ? formatPersonNtlDigest(entities, ntlBudget) : null,
  ].filter(Boolean);
  return parts.join('');
}
