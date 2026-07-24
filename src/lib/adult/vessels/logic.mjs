/**
 * 成人世界观载体 · 推断 / 丰满 / 门禁 / 扩写 / Canon
 */
import {
  VESSEL_DEFAULT_MIN_CHARS,
  VESSEL_KIND_LABELS,
  VESSEL_SHARED_DIMENSIONS,
} from './kinds.mjs';
import {
  WORLDFRAMES,
  WORLDFRAME_IDS,
  WORLDFRAME_VESSEL_ENRICHMENT,
} from './frames/catalog.mjs';
import { FLAVOR_VESSEL_OVERLAYS } from './overlays/flavor.mjs';
import { NTL_VESSEL_OVERLAYS, NTL_OVERLAY_ALIASES } from './overlays/ntl.mjs';
import { countTokens, truncateToTokens } from '../../assistant/contextManager.mjs';
import { ADULT_CONSENT_BOUNDARY_SHORT } from '../shared/consentBoundary.mjs';

function asList(v) {
  if (Array.isArray(v)) return v.map(function(x) { return String(x || '').trim(); }).filter(Boolean);
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
}

function compactCharCount(text) {
  return String(text || '').replace(/\s+/g, '').length;
}

function signalHit(text, lower, sig) {
  var s = String(sig || '').trim();
  if (!s || s.length < 2) return false;
  if (/[a-z_]/i.test(s)) return lower.indexOf(s.toLowerCase()) >= 0;
  return text.indexOf(s) >= 0;
}

function scoreWorldframe(text, frame) {
  var t = String(text || '');
  var lower = t.toLowerCase();
  var score = 0;
  (frame.signals || []).forEach(function(sig) {
    if (signalHit(t, lower, sig)) score += 3;
  });
  (frame.lexicon || []).forEach(function(sig) {
    if (signalHit(t, lower, sig)) score += 1;
  });
  return score;
}

/**
 * 从语料/实体推断世界观框架
 * @param {{ contextText?: string, entities?: object[], worldbookEntries?: object[], forced?: string }} opts
 */
export function inferWorldframe(opts) {
  opts = opts || {};
  var forced = String(opts.forced || '').trim();
  if (forced && WORLDFRAMES[forced]) {
    return { id: forced, label: WORLDFRAMES[forced].label, confidence: 1, source: 'forced' };
  }

  var chunks = [];
  if (opts.contextText) chunks.push(String(opts.contextText));
  (opts.entities || []).forEach(function(e) {
    if (!e) return;
    if (e.type === 'lore' || e.type === 'faction' || e.type === 'nsfw') {
      chunks.push(e.name || '', e.summary || '', e.content || '');
      if (e.attrs && e.attrs.aspect) chunks.push(String(e.attrs.aspect));
    }
    if (e.type === 'item' && e.attrs) {
      chunks.push(String(e.attrs.abilities || ''), e.content || '');
    }
  });
  (opts.worldbookEntries || []).forEach(function(e) {
    if (!e) return;
    var c = String(e.comment || e.category || '');
    if (/世界观|worldview|设定|势力|faction/i.test(c) || e.category === 'worldview') {
      chunks.push(c, e.content || e.name || '');
    }
  });
  var text = chunks.join('\n');
  if (!text.trim()) {
    return { id: 'generic', label: WORLDFRAMES.generic.label, confidence: 0, source: 'empty' };
  }

  var best = 'generic';
  var bestScore = 0;
  WORLDFRAME_IDS.forEach(function(id) {
    if (id === 'generic') return;
    var s = scoreWorldframe(text, WORLDFRAMES[id]);
    if (s > bestScore) {
      bestScore = s;
      best = id;
    }
  });
  if (bestScore < 3) {
    return { id: 'generic', label: WORLDFRAMES.generic.label, confidence: 0.2, source: 'low_signal', scores: bestScore };
  }
  var confidence = Math.min(0.95, 0.35 + bestScore * 0.06);
  return {
    id: best,
    label: WORLDFRAMES[best].label,
    confidence: confidence,
    source: 'infer',
    scores: bestScore,
  };
}

