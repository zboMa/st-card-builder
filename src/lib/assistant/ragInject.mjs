/**
 * 助手回合 RAG：片段去重键、正文拼装、与 user 消息绑定。
 */
import {
  expandEntitiesViaRelations,
  formatRelationContextLines,
  pickRelatedEntities as pickRelatedEntitiesCore,
} from '../novel/rag/inject.mjs';

/** @param {{ id?: string, chapterId?: string, start?: number, text?: string }} snippet */
export function snippetKey(snippet) {
  if (!snippet) return '';
  if (snippet.id) return String(snippet.id);
  return (
    String(snippet.chapterId || '')
    + ':'
    + String(snippet.start != null ? snippet.start : 0)
    + ':'
    + String(snippet.text || '').slice(0, 40)
  );
}

/**
 * 过滤本会话已注入过的片段。
 * @param {object[]} snippets
 * @param {Set<string>|string[]} injectedIds
 */
export function filterNewSnippets(snippets, injectedIds) {
  var injected = injectedIds instanceof Set ? injectedIds : new Set(injectedIds || []);
  var fresh = [];
  (snippets || []).forEach(function(s) {
    var key = snippetKey(s);
    if (!key || injected.has(key)) return;
    fresh.push(s);
  });
  return fresh;
}

/** @param {object[]} snippets */
export function collectSnippetKeys(snippets) {
  return (snippets || []).map(snippetKey).filter(Boolean);
}

/** 索引状态提示（助手预览 / 注入共用） */
export function formatIndexStatusHint(indexMeta) {
  if (!indexMeta) return '';
  var status = indexMeta.indexStatus || 'idle';
  if (indexMeta.indexReady) return '';
  if (status === 'building') return '【索引状态】向量索引正在构建中，当前仅关键词检索。';
  if (status === 'error') return '【索引状态】索引构建失败，当前仅关键词检索；请在「小说分析」重建索引。';
  if (indexMeta.indexStale) {
    return '【索引状态】索引已过期（章节有变更），请在「小说分析」重建索引；当前仍可用关键词检索。';
  }
  if (status !== 'ready' || !(indexMeta.chunkCount > 0)) {
    return '【索引状态】向量索引未就绪，请在「小说分析」点击「建索引」；当前仍可用关键词检索。';
  }
  return '';
}

/** @param {object[]} snippets */
export function buildRagPassageBody(snippets, indexMeta) {
  var hint = formatIndexStatusHint(indexMeta);
  if (!snippets || !snippets.length) {
    var empty = '（未命中相关原文片段）';
    if (hint) empty = hint + '\n' + empty;
    return empty;
  }
  var body = snippets.map(function(s, i) {
    var title = s.chapterTitle || ('章' + ((s.chapterIndex || 0) + 1));
    return '【片段' + (i + 1) + '｜' + title + '】\n' + String(s.text || '');
  }).join('\n\n');
  if (hint) body = hint + '\n\n' + body;
  return body;
}

/**
 * @param {{
 *   snippets?: object[],
 *   mode?: string,
 *   relatedEntities?: object[],
 *   relationLines?: string[],
 *   ragHint?: string,
 *   indexMeta?: object,
 * }} opts
 */
export function buildRagUserBlock(opts) {
  opts = opts || {};
  var mode = opts.mode || 'keyword';
  var passageBody = buildRagPassageBody(opts.snippets, opts.indexMeta);
  var related = opts.relatedEntities || [];
  var entityLines = related.map(function(e) {
    return '- [' + (e.type || '') + '] ' + (e.name || '')
      + (e.summary ? ': ' + String(e.summary).slice(0, 100) : '');
  });
  var ragBody = '【相关小说原文】（' + mode + '）\n'
    + passageBody
    + '\n\n【相关实体】\n'
    + (entityLines.length ? entityLines.join('\n') : '（无）');
  var relationLines = opts.relationLines || [];
  if (relationLines.length) {
    ragBody += '\n\n【相关关系（知识图谱）】\n' + relationLines.join('\n');
  }
  if (opts.ragHint) ragBody = opts.ragHint + '\n\n' + ragBody;
  return ragBody;
}

