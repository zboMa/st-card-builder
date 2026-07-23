/**
 * 知识图谱 G6 可视化（浏览器端）
 */
import { Graph, NodeEvent, EdgeEvent, CanvasEvent } from '@antv/g6';

var TYPE_COLOR = {
  person: '#c084fc',
  place: '#38bdf8',
  location: '#38bdf8',
  faction: '#34d399',
  item: '#fbbf24',
  event: '#fb7185',
  concept: '#94a3b8',
  lore: '#94a3b8',
  nsfw: '#f472b6',
};

/** 节点圆半径（与 node.style.size 一半一致） */
var NODE_R = 16;
/** 碰撞半径：圆 + 标签余量，避免字叠在一起 */
var COLLIDE_R = 52;
/** 去重叠最小中心距 */
var MIN_CENTER_DIST = COLLIDE_R * 2;

/**
 * d3-force：强斥力 + 碰撞；弱中心，避免孤立点被吸成几坨
 */
var FORCE_LAYOUT = {
  type: 'd3-force',
  link: {
    distance: 170,
    strength: 0.32,
  },
  manyBody: {
    strength: -560,
    distanceMax: 720,
  },
  collide: {
    radius: COLLIDE_R,
    strength: 1,
    iterations: 3,
  },
  center: {
    strength: 0.025,
  },
  nodeSize: NODE_R * 2,
  nodeSpacing: 40,
  alphaDecay: 0.025,
  velocityDecay: 0.32,
  animation: false,
};

/**
 * 按度数预散开：有边靠内环，孤立点均布外环（避免全从原点出发）
 * @param {{ nodes: object[], edges: object[] }} data
 * @param {number} [width]
 * @param {number} [height]
 */
export function seedNodePositions(data, width, height) {
  var nodes = (data && data.nodes) || [];
  var edges = (data && data.edges) || [];
  if (!nodes.length) return data;

  var w = width > 40 ? width : 800;
  var h = height > 40 ? height : 560;
  var cx = w / 2;
  var cy = h / 2;
  var span = Math.min(w, h);
  var innerR = span * 0.2;
  var outerR = span * 0.4;

  var degree = {};
  nodes.forEach(function(n) { degree[n.id] = 0; });
  edges.forEach(function(e) {
    if (!e) return;
    if (degree[e.source] != null) degree[e.source] += 1;
    if (degree[e.target] != null) degree[e.target] += 1;
  });

  var connected = [];
  var isolates = [];
  nodes.forEach(function(n) {
    if ((degree[n.id] || 0) > 0) connected.push(n);
    else isolates.push(n);
  });

  function placeRing(list, radius) {
    var n = list.length;
    if (!n) return;
    list.forEach(function(node, i) {
      var a = (2 * Math.PI * i) / n - Math.PI / 2;
      // 轻微错位，避免对称塌缩
      var jitter = ((i % 7) - 3) * 6;
      var r = radius + jitter;
      node.style = Object.assign({}, node.style, {
        x: cx + Math.cos(a) * r,
        y: cy + Math.sin(a) * r,
      });
      if (!node.data) node.data = {};
      node.data.degree = degree[node.id] || 0;
    });
  }

  placeRing(connected, innerR);
  placeRing(isolates, outerR);
  return data;
}

/**
 * 布局后轻量去重叠（平移推开仍撞在一起的点）
 * @param {Graph} graph
 * @param {number} [minDist]
 */
