/**
 * 附录1：人物卡字段全集（勿删字段）
 * 嵌套结构用于 AI 扩展输出与 YAML 渲染
 */

/** 顶层字段顺序（与附录1一致） */
export const CHARACTER_PROFILE_FIELDS = [
  'Chinese name',
  'Nickname',
  'age',
  'gender',
  'identity',
  'key_events',
  'relationships',
  'turning_points',
  'appearance',
  'personality',
  'values_and_drives',
  'hidden_motives',
  'goals',
  'weakness',
  'likes',
  'dislikes',
  'skills',
  'speech_style',
  'NSFW_information',
];

/** 原文未提及时的占位（仅作空档案骨架；AI 扩展应尽量虚构补全而非保留此占位） */
export const UNMENTIONED = '（原文未提及）';

/** 空 NSFW 骨架：身体 / 敏感点 / 性格反差 / XP / 内心等 */
function emptyNsfwBlock() {
  return {
    body: {
      overall: UNMENTIONED,
      breasts: UNMENTIONED,
      waist_hips: UNMENTIONED,
      genitals: UNMENTIONED,
      other_features: UNMENTIONED,
    },
    erogenous_zones: [],
    sexual_personality: UNMENTIONED,
    contrast: UNMENTIONED,
    xp_kinks: [],
    sensitive_triggers: [],
    inner_erotic_thoughts: UNMENTIONED,
    Sex_related_traits: {
      experiences: UNMENTIONED,
      sexual_orientation: UNMENTIONED,
      sexual_role: UNMENTIONED,
      sexual_habits: [],
    },
    Kinks: [],
    Limits: [],
  };
}

/** 深合并 NSFW：AI 部分字段覆盖骨架，保留未返回的键 */
function mergeNsfw(base, src) {
  if (!src || typeof src !== 'object') return base;
  var out = Object.assign({}, base);
  Object.keys(src).forEach(function(k) {
    var v = src[k];
    if (v === undefined || v === null || v === '') return;
    if (k === 'body' && typeof v === 'object' && !Array.isArray(v)) {
      out.body = Object.assign({}, base.body || {}, v);
    } else if (k === 'Sex_related_traits' && typeof v === 'object' && !Array.isArray(v)) {
      out.Sex_related_traits = Object.assign({}, base.Sex_related_traits || {}, v);
    } else {
      out[k] = v;
    }
  });
  return out;
}

/** @returns {Record<string, unknown>} 空档案骨架 */
export function emptyCharacterProfile(name) {
  return {
    'Chinese name': name || UNMENTIONED,
    Nickname: UNMENTIONED,
    age: UNMENTIONED,
    gender: UNMENTIONED,
    identity: [],
    key_events: [],
    relationships: [],
    turning_points: [],
    appearance: { hair: UNMENTIONED, eyes: UNMENTIONED, build: UNMENTIONED, 识别特征: UNMENTIONED },
    personality: { core_traits: [] },
    values_and_drives: [],
    hidden_motives: [],
    goals: [],
    weakness: [],
    likes: [],
    dislikes: [],
    skills: [],
    speech_style: [],
    NSFW_information: emptyNsfwBlock(),
  };
}

/** 空 / 「原文未提及」/ 全空嵌套 → 落卡时跳过，避免污染主卡 */
export function isProfilePlaceholder(val) {
  if (val == null || val === '') return true;
  if (typeof val === 'string') {
    var s = val.trim();
    return !s || s === UNMENTIONED;
  }
  if (typeof val === 'number' || typeof val === 'boolean') return false;
  if (Array.isArray(val)) {
    if (!val.length) return true;
    return val.every(isProfilePlaceholder);
  }
  if (typeof val === 'object') {
    var keys = Object.keys(val);
    if (!keys.length) return true;
    return keys.every(function(k) { return isProfilePlaceholder(val[k]); });
  }
  return true;
}

