/**
 * 附录1：人物卡字段全集（勿删字段）
 * 嵌套结构用于 AI 扩展输出与 YAML 渲染
 *
 * 调色盘三层架构：
 *   第一层·角色核心调色盘（always）：persona_layers / tension_pairs / core_desire
 *   第二层·NSFW 口味（叠加）：desire_palette / sexual_psychology / situational_modulation / aftercare
 *   第三层·NTL 禁忌层（可选叠加）：ntl_taboo_type / 增强 attrs.ntl
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
  'persona_layers',
  'tension_pairs',
  'core_desire',
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

/** 空 NSFW 骨架：身体 / 敏感点 / 性格反差 / XP / 内心 / 调色盘 */
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
    // ======== 调色盘层 ========
    desire_palette: {
      primary_hue: UNMENTIONED,      // 情欲主色调
      primary_intensity: 0.5,
      accent_hue: UNMENTIONED,        // 对比色（与主色调形成张力）
      accent_intensity: 0.5,
      temperature: UNMENTIONED,       // 暖/冷
      texture: UNMENTIONED,           // 丝绒/刀刃/棉布/丝绸/粗粝/尖锐/绵密
      forbidden_tint: null,          // 被压抑的底色，null 表示无
    },
    sexual_psychology: {
      core_desire: UNMENTIONED,      // 通过性想获得什么
      core_fear: UNMENTIONED,        // 最怕什么
      shame_sources: [],
      pride_sources: [],
      desire_expression: UNMENTIONED, // 如何表达欲望（直言/回避/用愤怒掩饰/用照顾伪装）
      arousal_signature: UNMENTIONED, // 情动时的体态信号
      fantasy_vs_reality: UNMENTIONED,// 幻想与实际行为的落差
      attachment_after: UNMENTIONED,  // 亲密后的依恋模式
    },
    situational_modulation: {
      private_safe: { primary: UNMENTIONED, intensity: 0.5 },
      private_charged: { primary: UNMENTIONED, intensity: 0.9 },
      semi_public: { primary: UNMENTIONED, intensity: 0.3 },
      post_conflict: { primary: UNMENTIONED, intensity: 0.7 },
      first_time: { primary: UNMENTIONED, intensity: 0.6 },
    },
    aftercare: {
      needs: [],                      // 需要什么（拥抱/独处/语言确认/清洁/食物）
      emotional_shift: UNMENTIONED,   // 亲密后的情绪变化
      relationship_impact: UNMENTIONED, // 每次亲密对关系是拉近还是推远
    },
  };
}

/** 深合并 NSFW：AI 部分字段覆盖骨架，保留未返回的键 */
function mergeNsfw(base, src) {
  if (!src || typeof src !== 'object') return base;
  var out = Object.assign({}, base);
  Object.keys(src).forEach(function(k) {
    var v = src[k];
    if (v === undefined || v === null) return;
    if (k === 'body' && typeof v === 'object' && !Array.isArray(v)) {
      out.body = Object.assign({}, base.body || {}, v);
    } else if (k === 'Sex_related_traits' && typeof v === 'object' && !Array.isArray(v)) {
      out.Sex_related_traits = Object.assign({}, base.Sex_related_traits || {}, v);
    } else if (k === 'desire_palette' && typeof v === 'object' && !Array.isArray(v)) {
      out.desire_palette = Object.assign({}, base.desire_palette || {}, v);
    } else if (k === 'sexual_psychology' && typeof v === 'object' && !Array.isArray(v)) {
      out.sexual_psychology = Object.assign({}, base.sexual_psychology || {}, v);
    } else if (k === 'situational_modulation' && typeof v === 'object' && !Array.isArray(v)) {
      out.situational_modulation = Object.assign({}, base.situational_modulation || {}, v);
    } else if (k === 'aftercare' && typeof v === 'object' && !Array.isArray(v)) {
      out.aftercare = Object.assign({}, base.aftercare || {}, v);
    } else if (v === '') {
      // Skip empty strings (don't override existing)
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
    persona_layers: {
      surface: UNMENTIONED,       // 陌生人第一印象
      social: UNMENTIONED,        // 社交圈内的形象
      intimate: UNMENTIONED,      // 只对亲密者展示
      under_stress: UNMENTIONED,  // 压力下的底色
      secret_self: UNMENTIONED,   // 自己不愿承认的一面
    },
    tension_pairs: [],            // [{ trait_a, trait_b, resolution }] 内在矛盾引擎
    core_desire: UNMENTIONED,     // 角色最根本的驱动（非性）：被认可/被需要/自由/安全/复仇/归属
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
export function isProfilePlaceholder(val, key) {
  if (val == null || val === '') return true;
  if (typeof val === 'string') {
    var s = val.trim();
    return !s || s === UNMENTIONED;
  }
  if (typeof val === 'number' || typeof val === 'boolean') {
    // desire_palette intensities 和 situational_modulation intensities 的默认值
    // 只有当相关字符串字段也是占位时，才视为整体占位
    return false;
  }
  if (Array.isArray(val)) {
    if (!val.length) return true;
    return val.every(function(v) { return isProfilePlaceholder(v); });
  }
  if (typeof val === 'object') {
    var keys = Object.keys(val);
    if (!keys.length) return true;
    // desire_palette：primary_hue 是占位 → 整个调色盘视为未填写
    if (val.primary_hue !== undefined && isProfilePlaceholder(val.primary_hue)) return true;
    // situational_modulation：所有场景的 primary 都是占位
    if (val.private_safe !== undefined) {
      var hasContent = Object.keys(val).some(function(k) {
        var scene = val[k];
        return scene && typeof scene === 'object' && !isProfilePlaceholder(scene.primary);
      });
      if (!hasContent) return true;
    }
    return keys.every(function(k) { return isProfilePlaceholder(val[k], k); });
  }
  return true;
}

/** 将档案格式化为可读 YAML（跳过未提及/空字段） */
/**
 * @param {object} profile
 * @param {string} [displayName]
 * @param {{ omitNsfw?: boolean }} [opts] omitNsfw=true 时跳过 NSFW_information（用于主角卡面）
 */
export function formatProfileYaml(profile, displayName, opts) {
  opts = opts || {};
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
    if (opts.omitNsfw && field === 'NSFW_information') return;
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
    } else if (field === 'persona_layers' && typeof src[field] === 'object' && !Array.isArray(src[field])) {
      base.persona_layers = Object.assign({}, base.persona_layers, src[field]);
    } else {
      base[field] = src[field];
    }
  });
  // 兼容小写/下划线别名
  if (src.chinese_name && !src['Chinese name']) base['Chinese name'] = src.chinese_name;
  if (src.nickname && !src.Nickname) base.Nickname = src.nickname;
  return base;
}
