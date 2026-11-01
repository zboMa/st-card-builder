/**
 * 角色设定：纯函数视图快照。
 */
import { normalizeCharTags } from '../../charTags.mjs';
import { normalizeCharacterVersion } from '../cardRelease.mjs';
import { countTokens, formatTokenCount } from '../../tokenStats.mjs';
import { MAX_AVATARS_PER_CARD } from '../cardAvatarGallery.mjs';

function text(value) {
  return value == null ? '' : String(value);
}

function tokenText(n) {
  return formatTokenCount(n) + ' tok';
}

export function buildCharacterView(state, ui) {
  var s = state || {};
  var u = ui || {};
  var current = normalizeCharacterVersion(s.characterVersion);
  var baseline = normalizeCharacterVersion(u.versionBaseline || current);
  return {
    fields: {
      charName: text(s.charName),
      wbName: text(s.wbName),
      charDesc: text(s.charDesc),
      creatorNotes: text(s.creatorNotes),
      characterVersion: current,
    },
    tags: normalizeCharTags(s.charTags || []),
    version: {
      current: current,
      baseline: baseline,
      canRevert: current !== baseline,
    },
  };
}

export function buildCharacterTokens(state) {
  var s = state || {};
  var desc = countTokens(text(s.charDesc));
  var notes = countTokens(text(s.creatorNotes));
  var total = desc + notes
    + countTokens(text(s.charName))
    + countTokens(text(s.wbName))
    + countTokens(normalizeCharTags(s.charTags || []).join(' '));
  return {
    desc: desc,
    notes: notes,
    total: total,
    descText: tokenText(desc),
    notesText: tokenText(notes),
    totalText: tokenText(total),
    descTitle: desc + ' tokens',
    notesTitle: notes + ' tokens',
    totalTitle: total + ' tokens',
  };
}

export function buildAvatarView(uiAvatar) {
  var a = uiAvatar || {};
  var items = Array.isArray(a.items) ? a.items : [];
  var count = Number(a.count || items.length || 0);
  var max = Number(a.max || MAX_AVATARS_PER_CARD);
  return {
    mainUrl: text(a.mainUrl),
    items: items.map(function (it) {
      return {
        id: text(it && it.id),
        label: text(it && it.label),
        url: text(it && it.url),
        current: !!(it && it.current),
        published: !!(it && it.published),
        primary: !!(it && it.primary),
      };
    }),
    count: count,
    max: max,
    countText: count + '/' + max,
    full: !!a.full || count >= max,
    loading: !!a.loading,
    hasDraft: !!a.hasDraft,
    emptyText: text(a.emptyText || (a.hasDraft ? '暂无卡面，请上传或 AI 生成' : '请先选择或新建角色卡')),
  };
}

export function buildAvatarGenView(uiGen) {
  var g = uiGen || {};
  return {
    open: !!g.open,
    meta: text(g.meta),
    prompt: text(g.prompt),
    negative: text(g.negative),
    showNegative: !!g.showNegative,
    status: text(g.status),
    statusKind: text(g.statusKind),
    images: Array.isArray(g.images) ? g.images.slice() : [],
    busyPrompt: !!g.busyPrompt,
    busyRun: !!g.busyRun,
  };
}
