/**
 * 口味 → 载体侧重（与人物层口味互补：这里写「世界如何物化该口味」）
 * 对齐 NSFWFLAVOR_IDS：每个口味必须有 overlay
 */

export var FLAVOR_VESSEL_OVERLAYS = {
  vanilla: {
    mustCover: ['可双向撤回的安全机制', 'aftercare 相关场所或药剂', '信任信物而非单方面控制物'],
    writingGuide: '载体强调可协商、可停止；器物带安抚功能。',
    antiPatterns: ['不可逆强制锁', '无安全词等价物'],
    signals: ['安全', '撤回', '安抚', '信物', '同意'],
  },
  sweet: {
    mustCover: ['宠溺向赠礼/共享空间', '昵称或标记类轻量信物', '笑声与玩闹可触发的场景道具'],
    writingGuide: '载体像情侣间的秘密玩具与小空间，而非刑具。',
    antiPatterns: ['冰冷刑具美学'],
    signals: ['赠礼', '共享', '昵称', '标记', '玩闹'],
  },
  slice_of_life: {
    mustCover: ['日常物件被征用的用法', '生活动线中的私密角落', '用完仍能回到日常的收纳/伪装'],
    writingGuide: '厨房、沙发、通勤包里的东西比祭坛更重要。',
    antiPatterns: ['过度仪式化舞台'],
    signals: ['日常', '角落', '收纳', '生活'],
  },
  healing: {
    mustCover: ['可随时中断的疗愈场所规则', '安抚性药剂或触感器物', '触发创伤时的退出机制'],
    writingGuide: '载体先保护再亲密；禁止不可退出的锁死装置当主轴。',
    antiPatterns: ['无退出的强制束缚'],
    signals: ['中断', '疗愈', '安抚', '退出', '安全'],
  },
  intense: {
    mustCover: ['可叠加感官的器物/能力机制', '过载临界与冷却代价', '连续刺激的场所或阵法'],
    writingGuide: '机制要能解释「为什么会失控到生理极限」。',
    antiPatterns: ['只有「很刺激」无过载规则'],
    signals: ['过载', '临界', '叠加', '冷却', '感官'],
  },
  angst: {
    mustCover: ['带情感代价的契约/信物', '使用后留下伤痕或记忆残响', '救赎与自毁之间的规则裂缝'],
    writingGuide: '器物本身携带愧疚与依赖，不只是疼痛工具。',
    antiPatterns: ['无情感后坐力的纯痛'],
    signals: ['契约', '伤痕', '愧疚', '救赎', '残响'],
  },
  dark: {
    mustCover: ['胁迫性权限或禁制', '道德撕裂的规则条文', '秘密档案/把柄类载体'],
    writingGuide: '权力写进规则与器物权限，不靠空喊黑暗。',
    antiPatterns: ['轻浮消解胁迫'],
    signals: ['权限', '禁制', '把柄', '胁迫', '秘密'],
  },
  despair: {
    mustCover: ['自毁倾向相关的危险载体', '「还活着」的感官确认机制', '使用后的空洞余波规则'],
    writingGuide: '载体服务于存在确认，不是无后果的酷刑清单。',
    antiPatterns: ['浪漫化无后果自毁'],
    signals: ['自毁', '确认', '空洞', '余波'],
  },
  jealousy: {
    mustCover: ['触发嫉妒的可见信物或第三者痕迹', '占有确认用的对照器物/场所', '嫉妒爆发后的冷却或道歉仪式道具'],
    writingGuide: '嫉妒要物化为「看见了什么」：痕迹、座位、专属标记。',
    antiPatterns: ['只有口头吃醋无物证'],
    signals: ['嫉妒', '痕迹', '专属', '对照', '占有'],
  },
  possessive: {
    mustCover: ['所有权宣示类标记/项圈/契约', '限制他人接近的场所或规则', '剥离归属的可见代价'],
    writingGuide: '占有写成可佩戴、可展示、可惩罚的载体系统。',
    antiPatterns: ['口头宣示无物证'],
    signals: ['所有权', '项圈', '专属', '禁止接近'],
  },
  melancholy: {
    mustCover: ['唤起旧忆的信物或场所残响', '温柔却伤人的安抚器物', '离别/错过相关的时间机制'],
    writingGuide: '忧郁靠物件唤起：旧信、空座位、过期药剂。',
    antiPatterns: ['无记忆锚点的空泛忧伤'],
    signals: ['旧忆', '残响', '离别', '信物'],
  },
  euphoria: {
    mustCover: ['可瞬间抬升快感的药剂/能力/阵', '高潮余韵的场所或共享机制', '回落期的保护规则'],
    writingGuide: '欢愉要有触发器与回落保护，不是持续尖叫。',
    antiPatterns: ['无回落的无限高潮'],
    signals: ['欢愉', '抬升', '余韵', '回落'],
  },
  domination: {
    mustCover: ['可渐进加强的训诫器物/功法', '仪式感场所或口令规则', '训练阶段与晋级条件'],
    writingGuide: '调教要有进度条：器物/规则随服从加深而升级。',
    antiPatterns: ['一步到位无训练过程'],
    signals: ['训诫', '口令', '阶段', '晋级', '仪式'],
  },
  brat: {
    mustCover: ['挑衅可触发的惩罚机制', '可被「治住」的反制器物', '嘴硬仍生效的契约漏洞'],
    writingGuide: '载体要给 brat 留挑衅空间，也要有反噬。',
    antiPatterns: ['完全无法反抗的秒杀锁'],
    signals: ['挑衅', '惩罚', '反制', '治住'],
  },
  gentle_dom: {
    mustCover: ['照顾型束缚/看护场所', '询问式确认的协议或符文', '疼痛监控与安抚配套'],
    writingGuide: '掌控写成护理协议：先问再绑，器物带监测。',
    antiPatterns: ['冷暴力刑具主轴'],
    signals: ['看护', '确认', '监测', '安抚', '协议'],
  },
  service: {
    mustCover: ['侍奉用器物/岗位规则', '以对方愉悦为指标的反馈机制', '臣服标记但保留尊严的信物'],
    writingGuide: '载体成就「被需要」，不是自我践踏。',
    antiPatterns: ['无尊严羞辱工具当唯一载体'],
    signals: ['侍奉', '岗位', '标记', '奉献'],
  },
  pursuit: {
    mustCover: ['拉近/推远的追踪或感应器物', '延迟满足的场所规则', '猎物与猎人身份可互换的漏洞'],
    writingGuide: '追逐要有道具与地图，不只是对白拉扯。',
    antiPatterns: ['直接捕获无过程'],
    signals: ['追踪', '感应', '延迟', '猎人', '猎物'],
  },
  seduction: {
    mustCover: ['诱导性丹药/魔药/香氛或暗示物', '一步步加深的契约或功法', '天真被侵蚀的可见标记'],
    writingGuide: '引导过程物化为「每次多生效一点」的载体。',
    antiPatterns: ['瞬间洗脑无步骤'],
    signals: ['诱导', '加深', '标记', '香', '契约'],
  },
  denial_surrender: {
    mustCover: ['抗拒期仍可佩戴的轻量禁制', '崩溃点触发的升级机制', '投降后的安抚/烙印仪式'],
    writingGuide: '载体跟着心理弧光变档：从可摘到摘不掉。',
    antiPatterns: ['开局即完全奴役'],
    signals: ['禁制', '崩溃', '投降', '烙印', '升级'],
  },
  enemies: {
    mustCover: ['可兼作武器与亲密束缚的器物', '敌对阵营的禁忌交易场所', '恨意契约或血仇规则'],
    writingGuide: '亲密与杀意共用同一件东西。',
    antiPatterns: ['突然变成甜蜜信物无转折'],
    signals: ['武器', '血仇', '敌对', '禁忌交易'],
  },
  switch_dynamic: {
    mustCover: ['权限可对调的双钥/双印机制', '角色切换的仪式或口令', '切换后责任与售后规则'],
    writingGuide: 'Switch 要物化为「谁握钥」：同一套器物两套用法。',
    antiPatterns: ['固定单边无切换机关'],
    signals: ['切换', '双钥', '对调', '口令'],
  },
  mentor_guide: {
    mustCover: ['教学名义的教具/功法/课程场所', '示范→练习→考核的阶段器物', '越界时的师门/职业掩护说法'],
    writingGuide: '引导写成教案：教具、功课、过关条件。',
    antiPatterns: ['无教学结构的纯压制'],
    signals: ['教学', '教具', '功课', '示范', '考核'],
  },
  rivalry_heat: {
    mustCover: ['胜负可兑换亲密的赌约器物', '对峙场所与观众规则', '不服输可再挑战的重置机制'],
    writingGuide: '较劲要有计分板与赌注物，不只是互呛。',
    antiPatterns: ['无赌注的空口较劲'],
    signals: ['赌约', '胜负', '对峙', '重置'],
  },
  caregiver: {
    mustCover: ['照护日程/喂食/安抚类器物', '依赖与被需要的反馈机制', '照护者过载时的替班/中断规则'],
    writingGuide: '照顾写入器物与日程表，亲密是照护的延伸。',
    antiPatterns: ['忽略照护者负荷'],
    signals: ['照护', '喂食', '安抚', '日程', '依赖'],
  },
  voyeur_exhibit: {
    mustCover: ['可视/可听的暴露装置或场所布局', '观众存在（真或暗示）的证据链', '展示与隐藏切换的机关'],
    writingGuide: '观看欲靠空间与物证：单向镜、帘缝、直播灯。',
    antiPatterns: ['无观众风险的空喊暴露'],
    signals: ['观看', '暴露', '帘', '镜', '观众'],
  },
  discipline: {
    mustCover: ['成文规则→违规→惩罚→安抚的闭环器物/条例', '惩罚记录或戒疤类痕迹', '安抚配套场所或药剂'],
    writingGuide: '没有规则条文就没有惩戒载体。',
    antiPatterns: ['只罚不安抚', '无规则前提的惩罚'],
    signals: ['条例', '违规', '惩罚', '安抚', '记录'],
  },
  shame: {
    mustCover: ['暴露风险相关的场所/监视物', '羞耻标记但可隐藏的信物', '言语羞辱与身体反应的触发器'],
    writingGuide: '羞耻靠「可能被看见」的空间与物证。',
    antiPatterns: ['无观众风险的空喊羞耻'],
    signals: ['暴露', '监视', '标记', '看见', '羞耻'],
  },
  fantasy: {
    mustCover: ['种族/非人特性驱动的专用载体', '魔力或血脉才能启动的机制', '他者身体差异写入器物设计'],
    writingGuide: '架空口味的载体必须吃设定：鳞、翼、毒、夜视等都要进机制。',
    antiPatterns: ['人形换皮+普通道具'],
    signals: ['种族', '血脉', '非人', '魔力', '特性'],
  },
  primal: {
    mustCover: ['气味/标记/领地类载体', '理智退场的触发条件与冷却', '兽化相关束缚或巢穴场所'],
    writingGuide: '本能要有生理触发器，不是标签。',
    antiPatterns: ['秒回理智无冷却'],
    signals: ['气味', '标记', '领地', '兽化', '巢'],
  },
  contrast: {
    mustCover: ['公开人设用的正当道具 vs 私下真用法', '切换两套用法的隐藏机关', '人设崩裂时留下的物证'],
    writingGuide: '反差靠「同一物件两套说法」。',
    antiPatterns: ['公私场景完全两套无关联物'],
    signals: ['公开', '私下', '隐藏', '人设', '物证'],
  },
  temperature_play: {
    mustCover: ['冷热可切换的器物/药剂/阵法', '温度阈值与耐受代价', '烫伤/冻伤防护与中断规则'],
    writingGuide: '温度本身是机制：导热、符温、冷冻凝胶都要写清。',
    antiPatterns: ['无安全阈值的极端温度'],
    signals: ['温度', '冷', '热', '阈值', '导热'],
  },
  sensory_deprivation: {
    mustCover: ['视觉/听觉/触觉剥夺装置', '剥夺时长与恐慌退出机制', '恢复感官时的过载保护'],
    writingGuide: '剥夺要有开关与时限，恢复也是戏的一部分。',
    antiPatterns: ['无限期无退出的感官锁死'],
    signals: ['剥夺', '蒙眼', '静音', '时限', '恢复'],
  },
  hypnosis_play: {
    mustCover: ['暗示/催眠的通道器物或能力', '触发词与解除词成对出现', '残留暗示的冷却与自检规则'],
    writingGuide: '催眠玩法必须有通道、触发与解除，禁止无机制洗脑。',
    antiPatterns: ['无解除条件的永久操控'],
    signals: ['暗示', '触发词', '解除', '残留', '催眠'],
  },
  marking_claim: {
    mustCover: ['可见或半可见的归属标记机制', '标记消退/加深的条件', '公开场合如何掩饰标记'],
    writingGuide: '标记要能被看到、被隐藏、被加深。',
    antiPatterns: ['无痕迹的口头宣示'],
    signals: ['标记', '印', '消退', '加深', '掩饰'],
  },
  size_difference: {
    mustCover: ['体型差驱动的专用束缚/承托器物', '重心与安全承重机制', '不适时的调整/退出规则'],
    writingGuide: '体型差要进工程：高度、承重、够不到的开关。',
    antiPatterns: ['忽略物理安全的纯幻想标签'],
    signals: ['体型', '承重', '高度', '够不到', '承托'],
  },
  slowburn: {
    mustCover: ['进度极慢的契约/信物升级链', '每次仅加深一点的场所规则', '长期压抑的可见痕迹'],
    writingGuide: '慢热靠「升级很贵」的载体：信物要攒、权限要攒。',
    antiPatterns: ['开局满级亲密'],
    signals: ['缓慢', '升级', '攒', '压抑', '进度'],
  },
  quickie: {
    mustCover: ['可快速展开/收起的便携载体', '时间窗与被打断风险', '事后三十秒复位的收纳伪装'],
    writingGuide: '快餐式亲密要有计时器与便携物，不是省略过程。',
    antiPatterns: ['无时间压力的冗长仪式'],
    signals: ['快速', '便携', '时间窗', '收纳', '打断'],
  },
  public_risk: {
    mustCover: ['半公开场所的掩护物/隔断', '被发现的传播路径与代价', '风险等级可调节的机关'],
    writingGuide: '公众风险写成空间工程：隔间、噪声、视线死角。',
    antiPatterns: ['无被发现后果的伪公开'],
    signals: ['公开', '掩护', '发现', '隔断', '风险'],
  },
  aftercare_focus: {
    mustCover: ['事后安抚专用场所或药剂', '检查伤痕/情绪的流程器物', '未完成售后不得离开的规则'],
    writingGuide: '售后是主菜：毯子、温水、检查清单都是载体。',
    antiPatterns: ['只有高潮无售后'],
    signals: ['售后', '安抚', '检查', '温水', '清单'],
  },
  edging_control: {
    mustCover: ['接近顶点可打断的禁制/装置', '累计次数与释放条件', '失控时的安全熔断'],
    writingGuide: '边缘控制要有计数器与熔断，不是无限吊着。',
    antiPatterns: ['无释放条件的永久拒绝'],
    signals: ['边缘', '打断', '累计', '释放', '熔断'],
  },
  mirror_play: {
    mustCover: ['镜像/录像/分身类反馈装置', '被迫直视自己的场所布局', '记录保存与销毁规则'],
    writingGuide: '镜子与镜头是角色，不是背景。',
    antiPatterns: ['无反馈的普通场所'],
    signals: ['镜', '映像', '录像', '直视', '销毁'],
  },
  orgasm_control: {
    mustCover: ['允许/禁止高潮的权限器物', '请示—批准流程的信物或口令', '违规高潮的标记或惩罚机制'],
    writingGuide: '高潮权限要可授予、可收回、可审计。',
    antiPatterns: ['无权限结构的随机拒绝'],
    signals: ['高潮', '批准', '权限', '禁止', '请示'],
  },
  tentacle: {
      mustCover: [ "可公证的解缠口令器物", "缠缚场所的分区与退出通道", "清理粘液的药剂/清洗间" ],
      writingGuide: "世界要提供解缠信物与清洗设施，禁止只有缠没有退。",
      antiPatterns: [ "无退出的永久缠死装置当唯一玩法" ],
      signals: [ "口令", "解缠", "清洗", "分区", "信物" ]
    },
  bodily_fluids: {
      mustCover: [ "清洗间/换衣规则", "可接受的标记范围条例", "清洁药剂或沐浴设施" ],
      writingGuide: "载体提供可清洗、可限制范围的物质条件。",
      antiPatterns: [ "无清洁设施的强制弄脏" ],
      signals: [ "清洗", "标记范围", "药剂", "沐浴" ]
    },
  oviposition_play: {
      mustCover: [ "可取出的卵形器物规格", "检查与取出的医疗/仪式场所", "停止口令等价物" ],
      writingGuide: "载体必须支持取出与中止，禁止不可逆强制孕育装置当甜宠。",
      antiPatterns: [ "不可取出的永久植入当默认" ],
      signals: [ "取出", "规格", "检查", "口令", "中止" ]
    },
  slime: {
      mustCover: [ "中和剂配给点", "清洁律相关设施", "包裹可解除的机关" ],
      writingGuide: "市政级清洁与中和必须存在。",
      antiPatterns: [ "无解除机关的永久凝胶牢" ],
      signals: [ "中和剂", "清洁", "解除", "机关" ]
    },
  pheromone: {
      mustCover: [ "抑制贴/净味场所", "暴香罪相关条例物证", "嗅觉检测装置" ],
      writingGuide: "世界提供抑制与执法，不只是「很香」。",
      antiPatterns: [ "无抑制物资" ],
      signals: [ "抑制贴", "净味", "检测", "条例" ]
    },
  body_morph: {
      mustCover: [ "回滚药剂/装置", "变形许可证件", "镜像确认室" ],
      writingGuide: "许可与回滚是公共基础设施。",
      antiPatterns: [ "无回滚的永久改造刑具当默认情趣" ],
      signals: [ "回滚", "许可", "镜像", "药剂" ]
    },
  nonhuman_orifice: {
      mustCover: [ "物种生理手册类载体", "专用润滑/适配器物", "护理室" ],
      writingGuide: "世界提供适配说明与护理，不是只有猎奇。",
      antiPatterns: [ "无适配说明的伤害器具" ],
      signals: [ "手册", "润滑", "适配", "护理" ]
    },
  symbiosis_parasite: {
      mustCover: [ "剥离仪式/药剂", "共生契约文书", "自我边界检测" ],
      writingGuide: "契约与剥离必须可执行。",
      antiPatterns: [ "不可剥离的永久寄生当默认恋爱" ],
      signals: [ "剥离", "契约", "检测", "药剂" ]
    },
  obsession: {
      mustCover: [ "可切断的监视信物规则", "冷静期场所", "边界协议物证" ],
      writingGuide: "世界提供冷静期与切断机制。",
      antiPatterns: [ "不可关闭的监控当甜宠" ],
      signals: [ "切断", "冷静期", "协议" ]
    },
  vengeful_desire: {
      mustCover: [ "可记录的旧怨信物", "翻转权力的场所规则", "和解或永裂的仪式" ],
      writingGuide: "旧怨要物证化。",
      antiPatterns: [ "无动机的随机施暴" ],
      signals: [ "旧怨", "信物", "翻转", "和解" ]
    },
  awe_dread_lust: {
      mustCover: [ "请愿仪式器物", "可拒绝的神谕结构", "安放场所" ],
      writingGuide: "拒绝必须可能。",
      antiPatterns: [ "不可拒绝的神谕强奸机关" ],
      signals: [ "请愿", "拒绝", "安放" ]
    },
  protocol_slave: {
      mustCover: [ "可销毁的契约文本", "安全词信物", "复核日程装置" ],
      writingGuide: "文本可毁、词可喊。",
      antiPatterns: [ "不可毁永契当唯一" ],
      signals: [ "文本", "信物", "复核" ]
    },
  public_protocol: {
      mustCover: [ "可关闭的展示场", "观众准入名单", "紧急降下幕布机制" ],
      writingGuide: "幕布必须降得下来。",
      antiPatterns: [ "无降下的永久曝光台" ],
      signals: [ "名单", "幕布", "准入" ]
    },
  group_power_field: {
      mustCover: [ "否决信物", "轮转计时", "多人安抚空间" ],
      writingGuide: "否决信物人人可见。",
      antiPatterns: [ "无否决机制的围场" ],
      signals: [ "否决", "计时", "安抚空间" ]
    },
  bondage_focus: {
      mustCover: [ "安全剪固定位置", "束缚点设计规范", "解开后护理站" ],
      writingGuide: "场所预装安全。",
      antiPatterns: [ "无剪的死结刑架当情趣" ],
      signals: [ "安全剪", "规范", "护理" ]
    },
  pain_edge: {
      mustCover: [ "强度量表物证", "刹停铃", "护理药膏与记录" ],
      writingGuide: "铃与药膏是基础设施。",
      antiPatterns: [ "无刹停铃的刑具房" ],
      signals: [ "量表", "铃", "药膏" ]
    },
  sacrilege: {
      mustCover: [ "虚构圣器", "告解室规则", "可逆的符号污损清理" ],
      writingGuide: "污损可清理，避免不可逆亵渎真实圣地。",
      antiPatterns: [ "鼓励现实破坏宗教场所" ],
      signals: [ "圣器", "告解", "清理" ]
    },
  objectification_prop: {
      mustCover: [ "计时器", "复位袍/更衣", "安全词灯" ],
      writingGuide: "计时结束自动提醒复位。",
      antiPatterns: [ "无计时永久陈列" ],
      signals: [ "计时", "复位", "灯" ]
    },
  uniform_ritual: {
      mustCover: [ "更衣间规则", "衔级标识器物", "成人制服库（非校服）" ],
      writingGuide: "库存与标识必须成人职业向。",
      antiPatterns: [ "未成年校服库存" ],
      signals: [ "更衣间", "衔级", "成人制服" ]
    },
  scent_focus: {
      mustCover: [ "通风/散味装置", "许可香品清单", "禁迷香条例" ],
      writingGuide: "通风是安全设施。",
      antiPatterns: [ "密闭强制迷香室当甜" ],
      signals: [ "通风", "清单", "禁令" ]
    },
  taste_focus: {
      mustCover: [ "忌口卡片", "可拒的喂食器物", "清水/漱口站" ],
      writingGuide: "忌口卡先于喂食。",
      antiPatterns: [ "无视忌口的灌食器" ],
      signals: [ "忌口", "清水", "拒" ]
    },
  voice_command: {
      mustCover: [ "指令备案板", "静音否决铃", "复盘对讲" ],
      writingGuide: "备案可见，铃可按。",
      antiPatterns: [ "无否决的强制耳麦" ],
      signals: [ "备案", "铃", "对讲" ]
    },
  blank_out: {
      mustCover: [ "捞回口令卡", "保温毯与补水点", "过载熔断装置" ],
      writingGuide: "熔断与毯子是标配。",
      antiPatterns: [ "无熔断的过载刑" ],
      signals: [ "熔断", "毯子", "口令卡" ]
    },
};
