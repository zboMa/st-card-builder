/**
 * 恶堕进度：阶段预设、世界书总则/档案、导出检查、性别筛选
 *
 * 结构：1 条「恶堕进度总则」+ 每角色 1 条「恶堕档案·{名}」（阶段全写在一条内）
 * 当前阶段由状态栏/MVU 变量「恶堕进度」指向，不靠多条目 key 匹配。
 */
import {
  CORRUPTION_WB_CHARS,
  CORRUPTION_BRIEF_CHARS,
} from './novel/contextBudgets.mjs';

export var CORRUPTION_RULES_COMMENT = '恶堕进度总则';
export var CORRUPTION_ARCHIVE_PREFIX = '恶堕档案·';
export var CORRUPTION_STATUS_MODULE_ID = 'corruption_stage';
export var CORRUPTION_STATUS_LABEL = '恶堕进度';
export var DEFAULT_CORRUPTION_PRESET = '5';
export var CORRUPTION_STAGE_MIN = 2;
export var CORRUPTION_STAGE_MAX = 9;

export var CORRUPTION_PRESETS = {
  '3': {
    id: '3',
    label: '简洁',
    stages: ['未触碰', '动摇', '沉沦'],
  },
  '5': {
    id: '5',
    label: '标准',
    stages: ['未触碰', '动摇', '越界', '沉沦', '彻底恶堕'],
  },
  '7': {
    id: '7',
    label: '细腻',
    stages: ['未触碰', '试探', '动摇', '合理化', '越界', '沉溺', '彻底恶堕'],
  },
  custom: {
    id: 'custom',
    label: '自定义',
    stages: [],
  },
};

export var CORRUPTION_PRESET_IDS = Object.keys(CORRUPTION_PRESETS);

var STAGE_SECTION_HINTS = [
  '心理状态',
  '性格与价值观偏移',
  '言行与反差',
  '对亲密对象态度',
  '欲望与边界变化',
  '扮演注意',
];

function asTrimmedList(v) {
  if (!Array.isArray(v)) return [];
  var out = [];
  var seen = Object.create(null);
  v.forEach(function(x) {
    var s = String(x == null ? '' : x).trim();
    if (!s || seen[s]) return;
    seen[s] = true;
    out.push(s);
  });
  return out;
}

/**
 * @param {object} [cfg]
 * @returns {{
 *   enabled: boolean,
 *   preset: string,
 *   customBrief: string,
 *   stageNames: string[],
 *   selectedNames: string[],
 *   defaultFemaleOnly: boolean,
 *   syncStatusBar: boolean
 * }}
 */
export function normalizeCorruptionConfig(cfg) {
  var c = cfg || {};
  var preset = String(c.preset || c.corruptionPreset || DEFAULT_CORRUPTION_PRESET);
  if (!CORRUPTION_PRESETS[preset]) preset = DEFAULT_CORRUPTION_PRESET;
  var stageNames = resolveStageNames(preset, c.stageNames || c.corruptionStageNames, c.customBrief || c.corruptionCustomBrief);
  return {
    enabled: !!(c.enabled != null ? c.enabled : c.corruptionEnabled),
    preset: preset,
    customBrief: String(c.customBrief != null ? c.customBrief : (c.corruptionCustomBrief || '')).trim(),
    stageNames: stageNames,
    selectedNames: asTrimmedList(c.selectedNames || c.corruptionSelectedNames),
    defaultFemaleOnly: c.defaultFemaleOnly !== false && c.corruptionDefaultFemaleOnly !== false,
    syncStatusBar: c.syncStatusBar !== false && c.corruptionSyncStatusBar !== false,
  };
}

/**
 * @param {string} preset
 * @param {string[]|string} [customNames]
 * @param {string} [customBrief] 未提供 names 时，尝试从描述按行/顿号拆阶段名
 */
