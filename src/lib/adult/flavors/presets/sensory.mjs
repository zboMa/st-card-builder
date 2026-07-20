/**
 * 口味·感官节奏
 * description 逐条手写。
 */

export var PRESETS = {
  slowburn: {
    group: "感官节奏",
    label: "慢燃向",
    description:
      "微触与停顿堆渴望，日期可复议。「几乎得到」要双方都疼一下再共同决定是否释放。单方清零配额出局。限成人。",
    palette: {"temperature":"慢升温","texture":"绸带抽丝","primary_intensity_default":0.45,"accent_intensity_default":0.9},
    focus: ["delayed_gratification","micro_touches","anticipation_stack","almost_moments","payoff_timing"],
    avoid: ["开场即高潮","省略加压过程","慢而无张力"],
  },
  quickie: {
    group: "感官节奏",
    label: "速战向",
    description:
      "时间压力有来源：电梯、会议、钥匙响。半着衣局促制造密度，门锁与同意短句不可省。匆忙不是侵害许可证。限成人。",
    palette: {"temperature":"骤热骤凉","texture":"皱布","primary_intensity_default":0.85,"accent_intensity_default":0.5},
    focus: ["time_pressure","half_dressed","urgent_breath","stolen_moment","messy_after"],
    avoid: ["写成完整长戏压缩版","无紧迫感的空喊快","忽略事后匆忙余韵"],
  },
  public_risk: {
    group: "感官节奏",
    label: "风险向",
    description:
      "风险源具体到人影与监控灯。音量自控先于刺激，撤离演练后再升温；曝光不得单方面毁灭。限成人协商。",
    palette: {"temperature":"冷汗热核","texture":"隔音薄壁","primary_intensity_default":0.75,"accent_intensity_default":0.85},
    focus: ["discovery_risk","volume_control","adrenaline","almost_caught","private_after_public"],
    avoid: ["无同意的真实公开羞辱","无视法律/安全边界","只有刺激无事后落地"],
  },
  aftercare_focus: {
    group: "感官节奏",
    label: "安抚向",
    description:
      "补水保温检查红痕是主菜；复盘结束前禁止新刺激。善后可要求可拒绝，当审讯或勒索出局。限成人。",
    palette: {"temperature":"回温","texture":"毯子绒","primary_intensity_default":0.35,"accent_intensity_default":0.8},
    focus: ["aftercare_ritual","hydration_warmth","emotional_debrief","body_check","reassurance_loop"],
    avoid: ["事后一笔带过","只照顾身体不问情绪","用安抚掩盖未协商伤害"],
  },
  edging_control: {
    group: "感官节奏",
    label: "边缘向",
    description:
      "循环次数双方可读，用尽结束。被控方否决随时生效；最终释放或协商收束二选一。无限乞求上调按压榨。限成人。",
    palette: {"temperature":"临界烫","texture":"拉紧的弦","primary_intensity_default":0.8,"accent_intensity_default":0.9},
    focus: ["edge_cycles","deny_and_return","begging_threshold","control_voice","release_permission"],
    avoid: ["无安全词的无限剥夺","忽略生理极限","最终无释放也无协商收束"],
  },
  mirror_play: {
    group: "感官节奏",
    label: "镜像向",
    description:
      "遮镜权高于表演欲。协商下目睹自我，羞耻与兴奋被视觉放大；强制不可删录影按侵害。限成人协商。",
    palette: {"temperature":"镜面凉","texture":"水银玻璃","primary_intensity_default":0.65,"accent_intensity_default":0.85},
    focus: ["self_gaze","forced_witness","visual_feedback","shame_pride_mix","mirror_dialogue"],
    avoid: ["无同意强迫观看","只有镜子道具无心理","忽略事后自我形象冲击"],
  },
  orgasm_control: {
    group: "感官节奏",
    label: "高潮控制",
    description:
      "许可含否决拔销；允许/禁止清晰且可撤回。毁高潮不得不可协商默认；释放后护理确认。限成人。",
    palette: {"temperature":"控温","texture":"锁链丝","primary_intensity_default":0.75,"accent_intensity_default":0.8},
    focus: ["permission_structure","timed_release","ruined_or_full","rule_clarity","post_release_care"],
    avoid: ["无协商的永久禁止","忽视身体信号","控制方无视安全词"],
  },
  scent_focus: {
    group: "感官节奏",
    label: "气味向",
    description:
      "体香与空间层次勾起记忆；拒吸与通风优先于浓香。强制吸入按越界；事后散味与洗澡。限成人。",
    palette: {"temperature":"嗅觉热","texture":"空气丝","primary_intensity_default":0.6,"accent_intensity_default":0.8},
    focus: ["scent_memory","layering","mark_space","inhale_focus","air_out"],
    avoid: ["强制熏迷无同意","儿童性化"],
  },
  taste_focus: {
    group: "感官节奏",
    label: "味觉向",
    description:
      "忌口卡先于餐具。味道质地成亲昵语言，恶心过敏立即停喂；拒食权可见。限成人合意。",
    palette: {"temperature":"舌温","texture":"汁液","primary_intensity_default":0.65,"accent_intensity_default":0.7},
    focus: ["feed_kiss","flavor_pair","refuse_right","allergy_list","aftertaste_care"],
    avoid: ["强迫灌食","儿童性化"],
  },
  voice_command: {
    group: "感官节奏",
    label: "听觉指令向",
    description:
      "指令集事先对齐，静音键与安全词同级。耳返不得绕过当面同意；事后正常声音复盘。限成人。",
    palette: {"temperature":"耳廓热","texture":"声纹","primary_intensity_default":0.7,"accent_intensity_default":0.75},
    focus: ["command_set","whisper","mute_veto","tone_drop","debrief_voice"],
    avoid: ["强制洗脑无否决","儿童性化"],
  },
  blank_out: {
    group: "感官节奏",
    label: "失神空白向",
    description:
      "失神是短暂失语失时，不是永久失忆。唤回口令与检索步骤在场；失败立刻照料着陆。限成人可中断。",
    palette: {"temperature":"空白冷","texture":"雾","primary_intensity_default":0.85,"accent_intensity_default":0.7},
    focus: ["overload","blank_moment","retrieve_protocol","grounding","hydrate_warm"],
    avoid: ["故意致昏迷伤害无护理","儿童性化"],
  },
};
