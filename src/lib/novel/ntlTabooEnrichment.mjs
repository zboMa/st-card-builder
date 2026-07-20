/**
 * NTL 禁忌类型丰满规范：必写维度、写作指南、反模式、密度门槛与扩写提示
 * 对标 nsfwFlavorEnrichment；与 NSFW 解耦，可单独开或叠加。
 */

export var NTL_TABOO_DEFAULT_MIN_CHARS = 260;

/** NTL 共享底线维度 */
export var NTL_SHARED_DIMENSIONS = [
  {
    id: 'power',
    label: '权力不对等与掌控结构',
    signals: ['权力', '不对等', '掌控', '服从', '压迫', '主导', 'powerDynamic', 'dominantRole'],
  },
  {
    id: 'motive',
    label: '禁忌动机与越界诱因',
    signals: ['禁忌', '动机', '越界', '诱因', '背德', '不该', 'tabooThemes', 'coercionHint'],
  },
  {
    id: 'cost',
    label: '道德/情感代价',
    signals: ['代价', '道德', '内疚', '罪恶', '撕裂', '冲突', 'moralConflict', 'emotionalCost'],
  },
  {
    id: 'secret',
    label: '秘密与暴露风险',
    signals: ['秘密', '隐瞒', '暴露', '地下', '不能公开', 'secrets', '隐秘'],
  },
  {
    id: 'afterfeel',
    label: '事后感受（罪疚/刺激/合理化）',
    signals: ['事后', '罪疚', '刺激', '合理化', '反复', '无所谓', '余波', 'emotionalCost'],
  },
];

/**
 * 每类 NTL 增强块（与 NTL_TABOO_TYPES 键对齐，含百破）
 */
export var NTL_TABOO_ENRICHMENT = {
  age_gap: {
    mustCover: ['成熟度差如何显形', '照护/依赖或反向诱惑', '社会目光下的自我审查', '双方如何合理化年龄差'],
    writingGuide: '张力来自成熟度与人生阶段不对等，不是猎奇数字。写清谁更懂规则、谁更慌、谁在利用「成熟」。',
    antiPatterns: ['只写年龄数字无心理差', '美化剥削无代价', '忽略社会目光压力'],
    densityHint: 260,
    signals: ['年龄', '成熟', '依赖', '照护', '差距', '社会'],
  },
  status_gap: {
    mustCover: ['身份边界的具体规则', '越界如何发生', '职业/名分风险', '公私场景切换时的态度差'],
    writingGuide: '师生/医患/上下级等：先写清「本不该」的制度边界，再写裂缝如何被踩开。',
    antiPatterns: ['身份只作标签', '无制度风险', '越界无过程'],
    densityHint: 260,
    signals: ['身份', '师生', '上下级', '边界', '名分', '职业', '越界'],
  },
  emotional_forbidden: {
    mustCover: ['「不该爱」的具体对象关系', '禁忌爱恋的触发瞬间', '对既有承诺/仇恨的背叛感', '无法抽离的情感黏着'],
    writingGuide: '爱上不该爱的人：朋友伴侣、仇人之子、亡者影子。写清情感伦理账，而不只是偷情情节。',
    antiPatterns: ['无伦理背景的出轨套路', '瞬间忘却既有关系', '无视背叛后果'],
    densityHint: 280,
    signals: ['不该爱', '背叛', '禁忌', '影子', '黏着', '伦理', '朋友'],
  },
  moral_conflict: {
    mustCover: ['明知故犯的具体抉择', '自我辩解与自我撕裂', '被利用仍无法离开的机制', '每次越界后的道德余震'],
    writingGuide: '核心是「知道错还停不下来」。写清理性如何败给欲望/恐惧/依赖。',
    antiPatterns: ['只有爽没有罪', '黑白脸谱无挣扎', '道德冲突当装饰'],
    densityHint: 280,
    signals: ['明知', '故犯', '挣扎', '辩解', '无法离开', '余震', '利用'],
  },
  situational: {
    mustCover: ['危险/公共场景的具体约束', '场景如何放大刺激', '被发现的风险路径', '离开场景后的落差'],
    writingGuide: '刺激来自场景而非关系本身。写清地点规则、声音光线、随时可能被打断的压迫。',
    antiPatterns: ['换皮卧室戏', '无发现风险', '场景只作背景板'],
    densityHint: 260,
    signals: ['公共', '危险', '场景', '被发现', '打断', '风险', '场合'],
  },
  power_coercion: {
    mustCover: ['胁迫手段的具体形态', '服从如何被训练/逼出', '反抗空间是否存在', '胁迫下的情绪代价与快感并存'],
    writingGuide: 'NTL 经典轴：权力压迫与服从。须可 RP——写清杠杆（把柄/资源/暴力威胁氛围），禁止空喊「很强制」。',
    antiPatterns: ['无杠杆的硬来', '抹掉受害者能动性又不写代价', '美化暴力无心理账'],
    densityHint: 300,
    signals: ['胁迫', '强迫', '服从', '把柄', '压迫', '杠杆', '反抗'],
  },
  secret_affair: {
    mustCover: ['地下关系的联络与掩护', '对局外人的谎言成本', '差点暴露的惊险', '秘密本身如何成为瘾'],
    writingGuide: '不能公开的关系：张力在隐瞒与共犯。写清双面生活与谎言如何腐蚀信任。',
    antiPatterns: ['毫无掩饰的公开亲密', '无暴露风险', '秘密只作设定一句'],
    densityHint: 260,
    signals: ['秘密', '地下', '隐瞒', '谎言', '暴露', '掩护', '偷'],
  },
  redemption_captor: {
    mustCover: ['敌对/俘获的初始结构', '吸引如何从恨里长出来', '斯德哥尔摩或反向救赎的心理步骤', '救赎是否真实或只是幻觉'],
    writingGuide: '敌对中被吸引：写清从刀到体温的渐变，以及「救我/被我救」是否可靠。',
    antiPatterns: ['瞬间爱上仇敌', '消解敌对无过程', '救赎鸡汤空转'],
    densityHint: 280,
    signals: ['敌对', '俘获', '救赎', '斯德哥尔摩', '恨', '吸引', '幻觉'],
  },
  yuri_destruction: {
    mustCover: [
      '原有或潜在的女女纽带（爱恋/亲密/承诺）',
      '破坏路径（介入者/自我崩解/外部压力）',
      '被撕开时双方（或多方）的心理账',
      '破坏后的关系残片与禁忌快感/悔恨',
    ],
    writingGuide: '百破＝百合破坏：张力来自「本可完整的百合被撕开」。先写稳原纽带，再写裂缝与侵占/瓦解；禁止把百合仅当背景板一秒拆掉。',
    antiPatterns: [
      '无百合铺垫直接拆散',
      '把百破写成单纯 NTR 换皮',
      '忽略被破坏方的悔恨或沉溺',
      '抹去原女女关系的重量',
    ],
    densityHint: 300,
    signals: ['百合', '百破', '破坏', '介入', '撕开', '侵占', '女女', '纽带', '瓦解', '残片'],
  },
};