/**
 * 汇总载体丰满要求
 */
export function collectVesselEnrichment(opts) {
  opts = opts || {};
  var frameId = (opts.worldframe && WORLDFRAMES[opts.worldframe]) ? opts.worldframe : 'generic';
  var frame = WORLDFRAMES[frameId];
  var frameEn = WORLDFRAME_VESSEL_ENRICHMENT[frameId] || WORLDFRAME_VESSEL_ENRICHMENT.generic;
  var flavorItems = Array.isArray(opts.flavorItems) ? opts.flavorItems : [];
  var ntlIds = Array.isArray(opts.ntlIds)
    ? opts.ntlIds
    : (Array.isArray(opts.ntlItems) ? opts.ntlItems.map(function(it) { return it && it.id; }).filter(Boolean) : []);

  var mustCover = (frameEn.mustCover || []).slice();
  var writingGuides = [];
  var antiPatterns = (frameEn.antiPatterns || []).concat(
    (frame.antiLexicon || []).map(function(w) { return '禁用错位语汇「' + w + '」'; })
  );
  var densityHint = Math.max(VESSEL_DEFAULT_MIN_CHARS, Math.floor(Number(frameEn.densityHint) || VESSEL_DEFAULT_MIN_CHARS));
  var signals = (frameEn.signals || []).concat(frame.lexicon || []).slice();
  var labels = [frame.label];

  writingGuides.push('【' + frame.label + '】' + (frameEn.writingGuide || ''));

  var coverSeen = Object.create(null);
  mustCover.forEach(function(m) { coverSeen[m] = true; });

  function addCover(list) {
    (list || []).forEach(function(m) {
      var k = String(m || '').trim();
      if (!k || coverSeen[k]) return;
      coverSeen[k] = true;
      mustCover.push(k);
    });
  }

  flavorItems.forEach(function(it, idx) {
    if (!it || !it.id) return;
    var ov = FLAVOR_VESSEL_OVERLAYS[it.id];
    if (!ov) return;
    labels.push((it.id) + (idx === 0 ? '（主口味载体）' : ''));
    addCover(ov.mustCover);
    if (ov.writingGuide) writingGuides.push('【口味载体·' + it.id + '】' + ov.writingGuide);
    (ov.antiPatterns || []).forEach(function(a) { antiPatterns.push(a); });
    (ov.signals || []).forEach(function(s) { signals.push(s); });
    densityHint = Math.max(densityHint, VESSEL_DEFAULT_MIN_CHARS);
  });

  ntlIds.forEach(function(id) {
    var resolved = NTL_OVERLAY_ALIASES[id] || id;
    var ov = NTL_VESSEL_OVERLAYS[resolved] || NTL_VESSEL_OVERLAYS[id];
    if (!ov) return;
    labels.push('NTL:' + id);
    addCover(ov.mustCover);
    if (ov.writingGuide) writingGuides.push('【NTL载体·' + id + '】' + ov.writingGuide);
    (ov.antiPatterns || []).forEach(function(a) { antiPatterns.push(a); });
    (ov.signals || []).forEach(function(s) { signals.push(s); });
    densityHint = Math.max(densityHint, VESSEL_DEFAULT_MIN_CHARS + 20);
  });

  return {
    worldframe: frameId,
    frameLabel: frame.label,
    labels: labels,
    mustCover: mustCover,
    writingGuides: writingGuides,
    antiPatterns: antiPatterns,
    densityHint: densityHint,
    signals: signals,
    lexicon: (frame.lexicon || []).slice(),
    antiLexicon: (frame.antiLexicon || []).slice(),
    vesselSeeds: (frame.vesselSeeds || []).slice(),
    dimensions: VESSEL_SHARED_DIMENSIONS.slice(),
  };
}

/**
 * 注入提示块
 */
