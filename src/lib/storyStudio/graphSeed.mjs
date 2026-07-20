/**
 * 从世界书 / 角色种子生成可编辑图谱节点
 */

import { genStoryId } from './state.mjs';

function clip(s, n) {
  var t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  return t.slice(0, n) + '…';
}

function guessType(comment, content) {
  var c = String(comment || '');
  var body = String(content || '');
  if (/^\[人物\]|人物|角色|NPC|protagonist/i.test(c) || /人物档案|角色设定/.test(body.slice(0, 80))) {
    return 'character';
  }
  if (/地点|场所|城市|村庄|王国|地图|location/i.test(c) || /地理位置|所在地/.test(body.slice(0, 80))) {
    return 'location';
  }
  return 'other';
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

  function ensureNode(name, type, note) {
    var key = String(name || '').trim();
    if (!key) return null;
    if (nameToId[key]) return nameToId[key];
    var id = genStoryId('node');
    nameToId[key] = id;
    nodes.push({
      id: id,
      type: type || 'other',
      name: key,
      note: clip(note, 240),
    });
    return id;
  }

  var charName = String(s.charName || '').trim();
  if (charName) {
    ensureNode(charName, 'character', s.charDesc || '主角（卡面）');
  }

  var entries = Array.isArray(s.worldbookEntries) ? s.worldbookEntries : [];
  entries.forEach(function(e) {
    if (!e || e.enabled === false) return;
    var comment = String(e.comment || e.title || '').trim();
    if (!comment) return;
    var cleanName = comment.replace(/^\[(?:人物|地点|势力|设定|物品|事件)\]\s*/i, '').trim() || comment;
    var type = guessType(comment, e.content);
    ensureNode(cleanName, type, e.content || '');
  });

  // 简化关系：主角 → 其他人物
  if (charName && nameToId[charName]) {
    var fromId = nameToId[charName];
    nodes.forEach(function(n) {
      if (n.id === fromId) return;
      if (n.type !== 'character') return;
      edges.push({
        id: genStoryId('edge'),
        from: fromId,
        to: n.id,
        label: '关联',
      });
    });
  }

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
