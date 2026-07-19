/**
 * 统一小说分析：骨架扫描 / 实体丰满 / 关系补全（纯逻辑，AI 调用由 browserApp 注入）
 */
import {
  upsertEntity,
  upsertRelation,
  resolveEntityId,
  formatPriorEntitiesRef,
  isEntityEnriched,
  projectEntitiesToLegacy,
} from './entityStore.mjs';
import {
  normalizeNsfwEntityAttrs,
  normalizeAdultAttrs,
  normalizeNtlPersonAttrs,
  adultEnrichPriority,
  getAdultMode,
} from './nsfwSupport.mjs';

/**
 * 应用骨架扫描 JSON
 * @returns {{ add: number, merge: number, relAdd: number }}
 */
export function applySkeletonResult(state, parsed) {
  if (!state.entities) state.entities = [];
  if (!state.relations) state.relations = [];
  var stats = { add: 0, merge: 0, relAdd: 0 };
  (parsed.entities || parsed.characters || []).forEach(function(raw) {
    // 兼容旧 characters 形状
    var item = raw;
    if (raw && !raw.type && raw.name) {
      item = {
        type: 'person',
        name: raw.name,
        aliases: raw.aliases,
        summary: raw.note || raw.identity || raw.summary || '',
        keys: raw.keys,
        op: raw.op,
      };
    }
    var r = upsertEntity(state.entities, item, { source: 'analyze' });
    if (r.action === 'add') stats.add++;
    else if (r.action === 'merge') stats.merge++;
  });
  // 世界书形状兼容
  (parsed.worldbook || parsed.entries || []).forEach(function(w) {
    if (!w || !w.name) return;
    var type = 'lore';
    var cat = w.category || 'setting';
    if (cat === 'faction') type = 'faction';
    else if (cat === 'location') type = 'location';
    else if (cat === 'item') type = 'item';
    else if (cat === 'event') type = 'event';
    else if (cat === 'nsfw') type = 'nsfw';
    var attrsWb = Object.assign({}, w.attrs || {});
    if (type === 'lore' && !attrsWb.aspect) attrsWb.aspect = cat;
    if (type === 'nsfw') {
      attrsWb = normalizeNsfwEntityAttrs(Object.assign({}, attrsWb, { kind: attrsWb.kind || 'rule' }));
    } else if (attrsWb.adult) {
      attrsWb.adult = normalizeAdultAttrs(attrsWb.adult);
    }
    var r = upsertEntity(state.entities, {
      type: type,
      name: w.name,
      content: w.content,
      keys: w.keys,
      summary: String(w.content || '').slice(0, 80),
      attrs: attrsWb,
      layer: w.layer,
      op: w.op,
    }, { source: 'analyze' });
    if (r.action === 'add') stats.add++;
    else if (r.action === 'merge') stats.merge++;
  });
  (parsed.relations || (parsed.graph && parsed.graph.edges) || []).forEach(function(edge) {
    var fromId = resolveEntityId(state.entities, edge.from || edge.fromId || edge.source);
    var toId = resolveEntityId(state.entities, edge.to || edge.toId || edge.target);
    if (!fromId || !toId) return;
    var r = upsertRelation(state.relations, {
      fromId: fromId,
      toId: toId,
      from: fromId,
      to: toId,
      rel: edge.rel || edge.relation,
      evidence: edge.evidence,
      attrs: edge.attrs,
      op: edge.op,
    });
    if (r.action === 'add') stats.relAdd++;
  });
  // 图谱节点兼容
  ((parsed.graph && parsed.graph.nodes) || []).forEach(function(n) {
    if (!n) return;
    var r = upsertEntity(state.entities, {
      type: n.type || 'lore',
      name: n.label || n.name,
      aliases: n.aliases,
      summary: (n.attrs && n.attrs.summary) || '',
      attrs: n.attrs || {},
      op: n.op,
    }, { source: 'analyze' });
    if (r.action === 'add') stats.add++;
    else if (r.action === 'merge') stats.merge++;
  });
  projectEntitiesToLegacy(state);
  return stats;
}

