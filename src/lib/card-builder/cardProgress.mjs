/**
 * 卡进度状态机（§6.1 · D10）
 */

import { isPersonWorldbookEntry, personNameFromWorldbookEntry } from '../novel/sync.mjs';

var DEFAULT_CHAR_NAME = /^(无名角色|未命名|New Character|Character)$/i;
var SCENE_CONTRACT_MIN = 40;

/**
 * @param {object} state 卡 state
 * @param {object} [opts]
 */
export function computeCardProgress(state, opts) {
  opts = opts || {};
  var cardId = String((state && state.draftId) || opts.cardId || '');
  var charName = String((state && state.charName) || '').trim();
  var charDesc = String((state && state.charDesc) || '').trim();
  var wb = Array.isArray(state && state.worldbookEntries) ? state.worldbookEntries : [];

  var worldbookPersonCount = 0;
  wb.forEach(function(e) {
    if (isPersonWorldbookEntry(e) && personNameFromWorldbookEntry(e)) worldbookPersonCount++;
  });

  var signals = {
    novelTouched: !!opts.novelTouched,
    storyTouched: !!opts.storyTouched,
    playtested: !!opts.playtested,
    exportChecked: !!opts.exportChecked,
    lastPromoteAt: opts.lastPromoteAt || null,
    lastPromoteKind: opts.lastPromoteKind || null,
    hasCharIdentifier: !!(charName && !DEFAULT_CHAR_NAME.test(charName)),
    hasSceneContract: charDesc.length >= SCENE_CONTRACT_MIN && !/^请/.test(charDesc),
    hasStatusBarOrMvu: !!(state && (state.mvuDesign || state.statusBarInjected || state.mvuVariables)),
    worldbookPersonCount: worldbookPersonCount,
    worldbookEntryCount: wb.length,
    entityCount: typeof opts.entityCount === 'number' ? opts.entityCount : 0,
    entitySelectedCount: typeof opts.entitySelectedCount === 'number' ? opts.entitySelectedCount : 0,
    novelUnsyncedCount: typeof opts.novelUnsyncedCount === 'number' ? opts.novelUnsyncedCount : 0,
  };

  var phase = 'prepare';
  if (!signals.hasSceneContract && worldbookPersonCount === 0) {
    phase = 'prepare';
  } else if (!signals.playtested) {
    phase = signals.hasSceneContract || worldbookPersonCount > 0 ? 'shape' : 'prepare';
    if (signals.hasSceneContract && worldbookPersonCount > 0) phase = 'playtest';
  } else if (!signals.exportChecked) {
    phase = 'playtest';
  } else {
    phase = 'publish';
  }

  var suggestions = [];
  if (!signals.hasCharIdentifier) {
    suggestions.push({ id: 'char-id', label: '补全场景标识（charName）', hash: 'character', priority: 10 });
  }
  if (worldbookPersonCount === 0) {
    suggestions.push({ id: 'wb-person', label: '添加 worldbook 人物条目', hash: 'worldbook', priority: 20 });
  }
  if (!signals.hasSceneContract) {
    suggestions.push({ id: 'scene-contract', label: '编写场景契约（charDesc）', hash: 'character', priority: 15 });
  }
  if (!signals.novelTouched) {
    suggestions.push({ id: 'novel', label: '进入小说工坊备料', hash: 'novel-source', priority: 30 });
  }
  if (!signals.storyTouched) {
    suggestions.push({ id: 'story', label: '去 Story Studio 写作', hash: 'story-studio', priority: 40 });
  }
  if (!signals.playtested) {
    suggestions.push({ id: 'playtest', label: '试聊验卡', hash: 'chat-playground', priority: 25 });
  }
  if (signals.playtested && !signals.exportChecked) {
    suggestions.push({ id: 'export', label: '导出检查', hash: 'card-manager', priority: 50 });
  }

  var blockers = [];
  if (!signals.hasCharIdentifier) blockers.push('缺少场景标识');
  if (!signals.hasSceneContract && worldbookPersonCount === 0) blockers.push('尚无场景契约或 worldbook 人物');

  return {
    cardId: cardId,
    phase: phase,
    signals: signals,
    blockers: blockers,
    suggestions: suggestions.sort(function(a, b) { return a.priority - b.priority; }),
    updatedAt: new Date().toISOString(),
  };
}
