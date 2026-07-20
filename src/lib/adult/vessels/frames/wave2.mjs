/**
 * 第二波扩展框架：血月/卡界/触手/粘液/循环/民国/西部/虫巢
 */
export var FRAMES = {
  blood_moon: {
    id: "blood_moon",
    label: "血月灾变",
    lexicon: [ "血月", "潮汐", "变异", "宵禁", "赤潮", "月蚀钟", "避月所", "血契", "猎月人", "红雾", "月相表", "净化盐" ],
    antiLexicon: [ "灵根渡劫", "经纪通告", "义体排异", "宫廷请安" ],
    signals: [ "血月", "红雾", "避月", "变异", "宵禁", "月相", "赤潮", "猎月" ],
    vesselSeeds: [
      {
        kind: "artifact",
        nameHint: "月相手环/避月盐袋/血契印"
      },
      {
        kind: "place",
        nameHint: "避月所隔间/红雾瞭望塔"
      },
      {
        kind: "rule",
        nameHint: "宵禁令/血月暴露条例"
      },
      {
        kind: "substance",
        nameHint: "抗潮药剂/催情红雾拮抗剂"
      },
      {
        kind: "org",
        nameHint: "猎月人公会/避月委员会"
      },
      {
        kind: "ritual",
        nameHint: "血月守夜/潮汐结盟"
      }
    ]
  },
  card_world: {
    id: "card_world",
    label: "卡牌规则界",
    lexicon: [ "卡组", "抽卡", "费用", "场地", "连锁", "稀有度", "决斗场", "卡背契约", "坟场", "除外", "规则书", "裁判" ],
    antiLexicon: [ "灵石飞剑", "辐射配额", "宫规侍寝", "脑机接口" ],
    signals: [ "卡牌", "抽卡", "费用", "决斗", "稀有度", "连锁", "场地", "裁判" ],
    vesselSeeds: [
      {
        kind: "artifact",
        nameHint: "契约卡背/费用枷锁/稀有度项圈"
      },
      {
        kind: "place",
        nameHint: "决斗场隔间/卡库密室"
      },
      {
        kind: "rule",
        nameHint: "规则书禁招/连锁强制条款"
      },
      {
        kind: "org",
        nameHint: "裁判会/卡商公会"
      },
      {
        kind: "ritual",
        nameHint: "开包仪式/败者献卡"
      },
      {
        kind: "ability",
        nameHint: "场地效果共鸣/卡魂同步"
      }
    ]
  },
  tentacle_abyss: {
    id: "tentacle_abyss",
    label: "触手海渊",
    lexicon: [ "触手", "海渊", "共生孔", "粘液契约", "潮汐巢", "深鸣", "缠缚", "渊种", "呼吸膜", "共生体", "盐雾", "渊律" ],
    antiLexicon: [ "宫廷仪仗", "异能评级证", "经纪合同", "机甲座舱" ],
    signals: [ "触手", "海渊", "缠缚", "粘液", "共生", "深鸣", "渊巢", "呼吸膜" ],
    vesselSeeds: [
      {
        kind: "place",
        nameHint: "潮汐巢室/呼吸膜舱"
      },
      {
        kind: "artifact",
        nameHint: "共生环/缠缚束带/渊种封印瓶"
      },
      {
        kind: "rule",
        nameHint: "渊律同意条款/解缠口令"
      },
      {
        kind: "substance",
        nameHint: "镇定粘液/共生营养液"
      },
      {
        kind: "org",
        nameHint: "共生体议会/猎渊船队"
      },
      {
        kind: "ritual",
        nameHint: "初次缠缚仪/解契退潮"
      }
    ]
  },
  slime_ecology: {
    id: "slime_ecology",
    label: "粘液生态",
    lexicon: [ "粘液", "凝胶", "溶解", "再生", "共生膜", "酸碱潮", "软体市", "固化盐", "渗透", "半固态", "营养池", "清洁律" ],
    antiLexicon: [ "飞剑宗门", "宫墙密折", "机甲军规", "血月宵禁" ],
    signals: [ "粘液", "凝胶", "溶解", "再生", "软体", "渗透", "固化", "营养池" ],
    vesselSeeds: [
      {
        kind: "place",
        nameHint: "营养池浴/软体市隔帘"
      },
      {
        kind: "artifact",
        nameHint: "固化环/渗透探针/清洁符"
      },
      {
        kind: "substance",
        nameHint: "中和剂/催凝粉/营养凝胶"
      },
      {
        kind: "rule",
        nameHint: "清洁律/非自愿溶解禁令"
      },
      {
        kind: "org",
        nameHint: "软体商会/中和诊所"
      },
      {
        kind: "ritual",
        nameHint: "共生膜接合/定期清洁"
      }
    ]
  },
  time_loop: {
    id: "time_loop",
    label: "时间循环",
    lexicon: [ "循环", "重置", "锚点", "记忆残留", "昨日", "钟楼", "断点", "目击者", "同一天", "例外物", "回声", "逃环者" ],
    antiLexicon: [ "灵石飞升", "经纪通告表", "辐射配额", "卡牌费用" ],
    signals: [ "循环", "重置", "锚点", "昨日", "断点", "同一天", "逃环", "记忆残留" ],
    vesselSeeds: [
      {
        kind: "artifact",
        nameHint: "锚点怀表/例外物戒指/断点钥"
      },
      {
        kind: "place",
        nameHint: "钟楼密室/昨日重播站台"
      },
      {
        kind: "rule",
        nameHint: "循环守则/记忆交易禁令"
      },
      {
        kind: "org",
        nameHint: "逃环者互助会/钟楼看守"
      },
      {
        kind: "ritual",
        nameHint: "重置前告别/锚点校准"
      },
      {
        kind: "ability",
        nameHint: "残留共感/断点预感"
      }
    ]
  },
  republican_era: {
    id: "republican_era",
    label: "民国坊间",
    lexicon: [ "租界", "报馆", "舞厅", "电报", "军阀", "里弄", "洋行", "戏园", "密信", "巡捕", "烟馆", "同乡会" ],
    antiLexicon: [ "灵根秘境", "义体接口", "机甲同步", "卡牌决斗" ],
    signals: [ "民国", "租界", "报馆", "舞厅", "里弄", "军阀", "电报", "巡捕" ],
    vesselSeeds: [
      {
        kind: "place",
        nameHint: "舞厅包厢/里弄阁楼/报馆暗室"
      },
      {
        kind: "artifact",
        nameHint: "密信夹层/手铳押物/舞票"
      },
      {
        kind: "rule",
        nameHint: "租界宵禁/巡捕盘查"
      },
      {
        kind: "org",
        nameHint: "同乡会/报馆编辑部/洋行买办"
      },
      {
        kind: "substance",
        nameHint: "烟膏/安眠粉/伤药"
      },
      {
        kind: "ritual",
        nameHint: "结拜酒/报馆暗号"
      }
    ]
  },
  western_frontier: {
    id: "western_frontier",
    label: "西部荒野",
    lexicon: [ "荒野", "酒馆", "赏金", "铁路", "警长", "牧场", "决斗", "驿站", "沙暴", "马具", "矿镇", "边警" ],
    antiLexicon: [ "宗门贡献点", "神经同步", "卡费连锁", "血月红雾" ],
    signals: [ "荒野", "酒馆", "赏金", "警长", "决斗", "铁路", "牧场", "驿站" ],
    vesselSeeds: [
      {
        kind: "place",
        nameHint: "酒馆阁楼/驿站牢房/矿道暗处"
      },
      {
        kind: "artifact",
        nameHint: "手铐/赏金海报/马具束带"
      },
      {
        kind: "rule",
        nameHint: "镇子法/决斗约定"
      },
      {
        kind: "org",
        nameHint: "警长署/赏金公会/铁路公司"
      },
      {
        kind: "substance",
        nameHint: "威士忌/止痛草药/火药"
      },
      {
        kind: "ritual",
        nameHint: "决斗前握手/入镇宣誓"
      }
    ]
  },
  bio_hive: {
    id: "bio_hive",
    label: "虫巢孢子",
    lexicon: [ "虫巢", "孢子", "信息素", "母巢", "工蜂级", "菌毯", "蜂室", "共生壳", "孵化", "女王", "菌丝网", "净化火" ],
    antiLexicon: [ "宫廷密折", "卡牌坟场", "机甲军衔", "租界巡捕" ],
    signals: [ "虫巢", "孢子", "信息素", "母巢", "菌丝", "女王", "孵化", "蜂室" ],
    vesselSeeds: [
      {
        kind: "place",
        nameHint: "蜂室哺育舱/菌毯静室"
      },
      {
        kind: "artifact",
        nameHint: "信息素环/共生壳甲/孢子瓶"
      },
      {
        kind: "rule",
        nameHint: "母巢级阶法/净化火禁令"
      },
      {
        kind: "substance",
        nameHint: "镇定孢粉/营养浆"
      },
      {
        kind: "org",
        nameHint: "工蜂议会/猎孢队"
      },
      {
        kind: "ritual",
        nameHint: "归巢标记/级阶晋升"
      }
    ]
  }
};

