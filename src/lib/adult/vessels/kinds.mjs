/**
 * 成人世界观载体 · 种类与共用维度
 */

export var VESSEL_DEFAULT_MIN_CHARS = 320;

export var VESSEL_KINDS = [
  'artifact',   // 法器/道具/义体
  'ability',    // 功法/异能/咒术
  'place',      // 场所/秘境/实验室
  'rule',       // 戒律/条例/潜规则
  'org',        // 宗门/协会/社团
  'substance',  // 丹药/药剂/香氛
  'ritual',     // 仪式/双修阵/契约
];

export var VESSEL_KIND_LABELS = {
  artifact: '器物',
  ability: '能力/功法',
  place: '场所',
  rule: '规则/戒律',
  org: '组织',
  substance: '丹药/药剂',
  ritual: '仪式/阵法',
};

/** 载体共用必写维度（门禁硬门槛） */
export var VESSEL_SHARED_DIMENSIONS = [
  {
    id: 'power_logic',
    label: '生效机制（贴合世界观语汇）',
    signals: ['机制', '生效', '灵力', '法力', '异能', '咒', '阵', '义体', '神经', '契约', 'powerLogic', '运转', '触发'],
  },
  {
    id: 'cost_risk',
    label: '代价 / 反噬 / 暴露风险',
    signals: ['代价', '反噬', '风险', '暴露', '后遗', '反噬', 'costOrRisk', '反噬', '代价', '副作用', '反噬'],
  },
  {
    id: 'social_cover',
    label: '公开伪装 / 社会面说法',
    signals: ['伪装', '公开', '名义', 'socialCover', '借口', '正当', '掩护', '身份'],
  },
  {
    id: 'who_limits',
    label: '谁能用 / Limits / 禁区',
    signals: ['Limits', '界限', '禁', '谁能', '资格', '禁忌', '不可', '禁止'],
  },
  {
    id: 'person_hook',
    label: '与具体人物的互动关系',
    signals: ['相关', 'relatedPersons', '持有', '使用', '针对', '驯服', '绑定', '属于', '人物'],
  },
];