/** 将档案格式化为可读 YAML（跳过未提及/空字段） */
export function formatProfileYaml(profile, displayName) {
  var p = profile || emptyCharacterProfile(displayName);
  var title = displayName || p['Chinese name'] || '未命名';
  var cn = p['Chinese name'];
  var lines = [title + ': ' + (!isProfilePlaceholder(cn) ? cn : title)];

  /** @returns {string[]} 有内容时返回行；全空返回 [] */
  function dumpLines(val, indent) {
    var pad = '  '.repeat(indent);
    if (isProfilePlaceholder(val)) return [];
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      return [pad + String(val)];
    }
    if (Array.isArray(val)) {
      var arrOut = [];
      val.forEach(function(item) {
        if (isProfilePlaceholder(item)) return;
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          var keys = Object.keys(item).filter(function(k) { return !isProfilePlaceholder(item[k]); });
          if (!keys.length) return;
          if (keys.length === 1) {
            arrOut.push(pad + '- ' + keys[0] + ': ' + String(item[keys[0]]));
          } else {
            arrOut.push(pad + '-');
            keys.forEach(function(k) {
              var v = item[k];
              if (v && typeof v === 'object') {
                var nested = dumpLines(v, indent + 2);
                if (nested.length) {
                  arrOut.push(pad + '  ' + k + ':');
                  arrOut = arrOut.concat(nested);
                }
              } else {
                arrOut.push(pad + '  ' + k + ': ' + String(v));
              }
            });
          }
        } else {
          arrOut.push(pad + '- ' + String(item));
        }
      });
      return arrOut;
    }
    var objOut = [];
    Object.keys(val).forEach(function(k) {
      var v = val[k];
      if (isProfilePlaceholder(v)) return;
      if (v && typeof v === 'object') {
        var nested = dumpLines(v, indent + 1);
        if (nested.length) {
          objOut.push(pad + k + ':');
          objOut = objOut.concat(nested);
        }
      } else {
        objOut.push(pad + k + ': ' + String(v));
      }
    });
    return objOut;
  }

  CHARACTER_PROFILE_FIELDS.forEach(function(field) {
    // 标题行已含中文名，避免重复
    if (field === 'Chinese name') return;
    var v = p[field];
    if (isProfilePlaceholder(v)) return;
    if (v && typeof v === 'object') {
      var body = dumpLines(v, 2);
      if (!body.length) return;
      lines.push('  ' + field + ':');
      lines = lines.concat(body);
    } else {
      lines.push('  ' + field + ': ' + String(v));
    }
  });
  return lines.join('\n');
}

/** 实体 content 用可读摘要，禁止塞 JSON 截断 */
export function profileContentDigest(profile, displayName, maxLen) {
  maxLen = maxLen || 500;
  var t = formatProfileYaml(profile, displayName).trim();
  if (!t) return '';
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

/** 校验 AI 返回对象是否含附录1字段（缺失则补占位；NSFW 深合并） */
export function normalizeCharacterProfile(raw, name) {
  var base = emptyCharacterProfile(name);
  var src = raw && typeof raw === 'object' ? raw : {};
  CHARACTER_PROFILE_FIELDS.forEach(function(field) {
    if (src[field] === undefined || src[field] === null || src[field] === '') return;
    if (field === 'NSFW_information') {
      base.NSFW_information = mergeNsfw(base.NSFW_information, src[field]);
    } else if (field === 'appearance' && typeof src[field] === 'object' && !Array.isArray(src[field])) {
      base.appearance = Object.assign({}, base.appearance, src[field]);
    } else if (field === 'personality' && typeof src[field] === 'object' && !Array.isArray(src[field])) {
      base.personality = Object.assign({}, base.personality, src[field]);
    } else {
      base[field] = src[field];
    }
  });
  // 兼容小写/下划线别名
  if (src.chinese_name && !src['Chinese name']) base['Chinese name'] = src.chinese_name;
  if (src.nickname && !src.Nickname) base.Nickname = src.nickname;
  return base;
}
