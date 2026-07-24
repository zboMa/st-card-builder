/**
 * 知识图谱 + 一体抽取合并：人物 / 世界书 / 图谱
 * 人物与世界书写回与人物抽取、世界书抽取模块共用的 state 字段
 */

import { normalizeCharacterProfile } from './schema.mjs';
import {
  PRIOR_CHARS_BUDGET,
  PRIOR_CHAR_NOTE,
  PRIOR_WB_REF_BUDGET,
  PRIOR_WB_REF_PER,
  PRIOR_GRAPH_BUDGET,
} from './contextBudgets.mjs';
import { createTokenBudgetAccumulator, truncateToTokens } from '../assistant/contextManager.mjs';

/** @returns {{ nodes: object[], edges: object[], updatedAt: string }} */
export function emptyKnowledgeGraph() {
  return { nodes: [], edges: [], updatedAt: '' };
}

/** 规范化别名/keys */
export function normalizeAliasList(primary, raw) {
  var name = String(primary || '').trim();
  var out = [];
  function add(t) {
    var s = String(t == null ? '' : t).trim();
    if (!s || s === name) return;
    if (out.indexOf(s) < 0) out.push(s);
  }
  if (Array.isArray(raw)) {
    raw.forEach(function(item) {
      String(item == null ? '' : item).split(/[,，、／/|;；\s]+/).forEach(add);
    });
  } else if (raw != null && String(raw).trim()) {
    String(raw).split(/[,，、／/|;；\s]+/).forEach(add);
  }
  return out;
}

/** 稳定节点 id：type:label */
export function graphNodeId(type, label) {
  return String(type || 'concept') + ':' + String(label || '').trim();
}

function isEmptyVal(v) {
  if (v == null || v === '') return true;
  if (typeof v === 'string' && (v === '（原文未提及）' || !v.trim())) return true;
  if (Array.isArray(v) && !v.length) return true;
  return false;
}

/** 深合并 profile：非空覆盖空/占位；数组去重拼接 */
export function mergeProfiles(base, incoming) {
  var a = base && typeof base === 'object' ? base : null;
  var b = incoming && typeof incoming === 'object' ? incoming : null;
  if (!a) return normalizeCharacterProfile(b || {}, (b && b['Chinese name']) || '');
  if (!b) return a;
  var out = normalizeCharacterProfile(a, a['Chinese name'] || '');
  var src = normalizeCharacterProfile(b, b['Chinese name'] || a['Chinese name'] || '');
  Object.keys(src).forEach(function(k) {
    var bv = out[k];
    var sv = src[k];
    if (isEmptyVal(sv)) return;
    if (k === 'NSFW_information' && typeof sv === 'object' && !Array.isArray(sv)) {
      out[k] = mergePlainObject(bv && typeof bv === 'object' ? bv : {}, sv);
      return;
    }
    if (typeof sv === 'object' && !Array.isArray(sv) && sv) {
      out[k] = mergePlainObject(bv && typeof bv === 'object' && !Array.isArray(bv) ? bv : {}, sv);
      return;
    }
    if (Array.isArray(sv)) {
      var baseArr = Array.isArray(bv) ? bv.slice() : [];
      sv.forEach(function(item) {
        var key = typeof item === 'string' ? item : JSON.stringify(item);
        var exists = baseArr.some(function(x) {
          return (typeof x === 'string' ? x : JSON.stringify(x)) === key;
        });
        if (!exists) baseArr.push(item);
      });
      out[k] = baseArr;
      return;
    }
    if (isEmptyVal(bv)) out[k] = sv;
    else if (typeof sv === 'string' && typeof bv === 'string' && sv.length > bv.length) out[k] = sv;
  });
  return out;
}

function mergePlainObject(base, src) {
  var out = Object.assign({}, base || {});
  Object.keys(src || {}).forEach(function(k) {
    var sv = src[k];
    var bv = out[k];
    if (isEmptyVal(sv)) return;
    if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
      out[k] = mergePlainObject(bv && typeof bv === 'object' ? bv : {}, sv);
    } else if (Array.isArray(sv)) {
      out[k] = Array.from(new Set([].concat(Array.isArray(bv) ? bv : [], sv)));
    } else if (isEmptyVal(bv) || (typeof sv === 'string' && typeof bv === 'string' && sv.length > String(bv).length)) {
      out[k] = sv;
    }
  });
  return out;
}

