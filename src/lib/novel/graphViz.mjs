/**
 * 知识图谱 G6 可视化（浏览器端）
 * 主角锚点居中放大；节点按度数加权；暗色下贴近「圆内白字 + 细曲边」风格
 */
import { Graph, NodeEvent, EdgeEvent, CanvasEvent } from "@antv/g6";

var TYPE_COLOR = {
  person: "#7c6af0",
  place: "#3b9eff",
  location: "#3b9eff",
  faction: "#2fbf8a",
  item: "#e8a23a",
  event: "#e86b8a",
  concept: "#8b95a8",
  lore: "#8b95a8",
  nsfw: "#d96bb8",
  protagonist: "#f0b429",
};

var TYPE_LABEL_ZH = {
  person: "人物",
  location: "地点",
  place: "地点",
  faction: "势力",
  item: "物品",
  event: "事件",
  lore: "设定",
  concept: "设定",
  nsfw: "NSFW",
  protagonist: "主角",
};

var NODE_R_MIN = 14;
var NODE_R_MAX = 28;
var NODE_R_PROTAG = 34;
var COLLIDE_BASE = 44;
var MIN_CENTER_DIST = 56;

var FORCE_LAYOUT = {
  type: "d3-force",
  link: {
    distance: 150,
    strength: 0.28,
  },
  manyBody: {
    strength: -480,
    distanceMax: 700,
  },
  collide: {
    radius: function (d) {
      var r = (d.data && d.data.nodeR) || NODE_R_MIN;
      return r + 22;
    },
    strength: 1,
    iterations: 3,
  },
  center: {
    strength: 0.04,
  },
  nodeSize: NODE_R_MIN * 2,
  nodeSpacing: 36,
  alphaDecay: 0.028,
  velocityDecay: 0.34,
  animation: false,
};

function isProtagonistNode(n) {
  if (!n) return false;
  var attrs = n.attrs || (n.data && n.data.attrs) || {};
  if (attrs.role === "protagonist") return true;
  if (n.data && n.data.role === "protagonist") return true;
  return false;
}

function computeDegrees(nodes, edges) {
  var degree = {};
  nodes.forEach(function (n) {
    degree[String(n.id)] = 0;
  });
  edges.forEach(function (e) {
    if (!e) return;
    var s = String(e.source || e.from || "");
    var t = String(e.target || e.to || "");
    if (degree[s] != null) degree[s] += 1;
    if (degree[t] != null) degree[t] += 1;
  });
  return degree;
}

function radiusForWeight(weight, isProtag) {
  if (isProtag) return NODE_R_PROTAG;
  var w = Math.max(0, Number(weight) || 0);
  var t = Math.min(1, w / 8);
  return Math.round(NODE_R_MIN + (NODE_R_MAX - NODE_R_MIN) * t);
}

