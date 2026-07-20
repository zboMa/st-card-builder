/**
 * 口味·特殊风味
 * description 逐条手写。
 */

export var PRESETS = {
  discipline: {
    group: "特殊风味",
    label: "惩戒向",
    description:
      "无规则不得开罚。违规可复述，惩罚有计数叫停；安抚未完不连开下一轮。纪律不是发泄。限成人合意。",
    palette: {"temperature":"冷→温","texture":"竹","primary_intensity_default":0.7,"accent_intensity_default":0.5},
    focus: ["rules","transgression","punishment","atonement","comfort_after_punish"],
    avoid: ["只罚不安抚","惩罚无规则前提下","忽视事后情感"],
  },
  shame: {
    group: "特殊风味",
    label: "羞耻向",
    description:
      "脸红躲闪与说不出口；遮挡键在手边。暴露可撤回，强制传播出局。可安抚可沉溺，禁羞辱人格。限成人。",
    palette: {"temperature":"忽冷忽热","texture":"薄冰","primary_intensity_default":0.6,"accent_intensity_default":0.8},
    focus: ["embarrassment","exposure","blushing","verbal_teasing","shame_arousal_loop"],
    avoid: ["只羞辱不安抚","践踏自尊无底线","忽略羞耻后的情感需求"],
  },
  fantasy: {
    group: "特殊风味",
    label: "架空向",
    description:
      "异种身体先过解剖适配与世界规则。情欲被设定改写，猎奇不是伤害豁免；规则说不清就停用。限可沟通成人。",
    palette: {"temperature":"变幻","texture":"星尘","primary_intensity_default":0.5,"accent_intensity_default":0.7},
    focus: ["species_specific_traits","worldbuilding_eroticism","non_human_bodies","magical_intimacy","otherness"],
    avoid: ["写成人形只换皮","忽略种族设定","把架空当成标签敷衍"],
  },
  primal: {
    group: "特殊风味",
    label: "本能向",
    description:
      "理性退场有触发；嗅闻追扑与领地标记后须回人话并清洗。抑制与叫停在场。限成人合意。",
    palette: {"temperature":"原始的热","texture":"毛皮+汗","primary_intensity_default":0.9,"accent_intensity_default":0.6},
    focus: ["instinct","feral","scent_marking","raw_power","rationality_losing"],
    avoid: ["回归理性太快","用社交规范约束","写成普通野兽行为"],
  },
  contrast: {
    group: "特殊风味",
    label: "反差向",
    description:
      "公私切换经缓冲间；外壳因何裂开要具体。事后厌恶或沉溺写透；强制揭面具按侵害。限成人。",
    palette: {"temperature":"冷外热内","texture":"西装内里的汗","primary_intensity_default":0.7,"accent_intensity_default":0.85},
    focus: ["persona_vs_desire","public_vs_private","reluctant_reveal","shameful_enjoyment","identity_crack"],
    avoid: ["无铺垫的突然崩人设","把反差写成单纯双标脸谱","忽略事后自我厌恶或沉溺"],
  },
  temperature_play: {
    group: "特殊风味",
    label: "温差向",
    description:
      "器具有刻度，回温柜在场。皮肤反应服务心理预期；越阈值停手，未复述不得再加极端温度。限成人。",
    palette: {"temperature":"极冷↔极热","texture":"冰晶+蜡","primary_intensity_default":0.75,"accent_intensity_default":0.7},
    focus: ["cold_hot_contrast","temperature_anticipation","skin_reaction","tool_ritual","safe_limits"],
    avoid: ["无安全铺垫的烫伤烫伤风险","只有道具清单无心理","忽略皮肤反馈与停顿"],
  },
  sensory_deprivation: {
    group: "特殊风味",
    label: "剥夺向",
    description:
      "沙漏一尽无条件解除。恐慌信号优先；解除后定向三问通过才可继续。限成人可中断。",
    palette: {"temperature":"暗温","texture":"盲绸","primary_intensity_default":0.7,"accent_intensity_default":0.8},
    focus: ["blindfold_focus","amplified_touch","disorientation","trust_hand_off","release_aftercare"],
    avoid: ["无协商突然剥夺","忽视恐慌信号","事后不解除不安"],
  },
  hypnosis_play: {
    group: "特殊风味",
    label: "暗示向",
    description:
      "解除词公示且第三者可执行。恍惚加戏未经预同意即越界；唤醒确认自我连续。禁无法醒来的控制。限成人角色扮演。",
    palette: {"temperature":"浮温","texture":"雾纱","primary_intensity_default":0.55,"accent_intensity_default":0.85},
    focus: ["trance_play","trigger_words","soft_suggestion","wake_protocol","after_consent_check"],
    avoid: ["真洗脑无同意","抹除主体意志","忽略唤醒与事后确认"],
  },
  marking_claim: {
    group: "特殊风味",
    label: "标记向",
    description:
      "标记可洗可遮可否认；留下时的骄傲或羞耻要写。远程广播羞辱出局；演示洗脱证非永久。限成人。",
    palette: {"temperature":"热印","texture":"齿痕皮","primary_intensity_default":0.75,"accent_intensity_default":0.65},
    focus: ["visible_marks","scent_claim","name_claim","pride_shame_mix","mark_aftercare"],
    avoid: ["无同意的永久性伤害","纯物化圈地","忽略痕迹带来的社交/心理代价"],
  },
  size_difference: {
    group: "特殊风味",
    label: "体差向",
    description:
      "承重与呼吸监测先于奇观。弱侧否决不可被体型抹掉；报警立即降级。限成人。",
    palette: {"temperature":"对比温","texture":"巨掌棉","primary_intensity_default":0.7,"accent_intensity_default":0.7},
    focus: ["scale_contrast","enveloping","strength_gap_care","position_adaptation","mutual_dignity"],
    avoid: ["写成一方无人格","忽略适配与舒适","用体差合理化伤害"],
  },
  bondage_focus: {
    group: "特殊风味",
    label: "束缚向",
    description:
      "安全剪写进开场检查，血运神经检查成环。漏检不上绳；解开有安抚。警告后继续即事故。限成人。",
    palette: {"temperature":"紧压","texture":"绳纤","primary_intensity_default":0.75,"accent_intensity_default":0.65},
    focus: ["restraint_geometry","circulation_check","safety_shears","helpless_trust","release_ritual"],
    avoid: ["无检查的危险吊缚伤害","儿童性化"],
  },
  pain_edge: {
    group: "特殊风味",
    label: "疼痛边缘向",
    description:
      "交通灯在承受方一侧，黄灯冻结加码。痛是可对话强度阶；事后护理复盘。限成人协商。",
    palette: {"temperature":"锐热","texture":"鞭痕","primary_intensity_default":0.85,"accent_intensity_default":0.6},
    focus: ["negotiated_intensity","traffic_light","pain_as_dialogue","mark_care","emotional_check"],
    avoid: ["无协商施暴","儿童性化"],
  },
  sacrilege: {
    group: "特殊风味",
    label: "圣渎向",
    description:
      "虚构神圣符号可还俗；愧疚与快感并行。事后告解净礼或决裂；无代价空壳亵玩出局。限成人可中止。",
    palette: {"temperature":"烛火","texture":"圣布撕开","primary_intensity_default":0.7,"accent_intensity_default":0.85},
    focus: ["sacred_symbol","transgression_thrill","guilt_pleasure","fictional_cult","after_confession"],
    avoid: ["针对真实宗教群体的仇恨色情","儿童性化"],
  },
  objectification_prop: {
    group: "特殊风味",
    label: "物化器物向",
    description:
      "计时复位铃恢复人称；协议不得覆盖安全词。超时按事故；复位后先叫人名。限成人协商。",
    palette: {"temperature":"物冷","texture":"瓷/金属","primary_intensity_default":0.8,"accent_intensity_default":0.7},
    focus: ["timed_object_role","use_and_reset","safeword_override","dignity_return","debrief"],
    avoid: ["永久物化无复位","儿童性化"],
  },
  uniform_ritual: {
    group: "特殊风味",
    label: "制服仪式向",
    description:
      "更衣自主与卸装时刻必须在。布料声响与衔级手势入戏；全天不可卸按压迫写。限成人。",
    palette: {"temperature":"浆烫","texture":"布料纹章","primary_intensity_default":0.65,"accent_intensity_default":0.7},
    focus: ["dressing_ritual","rank_gesture","fabric_sound","role_voice","undress_reverse"],
    avoid: ["校服未成年性化","儿童性化"],
  },
};