/** 在已有人物中按 name/aliases 查找 */
export function findCharacterMatch(characters, name, aliases) {
  var n = String(name || '').trim();
  var als = normalizeAliasList(n, aliases);
  var pool = [n].concat(als);
  for (var i = 0; i < (characters || []).length; i++) {
    var c = characters[i];
    var names = [c.name].concat(c.aliases || []);
    for (var j = 0; j < pool.length; j++) {
      if (pool[j] && names.indexOf(pool[j]) >= 0) return c;
    }
  }
  return null;
}

/**
 * 合并单个人物到 state.characters
 * @param {object[]} characters
 * @param {object} item { op?, name, aliases, identity/note, profile }
 * @param {(prefix: string) => string} uidFn
 */
export function mergeCharacterUpsert(characters, item, uidFn) {
  if (!item || !item.name) return { action: 'skip' };
  if (item.op === 'remove') {
    var idx = characters.findIndex(function(c) { return c.name === item.name; });
    if (idx >= 0) { characters.splice(idx, 1); return { action: 'remove' }; }
    return { action: 'skip' };
  }
  var name = String(item.name).trim();
  var aliases = normalizeAliasList(name, item.aliases);
  var existing = findCharacterMatch(characters, name, aliases);
  var profileIn = item.profile || item;
  // 若只有轻量字段，normalize 仍能出骨架
  var hasProfileShape = item.profile || item['Chinese name'] || item.appearance || item.NSFW_information;
  if (existing) {
    existing.aliases = Array.from(new Set((existing.aliases || []).concat(aliases)));
    if (item.identity || item.note) {
      var note = String(item.identity || item.note);
      if (!existing.note || note.length > String(existing.note).length) existing.note = note;
    }
    if (hasProfileShape) {
      existing.profile = mergeProfiles(existing.profile, profileIn);
      if (existing.profile && existing.profile['Chinese name']) {
        // 保持列表名稳定，可用档案名校正空名
      }
    }
    existing.hits = (existing.hits || 0) + 1;
    if (existing.syncStatus === 'synced') existing.syncStatus = 'dirty';
    return { action: 'merge', character: existing };
  }
  var profile = hasProfileShape ? normalizeCharacterProfile(profileIn, name) : null;
  var created = {
    id: uidFn ? uidFn('char') : ('char_' + Date.now()),
    name: name,
    aliases: aliases,
    note: item.identity || item.note || (profile ? '一体分析' : '待完善'),
    hits: 1,
    selected: false,
    profile: profile,
    syncStatus: 'unsynced',
  };
  characters.push(created);
  return { action: 'add', character: created };
}

function wbKey(e) {
  return String(e.category || 'setting') + '::' + String(e.name || '');
}