/**
 * 按度数预散开；主角固定画布中心
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
  var innerR = span * 0.22;
  var outerR = span * 0.42;

  var degree = computeDegrees(nodes, edges);
  var protag = null;
  var connected = [];
  var isolates = [];
  nodes.forEach(function (n) {
    var id = String(n.id);
    var deg = degree[id] || 0;
    if (!n.data) n.data = {};
    n.data.degree = deg;
    var isP = isProtagonistNode(n) || (n.data && n.data.role === "protagonist");
    n.data.role = isP ? "protagonist" : n.data.role || "";
    n.data.nodeR = radiusForWeight(deg + (isP ? 6 : 0), isP);
    if (isP) protag = n;
    else if (deg > 0) connected.push(n);
    else isolates.push(n);
  });

  if (protag) {
    protag.style = Object.assign({}, protag.style, { x: cx, y: cy });
    protag.data.fx = cx;
    protag.data.fy = cy;
  }

  function placeRing(list, radius) {
    var n = list.length;
    if (!n) return;
    list.forEach(function (node, i) {
      var a = (2 * Math.PI * i) / n - Math.PI / 2;
      var jitter = ((i % 7) - 3) * 5;
      var r = radius + jitter;
      node.style = Object.assign({}, node.style, {
        x: cx + Math.cos(a) * r,
        y: cy + Math.sin(a) * r,
      });
    });
  }

  placeRing(connected, innerR);
  placeRing(isolates, outerR);
  return data;
}

export function deoverlapGraphNodes(graph, minDist) {
  if (!graph || graph.destroyed) return Promise.resolve();
  var min = minDist > 0 ? minDist : MIN_CENTER_DIST;
  var nodes =
    typeof graph.getNodeData === "function" ? graph.getNodeData() : [];
  if (!nodes.length) return Promise.resolve();

  var pts = nodes.map(function (n) {
    var st = n.style || {};
    var r = (n.data && n.data.nodeR) || NODE_R_MIN;
    return {
      id: n.id,
      x: Number(st.x) || 0,
      y: Number(st.y) || 0,
      r: r,
      fixed: !!(n.data && (n.data.fx != null || n.data.role === "protagonist")),
    };
  });

  var changed = false;
  for (var iter = 0; iter < 8; iter++) {
    var moved = false;
    for (var i = 0; i < pts.length; i++) {
      for (var j = i + 1; j < pts.length; j++) {
        var a = pts[i];
        var b = pts[j];
        var dx = b.x - a.x;
        var dy = b.y - a.y;
        var dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        var need = Math.max(min, a.r + b.r + 8);
        if (dist >= need) continue;
        var push = (need - dist) / 2;
        var ux = dx / dist;
        var uy = dy / dist;
        if (!a.fixed) {
          a.x -= ux * push;
          a.y -= uy * push;
          moved = true;
        }
        if (!b.fixed) {
          b.x += ux * push;
          b.y += uy * push;
          moved = true;
        }
      }
    }
    if (moved) changed = true;
    else break;
  }
  if (changed && typeof graph.updateNodeData === "function") {
    graph.updateNodeData(
      pts.map(function (p) {
        return { id: p.id, style: { x: p.x, y: p.y } };
      }),
    );
  }
  if (typeof graph.draw === "function") {
    return Promise.resolve(graph.draw()).catch(function () {
      /* ignore */
    });
  }
  return Promise.resolve();
}

/** knowledgeGraph → G6 data */
export function graphToG6Data(graph) {
  var g = graph || { nodes: [], edges: [] };
  var rawNodes = g.nodes || [];
  var rawEdges = g.edges || [];
  var degree = computeDegrees(
    rawNodes.map(function (n) {
      return { id: n.id };
    }),
    rawEdges.map(function (e) {
      return { source: e.from, target: e.to };
    }),
  );

  var nodes = rawNodes.map(function (n) {
    var type = n.type || "concept";
    var attrs = n.attrs || {};
    var isP = attrs.role === "protagonist";
    var deg = degree[String(n.id)] || 0;
    var nodeR = radiusForWeight(deg + (isP ? 6 : 0), isP);
    var fill = isP
      ? TYPE_COLOR.protagonist
      : TYPE_COLOR[type] || TYPE_COLOR.concept;
    return {
      id: String(n.id),
      data: {
        label: n.label || n.id,
        type: isP ? "protagonist" : type,
        role: isP ? "protagonist" : "",
        attrs: attrs,
        degree: deg,
        nodeR: nodeR,
      },
      style: {
        fill: fill,
        size: nodeR * 2,
      },
    };
  });
  var nodeIds = {};
  nodes.forEach(function (n) {
    nodeIds[n.id] = true;
  });
  var edges = [];
  rawEdges.forEach(function (e, i) {
    if (!e || !e.from || !e.to) return;
    if (!nodeIds[e.from] || !nodeIds[e.to]) return;
    edges.push({
      id: "e_" + i + "_" + e.from + "_" + e.to + "_" + (e.rel || "rel"),
      source: e.from,
      target: e.to,
      data: {
        label: e.rel || "related",
        evidence: Array.isArray(e.evidence)
          ? e.evidence
          : e.evidence
            ? [e.evidence]
            : [],
      },
    });
  });
  return { nodes: nodes, edges: edges };
}

export function filterKnowledgeGraphByTypes(graph, types) {
  var g = graph || { nodes: [], edges: [] };
  var allow = {};
  (types || []).forEach(function (t) {
    allow[t] = true;
  });
  // 只看人物时仍保留主角
  if (allow.person) allow.protagonist = true;
  var nodes = (g.nodes || []).filter(function (n) {
    if (!n) return false;
    if (n.attrs && n.attrs.role === "protagonist" && allow.person) return true;
    return allow[n.type || "concept"];
  });
  var ids = {};
  nodes.forEach(function (n) {
    ids[String(n.id)] = true;
  });
  var edges = (g.edges || []).filter(function (e) {
    return e && ids[String(e.from)] && ids[String(e.to)];
  });
  return {
    nodes: nodes,
    edges: edges,
    updatedAt: g.updatedAt || "",
  };
}

