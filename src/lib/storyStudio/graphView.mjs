/**
 * Story 图谱 → 小说分析同款 G6 可视化
 */
import {
  mountOrUpdateGraph,
  relayoutGraph,
  destroyGraph,
  filterKnowledgeGraphByTypes,
} from '../novel/graphViz.mjs';

var TYPE_MAP = {
  character: 'person',
  location: 'place',
  other: 'concept',
};

export function storyGraphToKnowledge(graph) {
  var g = graph || { nodes: [], edges: [] };
  return {
    nodes: (g.nodes || []).map(function(n) {
      return {
        id: String(n.id),
        label: n.name || n.id,
        type: TYPE_MAP[n.type] || 'concept',
        attrs: { note: n.note || '', storyType: n.type || 'other' },
      };
    }),
    edges: (g.edges || []).map(function(e) {
      return {
        from: e.from,
        to: e.to,
        rel: e.label || '关系',
        evidence: e.note ? [e.note] : [],
      };
    }),
  };
}

var instance = null;

/**
 * @param {HTMLElement} container
 * @param {object} storyGraph
 * @param {object|function} [opts] 兼容旧签名：直接传 onSelect；或 { onSelect, onNodeContextMenu, onEdgeContextMenu, highlightDegree, personOnly }
 */
export function mountStoryGraph(container, storyGraph, opts) {
  if (!container) return null;
  var options = typeof opts === 'function' ? { onSelect: opts } : (opts || {});
  var kg = storyGraphToKnowledge(storyGraph);
  if (options.personOnly) {
    kg = filterKnowledgeGraphByTypes(kg, ['person']);
  }
  var depth = options.highlightDegree != null ? options.highlightDegree : 2;
  instance = mountOrUpdateGraph(container, kg, instance, {
    highlightDegree: depth,
    onSelect: options.onSelect,
    onNodeContextMenu: options.onNodeContextMenu,
    onEdgeContextMenu: options.onEdgeContextMenu,
  });
  return instance;
}

export function relayoutStoryGraph() {
  return relayoutGraph(instance);
}

export function destroyStoryGraph() {
  destroyGraph(instance);
  instance = null;
}

export function getStoryGraphInstance() {
  return instance;
}
