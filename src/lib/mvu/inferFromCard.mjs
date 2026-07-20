/**
 * 从卡内容规则推定 MVU 候选变量（无 AI）
 * 来源：状态栏 design / 恶堕 / 成人层 / 世界书人物 / 基线模块
 * 边界：禁止儿童性化相关字段；成人变量仅在成人层开启时推定。
 */

import {
  STATUS_BAR_EXT_KEY,
  normalizeDesign,
  buildPlaceholderPaths,
  getModuleById,
} from '../statusBar.mjs';
import {
  CORRUPTION_STATUS_LABEL,
  normalizeCorruptionConfig,
  getCorruptionStatusSample,
} from '../corruptionProgress.mjs';

/** @typedef {'string'|'number'|'boolean'|'enum'|'array'|'object'} MvuVarType */

/**
 * @typedef {object} MvuCandidate
 * @property {string} name
 * @property {string} path
 * @property {MvuVarType} type
 * @property {*} initial
 * @property {string} updateHint
 * @property {string} source
 * @property {string[]} [options]
 * @property {number} [min]
 * @property {number} [max]
 * @property {boolean} [alreadyPresent]
 * @property {boolean} [selected]
 */

var CONSENT_OPTIONS = ['可继续', '需确认', '暂停', '停止'];
var RELATION_OPTIONS = ['陌生', '熟人', '朋友', '暧昧', '恋人'];

var FIELD_TYPE_HINTS = {
  好感度: { type: 'number', min: 0, max: 100, initial: 42 },
  好: { type: 'number', min: 0, max: 100, initial: 42 },
  信任: { type: 'number', min: 0, max: 100, initial: 30 },
  体力: { type: 'number', min: 0, max: 100, initial: 78 },
  魔力: { type: 'number', min: 0, max: 100, initial: 55 },
  金钱: { type: 'number', min: 0, initial: 320 },
  快感: { type: 'number', min: 0, max: 100, initial: 0 },
  关系阶段: { type: 'enum', options: RELATION_OPTIONS, initial: '熟人' },
  恶堕进度: { type: 'enum', options: null, initial: null },
  同意边界: { type: 'enum', options: CONSENT_OPTIONS, initial: '需确认' },
};

/**
 * @param {any} cardLike
 * @returns {{
 *   name: string,
 *   description: string,
 *   worldbook: object[],
 *   statusBar: object|null,
 *   mvuDesign: object|null,
 *   adult: object,
 *   corruption: ReturnType<typeof normalizeCorruptionConfig>
 * }}
 */
export function normalizeCardLike(cardLike) {
  var c = cardLike || {};
  var ext = c.extensions && typeof c.extensions === 'object' ? c.extensions : {};
  var wb = c.worldbook || c.wb || c.character_book
    || (c.data && c.data.character_book && c.data.character_book.entries)
    || [];
  if (!Array.isArray(wb) && wb && Array.isArray(wb.entries)) wb = wb.entries;

  var statusBar = c.statusBarDesign || c.statusBar || c.statusbar
    || ext[STATUS_BAR_EXT_KEY] || ext.zmer_statusbar_design || null;
  var mvuDesign = c.mvuDesign || c.mvu || ext.zmer_mvu_design || null;
  if (mvuDesign && mvuDesign.design && Array.isArray(mvuDesign.design.variables)) {
    mvuDesign = mvuDesign.design;
  }

  var adult = c.adultConfig || c.adult || c.nsfwConfig || c.nsfw || {};
  var corruption = normalizeCorruptionConfig(
    c.corruption || {
      enabled: adult.corruptionEnabled,
      preset: adult.corruptionPreset,
      customBrief: adult.corruptionCustomBrief,
      extraNotes: adult.corruptionExtraNotes,
      stageNames: adult.corruptionStageNames,
      selectedNames: adult.corruptionSelectedNames,
      defaultFemaleOnly: adult.corruptionDefaultFemaleOnly,
      syncStatusBar: adult.corruptionSyncStatusBar,
    }
  );

  var name = String(
    c.name || c.charName || (c.data && c.data.name) || ''
  ).trim();

  return {
    name: name,
    description: String(c.description || c.desc || c.charDesc || '').trim(),
    worldbook: Array.isArray(wb) ? wb : [],
    statusBar: statusBar && typeof statusBar === 'object' ? statusBar : null,
    mvuDesign: mvuDesign && typeof mvuDesign === 'object' ? mvuDesign : null,
    adult: adult && typeof adult === 'object' ? adult : {},
    corruption: corruption,
  };
}