/** 合并世界书条目 */
export function mergeWorldbookUpsert(wbEntries, item) {
  if (!item || !item.name) return { action: 'skip' };
  var name = String(item.name).trim();
  if (item.op === 'remove') {
    var ri = wbEntries.findIndex(function(e) { return e.name === name; });
    if (ri >= 0) { wbEntries.splice(ri, 1); return { action: 'remove' }; }
    return { action: 'skip' };
  }
  // 合并两名：mergeInto 为主名
  if (item.op === 'merge' && item.mergeInto) {
    var primary = wbEntries.find(function(e) { return e.name === item.mergeInto; });
    var secondary = wbEntries.find(function(e) { return e.name === name; });
    if (primary && secondary && primary !== secondary) {
      primary.content = String(primary.content || '').length >= String(secondary.content || '').length
        ? primary.content
        : secondary.content;
      primary.keys = Array.from(new Set([].concat(primary.keys || [], secondary.keys || [], [name])));
      wbEntries.splice(wbEntries.indexOf(secondary), 1);
      return { action: 'merge', entry: primary };
    }
  }
  var cat = String(item.category || 'setting');
  if (cat === 'character' || cat === 'relation') return { action: 'skip' };
  var keys = normalizeAliasList(name, item.keys);
  if (!keys.length) keys = [name];
  var existing = wbEntries.find(function(e) {
    return e.name === name || wbKey(e) === cat + '::' + name;
  });
  if (!existing) {
    existing = wbEntries.find(function(e) {
      var ek = e.keys || [];
      return ek.indexOf(name) >= 0 || keys.some(function(k) { return ek.indexOf(k) >= 0 && e.name; });
    });
  }
  if (existing) {
    if (String(item.content || '').length > String(existing.content || '').length) {
      existing.content = item.content;
    }
    existing.keys = Array.from(new Set([].concat(existing.keys || [], keys)));
    if (item.layer) existing.layer = item.layer;
    if (item.category) existing.category = item.category;
    existing.comment = '[小说' + (existing.category || 'setting') + '] ' + existing.name;
    if (existing.syncStatus === 'synced') existing.syncStatus = 'dirty';
    return { action: 'merge', entry: existing };
  }
  var layer = item.layer || (cat === 'setting' || cat === 'worldview' ? 'blue' : 'green');
  var created = {
    category: cat,
    name: name,
    content: item.content || '',
    keys: keys,
    layer: layer,
    comment: '[小说' + cat + '] ' + name,
    selected: true,
    syncStatus: 'unsynced',
    strategy: (layer === 'blue' || cat === 'setting' || cat === 'worldview') ? 'constant' : 'selective',
  };
  wbEntries.push(created);
  return { action: 'add', entry: created };
}

/** 合并图谱节点/边 */
export function mergeGraphDelta(graph, delta) {
  var g = graph && typeof graph === 'object' ? graph : emptyKnowledgeGraph();
  if (!g.nodes) g.nodes = [];
  if (!g.edges) g.edges = [];
  var d = delta || {};
  (d.nodes || []).forEach(function(n) {
    if (!n) return;
    if (n.op === 'remove') {
      var idR = n.id || graphNodeId(n.type, n.label);
      g.nodes = g.nodes.filter(function(x) { return x.id !== idR; });
      g.edges = g.edges.filter(function(e) { return e.from !== idR && e.to !== idR; });
      return;
    }
    var id = n.id || graphNodeId(n.type, n.label);
    var label = String(n.label || '').trim();
    if (!label && !n.id) return;
    var found = g.nodes.find(function(x) { return x.id === id; });
    if (found) {
      found.label = label || found.label;
      found.type = n.type || found.type;
      found.attrs = Object.assign({}, found.attrs || {}, n.attrs || {});
    } else {
      g.nodes.push({
        id: id,
        type: n.type || 'concept',
        label: label || id,
        attrs: n.attrs || {},
      });
    }
  });
  (d.edges || []).forEach(function(e) {
    if (!e || !e.from || !e.to) return;
    var rel = String(e.rel || e.relation || 'related').trim();
    if (e.op === 'remove') {
      g.edges = g.edges.filter(function(x) {
        return !(x.from === e.from && x.to === e.to && x.rel === rel);
      });
      return;
    }
    var foundE = g.edges.find(function(x) {
      return x.from === e.from && x.to === e.to && x.rel === rel;
    });
    var evidence = e.evidence != null ? String(e.evidence) : '';
    if (foundE) {
      if (evidence) {
        var ev = Array.isArray(foundE.evidence) ? foundE.evidence : (foundE.evidence ? [foundE.evidence] : []);
        if (ev.indexOf(evidence) < 0) ev.push(evidence);
        foundE.evidence = ev;
      }
    } else {
      g.edges.push({
        from: e.from,
        to: e.to,
        rel: rel,
        evidence: evidence ? [evidence] : [],
      });
    }
  });
  g.updatedAt = new Date().toISOString();
  return g;
}

