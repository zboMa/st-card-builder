/**
 * 提示词配置 · 目录只读浏览数据
 * Tab 一级分类 + 下拉选具体条目；与 src/lib 目录同源，不可在 UI 编辑。
 */
import { NSFW_FLAVOR_PRESETS, FLAVOR_GROUPS } from './adult/flavors/index.mjs';
import { NTL_TABOO_TYPES, NTL_GROUPS } from './adult/ntl/index.mjs';
import {
  EROTIC_POSTURE_PRESETS,
  POSTURE_GROUPS,
  EROTIC_SPEECH_PRESETS,
  SPEECH_GROUPS,
} from './adult/expression/index.mjs';
import { WORLDVIEW_PRESETS, WORLDVIEW_GROUPS, WORLDVIEW_QUALITY_FLOOR } from './presets/worldviews/index.mjs';
import { FLAVOR_VESSEL_OVERLAYS, NTL_VESSEL_OVERLAYS } from './adult/vessels/index.mjs';
import {
  CORRUPTION_PRESETS,
  STAGE_SECTION_HINTS,
  CORRUPTION_MIN_CHARS_PER_STAGE,
  CORRUPTION_TARGET_CHARS_PER_STAGE,
} from './corruptionProgress.mjs';

/** 扩展规范：下拉分段（与 docs/catalog-quality-standards.md 对齐） */
export var CATALOG_STANDARD_SECTIONS = [
  {
    id: 'overview',
    label: '总览与字数硬线',
    body:
      '扩展 / 增补口味 · 表达层 · NTL · 世界观 · 载体时遵守本规范。完整文档见 docs/catalog-quality-standards.md。\n\n'
      + '字数硬线（JS .length）：\n'
      + '· 口味 / NTL / 世界观：description 300–450，writingGuide 350–500\n'
      + '· 表达层（姿势 / 话风）：description 150–225，writingGuide 175–250，summary 12–28\n'
      + '· antiPatterns：4–6 条且独有\n\n'
      + '世界观质量底线常量 WORLDVIEW_QUALITY_FLOOR：description≥'
      + WORLDVIEW_QUALITY_FLOOR.description
      + '，writingGuide≥'
      + WORLDVIEW_QUALITY_FLOOR.writingGuide
      + '，antiPatterns≥'
      + WORLDVIEW_QUALITY_FLOOR.antiPatterns
      + '。',
  },
  {
    id: 'writing',
    label: '写法原则与禁套话',
    body:
      '1. 逐条手写，主题独有落点；禁止脚本批量灌同构句。\n'
      + '2. 禁止净删降级：去公式后必须用更长独有正文填回。\n'
      + '3. 拉开句法，尤其收尾不要同构。\n'
      + '4. 可扩写、勿删薄。\n\n'
      + '禁止套话示例：「三拍」「改变关系秩序」「都提到了却都没咬住」；'
      + '「制度钩子可以是…」同构尾句；「要让世界自己参与逼人」等载体旧模板腔；'
      + '机械「开场—中段—收束」换词复读。',
  },
  {
    id: 'layers',
    label: '五层职责',
    body:
      '世界观 = 制度 / 生存 / 权力结构（不要写成情欲教程或禁忌清单）。\n'
      + '口味 = 情欲质地 / 节奏 / 安全余波（不要抢制度全文或 NTL 证据链）。\n'
      + '表达层 = 姿势语言 / 情趣话风（只改怎么做、怎么说；不占口味槽，不替代 Limits）。\n'
      + 'NTL = 禁忌结构 / 证据链 / 代价（不要写成感官教程）。\n'
      + '载体 overlays = 世界如何物化该口味或禁忌：设施、规章、礼法、器物维保'
      + '（不要写成人物层床戏教程）。',
  },
  {
    id: 'paths',
    label: '源文件地图',
    body:
      '口味 presets：src/lib/adult/flavors/presets/\n'
      + '口味 enrichment：src/lib/adult/flavors/enrichment/\n'
      + '表达层：src/lib/adult/expression/\n'
      + 'NTL types：src/lib/adult/ntl/types/\n'
      + 'NTL enrichment：src/lib/adult/ntl/enrichment/\n'
      + '世界观：src/lib/presets/worldviews/data/\n'
      + '载体 overlays：src/lib/adult/vessels/overlays/\n\n'
      + 'presets/types 源文件不要误写入 enrichment 字段；'
      + 'mustCover / writingGuide / antiPatterns / signals 放 enrichment，由 apply 合并。',
  },
  {
    id: 'adult_boundary',
    label: '成年边界',
    body:
      '禁止儿童性化；校园等题材按成年设定。\n'
      + 'age_gap：description 须含「成年礼」「禁止儿童性化」；writingGuide 须含「不得以历史早婚」。\n'
      + 'yuri_destruction：须显式含「百合破坏」。\n'
      + 'uniform_ritual：禁止校服未成年性化。\n'
      + 'sacrilege：禁止针对真实宗教群体的仇恨色情。',
  },
  {
    id: 'workflow',
    label: '工作流程与 UI',
    body:
      '改前先出完整方案；用户明确确认后再改代码。\n'
      + '提交前：npm test → npm run build；大改附字数对比报表。\n\n'
      + '本面板目录类 Tab 为只读展示（与源码同源）。'
      + '改目录请改 src/lib/**，不要指望在此编辑持久化。',
  },
];

