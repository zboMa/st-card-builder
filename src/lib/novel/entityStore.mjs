/**
 * 小说实体库：CRUD、别名匹配、投影到 characters / wbEntries / knowledgeGraph
 */
import { normalizeCharacterProfile, profileContentDigest } from './schema.mjs';
import { emptyKnowledgeGraph, graphNodeId } from './graphMerge.mjs';
import {
  isNsfwProfileFilled,
  isNsfwEntityFilled,
  normalizeNsfwEntityAttrs,
  normalizeAdultAttrs,
  mergeAdultAttrs,
  isAdultAttrsFilled,
  entityNeedsAdultAttrs,
  normalizeNsfwMeta,
  mergeNsfwMeta,
  formatAdultAttrsForContent,
} from './nsfwSupport.mjs';

export var ENTITY_TYPES = ['person', 'faction', 'location', 'item', 'event', 'lore', 'nsfw'];

/** entity.type → 世界书 category */
export var TYPE_TO_WB_CATEGORY = {
  faction: 'faction',
  location: 'location',
  item: 'item',
  event: 'event',
  lore: 'setting',
  nsfw: 'nsfw',
  person: 'character',
};

export function uid(prefix) {
  return (prefix || 'ent') + '_' + Math.random().toString(36).slice(2, 10);
}

function normName(s) {
  return String(s || '').trim().toLowerCase();
}

/** @returns {string[]} */
export function normalizeAliases(primary, raw) {
  var name = String(primary || '').trim();
  var out = [];
  function add(t) {
    var s = String(t == null ? '' : t).trim();
    if (!s || s === name) return;
    if (out.indexOf(s) < 0) out.push(s);
  }
  if (Array.isArray(raw)) raw.forEach(function(x) {
    String(x == null ? '' : x).split(/[,，、／/|;；\s]+/).forEach(add);
  });
  else if (raw != null && String(raw).trim()) String(raw).split(/[,，、／/|;；\s]+/).forEach(add);
  return out;
}

/** @returns {object} */
export function emptyEntity(type, name) {
  return {
    id: uid('ent'),
    type: ENTITY_TYPES.indexOf(type) >= 0 ? type : 'lore',
    name: String(name || '').trim() || '未命名',
    aliases: [],
    summary: '',
    content: '',
    keys: [],
    attrs: {},
    layer: 'green',
    confidence: 0.5,
    provenance: [],
    syncStatus: 'unsynced',
    selected: true,
    updatedAt: new Date().toISOString(),
    source: 'analyze',
    needsReview: false,
  };
}

/**
 * 是否视为已丰满
 * @param {object} ent
 * @param {boolean} [strict]
 * @param {boolean} [adultMode] 成人开时额外校验 NSFW 字段
 */
export function isEntityEnriched(ent, strict, adultMode) {
  if (!ent) return false;
  var content = String(ent.content || '').trim();
  var prov = Array.isArray(ent.provenance) ? ent.provenance : [];
  var minLen = strict ? 120 : 80;
  if (content.length < minLen) return false;
  if (strict && !prov.length) return false;
  if (ent.type === 'event') {
    var a = ent.attrs || {};
    if (!a.when || !a.where || !a.participants) return false;
    if (!a.cause && !a.effect) return false;
  }
  if (ent.type === 'person') {
    if (!ent.attrs || !ent.attrs.profile) return content.length >= 120;
    if (adultMode && !isNsfwProfileFilled(ent.attrs.profile)) return false;
  }
  if (ent.type === 'nsfw') {
    if (adultMode || strict) {
      if (!isNsfwEntityFilled(ent)) return false;
    }
  }
  // 成人开：物品/地点/设定/势力须有可用的成人向用法
  if (adultMode && entityNeedsAdultAttrs(ent)) {
    if (!isAdultAttrsFilled(ent.attrs && ent.attrs.adult)) return false;
  }
  return true;
}

