/**
 * 成人世界观载体（World Vessels）
 * 口味 / NTL × 世界观语汇 → 物品 / 能力 / 场所 / 规则 / 组织等可物化设定
 * 丰满标准对齐口味/恶堕：必写维度 + 密度门槛 + 偏薄扩写
 */

export var VESSEL_DEFAULT_MIN_CHARS = 320;

export var VESSEL_KINDS = [
  'artifact',   // 法器/道具/义体
  'ability',    // 功法/异能/咒术
  'place',      // 场所/秘境/实验室
  'rule',       // 戒律/条例/潜规则
  'org',        // 宗门/协会/社团
  'substance',  // 丹药/药剂/香氛
  'ritual',     // 仪式/双修阵/契约
];

export var VESSEL_KIND_LABELS = {
  artifact: '器物',
  ability: '能力/功法',
  place: '场所',
  rule: '规则/戒律',
  org: '组织',
  substance: '丹药/药剂',
  ritual: '仪式/阵法',
};

/** 载体共用必写维度（门禁硬门槛） */
export var VESSEL_SHARED_DIMENSIONS = [
  {
    id: 'power_logic',
    label: '生效机制（贴合世界观语汇）',
    signals: ['机制', '生效', '灵力', '法力', '异能', '咒', '阵', '义体', '神经', '契约', 'powerLogic', '运转', '触发'],
  },
  {
    id: 'cost_risk',
    label: '代价 / 反噬 / 暴露风险',
    signals: ['代价', '反噬', '风险', '暴露', '后遗', '反噬', 'costOrRisk', '反噬', '代价', '副作用', '反噬'],
  },
  {
    id: 'social_cover',
    label: '公开伪装 / 社会面说法',
    signals: ['伪装', '公开', '名义', 'socialCover', '借口', '正当', '掩护', '身份'],
  },
  {
    id: 'who_limits',
    label: '谁能用 / Limits / 禁区',
    signals: ['Limits', '界限', '禁', '谁能', '资格', '禁忌', '不可', '禁止'],
  },
  {
    id: 'person_hook',
    label: '与具体人物的互动关系',
    signals: ['相关', 'relatedPersons', '持有', '使用', '针对', '驯服', '绑定', '属于', '人物'],
  },
];

/**
 * 世界观框架
 * lexicon: 正向语汇（生成应使用）
 * antiLexicon: 错位语汇（门禁/antiPattern）
 * signals: 推断用
 */
