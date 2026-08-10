/**
 * 多人状态栏：同套字段模板、MVU 展开、paths 对齐（机制保证，不依赖 AI 自觉）
 */
import { normalizePathItem } from './statusBarCatalog.mjs';

/** @typedef {{ suffix: string, label: string, group: string, sample: string }} CastFieldSpec */

export const CAST_NSFW_FIELD_ROWS = Object.freeze([
  ['nsfw_thoughts', '内心', '隐秘心声'],
  ['nsfw_breasts', '双乳', '柔软'],
  ['nsfw_vagina', '小穴', '湿润'],
  ['nsfw_legs', '美腿', '修长'],
  ['nsfw_feet', '美脚', '轻颤'],
  ['nsfw_anus', '屁穴', '紧致'],
  ['nsfw_mouth', '口腔', '微张'],
  ['nsfw_erogenous', '敏感带', '发烫'],
  ['nsfw_orgasm', '快感', '62'],
  ['nsfw_fluids', '体液', '微量'],
  ['nsfw_exposure', '露出', '低'],
  ['nsfw_training', '调教', '无'],
  ['nsfw_experience', '性经验', '摘要'],
  ['nsfw_act_state', '性行为', '无'],
]);

/**
 * 开启模块 → 每名角色应对齐的同套字段（不含世界/任务/事件）
 * @param {Record<string, boolean>} flags
 * @returns {CastFieldSpec[]}
 */
export function castCharFieldSpecs(flags) {
  var f = flags || {};
  /** @type {CastFieldSpec[]} */
  var out = [];
  function add(suffix, label, group, sample) {
    out.push({ suffix: suffix, label: label, group: group, sample: sample });
  }
  if (f.emotion) add('情绪', '情绪', 'NPC', '平静');
  if (f.action) add('行动', '行动', 'NPC', '闲聊');
  if (f.outfit) add('着装', '着装', 'NPC', '便装');
  if (f.affection) add('好感度', '好感', 'NPC', '42');
  if (f.trust) add('信任', '信任', 'NPC', '30');
  if (f.relation_stage) add('关系阶段', '关系', 'NPC', '熟人');
  if (f.corruption_stage) add('恶堕进度', '恶堕进度', '亲密', '0');
  if (f.affection_stage) add('亲密度', '亲密度', '亲密', '30');
  if (f.attributes) {
    add('体力', '体力', '属性', '78');
    add('魔力', '魔力', '属性', '55');
  }
  if (f.items) add('物品', '物品', 'NPC', '钥匙扣');
  if (f.money) add('金钱', '金钱', 'NPC', '320');
  if (f.memory_summary) add('记忆', '记忆', 'NPC', '初遇约定');
  CAST_NSFW_FIELD_ROWS.forEach(function(row) {
    if (!f[row[0]]) return;
    add(row[1], row[1], '亲密', row[2]);
  });
  return out;
}

/** @param {Record<string, boolean>} flags */
export function globalStatusBarFieldSpecs(flags) {
  var f = flags || {};
  /** @type {CastFieldSpec[]} */
  var out = [];
  function add(path, label, group, sample) {
    out.push({ suffix: path, label: label, group: group, sample: sample });
  }
  if (f.time_weather) {
    add('世界.当前时间', '时间', '世界', '08:30');
    add('世界.天气', '天气', '世界', '晴');
  }
  if (f.location) add('世界.当前地点', '地点', '世界', '咖啡馆');
  if (f.quest) add('任务.当前', '任务', '任务', '调查线索');
  if (f.event_chips) add('事件.标签', '事件', '事件', '同行');
  return out;
}

/** @param {string} path */
export function isGlobalStatusBarPath(path) {
  var p = String(path || '').trim();
  if (!p) return false;
  if (/^NPC\./.test(p)) return false;
  return /^(世界|任务|事件)\./.test(p) || /^角色\./.test(p);
}

/** @param {string} path @returns {{ name: string, suffix: string }|null} */
export function parseNpcVariablePath(path) {
  var p = String(path || '').trim();
  var parts = p.split('.');
  if (parts[0] !== 'NPC' || parts.length < 3) return null;
  return { name: parts[1], suffix: parts.slice(2).join('.') };
}