export function resolveStageNames(preset, customNames, customBrief) {
  var p = String(preset || DEFAULT_CORRUPTION_PRESET);
  if (p !== 'custom' && CORRUPTION_PRESETS[p] && CORRUPTION_PRESETS[p].stages.length) {
    return CORRUPTION_PRESETS[p].stages.slice();
  }
  var fromArr = asTrimmedList(customNames);
  if (fromArr.length >= CORRUPTION_STAGE_MIN) {
    return fromArr.slice(0, CORRUPTION_STAGE_MAX);
  }
  var parsed = parseStageNamesFromText(customBrief || '');
  if (parsed.length >= CORRUPTION_STAGE_MIN) return parsed.slice(0, CORRUPTION_STAGE_MAX);
  return CORRUPTION_PRESETS['5'].stages.slice();
}

/** 从自由文本粗解析阶段名（无 AI 时的兜底） */
export function parseStageNamesFromText(text) {
  var t = String(text || '').trim();
  if (!t) return [];
  try {
    var jsonMatch = t.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      var data = JSON.parse(jsonMatch[0]);
      if (Array.isArray(data)) return asTrimmedList(data).slice(0, CORRUPTION_STAGE_MAX);
      if (data && Array.isArray(data.stages)) return asTrimmedList(data.stages).slice(0, CORRUPTION_STAGE_MAX);
      if (data && Array.isArray(data.stageNames)) return asTrimmedList(data.stageNames).slice(0, CORRUPTION_STAGE_MAX);
    }
  } catch (e) { /* ignore */ }

  var lines = t.split(/\n+/).map(function(l) { return l.trim(); }).filter(Boolean);
  var fromLines = [];
  lines.forEach(function(line) {
    var m = line.match(/^(?:\d+[\.\)、\s]+|[-*·]\s*|第?[一二三四五六七八九十\d]+[阶阶段步]?[：:\s]+)(.+)$/);
    var name = (m ? m[1] : line).replace(/^【|】$/g, '').trim();
    if (name && name.length <= 16 && !/[。；;]/.test(name)) fromLines.push(name);
  });
  if (fromLines.length >= CORRUPTION_STAGE_MIN) return asTrimmedList(fromLines).slice(0, CORRUPTION_STAGE_MAX);

  var parts = t.split(/[→➞➡><\/／/|｜、,，]+/).map(function(s) { return s.trim(); }).filter(Boolean);
  if (parts.length >= CORRUPTION_STAGE_MIN && parts.every(function(p) { return p.length <= 16; })) {
    return asTrimmedList(parts).slice(0, CORRUPTION_STAGE_MAX);
  }
  return [];
}

export function parseStageNamesFromAiText(text) {
  return parseStageNamesFromText(text);
}

export function archiveComment(charName) {
  var n = String(charName || '').trim() || '未命名';
  return CORRUPTION_ARCHIVE_PREFIX + n;
}

export function isCorruptionRulesComment(comment) {
  return String(comment || '').trim() === CORRUPTION_RULES_COMMENT;
}

export function isCorruptionArchiveComment(comment) {
  return String(comment || '').trim().indexOf(CORRUPTION_ARCHIVE_PREFIX) === 0;
}

export function isFemaleGender(gender) {
  var g = String(gender == null ? '' : gender).trim().toLowerCase();
  if (!g || g === '未提及' || g === '原文未提及' || g === '（原文未提及）' || g === 'n/a') return false;
  if (/^(f|female|woman|girl|she|her)$/i.test(g)) return true;
  if (/女|雌|娘|少女|女性|女孩子|姑娘/.test(g) && !/男|雄/.test(g)) return true;
  return false;
}

export function isMaleGender(gender) {
  var g = String(gender == null ? '' : gender).trim().toLowerCase();
  if (!g || g === '未提及' || g === '原文未提及' || g === '（原文未提及）' || g === 'n/a') return false;
  if (/^(m|male|man|boy|he|him)$/i.test(g)) return true;
  if (/男|雄|少年|男性|男孩子/.test(g) && !/女|雌/.test(g)) return true;
  return false;
}

/**
 * @param {Array<{name:string, aliases?:string[], gender?:string, selected?:boolean}>} candidates
 * @param {{ defaultFemaleOnly?: boolean, selectedNames?: string[], includeUnknown?: boolean }} [opts]
 */
