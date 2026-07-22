/**
 * Story 图谱 → 小说分析同款 G6 可视化
 */
import { mountOrUpdateGraph, relayoutGraph, destroyGraph } from '../novel/graphViz.mjs';

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

export function mountStoryGraph(container, storyGraph, onSelect) {
  if (!container) return null;
  var kg = storyGraphToKnowledge(storyGraph);
  instance = mountOrUpdateGraph(container, kg, instance, { onSelect: onSelect });
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
