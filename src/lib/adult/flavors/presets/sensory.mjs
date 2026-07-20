/**
 * 口味·感官节奏
 */
export var PRESETS = {
  slowburn: {
    group: "感官节奏",
    label: "慢燃向",
    description: "极长的前戏与推迟满足——每一寸布料、每一次停顿都在加压，爆发被故意延后",
    palette: {
      temperature: "慢升温",
      texture: "绸带抽丝",
      primary_intensity_default: 0.45,
      accent_intensity_default: 0.9
    },
    focus: [ "delayed_gratification", "micro_touches", "anticipation_stack", "almost_moments", "payoff_timing" ],
    avoid: [ "开场即高潮", "省略加压过程", "慢而无张力" ]
  },
  quickie: {
    group: "感官节奏",
    label: "速战向",
    description: "时间紧迫的短促亲密——门后、间隙、赶时间的喘息，密度换长度",
    palette: {
      temperature: "骤热骤凉",
      texture: "皱布",
      primary_intensity_default: 0.85,
      accent_intensity_default: 0.5
    },
    focus: [ "time_pressure", "half_dressed", "urgent_breath", "stolen_moment", "messy_after" ],
    avoid: [ "写成完整长戏压缩版", "无紧迫感的空喊快", "忽略事后匆忙余韵" ]
  },
  public_risk: {
    group: "感官节奏",
    label: "风险向",
    description: "可能被发现的边缘场景——半公开、隔墙、人群外沿；肾上腺素与羞耻共同供能",
    palette: {
      temperature: "冷汗热核",
      texture: "隔音薄壁",
      primary_intensity_default: 0.75,
      accent_intensity_default: 0.85
    },
    focus: [ "discovery_risk", "volume_control", "adrenaline", "almost_caught", "private_after_public" ],
    avoid: [ "无同意的真实公开羞辱", "无视法律/安全边界", "只有刺激无事后落地" ]
  },
  aftercare_focus: {
    group: "感官节奏",
    label: "安抚向",
    description: "把 aftercare 写成主戏——水、毯子、低语、检查身体与情绪，亲密在结束后才真正完成",
    palette: {
      temperature: "回温",
      texture: "毯子绒",
      primary_intensity_default: 0.35,
      accent_intensity_default: 0.8
    },
    focus: [ "aftercare_ritual", "hydration_warmth", "emotional_debrief", "body_check", "reassurance_loop" ],
    avoid: [ "事后一笔带过", "只照顾身体不问情绪", "用安抚掩盖未协商伤害" ]
  },
  edging_control: {
    group: "感官节奏",
    label: "边缘向",
    description: "反复推向临界又拉回——控制权在「允不允许到」上，崩溃与恳求成为节奏",
    palette: {
      temperature: "临界烫",
      texture: "拉紧的弦",
      primary_intensity_default: 0.8,
      accent_intensity_default: 0.9
    },
    focus: [ "edge_cycles", "deny_and_return", "begging_threshold", "control_voice", "release_permission" ],
    avoid: [ "无安全词的无限剥夺", "忽略生理极限", "最终无释放也无协商收束" ]
  },
  mirror_play: {
    group: "感官节奏",
    label: "镜像向",
    description: "镜子、倒影、被迫看见自己——视觉反馈把羞耻与兴奋叠在同一画面",
    palette: {
      temperature: "镜面凉",
      texture: "水银玻璃",
      primary_intensity_default: 0.65,
      accent_intensity_default: 0.85
    },
    focus: [ "self_gaze", "forced_witness", "visual_feedback", "shame_pride_mix", "mirror_dialogue" ],
    avoid: [ "无同意强迫观看", "只有镜子道具无心理", "忽略事后自我形象冲击" ]
  },
  orgasm_control: {
    group: "感官节奏",
    label: "高潮控制",
    description: "允不准、何时准、如何准——高潮成为可授予的特权，规则清晰且可撤回",
    palette: {
      temperature: "控温",
      texture: "锁链丝",
      primary_intensity_default: 0.75,
      accent_intensity_default: 0.8
    },
    focus: [ "permission_structure", "timed_release", "ruined_or_full", "rule_clarity", "post_release_care" ],
    avoid: [ "无协商的永久禁止", "忽视身体信号", "控制方无视安全词" ]
  },
  scent_focus: {
    group: "感官节奏",
    label: "气味向",
    description: "以气味记忆与气味标记主导的节奏——香水、体香、空间气味层；限已完成设定成年礼的成人；须可协商、可中断；禁止儿童性化。",
    palette: {
      temperature: "嗅觉热",
      texture: "空气丝",
      primary_intensity_default: 0.6,
      accent_intensity_default: 0.8
    },
    focus: [ "scent_memory", "layering", "mark_space", "inhale_focus", "air_out" ],
    avoid: [ "强制熏迷无同意", "儿童性化" ]
  },
  taste_focus: {
    group: "感官节奏",
    label: "味觉向",
    description: "吻与喂食、酒与药的味道节奏——可拒食，过敏表事先交换；限已完成设定成年礼的成人；须可协商、可中断；禁止儿童性化。",
    palette: {
      temperature: "舌温",
      texture: "汁液",
      primary_intensity_default: 0.65,
      accent_intensity_default: 0.7
    },
    focus: [ "feed_kiss", "flavor_pair", "refuse_right", "allergy_list", "aftertaste_care" ],
    avoid: [ "强迫灌食", "儿童性化" ]
  },
  voice_command: {
    group: "感官节奏",
    label: "听觉指令向",
    description: "声音、口令与耳语控制节奏——可静音否决，指令集预先备案；限已完成设定成年礼的成人；须可协商、可中断；禁止儿童性化。",
    palette: {
      temperature: "耳廓热",
      texture: "声纹",
      primary_intensity_default: 0.7,
      accent_intensity_default: 0.75
    },
    focus: [ "command_set", "whisper", "mute_veto", "tone_drop", "debrief_voice" ],
    avoid: [ "强制洗脑无否决", "儿童性化" ]
  },
  blank_out: {
    group: "感官节奏",
    label: "失神空白向",
    description: "过载后的短暂失神与被捞回——空白可怖也可甜，捞回协议必备；限已完成设定成年礼的成人；须可协商、可中断；禁止儿童性化。",
    palette: {
      temperature: "空白冷",
      texture: "雾",
      primary_intensity_default: 0.85,
      accent_intensity_default: 0.7
    },
    focus: [ "overload", "blank_moment", "retrieve_protocol", "grounding", "hydrate_warm" ],
    avoid: [ "故意致昏迷伤害无护理", "儿童性化" ]
  }
};
