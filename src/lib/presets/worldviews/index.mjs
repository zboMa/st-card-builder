/**
 * 世界观预设目录（支持多选组合）
 * 扩展步骤：
 * 1. 在 groups.mjs 加分组（如需）
 * 2. 在 data/<group>.mjs 的 PRESETS 数组追加对象
 * 3. 下方 DATA_MODULES 注册该文件（新文件时）
 *
 * 厚度底线见 WORLDVIEW_QUALITY_FLOOR；多选上限 MAX_WORLDVIEW_PRESET_ITEMS。
 */
import { WORLDVIEW_GROUPS } from './groups.mjs';
import { PRESETS as ORIENTAL } from './data/oriental.mjs';
import { PRESETS as MODERN } from './data/modern.mjs';
import { PRESETS as FANTASY } from './data/fantasy.mjs';
import { PRESETS as SUPERNATURAL } from './data/supernatural.mjs';
import { PRESETS as SCIFI } from './data/scifi.mjs';
import { PRESETS as TABOO_POWER } from './data/taboo_power.mjs';
import { PRESETS as CATASTROPHE } from './data/catastrophe.mjs';
import { WORLDVIEW_SUMMARIES } from './summaries.mjs';
import { applySummariesToList } from '../../catalogSummaries.mjs';

var DATA_MODULES = [ORIENTAL, MODERN, FANTASY, SUPERNATURAL, SCIFI, CATASTROPHE, TABOO_POWER];

/** 多选上限：主 + 最多两个叠加 */
export var MAX_WORLDVIEW_PRESET_ITEMS = 3;

/** 单条预设质量底线（测试与扩展须遵守；禁止为多选而降级） */
export var WORLDVIEW_QUALITY_FLOOR = {
  description: 300,
  writingGuide: 350,
  lexicon: 14,
  mustCover: 6,
  antiPatterns: 4,
  skeletonHints: 6,
};

function flattenPresets() {
  var out = [];
  var seen = Object.create(null);
  DATA_MODULES.forEach(function(list) {
    (list || []).forEach(function(p) {
      if (!p || !p.id || seen[p.id]) return;
      seen[p.id] = true;
      out.push(p);
    });
  });
  return out;
}

export var WORLDVIEW_PRESETS = applySummariesToList(flattenPresets(), WORLDVIEW_SUMMARIES);

export var WORLDVIEW_PRESET_MAP = (function() {
  var m = Object.create(null);
  WORLDVIEW_PRESETS.forEach(function(p) { m[p.id] = p; });
  return m;
})();

export var WORLDVIEW_PRESET_IDS = WORLDVIEW_PRESETS.map(function(p) { return p.id; });
export { WORLDVIEW_SUMMARIES };

export { WORLDVIEW_GROUPS };

export function getWorldviewPreset(id) {
  var key = String(id || '').trim();
  return key && WORLDVIEW_PRESET_MAP[key] ? WORLDVIEW_PRESET_MAP[key] : null;
}

/** 供 UI：按分组列出 { group, label, items[] } */
export function listWorldviewPresetsByGroup() {
  var by = Object.create(null);
  WORLDVIEW_GROUPS.forEach(function(g) {
    by[g.id] = { id: g.id, label: g.label, items: [] };
  });
  WORLDVIEW_PRESETS.forEach(function(p) {
    var g = by[p.group] || (by[p.group] = { id: p.group, label: p.group, items: [] });
    g.items.push({
      id: p.id,
      label: p.label,
      summary: p.summary || '',
      description: p.description || '',
    });
  });
  return WORLDVIEW_GROUPS.map(function(g) { return by[g.id]; }).filter(function(g) {
    return g && g.items && g.items.length;
  });
}

/**
 * 规范化多选项（有序去重；首项=主世界观）
 * @param {Array|{id?:string}|string|null} raw
 * @param {string} [legacyId] 旧单选 id 回填
 */