export function pickCorruptionTargets(candidates, opts) {
  var o = opts || {};
  var defaultFemaleOnly = o.defaultFemaleOnly !== false;
  var selectedNames = asTrimmedList(o.selectedNames);
  var includeUnknown = !!o.includeUnknown;
  var list = Array.isArray(candidates) ? candidates : [];
  var out = [];

  list.forEach(function(c) {
    if (!c) return;
    var name = String(c.name || '').trim();
    if (!name) return;
    var gender = c.gender;
    var male = isMaleGender(gender);
    var female = isFemaleGender(gender);
    var unknown = !male && !female;
    var defaultOn = false;
    if (selectedNames.length) {
      defaultOn = selectedNames.indexOf(name) >= 0;
    } else if (defaultFemaleOnly) {
      if (female) defaultOn = true;
      else if (unknown && includeUnknown) defaultOn = true;
      else defaultOn = false;
    } else {
      defaultOn = c.selected !== false;
    }
    out.push({
      name: name,
      aliases: asTrimmedList(c.aliases),
      gender: gender == null ? '' : String(gender),
      male: male,
      female: female,
      unknown: unknown,
      selected: defaultOn,
    });
  });
  return out;
}

export function buildRulesContent(stageNames) {
  var stages = asTrimmedList(stageNames);
  if (stages.length < CORRUPTION_STAGE_MIN) stages = CORRUPTION_PRESETS['5'].stages.slice();
  var lines = [];
  lines.push('【恶堕进度总则】');
  lines.push('本卡使用状态栏/MVU 变量「' + CORRUPTION_STATUS_LABEL + '」标记每位适用角色的当前阶段。');
  lines.push('扮演时：只采用该角色「' + CORRUPTION_ARCHIVE_PREFIX + '」条目中与当前变量值对应的阶段内容，禁止混用其他阶段的性格/心理/反差。');
  lines.push('推进原则：通常按下列阶梯渐进，勿无铺垫跳阶；若剧情需要加速，须在叙事中给出明确诱因与心理代价。');
  lines.push('');
  lines.push('阶段表（共 ' + stages.length + ' 阶）：');
  stages.forEach(function(s, i) {
    lines.push((i + 1) + '. ' + s);
  });
  lines.push('');
  lines.push('变量合法取值：' + stages.join(' / '));
  lines.push('初始建议：' + stages[0]);
  lines.push('男角色默认不启用恶堕档案，除非世界书中存在对应「' + CORRUPTION_ARCHIVE_PREFIX + '」条目。');
  return lines.join('\n');
}

export function buildArchiveContentTemplate(charName, stageNames) {
  var name = String(charName || '').trim() || '角色';
  var stages = asTrimmedList(stageNames);
  if (stages.length < CORRUPTION_STAGE_MIN) stages = CORRUPTION_PRESETS['5'].stages.slice();
  var lines = [];
  lines.push('【' + name + ' · 恶堕档案】');
  lines.push('【读取状态栏/MVU「' + CORRUPTION_STATUS_LABEL + '」；仅采用与当前值对应的阶段，禁止混用其他阶段】');
  lines.push('');
  stages.forEach(function(stage) {
    lines.push('## ' + stage);
    STAGE_SECTION_HINTS.forEach(function(h) {
      lines.push('- ' + h + '：（待填充）');
    });
    lines.push('');
  });
  return lines.join('\n').trim() + '\n';
}

export function buildCustomStagesSystemPrompt() {
  return [
    '你是角色卡恶堕进度设计师。根据用户对堕落弧光的描述，产出 2-9 个阶段名。',
    '要求：阶段名短（≤8字）、可递增、可写入状态栏枚举；不要解释。',
    '只输出 JSON：{ "stages": ["阶段1", "阶段2", ...] }',
  ].join('\n');
}

export function buildCustomStagesUserPrompt(brief) {
  return '弧光描述：\n' + String(brief || '').trim();
}

/** 每阶段最低汉字量（门禁） */
export var CORRUPTION_MIN_CHARS_PER_STAGE = 220;
/** 每阶段目标区间（提示词） */
export var CORRUPTION_TARGET_CHARS_PER_STAGE = { min: 220, max: 400 };