export function buildVesselHint(opts) {
  opts = opts || {};
  if (opts.enabled === false) return '';
  var collected = collectVesselEnrichment(opts);
  var lines = [];
  lines.push('\n【世界观成人载体·丰满写作规范】');
  lines.push('框架：' + collected.frameLabel + '（' + collected.worldframe + '）');
  if (opts.intro) lines.push(opts.intro);
  lines.push('将 NSFW 口味与 NTL 物化为该世界中的器物/能力/场所/规则/组织；名称与机制必须使用框架语汇：'
    + collected.lexicon.slice(0, 12).join('、') + '。');
  lines.push('【建议挖取的载体种子】');
  collected.vesselSeeds.forEach(function(s) {
    lines.push('- [' + (VESSEL_KIND_LABELS[s.kind] || s.kind) + '] ' + s.nameHint);
  });
  lines.push('【必写维度·须写透】');
  VESSEL_SHARED_DIMENSIONS.forEach(function(d, i) {
    lines.push((i + 1) + ') ' + d.label);
  });
  collected.mustCover.forEach(function(m) {
    lines.push('- ' + m);
  });
  if (collected.writingGuides.length) {
    lines.push('【写作指南】');
    collected.writingGuides.forEach(function(g) { lines.push('- ' + g); });
  }
  if (collected.antiPatterns.length) {
    lines.push('禁止/避免：' + collected.antiPatterns.slice(0, 12).join(' / '));
  }
  lines.push('【数据结构】item/location/lore/faction 的 attrs.adult 须含：'
    + 'vesselKind, worldframe, eroticRole, powerLogic, costOrRisk, socialCover, '
    + 'triggers[], limits[], playIdeas[], relatedPersons[], flavorHooks[], ntlHooks[]；'
    + 'type=nsfw 同步填写。content 写【成人向用法】长文，去空白后建议≥' + collected.densityHint + '字。');
  lines.push('【丰满硬约束】禁止错位语汇；禁止只有气氛没有机制；每条载体须能挂钩至少一名人物。');
  lines.push(ADULT_CONSENT_BOUNDARY_SHORT);
  return lines.join('\n');
}

export function extractVesselRichnessText(input) {
  if (input == null) return '';
  if (typeof input === 'string') return input;
  if (typeof input !== 'object') return String(input);
  var parts = [];
  if (input.content) parts.push(String(input.content));
  if (input.summary) parts.push(String(input.summary));
  if (input.attrs && input.attrs.adult) parts.push(JSON.stringify(input.attrs.adult));
  if (input.attrs && (input.attrs.powerLogic || input.attrs.kind)) parts.push(JSON.stringify(input.attrs));
  if (input.adult) parts.push(JSON.stringify(input.adult));
  if (!parts.length) parts.push(JSON.stringify(input));
  return parts.join('\n');
}

/**
 * 载体丰满门禁
 */
