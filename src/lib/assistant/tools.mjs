/**
 * AI 助手工具目录：名称、说明、风险默认级、参数摘要（供系统提示与测试）
 */

/** @typedef {'read'|'write'|'generate'|'nav'|'meta'} ToolKind */
/** @typedef {'none'|'auto'|'confirm'} RiskLevel */

/**
 * 定向修改约定（写入类工具通用）：
 * - target: { id?, titleMatch?, index?, comment? } 或简写 index/comment/id
 * - mode: rewrite | expand | patch
 * - instruction: 本次生成提示（长文工具必填：已确认设定、要写的内容、与已有人物/物品/地点的关系）
 */

/**
 * @type {Array<{
 *   name: string,
 *   title: string,
 *   kind: ToolKind,
 *   risk: RiskLevel,
 *   summary: string,
 *   argsHint: string
 * }>}
 */
export const ASSISTANT_TOOLS = [
  // —— 只读 ——
  { name: 'get_character_fields', title: '读取角色设定', kind: 'read', risk: 'none', summary: '读取角色设定字段', argsHint: '{}' },
  { name: 'get_character_summary', title: '角色摘要', kind: 'read', risk: 'none', summary: '角色摘要（截断长文本）', argsHint: '{ maxLen? }' },
  { name: 'get_worldbook_list', title: '世界书列表', kind: 'read', risk: 'none', summary: '世界书条目列表', argsHint: '{ query? }' },
  { name: 'get_worldbook_entry', title: '世界书详情', kind: 'read', risk: 'none', summary: '单条世界书详情', argsHint: '{ target|{index|id|titleMatch|comment} }' },
  { name: 'get_mvu_state', title: 'MVU 状态', kind: 'read', risk: 'none', summary: '读取 MVU 设计/扩展状态', argsHint: '{}' },
  { name: 'infer_mvu_variables', title: '推定 MVU 变量', kind: 'read', risk: 'none', summary: '从卡规则推定 MVU 候选变量（只读预览，不写入）', argsHint: '{}' },
  { name: 'get_novel_workspace', title: '小说工坊摘要', kind: 'read', risk: 'none', summary: '小说工坊状态摘要（含实体/RAG）', argsHint: '{}' },
  { name: 'get_export_preview', title: '导出预览', kind: 'read', risk: 'none', summary: '导出 JSON 结构预览（不下载）', argsHint: '{ maxChars? }' },
  { name: 'export_card_check', title: '导出结构校验', kind: 'read', risk: 'none', summary: '校验当前卡可导出结构（不触发下载）', argsHint: '{}' },
  { name: 'search_card_content', title: '搜索卡片内容', kind: 'read', risk: 'none', summary: '在角色/世界书中搜索', argsHint: '{ query, limit? }' },
  { name: 'search_novel_passages', title: '检索小说片段', kind: 'read', risk: 'none', summary: '混合检索小说原文片段', argsHint: '{ query, limit?, budget? }' },
  { name: 'list_novel_entities', title: '实体列表', kind: 'read', risk: 'none', summary: '知识库实体列表', argsHint: '{ type?, query? }' },
  { name: 'get_novel_entity', title: '实体详情', kind: 'read', risk: 'none', summary: '单条知识库实体', argsHint: '{ target|{id|name|titleMatch} }' },
  { name: 'audit_worldbook', title: '世界书监测', kind: 'read', risk: 'none', summary: '世界书快速监测（本地规则）', argsHint: '{}' },
  { name: 'lint_for_sillytavern', title: 'ST 体检', kind: 'read', risk: 'none', summary: 'SillyTavern 常见问题检查', argsHint: '{}' },
  { name: 'get_chat_feedback', title: '读取试聊反馈', kind: 'read', risk: 'none', summary: '读取试聊历史与暴露问题', argsHint: '{ messageIds?, maxMessages? }' },
  { name: 'list_promotions', title: 'Promote 历史', kind: 'read', risk: 'none', summary: '读取近 N 条跨层 Promote 摘要', argsHint: '{ limit? }' },
  { name: 'list_cards', title: '卡片列表', kind: 'read', risk: 'none', summary: '多卡草稿列表（id/名/当前）', argsHint: '{}' },
  { name: 'get_engine_options', title: '读取引擎选项', kind: 'read', risk: 'none', summary: '读取 AI 引擎非密钥选项', argsHint: '{}' },
  { name: 'get_prompt_ids', title: '提示词配置列表', kind: 'read', risk: 'none', summary: '提示词配置 id 列表（只读）', argsHint: '{}' },
  { name: 'get_adult_config', title: '读取世界与限定', kind: 'read', risk: 'none', summary: '读取卡级「世界与限定」（世界观预设/框架/口味/表达层/NTL/恶堕）', argsHint: '{}' },
  { name: 'get_adult_catalog', title: '目录分组检索', kind: 'read', risk: 'none', summary: '按需取「世界与限定」目录分组与 id/摘要（省 system token）', argsHint: '{ kinds?, groups?, query?, withSummary? }' },
  { name: 'novel_list_outputs', title: '小说产出摘要', kind: 'read', risk: 'none', summary: '小说各模块产出摘要（人物/世界书/文风/实体）', argsHint: '{}' },

  // —— 写入（小改 auto / 大改 confirm）——
  { name: 'update_character_fields', title: '更新角色字段', kind: 'write', risk: 'auto', summary: '只改角色名、世界书名、标签等短字段；场景契约和作者注释用 expand_character_field', argsHint: '{ fields:{charName?,wbName?,tags?} }' },
  { name: 'replace_character_section', title: '覆盖角色字段', kind: 'write', risk: 'confirm', summary: '不要用来写长文；场景契约和作者注释用 expand_character_field', argsHint: '{ field, content(短) }' },
  { name: 'expand_character_field', title: '重写/扩写角色字段', kind: 'generate', risk: 'confirm', summary: '按字段重写/扩写一篇角色长文；instruction 为本次生成提示', argsHint: '{ field: charDesc|creatorNotes|..., mode?, instruction }' },
  { name: 'set_adult_config', title: '更新世界与限定', kind: 'write', risk: 'confirm', summary: '更新卡级「世界与限定」（worldviewPresetItems/框架/口味/表达层/NTL/恶堕等）', argsHint: '{ worldviewPresetItems?, enabled?, flavorItems?, postureItems?, speechItems?, ntlEnabled?, ntlTabooTypes?, adultWorldframeForced?, corruptionEnabled?, ... }' },
  { name: 'create_worldbook_entry', title: '新建世界书', kind: 'write', risk: 'auto', summary: '新建短条目；长正文用 generate_worldbook_entry', argsHint: '{ entry:{ comment, content(短), keys?, strategy? } }' },
  { name: 'update_worldbook_entry', title: '更新世界书', kind: 'write', risk: 'auto', summary: '改标题、触发词等短字段；长正文用 rewrite_worldbook_entry 或 expand_worldbook_entry', argsHint: '{ target|{index|comment}, patch:{ comment?, keys?, strategy? } }' },
  { name: 'delete_worldbook_entry', title: '删除世界书', kind: 'write', risk: 'confirm', summary: '删除世界书条目（含清空全部）', argsHint: '{ index|indices|target|{all:true} }' },

  // —— 开场白定向 ——
  { name: 'rewrite_greeting', title: '重写开场白', kind: 'generate', risk: 'confirm', summary: '重写一条开场白；instruction 为本次生成提示', argsHint: '{ target: main|{alternate:n}|index, mode?, instruction }' },
  { name: 'expand_greeting', title: '扩写开场白', kind: 'generate', risk: 'confirm', summary: '扩写一条开场白；instruction 为本次生成提示', argsHint: '{ target: main|{alternate:n}|index, instruction }' },
  { name: 'update_alternate_greeting', title: '更新备选开场白', kind: 'write', risk: 'auto', summary: '只改很短的措辞；整段用 rewrite_greeting 或 expand_greeting', argsHint: '{ index, content(短) }' },
  { name: 'set_greeting_init', title: '设置开场初始值', kind: 'write', risk: 'auto', summary: '设置某一条开场相对世界书保底的初始值差异；target 与开场白工具相同', argsHint: '{ target: main|{alternate:n}|index, overrides:{路径:值}, clear? }' },

  // —— 生成（对接现有引擎/面板）——
  { name: 'generate_character_draft', title: '生成角色草稿', kind: 'generate', risk: 'confirm', summary: '已停用：长文请逐篇调用 expand_character_field 等', argsHint: '{ prompt? }' },
  { name: 'generate_worldbook_skeleton', title: '生成世界书骨架', kind: 'generate', risk: 'confirm', summary: '已停用：世界书正文请逐条 generate/expand/rewrite_worldbook_entry', argsHint: '{ count?, direction? }' },
  { name: 'generate_worldbook_entry', title: '生成世界书条目', kind: 'generate', risk: 'confirm', summary: '单条世界书生成并写入；instruction 为本次生成提示', argsHint: '{ instruction }' },
  { name: 'organize_worldbook', title: '整理世界书', kind: 'generate', risk: 'confirm', summary: '智能整理世界书参数（可预览后应用）', argsHint: '{ apply?: boolean }' },
  { name: 'batch_fill_worldbook_keys', title: '批量补触发词', kind: 'generate', risk: 'confirm', summary: '批量补全世界书触发词', argsHint: '{ onlyMissing?: boolean }' },
  { name: 'rewrite_worldbook_entry', title: '重写世界书', kind: 'generate', risk: 'confirm', summary: '定向重写一条世界书；instruction 为本次生成提示', argsHint: '{ target, mode?, instruction }' },
  { name: 'expand_worldbook_entry', title: '扩写世界书', kind: 'generate', risk: 'auto', summary: '定向扩写一条世界书；instruction 为本次生成提示', argsHint: '{ target, instruction }' },
  { name: 'fix_from_lint', title: '应用修复补丁', kind: 'write', risk: 'confirm', summary: '根据 lint/审计生成并应用修复补丁包', argsHint: '{ apply?: boolean, maxOps? }' },

  // —— 导航 / 补丁 ——
  { name: 'open_module', title: '跳转模块', kind: 'nav', risk: 'none', summary: '跳转侧栏模块', argsHint: '{ view }' },
  { name: 'open_entity_graph', title: '打开关系图谱', kind: 'nav', risk: 'none', summary: '打开卡 worldbook 关系一览（只读 G6）', argsHint: '{ scope?: "card" }' },
  { name: 'apply_patch_bundle', title: '应用补丁包', kind: 'write', risk: 'confirm', summary: '批量应用补丁包', argsHint: '{ ops, summary? }' },
  { name: 'undo_last_bundle', title: '撤销补丁', kind: 'write', risk: 'auto', summary: '撤销上一补丁包（含小说桶）', argsHint: '{}' },
  { name: 'suggest_fixes', title: '给出修复建议', kind: 'meta', risk: 'none', summary: '基于 lint/审计给出修复建议', argsHint: '{}' },

  // —— 多卡管理（无代导出）——
  { name: 'switch_card', title: '切换角色卡', kind: 'write', risk: 'confirm', summary: '切换当前角色卡（含小说桶）', argsHint: '{ id|name }' },
  { name: 'create_card', title: '新建角色卡', kind: 'write', risk: 'confirm', summary: '新建空白角色卡', argsHint: '{ name? }' },
  { name: 'duplicate_card', title: '复制角色卡', kind: 'write', risk: 'confirm', summary: '复制角色卡', argsHint: '{ id? }' },
  { name: 'rename_card', title: '重命名角色卡', kind: 'write', risk: 'auto', summary: '重命名角色卡', argsHint: '{ id?, name }' },
  { name: 'delete_card', title: '删除角色卡', kind: 'write', risk: 'confirm', summary: '删除角色卡', argsHint: '{ id }' },
  { name: 'import_card', title: '导入角色卡', kind: 'write', risk: 'confirm', summary: '导入已解析角色卡 JSON（不代下载）', argsHint: '{ cardJson }' },

  // —— 小说 / MVU ——
  { name: 'set_novel_source', title: '设置小说原文', kind: 'write', risk: 'confirm', summary: '设置小说原始资料文本', argsHint: '{ text, context? }' },
  { name: 'run_novel_extract_step', title: '小说提取步骤', kind: 'generate', risk: 'confirm', summary: 'await 小说步骤（split/characters/worldbook/style）', argsHint: '{ mode }' },
  { name: 'novel_split_chapters', title: '拆章', kind: 'generate', risk: 'confirm', summary: 'await 拆章并写回', argsHint: '{ mode? }' },
  { name: 'novel_extract_characters', title: '抽取人物', kind: 'generate', risk: 'confirm', summary: 'await 人物扫描抽取', argsHint: '{}' },
  { name: 'novel_extract_worldbook', title: '抽取世界书', kind: 'generate', risk: 'confirm', summary: 'await 世界书分片抽取（降级）', argsHint: '{}' },
  { name: 'run_novel_rag_index', title: '重建 RAG 索引', kind: 'generate', risk: 'confirm', summary: '重建小说 RAG 索引', argsHint: '{ keywordOnly? }' },
  { name: 'run_novel_analyze', title: '统一分析', kind: 'generate', risk: 'confirm', summary: '统一分析 all|skeleton|enrich|relations', argsHint: '{ phase? }' },
  { name: 'enrich_novel_entity', title: '丰满实体', kind: 'generate', risk: 'confirm', summary: '丰满单条知识库实体', argsHint: '{ target|{id|name} }' },
  { name: 'patch_novel_entity', title: '修改实体', kind: 'write', risk: 'confirm', summary: '修改知识库实体字段', argsHint: '{ target|{id|name}, patch }' },
  { name: 'merge_novel_entities', title: '合并实体', kind: 'write', risk: 'confirm', summary: '合并两条实体', argsHint: '{ keep|{id|name}, drop|{id|name} }' },
  { name: 'sync_novel_entities', title: '同步实体到世界书', kind: 'write', risk: 'confirm', summary: '同步知识库实体到主世界书', argsHint: '{ types?, selected?, policy? }' },
  { name: 'set_novel_adult_mode', title: '小说 NSFW 开关', kind: 'write', risk: 'confirm', summary: '开关小说全局 NSFW（原始资料·全局配置；联动分析/世界书/文风）', argsHint: '{ enabled: boolean }' },
  { name: 'set_novel_ntl_mode', title: '小说 NTL 开关', kind: 'write', risk: 'confirm', summary: '开关小说全局 NTL 禁忌张力层（与 NSFW 解耦，可叠加）', argsHint: '{ enabled: boolean }' },
  { name: 'draft_nsfw_statusbar', title: '状态栏变量草案', kind: 'read', risk: 'none', summary: '从人物 NSFW 生成状态栏变量草案（不写入）', argsHint: '{ name? }' },
  { name: 'generate_corruption_lore', title: '生成恶堕档案', kind: 'generate', risk: 'confirm', summary: '生成/更新恶堕进度总则与角色分期档案世界书', argsHint: '{ selectedNames?, preset?, customBrief?, templateOnly? }' },
  { name: 'generate_affection_lore', title: '生成亲密档案', kind: 'generate', risk: 'confirm', summary: '生成/更新纯爱线亲密关系总则与角色分期档案世界书', argsHint: '{ selectedNames?, preset?, customBrief?, templateOnly? }' },
  { name: 'novel_distill_style', title: '文风蒸馏', kind: 'generate', risk: 'confirm', summary: 'await 文风蒸馏', argsHint: '{}' },
  { name: 'novel_patch_chapters', title: '章节管理', kind: 'write', risk: 'auto', summary: '章节合并/启停/调序/删/重命名', argsHint: '{ action, ids?, id?, title?, enabled? }' },
  { name: 'novel_expand_character', title: '扩写人物档案', kind: 'generate', risk: 'confirm', summary: '按人物扩写一篇档案；instruction 为本次生成提示', argsHint: '{ target|{id|name}, mode?, instruction }' },
  { name: 'novel_rewrite_character', title: '重写人物档案', kind: 'generate', risk: 'confirm', summary: '按人物重写一篇档案；instruction 为本次生成提示', argsHint: '{ target|{id|name}, instruction }' },
  { name: 'novel_expand_worldbook', title: '扩写世界书条目', kind: 'generate', risk: 'confirm', summary: '按草稿扩写一条世界书；instruction 为本次生成提示', argsHint: '{ target|{index|name}, mode?, instruction }' },
  { name: 'novel_sync_outputs', title: '同步到世界书管道', kind: 'write', risk: 'confirm', summary: '同步到世界书管道（character 会重定向为 character_worldbook；写主角需 asProtagonist:true）', argsHint: '{ target?, selected?, policy?, ids?, names?, asProtagonist? }' },
  { name: 'apply_novel_result_to_card', title: '同步到主世界书', kind: 'write', risk: 'confirm', summary: '同步小说产出到主世界书（人物默认不进主角设定；文风→「文风」条目）', argsHint: '{ target?, policy? }' },
  { name: 'upsert_mvu_design', title: '写入 MVU 设计', kind: 'write', risk: 'confirm', summary: '仅写入 MVU 设计 JSON（不强制注入）', argsHint: '{ design, inject?: false }' },
  { name: 'upsert_mvu_variables', title: '生成 MVU 变量卡', kind: 'write', risk: 'confirm', summary: '按变量设计生成并注入变量卡', argsHint: '{ design?, inject?: true }' },
  { name: 'clear_mvu', title: '清空 MVU', kind: 'write', risk: 'confirm', summary: '清空 MVU 设计/产物', argsHint: '{}' },
  { name: 'patch_mvu_node', title: '补丁 MVU 节点', kind: 'write', risk: 'auto', summary: '按 path 补丁单个 MVU 变量节点', argsHint: '{ path, patch }' },

  // —— 引擎选项（非密钥）——
  { name: 'set_engine_options', title: '设置引擎选项', kind: 'write', risk: 'auto', summary: '设置骨架条数等非密钥引擎选项', argsHint: '{ skeletonCount?, tagContextChars? }' },

  // —— 试聊回流 ——
  { name: 'analyze_chat_feedback', title: '分析试聊', kind: 'generate', risk: 'none', summary: 'LLM+卡内容分析试聊并产出结构化 fixes', argsHint: '{ messageIds? }' },
  { name: 'apply_chat_feedback_fixes', title: '应用试聊修改', kind: 'write', risk: 'confirm', summary: '确认后应用试聊建议修改', argsHint: '{ fixes }' },
  { name: 'promote_chat_episode', title: '归档试聊到 Story', kind: 'write', risk: 'confirm', summary: '试聊 Episode Promote → 章草稿/plotLedger', argsHint: '{ novelId, messageIds?, chapterDraft?, plotLedger? }' },
  { name: 'seed_story_graph_from_card', title: '卡种子→Story 图谱', kind: 'write', risk: 'confirm', summary: '从当前卡导入设定到 Story 图谱', argsHint: '{ novelId? }' },
  { name: 'promote_story_graph_to_card', title: 'Story 图谱→卡', kind: 'write', risk: 'confirm', summary: 'Story Ref 节点同步到 worldbook', argsHint: '{ ids?, policy? }' },
  { name: 'seed_story_from_novel_entities', title: '工坊开 Story', kind: 'write', risk: 'confirm', summary: '用工坊实体开新 Story', argsHint: '{ entityIds?, novelTitle? }' },
];