/** 提示词用：已有人物摘要 */
export function formatPriorCharactersRef(characters, maxTokens) {
  var list = characters || [];
  if (!list.length) return '';
  var budget = maxTokens || PRIOR_CHARS_BUDGET;
  var lines = [];
  var acc = createTokenBudgetAccumulator(budget);
  for (var i = 0; i < list.length; i++) {
    var c = list[i];
    var line = '- ' + c.name
      + ((c.aliases || []).length ? ' aliases=' + c.aliases.join('/') : '')
      + (c.note ? ' · ' + truncateToTokens(String(c.note), PRIOR_CHAR_NOTE) : '')
      + (c.profile ? ' [已有完整档案]' : '');
    if (!acc.tryAdd(line)) {
      lines.push('- …另有 ' + (list.length - i) + ' 人已省略');
      break;
    }
    lines.push(line);
  }
  return '\n【已有人物（可 upsert 合并/补全；勿无空壳重复）】\n' + lines.join('\n');
}

/** 提示词用：已有世界书摘要 */
export function formatPriorWorldbookRef(wbEntries, maxTokens) {
  var list = wbEntries || [];
  if (!list.length) return '';
  var budget = maxTokens || PRIOR_WB_REF_BUDGET;
  var lines = [];
  var acc = createTokenBudgetAccumulator(budget);
  for (var i = 0; i < list.length; i++) {
    var e = list[i];
    var line = '- [' + (e.category || 'setting') + '] ' + e.name
      + ((e.keys || []).length ? ' keys=' + (e.keys || []).slice(0, 4).join('/') : '')
      + ': ' + truncateToTokens(String(e.content || ''), PRIOR_WB_REF_PER);
    if (!acc.tryAdd(line)) {
      lines.push('- …另有 ' + (list.length - i) + ' 条已省略');
      break;
    }
    lines.push(line);
  }
  return '\n【已有世界书（可 upsert/merge；勿同名空壳）】\n' + lines.join('\n');
}

/** 提示词用：图谱摘要 */
export function formatPriorGraphRef(graph, maxTokens) {
  var g = graph || emptyKnowledgeGraph();
  var nodes = g.nodes || [];
  var edges = g.edges || [];
  if (!nodes.length && !edges.length) return '';
  var budget = maxTokens || PRIOR_GRAPH_BUDGET;
  var lines = ['节点 ' + nodes.length + ' · 边 ' + edges.length];
  var acc = createTokenBudgetAccumulator(budget);
  acc.tryAdd(lines[0]);
  var nodeCap = Math.floor(budget * 0.55);
  var nodeAcc = createTokenBudgetAccumulator(nodeCap);
  nodeAcc.tryAdd(lines[0]);
  nodes.slice(0, 80).forEach(function(n) {
    var line = 'N ' + n.id + ' (' + n.type + ') ' + n.label;
    if (!nodeAcc.tryAdd(line)) return;
    if (!acc.tryAdd(line)) return;
    lines.push(line);
  });
  edges.slice(0, 100).forEach(function(e) {
    var line = 'E ' + e.from + ' -[' + e.rel + ']-> ' + e.to;
    if (!acc.tryAdd(line)) return;
    lines.push(line);
  });
  return '\n【已有知识图谱（更新节点 attrs / 补边 evidence；id 稳定复用）】\n' + lines.join('\n');
}

/**
 * 应用一片一体抽取结果
 * @returns {{ charStats, wbStats, graph }}
 */
export function applyUnifiedShardResult(state, parsed, uidFn) {
  var charStats = { add: 0, merge: 0, remove: 0 };
  var wbStats = { add: 0, merge: 0, remove: 0 };
  (parsed.characters || []).forEach(function(item) {
    var r = mergeCharacterUpsert(state.characters, item, uidFn);
    if (r.action === 'add') charStats.add++;
    else if (r.action === 'merge') charStats.merge++;
    else if (r.action === 'remove') charStats.remove++;
  });
  (parsed.worldbook || parsed.entries || []).forEach(function(item) {
    var r = mergeWorldbookUpsert(state.wbEntries, item);
    if (r.action === 'add') wbStats.add++;
    else if (r.action === 'merge') wbStats.merge++;
    else if (r.action === 'remove') wbStats.remove++;
  });
  state.knowledgeGraph = mergeGraphDelta(state.knowledgeGraph || emptyKnowledgeGraph(), parsed.graph || {});
  return { charStats: charStats, wbStats: wbStats, graph: state.knowledgeGraph };
}
