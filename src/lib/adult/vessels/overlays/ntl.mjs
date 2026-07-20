/**
 * NTL → 载体侧重
 * 对齐真实 NTL_TABOO_IDS（25）；旧键经 NTL_OVERLAY_ALIASES 映射
 */

export var NTL_VESSEL_OVERLAYS = {
  age_gap: {
    mustCover: ['成熟度差相关的教养/庇护器物', '礼法成年边界写进规则', '被旁人误读年龄差的暴露代价'],
    writingGuide: '年龄差张力用信物与监护名义物化；双方必须是已完成设定成年礼的成人。',
    antiPatterns: ['任何儿童性化暗示', '无成年边界的暧昧监护'],
    signals: ['成熟', '庇护', '礼法', '成年', '教养'],
  },
  status_gap: {
    mustCover: ['身份边界相关的场所/条例/教具', '越界被处分的职业代价', '正当公务名义下的伪装'],
    writingGuide: '师生/医患/上下级的载体必须像制度内会存在的东西。',
    antiPatterns: ['无关身份的普通情趣清单'],
    signals: ['身份', '职务', '条例', '越界', '公务'],
  },
  emotional_forbidden: {
    mustCover: ['背德关系的隐匿信物', '「不该爱」对象相关的场所锚点', '被发现的情感连锁代价'],
    writingGuide: '载体服务「不该发生却发生」的情感禁忌。',
    antiPatterns: ['无关禁忌对象的普通道具'],
    signals: ['隐匿', '背德', '不该', '被发现'],
  },
  moral_conflict: {
    mustCover: ['象征底线崩塌的仪式/器物', '每次使用降低道德阈值的机制', '崩塌后的自我叙事道具（日记/镜）'],
    writingGuide: '道德滑坡要有计量器。',
    antiPatterns: ['瞬间黑化无过程'],
    signals: ['底线', '崩塌', '阈值', '日记'],
  },
  situational: {
    mustCover: ['危险/公共情境的空间机关', '情境结束即失效的临时规则', '被打断的逃生或掩饰路径'],
    writingGuide: '情境禁忌靠场所与时间窗，不是关系标签。',
    antiPatterns: ['无情境压力的室内常规'],
    signals: ['情境', '时间窗', '打断', '公共', '危险'],
  },
  secret_affair: {
    mustCover: ['地下关系的隐匿通道/暗号信物', '双重日程的伪装器物', '曝光威胁的传播路径'],
    writingGuide: '偷情要有后门钥匙与双重说法。',
    antiPatterns: ['公开甜蜜无隐匿成本'],
    signals: ['地下', '暗号', '双重', '曝光'],
  },
  redemption_captor: {
    mustCover: ['俘获与救赎共用的束缚/钥匙', '敌对身份下的照料器物', '放下武器或解开锁的阶段性条件'],
    writingGuide: '斯德哥尔摩式张力要物化为「锁与药同箱」。',
    antiPatterns: ['无俘获结构的纯甜'],
    signals: ['俘获', '钥匙', '敌对', '救赎', '解开'],
  },
  blood_kin_tension: {
    mustCover: ['名分/宗族礼法相关的信物或禁令', '血缘称呼与欲望冲突的仪式裂缝', '仅限成年角色的明确 Limits'],
    writingGuide: '血亲张力写礼法与名分；禁止儿童，写清成年边界。',
    antiPatterns: ['儿童性化', '无视名分的普通乱伦标签'],
    signals: ['名分', '宗族', '礼法', '禁令', '成年'],
  },
  marriage_duty: {
    mustCover: ['婚约/联姻文书或信物', '义务侍奉与真心越界的对照规则', '毁约或尽职的代价表'],
    writingGuide: '婚约义务本身就是载体：文书、聘礼、侍夜规程。',
    antiPatterns: ['无视婚约结构的自由恋爱道具'],
    signals: ['婚约', '联姻', '义务', '文书', '侍奉'],
  },
  debt_bond: {
    mustCover: ['债契/欠条/命债凭证', '分期偿还的亲密计价规则', '违约追加抵押的机制'],
    writingGuide: '债务羁绊要有账本与抵押物。',
    antiPatterns: ['无凭证的模糊亏欠'],
    signals: ['债', '欠条', '偿还', '抵押', '账'],
  },
  faith_breach: {
    mustCover: ['誓言/教义相关的圣物或戒律牌', '渎神/破戒的可见标记', '神罚或教团处分的代价'],
    writingGuide: '信仰背弃靠圣物被玷污、戒律被改写。',
    antiPatterns: ['无信仰锚点的空喊背德'],
    signals: ['誓言', '戒律', '渎神', '破戒', '圣物'],
  },
  class_caste: {
    mustCover: ['等级标识/通行令/种姓标记', '越级接触的禁地或罚则', '伪装成合法侍奉的社会掩护'],
    writingGuide: '阶级禁忌写进通行证与罚则。',
    antiPatterns: ['无等级制度的普通恋爱'],
    signals: ['等级', '种姓', '通行', '越级', '罚则'],
  },
  power_coercion: {
    mustCover: ['权限/禁制/把柄类强制载体', '拒绝成本写进规则', '表面自愿实则无法退出的漏洞'],
    writingGuide: '胁迫写进器物权限与条例，不靠吼。',
    antiPatterns: ['无结构性压力的口头威胁'],
    signals: ['权限', '把柄', '禁制', '无法退出'],
  },
  blackmail: {
    mustCover: ['把柄物证/录音/记忆结晶', '勒索交换条件', '暴露威胁的传播路径'],
    writingGuide: '秘密本身就是载体。',
    antiPatterns: ['无物证的空口勒索'],
    signals: ['把柄', '物证', '勒索', '暴露'],
  },
  mind_influence: {
    mustCover: ['精神/神识/脑机操控机制', '残留指令与自我怀疑', '解除条件与反噬'],
    writingGuide: '操控必须有通道与残留，不是魔法口头禅。',
    antiPatterns: ['无机制洗脑'],
    signals: ['精神', '神识', '指令', '残留', '解除'],
  },
  body_debt: {
    mustCover: ['身体抵押契约或计价表', '分期「偿还」的日程器物', '提前结清或追加利息的规则'],
    writingGuide: '身体偿债要有契约与日历，亲密被标价。',
    antiPatterns: ['无契约的模糊献身'],
    signals: ['抵押', '计价', '偿还', '契约', '利息'],
  },
  surveillance_control: {
    mustCover: ['监视装置/追踪符/日志权限', '日程管控与汇报规则', '隐私被剥光后的服从反馈'],
    writingGuide: '监视控制靠镜头、符印与必打卡节点。',
    antiPatterns: ['无监控物证的空口控制'],
    signals: ['监视', '追踪', '日志', '汇报', '隐私'],
  },
  hostage_leverage: {
    mustCover: ['人质/珍视物相关的挟持信物', '伤害威胁的可见倒计时机制', '顺从可换安全的交换规则'],
    writingGuide: '人质杠杆要有「按下即伤」的物证与倒计时。',
    antiPatterns: ['无人质锚点的口头威胁'],
    signals: ['人质', '挟持', '倒计时', '交换', '珍视'],
  },
  yuri_destruction: {
    mustCover: ['介入者用以拆散原纽带的器物/能力', '原百合信物被污染或夺占', '破坏后的关系残片载体（半对耳环/旧契约）'],
    writingGuide: '百破载体要同时碰到「原纽带」与「介入者」。',
    antiPatterns: ['只写介入者玩具、无视原纽带信物'],
    signals: ['介入', '拆散', '信物', '残片', '百合'],
  },
  love_triangle_break: {
    mustCover: ['三角各方信物的对照与污染', '信任破裂的物证（信/录音/现场）', '选边或两头骗的场所规则'],
    writingGuide: '三角撕裂靠三套信物互相打架。',
    antiPatterns: ['只有对白吃醋无物证'],
    signals: ['三角', '信物', '背叛', '物证', '选边'],
  },
  ownership_claim: {
    mustCover: ['所有权印记/项圈/契约纹身', '公开与私下两套可见度', '剥离印记的代价'],
    writingGuide: '归属要看得见、撕得疼。',
    antiPatterns: ['可随便洗掉的无代价标记'],
    signals: ['印记', '项圈', '所有权', '剥离'],
  },
  public_exposure: {
    mustCover: ['推到聚光灯下的展示装置/场所', '曝光传播路径（流言/镜头/公告）', '羞耻与毁灭并行的善后规则'],
    writingGuide: '公开曝光是舞台工程：灯、镜头、公告栏。',
    antiPatterns: ['无传播后果的伪公开'],
    signals: ['曝光', '聚光', '流言', '镜头', '公告'],
  },
  identity_usurp: {
    mustCover: ['冒名/顶替用的信物或易容机制', '原身份被架空的物证', '身份戳破时的连锁代价'],
    writingGuide: '身份篡夺靠证件、信物、声音与房间钥匙。',
    antiPatterns: ['无冒名机制的单纯出轨'],
    signals: ['冒名', '顶替', '信物', '架空', '戳破'],
  },
  cult_initiation: {
    mustCover: ['入会仪式器物与献身誓词', '旧自我被重写的标记/药剂', '教团规则下的退出不可能条款'],
    writingGuide: '教团入会要有坛、誓、印；退出要极贵。',
    antiPatterns: ['无仪式结构的普通调教'],
    signals: ['入会', '仪式', '誓词', '教团', '重写'],
  },
  arranged_replacement: {
    mustCover: ['指定替代的文书/聘约/名额', '原角色被撤换的物证', '替代品身份的公开伪装与私下真相'],
    writingGuide: '安排替代写成编制与文书：谁被换下、谁顶上。',
    antiPatterns: ['无替代结构的普通三角'],
    signals: ['替代', '文书', '撤换', '名额', '顶替'],
  },
  mentor_disciple: {
      mustCover: [ "拜师帖/传功器物", "教习场所门禁", "宗门处分条例物证" ],
      writingGuide: "名分器物化。",
      antiPatterns: [ "无师门结构的普通乱伦标签" ],
      signals: [ "拜师", "传功", "处分" ]
    },
  doctor_patient_ethic: {
      mustCover: [ "病历权限", "约束带/诊帘规则", "投诉与伦理委员会路径" ],
      writingGuide: "医疗器物双义。",
      antiPatterns: [ "无医疗逻辑刑具" ],
      signals: [ "病历", "诊帘", "伦理委员会" ]
    },
  fan_idol_bond: {
      mustCover: [ "应援物/后台通行证", "私生跟踪的反制安检", "解约公关" ],
      writingGuide: "通告与安检进机制。",
      antiPatterns: [ "无行业结构" ],
      signals: [ "后台", "安检", "公关" ]
    },
  pow_asylum: {
      mustCover: [ "战俘登记牌", "收留宅规则", "军法/国际法条款抄本" ],
      writingGuide: "登记与军法可见。",
      antiPatterns: [ "无登记的黑牢当甜" ],
      signals: [ "登记", "军法", "收留" ]
    },
  workplace_quid: {
      mustCover: [ "合同附件陷阱", "监控/录音证据位", "举报箱或形同虚设的制度" ],
      writingGuide: "证据位要设计。",
      antiPatterns: [ "无系统的个人色狼脸谱" ],
      signals: [ "合同", "证据", "举报" ]
    },
  occupation_zone: {
      mustCover: [ "通行证", "宵禁哨", "军法处" ],
      writingGuide: "占领靠证件与宵禁运转。",
      antiPatterns: [ "无占领制度的乱兵清单" ],
      signals: [ "通行证", "宵禁", "军法" ]
    },
  drug_leverage: {
      mustCover: [ "药剂编号", "戒断病房", "供应链打击点" ],
      writingGuide: "编号可追责。",
      antiPatterns: [ "无追责的魔法迷药" ],
      signals: [ "编号", "病房", "供应链" ]
    },
  opinion_kidnap: {
      mustCover: [ "匿名帖传播链", "公关危机手册", "证据保存箱" ],
      writingGuide: "传播链可画出来。",
      antiPatterns: [ "无媒介的空舆论" ],
      signals: [ "传播", "公关", "证据箱" ]
    },
  cuckold_structure: {
      mustCover: [ "规则文书或信物", "观看/回避的空间设计", "事后三方谈话场所" ],
      writingGuide: "空间服务观看政治。",
      antiPatterns: [ "无规则的突袭伤害当唯一" ],
      signals: [ "规则", "空间", "三方" ]
    },
  public_punishment_culture: {
      mustCover: [ "法场规制", "观众席等级", "医疗救护是否允许" ],
      writingGuide: "法场是制度建筑。",
      antiPatterns: [ "无法场的巷打" ],
      signals: [ "法场", "观众席", "救护" ]
    },
  memory_rewrite: {
      mustCover: [ "神经柜/咒印", "回滚备份", "非法篡改罪条文" ],
      writingGuide: "备份与罪法并行。",
      antiPatterns: [ "无备份的永久洗脑甜宠" ],
      signals: [ "备份", "罪法", "咒印" ]
    },
  faked_death_return: {
      mustCover: [ "假死亡证明", "替身契约", "揭露物证" ],
      writingGuide: "文书与替身契是核心。",
      antiPatterns: [ "无文书的肥皂剧" ],
      signals: [ "死亡证明", "替身契", "物证" ]
    },
  breeding_politics: {
      mustCover: [ "配额证", "查验机构", "地下避孕网络" ],
      writingGuide: "证件政治。",
      antiPatterns: [ "无机构的空政策" ],
      signals: [ "配额证", "查验", "地下" ]
    },
  confession_blackmail_faith: {
      mustCover: [ "告解室隔音作伪", "教廷法庭", "密档柜" ],
      writingGuide: "密档是核心。",
      antiPatterns: [ "无密档的空口勒索" ],
      signals: [ "告解室", "密档", "法庭" ]
    },
};

/**
 * 旧 NTL overlay 键 → 真实 NTL id
 */
export var NTL_OVERLAY_ALIASES = {
  forbidden_relation: 'emotional_forbidden',
  mind_control: 'mind_influence',
  noncon_atmosphere: 'power_coercion',
  secrecy_blackmail: 'blackmail',
  ownership_mark: 'ownership_claim',
  moral_collapse: 'moral_conflict',
  taboo_exchange: 'debt_bond',
};
