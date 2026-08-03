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
import { truncateToTokens } from './assistant/contextManager.mjs';
import {
  buildTrackRulesContent,
  buildTrackArchiveContentTemplate,
  valueToStageName,
} from './progressTrack.mjs';

/** 恶堕推进事件锚点表（写入总则，防凭空增长/速通） */
export var CORRUPTION_ANCHOR_LINES = [
  '【事件锚点表】推进必须对应剧情中可指认的事件，禁止无事件凭空上涨：',
  '- 破窗：第一次跨越既有边界的行为（逾矩试探、越界接触）。',
  '- 合理化：角色把越界自我说服成「试炼/帮忙/无妨」。',
  '- 共犯：有第二人知晓或参与其越界。',
  '- 污名：越界被第三视角确认或公开。',
  '- 沉溺：主动寻求、主动隐瞒、为欲望做出取舍。',
  '- 跨档重大事件：如公开献身、亲手加害、放弃最后退路（才允许跨档）。',
].join('\n');

export var CORRUPTION_BREAKTHROUGH_HINT = '进入下一档需发生的事件（重大事件之一），须写具体';

export var CORRUPTION_RULES_COMMENT = '恶堕进度总则';
export var CORRUPTION_ARCHIVE_PREFIX = '恶堕档案·';
export var CORRUPTION_GENERAL_ARCHIVE_COMMENT = '恶堕档案·通用';
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

