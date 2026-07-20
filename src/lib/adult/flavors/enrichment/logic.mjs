/**
 * NSFW 口味丰满：共享维度、门禁与扩写提示
 * 增强块数据见 catalog.mjs
 */
import { NSFW_FLAVOR_ENRICHMENT } from './catalog.mjs';

export var NSFW_FLAVOR_DEFAULT_MIN_CHARS = 280;

/** 所有口味共用的底线维度（与口味专属 mustCover 合并） */
export var FLAVOR_SHARED_DIMENSIONS = [
  {
    id: 'psyche',
    label: '心理动机与自我叙事',
    signals: ['心理', '自我', '动机', '内心', '害怕', '渴望', '羞耻', 'rational', 'core_desire', 'sexual_psychology', 'forbidden_tint'],
  },
  {
    id: 'body',
    label: '身体反应与感官细节',
    signals: ['身体', '敏感', '呼吸', '颤抖', '体温', '喘息', '触感', 'erogenous', 'arousal', 'body', 'sensory'],
  },
  {
    id: 'relation',
    label: '关系动态与亲密距离',
    signals: ['关系', '距离', '权力', '依赖', '信任', '占有', '服从', 'attachment', 'power', 'relationship'],
  },
  {
    id: 'limits',
    label: '边界 Limits 与安全信号',
    signals: ['边界', '极限', 'Limits', '安全', '拒绝', '同意', 'consent', '安全词', '底线'],
  },
  {
    id: 'after',
    label: '事后情绪与余波',
    signals: ['事后', '余波', 'aftercare', '拥抱', '独处', '冷静', '后悔', '沉溺', 'attachment_after'],
  },
];

export { NSFW_FLAVOR_ENRICHMENT };

export function applyFlavorEnrichment(presets) {
  if (!presets || typeof presets !== 'object') return presets;
  Object.keys(presets).forEach(function(id) {
    var base = presets[id];
    var en = NSFW_FLAVOR_ENRICHMENT[id];
    if (!base || !en) return;
    base.mustCover = (en.mustCover || []).slice();
    base.writingGuide = String(en.writingGuide || '');
    base.antiPatterns = (en.antiPatterns || []).slice();
    base.densityHint = Math.max(
      NSFW_FLAVOR_DEFAULT_MIN_CHARS,
      Math.floor(Number(en.densityHint) || NSFW_FLAVOR_DEFAULT_MIN_CHARS)
    );
    base.signals = (en.signals || []).slice();
  });
  return presets;
}

/**
 * 合并多口味的丰满要求
 * @returns {{
 *   labels: string[],
 *   mustCover: string[],
 *   writingGuides: string[],
 *   antiPatterns: string[],
 *   densityHint: number,
 *   dimensions: Array<{ id: string, label: string, signals: string[] }>
 * }}
 */
export function collectFlavorEnrichment(items, presets) {
  var list = Array.isArray(items) ? items : [];
  var labels = [];
  var mustCover = [];
  var writingGuides = [];
  var antiPatterns = [];
  var densityHint = NSFW_FLAVOR_DEFAULT_MIN_CHARS;
  var dimMap = Object.create(null);
  var coverSeen = Object.create(null);
  var antiSeen = Object.create(null);

  FLAVOR_SHARED_DIMENSIONS.forEach(function(d) {
    dimMap[d.id] = {
      id: d.id,
      label: d.label,
      signals: d.signals.slice(),
    };
  });

  list.forEach(function(it, idx) {
    if (!it || !it.id) return;
    var f = presets && presets[it.id];
    var en = NSFW_FLAVOR_ENRICHMENT[it.id] || {};
    var label = (f && f.label) || it.id;
    labels.push(label + (idx === 0 ? '（主）' : ''));
    densityHint = Math.max(densityHint, Math.floor(Number(en.densityHint) || NSFW_FLAVOR_DEFAULT_MIN_CHARS));
    if (en.writingGuide) writingGuides.push('【' + label + '】' + en.writingGuide);
    (en.mustCover || []).forEach(function(m) {
      var key = String(m || '').trim();
      if (!key || coverSeen[key]) return;
      coverSeen[key] = true;
      mustCover.push(key);
      var dimId = 'flavor_' + it.id + '_' + mustCover.length;
      dimMap[dimId] = {
        id: dimId,
        label: key,
        signals: (en.signals || []).concat(key.split(/[与和、\/]/).map(function(s) { return s.trim(); }).filter(function(s) { return s.length >= 2; })),
      };
    });
    (en.antiPatterns || []).forEach(function(a) {
      var key = String(a || '').trim();
      if (!key || antiSeen[key]) return;
      antiSeen[key] = true;
      antiPatterns.push(key);
    });
    if (en.signals && dimMap.psyche) {
      en.signals.forEach(function(s) {
        if (dimMap.psyche.signals.indexOf(s) < 0) dimMap.psyche.signals.push(s);
      });
    }
  });

  return {
    labels: labels,
    mustCover: mustCover,
    writingGuides: writingGuides,
    antiPatterns: antiPatterns,
    densityHint: densityHint,
    dimensions: Object.keys(dimMap).map(function(k) { return dimMap[k]; }),
  };
}

export function compactCharCount(text) {
  return String(text || '').replace(/\s+/g, '').length;
}