export function normalizeWorldviewPresetItems(raw, legacyId) {
  var list = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === 'object' && raw.id) {
    list = [raw];
  } else if (typeof raw === 'string' && raw.trim()) {
    list = [{ id: raw.trim(), note: '' }];
  }
  var out = [];
  var seen = Object.create(null);
  list.forEach(function(it) {
    var id = String((it && it.id) || it || '').trim();
    if (!id || seen[id] || !WORLDVIEW_PRESET_MAP[id]) return;
    seen[id] = true;
    out.push({
      id: id,
      note: String((it && it.note) || '').trim(),
    });
  });
  if (!out.length && legacyId) {
    var lid = String(legacyId || '').trim();
    if (lid && WORLDVIEW_PRESET_MAP[lid]) {
      out.push({ id: lid, note: '' });
    }
  }
  return out.slice(0, MAX_WORLDVIEW_PRESET_ITEMS);
}

export function primaryWorldviewPresetId(items) {
  var list = normalizeWorldviewPresetItems(items);
  return list.length ? list[0].id : '';
}

function pushUnique(arr, values, max) {
  var seen = Object.create(null);
  arr.forEach(function(x) { seen[String(x)] = true; });
  (values || []).forEach(function(v) {
    var s = String(v || '').trim();
    if (!s || seen[s]) return;
    if (max != null && arr.length >= max) return;
    seen[s] = true;
    arr.push(s);
  });
  return arr;
}

function formatSinglePresetBlock(p, roleLabel, note) {
  var lines = [];
  lines.push('—— ' + roleLabel + ' · ' + p.label + ' ——');
  lines.push(p.description || '');
  if (note) lines.push('【本项用户补充·优先于本项默认冲突细节】' + note);
  lines.push('语汇：' + (p.lexicon || []).join('、'));
  lines.push('【必写维度】');
  (p.mustCover || []).forEach(function(m, i) {
    lines.push((i + 1) + ') ' + m);
  });
  if (p.writingGuide) lines.push('【写法】' + p.writingGuide);
  if (p.antiPatterns && p.antiPatterns.length) {
    lines.push('禁止/避免：' + p.antiPatterns.join(' / '));
  }
  return lines.join('\n');
}

/**
 * 构建单预设注入块（完整厚度，不因多选截断 writingGuide）
 * @param {string} presetId
 * @param {{ stage?: 'char'|'worldbook'|'greeting'|'all', userExtra?: string }} [opts]
 */
export function buildWorldviewHint(presetId, opts) {
  return buildWorldviewHintFromItems(
    presetId ? [{ id: presetId, note: '' }] : [],
    opts
  );
}

/**
 * 多选组合 hint：主世界观完整 + 叠加项完整；语汇并集主优先
 * @param {Array<{id:string,note?:string}>|string} items
 * @param {{ stage?: string, userExtra?: string }} [opts]
 */
