/**
 * 提示词默认值与 localStorage 读写（Node / 浏览器共用）
 * 占位符 {{name}} 由调用方在组装时替换，不改变原有拼接语义。
 * 描述体系公共块与 DEFAULT_PROMPTS 见 promptCanon.mjs
 */
import { DEFAULT_PROMPTS, PROMPT_BLOCKS } from './promptCanon.mjs';

export { DEFAULT_PROMPTS, PROMPT_BLOCKS };
export const PROMPT_STORAGE_KEY = 'st_v3_builder_prompts';

/** 提示词配置 Tab 顺序（与 PROMPT_META.group 对应） */
export const PROMPT_TAB_ORDER = [
  '角色卡制作',
  '世界书',
  '恶堕',
  '状态栏·MVU',
  '小说',
  '小说创作',
  'AI 助手',
];

/** UI 元数据：侧栏「提示词配置」按 group 分 Tab */
export const PROMPT_META = [
  { id: 'charGen', label: '角色生成（阶段1）', group: '角色卡制作' },
  { id: 'greetingGen', label: '开场白生成（阶段3）', group: '角色卡制作' },
  { id: 'charTagsGen', label: '角色标签 AI 生成', group: '角色卡制作' },
  { id: 'aiNativeSearch', label: '联网搜索指令', group: '角色卡制作' },
  { id: 'chatRpCore', label: '试聊 RP 核心指令', group: '角色卡制作' },
  { id: 'wbSkeleton', label: '世界书骨架（仅骨架模式）', group: '世界书' },
  { id: 'wbOutline', label: '世界书大纲（完整生成）', group: '世界书' },
  { id: 'wbEnrichFromOutline', label: '世界书按大纲丰满', group: '世界书' },
  { id: 'wbCrossLink', label: '世界书交叉补边', group: '世界书' },
  { id: 'wbSingle', label: '世界书单条生成', group: '世界书' },
  { id: 'wbRewrite', label: '世界书 AI 重写', group: '世界书' },
  { id: 'wbTriggerKeys', label: '批量触发词', group: '世界书' },
  { id: 'wbOrganize', label: '世界书参数整理', group: '世界书' },
  { id: 'wbAudit', label: '世界书 AI 审计', group: '世界书' },
  { id: 'corruptionStages', label: '恶堕阶段表生成', group: '恶堕' },
  { id: 'corruptionArchive', label: '恶堕档案生成', group: '恶堕' },
  { id: 'corruptionArchiveExpand', label: '恶堕档案扩写', group: '恶堕' },
  { id: 'mvuDesign', label: 'MVU 变量设计（单条等）', group: '状态栏·MVU' },
  { id: 'statusBarPaths', label: '状态栏路径规划（兼容）', group: '状态栏·MVU' },
  { id: 'statusBarCharScan', label: '状态栏人物识别', group: '状态栏·MVU' },
  { id: 'statusBarMvuDesign', label: '状态栏变量设计', group: '状态栏·MVU' },
  { id: 'statusBarCustomLayout', label: '状态栏自定义排版', group: '状态栏·MVU' },
  { id: 'novelExtract', label: '小说事实抽取（兼容）', group: '小说' },
  { id: 'novelMerge', label: '小说事实合并（兼容）', group: '小说' },
  { id: 'novelCharScan', label: '小说人物扫描', group: '小说' },
  { id: 'novelCharExpand', label: '小说人物 AI 扩展', group: '小说' },
  { id: 'novelWbExtract', label: '小说世界书分片抽取', group: '小说' },
  { id: 'novelWbExpand', label: '小说世界书条目 AI 扩展', group: '小说' },
  { id: 'novelAnalyzeSkeleton', label: '小说分析·骨架扫描', group: '小说' },
  { id: 'novelEnrichEntity', label: '小说分析·实体丰满', group: '小说' },
  { id: 'novelAnalyzeRelations', label: '小说分析·关系补全', group: '小说' },
  { id: 'novelStyleDistill', label: '小说文风蒸馏', group: '小说' },
  { id: 'novelCharSetup', label: '小说角色设定生成', group: '小说' },
  { id: 'novelGreetingsGen', label: '小说开场白生成', group: '小说' },
  { id: 'styleGuide', label: '文风指南（手动）', group: '小说' },
  { id: 'storyOutlineGen', label: '创作·大纲生成', group: '小说创作' },
  { id: 'storyChapterWrite', label: '创作·章节正文', group: '小说创作' },
  { id: 'assistantSystem', label: 'AI 助手系统提示', group: 'AI 助手' },
  { id: 'assistantReactHint', label: 'AI 助手续步提示', group: 'AI 助手' },
  { id: 'assistantChatFeedback', label: '试聊回流分析提示', group: 'AI 助手' },
  { id: 'assistantNovelRagHint', label: '小说 RAG 使用提示', group: 'AI 助手' },
];

