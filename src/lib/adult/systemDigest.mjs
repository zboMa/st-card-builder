/**
 * 成人体系总纲：把卡级成人配置编译成可读世界书条目（constant 常驻）
 * 进卡通道：选中内容 → 编译为「[成人体系]」世界书条目 → 导出卡带出 → ST 运行时完整可读
 * 生成时强调（hint/canon）与运行时可读（本模块）互补，不依赖 AI 二次转写。
 * 纯逻辑，可在 Node 直跑（测试依赖）。
 */
import { NSFW_FLAVOR_PRESETS } from './flavors/index.mjs';
import { NTL_TABOO_TYPES } from './ntl/index.mjs';
import {
  EROTIC_POSTURE_PRESETS,
  EROTIC_SPEECH_PRESETS,
} from './expression/index.mjs';
import { WORLDFRAMES, VESSEL_KIND_LABELS } from './vessels/index.mjs';
import { getWorldviewPreset } from '../presets/worldviews/index.mjs';
import {
  CORRUPTION_PRESETS,
  DEFAULT_CORRUPTION_PRESET,
  CORRUPTION_RULES_COMMENT,
} from '../corruptionProgress.mjs';
import {
  AFFECTION_PRESETS,
  DEFAULT_AFFECTION_PRESET,
  AFFECTION_RULES_COMMENT,
} from '../affectionProgress.mjs';
import {
  patchForRegistrySlot,
  getEntryByOwnerSlot,
  isAdultDigestEntry,
  isMvuSystemEntry,
  isCorruptionRulesEntry,
  isAffectionRulesEntry,
  entryExportComment,
  upsertWorldbookEntry,
} from '../worldbook/worldbookEntryBridge.mjs';
import { WB_OWNER } from '../worldbook/worldbookRegistry.mjs';

export var SYSTEM_DIGEST_PREFIX = '[成人体系]';

export var SYSTEM_DIGEST_ORDER = {
  worldview: 950,
  vessel: 940,
  flavor: 930,
  posture: 920,
  speech: 910,
  ntl: 900,
};

export var CORRUPTION_NOTE_HEADER = '【恶堕配置摘要】';

export var AFFECTION_NOTE_HEADER = '【亲密度配置摘要】';

var HEADER_NOTE = '由制卡工具「世界与限定」自动生成；配置改动后请重新生成，勿直接手改。';

function clean(s) {
  return String(s == null ? '' : s).trim();
}

function asItems(v) {
  return Array.isArray(v)
    ? v.map(function(it) {
        return { id: String((it && it.id) || '').trim(), note: String((it && it.note) || '').trim() };
      }).filter(function(it) { return it.id; })
    : [];
}

function pick(map, id) {
  return map && id && map[id] ? map[id] : null;
}

var DIGEST_SLOT_BY_SUFFIX = {
  世界观: 'worldview',
  载体框架: 'vessel',
  NSFW口味: 'flavor',
  姿势语言: 'posture',
  情趣话风: 'speech',
  NTL禁忌: 'ntl',
};

function block(suffix, order, lines) {
  var arr = Array.isArray(lines) ? lines : [lines];
  var slot = DIGEST_SLOT_BY_SUFFIX[suffix];
  if (!slot) return null;
  return patchForRegistrySlot(WB_OWNER.adult, slot, {
    content: arr.join('\n'),
    keys: [],
    strategy: 'constant',
    position: 0,
    depth: 4,
    role: 0,
    order: order,
    prob: 100,
    enabled: true,
  });
}

function header(title) {
  return ['【' + title + '】' + HEADER_NOTE];
}

function extraLines(it, data) {
  var lines = [];
  var d = data || {};
  if (d.writingGuide) lines.push('写法：' + clean(d.writingGuide));
  var avoid = d.avoid || d.antiPatterns;
  if (Array.isArray(avoid) && avoid.length) lines.push('避免：' + avoid.join(' / '));
  if (it && it.note) lines.push('备注：' + it.note);
  return lines;
}

function buildWorldviewBlock(items) {
  var lines = header('成人体系 · 世界观');
  items.forEach(function(it, idx) {
    var p = getWorldviewPreset(it.id);
    if (!p) return;
    lines.push((idx === 0 ? '主底盘：' : '叠加：') + clean(p.label));
    if (p.description) lines.push(clean(p.description));
    if (p.writingGuide) lines.push('写法：' + clean(p.writingGuide));
    var avoid = p.avoid || p.antiPatterns;
    if (Array.isArray(avoid) && avoid.length) lines.push('避免：' + avoid.join(' / '));
    if (it.note) lines.push('备注：' + it.note);
    lines.push('');
  });
  return lines.join('\n');
}