function adultEnabled(adult) {
  return !!(adult && (adult.enabled || adult.nsfwEnabled || adult.adultMode));
}

/** 从世界书人物条抽取姓名 */
export function extractWorldbookPersonNames(entries) {
  var list = Array.isArray(entries) ? entries : [];
  var out = [];
  var seen = Object.create(null);
  list.forEach(function(e) {
    if (!e) return;
    var comment = String(e.comment || '').trim();
    var m = comment.match(/^\[(?:小说人物|人物)\]\s*(.+)$/);
    var name = m ? m[1].trim() : '';
    if (!name && Array.isArray(e.keys) && e.keys[0]) {
      // 仅当条目标题像人物档案时才用 keys
      if (/人物|角色|NPC/i.test(comment)) name = String(e.keys[0]).trim();
    }
    if (!name || name.length > 24 || seen[name]) return;
    seen[name] = true;
    out.push(name);
  });
  return out.slice(0, 12);
}

function existingPathSet(mvuDesign) {
  var set = Object.create(null);
  var vars = mvuDesign && Array.isArray(mvuDesign.variables) ? mvuDesign.variables : [];
  vars.forEach(function(v) {
    var p = String((v && (v.path || v.name)) || '').trim();
    if (p) set[p] = true;
  });
  return set;
}

/** 路径是否为恶堕进度变量 */
export function pathLooksLikeCorruptionProgress(path) {
  var p = String(path || '');
  return p.indexOf(CORRUPTION_STATUS_LABEL) >= 0 || /\.corruption_stage$/i.test(p);
}

/**
 * @param {any} cardLike
 * @returns {{ gap: boolean, message: string, missingHint: string }}
 */
export function corruptionProgressGap(cardLike) {
  var n = normalizeCardLike(cardLike);
  if (!n.corruption.enabled) {
    return { gap: false, message: '', missingHint: '' };
  }
  var vars = n.mvuDesign && Array.isArray(n.mvuDesign.variables) ? n.mvuDesign.variables : [];
  var has = vars.some(function(v) {
    return pathLooksLikeCorruptionProgress(v && (v.path || v.name));
  });
  if (has) return { gap: false, message: '', missingHint: '' };
  return {
    gap: true,
    message: '已启用恶堕，但 MVU 尚无「' + CORRUPTION_STATUS_LABEL + '」变量。可用「从卡推定变量」勾选补齐，或到状态栏重新生成。',
    missingHint: CORRUPTION_STATUS_LABEL,
  };
}

function leafName(path) {
  var parts = String(path || '').split('.');
  return parts[parts.length - 1] || path;
}

/**
 * @param {string} path
 * @param {string} [label]
 * @param {{ stageNames?: string[], sample?: string }} [ctx]
 */
export function inferTypeForPath(path, label, ctx) {
  var leaf = leafName(path);
  var name = String(label || leaf);
  var hint = FIELD_TYPE_HINTS[name] || FIELD_TYPE_HINTS[leaf];
  if (leaf === CORRUPTION_STATUS_LABEL || name === CORRUPTION_STATUS_LABEL) {
    var stages = (ctx && ctx.stageNames) || [];
    var sample = (ctx && ctx.sample) || getCorruptionStatusSample(stages);
    return {
      type: 'enum',
      options: stages.length ? stages.slice() : ['未触碰', '动摇', '越界', '沉沦', '彻底恶堕'],
      initial: sample,
      min: undefined,
      max: undefined,
    };
  }
  if (hint) {
    return {
      type: hint.type,
      options: hint.options ? hint.options.slice() : [],
      initial: hint.initial,
      min: hint.min,
      max: hint.max,
    };
  }
  if (/体力|魔力|好感|信任|金钱|进度|等级|快感|欲望/.test(name + leaf)) {
    return { type: 'number', options: [], initial: 50, min: 0, max: 100 };
  }
  return { type: 'string', options: [], initial: '', min: undefined, max: undefined };
}