export var WORLDFRAMES = {
  xianxia: {
    id: 'xianxia',
    label: '修仙/仙侠',
    lexicon: ['灵力', '法器', '丹药', '功法', '双修', '宗门', '秘境', '禁制', '神识', '道心', '灵根', '阵法', '本命', '戒律'],
    antiLexicon: ['跳蛋', '震动棒', '避孕套', '酒店', '义体', '神经接口', '异能协会'],
    signals: ['修仙', '仙侠', '灵力', '筑基', '金丹', '元婴', '宗门', '法器', '灵石', '双修', '剑修', '魔修', '洞府', '飞升'],
    vesselSeeds: [
      { kind: 'artifact', nameHint: '缚灵丝/镇魂锁/合欢铃' },
      { kind: 'substance', nameHint: '合欢丹/情丝散/定魂香' },
      { kind: 'ritual', nameHint: '双修阵/同心禁制' },
      { kind: 'place', nameHint: '合欢殿/禁地密室' },
      { kind: 'rule', nameHint: '宗门双修戒律/魔道血契' },
      { kind: 'ability', nameHint: '摄神诀/双修功法' },
    ],
  },
  modern_ability: {
    id: 'modern_ability',
    label: '现代异能',
    lexicon: ['异能', '能力者', '抑制剂', '协会', '评级', '精神力', '共鸣', '契约', '监管', '实验室', '抑制项圈', '信息素'],
    antiLexicon: ['灵石', '法器', '筑基', '宗门', '飞剑', '灵根'],
    signals: ['异能', '超能力', '能力者', '觉醒', '抑制剂', '协会', 'S级', '精神力', '超能力者', '突变', '超感'],
    vesselSeeds: [
      { kind: 'ability', nameHint: '共感/精神操控/信息素域' },
      { kind: 'artifact', nameHint: '抑制项圈/共鸣手环' },
      { kind: 'substance', nameHint: '镇定剂/诱导剂' },
      { kind: 'place', nameHint: '隔离舱/地下实验室' },
      { kind: 'rule', nameHint: '能力者监管条例漏洞' },
      { kind: 'org', nameHint: '黑市中介/协会特勤' },
    ],
  },
  urban_mystery: {
    id: 'urban_mystery',
    label: '都市异闻',
    lexicon: ['咒物', '禁忌', '仪式', '隐秘', '地脉', '契约', '阴司', '香火', '替身', '夜行'],
    antiLexicon: ['筑基', '金丹', '异能评级', '飞船'],
    signals: ['异闻', '怪谈', '咒物', '都市传说', '阴阳', '灵异', '神社', '禁忌仪式', '夜行'],
    vesselSeeds: [
      { kind: 'artifact', nameHint: '咒物/替身偶/封缄镜' },
      { kind: 'ritual', nameHint: '换心仪式/夜宴契约' },
      { kind: 'place', nameHint: '废弃神社/地下酒吧隐室' },
      { kind: 'rule', nameHint: '夜行者规矩' },
      { kind: 'org', nameHint: '隐秘社团' },
    ],
  },
  campus: {
    id: 'campus',
    label: '校园',
    lexicon: ['社团', '校规', '教室', '宿舍', '学园祭', '辅导', '学生会', '天台', '保健室', '制服'],
    antiLexicon: ['灵石', '法器', '异能协会', '星舰'],
    signals: ['校园', '高中', '大学', '社团', '教室', '宿舍', '学园', '学生会', '同桌', '课后'],
    vesselSeeds: [
      { kind: 'place', nameHint: '空教室/社团活动室/天台' },
      { kind: 'artifact', nameHint: '信物/社团道具/钥匙' },
      { kind: 'rule', nameHint: '社团潜规则/宿舍夜禁漏洞' },
      { kind: 'org', nameHint: '封闭小社团/学生会暗线' },
      { kind: 'ritual', nameHint: '入社仪式/秘密约定' },
    ],
  },
  fantasy: {
    id: 'fantasy',
    label: '西方奇幻',
    lexicon: ['魔力', '魔导具', '血契', '神殿', '魅惑', '咒文', '精灵', '吸血鬼', '圣物', '魔药'],
    antiLexicon: ['灵石', '筑基', '异能协会', '义体'],
    signals: ['魔法', '魔导', '精灵', '吸血鬼', '神殿', '骑士', '血族', '魔药', '咒文', '龙'],
    vesselSeeds: [
      { kind: 'artifact', nameHint: '魅惑项圈/契约戒指' },
      { kind: 'substance', nameHint: '催情魔药/遗忘药水' },
      { kind: 'ritual', nameHint: '血契/服从咒' },
      { kind: 'place', nameHint: '地下神殿/魔导实验室' },
      { kind: 'rule', nameHint: '神殿戒律/血族家法' },
      { kind: 'ability', nameHint: '魅惑术/支配之眼' },
    ],
  },
  scifi: {
    id: 'scifi',
    label: '科幻',
    lexicon: ['义体', '神经接口', '纳米', '飞船', '克隆', '权限', '脑机', '模块', '舱室', '协议'],
    antiLexicon: ['灵力', '法器', '宗门', '魔药', '血契'],
    signals: ['科幻', '太空', '飞船', '义体', '克隆', 'AI', '脑机', '赛博', '殖民地', '基因'],
    vesselSeeds: [
      { kind: 'artifact', nameHint: '神经项圈/快感模块' },
      { kind: 'ability', nameHint: '脑机共享/感官劫持协议' },
      { kind: 'place', nameHint: '隔离舱/私人休眠室' },
      { kind: 'rule', nameHint: '舰规条例/权限契约' },
      { kind: 'substance', nameHint: '神经兴奋剂/抑制芯片液' },
      { kind: 'org', nameHint: '黑市义体商/公司安保' },
    ],
  },
  generic: {
    id: 'generic',
    label: '通用/未识别',
    lexicon: ['器物', '能力', '场所', '规则', '组织', '药剂', '仪式'],
    antiLexicon: [],
    signals: [],
    vesselSeeds: [
      { kind: 'artifact', nameHint: '关键道具' },
      { kind: 'place', nameHint: '私密场所' },
      { kind: 'rule', nameHint: '潜规则' },
      { kind: 'ability', nameHint: '特殊能力' },
    ],
  },
};

export var WORLDFRAME_IDS = Object.keys(WORLDFRAMES);

