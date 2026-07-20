/**
 * 口味·关系动态
 * description 逐条手写。
 */

export var PRESETS = {
  domination: {
    group: "关系动态",
    label: "调教向",
    description:
      "先立规则与安全词，再进入训练回合。抗拒松动要看得见，申诉与降级始终可用；复盘对照规则而非只夸听话。限可叫停的成人。",
    palette: {"temperature":"温→热","texture":"皮革","primary_intensity_default":0.8,"accent_intensity_default":0.5},
    focus: ["power_exchange","rules","progression","psychological_transformation","ritual"],
    avoid: ["无铺垫直接硬来","忽略安全词","超出 Limits 的极端"],
  },
  brat: {
    group: "关系动态",
    label: "叛逆向",
    description:
      "嘴硬挑衅背后是「来抓住我」。多回合拉扯：顶嘴、破功、再顶嘴；收束用和解，禁止记成不可擦人格判决。限成人协商。",
    palette: {"temperature":"热","texture":"磨砂皮","primary_intensity_default":0.7,"accent_intensity_default":0.8},
    focus: ["defiance","taming","sass_backfire","teasing","power_struggle_to_submission"],
    avoid: ["真的愤怒","完全压制没有过程","忽视 brat 的主动性魅力"],
  },
  gentle_dom: {
    group: "关系动态",
    label: "温柔支配",
    description:
      "递水掖被的口吻下达不可忽视的指令，但每次加码前刷新同意。说「今晚不做」必须被接住。温柔不是糖衣压迫。限成人。",
    palette: {"temperature":"恒温","texture":"绒面革","primary_intensity_default":0.6,"accent_intensity_default":0.7},
    focus: ["care_as_control","gentle_firmness","praise","safety","trust_based_power"],
    avoid: ["冷暴力","羞辱","命令式语气","忽视被支配方的反馈"],
  },
  service: {
    group: "关系动态",
    label: "臣服向",
    description:
      "奉献落在可观察行为与记住偏好；成就感来自对方被取悦，同时保留说不的证据。名册有下班时刻。限成人可撤回。",
    palette: {"temperature":"暖","texture":"丝绒","primary_intensity_default":0.5,"accent_intensity_default":0.8},
    focus: ["devotion","worship","selfless_service","pleasure_in_giving","humility"],
    avoid: ["强迫服务","自我否定","把奉献写成无自尊"],
  },
  pursuit: {
    group: "关系动态",
    label: "狩猎向",
    description:
      "追逐地图画出安全区，踏入即停。靠近—撤退制造期待，喊停权在被追者手里。狩猎不是围死退路。限成人角色扮演。",
    palette: {"temperature":"温→热→凉交替","texture":"羽毛","primary_intensity_default":0.6,"accent_intensity_default":0.7},
    focus: ["chase","tease","push_pull","anticipation","delayed_gratification"],
    avoid: ["直接扑倒","省略追逐过程","单方面追逐无互动"],
  },
  seduction: {
    group: "关系动态",
    label: "引导向",
    description:
      "引诱阶梯每级可回退；防线松动与内心合理化要写清。知情先于越界，不可逆诱导按操控写。限成人且每步可停。",
    palette: {"temperature":"凉→渐热","texture":"薄纱","primary_intensity_default":0.5,"accent_intensity_default":0.9},
    focus: ["corruption","awakening","stepped_temptation","innocence_fading","point_of_no_return"],
    avoid: ["跳过快进","对方毫无挣扎","把引导写成单纯操纵"],
  },
  denial_surrender: {
    group: "关系动态",
    label: "沦陷向",
    description:
      "抗拒理由具体，裂缝用停顿与抓衣角写。投降后解脱或羞耻皆可；抵抗章节须被确认仍有效。限成人协商。",
    palette: {"temperature":"冷→爆热→温","texture":"融化的冰","primary_intensity_default":0.6,"accent_intensity_default":0.9},
    focus: ["resistance","crumbling","surrender","internal_conflict","relief_after_yielding"],
    avoid: ["直接放弃抵抗","没有内心挣扎","沉溺后没有情绪余波"],
  },
  enemies: {
    group: "关系动态",
    label: "敌对向",
    description:
      "恨与欲同句，动作带刃但先过伤情登记与停火。不愿承认在乎比告白重要。医疗优先于「打是亲」。限成人。",
    palette: {"temperature":"冷+灼热点","texture":"淬火的钢","primary_intensity_default":0.9,"accent_intensity_default":0.8},
    focus: ["hatred_and_desire","roughness","conflicted","verbal_hostility","reluctant_care"],
    avoid: ["突然变甜","消解敌对张力","暴力无上下文"],
  },
  switch_dynamic: {
    group: "关系动态",
    label: "切换向",
    description:
      "切换用口令或双钥，双方都当过主导与臣服。新角色开始前口头确认，aftercare 优先当前弱势侧。限成人合意。",
    palette: {"temperature":"冷热交替","texture":"双面缎","primary_intensity_default":0.7,"accent_intensity_default":0.75},
    focus: ["role_switch","negotiated_power","mutual_agency","fluid_control","after_switch_checkin"],
    avoid: ["无协商的突然翻转","一方永远被动","忽略切换后的情绪确认"],
  },
  mentor_guide: {
    group: "关系动态",
    label: "导师向",
    description:
      "示范桌旁停课牌学员可拍即停。笨拙被允许；权威止于成人同意，不得以辅导名义绕过边界。双方须已完成成年礼。",
    palette: {"temperature":"稳温","texture":"粉笔灰+丝","primary_intensity_default":0.55,"accent_intensity_default":0.7},
    focus: ["instruction","demonstration","correction_praise","learning_curve","adult_consent_frame"],
    avoid: ["师生权力压迫无同意","把教导写成羞辱","跳过学习过程直接结果"],
  },
  rivalry_heat: {
    group: "关系动态",
    label: "较劲向",
    description:
      "较劲点具体：谁先求饶、谁先吻回。停赛与医疗铃一响计分作废。事后和解、嘲讽或余火写透。限成人。",
    palette: {"temperature":"灼","texture":"砂纸摩擦","primary_intensity_default":0.8,"accent_intensity_default":0.85},
    focus: ["competitive_arousal","scorekeeping","who_breaks_first","smug_after","equal_footing"],
    avoid: ["真伤自尊的贬低","一边倒碾压无博弈","忽略事后和解或余火"],
  },
  caregiver: {
    group: "关系动态",
    label: "照料向",
    description:
      "水毯擦拭是可拒绝菜单；改期则日程后移不构成惩罚。可说「只要毯子不要触碰」。限成人合意。",
    palette: {"temperature":"恒温暖","texture":"毛巾棉","primary_intensity_default":0.4,"accent_intensity_default":0.75},
    focus: ["nurture","attunement","soft_rituals","safe_dependency","gratitude_arousal"],
    avoid: ["infantilize 对方人格","用照料掩盖控制欲无协商","忽略被照料方的主体选择"],
  },
  voyeur_exhibit: {
    group: "关系动态",
    label: "观展向",
    description:
      "落幕灯与观众权限在表演者手里。目光如触碰；强制留档出局，收回权限则熄灯。限成人协商。",
    palette: {"temperature":"凉皮热核","texture":"玻璃窗","primary_intensity_default":0.65,"accent_intensity_default":0.85},
    focus: ["gaze_as_touch","performance","watched_arousal","exhibition_shame_loop","viewer_restraint"],
    avoid: ["无同意的偷窥美化","践踏自尊的公开羞辱","忽略事后羞耻安抚"],
  },
  protocol_slave: {
    group: "关系动态",
    label: "契约主奴向",
    description:
      "契约可焚、时辰可停；条款写清结束条件与安全词。时段外恢复普通人称呼。单方无限续期按胁迫。限成人。",
    palette: {"temperature":"仪式温","texture":"革+纸","primary_intensity_default":0.75,"accent_intensity_default":0.6},
    focus: ["written_contract","role_hours","safeword","review","aftercare"],
    avoid: ["无契约无时限的永久奴役美化","儿童性化"],
  },
  public_protocol: {
    group: "关系动态",
    label: "公开服从向",
    description:
      "先约定谁可看、看到哪。匿名否决即散场；公开不是处刑秀。事后复盘羞耻是否可承受。限成人合意。",
    palette: {"temperature":"聚光热","texture":"舞台","primary_intensity_default":0.7,"accent_intensity_default":0.8},
    focus: ["agreed_audience","protocol_display","shame_arousal","exit_plan","debrief"],
    avoid: ["非约定公开羞辱","儿童性化"],
  },
  group_power_field: {
    group: "关系动态",
    label: "多人权力场",
    description:
      "焦点铃与否决牌全场可见，最强者不得代行同意。每人有退出权与单独安抚。全体成人，冷场可清零。",
    palette: {"temperature":"群热","texture":"多层目光","primary_intensity_default":0.8,"accent_intensity_default":0.7},
    focus: ["focus_rotate","veto_right","gaze_hierarchy","coalition","aftercare_all"],
    avoid: ["无否决的轮奸美化","儿童性化"],
  },
};