export function evaluateVesselRichness(textOrEntity, opts) {
  opts = opts || {};
  var collected = collectVesselEnrichment(opts);
  var text = extractVesselRichnessText(textOrEntity);
  var total = compactCharCount(text);
  var minChars = Math.max(
    VESSEL_DEFAULT_MIN_CHARS,
    Math.floor(Number(opts.minChars) || collected.densityHint || VESSEL_DEFAULT_MIN_CHARS)
  );
  var weakDimensions = [];
  var placeholder = /待填充|（待填充）|TODO|TBD|一笔带过|原文未提及|N\/A|很涩|氛围道具/i.test(text);
  var lower = text.toLowerCase();

  if (total < minChars) {
    weakDimensions.push('信息密度不足（' + total + '<' + minChars + '字）');
  }
  if (placeholder) weakDimensions.push('含占位/空话');

  VESSEL_SHARED_DIMENSIONS.forEach(function(dim) {
    var hit = (dim.signals || []).some(function(sig) { return signalHit(text, lower, sig); });
    if (!hit) weakDimensions.push(dim.label);
  });

  // 框架语汇至少命中 1 个（generic 除外）
  if (collected.worldframe !== 'generic' && collected.lexicon.length) {
    var lexHit = collected.lexicon.some(function(sig) { return signalHit(text, lower, sig); });
    if (!lexHit) weakDimensions.push('未使用「' + collected.frameLabel + '」世界观语汇');
  }

  // 错位语汇
  var bad = [];
  (collected.antiLexicon || []).forEach(function(w) {
    if (signalHit(text, lower, w)) bad.push(w);
  });
  if (bad.length) {
    weakDimensions.push('含错位语汇：' + bad.slice(0, 4).join('、'));
  }

  var cover = collected.mustCover || [];
  if (cover.length) {
    var hits = 0;
    var missed = [];
    cover.forEach(function(label) {
      var words = String(label).split(/[与和、\/（）\s]/).map(function(s) { return s.trim(); }).filter(function(s) { return s.length >= 2; });
      var hit = words.concat(collected.signals || []).some(function(sig) { return signalHit(text, lower, sig); });
      if (hit) hits++;
      else missed.push(label);
    });
    var need = Math.max(2, Math.ceil(cover.length * 0.45));
    if (hits < need) {
      weakDimensions.push('载体专属维度偏少（' + hits + '/' + cover.length + '）：' + missed.slice(0, 3).join('、'));
    }
  }

  // 结构化字段检查（若传入实体）
  var adult = null;
  if (textOrEntity && typeof textOrEntity === 'object') {
    adult = (textOrEntity.attrs && textOrEntity.attrs.adult) || textOrEntity.adult || null;
    if (!adult && textOrEntity.attrs && textOrEntity.type === 'nsfw') adult = textOrEntity.attrs;
  }
  if (adult && typeof adult === 'object') {
    if (!String(adult.powerLogic || '').trim()) weakDimensions.push('缺 powerLogic');
    if (!String(adult.vesselKind || adult.kind || '').trim()) weakDimensions.push('缺 vesselKind/kind');
    if (!asList(adult.relatedPersons || adult.relatedNames).length && text.indexOf('相关') < 0) {
      weakDimensions.push('未挂钩人物');
    }
    if (!asList(adult.limits).length && text.indexOf('Limits') < 0 && text.indexOf('界限') < 0) {
      weakDimensions.push('缺 Limits');
    }
  }

  return {
    ok: weakDimensions.length === 0,
    total: total,
    minChars: minChars,
    weakDimensions: weakDimensions,
    placeholder: placeholder,
    worldframe: collected.worldframe,
    labels: collected.labels.slice(),
  };
}

export function buildVesselExpandSystemPrompt(opts) {
  var collected = collectVesselEnrichment(opts || {});
  return [
    '你是世界观成人载体扩写编辑。下文在「' + collected.frameLabel + '」框架下偏薄，请大幅加厚。',
    '必须使用框架语汇，写透机制/代价/伪装/Limits/人物挂钩。',
    '口味/NTL：' + (collected.labels.join('、') || '通用'),
    '禁止错位语汇：' + (collected.antiLexicon.join('、') || '无'),
    '输出保持原 JSON 结构，加厚 content 与 attrs.adult（或 nsfw attrs）。',
  ].join('\n');
}

export function buildVesselExpandUserPrompt(o) {
  o = o || {};
  var bodyMax = Math.max(8000, Math.floor(Number(o.bodyMax) || 40000));
  var parts = [];
  parts.push('薄弱维度：' + (Array.isArray(o.weakDimensions) ? o.weakDimensions.join('；') : ''));
  parts.push('目标密度：去空白后≥' + (o.minChars || VESSEL_DEFAULT_MIN_CHARS) + '字');
  if (o.vesselHint) parts.push(String(o.vesselHint).trim());
  if (o.context) parts.push('【上下文】\n' + String(o.context).trim());
  parts.push('【待加厚内容】\n' + truncateToTokens(String(o.text || '').trim(), bodyMax));
  return parts.join('\n\n');
}

