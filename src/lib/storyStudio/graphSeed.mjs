/**
 * 从世界书 / 角色种子生成可编辑图谱节点
 * 标题与类型须读 Entry V2（displayName / kind），不依赖 legacy comment。
 */

import { genStoryId } from './state.mjs';
import {
  entryDisplayLabel,
  entryExportComment,
  isMvuSystemEntry,
  isAdultDigestEntry,
  outlineTypeFromKind,
  normalizeOutlineType,
} from '../worldbook/worldbookEntryBridge.mjs';

function clip(s, n) {
  var t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  return t.slice(0, n) + '…';
}

function guessType(label, content) {
  var c = String(label || '');
  var body = String(content || '');
  if (/^\[人物\]|^\[(?:宗主|师妹|天骄|酒馆|小说)?人物\]|人物|角色|NPC|protagonist/i.test(c)
    || /人物档案|角色设定/.test(body.slice(0, 80))) {
    return 'character';
  }
  if (/^地理:|地点|场所|城市|村庄|王国|地图|location/i.test(c)
    || /地理位置|所在地/.test(body.slice(0, 80))) {
    return 'location';
  }
  return 'other';
}

/** @param {object} entry */
export function shouldSeedGraphEntry(entry) {
  if (!entry || entry.enabled === false) return false;
  if (isMvuSystemEntry(entry) || isAdultDigestEntry(entry)) return false;
  var kind = String(entry.kind || '').trim();
  if (kind === 'corruption_rules' || kind === 'affection_rules') return false;
  if (kind.indexOf('outline_') === 0) return true;
  if (kind.indexOf('novel_') === 0) return true;
  if (!kind || kind === 'user') return true;
  if (seedEntryLabel(entry)) return true;
  return false;
}

/** @param {object} entry */
export function seedEntryLabel(entry) {
  entry = entry || {};
  var label = entryDisplayLabel(entry);
  if (label && label !== '未命名条目') return label;
  var exported = entryExportComment(entry);
  if (exported) return exported;
  return String(entry.comment || entry.title || entry.displayName || '').trim();
}

/** @param {object} entry */
export function storyTypeFromEntry(entry, label, content) {
  entry = entry || {};
  var ot = normalizeOutlineType(
    String(entry.outlineType || '').trim() || outlineTypeFromKind(entry.kind)
  );
  if (ot === 'person') return 'character';
  if (ot === 'location') return 'location';
  if (ot) return 'other';
  var kind = String(entry.kind || '');
  if (kind === 'novel_person') return 'character';
  return guessType(label, content);
}

function addEdge(edges, from, to, label) {
  if (!from || !to || from === to) return;
  var lbl = String(label || '关系');
  var dup = edges.some(function(x) {
    return x.from === from && x.to === to && String(x.label) === lbl;
  });
  if (dup) return;
  edges.push({
    id: genStoryId('edge'),
    from: from,
    to: to,
    label: lbl,
  });
}

/**
 * @param {{ worldbookEntries?: array, charName?: string, charDesc?: string }} seed
 * @returns {{ nodes: array, edges: array, updatedAt: string }}
 */
export function seedGraphFromCard(seed) {
  var s = seed || {};
  var nodes = [];
  var edges = [];
  var nameToId = {};
  var seededKeys = [];

  function ensureNode(name, type, note, role) {
    var key = String(name || '').trim();
    if (!key) return null;
    if (nameToId[key]) return nameToId[key];
    var id = genStoryId('node');
    nameToId[key] = id;
    var node = {
      id: id,
      type: type || 'other',
      name: key,
      note: clip(note, 240),
    };
    if (role === 'protagonist') node.role = 'protagonist';
    nodes.push(node);
    return id;
  }

  var charName = String(s.charName || '').trim();
  if (charName) {
    ensureNode(charName, 'character', s.charDesc || '场景标识（卡面）', 'protagonist');
  }

  var entries = Array.isArray(s.worldbookEntries) ? s.worldbookEntries : [];
  entries.forEach(function(e) {
    if (!shouldSeedGraphEntry(e)) return;
    var label = seedEntryLabel(e);
    if (!label) return;
    var type = storyTypeFromEntry(e, label, e.content);
    var nodeId = ensureNode(label, type, e.content || '');
    if (nodeId) {
      seededKeys.push({
        id: nodeId,
        keys: (e.keys || []).slice(),
        name: label,
      });
    }
  });

  // 场景 charName → 其他人物
  if (charName && nameToId[charName]) {
    var fromId = nameToId[charName];
    nodes.forEach(function(n) {
      if (n.id === fromId) return;
      if (n.type !== 'character') return;
      addEdge(edges, fromId, n.id, '关联');
    });
  }

  // 共触发词 → 共触发边
  var keyToNode = {};
  seededKeys.forEach(function(item) {
    var keys = item.keys.slice();
    if (item.name && keys.indexOf(item.name) < 0) keys.push(item.name);
    keys.forEach(function(k) {
      var key = String(k || '').trim();
      if (!key) return;
      if (keyToNode[key] && keyToNode[key] !== item.id) {
        addEdge(edges, keyToNode[key], item.id, '共触发');
      } else {
        keyToNode[key] = item.id;
      }
    });
  });

  return {
    nodes: nodes,
    edges: edges,
    updatedAt: new Date().toISOString(),
  };
}

/** 合并种子进已有图谱（同名跳过） */
export function mergeGraphSeed(existing, seedResult) {
  var cur = existing && typeof existing === 'object' ? existing : { nodes: [], edges: [] };
  var nodes = Array.isArray(cur.nodes) ? cur.nodes.slice() : [];
  var edges = Array.isArray(cur.edges) ? cur.edges.slice() : [];
  var byName = {};
  nodes.forEach(function(n) {
    if (n && n.name) byName[String(n.name).trim()] = n.id;
  });
  var idMap = {};
  (seedResult.nodes || []).forEach(function(n) {
    var name = String(n.name || '').trim();
    if (!name) return;
    if (byName[name]) {
      idMap[n.id] = byName[name];
      return;
    }
    var id = n.id || genStoryId('node');
    byName[name] = id;
    idMap[n.id] = id;
    nodes.push({
      id: id,
      type: n.type || 'other',
      name: name,
      note: String(n.note || ''),
      role: n.role === 'protagonist' ? 'protagonist' : '',
    });
  });
  (seedResult.edges || []).forEach(function(e) {
    var from = idMap[e.from] || e.from;
    var to = idMap[e.to] || e.to;
    if (!from || !to || from === to) return;
    var dup = edges.some(function(x) {
      return x.from === from && x.to === to && String(x.label) === String(e.label || '关系');
    });
    if (dup) return;
    edges.push({
      id: e.id || genStoryId('edge'),
      from: from,
      to: to,
      label: String(e.label || '关系'),
    });
  });
  return {
    nodes: nodes,
    edges: edges,
    updatedAt: new Date().toISOString(),
  };
}