/** 目录类 Tab（接在可编辑提示词分组之后） */
export var PROMPT_CATALOG_TAB_META = [
  { id: '__catalog_standards__', label: '扩展规范', section: 'standards' },
  { id: '__catalog_flavor__', label: '口味目录', section: 'flavor' },
  { id: '__catalog_posture__', label: '姿势语言', section: 'posture' },
  { id: '__catalog_speech__', label: '情趣话风', section: 'speech' },
  { id: '__catalog_ntl__', label: 'NTL目录', section: 'ntl' },
  { id: '__catalog_corruption__', label: '恶堕', section: 'corruption' },
  { id: '__catalog_worldview__', label: '世界观', section: 'worldview' },
  { id: '__catalog_vessel_flavor__', label: '载体·口味', section: 'vesselFlavor' },
  { id: '__catalog_vessel_ntl__', label: '载体·NTL', section: 'vesselNtl' },
];

function listFromMap(map, pick) {
  return Object.keys(map || {}).map(function(id) {
    return pick(id, map[id]);
  });
}

function flavorItems() {
  return listFromMap(NSFW_FLAVOR_PRESETS, function(id, p) {
    return {
      id: id,
      label: p.label || id,
      group: p.group || '',
      description: String(p.description || ''),
      writingGuide: String(p.writingGuide || ''),
      summary: String(p.summary || ''),
      mustCover: Array.isArray(p.mustCover) ? p.mustCover.slice() : [],
      antiPatterns: Array.isArray(p.antiPatterns) ? p.antiPatterns.slice() : [],
      focus: Array.isArray(p.focus) ? p.focus.slice() : [],
      avoid: Array.isArray(p.avoid) ? p.avoid.slice() : [],
    };
  });
}

function ntlItems() {
  return listFromMap(NTL_TABOO_TYPES, function(id, t) {
    var g = t.group || '';
    var gMeta = NTL_GROUPS[g];
    return {
      id: id,
      label: t.label || id,
      group: g,
      groupLabel: (gMeta && gMeta.label) || g,
      description: String(t.description || ''),
      writingGuide: String(t.writingGuide || ''),
      summary: String(t.summary || ''),
      mustCover: Array.isArray(t.mustCover) ? t.mustCover.slice() : [],
      antiPatterns: Array.isArray(t.antiPatterns) ? t.antiPatterns.slice() : [],
    };
  });
}

function postureItems() {
  return listFromMap(EROTIC_POSTURE_PRESETS, function(id, p) {
    return {
      id: id,
      label: p.label || id,
      group: p.group || '',
      description: String(p.description || ''),
      writingGuide: String(p.writingGuide || ''),
      summary: String(p.summary || ''),
      mustCover: Array.isArray(p.mustCover) ? p.mustCover.slice() : [],
      antiPatterns: Array.isArray(p.antiPatterns) ? p.antiPatterns.slice() : [],
    };
  });
}

function speechItems() {
  return listFromMap(EROTIC_SPEECH_PRESETS, function(id, p) {
    return {
      id: id,
      label: p.label || id,
      group: p.group || '',
      description: String(p.description || ''),
      writingGuide: String(p.writingGuide || ''),
      summary: String(p.summary || ''),
      mustCover: Array.isArray(p.mustCover) ? p.mustCover.slice() : [],
      antiPatterns: Array.isArray(p.antiPatterns) ? p.antiPatterns.slice() : [],
    };
  });
}

function corruptionItems() {
  return ['3', '5', '7'].map(function(id) {
    var preset = CORRUPTION_PRESETS[id];
    return {
      id: id,
      label: '恶堕阶段 · ' + (preset.label || id) + ' ' + id + ' 阶',
      group: '恶堕阶段预设',
      description:
        '阶段表：' + (preset.stages || []).join(' / ')
        + '\n\n每阶段正文目标 ' + CORRUPTION_TARGET_CHARS_PER_STAGE.min
        + '-' + CORRUPTION_TARGET_CHARS_PER_STAGE.max
        + ' 字；最低门禁 ' + CORRUPTION_MIN_CHARS_PER_STAGE
        + ' 字。仅适用于成人角色，禁止儿童性化。',
      writingGuide:
        '档案正文需按 Markdown ## 标题完整写出全部阶段，且标题必须与阶段表完全一致。'
        + '\n开头须声明读取状态栏/MVU 当前值；相邻阶段要能感知递进，禁止跳阶、模板段、待填充。'
        + '\n总则/档案应与人物世界书、已有成人层、其他恶堕档案互相可对读，不可孤立打架。',
      summary: (preset.stages || []).join(' / '),
      mustCover: STAGE_SECTION_HINTS.slice(),
      antiPatterns: [
        '禁止儿童性化',
        '禁止输出（待填充）',
        '禁止阶段之间复制粘贴',
        '禁止跳阶或跳过阶段标题',
      ],
    };
  });
}