/** 各框架的丰满写作规范 */
export var WORLDFRAME_VESSEL_ENRICHMENT = {
  xianxia: {
    mustCover: [
      '用法器/丹药/功法/阵法之一写出可运转的灵力机制',
      '道心/灵力反噬或走火代价',
      '宗门戒律或魔道规矩下的公开伪装',
      '至少一件本命/契约级器物或双修相关载体',
      '与具名修士的持有/驯服/双修关系',
    ],
    writingGuide: '用修仙语汇写欲望载体：灵力游走、神识锁缚、丹毒上脑、阵眼共鸣。禁止写成现代情趣玩具换皮。每一件法器都要有「为何在这个修仙世界成立」。',
    antiPatterns: ['直接写跳蛋/飞机杯等现代玩具名', '只有「很涩的法器」没有灵力机制', '忽略走火/心魔代价'],
    densityHint: 360,
    signals: ['灵力', '法器', '双修', '禁制', '丹', '阵', '神识', '道心'],
  },
  modern_ability: {
    mustCover: [
      '用异能/抑制剂/评级体系写出可触发机制',
      '精神过载、暴露身份或协会追查风险',
      '医疗/安保/实验名义的社会伪装',
      '至少一种能力或抑制器物与权力不对等挂钩',
      '与具名能力者的使用/被施加关系',
    ],
    writingGuide: '欲望必须挂在异能设定上：共鸣、精神侵入、信息素域、项圈权限。禁止写成修仙法器或纯现代玩具清单。',
    antiPatterns: ['灵石/飞剑等修仙词', '只有「超能力很色情」无触发条件', '无视监管与暴露后果'],
    densityHint: 360,
    signals: ['异能', '抑制剂', '项圈', '共鸣', '协会', '精神', '评级'],
  },
  urban_mystery: {
    mustCover: [
      '咒物/仪式的触发条件与代价',
      '都市日常下的隐秘伪装',
      '规则破坏后的异闻反噬',
      '至少一处地标或社团载体',
      '与具名角色的契约或被咒关系',
    ],
    writingGuide: '涩感来自「日常里藏着的禁忌」：便利店路过的神社、夜班后的地下房间。咒物要有规矩，不是随便的恐怖标签。',
    antiPatterns: ['无规矩的随机超自然', '修仙升级体系硬套', '只有氛围没有载体'],
    densityHint: 340,
    signals: ['咒', '仪式', '隐秘', '契约', '替身', '夜'],
  },
  campus: {
    mustCover: [
      '校园空间如何变成私密场（钥匙/值日/社团室）',
      '校规/舆论/成绩等现实压力代价',
      '正当借口（辅导、社团、值日）',
      '至少一件信物或场所规则',
      '与具名学生/教师的不对等互动',
    ],
    writingGuide: '载体要「像校园会存在的东西」：空教室钥匙、社团活动记录、保健室帘后。张力来自被发现的风险，不是超自然堆砌。',
    antiPatterns: ['突然出现法器/异能无铺垫', '忽略被撞见/处分风险', '只有情欲没有校园锚点'],
    densityHint: 320,
    signals: ['社团', '教室', '宿舍', '校规', '钥匙', '辅导'],
  },
  fantasy: {
    mustCover: [
      '魔力/血契/魔导具的生效条件',
      '诅咒反噬或神殿惩罚',
      '贵族/神殿/冒险者公会名义下的伪装',
      '至少一件魔导具或契约仪式',
      '与具名角色的契约/奴印/血脉关系',
    ],
    writingGuide: '用奇幻设定驱动情欲：血契印记、魅惑咒文、魔药半衰期。种族特性要进机制，不要只换皮人形。',
    antiPatterns: ['忽略魔力代价', '写成现代 BDSM 道具清单', '神殿/血族规矩完全缺席'],
    densityHint: 350,
    signals: ['魔力', '血契', '魔导', '咒', '神殿', '魔药'],
  },
  scifi: {
    mustCover: [
      '义体/脑机/权限协议的技术机制',
      '神经损伤、日志留痕或公司追查风险',
      '医疗/维修/训练名义的伪装',
      '至少一个可开关的模块或舱室规则',
      '与具名船员/义体师的权限关系',
    ],
    writingGuide: '涩感应来自技术控制：权限提升、感官共享、日志被删。用协议与接口写清楚，不要灵力化。',
    antiPatterns: ['灵力/法器语汇', '无日志/权限后果', '只有科幻皮的现代玩具'],
    densityHint: 350,
    signals: ['义体', '神经', '权限', '协议', '舱', '模块', '脑机'],
  },
  generic: {
    mustCover: [
      '载体如何在本世界生效（具体机制）',
      '使用代价或暴露风险',
      '公开场合如何掩饰',
      '与具名人物的绑定关系',
      '明确 Limits',
    ],
    writingGuide: '即使世界观未识别，也要用故事内已有物件/能力/场所写机制，禁止空泛「氛围道具」。',
    antiPatterns: ['只有形容词没有机制', '与故事世界完全脱节的现代玩具清单'],
    densityHint: 320,
    signals: ['机制', '代价', '伪装', '界限', '相关'],
  },
};

