/**
 * Story 图谱 → 小说工坊同款 G6 可视化（layout / 交互与 analyze 面板一致）
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
  event: 'event',
  item: 'item',
  faction: 'faction',
  other: 'concept',
};

function kgTypeFromStoryNode(n) {
  var storyType = String(n.type || 'other');
  return TYPE_MAP[storyType] || 'concept';
}

/**
 * @param {object} graph story graph
 * @param {{ sceneName?: string }} [opts]
 */
export function storyGraphToKnowledge(graph, opts) {
  var o = opts || {};
  var sceneName = String(o.sceneName || '').trim();
  var g = graph || { nodes: [], edges: [] };
  return {
    nodes: (g.nodes || []).map(function(n) {
      var isHub = n.role === 'protagonist'
        || (sceneName && String(n.name || '').trim() === sceneName);
      return {
        id: String(n.id),
        label: n.name || n.id,
        type: kgTypeFromStoryNode(n),
        attrs: {
          note: n.note || '',
          storyType: n.type || 'other',
          entityRef: n.entityRef || '',
          role: isHub ? 'protagonist' : '',
        },
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
 * @param {object|function} [opts] 兼容旧签名：直接传 onSelect；或 { onSelect, onNodeContextMenu, onEdgeContextMenu, highlightDegree, personOnly, sceneName }
 */
export function mountStoryGraph(container, storyGraph, opts) {
  if (!container) return null;
  var options = typeof opts === 'function' ? { onSelect: opts } : (opts || {});
  var kg = storyGraphToKnowledge(storyGraph, { sceneName: options.sceneName });
  if (options.personOnly) {
    kg = filterKnowledgeGraphByTypes(kg, ['person']);
  }
  var depth = options.highlightDegree != null ? options.highlightDegree : 2;
  instance = mountOrUpdateGraph(container, kg, instance, {
    mode: 'workshop',
    readOnly: false,
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