function defaultUpdateHint(path, type) {
  var leaf = leafName(path);
  if (leaf === CORRUPTION_STATUS_LABEL) {
    return '仅在剧情有明确诱因与心理代价时按阶段表递进；禁止跳阶与儿童性化';
  }
  if (leaf === '同意边界') {
    return '对方明确表态、安全词或场景切换时更新；未确认前不得推进亲密情节';
  }
  if (type === 'number') {
    return '随互动结果增减，保持在合理区间';
  }
  return '随剧情变化自然更新';
}

function sourceForModule(moduleId) {
  var mod = getModuleById(moduleId);
  if (mod) return 'statusbar:' + moduleId;
  return 'statusbar';
}

function pathToModuleId(path) {
  var leaf = leafName(path);
  var map = {
    好感度: 'affection',
    信任: 'trust',
    关系阶段: 'relation_stage',
    恶堕进度: 'corruption_stage',
    情绪: 'emotion',
    行动: 'action',
    着装: 'outfit',
    体力: 'attributes',
    魔力: 'attributes',
    物品: 'items',
    金钱: 'money',
    记忆: 'memory_summary',
    时间: 'time_weather',
    天气: 'time_weather',
    地点: 'location',
    任务: 'quest',
    事件: 'event_chips',
    内心: 'nsfw_thoughts',
    双乳: 'nsfw_breasts',
    小穴: 'nsfw_vagina',
    美腿: 'nsfw_legs',
    美脚: 'nsfw_feet',
    屁穴: 'nsfw_anus',
    口腔: 'nsfw_mouth',
    敏感带: 'nsfw_erogenous',
    快感: 'nsfw_orgasm',
    体液: 'nsfw_fluids',
    露出: 'nsfw_exposure',
    调教: 'nsfw_training',
    性经验: 'nsfw_experience',
    性行为: 'nsfw_act_state',
  };
  return map[leaf] || '';
}

/**
 * 解析用于推定的模块开关与人数
 * @param {ReturnType<typeof normalizeCardLike>} n
 */
function resolveInferContext(n) {
  var sb = n.statusBar ? normalizeDesign(n.statusBar) : null;
  var castMode = sb ? sb.castMode : 'single';
  var mainName = (sb && sb.mainName) || n.name || '角色';
  var characters = sb && Array.isArray(sb.characters) ? sb.characters.slice() : [];
  var nsfw = !!(sb && sb.nsfw) || adultEnabled(n.adult);
  var moduleFlags;

  if (sb && sb.moduleFlags) {
    moduleFlags = Object.assign({}, sb.moduleFlags);
  } else {
    moduleFlags = {
      time_weather: true,
      location: true,
      emotion: true,
      action: true,
      outfit: true,
      affection: true,
      trust: true,
      relation_stage: true,
      attributes: true,
      event_chips: false,
      items: false,
      money: false,
      quest: false,
      memory_summary: false,
    };
  }

  if (n.corruption.enabled) {
    moduleFlags.corruption_stage = true;
    nsfw = true;
  }

  // 多人无勾选人物时：用恶堕选中名或世界书人物补齐
  if (castMode === 'multi') {
    var selected = characters.filter(function(c) { return c && c.selected !== false && c.name; });
    if (!selected.length) {
      var names = n.corruption.selectedNames.length
        ? n.corruption.selectedNames
        : extractWorldbookPersonNames(n.worldbook);
      if (!names.length && mainName) names = [mainName];
      characters = names.map(function(name) {
        return { name: name, selected: true, aliases: [], identity: '', source: 'infer' };
      });
    }
  }

  return {
    castMode: castMode,
    mainName: mainName,
    characters: characters,
    nsfw: nsfw,
    moduleFlags: moduleFlags,
    statusBar: sb,
    stageNames: n.corruption.stageNames,
    stageSample: getCorruptionStatusSample(n.corruption.stageNames),
  };
}

