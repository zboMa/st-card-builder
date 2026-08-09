/**
 * 纯爱线 · 亲密关系进度：档位预设、世界书总则/档案、导出检查
 *
 * 与恶堕进度平行的另一条数值进度线（0-100）：
 * - 亲密度可双向波动（升档靠里程碑，降档靠冲突/背叛/冷落）
 * - 结构同样为 1 条「亲密关系总则」+ 每角色 1 条「亲密档案·{名}」
 * - 当前档位由状态栏/MVU 变量「亲密度」数值指向
 */
import {
  CORRUPTION_WB_CHARS,
  CORRUPTION_BRIEF_CHARS,
} from './novel/contextBudgets.mjs';
import { truncateToTokens } from './assistant/contextManager.mjs';
import {
  buildTrackRulesContent,
  buildTrackArchiveContentTemplate,
  valueToStageName,
} from './progressTrack.mjs';
import { upsertWorldbookByComment } from './corruptionProgress.mjs';
import {
  patchForRegistrySlot,
  buildAffectionArchivePatch,
} from './worldbook/worldbookEntryBridge.mjs';
import { WB_OWNER } from './worldbook/worldbookRegistry.mjs';

export var AFFECTION_RULES_COMMENT = '亲密关系总则';
export var AFFECTION_ARCHIVE_PREFIX = '亲密档案·';
export var AFFECTION_GENERAL_ARCHIVE_COMMENT = '亲密档案·通用';
export var AFFECTION_STATUS_MODULE_ID = 'affection_stage';
export var AFFECTION_STATUS_LABEL = '亲密度';
export var DEFAULT_AFFECTION_PRESET = '6';
export var AFFECTION_STAGE_MIN = 3;
export var AFFECTION_STAGE_MAX = 8;

export var AFFECTION_PRESETS = {
  '4': {
    id: '4',
    label: '简洁',
    stages: ['陌生', '相识', '亲密', '灵魂伴侣'],
  },
  '6': {
    id: '6',
    label: '标准',
    stages: ['陌生', '相识', '亲近', '信赖', '亲密', '灵魂伴侣'],
  },
  '8': {
    id: '8',
    label: '细腻',
    stages: ['陌生', '点头之交', '相识', '亲近', '信赖', '亲密', '誓言', '灵魂伴侣'],
  },
  custom: {
    id: 'custom',
    label: '自定义',
    stages: [],
  },
};

export var AFFECTION_PRESET_IDS = Object.keys(AFFECTION_PRESETS);

/** 纯爱推进事件锚点表（写入总则，防凭空刷档/速通） */
export var AFFECTION_ANCHOR_LINES = [
  '【事件锚点表】亲密度变化必须对应剧情事件，禁止凭空增减：',
  '升档里程碑（跨档触发）——',
  '- 破冰深谈：首次坦诚心事、脆弱面或秘密。',
  '- 共历险境：共同冒险/并肩扛事/一起渡过难关。',
  '- 告白：明确表达心意并得到回应。',
  '- 守护：为对方做出牺牲或关键选择。',
  '- 信任考验：经历误会/风波后重建或加深信任。',
  '- 交托：托付秘密、未来或身体（须自愿且尊重边界）。',
  '降档诱因——',
  '- 欺骗/背叛、长期冷落、出言伤害、违背承诺。',
  '禁止以频繁肉体接触替代情感推进来刷档；每档推进须有可回看的关系事件。',
].join('\n');

export var AFFECTION_BREAKTHROUGH_HINT = '进入下一档需发生的里程碑事件，须写具体';

/** 亲密档案每阶段写作维度 */
export var AFFECTION_SECTION_HINTS = [
  '心理状态与安全感',
  '相处模式与距离感',
  '对主角的态度与依赖',
  '记忆点与专属细节',
  '愿望与未说出口的话',
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
 *   extraNotes: string,
 *   stageNames: string[],
 *   selectedNames: string[],
 *   syncStatusBar: boolean
 * }}
 */