/** 自定义恶堕弧光母题包（填入 customBrief；不替代阶数预设） */
export var CORRUPTION_ARC_BRIEFS = {
  sacred_collapse: {
    id: 'sacred_collapse',
    label: '圣职崩坏弧',
    brief:
      '自持的圣职/守戒者在教义、告解与公开仪礼的缝隙里一步步失守：先把越界合理化成「试炼」或「牧养」，再在秘密与圣物账本之间撕裂，最终主动撕开戒律并要求他人共担污名。阶段应写出：守戒日常 → 裂缝合理化 → 秘密共犯 → 仪礼中的破绽 → 公开崩坏后的教籍代价。禁止儿童性化；同意与追责走告解、戒牒与教团处分文书。',
  },
  hero_complicity: {
    id: 'hero_complicity',
    label: '英雄同流弧',
    brief:
      '曾经的救场者/正义象征为了「更大胜利」与旧敌、黑市或压迫制度共饮：先是权宜结盟，再是分赃与沉默，最后发现自己已成结构的一部分。阶段应写出：理想宣言 → 第一次脏手 → 为胜利开脱 → 与旧敌同席 → 被昔日受庇护者指认。禁止把未成年人写成筹码；代价落在荣誉、编制与公开问责。',
  },
  vengeance_entry: {
    id: 'vengeance_entry',
    label: '复仇者入局弧',
    brief:
      '带着明确仇怨入局者，在取证、结盟与以彼之道还施彼身的过程中，逐渐采用对方的手段：监视、要挟、公开羞辱与交易身体/名誉。阶段应写出：仇恨清单 → 第一次越界取证 → 手段同化 → 分不清报复与欲望 → 复仇完成后的空账与反噬。禁止儿童性化；证据链与法律/舆论代价必须可见。',
  },
  regal_usurp: {
    id: 'regal_usurp',
    label: '皇权夺嫡弧',
    brief:
      '身在权力中心的野心者，从「保全家」到「自己要坐那张椅子」：先是结党站队，再是用枕边人当棋子、用联姻换兵符，最后亲手把养育自己的长辈与并肩的兄弟推进清算名单。阶段应写出：站队自保 → 枕边权谋 → 手足相残 → 高处孤冷 → 座上无一人可信。禁止儿童性化；夺嫡的每一笔血都要有代价，宠幸与联姻同属权力账簿。',
  },
  savior_blackening: {
    id: 'savior_blackening',
    label: '救世主黑化弧',
    brief:
      '曾经救人于水火的光明象征，在「为了拯救更多人」的说辞里一步步松开底线：先默许小恶换大义，再亲手制造牺牲换取更大胜利，最终发现自己成了最初要打倒的那类人。阶段应写出：大义宣言 → 第一次默许牺牲 → 亲手制造取舍 → 信徒仍朝他下跪 → 觉醒或彻底沉沦。禁止儿童性化；黑化的每一步都要有可被追责的决策现场，被牺牲者要有姓名与回声。',
  },
  genius_fall: {
    id: 'genius_fall',
    label: '天才坠落弧',
    brief:
      '天赋异禀者把「只有我才懂」当作破例的通行证：先是蔑视规则，再是用才能交换特权与肉体，最后连自己都分不清被崇拜的是才能还是坠落本身。阶段应写出：恃才傲物 → 破例交易 → 才能换欢 → 捧杀反噬 → 光环熄灭后的寂静。禁止儿童性化；天才的破例每一次都要留下代价，被消耗的人与才气要同时记账。',
  },
  healer_corruption: {
    id: 'healer_corruption',
    label: '医者失守弧',
    brief:
      '握着他人生死与病灶秘密的照护者，从「我比你懂」的权威里长出越界的贪念：先滥用职业便利接近、再以治疗为名实施控制，最后把病痛与依赖变成捆住人的绳。阶段应写出：职业信任 → 滥用知情 → 治疗即控制 → 依赖成瘾 → 医籍与良心一起崩塌。禁止儿童性化；医者身份不得成为未成年越界的掩护，每笔越界都要有处方、档案与追责路径。',
  },
  loyalist_betrayal: {
    id: 'loyalist_betrayal',
    label: '忠诚者背叛弧',
    brief:
      '最忠诚的人背叛得最彻底：从「我替他挡刀」到「我想他死」，中间隔着一次未被回应的忠诚、一笔被吞的功劳、或一场目睹主人沉沦的幻灭。阶段应写出：忠心烙印 → 第一次幻灭 → 隐忍记账 → 递出背叛 → 换主后的自我清算。禁止儿童性化；背叛要有明确的账目与动机，忠诚与恨意同源才成立。',
  },
  gentle_darkening: {
    id: 'gentle_darkening',
    label: '温柔者黑化弧',
    brief:
      '一向温柔忍耐的人被逼到失守：从不断退让、替人兜底，到某天不再接住任何一次伤害——温柔的底线崩塌后，以同样的温柔手段施加掌控与报复。阶段应写出：无底线退让 → 隐忍记录 → 最后通牒被无视 → 温柔变刀 → 黑化后的宁静。禁止儿童性化；黑化的转折要有具体触发点，温柔变刀后仍要保留可回头的缝。',
  },
  capital_descent: {
    id: 'capital_descent',
    label: '资本染指弧',
    brief:
      '握有资源与账本的人，从「等价交换」滑向「一切皆可标价」：先收购产业，再收购人情、婚姻与身体，最后连自己的良知也上了拍卖台。阶段应写出：等价交易 → 人情入账 → 婚姻与身体进资产负债表 → 良知询价 → 破产或赎罪。禁止儿童性化；资本每一次染指都要有可审计的账目，被收购的人要有拒绝与赎回的可能。',
  },
  faith_collapse: {
    id: 'faith_collapse',
    label: '信仰崩塌弧',
    brief:
      '虔诚的信徒在「神为什么不回应」里一点点松动：先是把苦难解释成试炼，再是发现自己向神求的东西从别处得了来，最后把「信」从神身上搬到自己和欲望身上。阶段应写出：苦行守戒 → 第一次质疑神意 → 越界后无人罚 → 从虔诚滑向渎神式的放纵 → 信仰重塑或彻底背弃。禁止儿童性化，且禁止针对真实宗教群体的仇恨——崩塌的是虚构信仰系统，追责与救赎走教团戒律与自我清算文书。',
  },
  tech_geek_fall: {
    id: 'tech_geek_fall',
    label: '科技极客堕落弧',
    brief:
      '技术天才从「改进世界」滑向「用代码把人当变量」：先是优化流程，再是优化人——用算法挑选、驯化、操控亲密对象，把感情数据化，最后发现自己也成了数据的一部分。阶段应写出：技术理想 → 把人当变量 → 算法操控亲密 → 被人反制或自我怀疑 → 觉醒或彻底赛博式冷漠。禁止儿童性化；技术每一次越界都要有可审计的日志与留痕，被操控者要有查档与退出的端口。',
  },
  naive_seduced: {
    id: 'naive_seduced',
    label: '天真者诱堕弧',
    brief:
      '涉世未深但已明确的成年人，在「以为只是帮忙」「以为对方是好人」的错觉里一步步交出边界：先是信任，再是习惯了被安排，最后发现自己把决定权让渡得太远。阶段应写出：单纯信任 → 边界被一点点挪动 → 依赖成瘾 → 发现被利用 → 夺回或沉溺。禁幼是硬线：天真者必须是已完成世界观成年礼的成人，涉世未深是阅历层面而非年龄层面；诱导者的每一步越界都要有可指认的痕迹与追责路径。',
  },
  mighty_fall: {
    id: 'mighty_fall',
    label: '强者陨落弧',
    brief:
      '不可一世的强者在「让一次步也没什么」里慢慢滑坡：先是功绩被捧上神坛，再是开始用力量换服从、用威压换亲昵，最后发现自己只剩力量，身边全是因惧而留的人。阶段应写出：巅峰自负 → 力量换服从 → 威压成习惯 → 众叛亲离的孤高 → 陨落或自省。禁止儿童性化；强者每一次以力压人都要付出声望与人心的代价，被压者的恐惧与离开要可被看见。',
  },
};