export function buildArchiveSystemPrompt() {
  return [
    '你是角色卡世界书作者，专写「恶堕进度」分期人物说明（面向世界书 NPC，不是主角卡面 Description）。',
    '为单一角色生成一条完整世界书正文：包含全部阶段，每阶段用 Markdown ## 标题（标题须与阶段表完全一致）。',
    '每阶段必须写成可直接扮演的丰满段落，覆盖并写透：',
    '1) 心理状态与自我叙事 2) 性格/价值观如何偏移 3) 言行举止与反差细节（含口头禅或习惯动作）',
    '4) 对旧关系/亲密对象的态度变化 5) 欲望、边界与禁忌的松动 6) 扮演注意（本阶段可做/禁做）。',
    '字数：每一阶段正文 ' + CORRUPTION_TARGET_CHARS_PER_STAGE.min + '-' + CORRUPTION_TARGET_CHARS_PER_STAGE.max + ' 字（不含标题）；禁止提纲、空话、（待填充）、一笔带过。',
    '相邻阶段必须可感知递进，禁止跳阶或阶段之间复制粘贴。',
    '只输出世界书正文（不要 JSON、不要前言后记）。',
  ].join('\n');
}

export function buildArchiveExpandSystemPrompt() {
  return [
    '你是角色卡世界书扩写编辑。下文恶堕档案过薄，请在保持阶段标题不变的前提下大幅加厚每一阶段。',
    '每阶段扩写到 ' + CORRUPTION_TARGET_CHARS_PER_STAGE.min + '-' + CORRUPTION_TARGET_CHARS_PER_STAGE.max + ' 字，补足心理、反差、口头禅、边界与可演细节。',
    '禁止删除阶段；禁止输出（待填充）；只输出完整正文。',
  ].join('\n');
}

/**
 * @param {{ charName: string, stageNames: string[], worldbookContent?: string, identity?: string, customBrief?: string, nsfwFlavorHint?: string, ntlHint?: string }} opts
 */
export function buildArchiveUserPrompt(opts) {
  var o = opts || {};
  var stages = asTrimmedList(o.stageNames);
  var parts = [];
  parts.push('角色名：' + String(o.charName || '').trim());
  if (o.identity) parts.push('身份：' + String(o.identity).trim());
  if (o.worldbookContent) {
    parts.push('【该角色世界书人物设定——必须据此写恶堕，禁止写成另一人或主角】\n'
      + String(o.worldbookContent).trim().slice(0, CORRUPTION_WB_CHARS));
  } else {
    parts.push('【警告】未提供该角色世界书正文，请仍按角色名写出丰满分期，但勿编造与已知卡面冲突的设定。');
  }
  if (o.customBrief) parts.push('弧光补充：\n' + String(o.customBrief).trim().slice(0, CORRUPTION_BRIEF_CHARS));
  if (o.nsfwFlavorHint) parts.push(String(o.nsfwFlavorHint).trim());
  if (o.ntlHint) parts.push(String(o.ntlHint).trim());
  if (o.canonDigest) parts.push(String(o.canonDigest).trim());
  if (o.siblingArchivesHint) parts.push(String(o.siblingArchivesHint).trim());
  parts.push('阶段表（须全部写出，## 标题与下列完全一致）：\n' + stages.map(function(s, i) {
    return (i + 1) + '. ' + s;
  }).join('\n'));
  parts.push('正文开头须含：【读取状态栏/MVU「' + CORRUPTION_STATUS_LABEL + '」；仅采用与当前值对应的阶段，禁止混用其他阶段】');
  parts.push('须与已有人物成人层/其他恶堕档案气质可对读，禁止互相打架或孤立无互动。');
  return parts.join('\n\n');
}

/**
 * 从世界书条目中解析某角色的人物正文（排除恶堕档案本身）
 * @param {Array<object>} entries
 * @param {string} charName
 * @returns {{ content: string, comment: string, aliases: string[] }|null}
 */