export function deoverlapGraphNodes(graph, minDist) {
  if (!graph || graph.destroyed) return Promise.resolve();
  var min = minDist > 0 ? minDist : MIN_CENTER_DIST;
  var nodes = typeof graph.getNodeData === 'function' ? graph.getNodeData() : [];
  if (!nodes.length) return Promise.resolve();

  var pts = nodes.map(function(n) {
    var x = n.style && typeof n.style.x === 'number' ? n.style.x : 0;
    var y = n.style && typeof n.style.y === 'number' ? n.style.y : 0;
    if (typeof graph.getElementPosition === 'function') {
      try {
        var pos = graph.getElementPosition(n.id);
        if (pos && pos.length >= 2) {
          x = pos[0];
          y = pos[1];
        }
      } catch (e) { /* ignore */ }
    }
    return { id: n.id, x: x, y: y };
  });

  var iter;
  for (iter = 0; iter < 16; iter++) {
    var moved = false;
    var i;
    var j;
    for (i = 0; i < pts.length; i++) {
      for (j = i + 1; j < pts.length; j++) {
        var dx = pts[j].x - pts[i].x;
        var dy = pts[j].y - pts[i].y;
        var d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        if (d >= min) continue;
        var push = (min - d) / 2;
        var ux = dx / d;
        var uy = dy / d;
        pts[i].x -= ux * push;
        pts[i].y -= uy * push;
        pts[j].x += ux * push;
        pts[j].y += uy * push;
        moved = true;
      }
    }
    if (!moved) break;
  }

  if (typeof graph.updateNodeData === 'function') {
    graph.updateNodeData(pts.map(function(p) {
      return { id: p.id, style: { x: p.x, y: p.y } };
    }));
  }
  if (typeof graph.draw === 'function') {
    return Promise.resolve(graph.draw()).catch(function() { /* ignore */ });
  }
  return Promise.resolve();
}

/** knowledgeGraph → G6 data */
export function graphToG6Data(graph) {
  var g = graph || { nodes: [], edges: [] };
  var nodes = (g.nodes || []).map(function(n) {
    var type = n.type || 'concept';
    return {
      id: String(n.id),
      data: {
        label: n.label || n.id,
        type: type,
        attrs: n.attrs || {},
      },
      style: {
        fill: TYPE_COLOR[type] || TYPE_COLOR.concept,
      },
    };
  });
  var nodeIds = {};
  nodes.forEach(function(n) { nodeIds[n.id] = true; });
  var edges = [];
  (g.edges || []).forEach(function(e, i) {
    if (!e || !e.from || !e.to) return;
    if (!nodeIds[e.from] || !nodeIds[e.to]) return;
    edges.push({
      id: 'e_' + i + '_' + e.from + '_' + e.to + '_' + (e.rel || 'rel'),
      source: e.from,
      target: e.to,
      data: {
        label: e.rel || 'related',
        evidence: Array.isArray(e.evidence) ? e.evidence : (e.evidence ? [e.evidence] : []),
      },
    });
  });
  return { nodes: nodes, edges: edges };
}

/**
 * 按类型过滤知识图谱（边两端均保留才保留）
 * @param {object} graph
 * @param {string[]} types
 */
export function filterKnowledgeGraphByTypes(graph, types) {
  var g = graph || { nodes: [], edges: [] };
  var allow = {};
  (types || []).forEach(function(t) { allow[t] = true; });
  var nodes = (g.nodes || []).filter(function(n) {
    return n && allow[n.type || 'concept'];
  });
  var ids = {};
  nodes.forEach(function(n) { ids[String(n.id)] = true; });
  var edges = (g.edges || []).filter(function(e) {
    return e && ids[String(e.from)] && ids[String(e.to)];
  });
  return {
    nodes: nodes,
    edges: edges,
    updatedAt: g.updatedAt || '',
  };
}

function bindSelectHandlers(graph, opts) {
  graph.off(NodeEvent.CLICK);
  graph.off(EdgeEvent.CLICK);
  graph.off(CanvasEvent.CLICK);
  graph.on(NodeEvent.CLICK, function(evt) {
    if (typeof opts.onSelect !== 'function') return;
    var id = evt.target && evt.target.id;
    var nd = id ? graph.getNodeData(id) : null;
    if (!nd) return;
    opts.onSelect({
      kind: 'node',
      id: nd.id,
      label: (nd.data && nd.data.label) || nd.id,
      type: (nd.data && nd.data.type) || 'concept',
      attrs: (nd.data && nd.data.attrs) || {},
    });
  });
  graph.on(EdgeEvent.CLICK, function(evt) {
    if (typeof opts.onSelect !== 'function') return;
    var id = evt.target && evt.target.id;
    var ed = id ? graph.getEdgeData(id) : null;
    if (!ed) return;
    opts.onSelect({
      kind: 'edge',
      id: ed.id,
      label: (ed.data && ed.data.label) || 'related',
      source: ed.source,
      target: ed.target,
      evidence: (ed.data && ed.data.evidence) || [],
    });
  });
  graph.on(CanvasEvent.CLICK, function() {
    if (typeof opts.onSelect === 'function') opts.onSelect(null);
  });
}

