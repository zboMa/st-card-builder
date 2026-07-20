/**
 * 口味·感官节奏
 */
export var PRESETS = {
  slowburn: {
    group: '感官节奏',
    label: '慢燃向',
    description: '极长的前戏与推迟满足——每一寸布料、每一次停顿都在加压，爆发被故意延后',
    palette: { temperature: '慢升温', texture: '绸带抽丝', primary_intensity_default: 0.45, accent_intensity_default: 0.9 },
    focus: ['delayed_gratification', 'micro_touches', 'anticipation_stack', 'almost_moments', 'payoff_timing'],
    avoid: ['开场即高潮', '省略加压过程', '慢而无张力'],
  },
  quickie: {
    group: '感官节奏',
    label: '速战向',
    description: '时间紧迫的短促亲密——门后、间隙、赶时间的喘息，密度换长度',
    palette: { temperature: '骤热骤凉', texture: '皱布', primary_intensity_default: 0.85, accent_intensity_default: 0.5 },
    focus: ['time_pressure', 'half_dressed', 'urgent_breath', 'stolen_moment', 'messy_after'],
    avoid: ['写成完整长戏压缩版', '无紧迫感的空喊快', '忽略事后匆忙余韵'],
  },
  public_risk: {
    group: '感官节奏',
    label: '风险向',
    description: '可能被发现的边缘场景——半公开、隔墙、人群外沿；肾上腺素与羞耻共同供能',
    palette: { temperature: '冷汗热核', texture: '隔音薄壁', primary_intensity_default: 0.75, accent_intensity_default: 0.85 },
    focus: ['discovery_risk', 'volume_control', 'adrenaline', 'almost_caught', 'private_after_public'],
    avoid: ['无同意的真实公开羞辱', '无视法律/安全边界', '只有刺激无事后落地'],
  },
  aftercare_focus: {
    group: '感官节奏',
    label: '安抚向',
    description: '把 aftercare 写成主戏——水、毯子、低语、检查身体与情绪，亲密在结束后才真正完成',
    palette: { temperature: '回温', texture: '毯子绒', primary_intensity_default: 0.35, accent_intensity_default: 0.8 },
    focus: ['aftercare_ritual', 'hydration_warmth', 'emotional_debrief', 'body_check', 'reassurance_loop'],
    avoid: ['事后一笔带过', '只照顾身体不问情绪', '用安抚掩盖未协商伤害'],
  },
  edging_control: {
    group: '感官节奏',
    label: '边缘向',
    description: '反复推向临界又拉回——控制权在「允不允许到」上，崩溃与恳求成为节奏',
    palette: { temperature: '临界烫', texture: '拉紧的弦', primary_intensity_default: 0.8, accent_intensity_default: 0.9 },
    focus: ['edge_cycles', 'deny_and_return', 'begging_threshold', 'control_voice', 'release_permission'],
    avoid: ['无安全词的无限剥夺', '忽略生理极限', '最终无释放也无协商收束'],
  },
  mirror_play: {
    group: '感官节奏',
    label: '镜像向',
    description: '镜子、倒影、被迫看见自己——视觉反馈把羞耻与兴奋叠在同一画面',
    palette: { temperature: '镜面凉', texture: '水银玻璃', primary_intensity_default: 0.65, accent_intensity_default: 0.85 },
    focus: ['self_gaze', 'forced_witness', 'visual_feedback', 'shame_pride_mix', 'mirror_dialogue'],
    avoid: ['无同意强迫观看', '只有镜子道具无心理', '忽略事后自我形象冲击'],
  },
  orgasm_control: {
    group: '感官节奏',
    label: '高潮控制',
    description: '允不准、何时准、如何准——高潮成为可授予的特权，规则清晰且可撤回',
    palette: { temperature: '控温', texture: '锁链丝', primary_intensity_default: 0.75, accent_intensity_default: 0.8 },
    focus: ['permission_structure', 'timed_release', 'ruined_or_full', 'rule_clarity', 'post_release_care'],
    avoid: ['无协商的永久禁止', '忽视身体信号', '控制方无视安全词'],
  },
};