/** 规范化实体 attrs 中的成人相关字段 */
function normalizeEntityAdultFields(type, attrs) {
  var a = attrs && typeof attrs === 'object' ? Object.assign({}, attrs) : {};
  if (type === 'nsfw') return normalizeNsfwEntityAttrs(a);
  if (entityNeedsAdultAttrs({ type: type })) {
    if (a.adult) a.adult = normalizeAdultAttrs(a.adult);
  }
  if (type === 'person' && a.nsfwMeta) {
    a.nsfwMeta = normalizeNsfwMeta(a.nsfwMeta);
  }
  return a;
}

/**
 * 名/别名精确匹配（大小写不敏感）
 * @returns {object|null}
 */
export function findEntityMatch(entities, name, aliases) {
  var primary = normName(name);
  if (!primary) return null;
  var aliasSet = {};
  aliasSet[primary] = true;
  normalizeAliases(name, aliases).forEach(function(a) { aliasSet[normName(a)] = true; });

  var list = entities || [];
  for (var i = 0; i < list.length; i++) {
    var e = list[i];
    if (!e) continue;
    if (aliasSet[normName(e.name)]) return e;
    var ea = e.aliases || [];
    for (var j = 0; j < ea.length; j++) {
      if (aliasSet[normName(ea[j])]) return e;
    }
  }
  return null;
}

function mergeLonger(a, b) {
  var sa = String(a || '');
  var sb = String(b || '');
  if (!sa) return sb;
  if (!sb) return sa;
  return sb.length > sa.length ? sb : sa;
}

function mergeProvenance(a, b) {
  var out = Array.isArray(a) ? a.slice() : [];
  var seen = {};
  out.forEach(function(p) {
    seen[(p.chapterId || '') + ':' + (p.quote || '').slice(0, 40)] = true;
  });
  (b || []).forEach(function(p) {
    if (!p) return;
    var k = (p.chapterId || '') + ':' + String(p.quote || '').slice(0, 40);
    if (seen[k]) return;
    seen[k] = true;
    out.push(p);
  });
  return out.slice(0, 40);
}

/**
 * upsert 实体；返回 { entity, action: 'add'|'merge' }
 */
