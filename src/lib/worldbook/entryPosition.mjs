/**
 * 世界书插入位置：界面用 0–6，角色卡 JSON 用 SillyTavern 字符串。
 * 社区卡通常只写 position 字符串；本工具旧导出曾把字符串固定成 before_char，
 * 真实槽位放在 extensions.position。两者不一致时，以 extensions.position 为准。
 */

var POS_TO_STRING = [
  'before_char',
  'after_char',
  'an_top',
  'an_bottom',
  'at_depth',
  'em_top',
  'em_bottom',
];

var STRING_TO_POS = {
  before_char: 0,
  before_char_definition: 0,
  before: 0,
  after_char: 1,
  after: 1,
  an_top: 2,
  an_bottom: 3,
  at_depth: 4,
  em_top: 5,
  em_bottom: 6,
};

function clampPos(n) {
  var v = parseInt(n, 10);
  if (isNaN(v)) return 1;
  if (v < 0) return 0;
  if (v > 6) return 6;
  return v;
}

export function positionToSpecString(n) {
  return POS_TO_STRING[clampPos(n)];
}

/**
 * @param {object} raw 草稿条目或角色卡 character_book 条目
 * @returns {number} 0–6
 */
export function resolveEntryPosition(raw) {
  raw = raw || {};
  var ext = raw.extensions && typeof raw.extensions === 'object' ? raw.extensions : {};
  var extPos = ext.position;
  var pos = raw.position;
  if (typeof pos === 'string') {
    var key = pos.trim();
    var mapped = STRING_TO_POS[key];
    if (mapped != null) {
      if (key === 'before_char' && typeof extPos === 'number' && !isNaN(extPos) && extPos !== 0) {
        return clampPos(extPos);
      }
      return mapped;
    }
  }
  if (typeof pos === 'number' && !isNaN(pos)) return clampPos(pos);
  if (typeof extPos === 'number' && !isNaN(extPos)) return clampPos(extPos);
  return 1;
}