function listGraphElementIds(graph) {
  var data = graph && graph.getData ? graph.getData() : null;
  if (!data) return [];
  var ids = [];
  (data.nodes || []).forEach(function (d) {
    if (d && d.id != null) ids.push(String(d.id));
  });
  (data.edges || []).forEach(function (d) {
    if (d && d.id != null) ids.push(String(d.id));
  });
  (data.combos || []).forEach(function (d) {
    if (d && d.id != null) ids.push(String(d.id));
  });
  return ids;
}

/** 强制清空选中相关态；默认样式需自带 opacity:1，否则 inactive 透明度会粘住 */
function clearGraphSelectStates(graph) {
  if (!graph || graph.destroyed || typeof graph.setElementState !== "function")
    return;
  try {
    var states = {};
    listGraphElementIds(graph).forEach(function (id) {
      states[id] = [];
    });
    if (!Object.keys(states).length) {
      graph.__novelSelectedId = "";
      return;
    }
    // 第二参 false：关掉动画，避免清空过程中样式卡在半透明
    try {
      graph.setElementState(states, false);
    } catch (e1) {
      graph.setElementState(states);
    }
    graph.__novelSelectedId = "";
    // 部分 G6 版本清 state 后不立刻重算样式，强制刷一帧
    if (typeof graph.draw === "function") {
      try {
        graph.draw();
      } catch (e2) {
        /* ignore */
      }
    }
  } catch (e) {
    console.warn("[novelGraph] clear select states failed", e);
  }
}

/**
 * 按关系跳数高亮：选中点 selected，邻域 active，其余 inactive
 * @param {object} graph
 * @param {string} centerId
 * @param {number} degree
 * @param {'node'|'edge'} kind
 */
function applyGraphHighlight(graph, centerId, degree, kind) {
  if (!graph || graph.destroyed || !centerId) return;
  var depth = Math.max(0, Math.min(6, Math.floor(Number(degree) || 0)));
  var data = graph.getData ? graph.getData() : null;
  if (!data) return;

  var adj = Object.create(null);
  (data.edges || []).forEach(function (e) {
    if (!e) return;
    var s = String(e.source != null ? e.source : e.from);
    var t = String(e.target != null ? e.target : e.to);
    var eid = e.id != null ? String(e.id) : "";
    if (!adj[s]) adj[s] = [];
    if (!adj[t]) adj[t] = [];
    adj[s].push({ node: t, edge: eid });
    adj[t].push({ node: s, edge: eid });
  });

  var selected = Object.create(null);
  var active = Object.create(null);
  selected[String(centerId)] = 1;

  if (kind === "edge") {
    // 边：自身 selected，两端及按跳数扩展
    active[String(centerId)] = 1;
    var edge = (data.edges || []).find(function (e) {
      return e && String(e.id) === String(centerId);
    });
    if (edge) {
      var a = String(edge.source != null ? edge.source : edge.from);
      var b = String(edge.target != null ? edge.target : edge.to);
      selected[a] = 1;
      selected[b] = 1;
      // 从两端继续扩 depth-1
      var seeds = [a, b];
      var seen = Object.create(null);
      seen[a] = 1;
      seen[b] = 1;
      var frontier = seeds.slice();
      var d = 0;
      while (d < Math.max(0, depth - 1) && frontier.length) {
        var next = [];
        frontier.forEach(function (nid) {
          (adj[nid] || []).forEach(function (link) {
            if (link.edge) active[link.edge] = 1;
            if (!seen[link.node]) {
              seen[link.node] = 1;
              active[link.node] = 1;
              next.push(link.node);
            }
          });
        });
        frontier = next;
        d++;
      }
    }
  } else {
    var seenN = Object.create(null);
    seenN[String(centerId)] = 1;
    var frontierN = [String(centerId)];
    var hop = 0;
    while (hop < depth && frontierN.length) {
      var nextN = [];
      frontierN.forEach(function (nid) {
        (adj[nid] || []).forEach(function (link) {
          if (link.edge) active[link.edge] = 1;
          if (!seenN[link.node]) {
            seenN[link.node] = 1;
            active[link.node] = 1;
            nextN.push(link.node);
          }
        });
      });
      frontierN = nextN;
      hop++;
    }
  }

  var states = {};
  listGraphElementIds(graph).forEach(function (id) {
    if (selected[id]) states[id] = ["selected"];
    else if (active[id]) states[id] = ["active"];
    else states[id] = ["inactive"];
  });
  try {
    try {
      graph.setElementState(states, false);
    } catch (e1) {
      graph.setElementState(states);
    }
    graph.__novelSelectedId = String(centerId);
  } catch (e) {
    console.warn("[novelGraph] apply highlight failed", e);
  }
}

