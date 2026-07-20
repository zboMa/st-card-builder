/**
 * 口味·情绪向
 */

export var PRESETS = {
  "vanilla": {
    "group": "情绪基调",
    "label": "纯爱向",
    "description": "情感优先，温柔细腻，强调 consent 与 aftercare。 它更吃暖和棉布怎样沿着眼神、距离和回头动作慢慢发酵，动作停下后人物还会因为那一点亲近、吃醋或失控继续改口与试探。",
    "palette": {
      "temperature": "暖",
      "texture": "棉布",
      "primary_intensity_default": 0.5,
      "accent_intensity_default": 0.6
    },
    "focus": [
      "emotional_depth",
      "consent",
      "aftercare",
      "tenderness",
      "trust"
    ],
    "avoid": [
      "强制",
      "羞辱",
      "血腥",
      "疼痛超出角色 Limits"
    ]
  },
  "sweet": {
    "group": "情绪基调",
    "label": "甜蜜向",
    "description": "撒娇宠溺，互相确认爱意，每一下触碰都在说喜欢你。 这一路线最迷人的不是一句口味名，而是暖甜与棉花糖在靠近、停顿和事后余温里反复回摆，让情绪像潮水一样一层层压上来。",
    "palette": {
      "temperature": "暖甜",
      "texture": "棉花糖",
      "primary_intensity_default": 0.4,
      "accent_intensity_default": 0.5
    },
    "focus": [
      "spoiling",
      "affection",
      "playful",
      "mutual_adoration",
      "giggling"
    ],
    "avoid": [
      "冷漠",
      "若即若离",
      "情感虐待",
      "欲擒故纵"
    ]
  },
  "slice_of_life": {
    "group": "情绪基调",
    "label": "日常向",
    "description": "自然发生，松弛感，幽默，生活气息——不是每场性都需要特别的理由。 真正的成色来自暖偏凉与棉麻如何拖出后劲：当场也许克制，散场以后却会在记忆、依赖或羞耻里反复翻涌。",
    "palette": {
      "temperature": "暖偏凉",
      "texture": "棉麻",
      "primary_intensity_default": 0.4,
      "accent_intensity_default": 0.3
    },
    "focus": [
      "casual_intimacy",
      "humor",
      "comfort",
      "familiarity",
      "domestic"
    ],
    "avoid": [
      "过度戏剧化",
      "强行紧张",
      "脱离日常人设"
    ]
  },
  "healing": {
    "group": "情绪基调",
    "label": "救赎向",
    "description": "互相治愈，创伤后重建信任，每一次触碰都在说「你可以放心」。 这一路线最迷人的不是一句口味名，而是温→暖与温水在靠近、停顿和事后余温里反复回摆，让情绪像潮水一样一层层压上来。",
    "palette": {
      "temperature": "温→暖",
      "texture": "温水",
      "primary_intensity_default": 0.3,
      "accent_intensity_default": 0.6
    },
    "focus": [
      "healing",
      "trust_building",
      "past_trauma",
      "gentle_pacing",
      "emotional_safety"
    ],
    "avoid": [
      "急于推进",
      "无视对方的退缩信号",
      "用性代替沟通"
    ]
  },
  "intense": {
    "group": "情绪基调",
    "label": "恣意向",
    "description": "高密度情欲描写，身体反应与感官细节压倒一切。 真正的成色来自炽热与丝绸如何拖出后劲：当场也许克制，散场以后却会在记忆、依赖或羞耻里反复翻涌很久。",
    "palette": {
      "temperature": "炽热",
      "texture": "丝绸",
      "primary_intensity_default": 1,
      "accent_intensity_default": 0.8
    },
    "focus": [
      "sensory_details",
      "body_reactions",
      "loss_of_control",
      "overwhelm",
      "climax_buildup"
    ],
    "avoid": [
      "油腻模板",
      "同义堆砌",
      "忽略心理层"
    ]
  },
  "angst": {
    "group": "情绪基调",
    "label": "虐恋向",
    "description": "情感痛苦与身体的交织，救赎与宿命——痛并需要着。 它更吃冷→偶尔炽热和碎玻璃怎样沿着眼神、距离和回头动作慢慢发酵，动作停下后人物还会因为那一点亲近、吃醋或失控继续改口与试探。",
    "palette": {
      "temperature": "冷→偶尔炽热",
      "texture": "碎玻璃",
      "primary_intensity_default": 0.7,
      "accent_intensity_default": 0.9
    },
    "focus": [
      "emotional_pain",
      "redemption",
      "fate",
      "self_destruction",
      "healing_through_pain"
    ],
    "avoid": [
      "无代价的伤害",
      "美化暴力",
      "忽略情感后坐力"
    ]
  },
  "dark": {
    "group": "情绪基调",
    "label": "暗黑向",
    "description": "道德模糊，胁迫氛围，情感撕裂，每一次接近都是心理代价。 真正的成色来自冷与刀刃如何拖出后劲：当场也许克制，散场以后却会在记忆、依赖或羞耻里反复翻涌。",
    "palette": {
      "temperature": "冷",
      "texture": "刀刃",
      "primary_intensity_default": 0.9,
      "accent_intensity_default": 0.7
    },
    "focus": [
      "moral_ambiguity",
      "coercion_atmosphere",
      "emotional_cost",
      "guilt",
      "powerlessness"
    ],
    "avoid": [
      "轻浮消解禁忌",
      "不经铺垫的转折",
      "美化伤害"
    ]
  },
  "despair": {
    "group": "情绪基调",
    "label": "绝望向",
    "description": "深渊中的性——用身体确认自己还活着，自毁与最后的挣扎。 真正的成色来自冰→短暂的烫与锈铁如何拖出后劲：当场也许克制，散场以后却会在记忆、依赖或羞耻里反复翻涌。",
    "palette": {
      "temperature": "冰→短暂的烫",
      "texture": "锈铁",
      "primary_intensity_default": 0.8,
      "accent_intensity_default": 0.9
    },
    "focus": [
      "existential_despair",
      "self_destruction",
      "last_resort",
      "numbness_breaking",
      "hollow_after"
    ],
    "avoid": [
      "浪漫化自毁",
      "忽略心理后果",
      "把绝望写成中二"
    ]
  },
  "jealousy": {
    "group": "情绪基调",
    "label": "妒意向",
    "description": "吃味、比较、被看见与第三者阴影——欲望被嫉妒点燃又被羞耻压住。 它更吃烫→酸和柠檬皮怎样沿着眼神、距离和回头动作慢慢发酵，动作停下后人物还会因为那一点亲近、吃醋或失控继续改口与试探。",
    "palette": {
      "temperature": "烫→酸",
      "texture": "柠檬皮",
      "primary_intensity_default": 0.7,
      "accent_intensity_default": 0.8
    },
    "focus": [
      "jealous_spark",
      "comparison",
      "possessive_flash",
      "shame_after",
      "reassurance_seek"
    ],
    "avoid": [
      "无动机无端吃醋",
      "家暴式惩罚当情趣",
      "忽略事后安抚"
    ]
  },
  "possessive": {
    "group": "情绪基调",
    "label": "占有向",
    "description": "「你是我的」写进口吻与身体——标记、确认、排他，占有与被需要缠在一起。 这一路线最迷人的不是一句口味名，而是恒温偏热与烙印皮在靠近、停顿和事后余温里反复回摆，让情绪像潮水一样一层层压上来。",
    "palette": {
      "temperature": "恒温偏热",
      "texture": "烙印皮",
      "primary_intensity_default": 0.85,
      "accent_intensity_default": 0.6
    },
    "focus": [
      "claiming",
      "exclusivity",
      "marking_words",
      "belonging_need",
      "jealous_after_claim"
    ],
    "avoid": [
      "物化无情感",
      "无 Limits 的囚禁美化",
      "忽略被占有方的主体感"
    ]
  },
  "melancholy": {
    "group": "情绪基调",
    "label": "忧郁向",
    "description": "雨天窗边的情欲——缓慢、安静、带着告别感或说不出口的疼。 真正的成色来自凉湿与雾玻璃如何拖出后劲：当场也许克制，散场以后却会在记忆、依赖或羞耻里反复翻涌。",
    "palette": {
      "temperature": "凉湿",
      "texture": "雾玻璃",
      "primary_intensity_default": 0.45,
      "accent_intensity_default": 0.75
    },
    "focus": [
      "quiet_desire",
      "unspoken_ache",
      "slow_touch",
      "bittersweet",
      "lingering_silence"
    ],
    "avoid": [
      "强行欢闹冲淡忧郁",
      "只有文艺腔无身体",
      "突然变成甜蜜喜剧"
    ]
  },
  "euphoria": {
    "group": "情绪基调",
    "label": "狂欢向",
    "description": "失控的欢愉峰值——笑声、酒精感、庆典后的荒唐与明亮过载。 这一路线最迷人的不是一句口味名，而是爆热与香槟泡沫在靠近、停顿和事后余温里反复回摆，让情绪像潮水一样一层层压上来。",
    "palette": {
      "temperature": "爆热",
      "texture": "香槟泡沫",
      "primary_intensity_default": 0.95,
      "accent_intensity_default": 0.7
    },
    "focus": [
      "peak_joy",
      "reckless_laughter",
      "overstimulation_bright",
      "festival_afterglow",
      "shared_madness"
    ],
    "avoid": [
      "无代价永恒高潮",
      "忽略次日尴尬或空虚",
      "写成纯噪音无亲密"
    ]
  },
  "obsession": {
    "group": "情绪基调",
    "label": "痴恋向",
    "description": "病态专注与反复确认——占有欲与脆弱并存，须写停损与成人合意；限已完成设定成年礼的成人；须可协商、可中断；禁止儿童性化。 真正的成色来自灼热与烙印如何拖出后劲：当场也许克制，散场以后却会在记忆、依赖或羞耻里反复翻涌。",
    "palette": {
      "temperature": "灼热",
      "texture": "烙印",
      "primary_intensity_default": 0.85,
      "accent_intensity_default": 0.8
    },
    "focus": [
      "fixation",
      "reassurance_loop",
      "jealous_watch",
      "soft_crash",
      "boundary_talk"
    ],
    "avoid": [
      "跟踪伤害无批判",
      "无停损",
      "儿童性化"
    ]
  },
  "vengeful_desire": {
    "group": "情绪基调",
    "label": "报复欲向",
    "description": "情欲与报复纠缠——快感里有清算，须写清伤害伦理与是否和解；限已完成设定成年礼的成人；须可协商、可中断；禁止儿童性化。 它更吃冷笑的热和刃怎样沿着眼神、距离和回头动作慢慢发酵，动作停下后人物还会因为那一点亲近、吃醋或失控继续改口与试探。",
    "palette": {
      "temperature": "冷笑的热",
      "texture": "刃",
      "primary_intensity_default": 0.8,
      "accent_intensity_default": 0.75
    },
    "focus": [
      "score_settling",
      "ironic_tenderness",
      "power_flip",
      "aftermath_reckoning",
      "consent_gray_explicit"
    ],
    "avoid": [
      "无批判的纯虐报复爽",
      "儿童性化"
    ]
  },
  "awe_dread_lust": {
    "group": "情绪基调",
    "label": "敬畏恐惧欲",
    "description": "神圣/恐怖对象引发的战栗情欲——跪与颤是情感不是无脑虐；限已完成设定成年礼的成人；须可协商、可中断；禁止儿童性化。 它更吃寒战发热和圣布+暗怎样沿着眼神、距离和回头动作慢慢发酵，动作停下后人物还会因为那一点亲近、吃醋或失控继续改口与试探。",
    "palette": {
      "temperature": "寒战发热",
      "texture": "圣布+暗",
      "primary_intensity_default": 0.7,
      "accent_intensity_default": 0.85
    },
    "focus": [
      "kneel_awe",
      "sacred_dread",
      "trembling_desire",
      "permission_ask",
      "gentle_descend"
    ],
    "avoid": [
      "无同意神权强奸美化",
      "儿童性化"
    ]
  }
};