/**
 * 口味 → 载体侧重（与人物层口味互补：这里写「世界如何物化该口味」）
 */
export var FLAVOR_VESSEL_OVERLAYS = {
  vanilla: {
    mustCover: ['可双向撤回的安全机制', 'aftercare 相关场所或药剂', '信任信物而非单方面控制物'],
    writingGuide: '载体强调可协商、可停止；器物带安抚功能。',
    antiPatterns: ['不可逆强制锁', '无安全词等价物'],
    signals: ['安全', '撤回', '安抚', '信物', '同意'],
  },
  sweet: {
    mustCover: ['宠溺向赠礼/共享空间', '昵称或标记类轻量信物', '笑声与玩闹可触发的场景道具'],
    writingGuide: '载体像情侣间的秘密玩具与小空间，而非刑具。',
    antiPatterns: ['冰冷刑具美学'],
    signals: ['赠礼', '共享', '昵称', '标记', '玩闹'],
  },
  slice_of_life: {
    mustCover: ['日常物件被征用的用法', '生活动线中的私密角落', '用完仍能回到日常的收纳/伪装'],
    writingGuide: '厨房、沙发、通勤包里的东西比祭坛更重要。',
    antiPatterns: ['过度仪式化舞台'],
    signals: ['日常', '角落', '收纳', '生活'],
  },
  healing: {
    mustCover: ['可随时中断的疗愈场所规则', '安抚性药剂或触感器物', '触发创伤时的退出机制'],
    writingGuide: '载体先保护再亲密；禁止不可退出的锁死装置当主轴。',
    antiPatterns: ['无退出的强制束缚'],
    signals: ['中断', '疗愈', '安抚', '退出', '安全'],
  },
  intense: {
    mustCover: ['可叠加感官的器物/能力机制', '过载临界与冷却代价', '连续刺激的场所或阵法'],
    writingGuide: '机制要能解释「为什么会失控到生理极限」。',
    antiPatterns: ['只有「很刺激」无过载规则'],
    signals: ['过载', '临界', '叠加', '冷却', '感官'],
  },
  angst: {
    mustCover: ['带情感代价的契约/信物', '使用后留下伤痕或记忆残响', '救赎与自毁之间的规则裂缝'],
    writingGuide: '器物本身携带愧疚与依赖，不只是疼痛工具。',
    antiPatterns: ['无情感后坐力的纯痛'],
    signals: ['契约', '伤痕', '愧疚', '救赎', '残响'],
  },
  dark: {
    mustCover: ['胁迫性权限或禁制', '道德撕裂的规则条文', '秘密档案/把柄类载体'],
    writingGuide: '权力写进规则与器物权限，不靠空喊黑暗。',
    antiPatterns: ['轻浮消解胁迫'],
    signals: ['权限', '禁制', '把柄', '胁迫', '秘密'],
  },
  despair: {
    mustCover: ['自毁倾向相关的危险载体', '「还活着」的感官确认机制', '使用后的空洞余波规则'],
    writingGuide: '载体服务于存在确认，不是无后果的酷刑清单。',
    antiPatterns: ['浪漫化无后果自毁'],
    signals: ['自毁', '确认', '空洞', '余波'],
  },
  domination: {
    mustCover: ['可渐进加强的训诫器物/功法', '仪式感场所或口令规则', '训练阶段与晋级条件'],
    writingGuide: '调教要有进度条：器物/规则随服从加深而升级。',
    antiPatterns: ['一步到位无训练过程'],
    signals: ['训诫', '口令', '阶段', '晋级', '仪式'],
  },
  brat: {
    mustCover: ['挑衅可触发的惩罚机制', '可被「治住」的反制器物', '嘴硬仍生效的契约漏洞'],
    writingGuide: '载体要给 brat 留挑衅空间，也要有反噬。',
    antiPatterns: ['完全无法反抗的秒杀锁'],
    signals: ['挑衅', '惩罚', '反制', '治住'],
  },
  gentle_dom: {
    mustCover: ['照顾型束缚/看护场所', '询问式确认的协议或符文', '疼痛监控与安抚配套'],
    writingGuide: '掌控写成护理协议：先问再绑，器物带监测。',
    antiPatterns: ['冷暴力刑具主轴'],
    signals: ['看护', '确认', '监测', '安抚', '协议'],
  },
  service: {
    mustCover: ['侍奉用器物/岗位规则', '以对方愉悦为指标的反馈机制', '臣服标记但保留尊严的信物'],
    writingGuide: '载体成就「被需要」，不是自我践踏。',
    antiPatterns: ['无尊严羞辱工具当唯一载体'],
    signals: ['侍奉', '岗位', '标记', '奉献'],
  },
  pursuit: {
    mustCover: ['拉近/推远的追踪或感应器物', '延迟满足的场所规则', '猎物与猎人身份可互换的漏洞'],
    writingGuide: '追逐要有道具与地图，不只是对白拉扯。',
    antiPatterns: ['直接捕获无过程'],
    signals: ['追踪', '感应', '延迟', '猎人', '猎物'],
  },
  seduction: {
    mustCover: ['诱导性丹药/魔药/香氛或暗示物', '一步步加深的契约或功法', '天真被侵蚀的可见标记'],
    writingGuide: '引导过程物化为「每次多生效一点」的载体。',
    antiPatterns: ['瞬间洗脑无步骤'],
    signals: ['诱导', '加深', '标记', '香', '契约'],
  },
  denial_surrender: {
    mustCover: ['抗拒期仍可佩戴的轻量禁制', '崩溃点触发的升级机制', '投降后的安抚/烙印仪式'],
    writingGuide: '载体跟着心理弧光变档：从可摘到摘不掉。',
    antiPatterns: ['开局即完全奴役'],
    signals: ['禁制', '崩溃', '投降', '烙印', '升级'],
  },
  enemies: {
    mustCover: ['可兼作武器与亲密束缚的器物', '敌对阵营的禁忌交易场所', '恨意契约或血仇规则'],
    writingGuide: '亲密与杀意共用同一件东西。',
    antiPatterns: ['突然变成甜蜜信物无转折'],
    signals: ['武器', '血仇', '敌对', '禁忌交易'],
  },
  discipline: {
    mustCover: ['成文规则→违规→惩罚→安抚的闭环器物/条例', '惩罚记录或戒疤类痕迹', '安抚配套场所或药剂'],
    writingGuide: '没有规则条文就没有惩戒载体。',
    antiPatterns: ['只罚不安抚', '无规则前提的惩罚'],
    signals: ['条例', '违规', '惩罚', '安抚', '记录'],
  },
  shame: {
    mustCover: ['暴露风险相关的场所/监视物', '羞耻标记但可隐藏的信物', '言语羞辱与身体反应的触发器'],
    writingGuide: '羞耻靠「可能被看见」的空间与物证。',
    antiPatterns: ['无观众风险的空喊羞耻'],
    signals: ['暴露', '监视', '标记', '看见', '羞耻'],
  },
  fantasy: {
    mustCover: ['种族/非人特性驱动的专用载体', '魔力或血脉才能启动的机制', '他者身体差异写入器物设计'],
    writingGuide: '架空口味的载体必须吃设定：鳞、翼、毒、夜视等都要进机制。',
    antiPatterns: ['人形换皮+普通道具'],
    signals: ['种族', '血脉', '非人', '魔力', '特性'],
  },
  primal: {
    mustCover: ['气味/标记/领地类载体', '理智退场的触发条件与冷却', '兽化相关束缚或巢穴场所'],
    writingGuide: '本能要有生理触发器，不是标签。',
    antiPatterns: ['秒回理智无冷却'],
    signals: ['气味', '标记', '领地', '兽化', '巢'],
  },
  contrast: {
    mustCover: ['公开人设用的正当道具 vs 私下真用法', '切换两套用法的隐藏机关', '人设崩裂时留下的物证'],
    writingGuide: '反差靠「同一物件两套说法」。',
    antiPatterns: ['公私场景完全两套无关联物'],
    signals: ['公开', '私下', '隐藏', '人设', '物证'],
  },
};