function bindSelectHandlers(graph, opts) {
  var highlightDegree =
    opts && opts.highlightDegree != null ? opts.highlightDegree : 2;
  highlightDegree = Math.max(
    0,
    Math.min(6, Math.floor(Number(highlightDegree) || 0)),
  );
  if (graph.__novelOnNodeClick)
    graph.off(NodeEvent.CLICK, graph.__novelOnNodeClick);
  if (graph.__novelOnEdgeClick)
    graph.off(EdgeEvent.CLICK, graph.__novelOnEdgeClick);
  if (graph.__novelOnCanvasClick)
    graph.off(CanvasEvent.CLICK, graph.__novelOnCanvasClick);
  if (NodeEvent.CONTEXT_MENU && graph.__novelOnNodeCtx) {
    graph.off(NodeEvent.CONTEXT_MENU, graph.__novelOnNodeCtx);
  }

  /** 节点/边点击常会冒泡到画布；只吞掉「同一次点击」里的 canvas clear，避免标志残留导致要点两下空白 */
  function armIgnoreCanvasClear() {
    graph.__novelIgnoreCanvasClear = true;
    var token = (graph.__novelIgnoreCanvasToken || 0) + 1;
    graph.__novelIgnoreCanvasToken = token;
    setTimeout(function () {
      if (graph.__novelIgnoreCanvasToken !== token) return;
      graph.__novelIgnoreCanvasClear = false;
    }, 0);
  }

  graph.__novelOnNodeClick = function (evt) {
    var id = evt.target && evt.target.id;
    if (!id) return;
    armIgnoreCanvasClear();
    // 再次点击同一节点 → 取消高亮
    if (
      graph.__novelSelectedId &&
      String(graph.__novelSelectedId) === String(id)
    ) {
      clearGraphSelectStates(graph);
      if (typeof opts.onSelect === "function") opts.onSelect(null);
      return;
    }
    applyGraphHighlight(graph, id, highlightDegree, "node");
    if (typeof opts.onSelect !== "function") return;
    var nd = graph.getNodeData(id);
    if (!nd) return;
    opts.onSelect({
      kind: "node",
      id: nd.id,
      label: (nd.data && nd.data.label) || nd.id,
      type: (nd.data && nd.data.type) || "concept",
      attrs: (nd.data && nd.data.attrs) || {},
    });
  };
  graph.__novelOnEdgeClick = function (evt) {
    var id = evt.target && evt.target.id;
    if (!id) return;
    armIgnoreCanvasClear();
    if (
      graph.__novelSelectedId &&
      String(graph.__novelSelectedId) === String(id)
    ) {
      clearGraphSelectStates(graph);
      if (typeof opts.onSelect === "function") opts.onSelect(null);
      return;
    }
    applyGraphHighlight(graph, id, highlightDegree, "edge");
    if (typeof opts.onSelect !== "function") return;
    var ed = graph.getEdgeData(id);
    if (!ed) return;
    opts.onSelect({
      kind: "edge",
      id: ed.id,
      label: (ed.data && ed.data.label) || "related",
      source: ed.source,
      target: ed.target,
      evidence: (ed.data && ed.data.evidence) || [],
    });
  };
  graph.__novelOnCanvasClick = function () {
    if (graph.__novelIgnoreCanvasClear) {
      graph.__novelIgnoreCanvasClear = false;
      return;
    }
    clearGraphSelectStates(graph);
    if (typeof opts.onSelect === "function") opts.onSelect(null);
  };

  graph.on(NodeEvent.CLICK, graph.__novelOnNodeClick);
  graph.on(EdgeEvent.CLICK, graph.__novelOnEdgeClick);
  graph.on(CanvasEvent.CLICK, graph.__novelOnCanvasClick);

  if (NodeEvent.CONTEXT_MENU) {
    graph.__novelOnNodeCtx = function (evt) {
      if (evt && typeof evt.preventDefault === "function") evt.preventDefault();
      if (
        evt &&
        evt.originalEvent &&
        typeof evt.originalEvent.preventDefault === "function"
      ) {
        evt.originalEvent.preventDefault();
      }
      if (typeof opts.onNodeContextMenu !== "function") return;
      var id = evt.target && evt.target.id;
      var nd = id ? graph.getNodeData(id) : null;
      if (!nd) return;
      var clientX = 0;
      var clientY = 0;
      if (evt.client) {
        clientX = evt.client.x || 0;
        clientY = evt.client.y || 0;
      } else if (evt.originalEvent) {
        clientX = evt.originalEvent.clientX || 0;
        clientY = evt.originalEvent.clientY || 0;
      }
      opts.onNodeContextMenu({
        id: nd.id,
        label: (nd.data && nd.data.label) || nd.id,
        type: (nd.data && nd.data.type) || "concept",
        attrs: (nd.data && nd.data.attrs) || {},
        clientX: clientX,
        clientY: clientY,
      });
    };
    graph.on(NodeEvent.CONTEXT_MENU, graph.__novelOnNodeCtx);
  }
}

