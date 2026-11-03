/**
 * 正则面板纯函数视图快照。
 */
import {
  normalizeRegexList,
  normalizeRegexScript,
  placementLabel,
} from '../../regexScripts.mjs';

var KNOWN_AUTO = {
  '[不发送]去除变量更新': 'MVU',
  '[美化]变量更新状态卡': 'MVU',
  '[美化]隐藏变量初始化': 'MVU',
  '[美化]状态栏展示': '状态栏',
};

export function regexAutoBadge(name) {
  return KNOWN_AUTO[String(name || '')] || '';
}

export function buildRegexEditor(rx) {
  var r = normalizeRegexScript(rx);
  return {
    id: String(r.id || ''),
    scriptName: String(r.scriptName || ''),
    findRegex: String(r.findRegex || ''),
    replaceString: String(r.replaceString || ''),
    placement: Array.isArray(r.placement) ? r.placement.slice() : [],
    disabled: r.disabled === true,
    markdownOnly: r.markdownOnly === true,
    promptOnly: r.promptOnly === true,
    runOnEdit: r.runOnEdit !== false,
    substituteRegex: r.substituteRegex === true,
    minDepth: r.minDepth == null ? '' : String(r.minDepth),
    maxDepth: r.maxDepth == null ? '' : String(r.maxDepth),
  };
}

export function buildRegexView(state, ui) {
  var s = state || {};
  var u = ui || {};
  var list = normalizeRegexList(s.regexScripts || []);
  var selectedId = String(u.selectedId || '');
  var selectedIndex = -1;
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === selectedId) { selectedIndex = i; break; }
  }
  var items = list.map(function (item, index) {
    return {
      id: item.id,
      index: index,
      name: item.scriptName || '(未命名)',
      disabled: item.disabled === true,
      placement: item.placement,
      placementLabel: placementLabel(item.placement),
      badge: regexAutoBadge(item.scriptName),
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