/** NTL → 载体侧重 */
export var NTL_VESSEL_OVERLAYS = {
  power_coercion: {
    mustCover: ['权限/禁制/把柄类强制载体', '拒绝成本写进规则', '表面自愿实则无法退出的漏洞'],
    writingGuide: '胁迫写进器物权限与条例，不靠吼。',
    antiPatterns: ['无结构性压力的口头威胁'],
    signals: ['权限', '把柄', '禁制', '无法退出'],
  },
  forbidden_relation: {
    mustCover: ['背德关系的隐匿信物', '身份差相关的场所/条例', '被发现的连锁代价'],
    writingGuide: '载体服务「不该发生却发生」。',
    antiPatterns: ['无关身份差的普通情趣道具'],
    signals: ['隐匿', '身份', '被发现', '背德'],
  },
  mind_control: {
    mustCover: ['精神/神识/脑机操控机制', '残留指令与自我怀疑', '解除条件与反噬'],
    writingGuide: '操控必须有通道与残留，不是魔法口头禅。',
    antiPatterns: ['无机制洗脑'],
    signals: ['精神', '神识', '指令', '残留', '解除'],
  },
  noncon_atmosphere: {
    mustCover: ['强迫氛围的物理/规则束缚', '反抗无效的阶段性说明', '事后创伤相关载体（药/伤痕/记录）'],
    writingGuide: '氛围靠环境与规则锁死，仍须写 Limits 与禁止未成年。',
    antiPatterns: ['美化无代价强迫'],
    signals: ['束缚', '反抗', '无效', '创伤'],
  },
  secrecy_blackmail: {
    mustCover: ['把柄物证/录音/记忆结晶', '勒索交换条件', '暴露威胁的传播路径'],
    writingGuide: '秘密本身就是载体。',
    antiPatterns: ['无物证的空口勒索'],
    signals: ['把柄', '物证', '勒索', '暴露'],
  },
  ownership_mark: {
    mustCover: ['所有权印记/项圈/契约纹身', '公开与私下两套可见度', '剥离印记的代价'],
    writingGuide: '归属要看得见、撕得疼。',
    antiPatterns: ['可随便洗掉的无代价标记'],
    signals: ['印记', '项圈', '所有权', '剥离'],
  },
  moral_collapse: {
    mustCover: ['象征底线崩塌的仪式/器物', '每次使用降低道德阈值的机制', '崩塌后的自我叙事道具（日记/镜）'],
    writingGuide: '道德滑坡要有计量器。',
    antiPatterns: ['瞬间黑化无过程'],
    signals: ['底线', '崩塌', '阈值', '日记'],
  },
  taboo_exchange: {
    mustCover: ['禁忌交易的黑市/秘所', '交换代价表', '违约惩罚'],
    writingGuide: '交易场就是 NTL 舞台。',
    antiPatterns: ['无价码的模糊交易'],
    signals: ['交易', '黑市', '代价', '违约'],
  },
  yuri_destruction: {
    mustCover: ['介入者用以拆散原纽带的器物/能力', '原百合信物被污染或夺占', '破坏后的关系残片载体（半对耳环/旧契约）'],
    writingGuide: '百破载体要同时碰到「原纽带」与「介入者」。',
    antiPatterns: ['只写介入者玩具、无视原纽带信物'],
    signals: ['介入', '拆散', '信物', '残片', '百合'],
  },
};

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
    var ov = NTL_VESSEL_OVERLAYS[id];
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
  parts.push('【待加厚内容】\n' + String(o.text || '').trim().slice(0, bodyMax));
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
  var used = lines.join('\n').length;
  list.forEach(function(e) {
    if (used >= budget) return;
    var a = (e.attrs && (e.type === 'nsfw' ? e.attrs : e.attrs.adult)) || {};
    var kind = a.vesselKind || a.kind || e.type;
    var line = '- [' + kind + '] ' + e.name
      + (a.powerLogic ? '｜机制：' + String(a.powerLogic).slice(0, 180) : '')
      + (a.costOrRisk ? '｜代价：' + String(a.costOrRisk).slice(0, 120) : '')
      + (asList(a.relatedPersons || a.relatedNames).length
        ? '｜人：' + asList(a.relatedPersons || a.relatedNames).slice(0, 6).join('、')
        : '')
      + (e.content ? '\n  ' + String(e.content).replace(/\s+/g, ' ').slice(0, 280) : '');
    if (used + line.length > budget) return;
    lines.push(line);
    used += line.length;
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
