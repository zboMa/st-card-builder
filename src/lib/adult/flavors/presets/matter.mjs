/**
 * 口味·异质物质（触手/体液/粘液等）
 * description 逐条手写；成年边界自然嵌入，禁止条条复制同一长句。
 */
export var PRESETS = {
  tentacle: {
    group: '异质物质',
    label: '触手向',
    description:
      '节拍、包围与口令协作：谁还能呼吸、谁还能喊停、解缠后如何清理，比堆触腕重要。解缠口令一出必须松绑。只写已完成设定成年礼的成人。',
    palette: { temperature: '湿冷→热', texture: '柔韧粘滑', primary_intensity_default: 0.85, accent_intensity_default: 0.7 },
    focus: ['entwine', 'multi_point_touch', 'nonhuman_rhythm', 'safe_word_release', 'aftercare_unwind'],
    avoid: ['无同意强制缠死', '无解缠机制', '儿童性化'],
  },
  bodily_fluids: {
    group: '异质物质',
    label: '体液向',
    description:
      '汗盐、泪咸、爱液黏度写成亲昵证据；先对齐可留皮肤/可入口/须即擦三档。每次弄脏对应清理换衣，拒舔拒吞立即生效。限可中断的成人关系。',
    palette: { temperature: '体温湿', texture: '黏潮', primary_intensity_default: 0.75, accent_intensity_default: 0.8 },
    focus: ['fluid_marking', 'taste_scent', 'mess_intimacy', 'cleanup_care', 'consent_boundaries'],
    avoid: ['无同意强迫吞咽', '病理羞辱无安抚', '儿童性化'],
  },
  oviposition_play: {
    group: '异质物质',
    label: '产卵暗示向',
    description:
      '钉死为可取出的道具或异能表演，不是真实强制妊娠。规格、取出工具、检查点与中止词同场；胀感可慢，检查不过关就停。限成人合意。',
    palette: { temperature: '温胀', texture: '卵壳光滑', primary_intensity_default: 0.8, accent_intensity_default: 0.65 },
    focus: ['fullness', 'insertion_removal', 'ritual_gestation_fiction', 'aftercare_check', 'safe_toys'],
    avoid: ['真实非自愿妊娠强迫美化', '儿童性化', '无取出机制'],
  },
  slime: {
    group: '异质物质',
    label: '粘液向',
    description:
      '中和剂在谁手里、凝胶是否挡口鼻，第一镜就交代。乐趣是短暂失重与被托住，不是腐蚀。解除后冲淋、护理皮肤与处理黏腻尴尬。限可退出成人场景。',
    palette: { temperature: '凉滑→体温', texture: '凝胶', primary_intensity_default: 0.7, accent_intensity_default: 0.75 },
    focus: ['encase', 'slippery_restraint', 'dissolve_edge', 'neutralizer', 'cleanup'],
    avoid: ['非自愿溶解伤害美化', '无中和剂', '儿童性化'],
  },
  pheromone: {
    group: '异质物质',
    label: '信息素向',
    description:
      '气味改写「要不要走近」的判断；抑制贴、开窗、净味与旁人介入并行。合意催情可浓，违规暴香按越界记账。角色须成年且保有叫停权。',
    palette: { temperature: '热嗅', texture: '空气薄麝', primary_intensity_default: 0.8, accent_intensity_default: 0.7 },
    focus: ['scent_rank', 'inhibitor_patch', 'consensual_surge', 'withdrawal', 'after_scent_care'],
    avoid: ['强制暴香迷奸', '无抑制贴', '儿童性化'],
  },
  body_morph: {
    group: '异质物质',
    label: '变形躯体向',
    description:
      '范围上限与暂停键先于奇观；镜子或第三方确认「还是我」。回滚后酸痛、自我陌生或兴奋成瘾要给一笔。永久致残不是情趣。限成人协商。',
    palette: { temperature: '变异热', texture: '皮肤改写', primary_intensity_default: 0.75, accent_intensity_default: 0.7 },
    focus: ['temporary_morph', 'self_recognition', 'reversible', 'pause_safe', 'mirror_check'],
    avoid: ['永久非自愿致残美化', '无回滚', '儿童性化'],
  },
  nonhuman_orifice: {
    group: '异质物质',
    label: '非人孔窍向',
    description:
      '短生理说明建立期待：哪里敏感、哪里不能硬来、润滑要多久。试探允许提问叫停，护理与猎奇触感同权。解剖差异不是伤害免责。限可沟通成人。',
    palette: { temperature: '异温', texture: '非人黏膜', primary_intensity_default: 0.8, accent_intensity_default: 0.75 },
    focus: ['anatomy_diff', 'lubrication_safety', 'species_pace', 'education_consent', 'aftercare'],
    avoid: ['无视解剖的硬套伤害', '无润滑安全', '儿童性化'],
  },
  symbiosis_parasite: {
    group: '异质物质',
    label: '共生寄生向',
    description:
      '低语可以色情，但穿插姓名与痛觉证明主体还在。合意共生有期限与观察期；侵害路径写剥离代价。永久夺舍不得当恋爱默认。限成人。',
    palette: { temperature: '内热', texture: '脉动共生', primary_intensity_default: 0.85, accent_intensity_default: 0.7 },
    focus: ['shared_pulse', 'inner_voice', 'consensual_bond', 'detach_clause', 'identity_border'],
    avoid: ['非自愿寄生永久控制美化', '无剥离', '儿童性化'],
  },
};
