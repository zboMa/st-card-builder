/** 口味·异质物质（触手/体液/粘液等） */
export var PRESETS = {
  tentacle: {
    group: "异质物质",
    label: "触手向",
    description: "触手缠缚、多点触碰与非人节奏——强调同意口令、解缠与呼吸；限已完成设定成年礼的成人；须可协商、可中断；禁止儿童性化。",
    palette: {
      temperature: "湿冷→热",
      texture: "柔韧粘滑",
      primary_intensity_default: 0.85,
      accent_intensity_default: 0.7
    },
    focus: [ "entwine", "multi_point_touch", "nonhuman_rhythm", "safe_word_release", "aftercare_unwind" ],
    avoid: [ "无同意强制缠死", "无解缠机制", "儿童性化" ]
  },
  bodily_fluids: {
    group: "异质物质",
    label: "体液向",
    description: "汗、泪、涎、爱液等体液作为感官与标记语言——脏与亲昵并存，重清理与合意；限已完成设定成年礼的成人；须可协商、可中断；禁止儿童性化。",
    palette: {
      temperature: "体温湿",
      texture: "黏潮",
      primary_intensity_default: 0.75,
      accent_intensity_default: 0.8
    },
    focus: [ "fluid_marking", "taste_scent", "mess_intimacy", "cleanup_care", "consent_boundaries" ],
    avoid: [ "无同意强迫吞咽", "病理羞辱无安抚", "儿童性化" ]
  },
  oviposition_play: {
    group: "异质物质",
    label: "产卵暗示向",
    description: "虚构产卵/孕育道具的填充与排出节奏——明确虚构合意、可取出、非真实生育强迫；限已完成设定成年礼的成人；须可协商、可中断；禁止儿童性化。",
    palette: {
      temperature: "温胀",
      texture: "卵壳光滑",
      primary_intensity_default: 0.8,
      accent_intensity_default: 0.65
    },
    focus: [ "fullness", "insertion_removal", "ritual_gestation_fiction", "aftercare_check", "safe_toys" ],
    avoid: [ "真实非自愿妊娠强迫美化", "儿童性化", "无取出机制" ]
  },
  slime: {
    group: "异质物质",
    label: "粘液向",
    description: "凝胶包裹、半溶解触感与滑腻束缚——中和剂在场，清洁律可执行；限已完成设定成年礼的成人；须可协商、可中断；禁止儿童性化。",
    palette: {
      temperature: "凉滑→体温",
      texture: "凝胶",
      primary_intensity_default: 0.7,
      accent_intensity_default: 0.75
    },
    focus: [ "encase", "slippery_restraint", "dissolve_edge", "neutralizer", "cleanup" ],
    avoid: [ "非自愿溶解伤害美化", "无中和剂", "儿童性化" ]
  },
  pheromone: {
    group: "异质物质",
    label: "信息素向",
    description: "气味等级、抑制贴与暴香失控——催情须合意，抑制手段常备；限已完成设定成年礼的成人；须可协商、可中断；禁止儿童性化。",
    palette: {
      temperature: "热嗅",
      texture: "空气薄麝",
      primary_intensity_default: 0.8,
      accent_intensity_default: 0.7
    },
    focus: [ "scent_rank", "inhibitor_patch", "consensual_surge", "withdrawal", "after_scent_care" ],
    avoid: [ "强制暴香迷奸", "无抑制贴", "儿童性化" ]
  },
  body_morph: {
    group: "异质物质",
    label: "变形躯体向",
    description: "临时变形、尺寸/肢干变化带来的陌生自我——可逆、可暂停、镜像确认；限已完成设定成年礼的成人；须可协商、可中断；禁止儿童性化。",
    palette: {
      temperature: "变异热",
      texture: "皮肤改写",
      primary_intensity_default: 0.75,
      accent_intensity_default: 0.7
    },
    focus: [ "temporary_morph", "self_recognition", "reversible", "pause_safe", "mirror_check" ],
    avoid: [ "永久非自愿致残美化", "无回滚", "儿童性化" ]
  },
  nonhuman_orifice: {
    group: "异质物质",
    label: "非人孔窍向",
    description: "异种生理腔道/开口的设定驱动亲密——解剖差异要写清，安全与润滑优先；限已完成设定成年礼的成人；须可协商、可中断；禁止儿童性化。",
    palette: {
      temperature: "异温",
      texture: "非人黏膜",
      primary_intensity_default: 0.8,
      accent_intensity_default: 0.75
    },
    focus: [ "anatomy_diff", "lubrication_safety", "species_pace", "education_consent", "aftercare" ],
    avoid: [ "无视解剖的硬套伤害", "无润滑安全", "儿童性化" ]
  },
  symbiosis_parasite: {
    group: "异质物质",
    label: "共生寄生向",
    description: "共生体/寄生感的满胀与低语——区分合意共生与侵害；可剥离条款必写；限已完成设定成年礼的成人；须可协商、可中断；禁止儿童性化。",
    palette: {
      temperature: "内热",
      texture: "脉动共生",
      primary_intensity_default: 0.85,
      accent_intensity_default: 0.7
    },
    focus: [ "shared_pulse", "inner_voice", "consensual_bond", "detach_clause", "identity_border" ],
    avoid: [ "非自愿寄生永久控制美化", "无剥离", "儿童性化" ]
  }
};