/**
 * 应用单实体丰满结果
 */
export function applyEnrichResult(state, entityId, parsed) {
  var ent = (state.entities || []).find(function(e) { return e.id === entityId; });
  if (!ent) return null;
  var raw = parsed.entity || parsed;
  upsertEntity(state.entities, {
    type: ent.type,
    name: raw.name || ent.name,
    aliases: raw.aliases || ent.aliases,
    summary: raw.summary,
    content: raw.content,
    keys: raw.keys,
    attrs: raw.attrs || (raw.profile ? { profile: raw.profile } : {}),
    profile: raw.profile,
    provenance: raw.provenance,
    layer: raw.layer,
    confidence: raw.confidence,
  }, { source: 'analyze' });
  var updated = (state.entities || []).find(function(e) { return e.id === entityId || e.name === ent.name; });
  if (updated) {
    var adult = getAdultMode(state);
    var ntl = !!(state && state.ntlMode);
    if (adult) {
      if (!updated.attrs) updated.attrs = {};
      if (updated.type === 'person') {
        updated.attrs.nsfwMeta = Object.assign({}, updated.attrs.nsfwMeta || {}, { lastPass: 'enrich' });
      }
      if (updated.attrs.adult) {
        updated.attrs.adult = Object.assign({}, updated.attrs.adult, { lastPass: 'enrich' });
      }
    }
    if (ntl && updated.type === 'person') {
      if (!updated.attrs) updated.attrs = {};
      var ntlAttrs = normalizeNtlPersonAttrs(updated.attrs.ntl);
      ntlAttrs.lastPass = 'enrich';
      updated.attrs.ntl = ntlAttrs;
    }
    updated.needsReview = !isEntityEnriched(updated, true, adult);
  }
  projectEntitiesToLegacy(state);
  return updated;
}

/** 待丰满实体列表（成人/NTL 开时优先排缺口） */
export function listEntitiesNeedingEnrich(entities, strict, adultMode, ntlMode) {
  var list = (entities || []).filter(function(e) {
    return !isEntityEnriched(e, !!strict, !!adultMode);
  });
  if (!adultMode && !ntlMode) return list;
  return list.slice().sort(function(a, b) {
    return adultEnrichPriority(a, ntlMode) - adultEnrichPriority(b, ntlMode);
  });
}

/** 关系 prior（供骨架/关系步注入，吸收旧一体分析图谱摘要） */
export function formatPriorRelationsRef(relations, entities, maxChars) {
  var list = relations || [];
  if (!list.length) return '\n【已有关系】无';
  var idToName = {};
  (entities || []).forEach(function(e) {
    if (e && e.id) idToName[e.id] = e.name;
  });
  var budget = maxChars || 2500;
  var lines = ['【已有关系（可补 evidence / 更精确 rel；勿无意义重复）】共 ' + list.length];
  var used = lines[0].length;
  list.slice(0, 120).forEach(function(r) {
    if (!r) return;
    var from = idToName[r.fromId] || r.from || r.fromId || '?';
    var to = idToName[r.toId] || r.to || r.toId || '?';
    var ev = Array.isArray(r.evidence) && r.evidence[0] ? ' | ' + String(r.evidence[0]).slice(0, 40) : '';
    var line = '- ' + from + ' -[' + (r.rel || 'related') + ']-> ' + to + ev;
    if (used + line.length > budget) return;
    lines.push(line);
    used += line.length;
  });
  return '\n' + lines.join('\n');
}

/** 骨架提示用的 prior 块 */
export function buildSkeletonPriorBlock(state) {
  return formatPriorEntitiesRef(state.entities || [], 5000)
    + formatPriorRelationsRef(state.relations, state.entities, 2500);
}

export { projectEntitiesToLegacy, isEntityEnriched };