/**
 * 预设快捷 chips（可挂真实工具：选中后填入 prompt，并标注 preferredTool）
 * @type {Array<{ id: string, label: string, prompt: string, tool?: string, args?: object }>}
 */
export const ASSISTANT_PRESET_CHIPS = [
  {
    id: 'setup_card',
    label: '帮我配卡',
    prompt: '我想做一张新卡（可当空卡）。先听我描述想要的风格与关系；你推荐世界观预设/载体框架/口味/姿势语言/情趣话风/NTL 等搭配并讨论，确认后再用 set_adult_config 写入「世界与限定」。姿势与话风是特别偏好高亮，不锁死扮演范围。不要强迫流程，也不要一上来就跑小说工坊。',
    tool: 'get_adult_config',
  },
  {
    id: 'recommend_adult',
    label: '推荐搭配',
    prompt: '根据当前卡面与我的偏好，用 get_adult_config 看现状，对照目录概览推荐世界观预设/口味/姿势语言/情趣话风/NTL/框架组合；我确认后再 set_adult_config。表达层多选不占口味槽，所选为偏好而非白名单。',
    tool: 'get_adult_config',
  },
  {
    id: 'start_generate',
    label: '开始生成',
    prompt: '配置若已就绪，先确认要写的一块。角色长文用 expand_character_field，开场白用 expand_greeting 或 rewrite_greeting，世界书用 generate_worldbook_entry 或 expand_worldbook_entry，每次只写一篇，instruction 写清这次的生成提示。不要用 generate_character_draft 或骨架工具一次写完。',
    tool: 'expand_character_field',
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

/** 界面上的工具名。没有登记标题时才回退英文 id。 */
export function toolTitleOf(name) {
  var meta = getToolByName(name);
  return (meta && meta.title) || String(name || '工具');
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
