/**
 * AI 助手工具目录：名称、说明、风险默认级、参数摘要（供系统提示与测试）
 */

/** @typedef {'read'|'write'|'generate'|'nav'|'meta'} ToolKind */
/** @typedef {'none'|'auto'|'confirm'} RiskLevel */

/**
 * 定向修改约定（写入类工具通用）：
 * - target: { id?, titleMatch?, index?, comment? } 或简写 index/comment/id
 * - mode: rewrite | expand | patch
 * - instruction: 用户自然语言要求
 */

/**
 * @type {Array<{
 *   name: string,
 *   kind: ToolKind,
 *   risk: RiskLevel,
 *   summary: string,
 *   argsHint: string
 * }>}
 */
export const ASSISTANT_TOOLS = [
  // —— 只读 ——
  { name: 'get_character_fields', kind: 'read', risk: 'none', summary: '读取角色设定字段', argsHint: '{}' },
  { name: 'get_character_summary', kind: 'read', risk: 'none', summary: '角色摘要（截断长文本）', argsHint: '{ maxLen? }' },
  { name: 'get_worldbook_list', kind: 'read', risk: 'none', summary: '世界书条目列表', argsHint: '{ query? }' },
  { name: 'get_worldbook_entry', kind: 'read', risk: 'none', summary: '单条世界书详情', argsHint: '{ target|{index|id|titleMatch|comment} }' },
  { name: 'get_mvu_state', kind: 'read', risk: 'none', summary: '读取 MVU 设计/扩展状态', argsHint: '{}' },
  { name: 'infer_mvu_variables', kind: 'read', risk: 'none', summary: '从卡规则推定 MVU 候选变量（只读预览，不写入）', argsHint: '{}' },
  { name: 'get_novel_workspace', kind: 'read', risk: 'none', summary: '小说工坊状态摘要（含实体/RAG）', argsHint: '{}' },
  { name: 'get_export_preview', kind: 'read', risk: 'none', summary: '导出 JSON 结构预览（不下载）', argsHint: '{ maxChars? }' },
  { name: 'export_card_check', kind: 'read', risk: 'none', summary: '校验当前卡可导出结构（不触发下载）', argsHint: '{}' },
  { name: 'search_card_content', kind: 'read', risk: 'none', summary: '在角色/世界书中搜索', argsHint: '{ query, limit? }' },
  { name: 'search_novel_passages', kind: 'read', risk: 'none', summary: '混合检索小说原文片段', argsHint: '{ query, limit?, budget? }' },
  { name: 'list_novel_entities', kind: 'read', risk: 'none', summary: '知识库实体列表', argsHint: '{ type?, query? }' },
  { name: 'get_novel_entity', kind: 'read', risk: 'none', summary: '单条知识库实体', argsHint: '{ target|{id|name|titleMatch} }' },
  { name: 'audit_worldbook', kind: 'read', risk: 'none', summary: '世界书快速监测（本地规则）', argsHint: '{}' },
  { name: 'lint_for_sillytavern', kind: 'read', risk: 'none', summary: 'SillyTavern 常见问题检查', argsHint: '{}' },
  { name: 'get_chat_feedback', kind: 'read', risk: 'none', summary: '读取试聊历史与暴露问题', argsHint: '{ maxMessages? }' },
  { name: 'list_cards', kind: 'read', risk: 'none', summary: '多卡草稿列表（id/名/当前）', argsHint: '{}' },
  { name: 'get_engine_options', kind: 'read', risk: 'none', summary: '读取 AI 引擎非密钥选项', argsHint: '{}' },
  { name: 'get_prompt_ids', kind: 'read', risk: 'none', summary: '提示词配置 id 列表（只读）', argsHint: '{}' },
  { name: 'get_adult_config', kind: 'read', risk: 'none', summary: '读取卡级「世界与限定」（世界观预设/框架/口味/表达层/NTL/恶堕）', argsHint: '{}' },
  { name: 'novel_list_outputs', kind: 'read', risk: 'none', summary: '小说各模块产出摘要（人物/世界书/文风/实体）', argsHint: '{}' },

  // —— 写入（小改 auto / 大改 confirm）——
  { name: 'update_character_fields', kind: 'write', risk: 'auto', summary: '更新部分角色字段', argsHint: '{ fields:{charName?,wbName?,charDesc?,firstMes?,creatorNotes?,tags?,altGreetings?} }' },
  { name: 'replace_character_section', kind: 'write', risk: 'confirm', summary: '整段覆盖角色字段', argsHint: '{ field: charDesc|firstMes|creatorNotes|..., content }' },
  { name: 'expand_character_field', kind: 'generate', risk: 'confirm', summary: '按字段名重写/扩写角色字段', argsHint: '{ field: charDesc|creatorNotes|..., mode?, instruction? }' },
  { name: 'set_adult_config', kind: 'write', risk: 'auto', summary: '更新卡级「世界与限定」（worldviewPresetItems/框架/口味/表达层/NTL/恶堕等）', argsHint: '{ worldviewPresetItems?, enabled?, flavorItems?, postureItems?, speechItems?, ntlEnabled?, ntlTabooTypes?, adultWorldframeForced?, corruptionEnabled?, ... }' },
  { name: 'create_worldbook_entry', kind: 'write', risk: 'auto', summary: '新建一条世界书', argsHint: '{ entry }' },
  { name: 'update_worldbook_entry', kind: 'write', risk: 'auto', summary: '更新一条世界书', argsHint: '{ target|{index|comment}, patch }' },
  { name: 'delete_worldbook_entry', kind: 'write', risk: 'confirm', summary: '删除世界书条目（含清空全部）', argsHint: '{ index|indices|target|{all:true} }' },

  // —— 开场白定向 ——
  { name: 'rewrite_greeting', kind: 'generate', risk: 'confirm', summary: '定向重写主/备选开场白', argsHint: '{ target: main|{alternate:n}|index, mode?, instruction? }' },
  { name: 'expand_greeting', kind: 'generate', risk: 'confirm', summary: '定向扩写主/备选开场白', argsHint: '{ target: main|{alternate:n}|index, instruction? }' },
  { name: 'update_alternate_greeting', kind: 'write', risk: 'auto', summary: '更新备选开场白第 N 条', argsHint: '{ index, content }' },

  // —— 生成（对接现有引擎/面板）——
  { name: 'generate_character_draft', kind: 'generate', risk: 'confirm', summary: '按 AI 引擎生成角色草稿', argsHint: '{ prompt? }' },
  { name: 'generate_worldbook_skeleton', kind: 'generate', risk: 'confirm', summary: '生成世界书骨架并写入', argsHint: '{ count?, direction? }' },
  { name: 'generate_worldbook_entry', kind: 'generate', risk: 'confirm', summary: '单条世界书生成并写入', argsHint: '{ direction?, instruction? }' },
  { name: 'organize_worldbook', kind: 'generate', risk: 'confirm', summary: '智能整理世界书参数（可预览后应用）', argsHint: '{ apply?: boolean }' },
  { name: 'batch_fill_worldbook_keys', kind: 'generate', risk: 'confirm', summary: '批量补全世界书触发词', argsHint: '{ onlyMissing?: boolean }' },
  { name: 'rewrite_worldbook_entry', kind: 'generate', risk: 'confirm', summary: '按 id/标题/序号定向重写世界书', argsHint: '{ target, mode?, instruction? }' },
  { name: 'expand_worldbook_entry', kind: 'generate', risk: 'auto', summary: '按 id/标题/序号定向扩写世界书', argsHint: '{ target, instruction?/direction? }' },
  { name: 'fix_from_lint', kind: 'write', risk: 'confirm', summary: '根据 lint/审计生成并应用修复补丁包', argsHint: '{ apply?: boolean, maxOps? }' },

  // —— 导航 / 补丁 ——
  { name: 'open_module', kind: 'nav', risk: 'none', summary: '跳转侧栏模块', argsHint: '{ view }' },
  { name: 'apply_patch_bundle', kind: 'write', risk: 'confirm', summary: '批量应用补丁包', argsHint: '{ ops, summary? }' },
  { name: 'undo_last_bundle', kind: 'write', risk: 'auto', summary: '撤销上一补丁包（含小说桶）', argsHint: '{}' },
  { name: 'suggest_fixes', kind: 'meta', risk: 'none', summary: '基于 lint/审计给出修复建议', argsHint: '{}' },

  // —— 多卡管理（无代导出）——
  { name: 'switch_card', kind: 'write', risk: 'confirm', summary: '切换当前角色卡（含小说桶）', argsHint: '{ id|name }' },
  { name: 'create_card', kind: 'write', risk: 'confirm', summary: '新建空白角色卡', argsHint: '{ name? }' },
  { name: 'duplicate_card', kind: 'write', risk: 'confirm', summary: '复制角色卡', argsHint: '{ id? }' },
  { name: 'rename_card', kind: 'write', risk: 'auto', summary: '重命名角色卡', argsHint: '{ id?, name }' },
  { name: 'delete_card', kind: 'write', risk: 'confirm', summary: '删除角色卡', argsHint: '{ id }' },
  { name: 'import_card', kind: 'write', risk: 'confirm', summary: '导入已解析角色卡 JSON（不代下载）', argsHint: '{ cardJson }' },

  // —— 小说 / MVU ——
  { name: 'set_novel_source', kind: 'write', risk: 'auto', summary: '设置小说原始资料文本', argsHint: '{ text, context? }' },
  { name: 'run_novel_extract_step', kind: 'generate', risk: 'confirm', summary: 'await 小说步骤（split/characters/worldbook/style）', argsHint: '{ mode }' },
  { name: 'novel_split_chapters', kind: 'generate', risk: 'confirm', summary: 'await 拆章并写回', argsHint: '{ mode? }' },
  { name: 'novel_extract_characters', kind: 'generate', risk: 'confirm', summary: 'await 人物扫描抽取', argsHint: '{}' },
  { name: 'novel_extract_worldbook', kind: 'generate', risk: 'confirm', summary: 'await 世界书分片抽取（降级）', argsHint: '{}' },
  { name: 'run_novel_rag_index', kind: 'generate', risk: 'confirm', summary: '重建小说 RAG 索引', argsHint: '{ keywordOnly? }' },
  { name: 'run_novel_analyze', kind: 'generate', risk: 'confirm', summary: '统一分析 all|skeleton|enrich|relations', argsHint: '{ phase? }' },
  { name: 'enrich_novel_entity', kind: 'generate', risk: 'confirm', summary: '丰满单条知识库实体', argsHint: '{ target|{id|name} }' },
  { name: 'patch_novel_entity', kind: 'write', risk: 'confirm', summary: '修改知识库实体字段', argsHint: '{ target|{id|name}, patch }' },
  { name: 'merge_novel_entities', kind: 'write', risk: 'confirm', summary: '合并两条实体', argsHint: '{ keep|{id|name}, drop|{id|name} }' },
  { name: 'sync_novel_entities', kind: 'write', risk: 'confirm', summary: '同步知识库实体到主世界书', argsHint: '{ types?, selected?, policy? }' },
  { name: 'set_novel_adult_mode', kind: 'write', risk: 'auto', summary: '开关小说全局 NSFW（原始资料·全局配置；联动分析/世界书/文风）', argsHint: '{ enabled: boolean }' },
  { name: 'set_novel_ntl_mode', kind: 'write', risk: 'auto', summary: '开关小说全局 NTL 禁忌张力层（与 NSFW 解耦，可叠加）', argsHint: '{ enabled: boolean }' },
  { name: 'draft_nsfw_statusbar', kind: 'read', risk: 'none', summary: '从人物 NSFW 生成状态栏变量草案（不写入）', argsHint: '{ name? }' },
  { name: 'generate_corruption_lore', kind: 'generate', risk: 'confirm', summary: '生成/更新恶堕进度总则与角色分期档案世界书', argsHint: '{ selectedNames?, preset?, customBrief?, templateOnly? }' },
  { name: 'novel_distill_style', kind: 'generate', risk: 'confirm', summary: 'await 文风蒸馏', argsHint: '{}' },
  { name: 'novel_patch_chapters', kind: 'write', risk: 'auto', summary: '章节合并/启停/调序/删/重命名', argsHint: '{ action, ids?, id?, title?, enabled? }' },
  { name: 'novel_expand_character', kind: 'generate', risk: 'confirm', summary: '按人物 id/名扩写档案（附录1；助手直跑跳过确认弹窗）', argsHint: '{ target|{id|name}, mode?, instruction? }' },
  { name: 'novel_rewrite_character', kind: 'generate', risk: 'confirm', summary: '按人物 id/名重写档案', argsHint: '{ target|{id|name}, instruction? }' },
  { name: 'novel_expand_worldbook', kind: 'generate', risk: 'confirm', summary: '按草稿 index/名扩写世界书条目（助手直跑跳过确认弹窗）', argsHint: '{ target|{index|name}, mode?, instruction? }' },
  { name: 'novel_sync_outputs', kind: 'write', risk: 'confirm', summary: '同步到世界书管道（character 会重定向为 character_worldbook；写主角需 asProtagonist:true）', argsHint: '{ target?, selected?, policy?, ids?, names?, asProtagonist? }' },
  { name: 'apply_novel_result_to_card', kind: 'write', risk: 'confirm', summary: '同步小说产出到主世界书（人物默认不进主角设定；文风→「文风」条目）', argsHint: '{ target?, policy? }' },
  { name: 'upsert_mvu_design', kind: 'write', risk: 'confirm', summary: '仅写入 MVU 设计 JSON（不强制注入）', argsHint: '{ design, inject?: false }' },
  { name: 'upsert_mvu_variables', kind: 'write', risk: 'confirm', summary: '按变量设计生成并注入变量卡', argsHint: '{ design?, inject?: true }' },
  { name: 'clear_mvu', kind: 'write', risk: 'confirm', summary: '清空 MVU 设计/产物', argsHint: '{}' },
  { name: 'patch_mvu_node', kind: 'write', risk: 'auto', summary: '按 path 补丁单个 MVU 变量节点', argsHint: '{ path, patch }' },

  // —— 引擎选项（非密钥）——
  { name: 'set_engine_options', kind: 'write', risk: 'auto', summary: '设置骨架条数等非密钥引擎选项', argsHint: '{ skeletonCount?, tagContextChars? }' },

  // —— 试聊回流 ——
  { name: 'analyze_chat_feedback', kind: 'generate', risk: 'none', summary: 'LLM+卡内容分析试聊并产出结构化 fixes', argsHint: '{}' },
  { name: 'apply_chat_feedback_fixes', kind: 'write', risk: 'confirm', summary: '确认后应用试聊建议修改', argsHint: '{ fixes }' },
];