export function normalizeAffectionConfig(cfg) {
  var c = cfg || {};
  var preset = String(c.preset || c.affectionPreset || DEFAULT_AFFECTION_PRESET);
  if (!AFFECTION_PRESETS[preset]) preset = DEFAULT_AFFECTION_PRESET;
  var stageNames = resolveAffectionStageNames(preset, c.stageNames || c.affectionStageNames, c.customBrief || c.affectionCustomBrief);
  return {
    enabled: !!(c.enabled != null ? c.enabled : c.affectionEnabled),
    preset: preset,
    customBrief: String(c.customBrief != null ? c.customBrief : (c.affectionCustomBrief || '')).trim(),
    extraNotes: String(c.extraNotes != null ? c.extraNotes : (c.affectionExtraNotes || '')).trim(),
    stageNames: stageNames,
    selectedNames: asTrimmedList(c.selectedNames || c.affectionSelectedNames),
    syncStatusBar: c.syncStatusBar !== false && c.affectionSyncStatusBar !== false,
  };
}

export function resolveAffectionStageNames(preset, customNames, customBrief) {
  var p = String(preset || DEFAULT_AFFECTION_PRESET);
  if (p !== 'custom' && AFFECTION_PRESETS[p] && AFFECTION_PRESETS[p].stages.length) {
    return AFFECTION_PRESETS[p].stages.slice();
  }
  var fromArr = asTrimmedList(customNames);
  if (fromArr.length >= AFFECTION_STAGE_MIN) return fromArr.slice(0, AFFECTION_STAGE_MAX);
  var parsed = parseAffectionStageNamesFromText(customBrief || '');
  if (parsed.length >= AFFECTION_STAGE_MIN) return parsed.slice(0, AFFECTION_STAGE_MAX);
  return AFFECTION_PRESETS['6'].stages.slice();
}

export function parseAffectionStageNamesFromText(text) {
  return parseAffectionStageNamesFromTextImpl(text);
}

function parseAffectionStageNamesFromTextImpl(text) {
  var t = String(text || '').trim();
  if (!t) return [];
  try {
    var jsonMatch = t.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      var data = JSON.parse(jsonMatch[0]);
      if (Array.isArray(data)) return asTrimmedList(data).slice(0, AFFECTION_STAGE_MAX);
      if (data && Array.isArray(data.stages)) return asTrimmedList(data.stages).slice(0, AFFECTION_STAGE_MAX);
      if (data && Array.isArray(data.stageNames)) return asTrimmedList(data.stageNames).slice(0, AFFECTION_STAGE_MAX);
    }
  } catch (e) { /* ignore */ }
  var lines = t.split(/\n+/).map(function(l) { return l.trim(); }).filter(Boolean);
  var fromLines = [];
  lines.forEach(function(line) {
    var m = line.match(/^(?:\d+[\.\)、\s]+|[-*·]\s*|第?[一二三四五六七八九十\d]+[阶阶段步]?[：:\s]+)(.+)$/);
    var name = (m ? m[1] : line).replace(/^【|】$/g, '').trim();
    if (name && name.length <= 16 && !/[。；;]/.test(name)) fromLines.push(name);
  });
  if (fromLines.length >= AFFECTION_STAGE_MIN) return asTrimmedList(fromLines).slice(0, AFFECTION_STAGE_MAX);
  var parts = t.split(/[→➞➡><\/／/|｜、,，]+/).map(function(s) { return s.trim(); }).filter(Boolean);
  if (parts.length >= AFFECTION_STAGE_MIN && parts.every(function(p) { return p.length <= 16; })) {
    return asTrimmedList(parts).slice(0, AFFECTION_STAGE_MAX);
  }
  return [];
}

export function parseAffectionStageNamesFromAiText(text) {
  return parseAffectionStageNamesFromText(text);
}

export function affectionArchiveComment(charName) {
  var n = String(charName || '').trim() || '未命名';
  return AFFECTION_ARCHIVE_PREFIX + n;
}

export function isAffectionRulesComment(comment) {
  return String(comment || '').trim() === AFFECTION_RULES_COMMENT;
}

export function isAffectionRulesEntry(entry) {
  if (!entry) return false;
  if (entry.kind === 'affection_rules') return true;
  return isAffectionRulesComment(entry.comment || entry.displayName);
}