function worldviewItems() {
  var groupLabel = Object.create(null);
  (WORLDVIEW_GROUPS || []).forEach(function(g) {
    if (g && g.id) groupLabel[g.id] = g.label || g.id;
  });
  return (WORLDVIEW_PRESETS || []).map(function(p) {
    return {
      id: p.id,
      label: p.label || p.id,
      group: p.group || '',
      groupLabel: groupLabel[p.group] || p.group || '',
      description: String(p.description || ''),
      writingGuide: String(p.writingGuide || ''),
      summary: String(p.summary || ''),
      mustCover: Array.isArray(p.mustCover) ? p.mustCover.slice() : [],
      antiPatterns: Array.isArray(p.antiPatterns) ? p.antiPatterns.slice() : [],
      lexicon: Array.isArray(p.lexicon) ? p.lexicon.slice() : [],
    };
  });
}

function vesselItems(overlays, labelOf) {
  return listFromMap(overlays, function(id, o) {
    return {
      id: id,
      label: labelOf ? labelOf(id) : id,
      group: '',
      description: '',
      writingGuide: String(o.writingGuide || ''),
      mustCover: Array.isArray(o.mustCover) ? o.mustCover.slice() : [],
      antiPatterns: Array.isArray(o.antiPatterns) ? o.antiPatterns.slice() : [],
      signals: Array.isArray(o.signals) ? o.signals.slice() : [],
    };
  });
}

/**
 * @returns {{
 *   tabMeta: Array<{id:string,label:string,section:string}>,
 *   sections: Record<string, {
 *     hint: string,
 *     items: Array<object>,
 *     optgroups?: Array<{id:string,label:string}>
 *   }>
 * }}
 */
export function buildPromptCatalogBrowser() {
  var flavors = flavorItems();
  var postures = postureItems();
  var speeches = speechItems();
  var ntl = ntlItems();
  var corruption = corruptionItems();
  var wv = worldviewItems();
  var flavorLabel = Object.create(null);
  flavors.forEach(function(f) { flavorLabel[f.id] = f.label; });
  var ntlLabel = Object.create(null);
  ntl.forEach(function(t) { ntlLabel[t.id] = t.label; });

  return {
    tabMeta: PROMPT_CATALOG_TAB_META.slice(),
    sections: {
      standards: {
        hint: '扩展增项时遵守的硬标准（只读）。完整 Markdown 见仓库 docs/catalog-quality-standards.md。',
        items: CATALOG_STANDARD_SECTIONS.map(function(s) {
          return {
            id: s.id,
            label: s.label,
            group: '',
            description: s.body,
            writingGuide: '',
            mustCover: [],
            antiPatterns: [],
          };
        }),
      },
      flavor: {
        hint: '口味目录（presets + enrichment 合并后）。只读；改源文件后重新构建生效。',
        optgroups: (FLAVOR_GROUPS || []).map(function(g) {
          return { id: g.id, label: g.label || g.id };
        }),
        items: flavors,
      },
      posture: {
        hint: '姿势语言目录（表达层）。只读；不占口味槽，可多选叠加；禁止儿童性化。',
        optgroups: (POSTURE_GROUPS || []).map(function(g) {
          return { id: g.id, label: g.label || g.id };
        }),
        items: postures,
      },
      speech: {
        hint: '情趣话风目录（表达层）。只读；不占口味槽，可多选叠加；禁止儿童性化。',
        optgroups: (SPEECH_GROUPS || []).map(function(g) {
          return { id: g.id, label: g.label || g.id };
        }),
        items: speeches,
      },
      ntl: {
        hint: 'NTL 禁忌目录（types + enrichment 合并后）。只读。',
        optgroups: Object.keys(NTL_GROUPS || {}).map(function(id) {
          var g = NTL_GROUPS[id];
          return { id: id, label: (g && g.label) || id };
        }),
        items: ntl,
      },
      corruption: {
        hint: '恶堕阶段预设与档案写法门禁。只读；展示 3/5/7 阶、必写维度与字数预算。禁止儿童性化。',
        items: corruption,
      },
      worldview: {
        hint: '世界观预设目录。只读。',
        optgroups: (WORLDVIEW_GROUPS || []).map(function(g) {
          return { id: g.id, label: g.label || g.id };
        }),
        items: wv,
      },
      vesselFlavor: {
        hint: '载体 · 口味物化 overlays（世界如何托住该口味）。只读。',
        items: vesselItems(FLAVOR_VESSEL_OVERLAYS, function(id) {
          return (flavorLabel[id] || id) + ' · 载体';
        }),
      },
      vesselNtl: {
        hint: '载体 · NTL 物化 overlays（世界如何托住该禁忌结构）。只读。',
        items: vesselItems(NTL_VESSEL_OVERLAYS, function(id) {
          return (ntlLabel[id] || id) + ' · 载体';
        }),
      },
    },
  };
}
