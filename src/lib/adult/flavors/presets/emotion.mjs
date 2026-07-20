/**
 * 口味·情绪基调
 * description 逐条手写，声口互不复用。
 */
export var PRESETS = {
  vanilla: {
    group: '情绪基调',
    label: '纯爱向',
    description:
      '亲密靠问句推进：要不要、这里行不行、还好吗。技巧可以少，被珍惜的感觉与事后递水盖衣不能少。对象须为可叫停的成人。',
    palette: { temperature: '暖', texture: '棉布', primary_intensity_default: 0.5, accent_intensity_default: 0.6 },
    focus: ['emotional_depth', 'consent', 'aftercare', 'tenderness', 'trust'],
    avoid: ['强制', '羞辱', '血腥', '疼痛超出角色 Limits'],
  },
  sweet: {
    group: '情绪基调',
    label: '甜蜜向',
    description:
      '昵称、偷亲、把对方哄笑到没脾气；吃味点到为止再用「就你」收回。小游戏留退出笑话，甜不能变成糖衣控制。限成人合意。',
    palette: { temperature: '暖甜', texture: '棉花糖', primary_intensity_default: 0.4, accent_intensity_default: 0.5 },
    focus: ['spoiling', 'affection', 'playful', 'mutual_adoration', 'giggling'],
    avoid: ['冷漠', '若即若离', '情感虐待', '欲擒故纵'],
  },
  slice_of_life: {
    group: '情绪基调',
    label: '日常向',
    description:
      '洗碗水、沙发凹陷、闹钟打断也算合法落幕。性是生活的一部分，事后语气要接得上「明天谁倒垃圾」。限成人，拒绝偶像剧布景腔。',
    palette: { temperature: '暖偏凉', texture: '棉麻', primary_intensity_default: 0.4, accent_intensity_default: 0.3 },
    focus: ['casual_intimacy', 'humor', 'comfort', 'familiarity', 'domestic'],
    avoid: ['过度戏剧化', '强行紧张', '脱离日常人设'],
  },
  healing: {
    group: '情绪基调',
    label: '救赎向',
    description:
      '旧伤清单可被划掉、改期或只握手。触碰证明「你可以放心」，快感服务于疗愈不是征服。允许反复退缩；禁止一次亲密治好终生。双方成人。',
    palette: { temperature: '温→暖', texture: '温水', primary_intensity_default: 0.3, accent_intensity_default: 0.6 },
    focus: ['healing', 'trust_building', 'past_trauma', 'gentle_pacing', 'emotional_safety'],
    avoid: ['急于推进', '无视对方的退缩信号', '用性代替沟通'],
  },
  intense: {
    group: '情绪基调',
    label: '恣意向',
    description:
      '温度、肌束、呼吸断句代替「很爽」。失控时仍要让人看见贪恋或害怕什么；过载后补水降噪，未冷却不得连开。限可叫停的成人。',
    palette: { temperature: '炽热', texture: '丝绸', primary_intensity_default: 1, accent_intensity_default: 0.8 },
    focus: ['sensory_details', 'body_reactions', 'loss_of_control', 'overwhelm', 'climax_buildup'],
    avoid: ['油腻模板', '同义堆砌', '忽略心理层'],
  },
  angst: {
    group: '情绪基调',
    label: '虐恋向',
    description:
      '痛要有来由：赎罪、证明还爱、或把自己弄碎以免更碎。痛完落地更完整或更麻木，收场点名谁修复。无代价虐感特效出局。限成人。',
    palette: { temperature: '冷→偶尔炽热', texture: '碎玻璃', primary_intensity_default: 0.7, accent_intensity_default: 0.9 },
    focus: ['emotional_pain', 'redemption', 'fate', 'self_destruction', 'healing_through_pain'],
    avoid: ['无代价的伤害', '美化暴力', '忽略情感后坐力'],
  },
  dark: {
    group: '情绪基调',
    label: '暗黑向',
    description:
      '开场做一个明知不干净的选择，再写空间与信息如何被收窄。快感与内疚并存；深渊里仍要看得见退出的缝。角色成年，风险可叙述。',
    palette: { temperature: '冷', texture: '刀刃', primary_intensity_default: 0.9, accent_intensity_default: 0.7 },
    focus: ['moral_ambiguity', 'coercion_atmosphere', 'emotional_cost', 'guilt', 'powerlessness'],
    avoid: ['轻浮消解禁忌', '不经铺垫的转折', '美化伤害'],
  },
  despair: {
    group: '情绪基调',
    label: '绝望向',
    description:
      '把对方体温当成存活证据；麻木被击穿可以很短，事后往往更冷。自毁倾向出现时医疗与第三人叫停优先于文采。限成人，禁浪漫化自毁。',
    palette: { temperature: '冰→短暂的烫', texture: '锈铁', primary_intensity_default: 0.8, accent_intensity_default: 0.9 },
    focus: ['existential_despair', 'self_destruction', 'last_resort', 'numbness_breaking', 'hollow_after'],
    avoid: ['浪漫化自毁', '忽略心理后果', '把绝望写成中二'],
  },
  jealousy: {
    group: '情绪基调',
    label: '妒意向',
    description:
      '嫉妒要有燃料：未回消息、第三者的笑、被忽视的座位。吃味点燃欲望，事后仍须被接住；允许否认比较并离开。暴力惩罚不是解法。限成人。',
    palette: { temperature: '烫→酸', texture: '柠檬皮', primary_intensity_default: 0.7, accent_intensity_default: 0.8 },
    focus: ['jealous_spark', 'comparison', 'possessive_flash', 'shame_after', 'reassurance_seek'],
    avoid: ['无动机无端吃醋', '家暴式惩罚当情趣', '忽略事后安抚'],
  },
  possessive: {
    group: '情绪基调',
    label: '占有向',
    description:
      '「你是我的」落在称呼、力度与可洗掉的痕迹上；被占有方要有接受、谈判或拒绝。宣示结束演示摘除信物，证明有期限。限成人协商。',
    palette: { temperature: '恒温偏热', texture: '烙印皮', primary_intensity_default: 0.85, accent_intensity_default: 0.6 },
    focus: ['claiming', 'exclusivity', 'marking_words', 'belonging_need', 'jealous_after_claim'],
    avoid: ['物化无情感', '无 Limits 的囚禁美化', '忽略被占有方的主体感'],
  },
  melancholy: {
    group: '情绪基调',
    label: '忧郁向',
    description:
      '雨声窗雾与未说完的句子比高潮重要。触碰慢、声音低，门把留在画面里证明可离开。事后苦甜，禁止一秒切成欢闹。限成人。',
    palette: { temperature: '凉湿', texture: '雾玻璃', primary_intensity_default: 0.45, accent_intensity_default: 0.75 },
    focus: ['quiet_desire', 'unspoken_ache', 'slow_touch', 'bittersweet', 'lingering_silence'],
    avoid: ['强行欢闹冲淡忧郁', '只有文艺腔无身体', '突然变成甜蜜喜剧'],
  },
  euphoria: {
    group: '情绪基调',
    label: '狂欢向',
    description:
      '笑到岔气、灯太亮、音乐太吵的共同发疯；峰值后落地尴尬、空虚或余温。熔断降到耳语再确认合意，禁止永恒高潮。限成人可中断。',
    palette: { temperature: '爆热', texture: '香槟泡沫', primary_intensity_default: 0.95, accent_intensity_default: 0.7 },
    focus: ['peak_joy', 'reckless_laughter', 'overstimulation_bright', 'festival_afterglow', 'shared_madness'],
    avoid: ['无代价永恒高潮', '忽略次日尴尬或空虚', '写成纯噪音无亲密'],
  },
  obsession: {
    group: '情绪基调',
    label: '痴恋向',
    description:
      '反复确认与注视循环很黏，但停损谈话与「关闭回路」必须出现。跟踪若被奖励而无代价，改写成侵害。限可协商可中断的成人；禁止儿童性化。',
    palette: { temperature: '灼热', texture: '烙印', primary_intensity_default: 0.85, accent_intensity_default: 0.8 },
    focus: ['fixation', 'reassurance_loop', 'jealous_watch', 'soft_crash', 'boundary_talk'],
    avoid: ['跟踪伤害无批判', '无停损', '儿童性化'],
  },
  vengeful_desire: {
    group: '情绪基调',
    label: '报复欲向',
    description:
      '先钉要讨回什么。合意报复须事先谈规则；含强迫则黑暗有重量。清算动作点名旧账，事后和解、反噬或更深仇怨写透。限成人；禁止儿童性化。',
    palette: { temperature: '冷笑的热', texture: '刃', primary_intensity_default: 0.8, accent_intensity_default: 0.75 },
    focus: ['score_settling', 'ironic_tenderness', 'power_flip', 'aftermath_reckoning', 'consent_gray_explicit'],
    avoid: ['无批判的纯虐报复爽', '儿童性化'],
  },
  awe_dread_lust: {
    group: '情绪基调',
    label: '敬畏恐惧欲',
    description:
      '敬畏来自神职、爵位或灾异权柄，不是凭空下跪。战栗与欲望分层，每次靠近先请求许可；结束后安放余悸、恢复平等声音。限成人可中止；禁止儿童性化。',
    palette: { temperature: '寒战发热', texture: '圣布+暗', primary_intensity_default: 0.7, accent_intensity_default: 0.85 },
    focus: ['kneel_awe', 'sacred_dread', 'trembling_desire', 'permission_ask', 'gentle_descend'],
    avoid: ['无同意神权强奸美化', '儿童性化'],
  },
};