export function isAffectionArchiveEntryObj(entry) {
  if (!entry) return false;
  if (entry.kind === 'affection_archive' || entry.kind === 'affection_archive_general') return true;
  return isAffectionArchiveComment(entry.comment || entry.displayName);
}

export function isAffectionArchiveComment(comment) {
  return String(comment || '').trim().indexOf(AFFECTION_ARCHIVE_PREFIX) === 0;
}

/**
 * 纯爱选角：不限性别（默认全选世界书/小说人物），主角默认排除由调用方处理
 * @param {Array<{name:string, aliases?:string[], selected?:boolean}>} candidates
 */
export function pickAffectionTargets(candidates) {
  var list = Array.isArray(candidates) ? candidates : [];
  var out = [];
  var seen = Object.create(null);
  list.forEach(function(c) {
    if (!c) return;
    var name = String(c.name || '').trim();
    if (!name || seen[name]) return;
    seen[name] = true;
    out.push({
      name: name,
      aliases: asTrimmedList(c.aliases),
      selected: c.selected !== false,
    });
  });
  return out;
}

export function buildRulesContent(stageNames) {
  var stages = asTrimmedList(stageNames);
  if (stages.length < AFFECTION_STAGE_MIN) stages = AFFECTION_PRESETS['6'].stages.slice();
  var anchorNote = [
    '通用档案：无专属档案的角色（含随机登场/刷新出的新角色）直接套用「'
      + AFFECTION_GENERAL_ARCHIVE_COMMENT + '」按档位演绎；变量用「NPC.{角色名}.' + AFFECTION_STATUS_LABEL + '」记录并按名维护。',
  ].join('\n');
  return buildTrackRulesContent({
    title: AFFECTION_RULES_COMMENT,
    statusLabel: AFFECTION_STATUS_LABEL,
    archivePrefix: AFFECTION_ARCHIVE_PREFIX,
    stageNames: stages,
    direction: 'fluctuate',
    singleStepMax: 15,
    anchorNote: anchorNote,
    anchorLines: AFFECTION_ANCHOR_LINES,
  });
}

export function buildRulesWorldbookEntry(stageNames) {
  return patchForRegistrySlot(WB_OWNER.affection, 'rules', {
    content: buildRulesContent(stageNames),
    keys: [],
    strategy: 'constant',
    position: 0,
    depth: 4,
    role: 0,
    order: 10,
    prob: 100,
    enabled: true,
  });
}

export function buildArchiveWorldbookEntry(charName, content, aliases) {
  var name = String(charName || '').trim() || '未命名';
  var keys = asTrimmedList([name].concat(aliases || []));
  return buildAffectionArchivePatch(name, {
    content: String(content || '').trim() || buildArchiveContentTemplate(name, AFFECTION_PRESETS['6'].stages),
    keys: keys,
    strategy: 'selective',
    position: 4,
    depth: 4,
    role: 0,
    order: 100,
    prob: 100,
    enabled: true,
  });
}

export function buildGeneralArchiveEntry(stageNames) {
  return patchForRegistrySlot(WB_OWNER.affection, 'general', {
    content: buildGeneralArchiveContent(stageNames),
    keys: [],
    strategy: 'constant',
    position: 0,
    depth: 4,
    role: 0,
    order: 100,
    prob: 100,
    enabled: true,
  });
}

export function buildGeneralArchiveContent(stageNames) {
  var stages = asTrimmedList(stageNames);
  if (stages.length < AFFECTION_STAGE_MIN) stages = AFFECTION_PRESETS['6'].stages.slice();
  var lines = [];
  lines.push('【亲密档案 · 通用】');
  lines.push('适用于任何角色——包括随机刷新、临时登场、没有专属档案的角色。');
  lines.push('读取状态栏/MVU「NPC.{角色名}.' + AFFECTION_STATUS_LABEL + '」（0-100 数值）；仅采用与当前档位对应的阶段，禁止混用其他阶段。');
  lines.push('演绎时把下列「他/她」替换为该角色名，并结合其性格与处境展开。');
  lines.push('');
  stages.forEach(function(s) {
    lines.push('## ' + s);
    AFFECTION_SECTION_HINTS.forEach(function(h) {
      lines.push('- ' + h + '：（按「' + s + '」档位、结合该角色初始设定展开）');
    });
    lines.push('- 突破条件：（进入下一档需发生的里程碑事件之一，须写具体）');
    lines.push('');
  });
  return lines.join('\n').trim() + '\n';
}