/** 布局 → 去重叠 → 适配视口 */
function layoutAndFit(graph) {
  if (!graph || graph.destroyed) return Promise.resolve();
  return Promise.resolve()
    .then(function() {
      if (typeof graph.resize === 'function') graph.resize();
    })
    .then(function() { return graph.layout(); })
    .then(function() { return deoverlapGraphNodes(graph, MIN_CENTER_DIST); })
    .then(function() {
      try { graph.fitView(); } catch (e) { /* ignore */ }
    })
    .catch(function() { /* ignore */ });
}

/** 容器尺寸变化时重布局（避免先挤在小框再放大） */
function attachResizeRelayout(container, graph) {
  if (!container || !graph || typeof ResizeObserver === 'undefined') return;
  if (container.__novelGraphRo) {
    try { container.__novelGraphRo.disconnect(); } catch (e) { /* ignore */ }
  }
  var timer = null;
  var ro = new ResizeObserver(function() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function() {
      if (!graph || graph.destroyed) return;
      var w = container.clientWidth;
      var h = container.clientHeight;
      if (w < 40 || h < 40) return;
      layoutAndFit(graph);
    }, 120);
  });
  ro.observe(container);
  container.__novelGraphRo = ro;
}

/**
 * 创建或更新图谱实例
 * @param {HTMLElement} container
 * @param {object} graphData knowledgeGraph
 * @param {Graph|null} existing
 * @param {{ onSelect?: (payload: object|null) => void }} [opts]
 */
export function mountOrUpdateGraph(container, graphData, existing, opts) {
  opts = opts || {};
  if (!container) return null;
  var data = graphToG6Data(graphData);
  seedNodePositions(data, container.clientWidth, container.clientHeight);

  if (existing && typeof existing.destroy === 'function' && !existing.destroyed) {
    existing.setData(data);
    bindSelectHandlers(existing, opts);
    layoutAndFit(existing);
    return existing;
  }

  var graph = new Graph({
    container: container,
    data: data,
    autoFit: 'view',
    padding: [36, 40, 48, 40],
    theme: 'dark',
    behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element', 'click-select'],
    layout: FORCE_LAYOUT,
    node: {
      type: 'circle',
      style: {
        size: NODE_R * 2,
        fill: function(d) {
          var t = (d.data && d.data.type) || 'concept';
          return TYPE_COLOR[t] || TYPE_COLOR.concept;
        },
        stroke: 'rgba(15, 14, 23, 0.85)',
        lineWidth: 2,
        labelText: function(d) { return (d.data && d.data.label) || d.id; },
        labelPlacement: 'bottom',
        labelFill: '#e2e8f0',
        labelFontSize: 11,
        labelFontFamily: 'inherit',
        labelOffsetY: 6,
        labelMaxWidth: 96,
        labelWordWrap: true,
        labelMaxLines: 2,
        shadowColor: 'rgba(0,0,0,0.35)',
        shadowBlur: 8,
      },
      state: {
        selected: {
          stroke: '#fbbf24',
          lineWidth: 3,
          size: 38,
        },
        active: {
          stroke: '#fde68a',
          lineWidth: 2.5,
        },
      },
    },
    edge: {
      type: 'quadratic',
      style: {
        stroke: '#64748b',
        lineWidth: 1.5,
        endArrow: true,
        labelText: function(d) { return (d.data && d.data.label) || ''; },
        labelFill: '#94a3b8',
        labelFontSize: 9,
        labelBackground: true,
        labelBackgroundFill: 'rgba(15, 14, 23, 0.75)',
        labelBackgroundRadius: 3,
        labelPadding: [1, 4],
        labelAutoRotate: false,
      },
      state: {
        selected: {
          stroke: '#fbbf24',
          lineWidth: 2.5,
          labelFill: '#fde68a',
        },
      },
    },
  });

  bindSelectHandlers(graph, opts);
  attachResizeRelayout(container, graph);
  graph.render().then(function() {
    return layoutAndFit(graph);
  }).catch(function() { /* ignore */ });
  return graph;
}

/** 重新跑布局并适配视口 */
export function relayoutGraph(graph) {
  return layoutAndFit(graph);
}

export function destroyGraph(graph) {
  if (graph && typeof graph.destroy === 'function' && !graph.destroyed) {
    graph.destroy();
  }
}

export { TYPE_COLOR, FORCE_LAYOUT, COLLIDE_R, MIN_CENTER_DIST };