/** 从人物档案/JSON/纯文本提取用于丰满验收的正文 */
export function extractFlavorRichnessText(input) {
  if (input == null) return '';
  if (typeof input === 'string') return input;
  if (typeof input !== 'object') return String(input);
  var parts = [];
  if (input.NSFW_information) parts.push(JSON.stringify(input.NSFW_information));
  if (input.nsfw) parts.push(JSON.stringify(input.nsfw));
  if (input.attrs && input.attrs.nsfw) parts.push(JSON.stringify(input.attrs.nsfw));
  if (input.attrs && input.attrs.adult) parts.push(JSON.stringify(input.attrs.adult));
  if (input.content) parts.push(String(input.content));
  if (input.profile) return extractFlavorRichnessText(input.profile);
  if (!parts.length) parts.push(JSON.stringify(input));
  return parts.join('\n');
}

function signalHit(text, lower, sig) {
  var s = String(sig || '').trim();
  if (!s || s.length < 2) return false;
  if (/[a-z_]/i.test(s)) return lower.indexOf(s.toLowerCase()) >= 0;
  return text.indexOf(s) >= 0;
}

/**
 * 口味丰满门禁（对齐恶堕 evaluateArchiveRichness 思路）
 * 硬门槛：字数 + 禁占位 + 5 条共享维度；口味专属维至少命中一半。
 * @returns {{ ok: boolean, total: number, minChars: number, weakDimensions: string[], placeholder: boolean }}
 */
export function evaluateFlavorRichness(textOrProfile, items, opts) {
  opts = opts || {};
  var presets = opts.presets || null;
  var collected = collectFlavorEnrichment(items, presets);
  var text = extractFlavorRichnessText(textOrProfile);
  var total = compactCharCount(text);
  var minChars = Math.max(
    NSFW_FLAVOR_DEFAULT_MIN_CHARS,
    Math.floor(Number(opts.minChars) || collected.densityHint || NSFW_FLAVOR_DEFAULT_MIN_CHARS)
  );
  var weakDimensions = [];
  var placeholder = /待填充|（待填充）|TODO|TBD|一笔带过|原文未提及|N\/A/i.test(text);
  var lower = text.toLowerCase();

  if (total < minChars) {
    weakDimensions.push('信息密度不足（' + total + '<' + minChars + '字）');
  }
  if (placeholder) {
    weakDimensions.push('含占位/空话');
  }

  FLAVOR_SHARED_DIMENSIONS.forEach(function(dim) {
    var hit = (dim.signals || []).some(function(sig) { return signalHit(text, lower, sig); });
    if (!hit) weakDimensions.push(dim.label);
  });

  var flavorDims = collected.mustCover || [];
  if (flavorDims.length) {
    var flavorHits = 0;
    var missed = [];
    flavorDims.forEach(function(label) {
      var words = String(label).split(/[与和、\/（）\s]/).map(function(s) { return s.trim(); }).filter(function(s) { return s.length >= 2; });
      var enSignals = [];
      (Array.isArray(items) ? items : []).forEach(function(it) {
        var en = NSFW_FLAVOR_ENRICHMENT[it && it.id] || {};
        (en.signals || []).forEach(function(s) { enSignals.push(s); });
      });
      var hit = words.concat(enSignals).some(function(sig) { return signalHit(text, lower, sig); });
      if (hit) flavorHits++;
      else missed.push(label);
    });
    var need = Math.max(1, Math.ceil(flavorDims.length * 0.5));
    if (flavorHits < need) {
      weakDimensions.push('口味专属维度偏少（' + flavorHits + '/' + flavorDims.length + '）：' + missed.slice(0, 3).join('、'));
    }
  }

  return {
    ok: weakDimensions.length === 0,
    total: total,
    minChars: minChars,
    weakDimensions: weakDimensions,
    placeholder: placeholder,
    labels: collected.labels.slice(),
  };
}

export function buildFlavorExpandSystemPrompt(items, opts) {
  opts = opts || {};
  var collected = collectFlavorEnrichment(items, opts.presets);
  return [
    '你是角色卡成人层扩写编辑。下文在所选 NSFW 口味下偏薄，请大幅加厚，写透必写维度。',
    '口味：' + (collected.labels.join('、') || '通用'),
    '必写维度：' + FLAVOR_SHARED_DIMENSIONS.map(function(d) { return d.label; }).concat(collected.mustCover).join('；'),
    '目标：成人相关正文去空白后不少于 ' + collected.densityHint + ' 字；禁止提纲、空话、（待填充）、一笔带过。',
    '保持原有可靠事实与人设，只补细节与可演内容；只输出加厚后的正文或完整 JSON（若输入是 JSON 则仍输出 JSON）。',
  ].join('\n');
}

export function buildFlavorExpandUserPrompt(opts) {
  var o = opts || {};
  var parts = [];
  parts.push('【薄弱维度】' + (Array.isArray(o.weakDimensions) ? o.weakDimensions.join('、') : '信息密度不足'));
  parts.push('【目标最少字数】' + (o.minChars || NSFW_FLAVOR_DEFAULT_MIN_CHARS));
  if (o.flavorHint) parts.push(String(o.flavorHint).trim());
  var ctxMax = o.contextMax != null ? o.contextMax : 20000;
  var bodyMax = o.bodyMax != null ? o.bodyMax : 40000;
  if (o.context) parts.push('【角色/条目上下文】\n' + String(o.context).trim().slice(0, ctxMax));
  parts.push('【待加厚内容】\n' + String(o.text || '').trim().slice(0, bodyMax));
  return parts.join('\n\n');
}
