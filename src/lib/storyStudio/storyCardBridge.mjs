/**
 * Story↔卡桥（§6.2.2 · D17）
 */

import { seedGraphFromCard } from '../storyStudio/graphSeed.mjs';
import { createEmptyNovel, normalizeNovel } from '../storyStudio/state.mjs';
import { loadNovel, saveNovel, loadCatalog, saveCatalog } from '../storyStudio/idb.mjs';
import { appendPromotionLog } from '../promotionLog.mjs';
import { projectionMetaForPromote } from '../projectionMeta.mjs';
import { applyDraftsToWorldbook } from '../novel/sync.mjs';

function upsertCatalogEntry(catalog, novel) {
  var list = Array.isArray(catalog) ? catalog.slice() : [];
  var id = novel && novel.id;
  if (!id) return list;
  var idx = list.findIndex(function(x) { return x && (x.id === id || x.novelId === id); });
  var entry = { id: id, novelId: id, title: String(novel.title || ''), updatedAt: Date.now() };
  if (idx >= 0) list[idx] = Object.assign({}, list[idx], entry);
  else list.push(entry);
  return list;
}

/**
 * @param {string} draftId
 * @param {string} [novelId]
 * @param {object} cardPayload { charName, charDesc, worldbookEntries }
 */
export async function seedStoryGraphFromCard(draftId, novelId, cardPayload) {
  var cid = String(draftId || '').trim();
  if (!cid) return { ok: false, error: '缺少 draftId' };
  var novel;
  if (novelId) {
    novel = await loadNovel(cid, novelId);
  }
  if (!novel) {
    novel = createEmptyNovel({ cardId: cid, title: (cardPayload && cardPayload.charName) || '来自卡面' });
  }
  novel = normalizeNovel(novel);
  var graph = seedGraphFromCard({
    charName: cardPayload && cardPayload.charName,
    charDesc: cardPayload && cardPayload.charDesc,
    worldbookEntries: cardPayload && cardPayload.worldbookEntries,
  });
  (graph.nodes || []).forEach(function(n) {
    if (!n) return;
    n.sourceRef = { type: 'card', id: n.id, charSlot: n.name };
  });
  novel.graph = graph;
  novel.updatedAt = Date.now();
  await saveNovel(cid, novel.id, novel);
  var catalog = await loadCatalog(cid);
  await saveCatalog(cid, upsertCatalogEntry(catalog, novel));
  await appendPromotionLog(cid, {
    kind: 'card_to_story',
    source: { view: 'card', charName: cardPayload && cardPayload.charName },
    target: { novelId: novel.id },
    summary: '从卡面种子 Story 图谱',
  });
  return { ok: true, novelId: novel.id, nodeCount: (graph.nodes || []).length };
}

/**
 * 工坊 entity → 新 Story（Ref 节点占位）
 */
export async function seedStoryFromNovelEntities(draftId, entities, relations, opts) {
  var cid = String(draftId || '').trim();
  var o = opts || {};
  if (!cid) return { ok: false, error: '缺少 draftId' };
  var novel = createEmptyNovel({
    cardId: cid,
    title: String(o.novelTitle || '来自工坊设定'),
  });
  novel = normalizeNovel(novel);
  var nodes = [];
  var edges = [];
  (entities || []).forEach(function(ent) {
    if (!ent || !ent.id) return;
    nodes.push({
      id: 'ref_' + ent.id,
      type: ent.type === 'character' ? 'character' : (ent.type === 'location' ? 'location' : 'other'),
      name: ent.name || ent.id,
      note: String(ent.summary || ent.content || '').slice(0, 500),
      entityRef: ent.id,
      sourceRef: { type: 'entity', id: ent.id },
    });
  });
  (relations || []).forEach(function(r, i) {
    if (!r) return;
    edges.push({
      id: 'e_' + i,
      from: 'ref_' + (r.from || r.source),
      to: 'ref_' + (r.to || r.target),
      label: r.label || r.type || '关联',
    });
  });
  novel.graph = { nodes: nodes, edges: edges, updatedAt: new Date().toISOString() };
  await saveNovel(cid, novel.id, novel);
  var catalog = await loadCatalog(cid);
  await saveCatalog(cid, upsertCatalogEntry(catalog, novel));
  await appendPromotionLog(cid, {
    kind: 'workshop_to_story',
    source: { view: 'novel_workshop', count: nodes.length },
    target: { novelId: novel.id },
    summary: '用工坊实体开 Story：' + novel.title,
  });
  return { ok: true, novelId: novel.id, nodeCount: nodes.length };
}

/** Story 节点 → worldbook 草稿（供 sync 管道） */
export function storyNodesToWorldbookDrafts(nodes, novelId) {
  return (nodes || []).filter(function(n) { return n && n.name; }).map(function(n) {
    var isPerson = n.type === 'character';
    return {
      category: isPerson ? 'character' : 'other',
      name: n.name,
      comment: isPerson ? ('[小说人物] ' + n.name) : ('[小说设定] ' + n.name),
      content: String(n.note || ''),
      keys: [n.name],
      strategy: 'selective',
      sourceRef: { type: 'storyNode', id: n.id, novelId: novelId },
    };
  });
}

export async function appendStoryToCardPromotionLog(draftId, summary, target) {
  return appendPromotionLog(draftId, {
    kind: 'story_to_card',
    source: { view: 'story_studio' },
    target: target || {},
    summary: summary || 'Story 同步到卡',
  });
}

/**
 * Story 图谱节点 → worldbook（§6.2.2 · D17）
 * @param {string} draftId
 * @param {string} novelId
 * @param {object} opts { ids?, policy?, getWorldbook, setWorldbook }
 */
export async function promoteStoryGraphToCard(draftId, novelId, opts) {
  var cid = String(draftId || '').trim();
  var nid = String(novelId || '').trim();
  var o = opts || {};
  if (!cid || !nid) return { ok: false, error: '缺少 draftId 或 novelId' };
  if (typeof o.getWorldbook !== 'function' || typeof o.setWorldbook !== 'function') {
    return { ok: false, error: 'worldbook 桥接未就绪' };
  }
  var novel = await loadNovel(cid, nid);
  if (!novel || !novel.graph) return { ok: false, error: 'Story 不存在或无图谱' };
  var want = Array.isArray(o.ids) && o.ids.length ? o.ids.map(String) : null;
  var nodes = (novel.graph.nodes || []).filter(function(n) {
    if (!n || !n.name) return false;
    return !want || want.indexOf(String(n.id)) >= 0;
  });
  if (!nodes.length) return { ok: false, error: '没有可同步的节点' };
  var drafts = storyNodesToWorldbookDrafts(nodes, nid);
  var cur = o.getWorldbook() || [];
  var policy = o.policy || 'merge';
  var r = applyDraftsToWorldbook(cur, drafts, policy);
  if (r.added || r.updated) {
    o.setWorldbook(r.entries);
  }
  await appendStoryToCardPromotionLog(cid, 'Story 图谱 → worldbook：' + nodes.length + ' 节点', {
    novelId: nid,
    added: r.added,
    updated: r.updated,
  });
  return { ok: true, novelId: nid, added: r.added, updated: r.updated, skipped: r.skipped };
}

export { projectionMetaForPromote };
