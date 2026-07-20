/**
 * NTL 禁忌类型目录（可扩展：在此文件追加 id 条目即可）
 * enrichment 见同目录 enrichment.mjs
 */
export var NTL_TABOO_TYPES = {
  age_gap: { label: '年龄差', description: '成熟度不对等带来的自然张力' },
  status_gap: { label: '身份差', description: '师生/医患/僧俗/上下级等身份边界' },
  emotional_forbidden: { label: '情感禁忌', description: '爱上不该爱的人：朋友伴侣/仇人之子/已故之人的影子' },
  moral_conflict: { label: '道德冲突', description: '明知被利用但无法自拔/明知是错但停不下来' },
  situational: { label: '情境禁忌', description: '公共场所/危险环境下的亲密，刺激来自场景而非关系' },
  power_coercion: { label: '权力胁迫', description: '直接的权力压迫与服从（原 NTL 核心）' },
  secret_affair: { label: '隐秘关系', description: '不能公开的地下关系，偷情/瞒着所有人' },
  redemption_captor: { label: '俘获/救赎', description: '敌对关系中被对方吸引（斯德哥尔摩/反向救赎）' },
  yuri_destruction: {
    label: '百破',
    description: '百合破坏：原有或潜在的女女亲密/爱恋被介入、瓦解、侵占或自我崩解；张力来自「本可完整的百合被撕开」',
  },
};