export function applyNtlTabooEnrichment(tabooTypes) {
  if (!tabooTypes || typeof tabooTypes !== 'object') return tabooTypes;
  Object.keys(tabooTypes).forEach(function(id) {
    var base = tabooTypes[id];
    var en = NTL_TABOO_ENRICHMENT[id];
    if (!base || !en) return;
    base.mustCover = (en.mustCover || []).slice();
    base.writingGuide = String(en.writingGuide || '');
    base.antiPatterns = (en.antiPatterns || []).slice();
    base.densityHint = Math.max(
      NTL_TABOO_DEFAULT_MIN_CHARS,
      Math.floor(Number(en.densityHint) || NTL_TABOO_DEFAULT_MIN_CHARS)
    );
    base.signals = (en.signals || []).slice();
  });
  return tabooTypes;
}

/**
 * @returns {{
 *   labels: string[],
 *   mustCover: string[],
 *   writingGuides: string[],
 *   antiPatterns: string[],
 *   densityHint: number
 * }}
 */
export function collectNtlEnrichment(typeIds, tabooTypes) {
  var list = Array.isArray(typeIds) ? typeIds : [];
  var labels = [];
  var mustCover = [];
  var writingGuides = [];
  var antiPatterns = [];
  var densityHint = NTL_TABOO_DEFAULT_MIN_CHARS;
  var coverSeen = Object.create(null);
  var antiSeen = Object.create(null);

  list.forEach(function(id) {
    var info = tabooTypes && tabooTypes[id];
    var en = NTL_TABOO_ENRICHMENT[id] || {};
    var label = (info && info.label) || id;
    labels.push(label);
    densityHint = Math.max(densityHint, Math.floor(Number(en.densityHint) || NTL_TABOO_DEFAULT_MIN_CHARS));
    if (en.writingGuide) writingGuides.push('【' + label + '】' + en.writingGuide);
    (en.mustCover || []).forEach(function(m) {
      var key = String(m || '').trim();
      if (!key || coverSeen[key]) return;
      coverSeen[key] = true;
      mustCover.push(key);
    });
    (en.antiPatterns || []).forEach(function(a) {
      var key = String(a || '').trim();
      if (!key || antiSeen[key]) return;
      antiSeen[key] = true;
      antiPatterns.push(key);
    });
  });

  return {
    labels: labels,
    mustCover: mustCover,
    writingGuides: writingGuides,
    antiPatterns: antiPatterns,
    densityHint: densityHint,
  };
}

