/**
 * 全站 actionId 目录（SoT 代码侧）
 * 文档：docs/architecture/action-engine.md
 */
import { TIER, SCOPE_KIND } from './types.mjs';

/** @type {Record<string, import('./types.mjs').ActionDef>} */
export var ACTION_CATALOG = Object.freeze({
  // —— 卡生命周期 ——
  'lifecycle.card.switch': { id: 'lifecycle.card.switch', tier: TIER.lifecycle, scopeKind: SCOPE_KIND.card, label: '切换角色卡' },
  'lifecycle.card.delete': { id: 'lifecycle.card.delete', tier: TIER.lifecycle, scopeKind: SCOPE_KIND.card, label: '删除角色卡' },
  'lifecycle.card.duplicate': { id: 'lifecycle.card.duplicate', tier: TIER.lifecycle, scopeKind: SCOPE_KIND.card, label: '复制角色卡' },
  'lifecycle.card.create': { id: 'lifecycle.card.create', tier: TIER.lifecycle, scopeKind: SCOPE_KIND.card, label: '新建角色卡' },
  'lifecycle.card.import': { id: 'lifecycle.card.import', tier: TIER.lifecycle, scopeKind: SCOPE_KIND.card, label: '导入角色卡' },
  'lifecycle.card.version.switch': { id: 'lifecycle.card.version.switch', tier: TIER.lifecycle, scopeKind: SCOPE_KIND.card, label: '切换卡版本' },
  'lifecycle.card.version.bump': { id: 'lifecycle.card.version.bump', tier: TIER.lifecycle, scopeKind: SCOPE_KIND.card, label: '新增卡版本' },

  // —— 小说工坊生命周期 / 破坏性 ——
  'lifecycle.novel.source.clear': { id: 'lifecycle.novel.source.clear', tier: TIER.lifecycle, scopeKind: SCOPE_KIND.card, label: '清空原始资料' },
  'lifecycle.novel.source.reset': { id: 'lifecycle.novel.source.reset', tier: TIER.lifecycle, scopeKind: SCOPE_KIND.card, label: '重置工坊' },
  'lifecycle.novel.source.upload': { id: 'lifecycle.novel.source.upload', tier: TIER.lifecycle, scopeKind: SCOPE_KIND.card, label: '上传原始资料' },
  'lifecycle.novel.chapters.split': { id: 'lifecycle.novel.chapters.split', tier: TIER.lifecycle, scopeKind: SCOPE_KIND.card, requiresSource: true, label: '拆章' },
  'lifecycle.novel.chapters.batch': { id: 'lifecycle.novel.chapters.batch', tier: TIER.lifecycle, scopeKind: SCOPE_KIND.card, requiresSource: true, label: '章节批处理' },
  'lifecycle.novel.graph.clear': { id: 'lifecycle.novel.graph.clear', tier: TIER.lifecycle, scopeKind: SCOPE_KIND.card, label: '清空图谱' },

  // —— 小说工坊 heavy ——
  'novel.char.scan': { id: 'novel.char.scan', tier: TIER.heavy, scopeKind: SCOPE_KIND.card, requiresAi: true, requiresExtract: true, busyLabel: '扫描中…', label: '人物扫描' },
  'novel.wb.extract': { id: 'novel.wb.extract', tier: TIER.heavy, scopeKind: SCOPE_KIND.card, requiresAi: true, requiresExtract: true, busyLabel: '抽取中…', label: '世界书抽取' },
  'novel.style.distill': { id: 'novel.style.distill', tier: TIER.heavy, scopeKind: SCOPE_KIND.card, requiresAi: true, requiresExtract: true, busyLabel: '蒸馏中…', label: '文风蒸馏' },
  'novel.setup.generate': { id: 'novel.setup.generate', tier: TIER.heavy, scopeKind: SCOPE_KIND.card, requiresAi: true, requiresExtract: true, busyLabel: '生成中…', label: '角色设定生成' },
  'novel.greetings.generate': { id: 'novel.greetings.generate', tier: TIER.heavy, scopeKind: SCOPE_KIND.card, requiresAi: true, requiresExtract: true, busyLabel: '生成中…', label: '开场白生成' },
  'novel.rag.index': { id: 'novel.rag.index', tier: TIER.heavy, scopeKind: SCOPE_KIND.card, requiresAi: true, requiresExtract: true, busyLabel: '建索引…', label: 'RAG 索引' },
  'novel.analyze.all': { id: 'novel.analyze.all', tier: TIER.heavy, scopeKind: SCOPE_KIND.card, requiresAi: true, requiresExtract: true, busyLabel: '分析中…', label: '小说分析' },
  'novel.analyze.skeleton': { id: 'novel.analyze.skeleton', tier: TIER.heavy, scopeKind: SCOPE_KIND.card, requiresAi: true, requiresExtract: true, busyLabel: '骨架中…', label: '分析骨架' },
  'novel.analyze.enrich': { id: 'novel.analyze.enrich', tier: TIER.heavy, scopeKind: SCOPE_KIND.card, requiresAi: true, requiresExtract: true, busyLabel: '丰满中…', label: '分析丰满' },
  'novel.analyze.relations': { id: 'novel.analyze.relations', tier: TIER.heavy, scopeKind: SCOPE_KIND.card, requiresAi: true, requiresExtract: true, busyLabel: '关系中…', label: '分析关系' },
  'novel.analyze.retry': { id: 'novel.analyze.retry', tier: TIER.heavy, scopeKind: SCOPE_KIND.card, requiresAi: true, requiresExtract: true, busyLabel: '重试中…', label: '重试失败' },
  'novel.analyze.adultDraft': { id: 'novel.analyze.adultDraft', tier: TIER.heavy, scopeKind: SCOPE_KIND.card, requiresAi: true, requiresExtract: true, busyLabel: '生成中…', label: '成人草案' },
  'novel.graph.relayout': {
    id: 'novel.graph.relayout',
    tier: TIER.safe,
    scopeKind: SCOPE_KIND.card,
    blockWhenScopeBusy: true,
    label: '图谱重排',
  },

  // —— 小说工坊 local_ai ——
  'novel.char.enrich': { id: 'novel.char.enrich', tier: TIER.local_ai, scopeKind: SCOPE_KIND.card, requiresAi: true, requiresExtract: true, busyLabel: '丰满中…', label: '人物丰满' },
  'novel.char.expand': { id: 'novel.char.expand', tier: TIER.local_ai, scopeKind: SCOPE_KIND.card, requiresAi: true, requiresExtract: true, busyLabel: '扩展中…', label: '人物扩展' },
  'novel.wb.enrich': { id: 'novel.wb.enrich', tier: TIER.local_ai, scopeKind: SCOPE_KIND.card, requiresAi: true, requiresExtract: true, busyLabel: '丰满中…', label: '世界书丰满' },
  'novel.wb.expand': { id: 'novel.wb.expand', tier: TIER.local_ai, scopeKind: SCOPE_KIND.card, requiresAi: true, requiresExtract: true, busyLabel: '扩展中…', label: '世界书扩展' },

  // —— 制卡 AI ——
  'card.engine.generate': { id: 'card.engine.generate', tier: TIER.heavy, scopeKind: SCOPE_KIND.card, requiresAi: true, busyLabel: '生成中…', label: 'AI 引擎一键生成' },
  'card.engine.enrich': { id: 'card.engine.enrich', tier: TIER.heavy, scopeKind: SCOPE_KIND.card, requiresAi: true, busyLabel: '丰满中…', label: 'AI 引擎续丰满' },
  'card.engine.roll': { id: 'card.engine.roll', tier: TIER.local_ai, scopeKind: SCOPE_KIND.card, requiresAi: true, busyLabel: 'Roll中…', label: 'AI 引擎 Roll' },
  'card.wb.single': { id: 'card.wb.single', tier: TIER.local_ai, scopeKind: SCOPE_KIND.card, requiresAi: true, busyLabel: '生成中…', label: '世界书单条' },
  'card.wb.organize': { id: 'card.wb.organize', tier: TIER.heavy, scopeKind: SCOPE_KIND.card, requiresAi: true, busyLabel: '整理中…', label: '世界书整理' },
  'card.wb.keygen': { id: 'card.wb.keygen', tier: TIER.local_ai, scopeKind: SCOPE_KIND.card, requiresAi: true, busyLabel: '补全中…', label: '世界书触发词' },
  'card.wb.rewrite': { id: 'card.wb.rewrite', tier: TIER.local_ai, scopeKind: SCOPE_KIND.card, requiresAi: true, busyLabel: '重写中…', label: '世界书重写' },
  'card.wb.expand': { id: 'card.wb.expand', tier: TIER.local_ai, scopeKind: SCOPE_KIND.card, requiresAi: true, busyLabel: '扩写中…', label: '世界书扩写' },
  'card.char.tags': { id: 'card.char.tags', tier: TIER.local_ai, scopeKind: SCOPE_KIND.card, requiresAi: true, busyLabel: '生成中…', label: '角色标签' },
  'card.auditor': { id: 'card.auditor', tier: TIER.heavy, scopeKind: SCOPE_KIND.card, requiresAi: true, busyLabel: '监测中…', label: '世界书监测' },
  'card.mvu.generate': { id: 'card.mvu.generate', tier: TIER.heavy, scopeKind: SCOPE_KIND.card, requiresAi: true, busyLabel: '生成中…', label: 'MVU 生成' },
  'card.statusbar.generate': { id: 'card.statusbar.generate', tier: TIER.heavy, scopeKind: SCOPE_KIND.card, requiresAi: true, busyLabel: '生成中…', label: '状态栏生成' },
  'card.statusbar.charScan': { id: 'card.statusbar.charScan', tier: TIER.local_ai, scopeKind: SCOPE_KIND.card, requiresAi: true, busyLabel: '识别中…', label: '状态栏人物识别' },
  'card.statusbar.layout': { id: 'card.statusbar.layout', tier: TIER.local_ai, scopeKind: SCOPE_KIND.card, requiresAi: true, busyLabel: '生成中…', label: '状态栏排版' },
  'card.chat.reply': { id: 'card.chat.reply', tier: TIER.local_ai, scopeKind: SCOPE_KIND.card, requiresAi: true, busyLabel: '回复中…', label: '试聊回复' },
  'card.assistant.react': { id: 'card.assistant.react', tier: TIER.local_ai, scopeKind: SCOPE_KIND.card, requiresAi: true, busyLabel: '思考中…', label: '助手 ReAct' },

  // —— 小说创作 lifecycle ——
  'lifecycle.story.open': { id: 'lifecycle.story.open', tier: TIER.lifecycle, scopeKind: SCOPE_KIND.story, label: '打开创作小说' },
  'lifecycle.story.create': { id: 'lifecycle.story.create', tier: TIER.lifecycle, scopeKind: SCOPE_KIND.story, label: '新建创作小说' },
  'lifecycle.story.delete': { id: 'lifecycle.story.delete', tier: TIER.lifecycle, scopeKind: SCOPE_KIND.story, label: '删除创作小说' },
  'lifecycle.story.rename': { id: 'lifecycle.story.rename', tier: TIER.lifecycle, scopeKind: SCOPE_KIND.story, label: '重命名创作小说' },
  'lifecycle.story.version.switch': { id: 'lifecycle.story.version.switch', tier: TIER.lifecycle, scopeKind: SCOPE_KIND.story, label: '切换创作版本' },
  'lifecycle.story.version.bump': { id: 'lifecycle.story.version.bump', tier: TIER.lifecycle, scopeKind: SCOPE_KIND.story, label: '创作增版' },
  'lifecycle.story.publish': { id: 'lifecycle.story.publish', tier: TIER.lifecycle, scopeKind: SCOPE_KIND.story, label: '发布创作' },

  // —— 小说创作 heavy ——
  'story.outline.generate': { id: 'story.outline.generate', tier: TIER.heavy, scopeKind: SCOPE_KIND.story, requiresAi: true, busyLabel: '大纲中…', label: '大纲生成' },
  'story.chapter.write': { id: 'story.chapter.write', tier: TIER.heavy, scopeKind: SCOPE_KIND.story, requiresAi: true, busyLabel: '撰写中…', label: '章文撰写' },
  'story.chapter.batch': { id: 'story.chapter.batch', tier: TIER.heavy, scopeKind: SCOPE_KIND.story, requiresAi: true, busyLabel: '连写中…', label: '章文连写' },

  // —— 管理端 ——
  'admin.user.disable': { id: 'admin.user.disable', tier: TIER.lifecycle, scopeKind: SCOPE_KIND.admin, requiresOps: true, label: '启用/禁用用户' },
  'admin.share.toggle': { id: 'admin.share.toggle', tier: TIER.lifecycle, scopeKind: SCOPE_KIND.admin, requiresOps: true, label: '分享启停' },
  'admin.share.delete': { id: 'admin.share.delete', tier: TIER.lifecycle, scopeKind: SCOPE_KIND.admin, requiresOps: true, label: '删除分享' },
  'admin.token.revoke': { id: 'admin.token.revoke', tier: TIER.lifecycle, scopeKind: SCOPE_KIND.admin, requiresOps: true, label: '吊销 Token' },
  'admin.token.purge': { id: 'admin.token.purge', tier: TIER.heavy, scopeKind: SCOPE_KIND.admin, requiresOps: true, busyLabel: '清理中…', label: '清理过期 Token' },
  'admin.backup.run': { id: 'admin.backup.run', tier: TIER.heavy, scopeKind: SCOPE_KIND.admin, requiresOps: true, requiresBackupEnabled: true, busyLabel: '备份中…', label: '逻辑备份' },
});