/** user 回合发给模型的完整 content（展示仍用纯 user 文本）。 */
export function buildUserModelContent(userText, ragBlock) {
  var text = String(userText || '');
  if (!ragBlock) return text;
  return text + '\n\n' + ragBlock;
}

/** history / token 估算用：优先 modelContent。 */
export function messageContentForModel(msg) {
  if (!msg) return '';
  if (msg.modelContent != null && msg.modelContent !== '') return String(msg.modelContent);
  return String(msg.content || '');
}

/** UI 气泡展示用：优先 displayContent。 */
export function messageContentForDisplay(msg) {
  if (!msg) return '';
  if (msg.displayContent != null) return String(msg.displayContent);
  return String(msg.content || '');
}

/**
 * 按用户文本匹配相关实体，并经 relations 扩展图谱邻居。
 * @param {string} userText
 * @param {object[]} entities
 * @param {{ limit?: number, fallback?: number, relations?: object[] }} [opts]
 */
export function pickRelatedEntities(userText, entities, opts) {
  opts = opts || {};
  return pickRelatedEntitiesCore(entities, userText, {
    limit: opts.limit != null ? opts.limit : 12,
    fallback: opts.fallback != null ? opts.fallback : 6,
    relations: opts.relations,
  });
}

/**
 * 组装 RAG 预览载荷（composer / 消息气泡 / 会话持久化）。
 * @param {{
 *   snippets?: object[],
 *   allSnippets?: object[],
 *   previewOnly?: boolean,
 *   mode?: string,
 *   relatedEntities?: object[],
 *   relationLines?: string[],
 *   ragHint?: string,
 *   indexMeta?: object,
 *   source?: string,
 *   query?: string,
 * }} opts
 */
export function buildRagPreviewPayload(opts) {
  opts = opts || {};
  var freshSnippets = opts.snippets || [];
  var allSnippets = opts.allSnippets != null ? opts.allSnippets : freshSnippets;
  // 预览展示全部命中；注入回合仍用去重后的 freshSnippets
  var displaySnippets = opts.previewOnly ? allSnippets : freshSnippets;
  var mode = opts.mode || 'keyword';
  var relatedEntities = opts.relatedEntities || [];
  var ragBody = buildRagUserBlock({
    snippets: displaySnippets,
    mode: mode,
    relatedEntities: relatedEntities,
    relationLines: opts.relationLines || [],
    ragHint: opts.ragHint || '',
    indexMeta: opts.indexMeta,
  });
  return {
    ragBody: ragBody,
    snippets: freshSnippets,
    displaySnippets: displaySnippets,
    allSnippets: allSnippets,
    mode: mode,
    relatedEntities: relatedEntities,
    relationLines: opts.relationLines || [],
    indexMeta: opts.indexMeta || null,
    injectedKeys: collectSnippetKeys(freshSnippets),
    dedupeSkipped: Math.max(0, allSnippets.length - freshSnippets.length),
    dedupeTotal: allSnippets.length,
    source: opts.source || 'preview',
    query: opts.query || '',
  };
}

/** 预览弹窗 meta 行文案。 */
export function formatRagPreviewMeta(payload) {
  if (!payload) return '';
  var parts = ['模式：' + (payload.mode || 'keyword')];
  var fresh = (payload.displaySnippets || payload.snippets || []).length;
  var total = payload.dedupeTotal != null ? payload.dedupeTotal : fresh;
  parts.push('片段 ' + fresh + '/' + total);
  if (payload.dedupeSkipped > 0) {
    parts.push('去重跳过 ' + payload.dedupeSkipped);
  }
  parts.push('实体 ' + (payload.relatedEntities || []).length);
  var im = payload.indexMeta;
  if (im) {
    if (im.indexReady) parts.push('索引就绪');
    else if (im.indexStatus === 'building') parts.push('索引构建中');
    else if (im.indexStale) parts.push('索引过期');
    else parts.push('索引未就绪');
  }
  if (payload.source === 'injected') parts.push('已注入');
  else if (payload.source === 'preview') parts.push('预览（未写入会话）');
  else if (payload.source === 'stored') parts.push('已保存');
  else if (payload.source === 'rerun') parts.push('重新检索');
  if (payload.query) parts.push('查询：' + String(payload.query).slice(0, 48));
  return parts.join(' · ');
}

export { formatRelationContextLines, expandEntitiesViaRelations };