function buildVesselBlock(cfg) {
  var wfId = clean(cfg.adultWorldframeForced || cfg.adultWorldframe || '');
  if (!wfId || wfId === 'generic') return '';
  var wf = pick(WORLDFRAMES, wfId);
  if (!wf) return '';
  var lines = header('成人体系 · 载体框架');
  lines.push('框架：' + clean(wf.label || wfId));
  if (wf.summary) lines.push(clean(wf.summary));
  else if (wf.description) lines.push(clean(wf.description));
  if (Array.isArray(wf.lexicon) && wf.lexicon.length) {
    lines.push('物化语汇：' + wf.lexicon.join(' / '));
  }
  if (Array.isArray(wf.vesselSeeds) && wf.vesselSeeds.length) {
    lines.push('载体种子（把口味 / NTL / 剧情物化成可触的容器，就地取材落到下列一类或多类）：');
    wf.vesselSeeds.forEach(function(s) {
      if (!s) return;
      var kindLabel = (s.kind && VESSEL_KIND_LABELS[s.kind]) || s.kind || '';
      lines.push('- [' + kindLabel + '] ' + String(s.nameHint || '').trim());
    });
  }
  lines.push('说明：本世界将 NSFW 口味 / NTL 禁忌物化为上列载体（法器、宗门、功法、秘境、礼法、器物等），生成内容必须落在这套载体体系内。');
  if (Array.isArray(wf.antiLexicon) && wf.antiLexicon.length) {
    lines.push('禁语（严禁现代器物与词汇穿模，只准用本框架语汇）：' + wf.antiLexicon.join(' / '));
  }
  return lines.join('\n');
}

function buildExpressionBlock(title, items, map, opts) {
  var lines = header(title);
  var groupLabels = (opts && opts.groupLabels) || null;
  items.forEach(function(it, idx) {
    var p = pick(map, it.id);
    if (!p) return;
    var mark = opts && opts.primaryMark && idx === 0 ? opts.primaryMark : '';
    var groupLabel = groupLabels && groupLabels[p.group] ? groupLabels[p.group] : '';
    lines.push((idx + 1) + '. ' + clean(p.label || it.id) + (mark ? '（' + mark + '）' : '') + (groupLabel ? '【' + groupLabel + '】' : ''));
    if (p.description) lines.push(clean(p.description));
    if (Array.isArray(p.mustCover) && p.mustCover.length) {
      lines.push('覆盖要点：' + p.mustCover.join(' / '));
    }
    if (p.writingGuide) lines.push('写法：' + clean(p.writingGuide));
    var avoid = p.avoid || p.antiPatterns;
    if (Array.isArray(avoid) && avoid.length) lines.push('避免：' + avoid.join(' / '));
    if (it.note) lines.push('备注：' + it.note);
    lines.push('');
  });
  return lines.join('\n');
}

function buildCorruptionConfigNote(cfg) {
  if (!cfg.nsfwEnabled || !cfg.corruptionEnabled) return '';
  var preset = CORRUPTION_PRESETS[cfg.corruptionPreset]
    ? CORRUPTION_PRESETS[cfg.corruptionPreset]
    : CORRUPTION_PRESETS[DEFAULT_CORRUPTION_PRESET];
  var lines = [CORRUPTION_NOTE_HEADER];
  lines.push('恶堕已启用。');
  lines.push('预设：' + clean((preset && preset.label) || cfg.corruptionPreset || DEFAULT_CORRUPTION_PRESET));
  var stages = Array.isArray(cfg.corruptionStageNames) ? cfg.corruptionStageNames.filter(Boolean) : [];
  if (stages.length) lines.push('阶段：' + stages.join(' → '));
  if (cfg.corruptionCustomBrief) lines.push('自定义纲要：' + clean(cfg.corruptionCustomBrief));
  if (cfg.corruptionExtraNotes) lines.push('配置备注：' + clean(cfg.corruptionExtraNotes));
  lines.push('完整阶段正文见世界书「恶堕档案·{角色名}」条目；主角不生成恶堕档案。');
  return lines.join('\n');
}

/**
 * 把恶堕配置摘要并入既有「恶堕进度总则」条目（幂等：已含摘要则不重复），避免 [成人体系] 与进度总则内容重叠
 */