export var CORRUPTION_ARC_BRIEF_IDS = Object.keys(CORRUPTION_ARC_BRIEFS);

export var STAGE_SECTION_HINTS = [
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
 *   extraNotes: string,
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
    extraNotes: String(c.extraNotes != null ? c.extraNotes : (c.corruptionExtraNotes || '')).trim(),
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
  var anchorNote = [
    '通用档案：无专属档案的女角色（含剧情中随机登场/刷新出的新角色）直接套用「'
      + CORRUPTION_GENERAL_ARCHIVE_COMMENT + '」按档位演绎；变量用「NPC.{角色名}.' + CORRUPTION_STATUS_LABEL + '」记录并按名维护。',
    '男角色默认不启用恶堕档案，除非世界书中存在对应「' + CORRUPTION_ARCHIVE_PREFIX + '」条目。',
  ].join('\n');
  return buildTrackRulesContent({
    title: CORRUPTION_RULES_COMMENT,
    statusLabel: CORRUPTION_STATUS_LABEL,
    archivePrefix: CORRUPTION_ARCHIVE_PREFIX,
    stageNames: stages,
    direction: 'ascend',
    singleStepMax: 15,
    anchorNote: anchorNote,
    anchorLines: CORRUPTION_ANCHOR_LINES,
  });
}

/**
 * 通用恶堕档案：不绑定具体角色，适用于所有/随机女角色
 * @param {string[]} stageNames
 * @returns {{comment:string, content:string, keys:string[], strategy:string, position:number, order:number}}
 */
export function buildGeneralArchiveEntry(stageNames) {
  return {
    comment: CORRUPTION_GENERAL_ARCHIVE_COMMENT,
    content: buildGeneralArchiveContent(stageNames),
    keys: [],
    strategy: 'constant',
    position: 0,
    depth: 4,
    role: 0,
    order: 100,
    prob: 100,
    enabled: true,
  };
}

export function buildGeneralArchiveContent(stageNames) {
  var stages = asTrimmedList(stageNames);
  if (stages.length < CORRUPTION_STAGE_MIN) stages = CORRUPTION_PRESETS['5'].stages.slice();
  var lines = [];
  lines.push('【恶堕档案 · 通用】');
  lines.push('适用于任何女角色——包括随机刷新、临时登场、没有专属档案的角色。');
  lines.push('读取状态栏/MVU「NPC.{角色名}.' + CORRUPTION_STATUS_LABEL + '」（0-100 数值）；仅采用与当前档位对应的阶段，禁止混用其他阶段。');
  lines.push('演绎时把下列「她」替换为该角色名，并结合其性格与处境展开。');
  lines.push('');
  stages.forEach(function(s) {
    lines.push('## ' + s);
    STAGE_SECTION_HINTS.forEach(function(h) {
      lines.push('- ' + h + '：（按「' + s + '」档位、结合该角色初始设定展开）');
    });
    lines.push('- 突破条件：（进入下一档需发生的重大事件之一，须写具体）');
    lines.push('');
  });
  return lines.join('\n').trim() + '\n';
}