/** AI 任务 type → actionId（用于从 taskCenter 派生 lease） */
export var TASK_TYPE_TO_ACTION = Object.freeze({
  novel_char_scan: 'novel.char.scan',
  novel_char_expand: 'novel.char.expand',
  novel_wb_extract: 'novel.wb.extract',
  novel_wb_expand: 'novel.wb.expand',
  novel_rag_index: 'novel.rag.index',
  novel_analyze_skeleton: 'novel.analyze.skeleton',
  novel_analyze_enrich: 'novel.analyze.enrich',
  novel_analyze_relations: 'novel.analyze.relations',
  novel_style: 'novel.style.distill',
  novel_char_setup: 'novel.setup.generate',
  novel_greetings: 'novel.greetings.generate',
  engine_generate: 'card.engine.generate',
  engine_enrich: 'card.engine.enrich',
  wb_single: 'card.wb.single',
  wb_organize: 'card.wb.organize',
  wb_keygen: 'card.wb.keygen',
  wb_rewrite: 'card.wb.rewrite',
  wb_expand: 'card.wb.expand',
  char_tags_generate: 'card.char.tags',
  auditor: 'card.auditor',
  mvu_generate: 'card.mvu.generate',
  statusbar_generate: 'card.statusbar.generate',
  statusbar_char_scan: 'card.statusbar.charScan',
  statusbar_custom_layout: 'card.statusbar.layout',
  chat_reply: 'card.chat.reply',
  assistant_react: 'card.assistant.react',
  story_outline: 'story.outline.generate',
  story_chapter: 'story.chapter.write',
});

export function getActionDef(id) {
  return ACTION_CATALOG[id] || null;
}

export function listActionIds() {
  return Object.keys(ACTION_CATALOG);
}
