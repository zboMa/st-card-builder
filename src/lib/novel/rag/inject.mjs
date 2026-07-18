/**
 * 助手 / 分析用：把检索结果与实体摘要拼成注入块
 */

/**
 * @param {{ body?: string, snippets?: object[], mode?: string }} searchResult
 * @param {object[]} [entities]
 * @param {{ entityBudget?: number }} [opts]
 */
export function buildRagInjectBlock(searchResult, entities, opts) {
  opts = opts || {};
  var parts = [];
  var body = searchResult && searchResult.body ? String(searchResult.body) : '';
  if (body.trim()) {
    parts.push('【相关小说原文】（检索模式: ' + (searchResult.mode || 'keyword') + '）\n' + body);
  } else {
    parts.push('【相关小说原文】未命中相关片段。若问题依赖原文，请说明未检索到。');
  }

  var entBudget = opts.entityBudget != null ? opts.entityBudget : 3000;
  var lines = [];
  var used = 0;
  (entities || []).forEach(function(e) {
    if (!e || used >= entBudget) return;
    var line = '- [' + (e.type || '?') + '] ' + (e.name || '')
      + (e.aliases && e.aliases.length ? '（' + e.aliases.slice(0, 3).join('/') + '）' : '')
      + ': ' + String(e.summary || e.content || '').slice(0, 160);
    if (used + line.length > entBudget) return;
    lines.push(line);
    used += line.length;
  });
  if (lines.length) {
    parts.push('【相关实体】\n' + lines.join('\n'));
  }
  parts.push('【使用规则】优先依据原文与实体事实；无命中须说明；修改知识库请用 patch/merge 工具，勿臆造重大剧情。');
  return parts.join('\n\n');
}

/** @param {object[]} entities */
export function entityByIdMap(entities) {
  var map = {};
  (entities || []).forEach(function(e) {
    if (e && e.id) map[e.id] = e;
  });
  return map;
}

/**
 * 从种子实体沿 relations 扩展 1-hop 邻居（知识图谱增强）。
 * @param {object[]} seedEntities
 * @param {object[]} allEntities
 * @param {object[]} relations
 * @param {number} [limit]
 */
export function expandEntitiesViaRelations(seedEntities, allEntities, relations, limit) {
  var lim = Math.max(1, Math.min(30, limit || 12));
  var byId = entityByIdMap(allEntities);
  var seen = {};
  var out = [];
  function add(e) {
    if (!e || !e.id || seen[e.id]) return;
    seen[e.id] = true;
    out.push(e);
  }
  (seedEntities || []).forEach(add);
  (relations || []).forEach(function(r) {
    if (!r) return;
    (seedEntities || []).forEach(function(seed) {
      if (!seed || !seed.id) return;
      if (r.fromId === seed.id && byId[r.toId]) add(byId[r.toId]);
      if (r.toId === seed.id && byId[r.fromId]) add(byId[r.fromId]);
    });
  });
  return out.slice(0, lim);
}

/**
 * 为 RAG 注入生成关系上下文行（仅含与命中实体相连的边）。
 * @param {object[]} relatedEntities
 * @param {object[]} relations
 * @param {object[]} allEntities
 */
export function formatRelationContextLines(relatedEntities, relations, allEntities) {
  var byId = entityByIdMap(allEntities);
  var seedIds = {};
  (relatedEntities || []).forEach(function(e) { if (e && e.id) seedIds[e.id] = true; });
  var lines = [];
  (relations || []).forEach(function(r) {
    if (!r || !r.rel) return;
    if (!seedIds[r.fromId] && !seedIds[r.toId]) return;
    var from = byId[r.fromId];
    var to = byId[r.toId];
    if (!from || !to) return;
    var line = '- ' + (from.name || r.fromId) + ' —[' + r.rel + ']→ ' + (to.name || r.toId);
    if (r.evidence && r.evidence.length) {
      line += '（' + String(r.evidence[0]).slice(0, 40) + '）';
    }
    if (lines.indexOf(line) < 0) lines.push(line);
  });
  return lines.slice(0, 8);
}

import { extractQueryTerms } from './keywordSearch.mjs';

/** 按名称/别名/摘要子串打分，可选 relations 扩展图谱邻居 */
export function pickRelatedEntities(entities, query, limit, opts) {
  if (limit && typeof limit === 'object' && !Array.isArray(limit)) {
    opts = limit;
    limit = opts.limit;
  }
  opts = opts || {};
  var q = String(query || '').toLowerCase();
  var lim = Math.max(1, Math.min(30, limit != null ? limit : (opts.limit || 12)));
  var fallback = opts.fallback != null ? opts.fallback : 6;
  if (!q) {
    var base = (entities || []).slice(0, lim);
    if (opts.relations && opts.relations.length) {
      return expandEntitiesViaRelations(base, entities, opts.relations, lim);
    }
    return base;
  }
  var queryTerms = extractQueryTerms(query).map(function(t) { return t.toLowerCase(); });
  var scored = [];
  (entities || []).forEach(function(e) {
    if (!e) return;
    var name = String(e.name || '').toLowerCase();
    var blob = (name + ' ' + (e.aliases || []).join(' ') + ' ' + (e.summary || '') + ' ' + (e.content || '')).toLowerCase();
    var score = 0;
    if (blob.indexOf(q) >= 0) score += 5;
    if (name.length >= 2 && q.indexOf(name) >= 0) score += 4;
    (e.aliases || []).forEach(function(a) {
      var al = String(a || '').toLowerCase();
      if (al.length >= 2 && q.indexOf(al) >= 0) score += 3;
    });
    queryTerms.forEach(function(t) {
      if (t.length >= 2 && blob.indexOf(t) >= 0) score += 2;
    });
    if (score > 0) scored.push({ e: e, score: score });
  });
  scored.sort(function(a, b) { return b.score - a.score; });
  var seeds = scored.length
    ? scored.slice(0, lim).map(function(x) { return x.e; })
    : (entities || []).slice(0, Math.min(lim, fallback));
  if (opts.relations && opts.relations.length) {
    return expandEntitiesViaRelations(seeds, entities, opts.relations, lim);
  }
  return seeds;
}