export function findWorldbookPersonContext(entries, charName) {
  var name = String(charName || '').trim();
  if (!name) return null;
  var list = Array.isArray(entries) ? entries : [];
  var nameLower = name.toLowerCase();
  var best = null;

  function scoreEntry(e) {
    if (!e || isCorruptionRulesComment(e.comment) || isCorruptionArchiveComment(e.comment)) return -1;
    var comment = String(e.comment || '').trim();
    var content = String(e.content || '').trim();
    if (!content) return -1;
    // 优先人物条；非人物条大幅降权
    var isPerson = comment.indexOf('[小说人物]') === 0 || comment.indexOf('[人物]') === 0;
    var keys = Array.isArray(e.keys) ? e.keys.map(function(k) { return String(k || '').trim(); }) : [];
    var s = isPerson ? 20 : -5;
    if (comment === '[小说人物] ' + name || comment === '[人物] ' + name) s += 100;
    if (isPerson && comment.indexOf(name) >= 0) s += 40;
    if (keys.some(function(k) { return k === name || k.toLowerCase() === nameLower; })) s += isPerson ? 50 : 5;
    if (content.indexOf(name) >= 0) s += isPerson ? 10 : 1;
    return s;
  }

  list.forEach(function(e) {
    var sc = scoreEntry(e);
    if (sc <= 0) return;
    if (!best || sc > best._score) {
      best = {
        content: String(e.content || ''),
        comment: String(e.comment || ''),
        aliases: Array.isArray(e.keys) ? e.keys.slice() : [],
        _score: sc,
      };
    }
  });
  if (!best) return null;
  delete best._score;
  return best;
}

/**
 * @param {string} content
 * @param {string[]} stageNames
 * @returns {{ ok: boolean, perStage: Record<string, number>, total: number, weakStages: string[] }}
 */
