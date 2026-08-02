/**
 * 古代中国载体框架（第一批：秦/西汉/东汉·三国）
 * 物化 NSFW 口味 / NTL 禁忌的容器：官署、宫掖、军府坞堡等
 */
export var FRAMES = {
  qin_yamen: {
    id: "qin_yamen",
    label: "秦·咸阳官署",
    lexicon: [
      "咸阳宫",
      "御史台",
      "廷尉",
      "上计",
      "符玺",
      "诏狱",
      "什伍连坐",
      "驰道",
      "户籍",
      "役册",
      "亭里",
      "关防",
      "律令",
      "黑漆官车"
    ],
    antiLexicon: [
      "跳蛋",
      "酒店",
      "义体",
      "神经接口",
      "霓虹",
      "异能协会"
    ],
    signals: [
      "咸阳",
      "御史",
      "廷尉",
      "连坐",
      "上计",
      "驰道",
      "役期",
      "律令"
    ],
    vesselSeeds: [
      { "kind": "artifact", "nameHint": "符玺印绶/廷尉勘合/上计官印" },
      { "kind": "place", "nameHint": "咸阳宫掖/廷尉诏狱/驰道亭驿" },
      { "kind": "rule", "nameHint": "什伍连坐令/役期勾销册/关防通行令" },
      { "kind": "org", "nameHint": "御史台/郎中令卫/县尉亭长" },
      { "kind": "substance", "nameHint": "刑徒口粮券/役夫过所/药酒" },
      { "kind": "ritual", "nameHint": "上计对账/焚书之祭/验契缔约" }
    ]
  },
  han_weiyang: {
    id: "han_weiyang",
    label: "汉宫·未央",
    lexicon: [
      "未央宫",
      "椒房殿",
      "掖庭",
      "女史",
      "侍寝档",
      "宦官",
      "北军",
      "符玺",
      "采选",
      "巫蛊",
      "立储",
      "宫宴",
      "赏赐",
      "宣室"
    ],
    antiLexicon: [
      "跳蛋",
      "酒店",
      "义体",
      "脑机",
      "霓虹",
      "办公室"
    ],
    signals: [
      "未央",
      "椒房",
      "掖庭",
      "侍寝",
      "宦官",
      "巫蛊",
      "立储",
      "采选"
    ],
    vesselSeeds: [
      { "kind": "artifact", "nameHint": "侍寝签/符玺/巫蛊桐偶" },
      { "kind": "place", "nameHint": "椒房殿/掖庭/宣室/北军营" },
      { "kind": "rule", "nameHint": "侍寝登记/采选标准/宫闱禁令" },
      { "kind": "org", "nameHint": "掖庭令/尚衣局/北军校尉" },
      { "kind": "substance", "nameHint": "安神香/赐药/避忌汤" },
      { "kind": "ritual", "nameHint": "侍寝排签/巫蛊埋偶/立储赐婚" }
    ]
  },
  sanguo_camp: {
    id: "sanguo_camp",
    label: "三国·军府坞堡",
    lexicon: [
      "军府",
      "坞堡",
      "部曲",
      "牙门",
      "羽檄",
      "斥候",
      "粮道",
      "屯田",
      "火攻",
      "联姻",
      "名帖",
      "坐次",
      "劝进",
      "军功"
    ],
    antiLexicon: [
      "跳蛋",
      "酒店",
      "义体",
      "脑机",
      "霓虹",
      "电梯"
    ],
    signals: [
      "军府",
      "坞堡",
      "粮道",
      "羽檄",
      "部曲",
      "屯田",
      "联姻",
      "名帖"
    ],
    vesselSeeds: [
      { "kind": "artifact", "nameHint": "名帖/羽檄/兵符/坞堡钥匙" },
      { "kind": "place", "nameHint": "中军大帐/坞堡角楼/粮仓/牙门" },
      { "kind": "rule", "nameHint": "部曲契/联姻盟约/军令状/鸣金号令" },
      { "kind": "org", "nameHint": "军府掾属/坞主宗族/屯田民屯" },
      { "kind": "substance", "nameHint": "战前同饮/伤药/屯粮券" },
      { "kind": "ritual", "nameHint": "歃血结盟/劝进表/婚约过聘/犒军" }
    ]
  },
  liangjin_manor: {
    id: "liangjin_manor",
    label: "两晋·门阀庄园",
    lexicon: [
      "九品中正",
      "谱牒",
      "郡望",
      "占田荫客",
      "部曲",
      "佃客",
      "清谈",
      "玄学",
      "服石",
      "名士",
      "雅集",
      "品第",
      "寒门",
      "婚宦"
    ],
    antiLexicon: [
      "跳蛋",
      "酒店",
      "义体",
      "脑机",
      "霓虹",
      "户籍机器"
    ],
    signals: [
      "九品",
      "谱牒",
      "郡望",
      "清谈",
      "服石",
      "雅集",
      "荫客",
      "名士"
    ],
    vesselSeeds: [
      { "kind": "artifact", "nameHint": "谱牒/九品品第簿/清谈题录/玉麈尾" },
      { "kind": "place", "nameHint": "庄园坞壁/清谈雅集堂/荫客田庄/服石静室" },
      { "kind": "rule", "nameHint": "占田荫客令/谱牒婚宦/九品定第/庄园族规" },
      { "kind": "org", "nameHint": "门阀宗族/庄园部曲/名士清流/寒门新秀" },
      { "kind": "substance", "nameHint": "五石散/寒食散/庄园醴酒" },
      { "kind": "ritual", "nameHint": "议婚过聘/雅集品题/服石行散/祠祭" }
    ]
  },
  nanbei_temple: {
    id: "nanbei_temple",
    label: "南北朝·寺观石窟",
    lexicon: [
      "寺院",
      "寺产",
      "度牒",
      "僧官",
      "石窟",
      "译经",
      "戒律",
      "比丘尼",
      "香客",
      "僧坊",
      "灭佛",
      "经卷",
      "碑铭",
      "佛前灯"
    ],
    antiLexicon: [
      "跳蛋",
      "酒店",
      "义体",
      "脑机",
      "霓虹",
      "夜店"
    ],
    signals: [
      "寺产",
      "度牒",
      "石窟",
      "译经",
      "戒律",
      "灭佛",
      "香客",
      "僧官"
    ],
    vesselSeeds: [
      { "kind": "artifact", "nameHint": "度牒/经卷/戒尺/佛前灯" },
      { "kind": "place", "nameHint": "石窟/僧坊/译经院/寺产田庄" },
      { "kind": "rule", "nameHint": "戒律清规/寺产免税/度牒身份/灭佛令" },
      { "kind": "org", "nameHint": "僧官署/译经团/香火会/寺户" },
      { "kind": "substance", "nameHint": "香灰/药汤/灯油/戒斋食" },
      { "kind": "ritual", "nameHint": "受戒/译经礼/开窟法会/犯戒处置" }
    ]
  },
  sui_canal: {
    id: "sui_canal",
    label: "隋·运河驿道",
    lexicon: [
      "运河",
      "漕运",
      "驿道",
      "关防",
      "里程",
      "龙舟",
      "纤夫",
      "船娘",
      "驿吏",
      "船坞",
      "南巡",
      "押运",
      "过所",
      "漕船"
    ],
    antiLexicon: [
      "跳蛋",
      "酒店",
      "义体",
      "脑机",
      "霓虹",
      "高铁"
    ],
    signals: [
      "运河",
      "漕运",
      "驿道",
      "关防",
      "龙舟",
      "纤夫",
      "过所",
      "驿站"
    ],
    vesselSeeds: [
      { "kind": "artifact", "nameHint": "过所文书/关防章/里程牌/漕船契" },
      { "kind": "place", "nameHint": "码头船坞/驿站/关防所/龙舟" },
      { "kind": "rule", "nameHint": "漕运里程/驿递限期/关防验文/过所通行" },
      { "kind": "org", "nameHint": "漕运司/驿站/船户行会/纤夫队" },
      { "kind": "substance", "nameHint": "干粮袋/船娘灶饭/驿马草料" },
      { "kind": "ritual", "nameHint": "起航祭/过关验文/龙舟接驾/驿站换马" }
    ]
  },
  tang_changan: {
    id: "tang_changan",
    label: "盛唐·长安教坊",
    lexicon: [
      "大明宫",
      "西市",
      "胡姬",
      "教坊",
      "梨园",
      "乐籍",
      "邸店",
      "柜坊",
      "坊墙",
      "宵禁",
      "曲江",
      "杏园",
      "进士",
      "乐工"
    ],
    antiLexicon: [
      "跳蛋",
      "酒店",
      "义体",
      "脑机",
      "霓虹",
      "地铁"
    ],
    signals: [
      "西市",
      "教坊",
      "梨园",
      "乐籍",
      "坊墙",
      "宵禁",
      "曲江",
      "胡姬"
    ],
    vesselSeeds: [
      { "kind": "artifact", "nameHint": "乐籍簿/飞钱券/坊门钥/曲谱" },
      { "kind": "place", "nameHint": "西市邸店/教坊/梨园/大明宫掖/坊曲" },
      { "kind": "rule", "nameHint": "乐籍身契/坊市宵禁/市籍市券/和亲出降" },
      { "kind": "org", "nameHint": "教坊司/梨园/邸店柜坊/武侯" },
      { "kind": "substance", "nameHint": "胡姬酒/赎身钱/赐药/琵琶弦" },
      { "kind": "ritual", "nameHint": "点曲侍宴/杏园探花/坊门开闭/报捷" }
    ]
  },
  song_bianjing: {
    id: "song_bianjing",
    label: "宋·汴京市井",
    lexicon: [
      "汴京",
      "瓦子",
      "勾栏",
      "夜市",
      "州桥",
      "汴河",
      "漕运",
      "交子",
      "钱庄",
      "乐籍",
      "青楼",
      "太学",
      "书院",
      "案酒"
    ],
    antiLexicon: [
      "跳蛋",
      "酒店",
      "义体",
      "脑机",
      "霓虹",
      "外卖"
    ],
    signals: [
      "瓦子",
      "勾栏",
      "夜市",
      "汴河",
      "漕运",
      "交子",
      "乐籍",
      "书院"
    ],
    vesselSeeds: [
      { "kind": "artifact", "nameHint": "交子券/乐籍簿/勾栏排单/汴河船契" },
      { "kind": "place", "nameHint": "瓦子勾栏/州桥夜市/汴河码头/钱庄/书院" },
      { "kind": "rule", "nameHint": "乐籍身契/漕运皇粮/交子定额/勾栏赏钱" },
      { "kind": "org", "nameHint": "教坊/钱庄/漕运司/瓦子行会/太学" },
      { "kind": "substance", "nameHint": "醒酒汤/蜜饯/案酒/灯油" },
      { "kind": "ritual", "nameHint": "点曲侍宴/兑券/汴河起航/放榜" }
    ]
  },
  ming_jiangnan: {
    id: "ming_jiangnan",
    label: "明·江南市镇",
    lexicon: [
      "江南",
      "市镇",
      "机户",
      "丝织",
      "布商",
      "河埠",
      "水巷",
      "账房",
      "盐引",
      "会馆",
      "秦淮",
      "乐籍",
      "贡院",
      "八股"
    ],
    antiLexicon: [
      "跳蛋",
      "酒店",
      "义体",
      "脑机",
      "霓虹",
      "银行"
    ],
    signals: [
      "机户",
      "丝织",
      "盐引",
      "会馆",
      "秦淮",
      "贡院",
      "水巷",
      "账房"
    ],
    vesselSeeds: [
      { "kind": "artifact", "nameHint": "盐引/织机梭/乐籍簿/八股考篮" },
      { "kind": "place", "nameHint": "机户作坊/河埠码头/会馆/秦淮河房/贡院号舍" },
      { "kind": "rule", "nameHint": "乐籍身契/盐引配额/八股科规/行会行规" },
      { "kind": "org", "nameHint": "机户行会/商帮会馆/曲社/贡院" },
      { "kind": "substance", "nameHint": "丝钱账/赎身钱/考篮灯油/画舫酒" },
      { "kind": "ritual", "nameHint": "兑盐引/放榜/赎身/议婚过聘" }
    ]
  },
  qing_capital: {
    id: "qing_capital",
    label: "清·京都八旗",
    lexicon: [
      "八旗",
      "旗籍",
      "内城",
      "营房",
      "包衣",
      "四合院",
      "敬事房",
      "内务府",
      "会馆",
      "公所",
      "香堂",
      "帮会",
      "祠堂",
      "漕运"
    ],
    antiLexicon: [
      "跳蛋",
      "酒店",
      "义体",
      "脑机",
      "霓虹",
      "地铁"
    ],
    signals: [
      "八旗",
      "旗籍",
      "内务府",
      "四合院",
      "会馆",
      "香堂",
      "祠堂",
      "漕运"
    ],
    vesselSeeds: [
      { "kind": "artifact", "nameHint": "旗籍册/敬事房档/身契/香堂信物" },
      { "kind": "place", "nameHint": "营房内城/四合院/会馆/香堂/漕运码头" },
      { "kind": "rule", "nameHint": "旗籍分治/敬事房档/帮规/族规/行规" },
      { "kind": "org", "nameHint": "内务府/八旗佐领/会馆公所/帮会香堂/祠堂" },
      { "kind": "substance", "nameHint": "铁杆庄稼俸粮/胭脂水粉/漕粮/香火" },
      { "kind": "ritual", "nameHint": "拜香入帮/敬事记档/祠堂议婚/出旗分产" }
    ]
  }
};

export var ENRICHMENT = {};