export function upsertEntity(entities, raw, opts) {
  opts = opts || {};
  var list = entities || [];
  var type = raw.type || 'lore';
  var name = String(raw.name || '').trim();
  if (!name) return { entity: null, action: 'skip' };
  if (raw.op === 'remove') {
    var hitR = findEntityMatch(list, name, raw.aliases);
    if (!hitR) return { entity: null, action: 'skip' };
    var idx = list.indexOf(hitR);
    if (idx >= 0) list.splice(idx, 1);
    return { entity: hitR, action: 'remove' };
  }

  var found = findEntityMatch(list, name, raw.aliases);
  if (!found) {
    var created = emptyEntity(type, name);
    created.aliases = normalizeAliases(name, raw.aliases);
    created.summary = String(raw.summary || '').trim();
    created.content = String(raw.content || '').trim();
    created.keys = Array.isArray(raw.keys) ? raw.keys.map(String).filter(Boolean) : [];
    created.attrs = normalizeEntityAdultFields(
      type,
      raw.attrs && typeof raw.attrs === 'object' ? Object.assign({}, raw.attrs) : {}
    );
    if (type === 'person' && (raw.profile || (raw.attrs && raw.attrs.profile))) {
      created.attrs.profile = normalizeCharacterProfile(raw.profile || raw.attrs.profile, name);
    }
    if (type === 'nsfw') {
      created.attrs = normalizeNsfwEntityAttrs(created.attrs);
    }
    if (type === 'event' && created.attrs) {
      if (raw.attrs && (raw.attrs.intimate === true || raw.attrs.kind === 'intimate')) {
        created.attrs.intimate = true;
        created.attrs.kind = created.attrs.kind || 'intimate';
      }
    }
    created.provenance = Array.isArray(raw.provenance) ? raw.provenance : [];
    created.layer = raw.layer === 'blue' ? 'blue' : 'green';
    created.source = opts.source || raw.source || 'analyze';
    created.confidence = typeof raw.confidence === 'number' ? raw.confidence : 0.5;
    list.push(created);
    return { entity: created, action: 'add' };
  }

  found.type = type || found.type;
  found.aliases = normalizeAliases(found.name, (found.aliases || []).concat(raw.aliases || []));
  // 主名：保留较短常用称呼；若新名是旧别名则不改主名
  if (name && name !== found.name && found.aliases.indexOf(found.name) < 0) {
    // 新名更短或旧名空时采用
    if (!found.name || name.length < found.name.length) {
      if (found.name) found.aliases = normalizeAliases(name, found.aliases.concat([found.name]));
      found.name = name;
    } else {
      found.aliases = normalizeAliases(found.name, found.aliases.concat([name]));
    }
  }
  found.summary = mergeLonger(found.summary, raw.summary);
  // 有 provenance 的新内容优先，否则取更长
  if (raw.content) {
    if (Array.isArray(raw.provenance) && raw.provenance.length) found.content = String(raw.content);
    else found.content = mergeLonger(found.content, raw.content);
  }
  if (Array.isArray(raw.keys) && raw.keys.length) {
    var keys = (found.keys || []).slice();
    raw.keys.forEach(function(k) {
      var s = String(k || '').trim();
      if (s && keys.indexOf(s) < 0) keys.push(s);
    });
    found.keys = keys;
  }
  var prevAdult = found.attrs && found.attrs.adult;
  var prevMeta = found.attrs && found.attrs.nsfwMeta;
  found.attrs = Object.assign({}, found.attrs || {}, raw.attrs || {});
  // 成人维/推断元数据深合并，避免浅合并抹掉 Limits
  if ((raw.attrs && raw.attrs.adult) || prevAdult) {
    found.attrs.adult = mergeAdultAttrs(prevAdult, (raw.attrs && raw.attrs.adult) || prevAdult);
  }
  if (found.type === 'person' && ((raw.attrs && raw.attrs.nsfwMeta) || prevMeta)) {
    found.attrs.nsfwMeta = mergeNsfwMeta(prevMeta, (raw.attrs && raw.attrs.nsfwMeta) || prevMeta);
  }
  if (found.type === 'person' && (raw.profile || (raw.attrs && raw.attrs.profile))) {
    var prev = (found.attrs && found.attrs.profile) || {};
    var next = normalizeCharacterProfile(raw.profile || raw.attrs.profile, found.name);
    found.attrs.profile = Object.assign({}, prev, next);
  }
  if (found.type === 'nsfw') {
    found.attrs = normalizeNsfwEntityAttrs(found.attrs);
  }
  if (found.type === 'event' && raw.attrs && (raw.attrs.intimate === true || raw.attrs.kind === 'intimate')) {
    found.attrs.intimate = true;
    found.attrs.kind = found.attrs.kind || 'intimate';
  }
  found.provenance = mergeProvenance(found.provenance, raw.provenance);
  found.updatedAt = new Date().toISOString();
  found.syncStatus = found.syncStatus === 'synced' ? 'dirty' : (found.syncStatus || 'unsynced');
  if (opts.source) found.source = opts.source;
  return { entity: found, action: 'merge' };
}

/** upsert 关系 */
export function upsertRelation(relations, raw, idMap) {
  var list = relations || [];
  if (!raw || !raw.from || !raw.to) return { relation: null, action: 'skip' };
  var fromId = (idMap && idMap[raw.from]) || raw.fromId || raw.from;
  var toId = (idMap && idMap[raw.to]) || raw.toId || raw.to;
  // 允许用名称：调用方应先解析为 id
  var rel = String(raw.rel || raw.relation || 'related').trim() || 'related';
  if (raw.op === 'remove') {
    for (var i = list.length - 1; i >= 0; i--) {
      if (list[i].fromId === fromId && list[i].toId === toId && list[i].rel === rel) list.splice(i, 1);
    }
    return { relation: null, action: 'remove' };
  }
  var found = list.find(function(r) {
    return r.fromId === fromId && r.toId === toId && r.rel === rel;
  });
  var evidence = [];
  if (Array.isArray(raw.evidence)) evidence = raw.evidence.map(String);
  else if (raw.evidence) evidence = [String(raw.evidence)];
  var attrsIn = raw.attrs && typeof raw.attrs === 'object' ? raw.attrs : null;
  if (found) {
    var ev = Array.isArray(found.evidence) ? found.evidence.slice() : [];
    evidence.forEach(function(e) { if (e && ev.indexOf(e) < 0) ev.push(e); });
    found.evidence = ev.slice(0, 20);
    if (attrsIn) found.attrs = Object.assign({}, found.attrs || {}, attrsIn);
    found.updatedAt = new Date().toISOString();
    return { relation: found, action: 'merge' };
  }
  var created = {
    id: uid('rel'),
    fromId: fromId,
    toId: toId,
    rel: rel,
    evidence: evidence,
    attrs: attrsIn ? Object.assign({}, attrsIn) : {},
    updatedAt: new Date().toISOString(),
  };
  list.push(created);
  return { relation: created, action: 'add' };
}

