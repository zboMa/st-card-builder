/**
 * 助手写入角色设定时的规范字段名与别名映射
 * UI 绑定：charName / wbName / charDesc / firstMes / creatorNotes / tags / altGreetings
 */

/** 可写入的规范字段 */
export const CHARACTER_CANONICAL_KEYS = [
  'charName',
  'wbName',
  'charDesc',
  'firstMes',
  'creatorNotes',
  'tags',
  'altGreetings',
];

/** 别名（小写）→ 规范名 */
export const CHARACTER_FIELD_ALIASES = {
  charname: 'charName',
  name: 'charName',
  char_name: 'charName',
  wbname: 'wbName',
  worldname: 'wbName',
  world: 'wbName',
  chardesc: 'charDesc',
  description: 'charDesc',
  char_desc: 'charDesc',
  desc: 'charDesc',
  firstmes: 'firstMes',
  first_mes: 'firstMes',
  firstmessage: 'firstMes',
  creatornotes: 'creatorNotes',
  creator_notes: 'creatorNotes',
  creatorcomment: 'creatorNotes',
  creator_comment: 'creatorNotes',
  authornote: 'creatorNotes',
  authornotes: 'creatorNotes',
  authorsnote: 'creatorNotes',
  authors_note: 'creatorNotes',
  // ST Author's Note 字段在本应用无独立 UI，统一落到 creatorNotes
  posthistoryinstructions: 'creatorNotes',
  post_history_instructions: 'creatorNotes',
  posthistoryinstruction: 'creatorNotes',
  tags: 'tags',
  chartags: 'tags',
  altgreetings: 'altGreetings',
  alternate_greetings: 'altGreetings',
  alt_greetings: 'altGreetings',
};

/** 注入助手系统提示的字段对照（单行） */
export const CHARACTER_FIELD_HINT =
  'charName=角色名；wbName=世界书名；charDesc=角色描述；firstMes=主开场白；'
  + 'creatorNotes=作者注释（勿用 postHistoryInstructions/post_history_instructions）；'
  + 'tags=标签数组；altGreetings=备选开场白数组';

/**
 * 单字段名归一
 * @param {string} key
 * @returns {string|null}
 */
export function normalizeCharacterFieldKey(key) {
  if (key == null) return null;
  var raw = String(key).trim();
  if (!raw) return null;
  if (CHARACTER_CANONICAL_KEYS.indexOf(raw) >= 0) return raw;
  var lower = raw.toLowerCase().replace(/\s+/g, '_');
  if (lower.indexOf('data.') === 0) lower = lower.slice(5);
  return CHARACTER_FIELD_ALIASES[lower] || null;
}

/**
 * 批量归一写入补丁
 * @param {Record<string, unknown>} raw
 * @returns {{ fields: Record<string, unknown>, ignored: string[], mapped: Array<{from:string,to:string}> }}
 */
export function normalizeCharacterPatch(raw) {
  var input = raw && typeof raw === 'object' ? raw : {};
  var canonical = {};
  var ignored = [];
  var mapped = [];

  Object.keys(input).forEach(function(key) {
    var val = input[key];
    var canon = normalizeCharacterFieldKey(key);
    if (!canon) {
      ignored.push(key);
      return;
    }
    if (canon === 'tags' && val != null && !Array.isArray(val)) {
      val = String(val).split(/[,，、]/).map(function(s) { return s.trim(); }).filter(Boolean);
    }
    if (canon === 'altGreetings' && val != null && !Array.isArray(val)) {
      val = [String(val)];
    }
    canonical[canon] = val;
    if (canon !== key) mapped.push({ from: key, to: canon });
  });

  return { fields: canonical, ignored: ignored, mapped: mapped };
}
