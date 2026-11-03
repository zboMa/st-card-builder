/**
 * 酒馆脚本：纯函数视图快照。
 */
import { normalizeTavernScriptList } from '../../tavernScripts.mjs';

export function isAutoTavernName(name) {
  var n = String(name || '');
  if (n === 'MVU' || n === '[状态栏]前置展示') return true;
  return /zod$/i.test(n);
}

export function tavernAutoBadge(name) {
  var n = String(name || '');
  if (n === 'MVU') return 'MVU';
  if (n === '[状态栏]前置展示') return '状态栏';
  if (/zod$/i.test(n)) return 'MVU';
  return '';
}

export function buildTavernEditor(script) {
  var s = script && typeof script === 'object' ? script : {};
  var button = s.button && typeof s.button === 'object' ? s.button : { enabled: true, buttons: [] };
  var buttonJson = '[]';
  var dataJson = '{}';
  try {
    buttonJson = JSON.stringify(Array.isArray(button.buttons) ? button.buttons : [], null, 2);
  } catch (e) { /* keep default */ }
  try {
    dataJson = JSON.stringify(s.data || {}, null, 2);
  } catch (e2) { /* keep default */ }
  return {
    id: String(s.id || ''),
    name: String(s.name || ''),
    type: String(s.type || 'script'),
    enabled: s.enabled !== false,
    info: String(s.info || ''),
    content: String(s.content || ''),
    buttonEnabled: button.enabled !== false,
    buttonJson: buttonJson,
    dataJson: dataJson,
  };
}

export function buildTavernScriptsView(state, ui) {
  var s = state || {};
  var u = ui || {};
  var list = normalizeTavernScriptList(s.tavernHelperScripts || []);
  var selectedId = String(u.selectedId || '');
  var selectedIndex = -1;
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === selectedId) { selectedIndex = i; break; }
  }
  var items = list.map(function (item, index) {
    return {
      id: item.id,
      index: index,
      name: item.name || '(未命名)',
      enabled: item.enabled !== false,
      type: item.type || 'script',
      badge: tavernAutoBadge(item.name),
      auto: isAutoTavernName(item.name),
      selected: item.id === selectedId,
    };
  });
  return {
    items: items,
    count: items.length,
    countText: items.length + ' 条',
    selectedId: selectedId,
    selectedIndex: selectedIndex,
    selected: selectedIndex >= 0 ? list[selectedIndex] : null,
    editor: u.editor || null,
    liveHint: String(u.liveHint || ''),
    liveHintKind: String(u.liveHintKind || ''),
    status: String(u.status || ''),
    statusKind: String(u.statusKind || ''),
  };
}