export function buildArchiveContentTemplate(charName, stageNames) {
  return buildTrackArchiveContentTemplate({
    charName: charName,
    stageNames: stageNames,
    statusLabel: CORRUPTION_STATUS_LABEL,
    archiveTitle: '恶堕档案',
    sectionHints: STAGE_SECTION_HINTS,
    breakthroughHint: CORRUPTION_BREAKTHROUGH_HINT,
  });
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
    '阶段读取方式：状态栏/MVU 变量「' + CORRUPTION_STATUS_LABEL + '」为 0-100 数值；每阶段开头注明该档数值区间（如 40-59），同档数值越高程度越深，但行为基调以本阶段为准。',
    '每阶段末尾必须另写一段「突破条件」：进入下一档需发生的重大事件（事件锚点：破窗/合理化/共犯/污名/沉溺之一的具体化），防止无事件凭空推进。',
    '字数：每一阶段正文（含突破条件）' + CORRUPTION_TARGET_CHARS_PER_STAGE.min + '-' + CORRUPTION_TARGET_CHARS_PER_STAGE.max + ' 字（不含标题）；禁止提纲、空话、（待填充）、一笔带过。',
    '相邻阶段必须可感知递进，禁止跳阶或阶段之间复制粘贴。',
    '只输出世界书正文（不要 JSON、不要前言后记）。',
  ].join('\n');
}

export function buildArchiveExpandSystemPrompt() {
  return [
    '你是角色卡世界书扩写编辑。下文恶堕档案过薄，请在保持阶段标题不变的前提下大幅加厚每一阶段。',
    '每阶段扩写到 ' + CORRUPTION_TARGET_CHARS_PER_STAGE.min + '-' + CORRUPTION_TARGET_CHARS_PER_STAGE.max + ' 字，补足心理、反差、口头禅、边界与可演细节。',
    '保留并补实每阶段「突破条件」（进入下一档需发生的重大事件）。',
    '禁止删除阶段；禁止输出（待填充）；只输出完整正文。',
  ].join('\n');
}

/**
 * @param {{ charName: string, stageNames: string[], worldbookContent?: string, identity?: string, customBrief?: string, extraNotes?: string, nsfwFlavorHint?: string, ntlHint?: string }} opts
 */
export function buildArchiveUserPrompt(opts) {
  var o = opts || {};
  var stages = asTrimmedList(o.stageNames);
  var parts = [];
  parts.push('角色名：' + String(o.charName || '').trim());
  if (o.identity) parts.push('身份：' + String(o.identity).trim());
  if (o.worldbookContent) {
    parts.push('【该角色世界书人物设定——必须据此写恶堕，禁止写成另一人或主角】\n'
      + truncateToTokens(String(o.worldbookContent).trim(), CORRUPTION_WB_CHARS));
  } else {
    parts.push('【警告】未提供该角色世界书正文，请仍按角色名写出丰满分期，但勿编造与已知卡面冲突的设定。');
  }
  if (o.customBrief) parts.push('弧光补充：\n' + truncateToTokens(String(o.customBrief).trim(), CORRUPTION_BRIEF_CHARS));
  if (o.extraNotes) {
    parts.push('附加设定（须融入各阶段补完，禁止忽略）：\n'
      + truncateToTokens(String(o.extraNotes).trim(), CORRUPTION_BRIEF_CHARS));
  }
  if (o.nsfwFlavorHint) parts.push(String(o.nsfwFlavorHint).trim());
  if (o.ntlHint) parts.push(String(o.ntlHint).trim());
  if (o.canonDigest) parts.push(String(o.canonDigest).trim());
  if (o.siblingArchivesHint) parts.push(String(o.siblingArchivesHint).trim());
  parts.push('阶段表（须全部写出，## 标题与下列完全一致）：\n' + stages.map(function(s, i) {
    return (i + 1) + '. ' + s;
  }).join('\n'));
  parts.push('正文开头须含：【读取状态栏/MVU「' + CORRUPTION_STATUS_LABEL + '」数值（0-100）；仅采用与当前档位对应的阶段，禁止混用其他阶段】');
  parts.push('每阶段须含「突破条件」段落：进入下一档需发生的重大事件（事件锚点：破窗/合理化/共犯/污名/沉溺的具体化），防止无事件凭空推进。');
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
  var sample = '0'; // 数值化：初始 0-100，档位由数值映射
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
  return '0';
}