export function buildArchiveContentTemplate(charName, stageNames) {
  return buildTrackArchiveContentTemplate({
    charName: charName,
    stageNames: stageNames,
    statusLabel: AFFECTION_STATUS_LABEL,
    archiveTitle: '亲密档案',
    sectionHints: AFFECTION_SECTION_HINTS,
    breakthroughHint: AFFECTION_BREAKTHROUGH_HINT,
  });
}

/** 每阶段最低汉字量（门禁） */
export var AFFECTION_MIN_CHARS_PER_STAGE = 180;
/** 每阶段目标区间（提示词） */
export var AFFECTION_TARGET_CHARS_PER_STAGE = { min: 180, max: 360 };

export function buildArchiveSystemPrompt() {
  return [
    '你是角色卡世界书作者，专写「亲密关系进度」分期人物说明（面向世界书 NPC，不是主角卡面 Description）。',
    '为单一角色生成一条完整世界书正文：包含全部阶段，每阶段用 Markdown ## 标题（标题须与阶段表完全一致）。',
    '每阶段必须写成可直接扮演的丰满段落，覆盖并写透：',
    '1) 心理状态与安全感 2) 相处模式与距离感 3) 对主角的态度与依赖',
    '4) 记忆点与专属细节（两人之间的暗号、习惯、昵称） 5) 愿望与未说出口的话 6) 扮演注意。',
    '阶段读取方式：状态栏/MVU 变量「' + AFFECTION_STATUS_LABEL + '」为 0-100 数值；每阶段开头注明该档数值区间（如 40-59），同档数值越高越亲近，行为基调以本阶段为准。',
    '每阶段末尾必须另写一段「突破条件」：进入下一档需发生的里程碑事件（深谈/共历/告白/守护/信任考验/交托之一的具体化），防止无事件凭空刷档。',
    '字数：每一阶段正文（含突破条件）' + AFFECTION_TARGET_CHARS_PER_STAGE.min + '-' + AFFECTION_TARGET_CHARS_PER_STAGE.max + ' 字（不含标题）；禁止提纲、空话、（待填充）、一笔带过。',
    '相邻阶段必须可感知递进，禁止跳档或阶段之间复制粘贴。',
    '禁止儿童性化：所有亲密描写仅限明确成年角色。',
    '只输出世界书正文（不要 JSON、不要前言后记）。',
  ].join('\n');
}

export function buildArchiveExpandSystemPrompt() {
  return [
    '你是角色卡世界书扩写编辑。下文亲密档案过薄，请在保持阶段标题不变的前提下大幅加厚每一阶段。',
    '每阶段扩写到 ' + AFFECTION_TARGET_CHARS_PER_STAGE.min + '-' + AFFECTION_TARGET_CHARS_PER_STAGE.max + ' 字，补足心理、相处细节、专属记忆点与可演细节。',
    '保留并补实每阶段「突破条件」（进入下一档需发生的里程碑事件）。',
    '禁止删除阶段；禁止输出（待填充）；只输出完整正文。',
  ].join('\n');
}

/**
 * @param {{ charName: string, stageNames: string[], worldbookContent?: string, identity?: string, customBrief?: string, extraNotes?: string }} opts
 */