export function mergeCorruptionConfigNote(entries, cfg) {
  var note = buildCorruptionConfigNote(cfg);
  if (!note) return entries;
  var list = Array.isArray(entries) ? entries.slice() : [];
  var found = getEntryByOwnerSlot(list, WB_OWNER.corruption, 'rules');
  if (!found) return list;
  var idx = list.indexOf(found);
  var cur = String(list[idx].content || '');
  if (cur.indexOf(CORRUPTION_NOTE_HEADER) >= 0) return list;
  list[idx] = Object.assign({}, list[idx], {
    content: (cur.replace(/\n+$/, '') + '\n\n' + note).trim(),
  });
  return list;
}

/**
 * 移除并入进度总则的恶堕配置摘要（与 merge 对称，供「移除总纲」时回退）
 */
export function stripCorruptionConfigNote(entries) {
  var list = Array.isArray(entries) ? entries.slice() : [];
  for (var i = 0; i < list.length; i++) {
    if (!isCorruptionRulesEntry(list[i])) continue;
    var cur = String(list[i].content || '');
    var at = cur.indexOf(CORRUPTION_NOTE_HEADER);
    if (at < 0) continue;
    var before = cur.slice(0, at).replace(/\n+$/, '');
    list[i] = Object.assign({}, list[i], { content: before });
  }
  return list;
}

/** 纯爱配置摘要（并入「亲密关系总则」，不单独成条目） */
function buildAffectionConfigNote(cfg) {
  if (!cfg || !cfg.affectionEnabled) return '';
  var preset = AFFECTION_PRESETS[cfg.affectionPreset]
    ? AFFECTION_PRESETS[cfg.affectionPreset]
    : AFFECTION_PRESETS[DEFAULT_AFFECTION_PRESET];
  var lines = [AFFECTION_NOTE_HEADER];
  lines.push('纯爱线已启用（亲密度 0-100，可双向波动，档位见下方映射）。');
  lines.push('预设：' + clean((preset && preset.label) || cfg.affectionPreset || DEFAULT_AFFECTION_PRESET));
  var stages = Array.isArray(cfg.affectionStageNames) ? cfg.affectionStageNames.filter(Boolean) : [];
  if (stages.length) lines.push('档位：' + stages.join(' → '));
  if (cfg.affectionCustomBrief) lines.push('关系基调：' + clean(cfg.affectionCustomBrief));
  if (cfg.affectionExtraNotes) lines.push('配置备注：' + clean(cfg.affectionExtraNotes));
  lines.push('完整档位正文见世界书「亲密档案·{角色名}」条目；主角不生成亲密档案。');
  return lines.join('\n');
}

/**
 * 把纯爱配置摘要并入既有「亲密关系总则」条目（幂等：已含摘要则不重复）
 */
export function mergeAffectionConfigNote(entries, cfg) {
  var note = buildAffectionConfigNote(cfg);
  if (!note) return entries;
  var list = Array.isArray(entries) ? entries.slice() : [];
  var rules = getEntryByOwnerSlot(list, WB_OWNER.affection, 'rules');
  if (!rules) return list;
  var idx = list.indexOf(rules);
  var cur = String(list[idx].content || '');
  if (cur.indexOf(AFFECTION_NOTE_HEADER) >= 0) return list;
  list[idx] = Object.assign({}, list[idx], {
    content: (cur.replace(/\n+$/, '') + '\n\n' + note).trim(),
  });
  return list;
}

/**
 * 移除并入亲密关系总则的纯爱配置摘要（与 merge 对称）
 */
export function stripAffectionConfigNote(entries) {
  var list = Array.isArray(entries) ? entries.slice() : [];
  for (var i = 0; i < list.length; i++) {
    if (!isAffectionRulesEntry(list[i])) continue;
    var cur = String(list[i].content || '');
    var at = cur.indexOf(AFFECTION_NOTE_HEADER);
    if (at < 0) continue;
    var before = cur.slice(0, at).replace(/\n+$/, '');
    list[i] = Object.assign({}, list[i], { content: before });
  }
  return list;
}

/**
 * 编译成人体系总纲条目（每条 constant，position=0，order 900 段）
 * @param {object} cfg 取自 __getNsfwConfig__() 的配置（结构见 adultConfigBind）
 * @returns {object[]} worldbook 条目数组（空类目不生成）
 */