function layoutAndFit(graph) {
  if (!graph || graph.destroyed) return Promise.resolve();
  return Promise.resolve()
    .then(function () {
      if (typeof graph.resize === "function") graph.resize();
    })
    .then(function () {
      return graph.layout();
    })
    .then(function () {
      return deoverlapGraphNodes(graph, MIN_CENTER_DIST);
    })
    .then(function () {
      try {
        graph.fitView();
      } catch (e) {
        /* ignore */
      }
    })
    .catch(function () {
      /* ignore */
    });
}

function attachResizeRelayout(container, graph) {
  if (!container || !graph || typeof ResizeObserver === "undefined") return;
  if (container.__novelGraphRo) {
    try {
      container.__novelGraphRo.disconnect();
    } catch (e) {
      /* ignore */
    }
  }
  var timer = null;
  var ro = new ResizeObserver(function () {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
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

/** 图例 HTML */
export function buildGraphLegendHtml() {
  var keys = [
    "protagonist",
    "person",
    "faction",
    "location",
    "item",
    "event",
    "lore",
  ];
  return keys
    .map(function (k) {
      var color = TYPE_COLOR[k];
      var label = TYPE_LABEL_ZH[k] || k;
      return (
        '<span class="novel-graph-legend-item">' +
        '<i style="background:' +
        color +
        '"></i>' +
        label +
        "</span>"
      );
    })
    .join("");
}

export function mountOrUpdateGraph(container, graphData, existing, opts) {
  opts = opts || {};
  if (!container) return null;
  var highlightDegree = opts.highlightDegree;
  if (highlightDegree == null || !Number.isFinite(Number(highlightDegree)))
    highlightDegree = 2;
  highlightDegree = Math.max(
    0,
    Math.min(6, Math.floor(Number(highlightDegree))),
  );

  // 旧实例若仍带 click-select，或层级变更，直接销毁重建（否则 inactive 透明度会粘住）
  if (
    existing &&
    typeof existing.destroy === "function" &&
    !existing.destroyed
  ) {
    var needRebuild =
      existing.__novelSelectMode !== "custom" ||
      existing.__novelHighlightDegree !== highlightDegree;
    if (needRebuild) {
      try {
        existing.destroy();
      } catch (e) {
        /* ignore */
      }
      existing = null;
    }
  }

  if (!container.__novelGraphCtxGuard) {
    container.__novelGraphCtxGuard = true;
    container.addEventListener("contextmenu", function (e) {
      e.preventDefault();
    });
  }
  var data = graphToG6Data(graphData);
  seedNodePositions(data, container.clientWidth, container.clientHeight);

  var legend =
    container.parentElement && container.parentElement.querySelector
      ? container.parentElement.querySelector("#novelGraphLegend")
      : null;
  if (legend) legend.innerHTML = buildGraphLegendHtml();

  if (
    existing &&
    typeof existing.destroy === "function" &&
    !existing.destroyed
  ) {
    existing.setData(data);
    clearGraphSelectStates(existing);
    bindSelectHandlers(
      existing,
      Object.assign({}, opts, { highlightDegree: highlightDegree }),
    );
    existing.__novelHighlightDegree = highlightDegree;
    existing.__novelSelectMode = "custom";
    layoutAndFit(existing);
    return existing;
  }

  var graph = new Graph({
    container: container,
    data: data,
    autoFit: "view",
    padding: [40, 44, 48, 44],
    theme: "dark",
    behaviors: [
      "drag-canvas",
      "zoom-canvas",
      "drag-element",
      // 高亮由 bindSelectHandlers 自管；避免 click-select 的 unselectedState 清空后透明度粘住
    ],
    layout: FORCE_LAYOUT,
    node: {
      type: "circle",
      style: {
        size: function (d) {
          return ((d.data && d.data.nodeR) || NODE_R_MIN) * 2;
        },
        fill: function (d) {
          if (d.data && d.data.role === "protagonist")
            return TYPE_COLOR.protagonist;
          var t = (d.data && d.data.type) || "concept";
          return TYPE_COLOR[t] || TYPE_COLOR.concept;
        },
        stroke: function (d) {
          if (d.data && d.data.role === "protagonist")
            return "rgba(100, 94, 74, 0.95)";
          return "rgba(10, 12, 18, 0.55)";
        },
        lineWidth: function (d) {
          return d.data && d.data.role === "protagonist" ? 3 : 1.5;
        },
        opacity: 1,
        labelText: function (d) {
          return (d.data && d.data.label) || d.id;
        },
        labelPlacement: "center",
        labelFill: "#ffffff",
        labelFontSize: function (d) {
          var r = (d.data && d.data.nodeR) || NODE_R_MIN;
          if (r >= NODE_R_PROTAG) return 12;
          if (r >= 22) return 11;
          return 10;
        },
        labelFontWeight: 600,
        labelFontFamily: "inherit",
        labelMaxWidth: function (d) {
          return ((d.data && d.data.nodeR) || NODE_R_MIN) * 1.7;
        },
        labelWordWrap: true,
        labelMaxLines: 2,
        shadowColor: "rgba(0,0,0,0.25)",
        shadowBlur: 6,
      },
      state: {
        selected: {
          stroke: "#fff3bf",
          lineWidth: 3,
          opacity: 1,
        },
        active: {
          stroke: "#ffe8a3",
          lineWidth: 2.5,
          opacity: 1,
        },
        inactive: {
          opacity: 0.12,
        },
      },
    },
    edge: {
      type: "quadratic",
      style: {
        stroke: "rgba(148, 163, 184, 0.45)",
        lineWidth: 1.1,
        opacity: 1,
        endArrow: true,
        endArrowSize: 6,
        labelText: function (d) {
          return (d.data && d.data.label) || "";
        },
        labelFill: "rgba(203, 213, 225, 0.78)",
        labelFontSize: 9,
        labelBackground: false,
        labelAutoRotate: true,
      },
      state: {
        selected: {
          stroke: "#fbbf24",
          lineWidth: 2.2,
          labelFill: "#fde68a",
          opacity: 1,
        },
        active: {
          stroke: "rgba(251, 191, 36, 0.75)",
          lineWidth: 1.6,
          labelFill: "rgba(253, 230, 138, 0.9)",
          opacity: 1,
        },
        inactive: {
          opacity: 0.08,
        },
      },
    },
  });

  bindSelectHandlers(
    graph,
    Object.assign({}, opts, { highlightDegree: highlightDegree }),
  );
  attachResizeRelayout(container, graph);
  graph.__novelHighlightDegree = highlightDegree;
  graph.__novelSelectMode = "custom";
  graph
    .render()
    .then(function () {
      return layoutAndFit(graph);
    })
    .catch(function () {
      /* ignore */
    });
  return graph;
}

export function relayoutGraph(graph) {
  return layoutAndFit(graph);
}

export function destroyGraph(graph) {
  if (graph && typeof graph.destroy === "function" && !graph.destroyed) {
    try {
      graph.destroy();
    } catch (e) {
      /* ignore */
    }
  }
}

export {
  TYPE_COLOR,
  TYPE_LABEL_ZH,
  FORCE_LAYOUT,
  COLLIDE_BASE as COLLIDE_R,
  MIN_CENTER_DIST,
};