export function evaluateArchiveRichness(content, stageNames) {
  var stages = asTrimmedList(stageNames);
  var text = String(content || '');
  var perStage = Object.create(null);
  var weakStages = [];
  var total = text.replace(/\s+/g, '').length;

  stages.forEach(function(stage, idx) {
    var re = new RegExp(
      '##\\s*' + stage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\n([\\s\\S]*?)(?=\\n##\\s*|$)',
      'i'
    );
    var m = text.match(re);
    var body = m ? m[1] : '';
    if (!body && idx === 0) body = text;
    var n = String(body || '').replace(/\s+/g, '').length;
    perStage[stage] = n;
    if (n < CORRUPTION_MIN_CHARS_PER_STAGE) weakStages.push(stage);
  });

  if (/待填充|（待填充）|TODO|TBD/i.test(text)) {
    stages.forEach(function(s) {
      if (weakStages.indexOf(s) < 0) weakStages.push(s);
    });
  }

  return {
    ok: weakStages.length === 0 && total >= stages.length * CORRUPTION_MIN_CHARS_PER_STAGE,
    perStage: perStage,
    total: total,
    weakStages: weakStages,
  };
}

/**
 * @param {Array<object>} entries
 * @param {object} entry  { comment, content, keys?, strategy?, ... }
 * @returns {object[]} 新数组
 */
export function upsertWorldbookByComment(entries, entry) {
  var list = Array.isArray(entries) ? entries.slice() : [];
  var e = entry || {};
  var comment = String(e.comment || '').trim();
  if (!comment) return list;
  var next = {
    comment: comment,
    content: String(e.content || ''),
    keys: Array.isArray(e.keys) ? e.keys.slice() : [],
    strategy: e.strategy === 'constant' || e.strategy === 'vectorized' ? e.strategy : 'selective',
    position: e.position != null ? e.position : 4,
    depth: e.depth != null ? e.depth : 4,
    role: e.role != null ? e.role : 0,
    order: e.order != null ? e.order : 100,
    prob: e.prob != null ? e.prob : 100,
    enabled: e.enabled !== false,
  };
  var idx = -1;
  for (var i = 0; i < list.length; i++) {
    if (list[i] && String(list[i].comment || '').trim() === comment) {
      idx = i;
      break;
    }
  }
  if (idx >= 0) {
    list[idx] = Object.assign({}, list[idx], next);
  } else {
    list.push(next);
  }
  return list;
}

export function buildRulesWorldbookEntry(stageNames) {
  return {
    comment: CORRUPTION_RULES_COMMENT,
    content: buildRulesContent(stageNames),
    keys: [],
    strategy: 'constant',
    position: 0,
    depth: 4,
    role: 0,
    order: 10,
    prob: 100,
    enabled: true,
  };
}

export function buildArchiveWorldbookEntry(charName, content, aliases) {
  var name = String(charName || '').trim() || '未命名';
  var keys = asTrimmedList([name].concat(aliases || []));
  return {
    comment: archiveComment(name),
    content: String(content || '').trim() || buildArchiveContentTemplate(name, CORRUPTION_PRESETS['5'].stages),
    keys: keys,
    strategy: 'selective',
    position: 4,
    depth: 4,
    role: 0,
    order: 100,
    prob: 100,
    enabled: true,
  };
}

/**
 * @param {Array<object>} entries
 * @returns {{ rules: object|null, archives: object[] }}
 */
export function findCorruptionEntries(entries) {
  var list = Array.isArray(entries) ? entries : [];
  var rules = null;
  var archives = [];
  list.forEach(function(e) {
    if (!e) return;
    if (isCorruptionRulesComment(e.comment)) rules = e;
    else if (isCorruptionArchiveComment(e.comment)) archives.push(e);
  });
  return { rules: rules, archives: archives };
}

/**
 * 导出检查附加项
 * @param {{ enabled: boolean, worldbookEntries?: object[], selectedNames?: string[] }} input
 * @returns {Array<{code:string, level:string, message:string, view?:string}>}
 */
export function buildCorruptionExportIssues(input) {
  var d = input || {};
  if (!d.enabled) return [];
  var found = findCorruptionEntries(d.worldbookEntries || []);
  var issues = [];
  if (!found.rules || !String(found.rules.content || '').trim()) {
    issues.push({
      code: 'corruption_no_rules',
      level: 'warning',
      message: '已启用恶堕进度，但缺少世界书「' + CORRUPTION_RULES_COMMENT + '」',
      view: 'worldbook',
    });
  }
  var selected = asTrimmedList(d.selectedNames);
  if (selected.length) {
    selected.forEach(function(name) {
      var c = archiveComment(name);
      var hit = found.archives.some(function(a) {
        return String(a.comment || '').trim() === c && String(a.content || '').trim();
      });
      if (!hit) {
        issues.push({
          code: 'corruption_no_archive',
          level: 'warning',
          message: '恶堕进度：缺少「' + c + '」',
          view: 'worldbook',
        });
      }
    });
  } else if (!found.archives.length) {
    issues.push({
      code: 'corruption_no_archive_any',
      level: 'warning',
      message: '已启用恶堕进度，但尚未生成任何恶堕档案世界书',
      view: 'character',
    });
  }
  return issues;
}

/**
 * 在状态栏 design 上打开 corruption_stage 模块，并刷新 paths 中的样本为阶段表首项
 * @param {object} design normalizeDesign 结果或 partial
 * @param {string[]} stageNames
 * @param {function} [normalizeDesignFn]
 */
export function ensureCorruptionModuleInDesign(design, stageNames, normalizeDesignFn) {
  var stages = asTrimmedList(stageNames);
  var sample = stages[0] || '未触碰';
  var d = design && typeof design === 'object' ? Object.assign({}, design) : {};
  d.nsfw = true;
  var flags = Object.assign({}, d.moduleFlags || {});
  flags[CORRUPTION_STATUS_MODULE_ID] = true;
  d.moduleFlags = flags;
  if (typeof normalizeDesignFn === 'function') {
    d = normalizeDesignFn(d);
  }
  if (Array.isArray(d.paths)) {
    d.paths = d.paths.map(function(p) {
      if (!p || !p.path) return p;
      if (String(p.path).indexOf('.' + CORRUPTION_STATUS_LABEL) >= 0 || p.label === CORRUPTION_STATUS_LABEL) {
        return Object.assign({}, p, { sample: sample, label: p.label || CORRUPTION_STATUS_LABEL });
      }
      return p;
    });
  }
  return d;
}

export function getCorruptionStatusSample(stageNames) {
  var stages = asTrimmedList(stageNames);
  return stages[0] || '未触碰';
}