export function buildArchiveUserPrompt(opts) {
  var o = opts || {};
  var stages = asTrimmedList(o.stageNames);
  var parts = [];
  parts.push('角色名：' + String(o.charName || '').trim());
  if (o.identity) parts.push('身份：' + String(o.identity).trim());
  if (o.worldbookContent) {
    parts.push('【该角色世界书人物设定——必须据此写亲密档案，禁止写成另一人或主角】\n'
      + truncateToTokens(String(o.worldbookContent).trim(), CORRUPTION_WB_CHARS));
  } else {
    parts.push('【警告】未提供该角色世界书正文，请仍按角色名写出丰满分期，但勿编造与已知卡面冲突的设定。');
  }
  if (o.customBrief) parts.push('关系基调补充：\n' + truncateToTokens(String(o.customBrief).trim(), CORRUPTION_BRIEF_CHARS));
  if (o.extraNotes) {
    parts.push('附加设定（须融入各阶段补完，禁止忽略）：\n'
      + truncateToTokens(String(o.extraNotes).trim(), CORRUPTION_BRIEF_CHARS));
  }
  parts.push('阶段表（须全部写出，## 标题与下列完全一致）：\n' + stages.map(function(s, i) {
    return (i + 1) + '. ' + s;
  }).join('\n'));
  parts.push('正文开头须含：【读取状态栏/MVU「' + AFFECTION_STATUS_LABEL + '」数值（0-100）；仅采用与当前档位对应的阶段，禁止混用其他阶段】');
  parts.push('每阶段须含「突破条件」段落：进入下一档需发生的里程碑事件（深谈/共历/告白/守护/信任考验/交托的具体化），防止无事件凭空刷档。');
  parts.push('须与已有人物设定可对读，禁止互相打架或孤立无互动。');
  return parts.join('\n\n');
}

/**
 * @param {Array<object>} entries
 * @returns {{ rules: object|null, archives: object[] }}
 */
export function findAffectionEntries(entries) {
  var list = Array.isArray(entries) ? entries : [];
  var rules = null;
  var archives = [];
  list.forEach(function(e) {
    if (!e) return;
    if (isAffectionRulesEntry(e)) rules = e;
    else if (isAffectionArchiveEntryObj(e)) archives.push(e);
  });
  return { rules: rules, archives: archives };
}

/**
 * 导出检查附加项
 * @param {{ enabled: boolean, worldbookEntries?: object[], selectedNames?: string[] }} input
 */
export function buildAffectionExportIssues(input) {
  var d = input || {};
  if (!d.enabled) return [];
  var found = findAffectionEntries(d.worldbookEntries || []);
  var issues = [];
  if (!found.rules || !String(found.rules.content || '').trim()) {
    issues.push({
      code: 'affection_no_rules',
      level: 'warning',
      message: '已启用纯爱线，但缺少世界书「' + AFFECTION_RULES_COMMENT + '」',
      view: 'worldbook',
    });
  }
  var selected = asTrimmedList(d.selectedNames);
  if (selected.length) {
    selected.forEach(function(name) {
      var c = affectionArchiveComment(name);
      var hit = found.archives.some(function(a) {
        return String(a.ownerSlot || '').trim() === name && String(a.content || '').trim();
      });
      if (!hit) {
        issues.push({
          code: 'affection_no_archive',
          level: 'warning',
          message: '纯爱线：缺少「' + c + '」',
          view: 'worldbook',
        });
      }
    });
  } else if (!found.archives.length) {
    issues.push({
      code: 'affection_no_archive_any',
      level: 'warning',
      message: '已启用纯爱线，但尚未生成任何亲密档案世界书',
      view: 'character',
    });
  }
  return issues;
}

/**
 * 在状态栏 design 上打开 affection_stage 模块，并把对应 path 的样本改为初始数值
 * @param {object} design
 * @param {string[]} stageNames
 * @param {function} [normalizeDesignFn]
 */
export function ensureAffectionModuleInDesign(design, stageNames, normalizeDesignFn) {
  var stages = asTrimmedList(stageNames);
  var sample = '30';
  var d = design && typeof design === 'object' ? Object.assign({}, design) : {};
  var flags = Object.assign({}, d.moduleFlags || {});
  flags[AFFECTION_STATUS_MODULE_ID] = true;
  d.moduleFlags = flags;
  if (typeof normalizeDesignFn === 'function') {
    d = normalizeDesignFn(d);
  }
  if (Array.isArray(d.paths)) {
    d.paths = d.paths.map(function(p) {
      if (!p || !p.path) return p;
      if (String(p.path).indexOf('.' + AFFECTION_STATUS_LABEL) >= 0 || p.label === AFFECTION_STATUS_LABEL) {
        return Object.assign({}, p, { sample: sample, label: p.label || AFFECTION_STATUS_LABEL });
      }
      return p;
    });
  }
  return d;
}

export function getAffectionStatusSample(stageNames) {
  return '30';
}

export { upsertWorldbookByComment };