export function buildAdultSystemDigest(cfg) {
  cfg = cfg || {};
  var out = [];

  var wv = asItems(cfg.worldviewPresetItems);
  if (wv.length) out.push(block('世界观', SYSTEM_DIGEST_ORDER.worldview, buildWorldviewBlock(wv)));

  var vesselText = buildVesselBlock(cfg);
  if (vesselText) out.push(block('载体框架', SYSTEM_DIGEST_ORDER.vessel, [vesselText]));

  if (cfg.nsfwEnabled) {
    var flavors = asItems(cfg.flavorItems);
    if (flavors.length) {
      out.push(block('NSFW口味', SYSTEM_DIGEST_ORDER.flavor, [
        buildExpressionBlock('成人体系 · NSFW 口味', flavors, NSFW_FLAVOR_PRESETS, { primaryMark: '主调色盘' }),
      ]));
    }
    var postures = asItems(cfg.postureItems);
    if (postures.length) {
      out.push(block('姿势语言', SYSTEM_DIGEST_ORDER.posture, [
        buildExpressionBlock('成人体系 · 姿势语言', postures, EROTIC_POSTURE_PRESETS, {}),
      ]));
    }
    var speeches = asItems(cfg.speechItems);
    if (speeches.length) {
      out.push(block('情趣话风', SYSTEM_DIGEST_ORDER.speech, [
        buildExpressionBlock('成人体系 · 情趣话风', speeches, EROTIC_SPEECH_PRESETS, {}),
      ]));
    }
  }

  if (cfg.ntlEnabled) {
    var ntlItems = asItems(cfg.ntlTabooItems);
    if (ntlItems.length) {
      out.push(block('NTL禁忌', SYSTEM_DIGEST_ORDER.ntl, [
        buildExpressionBlock('成人体系 · NTL 禁忌', ntlItems, NTL_TABOO_TYPES, {}),
      ]));
    }
  }

  return out;
}

/**
 * 是否有值得固化的成人体系配置（导出兜底判断）
 */
export function hasMeaningfulSystemDigest(cfg) {
  cfg = cfg || {};
  if (Array.isArray(cfg.worldviewPresetItems) && cfg.worldviewPresetItems.length) return true;
  if (cfg.adultWorldframe && cfg.adultWorldframe !== 'generic') return true;
  if (cfg.nsfwEnabled && (
    (Array.isArray(cfg.flavorItems) && cfg.flavorItems.length)
    || (Array.isArray(cfg.postureItems) && cfg.postureItems.length)
    || (Array.isArray(cfg.speechItems) && cfg.speechItems.length)
  )) return true;
  if (cfg.ntlEnabled && Array.isArray(cfg.ntlTabooItems) && cfg.ntlTabooItems.length) return true;
  return false;
}

export function isSystemDigestComment(comment) {
  return String(comment || '').indexOf(SYSTEM_DIGEST_PREFIX) === 0;
}

export function isSystemDigestEntry(entry) {
  return isAdultDigestEntry(entry);
}

export function digestEntryComment(entry) {
  return entryExportComment(entry);
}

function findSystemAnchorIndex(list) {
  for (var i = 0; i < list.length; i++) {
    var e = list[i];
    if (!e) continue;
    if (isAdultDigestEntry(e) || isMvuSystemEntry(e) || isCorruptionRulesEntry(e) || isAffectionRulesEntry(e)) {
      return i;
    }
  }
  return -1;
}

/**
 * upsert 体系总纲条目：已存在原地更新（保留位置）；新条目插入到首个系统锚点之前
 * @returns {object[]} 新数组
 */
export function upsertSystemDigestEntries(entries, newEntries) {
  var list = Array.isArray(entries) ? entries.slice() : [];
  if (!Array.isArray(newEntries) || !newEntries.length) return list;

  var anchor = findSystemAnchorIndex(list);
  var pendingInsert = [];

  newEntries.forEach(function(ne) {
    if (!ne || ne.owner !== WB_OWNER.adult) return;
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i]
        && String(list[i].owner || '') === String(ne.owner)
        && String(list[i].ownerSlot || '') === String(ne.ownerSlot)) {
        idx = i;
        break;
      }
    }
    if (idx >= 0) {
      list[idx] = upsertWorldbookEntry([list[idx]], ne, {
        owner: ne.owner,
        ownerSlot: ne.ownerSlot,
        id: ne.id,
      })[0];
    } else {
      pendingInsert.push(ne);
    }
  });

  if (!pendingInsert.length) return list;
  pendingInsert.sort(function(a, b) { return (b.order || 0) - (a.order || 0); });
  var at = anchor >= 0 ? anchor : 0;
  var normalized = pendingInsert.map(function(ne) {
    return upsertWorldbookEntry([], ne, { owner: ne.owner, ownerSlot: ne.ownerSlot, id: ne.id })[0];
  });
  return list.slice(0, at).concat(normalized).concat(list.slice(at));
}