/** 是否像载体实体 */
export function isVesselEntity(ent) {
  if (!ent || !ent.type) return false;
  if (ent.type === 'nsfw') return true;
  if (['item', 'location', 'lore', 'faction'].indexOf(ent.type) < 0) return false;
  var a = ent.attrs && ent.attrs.adult;
  if (!a) return false;
  return !!(a.vesselKind || a.powerLogic || a.eroticRole || (a.playIdeas && a.playIdeas.length));
}

export function listVesselEntities(entities) {
  return (entities || []).filter(isVesselEntity);
}

/** 人物正文是否提及已有载体名（软门禁） */
export function personMentionsVessels(personText, vessels) {
  var text = String(personText || '');
  if (!text.trim()) return { ok: false, mentioned: [], missing: true };
  var mentioned = [];
  (vessels || []).forEach(function(v) {
    if (!v || !v.name) return;
    if (text.indexOf(v.name) >= 0) mentioned.push(v.name);
  });
  return {
    ok: mentioned.length > 0 || !(vessels || []).length,
    mentioned: mentioned,
    missing: !!(vessels || []).length && !mentioned.length,
  };
}

export function formatVesselCanonBlock(entities, opts) {
  opts = opts || {};
  var budget = Math.max(1000, Math.floor(Number(opts.budget) || 8000));
  var list = listVesselEntities(entities);
  if (!list.length) return '';
  var lines = ['## 世界观成人载体'];
  if (opts.worldframeLabel) lines.push('框架：' + opts.worldframeLabel);
  lines.push('人物描写与恶堕须与这些载体互动，禁止另起互不相关的道具体系。');
  var used = countTokens(lines.join('\n'));
  list.forEach(function(e) {
    if (used >= budget) return;
    var a = (e.attrs && (e.type === 'nsfw' ? e.attrs : e.attrs.adult)) || {};
    var kind = a.vesselKind || a.kind || e.type;
    var line = '- [' + kind + '] ' + e.name
      + (a.powerLogic ? '｜机制：' + truncateToTokens(String(a.powerLogic), 80) : '')
      + (a.costOrRisk ? '｜代价：' + truncateToTokens(String(a.costOrRisk), 50) : '')
      + (asList(a.relatedPersons || a.relatedNames).length
        ? '｜人：' + asList(a.relatedPersons || a.relatedNames).slice(0, 6).join('、')
        : '')
      + (e.content ? '\n  ' + truncateToTokens(String(e.content).replace(/\s+/g, ' '), 120) : '');
    var lineTok = countTokens(line);
    if (used + lineTok > budget) return;
    lines.push(line);
    used += lineTok;
  });
  if (lines.length < 3) return '';
  return lines.join('\n');
}

/** 状态栏草案：当前可用载体 */
export function buildStatusBarVesselDraftFromEntities(entities, opts) {
  opts = opts || {};
  var list = listVesselEntities(entities).slice(0, 8);
  var paths = [];
  if (!list.length) {
    return { paths: [], note: '暂无成人载体实体（需在分析/世界书中挖出 item/nsfw 等）' };
  }
  var names = list.map(function(e) { return e.name; }).filter(Boolean);
  paths.push({
    path: 'stat.adult_vessels',
    label: '成人载体',
    value: names.join('、').slice(0, 200),
  });
  list.slice(0, 4).forEach(function(e, i) {
    var a = (e.attrs && (e.type === 'nsfw' ? e.attrs : e.attrs.adult)) || {};
    var v = [a.vesselKind || a.kind || e.type, a.powerLogic || e.summary || '']
      .filter(Boolean).join(' · ');
    if (!v) return;
    paths.push({
      path: 'stat.adult_vessel_' + (i + 1),
      label: String(e.name || '载体' + (i + 1)).slice(0, 24),
      value: v.slice(0, 200),
    });
  });
  return {
    paths: paths,
    note: '来自 ' + list.length + ' 条世界观成人载体草案（需在状态栏确认后写入）',
    worldframe: opts.worldframe || '',
  };
}