/** @param {string} name @param {CastFieldSpec} spec */
export function npcPathFor(name, spec) {
  return 'NPC.' + name + '.' + spec.suffix;
}

/**
 * @param {object[]} characters
 * @returns {string[]}
 */
export function selectedCastNames(characters) {
  return (characters || [])
    .filter(function(c) { return c && c.selected !== false && String(c.name || '').trim(); })
    .map(function(c) { return String(c.name).trim(); });
}

/** @param {string} path @returns {string} suffix after 角色. or empty */
export function parseSingleCharacterSuffix(path, mainName) {
  var p = String(path || '').trim();
  var main = String(mainName || '').trim();
  if (p.indexOf('角色.') === 0) return p.slice('角色.'.length);
  if (main && p.indexOf(main + '.') === 0) return p.slice((main + '.').length);
  return '';
}

/**
 * 单人 MVU：仅保留开启模块对应路径（AI 多返的 NSFW/好感等一律剔除）
 */
export function normalizeSingleCastMvuVariables(design, opts) {
  var o = opts || {};
  var flags = o.moduleFlags || {};
  var charSpecs = castCharFieldSpecs(flags);
  var globalSpecs = globalStatusBarFieldSpecs(flags);
  var mainName = String(o.mainName || '角色').trim() || '角色';

  var vars = design && Array.isArray(design.variables) ? design.variables.slice() : [];
  /** @type {Record<string, object>} */
  var protoBySuffix = Object.create(null);
  /** @type {Record<string, object>} */
  var globalByPath = Object.create(null);

  vars.forEach(function(v) {
    var path = String((v && (v.path || v.name)) || '').trim();
    if (!path) return;
    var suffix = parseSingleCharacterSuffix(path, mainName);
    if (suffix) {
      if (/摘要|精简|配角/.test(path + (v.description || ''))) return;
      protoBySuffix[suffix] = v;
      return;
    }
    if (isGlobalStatusBarPath(path) || globalSpecs.some(function(g) { return g.suffix === path; })) {
      globalByPath[path] = v;
    }
  });

  /** @type {object[]} */
  var next = [];

  globalSpecs.forEach(function(g) {
    var path = g.suffix;
    var base = globalByPath[path];
    next.push(Object.assign({}, base || {}, {
      path: path,
      type: (base && base.type) || 'string',
      default: base && base.default != null ? base.default : g.sample,
      description: (base && (base.description || base.label)) || g.label,
    }));
  });

  charSpecs.forEach(function(spec) {
    var path = '角色.' + spec.suffix;
    var proto = protoBySuffix[spec.suffix] || {};
    var hit = vars.find(function(v) {
      return String((v && (v.path || v.name)) || '') === path;
    });
    next.push(Object.assign({}, proto, hit || {}, {
      path: path,
      type: (hit && hit.type) || proto.type || 'string',
      default: hit && hit.default != null ? hit.default
        : (proto.default != null ? proto.default : spec.sample),
      description: (hit && (hit.description || hit.label))
        || (proto.description || proto.label) || spec.label,
      check: (hit && hit.check) || proto.check || ['剧情推进时更新'],
    }));
  });

  if (!next.length) return design;

  return Object.assign({}, design, {
    variables: next,
    summary: String(design.summary || '状态栏生成的变量设计').slice(0, 80),
  });
}

/**
 * 按当前模块开关裁剪 MVU（单人/多人统一入口，写入前必过）
 */
export function pruneStatusBarMvuDesign(design, opts) {
  var o = opts || {};
  if (o.castMode === 'multi') {
    return normalizeMultiCastMvuVariables(design, o);
  }
  return normalizeSingleCastMvuVariables(design, o);
}

/**
 * 多人 MVU：按模块模板为每名入选角色展开完整 NPC.* 变量
 * @param {{ summary?: string, variables?: object[] }} design
 * @param {{ characters?: object[], moduleFlags?: Record<string, boolean>, mainName?: string }} opts
 */
