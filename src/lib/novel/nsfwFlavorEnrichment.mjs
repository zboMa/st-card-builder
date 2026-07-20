/**
 * NSFW 口味丰满规范：必写维度、写作指南、反模式、密度门槛与扩写提示
 * 与恶堕档案门禁同思路——先写透，再字数/维度验收，偏薄则扩写。
 */
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

/**
 * 每口味增强块（与 NSFW_FLAVOR_PRESETS 键对齐）
 * mustCover: 口味专属必写（中文）
 * writingGuide: 如何写准
 * antiPatterns: 失败写法
 * densityHint: 成人相关正文建议最少字数（去空白）
 * signals: 额外验收关键词（并入专属维度）
 */
export var NSFW_FLAVOR_ENRICHMENT = {
  vanilla: {
    mustCover: ['温柔确认与双向意愿', '信任建立的具体行为', '亲密中的语言安抚', 'aftercare 的仪式感'],
    writingGuide: '情感优先于技巧。每一次推进都先写出对方的接收与回应；身体描写服务于「被珍惜」的感觉，而不是表演清单。',
    antiPatterns: ['无情感铺垫的直接插入', '把 consent 写成口头禅敷衍', '忽略事后的拥抱/确认'],
    densityHint: 280,
    signals: ['温柔', '信任', '确认', '安抚', '珍惜', '同意', 'aftercare'],
  },
  sweet: {
    mustCover: ['撒娇与被宠的互动循环', '爱意口头确认', '玩笑式亲密与笑声', '吃醋/吃味的轻张力'],
    writingGuide: '每一下触碰都在说「喜欢你」。用语气、小动作、昵称堆密度，避免只有形容词堆砌。',
    antiPatterns: ['冷感无回应', '用虐恋节奏写甜蜜', '只有肉戏没有爱意确认'],
    densityHint: 260,
    signals: ['撒娇', '宠', '喜欢', '昵称', '笑', '甜', '吃醋'],
  },
  slice_of_life: {
    mustCover: ['生活场景触发的自然亲密', '松弛的节奏与日常物件', '幽默或尴尬的真实瞬间', '事后仍回到日常的语气'],
    writingGuide: '性是生活的一部分，不是高潮事件。用厨房、沙发、通勤后的疲惫等锚点，写出「刚好发生」。',
    antiPatterns: ['强行高潮戏编排', '脱离人设的戏剧对白', '把日常写成偶像剧布景'],
    densityHint: 260,
    signals: ['日常', '沙发', '厨房', '自然', '松弛', '生活', '刚好'],
  },
  healing: {
    mustCover: ['创伤线索与触发点', '退缩信号与如何被接住', '重建信任的慢节奏', '安全感语言与身体边界'],
    writingGuide: '每一次触碰都在证明「你可以放心」。允许停顿、允许说停；快感服务于疗愈，不服务于征服。',
    antiPatterns: ['急于推进无视退缩', '用性代替沟通', '把创伤当情趣标签'],
    densityHint: 300,
    signals: ['创伤', '信任', '退缩', '安全', '治愈', '慢', '边界'],
  },
  intense: {
    mustCover: ['层层递进的感官堆叠', '失控前的生理临界', '呼吸/肌肉/温度的连续变化', '高潮前后的心理空白或过载'],
    writingGuide: '用具体感官句代替「很爽」。保持心理线不断：失控时仍要知道角色在害怕什么或贪恋什么。',
    antiPatterns: ['同义形容词堆砌', '油腻模板腔', '只有身体没有内心'],
    densityHint: 320,
    signals: ['感官', '失控', '颤抖', '过载', '临界', '喘息', '高潮'],
  },
  angst: {
    mustCover: ['痛苦与欲望的交织点', '自我伤害式亲密的代价', '救赎幻想与现实落差', '事后情绪后坐力'],
    writingGuide: '痛不是装饰，是动力。写清「为什么需要这场痛」，以及痛完之后是否更完整或更破碎。',
    antiPatterns: ['无代价的虐', '美化暴力', '忽略事后崩溃或麻木'],
    densityHint: 300,
    signals: ['痛苦', '代价', '救赎', '破碎', '后坐力', '恨', '需要'],
  },
  dark: {
    mustCover: ['道德模糊的具体选择', '胁迫氛围如何形成', '权力不对等的显形', '内疚/无力与快感并存'],
    writingGuide: '禁忌感来自「知道不对仍继续」的心理账本。氛围冷、选择烫；禁止轻松消解。',
    antiPatterns: ['轻浮消解禁忌', '无铺垫黑化', '把伤害写成纯浪漫'],
    densityHint: 300,
    signals: ['道德', '胁迫', '内疚', '无力', '禁忌', '代价', '模糊'],
  },
  despair: {
    mustCover: ['存在主义式的空洞感', '用身体确认「还活着」的动机', '麻木被短暂击穿的瞬间', '事后更空或短暂回温'],
    writingGuide: '深渊里的亲密要克制浪漫化。写清空洞、最后的挣扎、以及事后是否更冷。',
    antiPatterns: ['中二文艺腔空转', '浪漫化自毁', '忽略心理后果'],
    densityHint: 300,
    signals: ['空洞', '绝望', '麻木', '还活着', '自毁', '深渊', '挣扎'],
  },
  domination: {
    mustCover: ['规则与仪式的建立过程', '训练/渐进的阶段感', '心理从抗拒到接纳的转变', '安全词与 Limits 的可执行性'],
    writingGuide: '权力交换靠规则与反馈运转。写清命令如何下达、如何被遵守、违规如何处理，以及被支配方的内在变化。',
    antiPatterns: ['无铺垫直接硬来', '忽略安全词', '超出 Limits 的极端'],
    densityHint: 320,
    signals: ['规则', '仪式', '训练', '命令', '服从', '安全词', '渐进'],
  },
  brat: {
    mustCover: ['嘴硬挑衅的具体台词/动作', '被压制时的身体诚实', '驯服过程的拉扯回合', '挑衅背后的邀请动机'],
    writingGuide: 'Brat 的魅力在主动制造麻烦。写清「故意惹」与「其实要」的双轨，驯服是博弈不是碾压。',
    antiPatterns: ['真怒无情趣', '瞬间彻底压制无过程', '抹掉 brat 主动性'],
    densityHint: 300,
    signals: ['挑衅', '嘴硬', '驯服', '反抗', '诚实', '邀请', '拉扯'],
  },
  gentle_dom: {
    mustCover: ['以照顾为名的掌控细节', '温柔语气下的不可违抗', '赞美/确认作为控制手段', '被支配方的安心与依赖'],
    writingGuide: '绑好先问疼不疼，命令却像商量。掌控感来自被接住，而不是被吓住。',
    antiPatterns: ['冷暴力', '羞辱式支配', '忽视反馈'],
    densityHint: 300,
    signals: ['照顾', '温柔', '赞美', '安心', '掌控', '商量', '依赖'],
  },
  service: {
    mustCover: ['奉献/崇拜的具体行为', '以对方愉悦为成就感', '自我边界仍存在的证据', '被需要时的情绪高潮'],
    writingGuide: '快感来自「我能让你满足」。奉献有尊严：写清选择服务，而不是自我抹除。',
    antiPatterns: ['强迫服务', '无自尊的自我否定', '把臣服写成无人格'],
    densityHint: 280,
    signals: ['奉献', '崇拜', '服务', '满足', '被需要', '谦卑', '成就'],
  },
  pursuit: {
    mustCover: ['追逐与撤退的节奏', '距离感制造的期待', '猫鼠互动的主动权交换', '延迟满足的临界点'],
    writingGuide: '靠近一步退半步。张力在「还没得到」；写清猎人与猎物如何互相诱饵。',
    antiPatterns: ['直接扑倒省略过程', '单方面追逐无互动', '无期待积累'],
    densityHint: 280,
    signals: ['追逐', '距离', '期待', '撤退', '诱饵', '延迟', '猫鼠'],
  },
  seduction: {
    mustCover: ['引诱的阶梯（每步更越界一点）', '无辜/防线被侵蚀的迹象', '对方内心的挣扎与合理化', '不可回头点的标记'],
    writingGuide: '过程比结果迷人。每一步都让对方以为自己还能停，同时把退路拆掉一点。',
    antiPatterns: ['跳过快进', '对方毫无挣扎', '把引导写成单纯操纵无诱惑'],
    densityHint: 320,
    signals: ['引诱', '阶梯', '防线', '越界', '挣扎', '合理化', '觉醒'],
  },
  denial_surrender: {
    mustCover: ['抗拒的表层理由', '动摇的裂缝细节', '崩溃/投降的那一瞬', '沉溺后的情绪余波（解脱或羞耻）'],
    writingGuide: '完整弧光：抗拒→动摇→崩溃→沉溺。投降的一秒值得浓墨；沉溺后要有余震。',
    antiPatterns: ['直接放弃抵抗', '无内心拉扯', '沉溺后情绪真空'],
    densityHint: 320,
    signals: ['抗拒', '动摇', '崩溃', '投降', '沉溺', '解脱', '余波'],
  },
  enemies: {
    mustCover: ['恨意与欲望的并存句', '带刃的亲密（言语/动作）', '不愿承认在乎的瞬间', '暴力美学的上下文与代价'],
    writingGuide: '明明该恨却想要。靠近带着刀；偶尔露出的在乎比甜言更狠。',
    antiPatterns: ['突然变甜消解敌对', '无上下文暴力', '只有打没有欲'],
    densityHint: 300,
    signals: ['恨', '敌对', '刀', '粗暴', '在乎', '不愿承认', '撕裂'],
  },
  discipline: {
    mustCover: ['规则前提与违规事实', '惩罚的仪式步骤', '惩罚中的心理账', '罚后安抚与关系修复'],
    writingGuide: '规则→违规→惩罚→安抚闭环必须完整。罚是为了关系结构，不是为了虐而虐。',
    antiPatterns: ['只罚不安抚', '无规则乱罚', '忽视事后情感'],
    densityHint: 300,
    signals: ['规则', '违规', '惩罚', '安抚', '仪式', '赎罪', '修复'],
  },
  shame: {
    mustCover: ['暴露/被看的情境', '脸红躲闪等羞耻微反应', '羞耻与兴奋的正反馈环', '羞耻后的安抚或沉溺'],
    writingGuide: '羞耻心理重于器官描写。写眼神、说不出口的话、被点破时的生理反应。',
    antiPatterns: ['践踏自尊无底线', '只羞辱不安抚', '忽略羞耻后的情感需求'],
    densityHint: 300,
    signals: ['羞耻', '暴露', '脸红', '躲闪', '说不出口', '羞辱', '兴奋'],
  },
  fantasy: {
    mustCover: ['非人/异种的身体或能力差异', '设定如何改变情欲体验', '文化/种族禁忌或本能', '他者感与亲密如何共存'],
    writingGuide: '设定驱动情欲：牙齿、翅膀、魔力、发情周期等必须进入床戏逻辑，禁止人形换皮。',
    antiPatterns: ['只换种族名不改体验', '忽略设定限制', '架空标签敷衍'],
    densityHint: 300,
    signals: ['种族', '非人', '魔力', '本能', '异种', '设定', '他者'],
  },
  primal: {
    mustCover: ['理性退场的触发', '气味/领地/占有等本能标记', '语言退化或兽性动作', '事后理性回笼的尴尬或依恋'],
    writingGuide: '冲动、气味、原始占有。社交规范暂时失效；回笼时要有代价或余温。',
    antiPatterns: ['理性过早恢复', '写成普通野兽纪录片', '用礼貌社交冲淡本能'],
    densityHint: 300,
    signals: ['本能', '气味', '占有', '兽', '理性', '领地', '标记'],
  },
  contrast: {
    mustCover: ['公开人设 vs 私下欲望的对照', '外壳裂开的触发事件', '失控/乖顺/淫靡的具体反差行为', '事后自我厌恶或沉溺成瘾'],
    writingGuide: '张力来自「不该这样」。先写稳外壳，再写裂缝；反差要可演、可复现，不是标签。',
    antiPatterns: ['无铺垫突然崩人设', '脸谱双标', '忽略事后自我厌恶或沉溺'],
    densityHint: 320,
    signals: ['反差', '外壳', '私下', '失控', '清冷', '崩', '不该'],
  },
};

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
