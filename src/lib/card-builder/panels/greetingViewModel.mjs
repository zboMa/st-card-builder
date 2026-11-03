import { countTokens, formatTokenCount } from '../../tokenStats.mjs';
import {
  baselineLeavesFromEntries,
  formatOverrideLines,
} from '../../mvu/greetingInit.mjs';

function tokenText(n) {
  return formatTokenCount(n) + ' tok';
}

function overrideCount(map) {
  return map && typeof map === 'object' ? Object.keys(map).length : 0;
}

function initHint(hasBaseline, map) {
  if (!hasBaseline) return '还没有保底，先到状态栏生成变量';
  var n = overrideCount(map);
  return n ? (n + ' 项和保底不同') : '沿用世界书保底';
}

function generateLabel(map) {
  return overrideCount(map) ? '按正文重填' : '从正文填写';
}

function generateTitle(hasBaseline, prose) {
  if (!hasBaseline) return '先到状态栏生成变量';
  if (!String(prose || '').trim()) return '先写这一条开场白';
  return '按这一条正文重算，会换掉已有差异';
}

function draftFor(ui, target, index) {
  var drafts = ui.initDrafts || {};
  if (target === 'main') return drafts.main;
  var alts = drafts.alts || {};
  return Object.prototype.hasOwnProperty.call(alts, index) ? alts[index] : null;
}

export function buildGreetingView(state, ui, opts) {
  var s = state || {};
  var u = ui || {};
  var options = opts || {};
  var entries = Array.isArray(s.worldbookEntries) ? s.worldbookEntries : [];
  var hasBaseline = Object.keys(baselineLeavesFromEntries(entries)).length > 0;
  var firstMes = String(s.firstMes || '');
  var altGreetings = Array.isArray(s.altGreetings) ? s.altGreetings : [];
  var greetingInitMain = s.greetingInitMain && typeof s.greetingInitMain === 'object'
    ? s.greetingInitMain
    : {};
  var greetingInitAlts = Array.isArray(s.greetingInitAlts) ? s.greetingInitAlts : [];
  var openAlts = Array.isArray(u.openAlts) ? u.openAlts : [];
  var busyTarget = String(u.busyTarget || '');
  var withTokens = options.withTokens !== false;
  var previousAlts = Array.isArray(u.alts) ? u.alts : [];
  var firstTokens = withTokens ? countTokens(firstMes) : 0;
  var totalTokens = firstTokens;
  var mainDraft = draftFor(u, 'main');
  var flavorTip = options.flavorTip != null
    ? String(options.flavorTip || '')
    : String(u.flavorTip || '');

  var alts = altGreetings.map(function(text, index) {
    var value = String(text == null ? '' : text);
    var init = greetingInitAlts[index] && typeof greetingInitAlts[index] === 'object'
      ? greetingInitAlts[index]
      : {};
    var tokens = withTokens ? countTokens(value) : 0;
    if (withTokens) totalTokens += tokens;
    var altDraft = draftFor(u, 'alt', index);
    var previous = previousAlts[index] || {};
    return {
      index: index,
      label: '开场白 #' + (index + 2),
      text: value,
      tokenText: withTokens ? tokenText(tokens) : String(previous.tokenText || ''),
      tokenTitle: withTokens ? tokens + ' tokens' : String(previous.tokenTitle || ''),
      initText: altDraft != null ? String(altDraft) : formatOverrideLines(init),
      initHint: initHint(hasBaseline, init),
      generateLabel: generateLabel(init),
      generateDisabled: !hasBaseline || !value.trim(),
      generateTitle: generateTitle(hasBaseline, value),
      initOpen: !!openAlts[index],
      busy: busyTarget === ('alt:' + index),
      canUp: index > 0,
      canDown: index < altGreetings.length - 1,
    };
  });

  return {
    firstMes: firstMes,
    firstMesTokenText: withTokens ? tokenText(firstTokens) : String(u.firstMesTokenText || ''),
    firstMesTokenTitle: withTokens ? firstTokens + ' tokens' : String(u.firstMesTokenTitle || ''),
    totalTokenText: withTokens ? tokenText(totalTokens) : String(u.totalTokenText || ''),
    totalTokenTitle: withTokens ? totalTokens + ' tokens' : String(u.totalTokenTitle || ''),
    flavorTip: flavorTip,
    showFlavorTip: !!flavorTip,
    main: {
      initText: mainDraft != null ? String(mainDraft) : formatOverrideLines(greetingInitMain),
      initHint: initHint(hasBaseline, greetingInitMain),
      generateLabel: generateLabel(greetingInitMain),
      generateDisabled: !hasBaseline || !firstMes.trim(),
      generateTitle: generateTitle(hasBaseline, firstMes),
      initOpen: !!u.mainInitOpen,
      busy: busyTarget === 'main',
    },
    alts: alts,
    busyTarget: busyTarget,
  };
}