export function buildWorldviewHintFromItems(items, opts) {
  opts = opts || {};
  var list = normalizeWorldviewPresetItems(items);
  if (!list.length) return '';
  var stage = opts.stage || 'all';
  var lines = [];

  if (list.length === 1) {
    var only = getWorldviewPreset(list[0].id);
    if (!only) return '';
    lines.push('\n【世界观预设·' + only.label + '】');
    lines.push(formatSinglePresetBlock(only, '唯一预设', list[0].note));
  } else {
    var primary = getWorldviewPreset(list[0].id);
    var secondaryLabels = list.slice(1).map(function(it) {
      var p = getWorldviewPreset(it.id);
      return p ? p.label : it.id;
    }).filter(Boolean);
    lines.push('\n【世界观预设组合】主：' + (primary ? primary.label : list[0].id)
      + '｜叠加：' + secondaryLabels.join('、'));
    lines.push('【组合法则】主世界观定底盘制度与物理/礼法骨架；叠加项默认解释为隐秘族群、飞地、双轨制度、入侵层或亚文化圈层——须写清如何共存，禁止无层级硬揉两套法则。');
    list.forEach(function(it, idx) {
      var p = getWorldviewPreset(it.id);
      if (!p) return;
      var role = idx === 0 ? '主世界观' : ('叠加' + idx);
      lines.push(formatSinglePresetBlock(p, role, it.note));
    });
  }

  // 合并语汇（主优先，上限 24）
  var lexicon = [];
  list.forEach(function(it) {
    var p = getWorldviewPreset(it.id);
    if (p) pushUnique(lexicon, p.lexicon, 24);
  });
  if (lexicon.length) {
    lines.push('【组合语汇优先（主项在前）】' + lexicon.join('、'));
  }

  // 骨架建议并集
  if (stage === 'worldbook' || stage === 'all') {
    var skBits = [];
    list.forEach(function(it) {
      var p = getWorldviewPreset(it.id);
      if (!p || !p.skeletonHints) return;
      p.skeletonHints.forEach(function(h) {
        skBits.push('[' + p.label + '] ' + h);
      });
    });
    if (skBits.length) {
      lines.push('【世界书骨架建议方向】' + skBits.join('、'));
    }
  }

  if (stage === 'char' || stage === 'all') {
    lines.push('【角色】身份、能力、处境须嵌在主世界观制度中；若有叠加预设，须体现其在叠加层中的位置（成员/局外人/契约方），勿写成无世界背景的空人设。');
  }
  if (stage === 'greeting' || stage === 'all') {
    lines.push('【开场白】场景、器物、称呼须露出主世界观可感细节；叠加层可用服饰、暗语、气味、禁忌姿势等作第二纹理。');
  }
  if (opts.userExtra && String(opts.userExtra).trim()) {
    lines.push('【用户额外要求·优先于预设冲突细节】\n' + String(opts.userExtra).trim());
  }
  lines.push('【硬约束】冲突优先级：用户阶段要求/各项 note > 主预设 > 叠加预设。预设提供骨架语汇与制度，不得降级为标签堆砌。');
  lines.push('【成年与情欲边界】禁止儿童性化。世界观可写礼法成年制度（及笄/冠礼/婚嫁年岁等）；情欲/亲密戏仅限已完成该设定成年礼、具备同意能力的成人角色。不得以历史早婚等为儿童情欲开脱。');
  return lines.join('\n');
}

/** 合并用户阶段提示：预设 hint + 用户原文（用户可空） */
export function composeWorldviewUserPrompt(presetIdOrItems, userText, stage) {
  var items = Array.isArray(presetIdOrItems)
    ? presetIdOrItems
    : (presetIdOrItems ? [{ id: presetIdOrItems, note: '' }] : []);
  var hint = buildWorldviewHintFromItems(items, { stage: stage || 'all' });
  var user = String(userText || '').trim();
  if (!hint && !user) return '';
  if (!hint) return user;
  if (!user) return '请按下列世界观预设生成。\n' + hint;
  return user + '\n' + hint;
}

/** 校验单条是否达到厚度底线（供测试） */
export function checkWorldviewPresetQuality(p) {
  var f = WORLDVIEW_QUALITY_FLOOR;
  var issues = [];
  if (!p || !p.id) return ['missing preset'];
  if (!p.description || String(p.description).length < f.description) {
    issues.push('description<' + f.description);
  }
  if (!p.writingGuide || String(p.writingGuide).length < f.writingGuide) {
    issues.push('writingGuide<' + f.writingGuide);
  }
  if (!Array.isArray(p.lexicon) || p.lexicon.length < f.lexicon) {
    issues.push('lexicon<' + f.lexicon);
  }
  if (!Array.isArray(p.mustCover) || p.mustCover.length < f.mustCover) {
    issues.push('mustCover<' + f.mustCover);
  }
  if (!Array.isArray(p.antiPatterns) || p.antiPatterns.length < f.antiPatterns) {
    issues.push('antiPatterns<' + f.antiPatterns);
  }
  if (!Array.isArray(p.skeletonHints) || p.skeletonHints.length < f.skeletonHints) {
    issues.push('skeletonHints<' + f.skeletonHints);
  }
  return issues;
}