/** 按名称解析实体 id（用于关系） */
export function resolveEntityId(entities, nameOrId) {
  var s = String(nameOrId || '').trim();
  if (!s) return '';
  var byId = (entities || []).find(function(e) { return e.id === s; });
  if (byId) return byId.id;
  var byName = findEntityMatch(entities, s, []);
  return byName ? byName.id : '';
}

/**
 * 从实体库投影 characters / wbEntries / knowledgeGraph
 * @param {object} state
 */
export function projectEntitiesToLegacy(state) {
  var entities = state.entities || [];
  var relations = state.relations || [];

  // 人物
  var prevChars = {};
  (state.characters || []).forEach(function(c) { if (c && c.id) prevChars[c.id] = c; });
  state.characters = entities.filter(function(e) { return e.type === 'person'; }).map(function(e) {
    var prev = prevChars[e.id] || (state.characters || []).find(function(c) {
      return c && (c.name === e.name || (c.aliases || []).indexOf(e.name) >= 0);
    });
    return {
      id: (prev && prev.id) || e.id,
      name: e.name,
      aliases: (e.aliases || []).slice(),
      note: e.summary || (prev && prev.note) || '',
      hits: (prev && prev.hits) || 0,
      profile: (e.attrs && e.attrs.profile) || (prev && prev.profile) || null,
      selected: e.selected !== false,
      syncStatus: e.syncStatus || 'unsynced',
    };
  });

  // 世界书：非 person
  var prevWb = {};
  (state.wbEntries || []).forEach(function(w) {
    if (w) prevWb[(w.category || '') + '::' + w.name] = w;
  });
  state.wbEntries = entities.filter(function(e) { return e.type !== 'person'; }).map(function(e) {
    var cat = TYPE_TO_WB_CATEGORY[e.type] || 'setting';
    if (e.type === 'lore' && e.attrs && e.attrs.aspect) {
      var aspect = e.attrs.aspect;
      if (['worldview', 'setting', 'history'].indexOf(aspect) >= 0) cat = aspect;
    }
    var key = cat + '::' + e.name;
    var prev = prevWb[key];
    var body = e.content || e.summary || '';
    // 投影时附带成人向段落，便于列表预览与旧路径同步
    if (e.attrs && e.attrs.adult) {
      var adultBlock = formatAdultAttrsForContent(e.attrs.adult);
      if (adultBlock && body.indexOf('【成人向用法】') < 0) {
        body = String(body || '').replace(/\s+$/, '') + (body ? '\n\n' : '') + adultBlock;
      }
    }
    return {
      id: e.id,
      category: cat,
      name: e.name,
      content: body,
      keys: (e.keys && e.keys.length) ? e.keys.slice() : [e.name].concat(e.aliases || []).slice(0, 6),
      layer: e.layer || 'green',
      comment: '[小说' + cat + '] ' + e.name,
      strategy: e.layer === 'blue' ? 'constant' : 'selective',
      selected: e.selected !== false,
      syncStatus: e.syncStatus || 'unsynced',
      enabled: prev && prev.enabled === false ? false : true,
      attrs: e.attrs ? Object.assign({}, e.attrs) : undefined,
    };
  });

  // 图谱
  var g = emptyKnowledgeGraph();
  entities.forEach(function(e) {
    g.nodes.push({
      id: e.id || graphNodeId(e.type, e.name),
      type: e.type === 'lore' ? 'concept' : e.type,
      label: e.name,
      attrs: { summary: e.summary || '' },
    });
  });
  var idSet = {};
  g.nodes.forEach(function(n) { idSet[n.id] = true; });
  relations.forEach(function(r) {
    if (!r || !idSet[r.fromId] || !idSet[r.toId]) return;
    g.edges.push({
      from: r.fromId,
      to: r.toId,
      rel: r.rel,
      evidence: r.evidence || [],
    });
  });
  g.updatedAt = new Date().toISOString();
  state.knowledgeGraph = g;
  return state;
}

