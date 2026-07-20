/**
 * 口味·关系动态
 */
export var PRESETS = {
  domination: {
    group: "关系动态",
    label: "调教向",
    description: "权力交换，仪式感，渐进训练，心理转变",
    palette: {
      temperature: "温→热",
      texture: "皮革",
      primary_intensity_default: 0.8,
      accent_intensity_default: 0.5
    },
    focus: [ "power_exchange", "rules", "progression", "psychological_transformation", "ritual" ],
    avoid: [ "无铺垫直接硬来", "忽略安全词", "超出 Limits 的极端" ]
  },
  brat: {
    group: "关系动态",
    label: "叛逆向",
    description: "表面反抗实则期待被压制——嘴硬身体诚实，每一次挑衅都是邀请",
    palette: {
      temperature: "热",
      texture: "磨砂皮",
      primary_intensity_default: 0.7,
      accent_intensity_default: 0.8
    },
    focus: [ "defiance", "taming", "sass_backfire", "teasing", "power_struggle_to_submission" ],
    avoid: [ "真的愤怒", "完全压制没有过程", "忽视 brat 的主动性魅力" ]
  },
  gentle_dom: {
    group: "关系动态",
    label: "温柔支配",
    description: "以照顾之名行掌控之实——绑好绳子先问疼吗，命令用商量的语气",
    palette: {
      temperature: "恒温",
      texture: "绒面革",
      primary_intensity_default: 0.6,
      accent_intensity_default: 0.7
    },
    focus: [ "care_as_control", "gentle_firmness", "praise", "safety", "trust_based_power" ],
    avoid: [ "冷暴力", "羞辱", "命令式语气", "忽视被支配方的反馈" ]
  },
  service: {
    group: "关系动态",
    label: "臣服向",
    description: "快感来自让对方满足——奉献、崇拜、以对方的愉悦为自己的成就",
    palette: {
      temperature: "暖",
      texture: "丝绒",
      primary_intensity_default: 0.5,
      accent_intensity_default: 0.8
    },
    focus: [ "devotion", "worship", "selfless_service", "pleasure_in_giving", "humility" ],
    avoid: [ "强迫服务", "自我否定", "把奉献写成无自尊" ]
  },
  pursuit: {
    group: "关系动态",
    label: "狩猎向",
    description: "追逐与被追逐，猫鼠游戏，张力来自距离感——靠近一步退半步",
    palette: {
      temperature: "温→热→凉交替",
      texture: "羽毛",
      primary_intensity_default: 0.6,
      accent_intensity_default: 0.7
    },
    focus: [ "chase", "tease", "push_pull", "anticipation", "delayed_gratification" ],
    avoid: [ "直接扑倒", "省略追逐过程", "单方面追逐无互动" ]
  },
  seduction: {
    group: "关系动态",
    label: "引导向",
    description: "引诱对方一步步堕落或觉醒——防线被侵蚀的过程比结果更迷人",
    palette: {
      temperature: "凉→渐热",
      texture: "薄纱",
      primary_intensity_default: 0.5,
      accent_intensity_default: 0.9
    },
    focus: [ "corruption", "awakening", "stepped_temptation", "innocence_fading", "point_of_no_return" ],
    avoid: [ "跳过快进", "对方毫无挣扎", "把引导写成单纯操纵" ]
  },
  denial_surrender: {
    group: "关系动态",
    label: "沦陷向",
    description: "抗拒→动摇→崩溃→沉溺，完整的心理弧光——投降的那一秒值得一千字",
    palette: {
      temperature: "冷→爆热→温",
      texture: "融化的冰",
      primary_intensity_default: 0.6,
      accent_intensity_default: 0.9
    },
    focus: [ "resistance", "crumbling", "surrender", "internal_conflict", "relief_after_yielding" ],
    avoid: [ "直接放弃抵抗", "没有内心挣扎", "沉溺后没有情绪余波" ]
  },
  enemies: {
    group: "关系动态",
    label: "敌对向",
    description: "明明该恨你却想要你——每一寸靠近都带着刀，亲密的暴力美学",
    palette: {
      temperature: "冷+灼热点",
      texture: "淬火的钢",
      primary_intensity_default: 0.9,
      accent_intensity_default: 0.8
    },
    focus: [ "hatred_and_desire", "roughness", "conflicted", "verbal_hostility", "reluctant_care" ],
    avoid: [ "突然变甜", "消解敌对张力", "暴力无上下文" ]
  },
  switch_dynamic: {
    group: "关系动态",
    label: "切换向",
    description: "主导与臣服在双方之间切换——今晚你按住我，明天我牵着你；权力是可协商的舞蹈",
    palette: {
      temperature: "冷热交替",
      texture: "双面缎",
      primary_intensity_default: 0.7,
      accent_intensity_default: 0.75
    },
    focus: [ "role_switch", "negotiated_power", "mutual_agency", "fluid_control", "after_switch_checkin" ],
    avoid: [ "无协商的突然翻转", "一方永远被动", "忽略切换后的情绪确认" ]
  },
  mentor_guide: {
    group: "关系动态",
    label: "导师向",
    description: "引导、示范、纠正——以教学之名展开的亲密，权威感来自耐心与专业，而非胁迫",
    palette: {
      temperature: "稳温",
      texture: "粉笔灰+丝",
      primary_intensity_default: 0.55,
      accent_intensity_default: 0.7
    },
    focus: [ "instruction", "demonstration", "correction_praise", "learning_curve", "adult_consent_frame" ],
    avoid: [ "师生权力压迫无同意", "把教导写成羞辱", "跳过学习过程直接结果" ]
  },
  rivalry_heat: {
    group: "关系动态",
    label: "较劲向",
    description: "互不服输的情欲——比谁先失控、谁更能撑；竞争把欲望推高，输赢都带着火",
    palette: {
      temperature: "灼",
      texture: "砂纸摩擦",
      primary_intensity_default: 0.8,
      accent_intensity_default: 0.85
    },
    focus: [ "competitive_arousal", "scorekeeping", "who_breaks_first", "smug_after", "equal_footing" ],
    avoid: [ "真伤自尊的贬低", "一边倒碾压无博弈", "忽略事后和解或余火" ]
  },
  caregiver: {
    group: "关系动态",
    label: "照料向",
    description: "喂水、擦汗、裹毯子——照料本身成为情欲语言，被照顾的安全感与依赖交织",
    palette: {
      temperature: "恒温暖",
      texture: "毛巾棉",
      primary_intensity_default: 0.4,
      accent_intensity_default: 0.75
    },
    focus: [ "nurture", "attunement", "soft_rituals", "safe_dependency", "gratitude_arousal" ],
    avoid: [ "infantilize 对方人格", "用照料掩盖控制欲无协商", "忽略被照料方的主体选择" ]
  },
  voyeur_exhibit: {
    group: "关系动态",
    label: "观展向",
    description: "被看与被展示的张力——一方观看、一方展演，目光本身就是触碰",
    palette: {
      temperature: "凉皮热核",
      texture: "玻璃窗",
      primary_intensity_default: 0.65,
      accent_intensity_default: 0.85
    },
    focus: [ "gaze_as_touch", "performance", "watched_arousal", "exhibition_shame_loop", "viewer_restraint" ],
    avoid: [ "无同意的偷窥美化", "践踏自尊的公开羞辱", "忽略事后羞耻安抚" ]
  },
  protocol_slave: {
    group: "关系动态",
    label: "契约主奴向",
    description: "书面契约界定的主奴角色扮演——条款、时限、安全词、定期复核；限已完成设定成年礼的成人；须可协商、可中断；禁止儿童性化。",
    palette: {
      temperature: "仪式温",
      texture: "革+纸",
      primary_intensity_default: 0.75,
      accent_intensity_default: 0.6
    },
    focus: [ "written_contract", "role_hours", "safeword", "review", "aftercare" ],
    avoid: [ "无契约无时限的永久奴役美化", "儿童性化" ]
  },
  public_protocol: {
    group: "关系动态",
    label: "公开服从向",
    description: "在约定观众/规则下的公开服从——曝光范围先谈妥；限已完成设定成年礼的成人；须可协商、可中断；禁止儿童性化。",
    palette: {
      temperature: "聚光热",
      texture: "舞台",
      primary_intensity_default: 0.7,
      accent_intensity_default: 0.8
    },
    focus: [ "agreed_audience", "protocol_display", "shame_arousal", "exit_plan", "debrief" ],
    avoid: [ "非约定公开羞辱", "儿童性化" ]
  },
  group_power_field: {
    group: "关系动态",
    label: "多人权力场",
    description: "三人以上权力差与注视结构——焦点、轮转、否决权写清；限已完成设定成年礼的成人；须可协商、可中断；禁止儿童性化。",
    palette: {
      temperature: "群热",
      texture: "多层目光",
      primary_intensity_default: 0.8,
      accent_intensity_default: 0.7
    },
    focus: [ "focus_rotate", "veto_right", "gaze_hierarchy", "coalition", "aftercare_all" ],
    avoid: [ "无否决的轮奸美化", "儿童性化" ]
  }
};