/**
 * 预设快捷 chips（可挂真实工具：选中后填入 prompt，并标注 preferredTool）
 * @type {Array<{ id: string, label: string, prompt: string, tool?: string, args?: object }>}
 */
export const ASSISTANT_PRESET_CHIPS = [
  {
    id: 'setup_card',
    label: '帮我配卡',
    prompt: '我想做一张新卡（可当空卡）。先听我描述想要的风格与关系；你推荐世界观预设/载体框架/口味/NTL 等搭配并讨论，确认后再用 set_adult_config 写入「世界与限定」。不要强迫流程，也不要一上来就跑小说工坊。',
    tool: 'get_adult_config',
  },
  {
    id: 'recommend_adult',
    label: '推荐搭配',
    prompt: '根据当前卡面与我的偏好，用 get_adult_config 看现状，对照目录概览推荐世界观预设/口味/NTL/框架组合；我确认后再 set_adult_config。',
    tool: 'get_adult_config',
  },
  {
    id: 'start_generate',
    label: '开始生成',
    prompt: '配置若已就绪，请用 generate_character_draft 或生成世界书相关工具帮我开生成；也可 open_module 到角色设定让我自己点引擎。先确认我要生成哪一块。',
    tool: 'generate_character_draft',
  },
  {
    id: 'audit',
    label: '检查世界书',
    prompt: '请调用 audit_worldbook，再 suggest_fixes，列出主要问题与可执行修复。',
    tool: 'audit_worldbook',
  },
  {
    id: 'fill_keys',
    label: '补触发词',
    prompt: '请调用 batch_fill_worldbook_keys（onlyMissing=true）为缺少 keys 的条目补触发词。',
    tool: 'batch_fill_worldbook_keys',
    args: { onlyMissing: true },
  },
  {
    id: 'organize_wb',
    label: '智能整理',
    prompt: '请调用 organize_worldbook 分析并整理世界书参数，确认后再应用。',
    tool: 'organize_worldbook',
  },
  {
    id: 'char_polish',
    label: '润色人设',
    prompt: '阅读角色描述与开场白；需要扩写时用 expand_character_field / expand_greeting，小改可用 update_character_fields。',
    tool: 'expand_character_field',
  },
  {
    id: 'wb_expand',
    label: '展开骨架',
    prompt: '列出内容过短的世界书，用 expand_worldbook_entry 按 index/titleMatch 逐条扩写（先定位再改）。',
    tool: 'expand_worldbook_entry',
  },
  {
    id: 'lint_st',
    label: 'SillyTavern 体检',
    prompt: '请调用 lint_for_sillytavern，再用 fix_from_lint 生成修复补丁（需确认）。',
    tool: 'fix_from_lint',
  },
  {
    id: 'chat_fix',
    label: '试聊回流',
    prompt: '请调用 analyze_chat_feedback（LLM 结构化），必要时 apply_chat_feedback_fixes。',
    tool: 'analyze_chat_feedback',
  },
  {
    id: 'open_wb',
    label: '打开世界书',
    prompt: '请 open_module 到 worldbook，并用 get_worldbook_list 摘要条目数量。',
    tool: 'open_module',
    args: { view: 'worldbook' },
  },
];

export function getToolByName(name) {
  for (var i = 0; i < ASSISTANT_TOOLS.length; i++) {
    if (ASSISTANT_TOOLS[i].name === name) return ASSISTANT_TOOLS[i];
  }
  return null;
}

/** 生成工具清单文本，注入系统提示 */
export function formatToolsForPrompt(tools) {
  var list = tools || ASSISTANT_TOOLS;
  return list.map(function(t) {
    return '- ' + t.name + ' [' + t.kind + '/' + t.risk + ']: ' + t.summary + ' args=' + t.argsHint;
  }).join('\n');
}

export const VALID_VIEWS = [
  'card-manager', 'character', 'adult-config', 'greetings', 'worldbook', 'mvu', 'statusbar',
  'regex', 'tavern-scripts',
  'novel-source', 'novel-chapters', 'novel-character-setup', 'novel-greetings',
  'novel-analyze', 'novel-characters', 'novel-worldbook', 'novel-style',
  'chat', 'preview', 'auditor', 'ai-config', 'prompt-config',
];
