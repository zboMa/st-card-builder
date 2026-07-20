/**
 * NTL 禁忌层分组（纽带 / 胁迫 / 破裂）
 */
export var NTL_GROUP_IDS = ['bond', 'coercion', 'rupture'];

export var NTL_GROUPS = {
  bond: {
    id: 'bond',
    label: '纽带禁忌',
    description: '血缘、婚约、债务、信仰、阶级等关系纽带带来的越界张力',
  },
  coercion: {
    id: 'coercion',
    label: '胁迫禁忌',
    description: '权力、把柄、心智、身体债务与人质杠杆等强制结构',
  },
  rupture: {
    id: 'rupture',
    label: '破裂禁忌',
    description: '既有亲密/身份/公开形象被撕开、侵占或替换',
  },
};
