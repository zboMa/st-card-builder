/**
 * 口味·异质物质（触手/体液/粘液等）
 */

export var PRESETS = {
  tentacle: {
    group: "异质物质",
    label: "触手向",
    description: "触手缠缚靠节拍、包围感与口令协作制造非人节奏：谁还能呼吸、谁还能喊停、解缠后如何清理，比堆更多触腕更重要。只写已完成设定成年礼的成人；停手与解缠优先于任何失控美学。",
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
    description: "汗、泪、涎与爱液被写成标记语言和亲昵证据，脏与温柔靠同一次擦拭、换衣、回味缝合。先谈接受范围与停手信号，再写气味与质地；对象必须是已成年且可中断的成人关系。",
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
    description: "虚构产卵是可取出、可检查、可中止的填充—排出仪式，快感来自胀感与节律，不是强制生育。全程限成人合意；取出工具、检查步骤与喊停通道必须同场出现。",
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
    description: "凝胶包裹、滑腻束缚与半溶解边缘感依赖中和剂、可视出口与皮肤护理才能成立。危险写在材质与呼吸被妨碍的瞬间，而不写不可逆腐蚀；仅限可协商可退出的成人场景。",
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
    description: "信息素改写判断力，抑制贴、净味与拒绝权必须并行。合意催情可以浓，违规暴香要当越界写代价；禁止把气味写成无法反抗的宿命，角色须为成年且保有叫停权。",
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
    description: "临时变形带来陌生自我与尺寸肢干的错位快感，前提是可逆、可暂停、镜像可确认身份连续。永久致残不是情趣；变形许可与回滚方案先于奇观，限成人协商。",
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
    description: "异种生理腔道的亲密必须先讲清成年解剖适配、润滑与教学节奏，再谈陌生黏膜触感。禁止拿猎奇当伤害豁免；护理与停手同权重。",
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
    description: "共生体的满胀、低语与脉动可以很甜，但要分清合意绑定与侵害失控。剥离条款、自我边界测试与观察期写进场景；不可剥离的永久控制不得当恋爱默认。",
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