export var ENRICHMENT = {
  blood_moon: {
    mustCover: [ "血月灾变核心语汇如何物化为可触发机制", "违约/暴露/灾变的可见代价", "公开名义下的伪装借口", "至少一件标志器物或场所规则", "与具名势力/个体的不对等或共生关系" ],
    writingGuide: "用血月灾变自己的制度与物件写欲望，禁止串台到无关世界观玩具清单。情欲限成人，载体要能解释同意、中断与代价。",
    antiPatterns: [ "串台语汇", "只有氛围没有机制", "无代价的无限玩法" ],
    densityHint: 340,
    signals: [ "血月", "红雾", "避月", "变异", "宵禁", "月相" ]
  },
  card_world: {
    mustCover: [ "卡牌规则界核心语汇如何物化为可触发机制", "违约/暴露/灾变的可见代价", "公开名义下的伪装借口", "至少一件标志器物或场所规则", "与具名势力/个体的不对等或共生关系" ],
    writingGuide: "用卡牌规则界自己的制度与物件写欲望，禁止串台到无关世界观玩具清单。情欲限成人，载体要能解释同意、中断与代价。",
    antiPatterns: [ "串台语汇", "只有氛围没有机制", "无代价的无限玩法" ],
    densityHint: 340,
    signals: [ "卡牌", "抽卡", "费用", "决斗", "稀有度", "连锁" ]
  },
  tentacle_abyss: {
    mustCover: [ "触手海渊核心语汇如何物化为可触发机制", "违约/暴露/灾变的可见代价", "公开名义下的伪装借口", "至少一件标志器物或场所规则", "与具名势力/个体的不对等或共生关系" ],
    writingGuide: "用触手海渊自己的制度与物件写欲望，禁止串台到无关世界观玩具清单。情欲限成人，载体要能解释同意、中断与代价。",
    antiPatterns: [ "串台语汇", "只有氛围没有机制", "无代价的无限玩法" ],
    densityHint: 340,
    signals: [ "触手", "海渊", "缠缚", "粘液", "共生", "深鸣" ]
  },
  slime_ecology: {
    mustCover: [ "粘液生态核心语汇如何物化为可触发机制", "违约/暴露/灾变的可见代价", "公开名义下的伪装借口", "至少一件标志器物或场所规则", "与具名势力/个体的不对等或共生关系" ],
    writingGuide: "用粘液生态自己的制度与物件写欲望，禁止串台到无关世界观玩具清单。情欲限成人，载体要能解释同意、中断与代价。",
    antiPatterns: [ "串台语汇", "只有氛围没有机制", "无代价的无限玩法" ],
    densityHint: 340,
    signals: [ "粘液", "凝胶", "溶解", "再生", "软体", "渗透" ]
  },
  time_loop: {
    mustCover: [ "时间循环核心语汇如何物化为可触发机制", "违约/暴露/灾变的可见代价", "公开名义下的伪装借口", "至少一件标志器物或场所规则", "与具名势力/个体的不对等或共生关系" ],
    writingGuide: "用时间循环自己的制度与物件写欲望，禁止串台到无关世界观玩具清单。情欲限成人，载体要能解释同意、中断与代价。",
    antiPatterns: [ "串台语汇", "只有氛围没有机制", "无代价的无限玩法" ],
    densityHint: 340,
    signals: [ "循环", "重置", "锚点", "昨日", "断点", "同一天" ]
  },
  republican_era: {
    mustCover: [ "民国坊间核心语汇如何物化为可触发机制", "违约/暴露/灾变的可见代价", "公开名义下的伪装借口", "至少一件标志器物或场所规则", "与具名势力/个体的不对等或共生关系" ],
    writingGuide: "用民国坊间自己的制度与物件写欲望，禁止串台到无关世界观玩具清单。情欲限成人，载体要能解释同意、中断与代价。",
    antiPatterns: [ "串台语汇", "只有氛围没有机制", "无代价的无限玩法" ],
    densityHint: 340,
    signals: [ "民国", "租界", "报馆", "舞厅", "里弄", "军阀" ]
  },
  western_frontier: {
    mustCover: [ "西部荒野核心语汇如何物化为可触发机制", "违约/暴露/灾变的可见代价", "公开名义下的伪装借口", "至少一件标志器物或场所规则", "与具名势力/个体的不对等或共生关系" ],
    writingGuide: "用西部荒野自己的制度与物件写欲望，禁止串台到无关世界观玩具清单。情欲限成人，载体要能解释同意、中断与代价。",
    antiPatterns: [ "串台语汇", "只有氛围没有机制", "无代价的无限玩法" ],
    densityHint: 340,
    signals: [ "荒野", "酒馆", "赏金", "警长", "决斗", "铁路" ]
  },
  bio_hive: {
    mustCover: [ "虫巢孢子核心语汇如何物化为可触发机制", "违约/暴露/灾变的可见代价", "公开名义下的伪装借口", "至少一件标志器物或场所规则", "与具名势力/个体的不对等或共生关系" ],
    writingGuide: "用虫巢孢子自己的制度与物件写欲望，禁止串台到无关世界观玩具清单。情欲限成人，载体要能解释同意、中断与代价。",
    antiPatterns: [ "串台语汇", "只有氛围没有机制", "无代价的无限玩法" ],
    densityHint: 340,
    signals: [ "虫巢", "孢子", "信息素", "母巢", "菌丝", "女王" ]
  }
};