/** 按 PROMPT_TAB_ORDER 列出实际出现的分组 */
export function listPromptGroups(meta) {
  var list = meta || PROMPT_META;
  var seen = {};
  list.forEach(function(m) {
    if (m && m.group) seen[m.group] = true;
  });
  var ordered = PROMPT_TAB_ORDER.filter(function(g) { return seen[g]; });
  // 未列入 ORDER 的 group 追加在末尾
  Object.keys(seen).forEach(function(g) {
    if (ordered.indexOf(g) < 0) ordered.push(g);
  });
  return ordered;
}

/** 替换 {{key}} 占位符 */
export function applyTemplate(template, vars) {
  var text = String(template == null ? '' : template);
  var map = vars || {};
  return text.replace(/\{\{(\w+)\}\}/g, function(_, key) {
    return map[key] != null ? String(map[key]) : '';
  });
}

/**
 * @param {Storage|null|undefined} storage
 * @param {Record<string, string>} [defaults]
 */
export function createPromptStore(storage, defaults) {
  var base = defaults || DEFAULT_PROMPTS;

  function readOverrides() {
    if (!storage) return {};
    try {
      var raw = storage.getItem(PROMPT_STORAGE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function writeOverrides(overrides) {
    if (!storage) return;
    try {
      storage.setItem(PROMPT_STORAGE_KEY, JSON.stringify(overrides || {}));
    } catch (e) { /* quota / private mode */ }
    try {
      if (typeof window !== 'undefined' && window.__scheduleUserPrefsCloudPush__) {
        window.__scheduleUserPrefsCloudPush__();
      }
    } catch (e2) { /* ignore */ }
  }

  function get(id) {
    var overrides = readOverrides();
    if (overrides[id] != null && String(overrides[id]).trim() !== '') {
      return String(overrides[id]);
    }
    return base[id] != null ? String(base[id]) : '';
  }

  function getAll() {
    var out = {};
    Object.keys(base).forEach(function(id) {
      out[id] = get(id);
    });
    return out;
  }

  function set(id, value) {
    if (!base.hasOwnProperty(id)) return false;
    var overrides = readOverrides();
    var next = String(value == null ? '' : value);
    if (next === String(base[id])) {
      delete overrides[id];
    } else {
      overrides[id] = next;
    }
    writeOverrides(overrides);
    return true;
  }

  function setAll(values) {
    var overrides = {};
    Object.keys(base).forEach(function(id) {
      if (values && values[id] != null && String(values[id]) !== String(base[id])) {
        overrides[id] = String(values[id]);
      }
    });
    writeOverrides(overrides);
  }

  function reset(id) {
    if (id) {
      var overrides = readOverrides();
      delete overrides[id];
      writeOverrides(overrides);
      return;
    }
    writeOverrides({});
  }

  function getDefault(id) {
    return base[id] != null ? String(base[id]) : '';
  }

  function listIds() {
    return Object.keys(base);
  }

  return {
    STORAGE_KEY: PROMPT_STORAGE_KEY,
    DEFAULTS: base,
    META: PROMPT_META,
    BLOCKS: PROMPT_BLOCKS,
    TAB_ORDER: PROMPT_TAB_ORDER,
    listGroups: function() { return listPromptGroups(PROMPT_META); },
    get: get,
    getAll: getAll,
    getDefault: getDefault,
    set: set,
    setAll: setAll,
    reset: reset,
    listIds: listIds,
    applyTemplate: applyTemplate,
  };
}