/** 从旧 characters / wbEntries 迁入实体（增量） */
export function ingestLegacyIntoEntities(state, source) {
  if (!state.entities) state.entities = [];
  if (!state.relations) state.relations = [];
  (state.characters || []).forEach(function(c) {
    if (!c || !c.name) return;
    upsertEntity(state.entities, {
      type: 'person',
      name: c.name,
      aliases: c.aliases,
      summary: c.note || '',
      content: c.profile ? profileContentDigest(c.profile, c.name) : (c.note || ''),
      attrs: c.profile ? { profile: c.profile } : {},
      keys: [c.name].concat(c.aliases || []).slice(0, 6),
    }, { source: source || 'legacy_scan' });
    var ent = findEntityMatch(state.entities, c.name, c.aliases);
    if (ent && c.profile) {
      ent.attrs.profile = c.profile;
      if (!ent.content || ent.content.length < 80) {
        ent.content = profileContentDigest(c.profile, c.name);
      }
    }
  });
  (state.wbEntries || []).forEach(function(w) {
    if (!w || !w.name) return;
    var cat = w.category || 'setting';
    var type = 'lore';
    if (cat === 'faction') type = 'faction';
    else if (cat === 'location') type = 'location';
    else if (cat === 'item') type = 'item';
    else if (cat === 'event') type = 'event';
    else if (cat === 'nsfw') type = 'nsfw';
    else type = 'lore';
    var attrsIn = Object.assign({}, w.attrs || {});
    if (type === 'lore' && !attrsIn.aspect) attrsIn.aspect = cat;
    if (type === 'nsfw') attrsIn = normalizeNsfwEntityAttrs(attrsIn);
    else if (attrsIn.adult) attrsIn.adult = normalizeAdultAttrs(attrsIn.adult);
    upsertEntity(state.entities, {
      type: type,
      name: w.name,
      content: w.content,
      keys: w.keys,
      summary: String(w.content || '').slice(0, 80),
      attrs: attrsIn,
      layer: w.layer || (w.strategy === 'constant' ? 'blue' : 'green'),
    }, { source: source || 'legacy_wb' });
  });
  return state;
}

/** 实体计数摘要 */
export function countEntitiesByType(entities) {
  var counts = {};
  ENTITY_TYPES.forEach(function(t) { counts[t] = 0; });
  (entities || []).forEach(function(e) {
    if (e && counts[e.type] != null) counts[e.type]++;
    else if (e) counts.lore = (counts.lore || 0) + 1;
  });
  return counts;
}

/** 格式化已有实体参考（分析提示用） */
export function formatPriorEntitiesRef(entities, maxChars) {
  var budget = maxChars || 6000;
  var lines = ['【已有实体（同名/别名须合并 upsert，勿重复空壳）】'];
  var used = lines[0].length;
  (entities || []).slice(0, 200).forEach(function(e) {
    var line = '- [' + e.type + '] ' + e.name
      + (e.aliases && e.aliases.length ? ' aka ' + e.aliases.slice(0, 4).join('/') : '')
      + (e.summary ? ' | ' + String(e.summary).slice(0, 60) : '');
    if (used + line.length > budget) return;
    lines.push(line);
    used += line.length;
  });
  return '\n' + lines.join('\n');
}