/**
 * @param {object} pathItem
 * @param {object} ctx
 * @param {Record<string, boolean>} existing
 * @returns {MvuCandidate}
 */
function candidateFromPathItem(pathItem, ctx, existing) {
  var path = String(pathItem.path || '').trim();
  var label = String(pathItem.label || leafName(path));
  var typed = inferTypeForPath(path, label, {
    stageNames: ctx.stageNames,
    sample: pathItem.sample || ctx.stageSample,
  });
  var initial = pathItem.sample != null && pathItem.sample !== ''
    ? (typed.type === 'number' ? Number(pathItem.sample) || typed.initial : pathItem.sample)
    : typed.initial;
  if (typed.type === 'enum' && typed.options && typed.options.length) {
    if (typed.options.indexOf(String(initial)) < 0) initial = typed.options[0];
  }
  var modId = pathToModuleId(path);
  return {
    name: label,
    path: path,
    type: typed.type,
    initial: initial,
    updateHint: defaultUpdateHint(path, typed.type),
    source: modId ? sourceForModule(modId) : 'statusbar:path',
    options: typed.options || [],
    min: typed.min,
    max: typed.max,
    alreadyPresent: !!existing[path],
    selected: !existing[path],
  };
}

/**
 * 成人层：同意边界（每视角一份）
 * @param {object} ctx
 * @param {Record<string, boolean>} existing
 * @returns {MvuCandidate[]}
 */
function inferConsentCandidates(ctx, existing) {
  var out = [];
  var names = [];
  if (ctx.castMode === 'multi') {
    names = (ctx.characters || [])
      .filter(function(c) { return c && c.selected !== false && c.name; })
      .map(function(c) { return String(c.name).trim(); });
    if (!names.length) names = [ctx.mainName || '角色'];
  } else {
    names = [ctx.mainName || '角色'];
  }
  names.forEach(function(name) {
    var path = ctx.castMode === 'multi'
      ? ('NPC.' + name + '.同意边界')
      : '角色.同意边界';
    var typed = inferTypeForPath(path, '同意边界');
    out.push({
      name: '同意边界',
      path: path,
      type: typed.type,
      initial: typed.initial,
      updateHint: defaultUpdateHint(path, typed.type),
      source: 'adult:consent',
      options: typed.options || CONSENT_OPTIONS.slice(),
      alreadyPresent: !!existing[path],
      selected: !existing[path],
    });
  });
  return out;
}

/**
 * 衣着状态：若已有着装模块则跳过；否则补一条更语义化的「衣着状态」
 * （着装模块已覆盖时不重复）
 */
function inferOutfitStateIfNeeded(ctx, existing, haveOutfitPath) {
  if (haveOutfitPath || !ctx.moduleFlags.outfit) return [];
  var path = ctx.castMode === 'multi'
    ? ('NPC.' + (ctx.mainName || '角色') + '.衣着状态')
    : '角色.衣着状态';
  if (existing[path]) return [];
  return [{
    name: '衣着状态',
    path: path,
    type: 'string',
    initial: '完整着装',
    updateHint: '更衣、破损、褪去或整理仪容时更新',
    source: 'baseline:outfit_state',
    options: [],
    alreadyPresent: false,
    selected: true,
  }];
}

/**
 * 根据卡内容推定候选变量列表（规则型，可勾选后合并进 design）
 * @param {any} cardLike
 * @returns {MvuCandidate[]}
 */
