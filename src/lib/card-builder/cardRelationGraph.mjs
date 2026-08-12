/**
 * 卡关系一览（§6.4.3 · D18）— worldbook 投影 → 只读 G6
 */

import { isPersonWorldbookEntry, personNameFromWorldbookEntry } from '../novel/sync.mjs';
import { mountOrUpdateGraph, destroyGraph, relayoutGraph } from '../novel/graphViz.mjs';

function stripPersonDisplayName(raw) {
  var s = String(raw || '').trim();
  s = s.replace(/^\[(?:小说)?人物\]\s*/, '');
  s = s.replace(/^\[[^\]]+\]\s*/, '');
  return s || raw || '';
}

function shortNodeLabel(name) {
  var s = stripPersonDisplayName(name);
  if (s.length <= 4) return s;
  return s.slice(0, 4);
}

/**
 * @param {object[]} entries worldbook
 * @param {{ sceneName?: string }} [opts]
 */
export function worldbookToRelationGraph(entries, opts) {
  var o = opts || {};
  var nodes = [];
  var edges = [];
  var keyToNode = {};
  var personIds = [];

  (entries || []).forEach(function(e, idx) {
    if (!e || !isPersonWorldbookEntry(e)) return;
    var name = stripPersonDisplayName(
      personNameFromWorldbookEntry(e)
      || String(e.comment || '').replace(/^\[小说人物\]\s*/, '')
    ) || ('人物' + idx);
    var id = 'wb_' + String(e.id != null ? e.id : idx);
    personIds.push(id);
    nodes.push({
      id: id,
      label: name,
      shortLabel: shortNodeLabel(name),
      type: 'person',
      attrs: {
        fullLabel: name,
        sourceRef: e.sourceRef,
        linkStatus: e.linkStatus,
        projectionDirty: e.projectionDirty,
        wbIndex: idx,
      },
    });
    var keys = (e.keys || []).slice();
    if (name && keys.indexOf(name) < 0) keys.push(name);
    keys.forEach(function(k) {
      var key = String(k || '').trim();
      if (!key) return;
      if (keyToNode[key] && keyToNode[key] !== id) {
        var edgeId = keyToNode[key] + '::' + id;
        if (!edges.some(function(ed) { return ed.id === edgeId; })) {
          edges.push({
            id: edgeId,
            from: keyToNode[key],
            to: id,
            rel: '共触发',
            evidence: [key],
          });
        }
      } else {
        keyToNode[key] = id;
      }
    });
  });

  var sceneName = stripPersonDisplayName(o.sceneName || '');
  if (sceneName && personIds.length) {
    var hubId = 'scene_hub';
    nodes.unshift({
      id: hubId,
      label: sceneName,
      shortLabel: shortNodeLabel(sceneName),
      type: 'concept',
      attrs: { role: 'protagonist', fullLabel: sceneName, isSceneHub: true },
    });
    personIds.forEach(function(pid, i) {
      edges.push({
        id: 'hub_' + pid,
        from: hubId,
        to: pid,
        rel: '卡司',
        evidence: [sceneName],
      });
    });
  }

  return { nodes: nodes, edges: edges };
}

function formatCardGraphDetail(payload) {
  if (!payload || payload.kind !== 'node') return '点击节点查看投影状态';
  var d = payload.data || {};
  var attrs = d.attrs || {};
  var lines = [String((attrs && attrs.fullLabel) || d.label || d.id || '节点')];
  if (attrs.linkStatus) lines.push('链接：' + attrs.linkStatus);
  if (attrs.projectionDirty) lines.push('投影：已脏（源侧有更新）');
  if (attrs.sourceRef && attrs.sourceRef.type) {
    lines.push('来源：' + attrs.sourceRef.type + (attrs.sourceRef.id ? ' · ' + attrs.sourceRef.id : ''));
  }
  if (typeof attrs.wbIndex === 'number') lines.push('世界书索引：' + attrs.wbIndex);
  return lines.join(' · ');
}

var instance = null;

/**
 * @param {HTMLElement} container
 * @param {object[]} entries
 * @param {object} [opts]
 */
export function mountCardRelationGraph(container, entries, opts) {
  if (!container) return null;
  var options = opts || {};
  var sceneName = options.sceneName != null ? options.sceneName : '';
  if (!sceneName && typeof document !== 'undefined') {
    var nameEl = document.getElementById('charName');
    if (nameEl && nameEl.value) sceneName = String(nameEl.value).trim();
  }
  var kg = worldbookToRelationGraph(entries, { sceneName: sceneName });
  if (options.personOnly) {
    kg = { nodes: kg.nodes.filter(function(n) { return n.type === 'person'; }), edges: kg.edges };
  }
  instance = mountOrUpdateGraph(container, kg, instance, {
    mode: 'card',
    readOnly: true,
    labelPlacement: 'bottom',
    highlightDegree: options.highlightDegree != null ? options.highlightDegree : 1,
    onSelect: function(payload) {
      if (options.onSelect) options.onSelect(payload);
      if (options.detailEl) {
        options.detailEl.textContent = formatCardGraphDetail(payload);
      }
    },
  });
  return instance;
}

export function relayoutCardRelationGraph() {
  return relayoutGraph(instance);
}

export function destroyCardRelationGraph() {
  destroyGraph(instance);
  instance = null;
}