export function normalizeMultiCastMvuVariables(design, opts) {
  var o = opts || {};
  var names = selectedCastNames(o.characters);
  if (!names.length) return design;

  var flags = o.moduleFlags || {};
  var charSpecs = castCharFieldSpecs(flags);
  var globalSpecs = globalStatusBarFieldSpecs(flags);
  var mainName = String(o.mainName || names[0] || '').trim();

  var vars = design && Array.isArray(design.variables) ? design.variables.slice() : [];
  /** @type {Record<string, object>} */
  var protoBySuffix = Object.create(null);
  /** @type {Record<string, object>} */
  var globalByPath = Object.create(null);

  vars.forEach(function(v) {
    var path = String((v && (v.path || v.name)) || '').trim();
    if (!path) return;
    var npc = parseNpcVariablePath(path);
    if (npc) {
      if (/摘要|精简|配角/.test(path + (v.description || ''))) return;
      if (!protoBySuffix[npc.suffix] || npc.name === mainName) {
        protoBySuffix[npc.suffix] = v;
      }
      return;
    }
    if (isGlobalStatusBarPath(path) || globalSpecs.some(function(g) { return g.suffix === path; })) {
      globalByPath[path] = v;
    }
  });

  /** @type {object[]} */
  var next = [];

  globalSpecs.forEach(function(g) {
    var path = g.suffix;
    var base = globalByPath[path];
    next.push(Object.assign({}, base || {}, {
      path: path,
      type: (base && base.type) || 'string',
      default: base && base.default != null ? base.default : g.sample,
      description: (base && (base.description || base.label)) || g.label,
    }));
  });

  charSpecs.forEach(function(spec) {
    var proto = protoBySuffix[spec.suffix] || {};
    names.forEach(function(name) {
      var path = npcPathFor(name, spec);
      var hit = vars.find(function(v) {
        return String((v && (v.path || v.name)) || '') === path;
      });
      next.push(Object.assign({}, proto, hit || {}, {
        path: path,
        type: (hit && hit.type) || proto.type || 'string',
        default: hit && hit.default != null ? hit.default
          : (proto.default != null ? proto.default : spec.sample),
        description: (hit && (hit.description || hit.label))
          || (proto.description || proto.label) || spec.label,
        check: (hit && hit.check) || proto.check || ['剧情推进时更新'],
      }));
    });
  });

  if (!next.length) return design;

  return Object.assign({}, design, {
    variables: next,
    summary: String(design.summary || '多人同套状态栏变量').slice(0, 80),
  });
}

/**
 * 多人 paths 与占位模板对齐（预览/注入同一路径）
 * @param {import('./statusBarCatalog.mjs').PathItem[]} paths
 * @param {{ castMode?: string, characters?: object[], moduleFlags?: Record<string, boolean>, mainName?: string }} opts
 */