export function inferMvuCandidatesFromCard(cardLike) {
  var n = normalizeCardLike(cardLike);
  var ctx = resolveInferContext(n);
  var existing = existingPathSet(n.mvuDesign);
  var byPath = Object.create(null);
  /** @type {MvuCandidate[]} */
  var out = [];

  function pushCand(cand) {
    if (!cand || !cand.path || byPath[cand.path]) return;
    // 硬边界：不推定儿童/未成年性化相关字段（只扫 path/name，避免误伤「禁止儿童性化」提示）
    if (/幼女|萝莉|正太|未成年|underage|pedo/i.test(cand.path + '|' + cand.name)) return;
    if (/(?:^|[.\s])儿童(?:$|[.\s])/i.test(cand.path + ' ' + cand.name)) return;
    byPath[cand.path] = true;
    out.push(cand);
  }

  // 1) 已有状态栏 paths → 对齐
  if (ctx.statusBar && Array.isArray(ctx.statusBar.paths) && ctx.statusBar.paths.length) {
    ctx.statusBar.paths.forEach(function(p) {
      if (!p || !p.path) return;
      pushCand(candidateFromPathItem(p, ctx, existing));
    });
  }

  // 2) 按模块占位路径补齐（与状态栏 buildPlaceholderPaths 对齐）
  var placeholders = buildPlaceholderPaths({
    castMode: ctx.castMode,
    mainName: ctx.mainName,
    moduleFlags: ctx.moduleFlags,
    characters: ctx.characters,
  });
  placeholders.forEach(function(p) {
    pushCand(candidateFromPathItem(p, ctx, existing));
  });

  // 3) 成人层：同意边界
  if (adultEnabled(n.adult) || ctx.nsfw) {
    inferConsentCandidates(ctx, existing).forEach(pushCand);
  }

  // 4) 衣着状态兜底（通常已被 outfit 覆盖）
  var haveOutfit = out.some(function(c) { return leafName(c.path) === '着装'; });
  inferOutfitStateIfNeeded(ctx, existing, haveOutfit).forEach(pushCand);

  // 已有变量：默认不勾选，但仍列出便于对照
  out.forEach(function(c) {
    if (existing[c.path]) {
      c.alreadyPresent = true;
      if (c.selected == null) c.selected = false;
    }
  });

  return out;
}

/**
 * @param {MvuCandidate[]} candidates
 * @returns {object[]} MVU design.variables 形状
 */
export function candidatesToVariables(candidates) {
  return (Array.isArray(candidates) ? candidates : []).map(function(c) {
    var item = {
      path: String(c.path || '').trim(),
      type: c.type || 'string',
      default: c.initial,
      description: String(c.name || leafName(c.path)),
      check: c.updateHint ? [String(c.updateHint)] : [],
    };
    if (c.type === 'enum' && Array.isArray(c.options) && c.options.length) {
      item.options = c.options.slice();
    }
    if (c.min != null) item.min = c.min;
    if (c.max != null) item.max = c.max;
    return item;
  }).filter(function(v) { return v.path; });
}

/**
 * 将勾选候选合并进既有 MVU design（按 path upsert）
 * @param {object|null} design
 * @param {MvuCandidate[]} candidates
 * @param {{ selectedPaths?: string[], onlySelected?: boolean }} [opts]
 * @returns {{ variables: object[], summary: string, added: number, updated: number }}
 */
export function mergeCandidatesIntoDesign(design, candidates, opts) {
  var o = opts || {};
  var list = Array.isArray(candidates) ? candidates : [];
  if (o.onlySelected !== false) {
    if (Array.isArray(o.selectedPaths) && o.selectedPaths.length) {
      var allow = Object.create(null);
      o.selectedPaths.forEach(function(p) { allow[String(p)] = true; });
      list = list.filter(function(c) { return allow[c.path]; });
    } else {
      list = list.filter(function(c) { return c.selected !== false; });
    }
  }

  var vars = design && Array.isArray(design.variables) ? design.variables.slice() : [];
  var indexByPath = Object.create(null);
  vars.forEach(function(v, i) {
    var p = String((v && (v.path || v.name)) || '').trim();
    if (p) indexByPath[p] = i;
  });

  var added = 0;
  var updated = 0;
  candidatesToVariables(list).forEach(function(item) {
    var idx = indexByPath[item.path];
    if (idx == null) {
      indexByPath[item.path] = vars.length;
      vars.push(item);
      added += 1;
    } else {
      vars[idx] = Object.assign({}, vars[idx], item);
      updated += 1;
    }
  });

  return {
    variables: vars,
    summary: String((design && design.summary) || '从卡推定合并').slice(0, 80),
    added: added,
    updated: updated,
    source: 'infer_from_card',
  };
}