export function compactNtlCharCount(text) {
  return String(text || '').replace(/\s+/g, '').length;
}

/** 从人物/实体提取 NTL 相关正文供验收 */
export function extractNtlRichnessText(input) {
  if (input == null) return '';
  if (typeof input === 'string') return input;
  if (typeof input !== 'object') return String(input);
  var parts = [];
  if (input.attrs && input.attrs.ntl) parts.push(JSON.stringify(input.attrs.ntl));
  if (input.ntl) parts.push(JSON.stringify(input.ntl));
  if (input.profile && input.profile.ntl) parts.push(JSON.stringify(input.profile.ntl));
  if (input.content) parts.push(String(input.content));
  if (input.NSFW_information && input.NSFW_information.ntl) {
    parts.push(JSON.stringify(input.NSFW_information.ntl));
  }
  if (!parts.length && input.attrs) parts.push(JSON.stringify(input.attrs));
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
 * NTL 丰满门禁
 * @returns {{ ok: boolean, total: number, minChars: number, weakDimensions: string[], placeholder: boolean, labels: string[] }}
 */
export function evaluateNtlRichness(textOrEntity, typeIds, opts) {
  opts = opts || {};
  var tabooTypes = opts.tabooTypes || null;
  var collected = collectNtlEnrichment(typeIds, tabooTypes);
  var text = extractNtlRichnessText(textOrEntity);
  var total = compactNtlCharCount(text);
  var minChars = Math.max(
    NTL_TABOO_DEFAULT_MIN_CHARS,
    Math.floor(Number(opts.minChars) || collected.densityHint || NTL_TABOO_DEFAULT_MIN_CHARS)
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

  NTL_SHARED_DIMENSIONS.forEach(function(dim) {
    var hit = (dim.signals || []).some(function(sig) { return signalHit(text, lower, sig); });
    if (!hit) weakDimensions.push(dim.label);
  });

  var flavorDims = collected.mustCover || [];
  if (flavorDims.length) {
    var hits = 0;
    var missed = [];
    flavorDims.forEach(function(label) {
      var words = String(label).split(/[与和、\/（）\s]/).map(function(s) { return s.trim(); }).filter(function(s) { return s.length >= 2; });
      var enSignals = [];
      (Array.isArray(typeIds) ? typeIds : []).forEach(function(id) {
        var en = NTL_TABOO_ENRICHMENT[id] || {};
        (en.signals || []).forEach(function(s) { enSignals.push(s); });
      });
      var hit = words.concat(enSignals).some(function(sig) { return signalHit(text, lower, sig); });
      if (hit) hits++;
      else missed.push(label);
    });
    var need = Math.max(1, Math.ceil(flavorDims.length * 0.5));
    if (hits < need) {
      weakDimensions.push('NTL 专属维度偏少（' + hits + '/' + flavorDims.length + '）：' + missed.slice(0, 3).join('、'));
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

export function buildNtlExpandSystemPrompt(typeIds, opts) {
  opts = opts || {};
  var collected = collectNtlEnrichment(typeIds, opts.tabooTypes);
  return [
    '你是角色卡 NTL（禁忌张力）扩写编辑。下文在所选禁忌方向下偏薄，请大幅加厚，写透必写维度。',
    '禁忌类型：' + (collected.labels.join('、') || '通用 NTL'),
    '必写维度：' + NTL_SHARED_DIMENSIONS.map(function(d) { return d.label; }).concat(collected.mustCover).join('；'),
    '目标：NTL 相关正文去空白后不少于 ' + collected.densityHint + ' 字；禁止提纲、空话、（待填充）。',
    '须写满可 RP 的张力机制与情绪代价；禁忌核心在「做了之后的感受」。',
    '保持原有可靠事实；只输出加厚后的正文或完整 JSON（输入是 JSON 则仍输出 JSON）。',
  ].join('\n');
}

export function buildNtlExpandUserPrompt(opts) {
  var o = opts || {};
  var ctxMax = o.contextMax != null ? o.contextMax : 20000;
  var bodyMax = o.bodyMax != null ? o.bodyMax : 40000;
  var parts = [];
  parts.push('【薄弱维度】' + (Array.isArray(o.weakDimensions) ? o.weakDimensions.join('、') : '信息密度不足'));
  parts.push('【目标最少字数】' + (o.minChars || NTL_TABOO_DEFAULT_MIN_CHARS));
  if (o.ntlHint) parts.push(String(o.ntlHint).trim());
  if (o.context) parts.push('【角色/条目上下文】\n' + String(o.context).trim().slice(0, ctxMax));
  parts.push('【待加厚内容】\n' + String(o.text || '').trim().slice(0, bodyMax));
  return parts.join('\n\n');
}

/**
 * 规范化 NTL 条目：[{ id, note }] 或纯 id 列表
 */
export function normalizeNtlTabooItems(rawItems, legacyTypeIds, validIds) {
  var out = [];
  var seen = Object.create(null);
  var allow = validIds || Object.keys(NTL_TABOO_ENRICHMENT);
  var list = Array.isArray(rawItems) ? rawItems : [];
  list.forEach(function(it) {
    if (!it) return;
    var id = typeof it === 'string' ? it : String(it.id || '').trim();
    if (!id || seen[id] || allow.indexOf(id) < 0) return;
    seen[id] = true;
    var note = typeof it === 'string' ? '' : String(it.note == null ? '' : it.note).trim();
    out.push({ id: id, note: note });
  });
  if (!out.length && Array.isArray(legacyTypeIds)) {
    legacyTypeIds.forEach(function(id) {
      var s = String(id || '').trim();
      if (!s || seen[s] || allow.indexOf(s) < 0) return;
      seen[s] = true;
      out.push({ id: s, note: '' });
    });
  }
  return out;
}

/**
 * 由已选 NTL 类型构建加厚提示块
 * @param {string[]|Array<{id:string,note?:string}>} typeIdsOrItems
 */
export function buildNtlTabooHintFromTypes(typeIdsOrItems, opts) {
  opts = opts || {};
  var tabooTypes = opts.tabooTypes;
  var items = normalizeNtlTabooItems(typeIdsOrItems, []);
  // 兼容纯 string[]
  if (!items.length && Array.isArray(typeIdsOrItems)) {
    items = normalizeNtlTabooItems([], typeIdsOrItems);
  }
  var list = items.map(function(it) { return it.id; }).filter(function(id) {
    return tabooTypes && tabooTypes[id];
  });
  if (!list.length || !tabooTypes) return '';

  var noteMap = Object.create(null);
  items.forEach(function(it) { if (it && it.id) noteMap[it.id] = it.note || ''; });

  var collected = collectNtlEnrichment(list, tabooTypes);
  var lines = [];
  lines.push('\n【NTL 禁忌方向·丰满写作规范】');
  if (opts.intro) lines.push(opts.intro);

  list.forEach(function(id, idx) {
    var info = tabooTypes[id];
    if (!info) return;
    var notePart = noteMap[id] ? ('；用户补充：' + noteMap[id]) : '';
    lines.push((idx + 1) + '. ' + info.label + '：' + (info.description || '') + notePart);
    if (info.writingGuide) lines.push('   写法：' + info.writingGuide);
  });

  lines.push('【必写维度·须写透】');
  NTL_SHARED_DIMENSIONS.forEach(function(dim, i) {
    lines.push((i + 1) + ') ' + dim.label);
  });
  collected.mustCover.forEach(function(lab) {
    lines.push('- ' + lab);
  });

  if (collected.writingGuides.length) {
    lines.push('【写作指南】');
    collected.writingGuides.forEach(function(g) { lines.push('- ' + g); });
  }
  if (collected.antiPatterns.length) {
    lines.push('禁止/避免：' + collected.antiPatterns.join(' / '));
  }
  lines.push('【丰满硬约束】NTL 相关正文去空白后≥' + collected.densityHint
    + '字；须落到权力结构、禁忌诱因、道德代价、秘密风险与事后感受；禁止提纲/空话/待填充。');
  if (opts.footer) lines.push(opts.footer);
  return lines.join('\n');
}
