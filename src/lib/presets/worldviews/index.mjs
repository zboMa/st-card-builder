/**
 * 世界观预设目录
 * 扩展步骤：
 * 1. 在 groups.mjs 加分组（如需）
 * 2. 在 data/<group>.mjs 的 PRESETS 数组追加对象
 * 3. 下方 DATA_MODULES 注册该文件（新文件时）
 */
import { WORLDVIEW_GROUPS } from './groups.mjs';
import { PRESETS as ORIENTAL } from './data/oriental.mjs';
import { PRESETS as MODERN } from './data/modern.mjs';
import { PRESETS as FANTASY } from './data/fantasy.mjs';
import { PRESETS as SUPERNATURAL } from './data/supernatural.mjs';
import { PRESETS as SCIFI } from './data/scifi.mjs';
import { PRESETS as TABOO_POWER } from './data/taboo_power.mjs';

var DATA_MODULES = [ORIENTAL, MODERN, FANTASY, SUPERNATURAL, SCIFI, TABOO_POWER];

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

export var WORLDVIEW_PRESETS = flattenPresets();

export var WORLDVIEW_PRESET_MAP = (function() {
  var m = Object.create(null);
  WORLDVIEW_PRESETS.forEach(function(p) { m[p.id] = p; });
  return m;
})();

export var WORLDVIEW_PRESET_IDS = WORLDVIEW_PRESETS.map(function(p) { return p.id; });

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
      description: p.description || '',
    });
  });
  return WORLDVIEW_GROUPS.map(function(g) { return by[g.id]; }).filter(function(g) {
    return g && g.items && g.items.length;
  });
}

/**
 * 构建注入提示块
 * @param {string} presetId
 * @param {{ stage?: 'char'|'worldbook'|'greeting'|'all', userExtra?: string }} [opts]
 */
export function buildWorldviewHint(presetId, opts) {
  opts = opts || {};
  var p = getWorldviewPreset(presetId);
  if (!p) return '';
  var stage = opts.stage || 'all';
  var lines = [];
  lines.push('\n【世界观预设·' + p.label + '】');
  lines.push(p.description || '');
  lines.push('语汇优先：' + (p.lexicon || []).slice(0, 14).join('、'));
  lines.push('【必写维度】');
  (p.mustCover || []).forEach(function(m, i) {
    lines.push((i + 1) + ') ' + m);
  });
  if (p.writingGuide) lines.push('【写法】' + p.writingGuide);
  if (p.antiPatterns && p.antiPatterns.length) {
    lines.push('禁止/避免：' + p.antiPatterns.join(' / '));
  }
  if (stage === 'worldbook' || stage === 'all') {
    if (p.skeletonHints && p.skeletonHints.length) {
      lines.push('【世界书骨架建议方向】' + p.skeletonHints.join('、'));
    }
  }
  if (stage === 'char' || stage === 'all') {
    lines.push('【角色】身份、能力、处境须嵌在该世界观制度中，勿写成无世界背景的空人设。');
  }
  if (stage === 'greeting' || stage === 'all') {
    lines.push('【开场白】场景、器物、称呼须露出该世界观的可感细节。');
  }
  if (opts.userExtra && String(opts.userExtra).trim()) {
    lines.push('【用户额外要求·优先于预设冲突细节】\n' + String(opts.userExtra).trim());
  }
  lines.push('【硬约束】预设提供骨架语汇与制度；用户额外要求优先。禁止未成年内容。');
  return lines.join('\n');
}

/** 合并用户阶段提示：预设 hint + 用户原文（用户可空） */
export function composeWorldviewUserPrompt(presetId, userText, stage) {
  var hint = buildWorldviewHint(presetId, { stage: stage || 'all' });
  var user = String(userText || '').trim();
  if (!hint && !user) return '';
  if (!hint) return user;
  if (!user) return '请按下列世界观预设生成。\n' + hint;
  return user + '\n' + hint;
}
