/**
 * 制卡域写入口（具名 action）。
 * 面板 / 桥接只通过这里写，保证单一数据源；内部走 cardStore.setKey 触发订阅。
 */
import { cardState, setCardKey, setCardKeys, replaceCardKeys, markCardDirty } from './cardStore.mjs';

export { cardState, setCardKey, setCardKeys, replaceCardKeys, markCardDirty };

export function setWorldbookEntries(entries) {
  setCardKey('worldbookEntries', Array.isArray(entries) ? entries.slice() : []);
}

export function setRegexScripts(list) {
  setCardKey('regexScripts', Array.isArray(list) ? list.slice() : []);
}

export function setTavernHelperScripts(list) {
  setCardKey('tavernHelperScripts', Array.isArray(list) ? list.slice() : []);
}

/** 写 / 删一个 card builder extension 字段（整对象替换以触发订阅）。 */
export function setCardExtensionField(key, value) {
  if (!key) return;
  var cur = cardState().cardBuilderExtensions;
  var ext = (cur && typeof cur === 'object') ? Object.assign({}, cur) : {};
  if (value === undefined || value === null) delete ext[key];
  else ext[key] = value;
  setCardKey('cardBuilderExtensions', ext);
}