export function alignCastPaths(paths, opts) {
  var o = opts || {};
  var flags = o.moduleFlags || {};
  var charSpecs = castCharFieldSpecs(flags);
  var globalSpecs = globalStatusBarFieldSpecs(flags);
  /** @type {Record<string, import('./statusBarCatalog.mjs').PathItem>} */
  var byPath = Object.create(null);
  (paths || []).forEach(function(p) {
    if (!p || !p.path) return;
    var n = normalizePathItem(p);
    if (n.path) byPath[n.path] = n;
  });

  /** @type {import('./statusBarCatalog.mjs').PathItem[]} */
  var out = [];

  globalSpecs.forEach(function(g) {
    var path = g.suffix;
    var hit = byPath[path];
    out.push(normalizePathItem({
      path: path,
      label: (hit && hit.label) || g.label,
      group: g.group,
      sample: (hit && hit.sample != null) ? hit.sample : g.sample,
      role: '',
    }));
  });

  if (o.castMode === 'multi') {
    var names = selectedCastNames(o.characters);
    var main = String(o.mainName || names[0] || '角色').trim() || '角色';
    if (!names.length) names = [main];

    names.forEach(function(name) {
      charSpecs.forEach(function(spec) {
        var path = npcPathFor(name, spec);
        var hit = byPath[path];
        out.push(normalizePathItem({
          path: path,
          label: (hit && hit.label) || spec.label,
          group: spec.group,
          sample: (hit && hit.sample != null) ? hit.sample : spec.sample,
          role: name,
        }));
      });
    });

    if (!out.length) {
      out.push(normalizePathItem({ path: '世界.当前时间', label: '时间', group: '世界', sample: '08:30' }));
      names.forEach(function(name) {
        out.push(normalizePathItem({
          path: 'NPC.' + name + '.情绪',
          label: '情绪',
          group: 'NPC',
          sample: '平静',
          role: name,
        }));
      });
    }
    return out;
  }

  var mainName = String(o.mainName || '角色').trim() || '角色';
  charSpecs.forEach(function(spec) {
    var path = '角色.' + spec.suffix;
    var hit = byPath[path];
    var group = spec.group === 'NPC' ? '角色' : spec.group;
    out.push(normalizePathItem({
      path: path,
      label: (hit && hit.label) || spec.label,
      group: group,
      sample: (hit && hit.sample != null) ? hit.sample : spec.sample,
      role: mainName,
    }));
  });

  if (!out.length) {
    out.push(normalizePathItem({ path: '世界.当前时间', label: '时间', group: '世界', sample: '08:30' }));
    out.push(normalizePathItem({
      path: '角色.情绪',
      label: '情绪',
      group: '角色',
      sample: '平静',
      role: mainName,
    }));
  }
  return out;
}

/**
 * @param {{ castMode?: string, paths?: object[], characters?: object[], moduleFlags?: Record<string, boolean>, mainName?: string, presetId?: string, nsfw?: boolean }} state
 * @param {{ resolveModuleFlags?: Function, buildPlaceholderPaths?: Function }} helpers
 */
export function resolveStatusBarPaths(state, helpers) {
  var h = helpers || {};
  var castMode = state && state.castMode === 'multi' ? 'multi' : 'single';
  var resolveFlags = h.resolveModuleFlags;
  var buildPh = h.buildPlaceholderPaths;
  var flags = state.moduleFlags || {};
  if (resolveFlags && state.presetId != null) {
    flags = resolveFlags(state.presetId, state.moduleFlags, !!state.nsfw);
  }
  var baseOpts = {
    castMode: castMode,
    mainName: state.mainName || '角色',
    moduleFlags: flags,
    characters: state.characters,
  };
  var raw = (state.paths && state.paths.length)
    ? state.paths.map(normalizePathItem).filter(function(p) { return p.path; })
    : (buildPh ? buildPh(baseOpts) : []);
  return alignCastPaths(raw, baseOpts);
}

/**
 * 自定义排版提示：同套路径矩阵（禁止主详配简）
 * @param {import('./statusBarCatalog.mjs').PathItem[]} paths
 * @param {object[]} characters
 * @param {Record<string, boolean>} [moduleFlags]
 */
export function formatCastPathMatrix(paths, characters, moduleFlags) {
  var names = selectedCastNames(characters);
  if (!names.length) {
    return (paths || []).map(function(p) {
      return '- ' + p.path + ' | ' + p.label;
    }).join('\n') || '（无）';
  }
  var aligned = alignCastPaths(paths, {
    castMode: 'multi',
    characters: characters,
    moduleFlags: moduleFlags || {},
    mainName: names[0],
  });
  var globals = aligned.filter(function(p) { return !p.role; });
  var lines = ['【全球段（一份）】'];
  globals.forEach(function(p) {
    lines.push('- ' + p.path + ' | ' + p.label + ' | sample:' + (p.sample || '—'));
  });
  lines.push('');
  lines.push('【每位角色须相同字段集合；HTML 结构须复制同套，仅改路径中的姓名段】');
  names.forEach(function(name) {
    lines.push('— ' + name + ' —');
    aligned.filter(function(p) { return p.role === name; }).forEach(function(p) {
      lines.push('  ' + p.path + ' | ' + p.label);
    });
  });
  return lines.join('\n');
}
