/**
 * MVU 变量卡面板控制器（从 VariableCardPanel.astro 外提）
 */

import {
    inferMvuCandidatesFromCard,
    mergeCandidatesIntoDesign,
    corruptionProgressGap,
  } from './inferFromCard.mjs';
import { STATUS_BAR_EXT_KEY } from '../statusBar.mjs';

export function initVariableCardPanelCore() {
/* ============================================================
   *  DOM
   * ============================================================ */
  var graphViewport = document.getElementById('vcGraphViewport');
  var graphSpace    = document.getElementById('vcGraphSpace');
  var graphWires    = document.getElementById('vcGraphWires');
  var tempWire      = document.getElementById('vcTempWire');
  var zoomInBtn     = document.getElementById('vcZoomIn');
  var zoomOutBtn    = document.getElementById('vcZoomOut');
  var zoomResetBtn  = document.getElementById('vcZoomReset');
  var graphArrangeBtn = document.getElementById('vcGraphArrange');
  var graphExpandBtn = document.getElementById('vcGraphExpand');
  // 整套生成在状态栏；本页自动同步 + 链路/变量编辑
  var statusEl    = document.getElementById('vcStatus');
  var resultDiv   = document.getElementById('vcResult');
  var checklistEl = document.getElementById('vcChecklist');
  var variablePreview = document.getElementById('vcVariablePreview');
  var variablePreviewList = document.getElementById('vcVariablePreviewList');
  var variableCountEl = document.getElementById('vcVariableCount');
  var graphVarMap = document.getElementById('vcGraphVarMap');
  var singleRequirement = document.getElementById('vcSingleRequirement');
  var btnAddOne = document.getElementById('btnVcAddOne');
  var summaryEl   = document.getElementById('vcSummary');
  var btnClear    = document.getElementById('btnVcClear');
  var btnDelete   = document.getElementById('btnVcDelete');
  var btnExport   = document.getElementById('btnVcExport');

  var codeEls = {
    schema:  document.getElementById('vcCodeSchema'),
    initvar: document.getElementById('vcCodeInitvar'),
    update:  document.getElementById('vcCodeUpdate'),
    format:  document.getElementById('vcCodeFormat'),
    varlist: document.getElementById('vcCodeVarlist'),
    regex:   document.getElementById('vcCodeRegex')
  };

  /* ============================================================
   *  生成数据
   * ============================================================ */
  var gen = { runtime:'', schema:'', initvar:'', varlist:'', updateRules:'', outputFormat:'', regexScripts:[], summary:'', design:null };

  /* ============================================================
   *  节点画布：缩放 / 平移 / 拖拽 / 手动连线
   * ============================================================ */
  var graphSize = { width: 1900, height: 980 };
  var graphState = { x: 0, y: 0, scale: 1 };
  var graphExpanded = false;
  var graphModal = null;
  var graphHomeMarker = null;
  var graphOriginalParent = null;
  var graphOriginalNext = null;
  var graphDrawFrame = 0;
  var graphLayoutSaveTimer = null;
  var graphCodeSaveTimer = null;
  var disabledDynamicConnections = {};
  var graphNodeCodes = {};
  var graphNodeCodeDefaults = {
    'user-message': 'input.user_message = 本轮用户输入\\ncontext.recent_messages = 最近聊天记录',
    'st-prompt': 'SillyTavern buildPrompt()\\n- 角色卡设定\\n- 聊天历史\\n- 预设 / 作者注释\\n- 世界书与扩展注入',
    'wb-constant': '[世界书常驻条目]\\n- 变量更新规则\\n- 变量输出格式\\n- 强规则 / 运行法则',
    'stat-data': '<status_current_variables>\\n{{format_message_variable::stat_data}}\\n</status_current_variables>',
    'ejs-router': '<%\\nconst affection = _.get(stat_data, "NPC.角色名.好感度", 0);\\nif (affection >= 60) {\\n  // 激活阶段世界书 / 阶段剧情\\n}\\n%>',
    'rule-inject': '规则注入草稿：\\n- 好感 Roll\\n- 随机事件\\n- 阻尼器：限制变量剧烈跳变\\n- 交易规则：金钱、库存、价格、风险',
    'model-generate': '模型应同时输出：\\n<story>剧情正文</story>\\n<UpdateVariable>变量更新 JSONPatch</UpdateVariable>',
    'story-output': '<story>\\n这里是展示给用户的剧情正文。\\n</story>',
    'update-output': '<UpdateVariable>\\n<Analysis>简短分析</Analysis>\\n<JSONPatch>\\n[{"op":"replace","path":"/世界/当前时间","value":"09:00"}]\\n</JSONPatch>\\n</UpdateVariable>',
    'mvu-patch': 'MVU JSONPatch 支持：\\nreplace / delta / insert / remove / move',
    'zod-validate': 'Zod Schema：\\n- 类型转换\\n- 默认值 prefault\\n- 数值范围 clamp\\n- 非法字段兜底',
    'varmap': 'stat_data 状态向量窗口\\n每个变量节点显示：变量路径 / 读取路径 / JSONPatch 路径',
    'status-event': 'eventOn(VARIABLE_UPDATE_ENDED, () => {\\n  // 刷新状态栏 / 重新渲染当前变量\\n});',
    'regex-display': '正则处理：\\n1. 隐藏 <UpdateVariable> 技术块\\n2. 只显示 <story> 正文\\n3. 美化状态栏更新结果'
  };
  var graphDefaultConnections = [
    { from: 'user-message:out', to: 'st-prompt:in', className: 'vc-wire-source' },
    { from: 'st-prompt:out', to: 'wb-constant:in', className: 'vc-wire-output' },
    { from: 'st-prompt:out', to: 'stat-data:in', className: 'vc-wire-output' },
    { from: 'wb-constant:out', to: 'ejs-router:in', className: 'vc-wire-require' },
    { from: 'stat-data:out', to: 'ejs-router:in', className: 'vc-wire-source' },
    { from: 'ejs-router:out', to: 'rule-inject:in', className: 'vc-wire-require' },
    { from: 'rule-inject:out', to: 'model-generate:in', className: 'vc-wire-output' },
    { from: 'model-generate:out', to: 'story-output:in', className: 'vc-wire-source' },
    { from: 'model-generate:out', to: 'update-output:in', className: 'vc-wire-require' },
    { from: 'update-output:out', to: 'mvu-patch:in', className: 'vc-wire-require' },
    { from: 'mvu-patch:out', to: 'zod-validate:in', className: 'vc-wire-output' },
    { from: 'zod-validate:out', to: 'varmap:in', className: 'vc-wire-output' },
    { from: 'varmap:out', to: 'status-event:in', className: 'vc-wire-source' },
    { from: 'status-event:out', to: 'regex-display:in', className: 'vc-wire-require' },
    { from: 'story-output:out', to: 'regex-display:in', className: 'vc-wire-source' }
  ];
  var graphConnections = graphDefaultConnections.map(function(conn) {
    return Object.assign({}, conn);
  });

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  function updateGraphSize(width, height) {
    graphSize.width = Math.max(1900, width || 1900);
    graphSize.height = Math.max(980, height || 980);
    if (graphSpace) {
      graphSpace.style.width = graphSize.width + 'px';
      graphSpace.style.height = graphSize.height + 'px';
    }
    var svg = document.getElementById('vcGraphSvg');
    if (svg) svg.setAttribute('viewBox', '0 0 ' + graphSize.width + ' ' + graphSize.height);
  }

  function applyGraphTransform() {
    if (!graphSpace) return;
    graphSpace.style.transform = 'translate(' + graphState.x + 'px,' + graphState.y + 'px) scale(' + graphState.scale + ')';
  }

  function graphPointFromClient(clientX, clientY) {
    var rect = graphSpace.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / graphState.scale,
      y: (clientY - rect.top) / graphState.scale
    };
  }

  function portCenter(portId) {
    var port = graphSpace.querySelector('[data-port="' + portId + '"]');
    if (!port) return { x: 0, y: 0 };
    var x = port.offsetLeft + port.offsetWidth / 2;
    var y = port.offsetTop + port.offsetHeight / 2;
    var parent = port.offsetParent;
    while (parent && parent !== graphSpace) {
      x += parent.offsetLeft;
      y += parent.offsetTop;
      parent = parent.offsetParent;
    }
    return { x: x, y: y };
  }

  function wirePath(a, b) {
    var dx = Math.max(90, Math.abs(b.x - a.x) * 0.52);
    return 'M ' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) +
      ' C ' + (a.x + dx).toFixed(1) + ' ' + a.y.toFixed(1) +
      ', ' + (b.x - dx).toFixed(1) + ' ' + b.y.toFixed(1) +
      ', ' + b.x.toFixed(1) + ' ' + b.y.toFixed(1);
  }

  function drawGraphWires() {
    if (!graphWires) return;
    graphDrawFrame = 0;
    graphWires.innerHTML = graphConnections.map(function(conn, index) {
      var a = portCenter(conn.from);
      var b = portCenter(conn.to);
      var d = wirePath(a, b);
      return '<path class="vc-wire-hit" data-conn-index="' + index + '" d="' + d + '" />'
        + '<path class="vc-wire ' + conn.className + '" d="' + d + '" />';
    }).join('');
  }

  function scheduleGraphWireDraw() {
    if (graphDrawFrame) return;
    graphDrawFrame = requestAnimationFrame(drawGraphWires);
  }

  function getSavedGraphLayout() {
    if (!window.__getCardExtension__) return null;
    var data = window.__getCardExtension__('zmer_mvu_runtime_graph');
    return data && typeof data === 'object' ? data : null;
  }

  function getSavedNodePosition(nodeId) {
    var layout = getSavedGraphLayout();
    var pos = layout && layout.positions && layout.positions[nodeId];
    if (!pos) return null;
    var x = Number(pos.x);
    var y = Number(pos.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x: x, y: y };
  }

  function collectGraphPositions() {
    var positions = {};
    graphSpace.querySelectorAll('.vc-node[data-node]').forEach(function(node) {
      positions[node.dataset.node] = {
        x: Math.round(parseFloat(node.style.left || '0')),
        y: Math.round(parseFloat(node.style.top || '0'))
      };
    });
    return positions;
  }

  function collectGraphCodes() {
    var codes = {};
    graphSpace.querySelectorAll('.vc-node-code-editor[data-node-code]').forEach(function(editor) {
      codes[editor.dataset.nodeCode] = editor.value;
    });
    Object.keys(graphNodeCodes || {}).forEach(function(key) {
      if (codes[key] === undefined) codes[key] = graphNodeCodes[key];
    });
    return codes;
  }

  function serializableGraphConnections() {
    return graphConnections
      .filter(function(conn) { return !conn.dynamicVar; })
      .map(function(conn) {
        return { from: conn.from, to: conn.to, className: conn.className || 'vc-wire-source' };
      });
  }

  function connectionKey(conn) {
    if (!conn) return '';
    return String(conn.stableKey || (conn.from + '=>' + conn.to));
  }

  function saveGraphLayoutSoon() {
    clearTimeout(graphLayoutSaveTimer);
    graphLayoutSaveTimer = setTimeout(function() {
      if (!window.__setCardExtension__) return;
      suppressAutoSyncUntil = Date.now() + 700;
      window.__setCardExtension__('zmer_mvu_runtime_graph', {
        version: 1,
        positions: collectGraphPositions(),
        connections: serializableGraphConnections(),
        disabledDynamicConnections: Object.keys(disabledDynamicConnections).filter(function(key) { return disabledDynamicConnections[key]; }),
        codes: collectGraphCodes(),
        updatedAt: new Date().toISOString()
      });
    }, 180);
  }

  function saveGraphCodesSoon() {
    clearTimeout(graphCodeSaveTimer);
    graphCodeSaveTimer = setTimeout(saveGraphLayoutSoon, 120);
  }

  function restoreGraphConnectionsFromLayout() {
    var layout = getSavedGraphLayout();
    if (!layout) return;
    disabledDynamicConnections = {};
    (Array.isArray(layout.disabledDynamicConnections) ? layout.disabledDynamicConnections : []).forEach(function(key) {
      if (key) disabledDynamicConnections[key] = true;
    });
    graphNodeCodes = layout.codes && typeof layout.codes === 'object' ? Object.assign({}, layout.codes) : {};
    if (!Array.isArray(layout.connections)) return;
    var dynamic = graphConnections.filter(function(conn) {
      return conn.dynamicVar && !disabledDynamicConnections[connectionKey(conn)];
    });
    graphConnections = layout.connections
      .filter(function(conn) { return conn && conn.from && conn.to; })
      .map(function(conn) {
        return { from: String(conn.from), to: String(conn.to), className: conn.className || 'vc-wire-source' };
      })
      .concat(dynamic);
  }

  function applySavedGraphLayout() {
    var layout = getSavedGraphLayout();
    if (!layout) return;
    restoreGraphConnectionsFromLayout();
    if (!layout.positions) {
      scheduleGraphWireDraw();
      return;
    }
    graphSpace.querySelectorAll('.vc-node[data-node]').forEach(function(node) {
      var pos = getSavedNodePosition(node.dataset.node);
      if (!pos) return;
      node.style.left = pos.x + 'px';
      node.style.top = pos.y + 'px';
    });
    growGraphToFitNodes();
    renderNodeCodeEditors();
    scheduleGraphWireDraw();
  }

  function getNodeCode(nodeId) {
    if (graphNodeCodes && graphNodeCodes[nodeId] !== undefined) return String(graphNodeCodes[nodeId]);
    return graphNodeCodeDefaults[nodeId] || '';
  }

  function renderNodeCodeEditors() {
    graphSpace.querySelectorAll('.vc-flow-node[data-node]').forEach(function(node) {
      if (node.classList.contains('vc-node-varitem')) return;
      var nodeId = node.dataset.node;
      var panel = node.querySelector('.vc-node-code-panel');
      if (!panel) {
        panel = document.createElement('div');
        panel.className = 'vc-node-code-panel';
        panel.innerHTML =
          '<button type="button" class="vc-node-code-toggle">代码</button>'
          + '<div class="vc-node-code-body">'
          + '<textarea class="vc-node-code-editor" spellcheck="false"></textarea>'
          + '<div class="vc-node-code-hint">保存到角色卡 extensions，仅构建器读取。</div>'
          + '</div>';
        node.appendChild(panel);
        panel.querySelector('.vc-node-code-toggle').addEventListener('click', function() {
          panel.classList.toggle('is-open');
          growGraphToFitNodes();
          scheduleGraphWireDraw();
        });
        panel.querySelector('.vc-node-code-editor').addEventListener('input', function(ev) {
          graphNodeCodes[nodeId] = ev.target.value;
          growGraphToFitNodes();
          scheduleGraphWireDraw();
          saveGraphCodesSoon();
        });
      }
      var editor = panel.querySelector('.vc-node-code-editor');
      if (editor) {
        editor.dataset.nodeCode = nodeId;
        if (document.activeElement !== editor) editor.value = getNodeCode(nodeId);
      }
    });
    growGraphToFitNodes();
    scheduleGraphWireDraw();
  }

  function nodeIdFromPort(portId) {
    return String(portId || '').split(':')[0];
  }

  function isRuntimeNodeReachable(nodeId) {
    var target = String(nodeId || '');
    if (!target) return false;
    var seen = { 'user-message': true };
    var queue = ['user-message'];
    while (queue.length) {
      var current = queue.shift();
      if (current === target) return true;
      graphConnections.forEach(function(conn) {
        if (conn.dynamicVar) return;
        if (nodeIdFromPort(conn.from) !== current) return;
        var next = nodeIdFromPort(conn.to);
        if (!seen[next]) {
          seen[next] = true;
          queue.push(next);
        }
      });
    }
    return false;
  }

  function runtimeModuleState() {
    return {
      initvar: true,
      varlist: isRuntimeNodeReachable('stat-data') || isRuntimeNodeReachable('varmap'),
      updateRules: isRuntimeNodeReachable('rule-inject') || isRuntimeNodeReachable('update-output') || isRuntimeNodeReachable('mvu-patch'),
      outputFormat: isRuntimeNodeReachable('rule-inject') || isRuntimeNodeReachable('update-output'),
      zod: isRuntimeNodeReachable('zod-validate'),
      regex: isRuntimeNodeReachable('regex-display')
    };
  }

  function removeGraphConnection(index) {
    var conn = graphConnections[index];
    if (!conn) return;
    var viewBefore = snapshotGraphView();
    var from = nodeIdFromPort(conn.from);
    var to = nodeIdFromPort(conn.to);
    if (!confirm('断开「' + from + ' → ' + to + '」？\n断开后，不可达模块会在变量卡注入时被禁用。')) return;
    if (conn.dynamicVar) disabledDynamicConnections[connectionKey(conn)] = true;
    graphConnections.splice(index, 1);
    scheduleGraphWireDraw();
    saveGraphLayoutSoon();
    if (gen.design) rebuildOutputsFromDesign(gen.design, { message:'已按当前链路刷新变量卡模块启用状态', preserveGraphView:viewBefore });
  }

  function growGraphToFitNodes() {
    var maxX = graphSize.width;
    var maxY = graphSize.height;
    graphSpace.querySelectorAll('.vc-node[data-node]').forEach(function(node) {
      var left = parseFloat(node.style.left || '0');
      var top = parseFloat(node.style.top || '0');
      if (!Number.isFinite(left) || !Number.isFinite(top)) return;
      maxX = Math.max(maxX, left + node.offsetWidth + 360);
      maxY = Math.max(maxY, top + node.offsetHeight + 360);
    });
    if (maxX > graphSize.width || maxY > graphSize.height) updateGraphSize(maxX, maxY);
  }

  function setGraphNodePosition(nodeId, left, top) {
    var node = graphSpace.querySelector('.vc-node[data-node="' + nodeId + '"]');
    if (!node) return null;
    node.style.left = Math.round(left) + 'px';
    node.style.top = Math.round(top) + 'px';
    return node;
  }

  function arrangeGraphNodes() {
    if (!graphSpace) return;

    var columns = {
      0: 48,
      1: 320,
      2: 620,
      3: 930,
      4: 1240,
      5: 1550
    };
    var layout = {
      'wb-constant': { col: 2, row: 0 },
      'ejs-router': { col: 3, row: 0 },
      'story-output': { col: 5, row: 0 },
      'user-message': { col: 0, row: 1 },
      'st-prompt': { col: 1, row: 1 },
      'model-generate': { col: 4, row: 1 },
      'stat-data': { col: 2, row: 2 },
      'rule-inject': { col: 3, row: 2 },
      'update-output': { col: 5, row: 2 },
      'regex-display': { col: 0, row: 3 },
      'status-event': { col: 1, row: 3 },
      'varmap': { col: 2, row: 3 },
      'zod-validate': { col: 3, row: 3 },
      'mvu-patch': { col: 4, row: 3 }
    };
    var rowIds = [
      ['wb-constant', 'ejs-router', 'story-output'],
      ['user-message', 'st-prompt', 'model-generate'],
      ['stat-data', 'rule-inject', 'update-output'],
      ['regex-display', 'status-event', 'varmap', 'zod-validate', 'mvu-patch']
    ];
    var rowGap = [74, 76, 88];
    var rowTops = [];
    var nextTop = 52;

    rowIds.forEach(function(ids, index) {
      var maxHeight = 0;
      ids.forEach(function(nodeId) {
        var node = graphSpace.querySelector('.vc-node[data-node="' + nodeId + '"]');
        if (!node) return;
        maxHeight = Math.max(maxHeight, node.offsetHeight || 0);
      });
      if (!maxHeight) maxHeight = index === 3 ? 150 : 118;
      rowTops[index] = nextTop;
      nextTop += maxHeight + (rowGap[index] || 0);
    });

    Object.keys(layout).forEach(function(nodeId) {
      var conf = layout[nodeId];
      setGraphNodePosition(nodeId, columns[conf.col], rowTops[conf.row]);
    });

    var varNodes = Array.from(graphSpace.querySelectorAll('.vc-node-varitem[data-node]'));
    if (varNodes.length) {
      var maxBottom = 0;
      graphSpace.querySelectorAll('.vc-node[data-node]:not(.vc-node-varitem)').forEach(function(node) {
        var top = parseFloat(node.style.top || '0');
        if (!Number.isFinite(top)) return;
        maxBottom = Math.max(maxBottom, top + (node.offsetHeight || 0));
      });

      var startY = Math.round(maxBottom + 92);
      var startX = 58;
      var nodeWidth = 260;
      var gapX = 36;
      var gapY = 22;
      var varColumns = varNodes.length >= 10 ? 5 : varNodes.length >= 6 ? 4 : varNodes.length >= 3 ? 3 : Math.max(1, varNodes.length);

      varNodes.forEach(function(node, index) {
        var col = index % varColumns;
        var row = Math.floor(index / varColumns);
        var x = startX + col * (nodeWidth + gapX);
        var y = startY + row * ((node.offsetHeight || 118) + gapY);
        node.style.left = x + 'px';
        node.style.top = y + 'px';
      });

      var totalRows = Math.ceil(varNodes.length / varColumns);
      updateGraphSize(
        Math.max(1900, startX + varColumns * (nodeWidth + gapX) + 120),
        Math.max(980, startY + totalRows * (150 + gapY) + 160)
      );
    } else {
      updateGraphSize(1900, Math.max(980, nextTop + 180));
    }

    growGraphToFitNodes();
    fitGraph();
    scheduleGraphWireDraw();
    saveGraphLayoutSoon();
  }

  function fitGraph() {
    if (!graphViewport) return;
    var rect = graphViewport.getBoundingClientRect();
    var scale = clamp(Math.min((rect.width - 28) / graphSize.width, (rect.height - 28) / graphSize.height), 0.18, 1);
    graphState.scale = scale;
    graphState.x = Math.round((rect.width - graphSize.width * scale) / 2);
    graphState.y = Math.round((rect.height - graphSize.height * scale) / 2);
    applyGraphTransform();
  }

  function zoomGraph(delta, clientX, clientY) {
    if (!graphViewport) return;
    var oldScale = graphState.scale;
    var nextScale = clamp(oldScale * delta, 0.18, 1.65);
    var rect = graphViewport.getBoundingClientRect();
    var vx = (typeof clientX === 'number' ? clientX : rect.left + rect.width / 2) - rect.left;
    var vy = (typeof clientY === 'number' ? clientY : rect.top + rect.height / 2) - rect.top;
    var localX = (vx - graphState.x) / oldScale;
    var localY = (vy - graphState.y) / oldScale;
    graphState.scale = nextScale;
    graphState.x = vx - localX * nextScale;
    graphState.y = vy - localY * nextScale;
    applyGraphTransform();
  }

  function snapshotGraphView() {
    return { x: graphState.x, y: graphState.y, scale: graphState.scale };
  }

  function restoreGraphView(view) {
    if (!view) return;
    graphState.x = view.x;
    graphState.y = view.y;
    graphState.scale = view.scale;
    applyGraphTransform();
  }

  function ensureGraphHome(canvas) {
    if (graphHomeMarker || !canvas || !canvas.parentNode) return;
    graphHomeMarker = document.createComment('vc-graph-home');
    graphOriginalParent = canvas.parentNode;
    graphOriginalNext = canvas.nextSibling;
    graphOriginalParent.insertBefore(graphHomeMarker, canvas);
  }

  function openGraphModal(canvas) {
    if (!canvas || graphModal) return;
    ensureGraphHome(canvas);
    graphModal = document.createElement('div');
    graphModal.className = 'vc-graph-modal';
    graphModal.setAttribute('role', 'dialog');
    graphModal.setAttribute('aria-modal', 'true');
    graphModal.setAttribute('aria-label', 'MVU 节点大屏编辑');
    document.body.appendChild(graphModal);
    graphModal.appendChild(canvas);
  }

  function closeGraphModal(canvas) {
    if (!canvas) return;
    if (graphHomeMarker && graphHomeMarker.parentNode) {
      graphHomeMarker.parentNode.replaceChild(canvas, graphHomeMarker);
    } else if (graphOriginalParent) {
      graphOriginalParent.insertBefore(canvas, graphOriginalNext || null);
    }
    graphHomeMarker = null;
    graphOriginalParent = null;
    graphOriginalNext = null;
    if (graphModal && graphModal.parentNode) graphModal.parentNode.removeChild(graphModal);
    graphModal = null;
  }

  function setGraphExpanded(expanded) {
    var canvas = document.getElementById('vcNodeCanvas');
    if (!canvas) return;
    graphExpanded = !!expanded;
    if (graphExpanded) openGraphModal(canvas);
    else closeGraphModal(canvas);
    canvas.classList.toggle('is-expanded', graphExpanded);
    if (graphExpandBtn) {
      graphExpandBtn.textContent = graphExpanded ? '×' : '⛶';
      graphExpandBtn.title = graphExpanded ? '关闭大屏编辑' : '展开编辑';
    }
    document.body.classList.toggle('vc-graph-body-locked', graphExpanded);
    setTimeout(function() {
      fitGraph();
      scheduleGraphWireDraw();
    }, 80);
  }

  function initNodeGraph() {
    if (!graphViewport || !graphSpace) return;

    fitGraph();
    scheduleGraphWireDraw();
    renderNodeCodeEditors();
    requestAnimationFrame(applySavedGraphLayout);
    window.addEventListener('resize', fitGraph);

    if (zoomInBtn) zoomInBtn.addEventListener('click', function() { zoomGraph(1.14); });
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', function() { zoomGraph(0.88); });
    if (zoomResetBtn) zoomResetBtn.addEventListener('click', fitGraph);
    if (graphArrangeBtn) graphArrangeBtn.addEventListener('click', arrangeGraphNodes);
    if (graphExpandBtn) graphExpandBtn.addEventListener('click', function() { setGraphExpanded(!graphExpanded); });
    window.addEventListener('keydown', function(ev) {
      if (ev.key === 'Escape' && graphExpanded) setGraphExpanded(false);
    });

    graphViewport.addEventListener('wheel', function(ev) {
      ev.preventDefault();
      zoomGraph(ev.deltaY < 0 ? 1.08 : 0.92, ev.clientX, ev.clientY);
    }, { passive: false });

    var activePan = null;
    var activeNode = null;
    var activeWire = null;

    graphWires.addEventListener('click', function(ev) {
      var path = ev.target.closest && ev.target.closest('[data-conn-index]');
      if (!path) return;
      ev.preventDefault();
      ev.stopPropagation();
      removeGraphConnection(Number(path.getAttribute('data-conn-index')));
    });
    graphWires.addEventListener('pointerdown', function(ev) {
      var path = ev.target.closest && ev.target.closest('[data-conn-index]');
      if (!path) return;
      ev.preventDefault();
      ev.stopPropagation();
    });

    graphViewport.addEventListener('pointerdown', function(ev) {
      var port = ev.target.closest && ev.target.closest('.vc-port');
      var handle = ev.target.closest && ev.target.closest('[data-drag-handle]');
      var ignored = ev.target.closest && ev.target.closest('textarea, button, input, select');

      if (port && port.dataset.kind === 'out') {
        ev.preventDefault();
        activeWire = { from: port.dataset.port };
        tempWire.classList.add('active');
        var start = portCenter(activeWire.from);
        var now = graphPointFromClient(ev.clientX, ev.clientY);
        tempWire.setAttribute('d', wirePath(start, now));
        graphViewport.setPointerCapture(ev.pointerId);
        return;
      }

      if (handle && !ignored) {
        var node = handle.closest('.vc-node');
        if (node) {
          ev.preventDefault();
          activeNode = {
            el: node,
            start: graphPointFromClient(ev.clientX, ev.clientY),
            left: parseFloat(node.style.left || '0'),
            top: parseFloat(node.style.top || '0')
          };
          graphViewport.setPointerCapture(ev.pointerId);
          return;
        }
      }

      if (!ignored) {
        ev.preventDefault();
        activePan = { x: ev.clientX, y: ev.clientY, tx: graphState.x, ty: graphState.y };
        graphViewport.classList.add('is-panning');
        graphViewport.setPointerCapture(ev.pointerId);
      }
    });

    graphViewport.addEventListener('pointermove', function(ev) {
      if (activeWire) {
        var start = portCenter(activeWire.from);
        var now = graphPointFromClient(ev.clientX, ev.clientY);
        tempWire.setAttribute('d', wirePath(start, now));
        return;
      }
      if (activeNode) {
        var nowPoint = graphPointFromClient(ev.clientX, ev.clientY);
        var left = activeNode.left + nowPoint.x - activeNode.start.x;
        var top = activeNode.top + nowPoint.y - activeNode.start.y;
        activeNode.el.style.left = left + 'px';
        activeNode.el.style.top = top + 'px';
        if (left + activeNode.el.offsetWidth + 360 > graphSize.width || top + activeNode.el.offsetHeight + 360 > graphSize.height) {
          updateGraphSize(Math.max(graphSize.width, left + activeNode.el.offsetWidth + 360), Math.max(graphSize.height, top + activeNode.el.offsetHeight + 360));
        }
        scheduleGraphWireDraw();
        return;
      }
      if (activePan) {
        graphState.x = activePan.tx + ev.clientX - activePan.x;
        graphState.y = activePan.ty + ev.clientY - activePan.y;
        applyGraphTransform();
      }
    });

    graphViewport.addEventListener('pointerup', function(ev) {
      if (activeWire) {
        var target = document.elementFromPoint(ev.clientX, ev.clientY);
        var inPort = target && target.closest ? target.closest('.vc-port[data-kind="in"]') : null;
        if (inPort) {
          var cls = activeWire.from.indexOf('require') === 0 ? 'vc-wire-require'
            : activeWire.from.indexOf('engine') === 0 ? 'vc-wire-output'
            : 'vc-wire-source';
          graphConnections = graphConnections.filter(function(conn) {
            return !(conn.from === activeWire.from && conn.to === inPort.dataset.port);
          });
          graphConnections.push({ from: activeWire.from, to: inPort.dataset.port, className: cls });
          saveGraphLayoutSoon();
          if (gen.design) rebuildOutputsFromDesign(gen.design, { message:'已按当前链路刷新变量卡模块启用状态', preserveGraphView:snapshotGraphView() });
        }
        activeWire = null;
        tempWire.classList.remove('active');
        tempWire.setAttribute('d', '');
        scheduleGraphWireDraw();
      }
      var shouldSaveNodeLayout = !!activeNode;
      activeNode = null;
      activePan = null;
      graphViewport.classList.remove('is-panning');
      if (shouldSaveNodeLayout) saveGraphLayoutSoon();
    });

    graphViewport.addEventListener('pointercancel', function() {
      activeWire = null;
      activeNode = null;
      activePan = null;
      tempWire.classList.remove('active');
      tempWire.setAttribute('d', '');
      graphViewport.classList.remove('is-panning');
      scheduleGraphWireDraw();
    });
  }

  initNodeGraph();

  /* ============================================================
   *  模板常量
   * ============================================================ */
  var MVU_RUNTIME_SCRIPT = "import 'https://testingcf.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js';";
  var SCHEMA_HEAD = "import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';\n\nexport const Schema = ";
  var SCHEMA_TAIL = "\n\n$(() => {\n  registerMvuSchema(Schema);\n});";

  var VARLIST_TPL = '---\n<status_current_variables>\n{{format_message_variable::stat_data}}\n</status_current_variables>';

  var FORMAT_TPL = '---\n变量输出格式:\n  rule:\n    - you must output the update analysis, JSONPatch commands, and visual DisplayPatch at once in the end of the next reply\n    - JSONPatch works like the **JSON Patch (RFC 6902)** standard, must be a valid JSON array containing operation objects, but supports the following operations instead:\n      - replace: replace the value of existing paths\n      - delta: update the value of existing number paths by a delta value\n      - insert: insert new items into an object or array (using `-` as array index intends appending to the end)\n      - remove\n      - move\n    - don\'t update field names starts with `_` as they are readonly\n    - DisplayPatch must mirror every JSONPatch operation with one visible <article> card; do not output raw JSON inside DisplayPatch\n    - DisplayPatch values should be concise human-readable text; if a value is an object or array, summarize it as readable text\n    - if DisplayPatch text contains < or >, rewrite them as Chinese brackets to avoid breaking HTML\n  format: |-\n    <UpdateVariable>\n    <Analysis>$(IN ENGLISH, no more than 80 words)\n    - ${calculate time passed: ...}\n    - ${decide whether dramatic updates are allowed as it\'s in a special case or the time passed is more than usual: yes/no}\n    - ${analyze every variable based on its corresponding `check`, according only to current reply instead of previous plots: ...}\n    </Analysis>\n    <JSONPatch>\n    [\n      { "op": "replace", "path": "${/path/to/variable}", "value": "${new_value}" },\n      { "op": "delta", "path": "${/path/to/number/variable}", "value": "${positive_or_negative_delta}" },\n      { "op": "insert", "path": "${/path/to/object/new_key}", "value": "${new_value}" },\n      { "op": "insert", "path": "${/path/to/array/-}", "value": "${new_value}" },\n      { "op": "remove", "path": "${/path/to/object/key}" },\n      { "op": "remove", "path": "${/path/to/array/0}" },\n      { "op": "move", "from": "${/path/to/variable}", "to": "${/path/to/another/path}" },\n      ...\n    ]\n    </JSONPatch>\n    </UpdateVariable>\n    <DisplayPatch>\n    <article class="mvu-change-card"><b>已更新</b><strong>${/path/to/variable}</strong><em>${new_value}</em></article>\n    <article class="mvu-change-card is-delta"><b>数值变化</b><strong>${/path/to/number/variable}</strong><em>${positive_or_negative_delta}</em></article>\n    <article class="mvu-change-card is-insert"><b>已新增</b><strong>${/path/to/object/new_key}</strong><em>${new_value}</em></article>\n    <article class="mvu-change-card is-remove"><b>已移除</b><strong>${/path/to/variable}</strong><em>已删除</em></article>\n    <article class="mvu-change-card"><b>已移动</b><strong>${/path/from}</strong><em>→ ${/path/to}</em></article>\n    </DisplayPatch>';

  var MVU_DISPLAY_HTML = '<style>'
    + '.mvu-report{margin:14px 0;border-radius:16px;border:1px solid rgba(245,158,11,.42);background:linear-gradient(180deg,rgba(31,22,12,.98),rgba(14,10,8,.98));overflow:hidden;box-shadow:0 18px 46px rgba(0,0,0,.42);font-family:Georgia,serif;position:relative;color:#f8fafc}'
    + '.mvu-report:before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(180deg,rgba(245,158,11,.035),rgba(245,158,11,.035) 2px,transparent 2px,transparent 5px);pointer-events:none}'
    + '.mvu-body{position:relative;padding:16px 18px 18px}.mvu-kicker{margin:0 0 12px;color:#facc15;font-size:.76rem;font-weight:900;letter-spacing:1px}'
    + '.mvu-change-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.mvu-change-card{min-width:0;padding:13px 15px;border-radius:13px;border:1px solid rgba(245,158,11,.36);background:linear-gradient(145deg,rgba(86,55,16,.35),rgba(22,16,10,.82));box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}'
    + '.mvu-change-card b{display:inline-flex;margin:0 0 8px;padding:3px 8px;border-radius:999px;background:rgba(245,158,11,.16);color:#fde68a;font-size:.68rem;font-style:normal}.mvu-change-card strong{display:block;color:#fef3c7;font-size:.88rem;line-height:1.45;word-break:break-word}.mvu-change-card em{display:block;margin-top:7px;color:#fff;font-size:.95rem;font-style:normal;font-weight:800;line-height:1.55;word-break:break-word}.mvu-change-card.is-insert{border-color:rgba(34,197,94,.42);background:linear-gradient(145deg,rgba(20,83,45,.32),rgba(14,18,12,.82))}.mvu-change-card.is-insert b{background:rgba(34,197,94,.18);color:#bbf7d0}.mvu-change-card.is-delta{border-color:rgba(56,189,248,.4);background:linear-gradient(145deg,rgba(8,47,73,.34),rgba(14,18,20,.82))}.mvu-change-card.is-delta b{background:rgba(56,189,248,.16);color:var(--color-accent-hover)}.mvu-change-card.is-remove{opacity:.82;border-color:rgba(248,113,113,.4)}'
    + '.mvu-raw{position:relative;margin-top:14px}.mvu-raw summary{cursor:pointer;color:var(--color-warning);font-size:.74rem;font-weight:800}.mvu-raw pre{margin:10px 0 0;padding:12px 14px;border-radius:10px;background:rgba(2,6,23,.58);border:1px solid rgba(245,158,11,.16);color:#fde68a;font-size:.72rem;line-height:1.55;overflow-x:auto;white-space:pre-wrap}'
    + '@media(max-width:720px){.mvu-change-grid{grid-template-columns:1fr}.mvu-body{padding:14px}}'
    + '</style>'
    + '<div class="mvu-report">'
    + '<div class="mvu-body"><div class="mvu-kicker">变量变更</div><div class="mvu-change-grid">$3</div>'
    + '<details class="mvu-raw"><summary>查看技术补丁</summary><pre>$2</pre></details></div>'
    + '</div>';

  var REGEX_SCRIPTS = [
    { id:'mvu_hide', scriptName:'[不发送]去除变量更新', findRegex:'<UpdateVariable>[\\s\\S]*?</UpdateVariable>\\s*<DisplayPatch>[\\s\\S]*?</DisplayPatch>', replaceString:'', trimStrings:[], placement:[2], disabled:false, markdownOnly:false, promptOnly:true, runOnEdit:true, substituteRegex:false, minDepth:null, maxDepth:null },
    { id:'mvu_display', scriptName:'[美化]变量更新状态卡', findRegex:'<UpdateVariable>\\s*<Analysis>([\\s\\S]*?)</Analysis>\\s*<JSONPatch>([\\s\\S]*?)</JSONPatch>\\s*</UpdateVariable>\\s*<DisplayPatch>\\s*([\\s\\S]*?)\\s*</DisplayPatch>', replaceString:MVU_DISPLAY_HTML, trimStrings:[], placement:[2], disabled:false, markdownOnly:true, promptOnly:false, runOnEdit:true, substituteRegex:false, minDepth:null, maxDepth:null }
  ];

  /* ============================================================
   *  同步检测
   * ============================================================ */
  var cardData = {};
  var lastSyncFingerprint = '';
  var syncTimer = null;
  var suppressAutoSyncUntil = 0;

  function makeMvuFingerprint(name, desc, wbArr) {
    var mvuBits = (wbArr || [])
      .filter(function(e) {
        var c = String(e.comment || '');
        return c.indexOf('[initvar]') >= 0 || c.indexOf('变量初始化') >= 0 || c.indexOf('[mvu_update]') >= 0;
      })
      .map(function(e) {
        return [
          e.comment || '',
          e.strategy || '',
          String(e.content || '').length,
          String(e.content || '').slice(0, 260),
          String(e.content || '').slice(-260)
        ].join('::');
      })
      .join('||');
    return [String(name || '').trim(), String(desc || '').length, (wbArr || []).length, mvuBits].join('###');
  }

  function clearMvuPreview() {
    gen = { runtime:'', schema:'', initvar:'', varlist:'', updateRules:'', outputFormat:'', regexScripts:[], summary:'', design:null };
    if (variablePreview) variablePreview.style.display = 'none';
    if (variablePreviewList) variablePreviewList.innerHTML = '';
    if (variableCountEl) variableCountEl.textContent = '0 个状态向量';
    renderGraphVariableMap(null);
    if (checklistEl) checklistEl.innerHTML = '';
    if (summaryEl) summaryEl.textContent = '';
    if (resultDiv) resultDiv.style.display = 'none';
    Object.keys(codeEls).forEach(function(k) {
      if (codeEls[k]) codeEls[k].textContent = '';
    });
  }

  function clearInjectedMvuArtifacts() {
    if (window.__injectMvuEntries__) {
      suppressAutoSyncUntil = Date.now() + 700;
      window.__injectMvuEntries__([
        { comment:'[initvar]变量初始化勿开', content:'', keys:[], strategy:'selective', position:0, depth:0, role:0, order:1000, prob:100, enabled:false },
        { comment:'变量列表', content:'', keys:[], strategy:'constant', position:4, depth:1, role:0, order:950, prob:100, enabled:false },
        { comment:'[mvu_update]变量更新规则', content:'', keys:[], strategy:'constant', position:4, depth:4, role:0, order:900, prob:100, enabled:false },
        { comment:'[mvu_update]变量输出格式', content:'', keys:[], strategy:'constant', position:4, depth:0, role:0, order:890, prob:100, enabled:false }
      ], REGEX_SCRIPTS.map(function(rx) {
        return Object.assign({}, rx, { disabled:true });
      }));
    }
    if (window.__setTavernHelperScript__) {
      window.__setTavernHelperScript__('MVU', '', false);
      window.__setTavernHelperScript__((cardData.name || '角色') + 'zod', '', false);
    }
  }

  function mvuArtifactNames() {
    return {
      comments: [
        '[initvar]变量初始化勿开',
        '变量列表',
        '[mvu_update]变量更新规则',
        '[mvu_update]变量输出格式'
      ],
      regexNames: REGEX_SCRIPTS.map(function(rx) { return rx.scriptName; }),
      helperNames: ['MVU', (cardData.name || '角色') + 'zod']
    };
  }

  function clearAllVariables() {
    if (!confirm('清除当前变量卡？\n这会清空变量预览，并禁用已注入的 MVU 世界书条目、正则和助手脚本。')) return;
    clearMvuPreview();
    if (window.__setCardExtension__) window.__setCardExtension__('zmer_mvu_design', null);
    clearInjectedMvuArtifacts();
    lastSyncFingerprint = '';
    setStatus('✅ 已清除变量卡并禁用已注入的 MVU 组件', 'var(--color-success)');
    scheduleRefreshSync(true);
  }

  function deleteAllVariables() {
    if (!confirm('彻底删除当前卡片中的 MVU 组件？\n这会移除变量世界书条目、正则脚本和助手脚本。')) return;
    clearMvuPreview();
    if (window.__setCardExtension__) window.__setCardExtension__('zmer_mvu_design', null);
    if (window.__deleteMvuArtifacts__) {
      suppressAutoSyncUntil = Date.now() + 700;
      window.__deleteMvuArtifacts__(mvuArtifactNames());
    } else {
      clearInjectedMvuArtifacts();
    }
    lastSyncFingerprint = '';
    setStatus('✅ 已删除当前卡片中的 MVU 变量组件', 'var(--color-success)');
    scheduleRefreshSync(true);
  }

  function refreshSync(options) {
    options = options || {};
    var name = (document.getElementById('charName') || {}).value || '';
    var desc = (document.getElementById('charDesc') || {}).value || '';
    var fmes = (document.getElementById('firstMes') || {}).value || '';
    var wbArr = window.__getWorldbookEntries__ ? window.__getWorldbookEntries__() : [];
    cardData = { name: name.trim(), desc: desc, firstMes: fmes, wb: wbArr };

    var fingerprint = makeMvuFingerprint(name, desc, wbArr);
    if (!options.force && fingerprint === lastSyncFingerprint) return !!(name.trim() || desc.trim());
    lastSyncFingerprint = fingerprint;

    if (!name.trim() && !desc.trim()) {
      setStatus('⚠️ 未检测到角色数据，请先在角色面板填写', 'var(--color-warning)');
      clearMvuPreview();
      return false;
    }
    var parts = ['📛 ' + (name.trim() || '?')];
    if (wbArr.length > 0) parts.push('📖 ' + wbArr.length + '条');

    var existingDesign = parseExistingMvuDesign(wbArr);
    if (existingDesign) {
      gen.design = existingDesign;
      gen.summary = existingDesign.summary;
      parts.push('🎛️ MVU ' + existingDesign.variables.length + '个');
      setStatus(parts.join(' · '), '#86efac');
      renderExistingMvuPreview(existingDesign);
    } else {
      parts.push('🎛️ 未读取到MVU');
      setStatus(parts.join(' · '), 'var(--color-text-muted)');
      clearMvuPreview();
    }
    return true;
  }

  function scheduleRefreshSync(force) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function() { refreshSync({ force: !!force }); }, 80);
  }

  if (btnClear) btnClear.addEventListener('click', clearAllVariables);
  if (btnDelete) btnDelete.addEventListener('click', deleteAllVariables);
  setTimeout(function() { refreshSync({ force:true }); }, 600);
  setInterval(function() { refreshSync(); }, 1200);
  window.addEventListener('worldbook-changed', function() {
    if (Date.now() < suppressAutoSyncUntil) return;
    scheduleRefreshSync(true);
  });
  window.addEventListener('card-builder-data-changed', function() {
    if (Date.now() < suppressAutoSyncUntil) return;
    setTimeout(applySavedGraphLayout, 120);
    // 非 force：指纹未变则跳过，避免与扩展写入形成刷新循环
    scheduleRefreshSync(false);
  });
  ['charName', 'charDesc', 'firstMes'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', function() { scheduleRefreshSync(false); });
  });

  // 挂钩全局更新
  var _origTrigger = window.triggerGlobalUpdate;
  window.triggerGlobalUpdate = function() {
    if (_origTrigger) _origTrigger();
    scheduleRefreshSync(true);
  };

  /* ============================================================
   *  复制
   * ============================================================ */
  document.querySelectorAll('.vc-copy-btn').forEach(function(b) {
    b.addEventListener('click', function() {
      var el = document.getElementById(b.getAttribute('data-target'));
      if (!el) return;
      navigator.clipboard.writeText(el.textContent).then(function() {
        var o = b.textContent; b.textContent = '✅';
        setTimeout(function() { b.textContent = o; }, 1200);
      });
    });
  });

  /* ============================================================
   *  工具
   * ============================================================ */
  function extractJson(text) {
    var m = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    var raw = m ? m[1].trim() : text.trim();
    var s = raw.indexOf('{'), e = raw.lastIndexOf('}');
    if (s >= 0 && e > s) raw = raw.substring(s, e + 1);
    return JSON.parse(raw);
  }
  function setStatus(t, c) {
    if (!statusEl) return;
    statusEl.textContent = t;
    statusEl.style.color = c || 'var(--color-text-muted)';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function compactDefault(value) {
    if (value === undefined) return 'undefined';
    var text = typeof value === 'string' ? value : JSON.stringify(value);
    if (text == null) text = '';
    return text.length > 80 ? text.slice(0, 77) + '...' : text;
  }

  function lastPathPart(path) {
    var parts = String(path || '').split('.').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : '';
  }

  function buildFallbackDescription(path, type) {
    var leaf = lastPathPart(path) || '变量';
    var top = String(path || '').split('.').filter(Boolean)[0] || '';
    var typeLabelMap = {
      string: '文本状态',
      number: '数值状态',
      boolean: '布尔状态',
      enum: '枚举状态',
      array: '列表状态',
      object: '对象状态'
    };
    var typeLabel = typeLabelMap[String(type || '').toLowerCase()] || '状态';
    if (top === '世界') return '用于记录世界层面的' + leaf + '，属于' + typeLabel + '。';
    if (top === '主角') return '用于记录主角当前的' + leaf + '，属于' + typeLabel + '。';
    if (top === 'NPC') return '用于记录角色相关的' + leaf + '，属于' + typeLabel + '。';
    if (top === '记忆') return '用于记录长期记忆中的' + leaf + '，属于' + typeLabel + '。';
    if (top === '任务') return '用于记录任务系统中的' + leaf + '，属于' + typeLabel + '。';
    return '用于记录“' + leaf + '”这个' + typeLabel + '。';
  }

  function buildFallbackChecks(path, type) {
    var leaf = lastPathPart(path) || '变量';
    var normalizedType = String(type || '').toLowerCase();
    if (normalizedType === 'number') {
      return ['仅当剧情明确导致' + leaf + '增减时更新；无变化不要输出操作'];
    }
    if (normalizedType === 'boolean') {
      return ['仅当剧情中明确满足或取消“' + leaf + '”条件时切换 true/false'];
    }
    if (normalizedType === 'object' || normalizedType === 'array') {
      return ['仅当剧情明确新增、移除或修改“' + leaf + '”内容时更新'];
    }
    return ['仅当剧情明确导致“' + leaf + '”变化时更新；无变化不要输出操作'];
  }

  function jsonPatchPath(path) {
    return '/' + String(path || '')
      .split('.')
      .filter(Boolean)
      .map(function(part) {
        return part.replace(/~/g, '~0').replace(/\//g, '~1');
      })
      .join('/');
  }

  function statDataPath(path) {
    return 'stat_data.' + String(path || '').split('.').filter(Boolean).join('.');
  }

  function inferType(value) {
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'array';
    if (value && typeof value === 'object') return 'object';
    return 'string';
  }

  function parseScalar(text) {
    var raw = String(text == null ? '' : text).trim();
    if (!raw || raw === '""' || raw === "''") return '';
    if (raw === '{}') return {};
    if (raw === '[]') return [];
    if (/^(true|false)$/i.test(raw)) return raw.toLowerCase() === 'true';
    if (/^-?\d+(?:\.\d+)?$/.test(raw)) return Number(raw);
    if ((raw[0] === '"' && raw[raw.length - 1] === '"') || (raw[0] === "'" && raw[raw.length - 1] === "'")) {
      try { return JSON.parse(raw); } catch(e) { return raw.slice(1, -1); }
    }
    if ((raw[0] === '{' && raw[raw.length - 1] === '}') || (raw[0] === '[' && raw[raw.length - 1] === ']')) {
      try { return JSON.parse(raw); } catch(e) {}
    }
    return raw;
  }

  function parseSimpleYaml(text) {
    var root = {};
    var stack = [{ indent: -1, obj: root }];
    String(text || '').split(/\r?\n/).forEach(function(line) {
      if (!line.trim() || /^\s*#/.test(line) || /^\s*---\s*$/.test(line)) return;
      var m = line.match(/^(\s*)([^:#][^:]*):(?:\s*(.*))?$/);
      if (!m) return;
      var indent = m[1].length;
      var key = m[2].trim();
      var valueText = (m[3] || '').trim();
      while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
      var parent = stack[stack.length - 1].obj;
      if (!valueText) {
        parent[key] = parent[key] && typeof parent[key] === 'object' && !Array.isArray(parent[key]) ? parent[key] : {};
        stack.push({ indent: indent, obj: parent[key] });
      } else {
        parent[key] = parseScalar(valueText);
      }
    });
    return root;
  }

  function flattenObjectToVariables(obj, prefix, out) {
    Object.keys(obj || {}).forEach(function(key) {
      var value = obj[key];
      var path = prefix ? prefix + '.' + key : key;
      if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length) {
        flattenObjectToVariables(value, path, out);
      } else {
        out.push({
          path: path,
          type: inferType(value),
          default: value,
          description: '从角色卡已有变量初始化中读取',
          check: []
        });
      }
    });
  }

  function parseExistingMvuDesign(wbArr) {
    var initEntry = (wbArr || []).find(function(e) {
      var c = String(e.comment || '');
      return c.indexOf('[initvar]') >= 0 || c.indexOf('变量初始化') >= 0;
    });
    if (!initEntry || !String(initEntry.content || '').trim()) return null;
    var obj = parseSimpleYaml(initEntry.content);
    var variables = [];
    flattenObjectToVariables(obj, '', variables);
    variables = variables.filter(function(v) { return v.path && v.path.indexOf('---') !== 0; });
    if (!variables.length) return null;
    return {
      variables: variables,
      summary: '从角色卡已有 [initvar] 变量初始化中读取',
      source: 'existing-initvar'
    };
  }

  function jsString(value) {
    return JSON.stringify(String(value == null ? '' : value));
  }

  function jsValue(value) {
    if (value === undefined) return 'undefined';
    return JSON.stringify(value);
  }

  function sanitizePath(path) {
    return String(path || '')
      .replace(/[\\/]+/g, '.')
      .split('.')
      .map(function(part) { return part.trim(); })
      .filter(Boolean)
      .join('.');
  }

  function uniqueByPath(vars) {
    var seen = {};
    var out = [];
    vars.forEach(function(v) {
      var path = sanitizePath(v && v.path);
      if (!path || seen[path]) return;
      seen[path] = true;
      v.path = path;
      out.push(v);
    });
    return out;
  }

  function normalizeVariableItem(v) {
    v = v || {};
    var type = String(v.type || 'string').toLowerCase();
    if (['text', 'str'].indexOf(type) >= 0) type = 'string';
    if (['int', 'float', 'integer'].indexOf(type) >= 0) type = 'number';
    if (['bool'].indexOf(type) >= 0) type = 'boolean';
    if (['map', 'record', 'dict'].indexOf(type) >= 0) type = 'object';
    if (['string', 'number', 'boolean', 'enum', 'array', 'object'].indexOf(type) < 0) type = 'string';
    var checks = Array.isArray(v.check) ? v.check : (Array.isArray(v.rules) ? v.rules : (v.check ? [v.check] : []));
    var options = Array.isArray(v.options) ? v.options.map(String).filter(Boolean).slice(0, 16) : [];
    var normalizedPath = sanitizePath(v.path || v.name);
    var normalizedChecks = checks.map(String).filter(Boolean).slice(0, 6);
    var description = String(v.description || v.desc || '').trim();
    var def = v.default;
    if (def === undefined) {
      if (type === 'number') def = 0;
      else if (type === 'boolean') def = false;
      else if (type === 'array') def = [];
      else if (type === 'object') def = {};
      else if (type === 'enum') def = options[0] || '';
      else def = '';
    }
    return {
      path: normalizedPath,
      type: type,
      default: def,
      min: v.min,
      max: v.max,
      options: options,
      format: v.format || '',
      description: description || buildFallbackDescription(normalizedPath, type),
      check: normalizedChecks.length ? normalizedChecks : buildFallbackChecks(normalizedPath, type),
    };
  }

  function guessNpcNames() {
    var names = [];
    (cardData.wb || []).forEach(function(e) {
      var c = String(e.comment || '').replace(/[=\[\]【】_阶段0-9不允许打开勿开]/g, '').trim();
      if (c && c.length >= 2 && c.length <= 6 && names.indexOf(c) < 0) names.push(c);
    });
    return names.slice(0, 6);
  }

  function baseVariables() {
    var npcNames = guessNpcNames();
    var vars = [
      { path:'世界.当前日期', type:'string', default:'第1天', description:'当前剧情日期', check:['随休息、跨天或明确时间跳转推进'] },
      { path:'世界.当前时间', type:'string', default:'08:00', description:'当前时间，HH:MM', format:'HH:MM', check:['根据行动耗时、移动、等待或用户指定时间推进'] },
      { path:'世界.当前地点', type:'string', default:'未确定', description:'当前主要场景地点', check:['随主角移动或场景切换更新'] },
      { path:'世界.当前场景', type:'string', default:'开局', description:'当前剧情场景概括', check:['每轮用短语概括当前场面'] },
      { path:'世界.剧情阶段', type:'string', default:'开局', description:'整体剧情阶段', check:['根据主线进展、关系推进和关键事件更新'] },
      { path:'主角.当前状态', type:'string', default:'正常', description:'主角身体与精神状态', check:['根据疲劳、受伤、疾病、情绪压力更新'] },
      { path:'主角.体力', type:'number', default:100, min:0, max:100, description:'主角可行动体力', check:['行动消耗体力，休息恢复体力'] },
      { path:'主角.金钱', type:'number', default:0, min:0, description:'主角当前可用金钱', check:['收入增加，消费减少，不得低于0'] },
      { path:'主角.持有物', type:'object', default:{}, description:'主角持有的重要物品表', check:['获得、消耗、赠送、丢失物品时更新'] },
      { path:'记忆.本轮摘要', type:'string', default:'', description:'本轮剧情摘要', check:['每轮用100字以内记录关键变化'] },
      { path:'记忆.重要线索', type:'object', default:{}, description:'长期保存的重要线索、伏笔、承诺', check:['出现长期影响信息时插入或更新'] },
      { path:'任务.当前目标', type:'string', default:'自由行动', description:'当前主要目标或待办', check:['用户确立目标、接受任务、目标完成时更新'] },
      { path:'任务.进行中', type:'object', default:{}, description:'进行中的任务和约定', check:['新增、完成、失败或取消任务时更新'] },
    ];

    npcNames.forEach(function(name) {
      vars.push(
        { path:'NPC.' + name + '.当前情绪', type:'string', default:'平静', description:name + '当前情绪', check:['根据本轮互动、处境和内心压力更新'] },
        { path:'NPC.' + name + '.当前行动', type:'string', default:'按自己的日程行动', description:name + '当前行动', check:['即使不在场，也根据时间和日程独立更新'] },
        { path:'NPC.' + name + '.关系状态', type:'string', default:'陌生', description:'与主角的关系状态', check:['根据长期互动和关键事件更新'] },
        { path:'NPC.' + name + '.好感度', type:'number', default:0, min:-100, max:100, description:'对主角的好感/信任变化', check:['有效正向互动增加，冒犯、伤害或失约降低'] },
        { path:'NPC.' + name + '.印象', type:'string', default:'陌生人-中', description:'对主角的主观印象', check:['根据主角持续行为形成更具体印象，后缀可用正/中/负'] }
      );
    });

    return vars;
  }

  function normalizeVariableDesign(raw) {
    var source = raw || {};
    var vars = [];
    if (Array.isArray(source.variables)) vars = source.variables;
    else if (Array.isArray(source.fields)) vars = source.fields;
    else if (source.design && Array.isArray(source.design.variables)) vars = source.design.variables;

    vars = vars.map(normalizeVariableItem);

    vars = uniqueByPath(vars.concat(baseVariables())).slice(0, 90);
    return {
      variables: vars,
      summary: String(source.summary || source.variable_summary || '已生成稳定 MVU 变量系统').slice(0, 80),
    };
  }

  function insertTree(root, variable) {
    var parts = variable.path.split('.');
    var node = root;
    parts.forEach(function(part, i) {
      node.children = node.children || {};
      node.children[part] = node.children[part] || { name: part, children: {}, field: null };
      node = node.children[part];
      if (i === parts.length - 1) node.field = variable;
    });
  }

  function buildTree(vars) {
    var root = { children: {} };
    vars.forEach(function(v) { insertTree(root, v); });
    return root;
  }

  function renderLeafSchema(field) {
    var desc = field.description ? '.describe(' + jsString(field.description) + ')' : '';
    var prefault = '.prefault(' + jsValue(field.default) + ')';
    if (field.type === 'number') {
      var expr = 'z.coerce.number()' + desc;
      if (field.min !== undefined || field.max !== undefined) {
        var min = Number.isFinite(Number(field.min)) ? Number(field.min) : 'Number.NEGATIVE_INFINITY';
        var max = Number.isFinite(Number(field.max)) ? Number(field.max) : 'Number.POSITIVE_INFINITY';
        expr += '.transform(v => _.clamp(v, ' + min + ', ' + max + '))';
      }
      return expr + prefault;
    }
    if (field.type === 'boolean') return 'z.boolean()' + desc + prefault;
    if (field.type === 'enum' && field.options.length) return 'z.enum(' + jsValue(field.options) + ')' + desc + prefault;
    if (field.type === 'array') return 'z.array(z.string())' + desc + prefault;
    if (field.type === 'object') return 'z.record(z.string(), z.any())' + desc + prefault;
    return 'z.string()' + desc + prefault;
  }

  function renderNodeSchema(node, indent) {
    var keys = Object.keys(node.children || {});
    if (!keys.length && node.field) return renderLeafSchema(node.field);
    var pad = ' '.repeat(indent);
    var inner = keys.map(function(key) {
      return pad + '  ' + jsString(key) + ': ' + renderNodeSchema(node.children[key], indent + 2);
    }).join(',\n');
    return 'z.object({\n' + inner + '\n' + pad + '}).prefault({})';
  }

  function buildSchemaBody(design) {
    return renderNodeSchema(buildTree(design.variables), 0);
  }

  function setNested(obj, path, value) {
    var parts = path.split('.');
    var cur = obj;
    parts.forEach(function(part, i) {
      if (i === parts.length - 1) { cur[part] = value; return; }
      cur[part] = cur[part] && typeof cur[part] === 'object' && !Array.isArray(cur[part]) ? cur[part] : {};
      cur = cur[part];
    });
  }

  function yamlScalar(value) {
    if (value === null) return 'null';
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return value.length ? JSON.stringify(value) : '[]';
    if (typeof value === 'object') return '{}';
    var s = String(value);
    if (!s) return '""';
    if (/[:#{}\[\],&*?|\-<>=!%@`]|^\s|\s$/.test(s)) return JSON.stringify(s);
    return s;
  }

  function renderYamlValue(value, indent) {
    var pad = ' '.repeat(indent);
    if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length) {
      return '\n' + Object.keys(value).map(function(k) {
        return pad + k + ':' + renderYamlValue(value[k], indent + 2);
      }).join('\n');
    }
    return ' ' + yamlScalar(value);
  }

  function buildInitYaml(design) {
    var root = {};
    design.variables.forEach(function(v) { setNested(root, v.path, v.default); });
    return Object.keys(root).map(function(k) { return k + ':' + renderYamlValue(root[k], 2); }).join('\n');
  }

  function buildUpdateRules(design) {
    var lines = ['---', '变量更新规则:'];
    design.variables.forEach(function(v) {
      lines.push('');
      lines.push('  ' + v.path + ':');
      lines.push('    type: ' + v.type);
      if (v.min !== undefined || v.max !== undefined) lines.push('    range: ' + (v.min ?? '-∞') + '~' + (v.max ?? '+∞'));
      if (v.options && v.options.length) lines.push('    options: ' + v.options.join(' / '));
      if (v.format) lines.push('    format: ' + v.format);
      if (v.description) lines.push('    desc: ' + v.description);
      lines.push('    check:');
      var checks = v.check && v.check.length ? v.check : ['仅当本轮剧情明确导致该变量变化时更新；无变化不要输出操作'];
      checks.forEach(function(c) { lines.push('      - ' + c); });
    });
    return lines.join('\n');
  }

  /* ============================================================
   *  渲染清单
   * ============================================================ */
  function renderChecklist(items) {
    checklistEl.innerHTML = items.map(function(it) {
      return '<div class="vc-check-item ok"><span class="vc-check-icon">✅</span>'
        + '<span class="vc-check-label">' + it.label + '</span>'
        + '<span class="vc-check-badge">' + it.badge + '</span></div>';
    }).join('');
  }

  function renderVariablePreview(design) {
    if (!variablePreview || !variablePreviewList || !variableCountEl || !design || !Array.isArray(design.variables)) return;
    var groups = {};
    design.variables.forEach(function(v) {
      var top = String(v.path || '').split('.')[0] || '其他';
      groups[top] = groups[top] || [];
      groups[top].push(v);
    });
    var html = Object.keys(groups).map(function(groupName) {
      var vars = groups[groupName];
      return '<section class="vc-var-group">'
        + '<div class="vc-var-group-title">' + escapeHtml(groupName) + '<span>' + vars.length + '</span></div>'
        + '<div class="vc-var-list">'
        + vars.map(function(v) {
          var desc = v.description || (v.check && v.check[0]) || '';
          return '<article class="vc-var-item">'
            + '<div class="vc-var-path">' + escapeHtml(v.path) + '</div>'
            + '<div class="vc-var-type">' + escapeHtml(v.type || 'string') + '</div>'
            + (desc ? '<div class="vc-var-desc">' + escapeHtml(desc) + '</div>' : '')
            + '<div class="vc-var-default">默认值：<code>' + escapeHtml(compactDefault(v.default)) + '</code></div>'
            + '<div class="vc-var-actions">'
            + '<button type="button" class="vc-var-action" data-vc-action="regen" data-path="' + escapeHtml(v.path) + '">单独重写</button>'
            + '<button type="button" class="vc-var-action danger" data-vc-action="delete" data-path="' + escapeHtml(v.path) + '">删除</button>'
            + '</div>'
            + '</article>';
        }).join('')
        + '</div></section>';
    }).join('');
    variableCountEl.textContent = design.variables.length + ' 个状态向量';
    variablePreviewList.innerHTML = html;
    variablePreview.style.display = 'block';
    renderGraphVariableMap(design);
  }

  function renderGraphVariableMap(design) {
    if (!graphVarMap) return;
    var vars = design && Array.isArray(design.variables) ? design.variables : [];
    graphSpace.querySelectorAll('.vc-node-varitem').forEach(function(node) { node.remove(); });
    graphConnections = graphConnections.filter(function(conn) { return !conn.dynamicVar; });

    if (!vars.length) {
      graphVarMap.innerHTML = '<div class="vc-varmap-empty">导入或生成 MVU 后，会在下方展开每个变量节点。</div>';
      updateGraphSize(1900, 980);
      requestAnimationFrame(function() {
        applySavedGraphLayout();
        fitGraph();
        scheduleGraphWireDraw();
      });
      return;
    }

    graphVarMap.innerHTML = '<div class="vc-varmap-empty">已展开 ' + vars.length + ' 个变量窗口。拖动窗口或滚轮缩放查看。</div>';

    var columns = 5;
    var nodeW = 260;
    var gapX = 58;
    var rowH = 150;
    var startX = 48;
    var startY = 740;
    var rows = Math.ceil(vars.length / columns);
    updateGraphSize(1900, startY + rows * rowH + 120);

    vars.forEach(function(v, i) {
      var path = sanitizePath(v.path || '');
      var col = i % columns;
      var row = Math.floor(i / columns);
      var node = document.createElement('section');
      node.className = 'vc-node vc-node-varitem';
      node.dataset.node = 'var:' + path;
      var saved = getSavedNodePosition(node.dataset.node);
      node.style.left = (saved ? saved.x : startX + col * (nodeW + gapX)) + 'px';
      node.style.top = (saved ? saved.y : startY + row * rowH) + 'px';
      node.innerHTML =
        '<div class="vc-node-head" data-drag-handle>'
        + '<span class="vc-port vc-port-in" data-port="var:' + i + ':in" data-kind="in"></span>'
        + '<span class="vc-node-title">' + escapeHtml(path.split('.').slice(-1)[0] || path || '变量') + '</span>'
        + '</div>'
        + '<div class="vc-varnode-body">'
        + '<div class="vc-varmap-path">' + escapeHtml(path) + '</div>'
        + '<div class="vc-varmap-meta">'
        + '<span class="vc-varmap-chip">' + escapeHtml(v.type || 'string') + '</span>'
        + '<span class="vc-varmap-chip">' + escapeHtml(statDataPath(path)) + '</span>'
        + '<span class="vc-varmap-chip update">' + escapeHtml(jsonPatchPath(path)) + '</span>'
        + '</div>'
        + '<div class="vc-varmap-desc">' + escapeHtml(v.description || buildFallbackDescription(path, v.type)) + '</div>'
        + '<div class="vc-varmap-check">更新条件：' + escapeHtml(((v.check && v.check[0]) || buildFallbackChecks(path, v.type)[0])) + '</div>'
        + '</div>';
      graphSpace.appendChild(node);
      var dynConn = { from: 'varmap:out', to: 'var:' + i + ':in', className: 'vc-wire-var', dynamicVar: true, stableKey: 'varmap:out=>varpath:' + path };
      if (!disabledDynamicConnections[connectionKey(dynConn)]) graphConnections.push(dynConn);
    });

    requestAnimationFrame(function() {
      applySavedGraphLayout();
      fitGraph();
      scheduleGraphWireDraw();
    });
  }

  function renderExistingMvuPreview(design) {
    renderChecklist([
      { label:'已读取角色卡变量', badge:design.variables.length + ' 个' },
      { label:'变量来源', badge:'已有 initvar' },
      { label:'生成器状态', badge:'整套请用状态栏' }
    ]);
    rebuildOutputsFromDesign(design, { inject:false, message:'已从当前角色卡读取已有状态变量' });
  }

  function getAiConfigOrAlert() {
    var apiUrl = document.getElementById('apiUrl');
    var apiKey = document.getElementById('apiKey');
    var modelSel = document.getElementById('modelSelect');
    if (!apiUrl || !apiKey || !modelSel) { alert('找不到 AI 配置面板！'); return null; }
    var model = modelSel.value;
    if (!model) { alert('请先在 AI 面板拉取并选择模型！'); return null; }
    return {
      url: apiUrl.value.replace(/\/$/, '') + '/chat/completions',
      key: apiKey.value.trim(),
      model: model
    };
  }

  function mvuWorldbookEntriesFromCurrent() {
    var modules = runtimeModuleState();
    return [
      { comment:'[initvar]变量初始化勿开', content:gen.initvar, keys:[], strategy:'selective', position:0, depth:0, role:0, order:1000, prob:100, enabled:modules.initvar },
      { comment:'变量列表', content:VARLIST_TPL, keys:[], strategy:'constant', position:4, depth:1, role:0, order:950, prob:100, enabled:modules.varlist },
      { comment:'[mvu_update]变量更新规则', content:gen.updateRules, keys:[], strategy:'constant', position:4, depth:4, role:0, order:900, prob:100, enabled:modules.updateRules },
      { comment:'[mvu_update]变量输出格式', content:FORMAT_TPL, keys:[], strategy:'constant', position:4, depth:0, role:0, order:890, prob:100, enabled:modules.outputFormat }
    ];
  }

  function rebuildOutputsFromDesign(design, options) {
    options = options || {};
    design.variables = uniqueByPath((design.variables || []).map(normalizeVariableItem));
    var schemaBody = buildSchemaBody(design);
    var initYaml = buildInitYaml(design);
    var updateYaml = buildUpdateRules(design);
    var summaryTxt = design.summary || gen.summary || '已更新变量卡';

    gen.runtime = MVU_RUNTIME_SCRIPT;
    gen.schema = SCHEMA_HEAD + schemaBody + SCHEMA_TAIL;
    gen.initvar = initYaml;
    gen.varlist = VARLIST_TPL;
    gen.updateRules = updateYaml;
    gen.outputFormat = FORMAT_TPL;
    gen.regexScripts = REGEX_SCRIPTS;
    gen.summary = summaryTxt;
    design.source = options.source || design.source || 'generated';
    gen.design = design;

    // 扩展摘要未变时不写，避免 card-builder-data-changed ↔ refreshSync 循环
    if (window.__setCardExtension__) {
      var extPayload = {
        summary: summaryTxt,
        variables: design.variables.map(function(v) {
          return {
            path: v.path,
            type: v.type,
            description: v.description,
            check: Array.isArray(v.check) ? v.check.slice(0, 3) : []
          };
        })
      };
      var prevExt = window.__getCardExtension__('zmer_mvu_design');
      var extChanged = JSON.stringify(prevExt || null) !== JSON.stringify(extPayload);
      if (extChanged) {
        suppressAutoSyncUntil = Date.now() + 700;
        window.__setCardExtension__('zmer_mvu_design', extPayload, { silent: true });
      }
    }

    codeEls.schema.textContent = gen.schema;
    codeEls.initvar.textContent = gen.initvar;
    codeEls.update.textContent = gen.updateRules;
    codeEls.format.textContent = gen.outputFormat;
    codeEls.varlist.textContent = gen.varlist;
    codeEls.regex.textContent = JSON.stringify(REGEX_SCRIPTS.map(function(r) {
      return { scriptName:r.scriptName, findRegex:r.findRegex, replaceString:r.replaceString||'(空)' };
    }), null, 2);

    renderVariablePreview(design);
    if (options.preserveGraphView) {
      requestAnimationFrame(function() {
        restoreGraphView(options.preserveGraphView);
        scheduleGraphWireDraw();
      });
    }
    summaryEl.textContent = (options.message || '变量卡已更新') + '。当前共 ' + design.variables.length + ' 个状态变量。';
    resultDiv.style.display = 'block';

    if (options.inject !== false) {
      var modules = runtimeModuleState();
      if (window.__injectMvuEntries__) {
        suppressAutoSyncUntil = Date.now() + 700;
        window.__injectMvuEntries__(mvuWorldbookEntriesFromCurrent(), REGEX_SCRIPTS.map(function(rx) {
          return Object.assign({}, rx, { disabled: !modules.regex });
        }));
      }
      if (window.__setTavernHelperScript__) {
        window.__setTavernHelperScript__('MVU', gen.runtime, modules.zod);
        window.__setTavernHelperScript__((cardData.name || '角色') + 'zod', gen.schema, modules.zod);
      }
    }
  }

  async function requestSingleVariable(requirement, currentVar) {
    var cfg = getAiConfigOrAlert();
    if (!cfg) return null;
    var headers = { 'Content-Type': 'application/json' };
    if (cfg.key) headers.Authorization = 'Bearer ' + cfg.key;
    var existing = gen.design && Array.isArray(gen.design.variables) ? gen.design.variables.map(function(v) {
      return { path:v.path, type:v.type, description:v.description };
    }) : [];
    var sys = '你是 SillyTavern MVU 单条变量设计器。只输出严格 JSON 对象，不要解释。'
      + '\n格式：{"path":"点分路径","type":"string|number|boolean|enum|array|object","default":默认值,"description":"用途","check":["何时更新"],"min":可选,"max":可选,"options":可选数组,"format":可选}'
      + '\n要求：路径必须具体、稳定、可被剧情自然更新；不要重复已有路径；如果是在重写已有变量，可保留同一路径。';
    var user = '角色：' + (cardData.name || '') + '\n角色描述：' + (cardData.desc || '').slice(0, 700)
      + '\n已有变量：\n' + JSON.stringify(existing, null, 2)
      + '\n\n本次需求：' + requirement
      + (currentVar ? '\n\n需要重写的旧变量：\n' + JSON.stringify(currentVar, null, 2) : '');
    var res = await fetch(cfg.url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ model: cfg.model, messages: [{ role:'system', content:sys }, { role:'user', content:user }], temperature:0.25 })
    });
    if (!res.ok) throw new Error('API 返回 HTTP ' + res.status);
    var data = await res.json();
    var raw = data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
    var parsed = extractJson(raw);
    var item = normalizeVariableItem(parsed.variable || parsed);
    if (!item.path) throw new Error('AI 没有返回有效 path');
    return item;
  }

  if (variablePreviewList) {
    variablePreviewList.addEventListener('click', async function(ev) {
      var btn = ev.target.closest && ev.target.closest('[data-vc-action]');
      if (!btn || !gen.design || !Array.isArray(gen.design.variables)) return;
      var action = btn.getAttribute('data-vc-action');
      var path = btn.getAttribute('data-path');
      var idx = gen.design.variables.findIndex(function(v) { return v.path === path; });
      if (idx < 0) return;

      if (action === 'delete') {
        if (!confirm('删除变量「' + path + '」？')) return;
        gen.design.variables.splice(idx, 1);
        rebuildOutputsFromDesign(gen.design, { message:'已删除变量「' + path + '」并写回角色卡' });
        setStatus('✅ 已删除变量：' + path, 'var(--color-success)');
        return;
      }

      if (action === 'regen') {
        var oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '生成中...';
        setStatus('🧬 正在单独重写变量：' + path, 'var(--color-accent-hover)');
        try {
          var next = await requestSingleVariable('重写这个变量，保持同一主题，必要时优化路径、默认值和更新规则。', gen.design.variables[idx]);
          gen.design.variables[idx] = next;
          rebuildOutputsFromDesign(gen.design, { message:'已重写变量「' + path + '」并写回角色卡' });
          setStatus('✅ 已重写变量：' + next.path, 'var(--color-success)');
        } catch(err) {
          setStatus('❌ 单条重写失败: ' + err.message, '#ef4444');
        } finally {
          btn.disabled = false;
          btn.textContent = oldText;
        }
      }
    });
  }

  if (btnAddOne) {
    btnAddOne.addEventListener('click', async function() {
      if (!refreshSync()) return;
      var requirement = (singleRequirement && singleRequirement.value || '').trim();
      if (!requirement) return alert('先写一下你想单独生成什么变量。');
      if (!gen.design) gen.design = { variables: [], summary:'手动追加变量' };
      btnAddOne.disabled = true;
      var oldText = btnAddOne.textContent;
      btnAddOne.textContent = '生成中...';
      setStatus('🧬 正在生成单条变量…', 'var(--color-accent-hover)');
      try {
        var item = await requestSingleVariable(requirement, null);
        var exists = gen.design.variables.findIndex(function(v) { return v.path === item.path; });
        if (exists >= 0) gen.design.variables[exists] = item;
        else gen.design.variables.push(item);
        rebuildOutputsFromDesign(gen.design, { message:'已追加变量「' + item.path + '」并写回角色卡' });
        if (singleRequirement) singleRequirement.value = '';
        setStatus('✅ 已生成单条变量：' + item.path, 'var(--color-success)');
      } catch(err) {
        setStatus('❌ 单条生成失败: ' + err.message, '#ef4444');
      } finally {
        btnAddOne.disabled = false;
        btnAddOne.textContent = oldText;
      }
    });
  }

  /* 整套「生成变量卡并注入」已迁至状态栏模块；本页保留单条追加与 __assistantMvuApi__ */

  /* ============================================================
   *  Prompt Builder（单条生成等仍可复用）
   * ============================================================ */
  function buildPrompt(name, desc, firstMes, wbSummary) {
    var charBlock = '【角色信息】\n角色名：' + name + '\n描述：' + desc.substring(0, 1000) + '\n开场白：' + firstMes.substring(0, 500) + '\n'
      + (wbSummary ? '世界书摘要：\n' + wbSummary.substring(0, 600) + '\n' : '');
    var ps = window.__promptStore__;
    if (ps) {
      return ps.applyTemplate(ps.get('mvuDesign'), { charBlock: charBlock });
    }
    return '你是 SillyTavern MVU 变量系统设计专家。请根据角色卡信息设计一套完整且实用的变量设计 JSON。注意：不要输出 zod 代码、不要输出 YAML、不要输出解释文字，代码和 YAML 会由网站本地生成。\n\n'
      + charBlock
      + '\n【设计原则】\n'
      + '1. 不要只生成好感度、金钱、经验。变量要覆盖剧情真实需要：世界时间/地点/场景、主角状态、NPC当前行动与情绪、关系状态、长期记忆、任务/承诺/线索、物品、特殊机制。\n'
      + '2. 每个变量必须能被剧情自然更新。不要设计纯摆设字段。\n'
      + '3. 变量数量控制在 20 到 45 个之间。重要角色可以各有 4 到 8 个字段。\n'
      + '4. path 使用点分路径，例如 "世界.当前时间"、"NPC.秦玥璃.当前情绪"、"任务.进行中"。\n'
      + '5. type 只能是 string、number、boolean、enum、array、object。\n'
      + '6. object 用于物品栏、任务表、重要线索、关系网这类动态键对象。\n'
      + '7. enum 必须给 options 数组，并让 default 是 options 中的一项。\n'
      + '8. number 可给 min/max。\n'
      + '9. check 写成数组，说明这个变量在什么剧情条件下应该更新。\n'
      + '10. 默认值要符合角色开局设定，不知道时给安全中性值。\n'
      + '\n【输出要求】\n'
      + '仅输出 JSON 对象，格式如下：\n'
      + '{\n'
      + '  "summary": "一句话中文摘要，50字以内",\n'
      + '  "variables": [\n'
      + '    {\n'
      + '      "path": "世界.当前时间",\n'
      + '      "type": "string",\n'
      + '      "default": "08:00",\n'
      + '      "description": "当前剧情时间",\n'
      + '      "format": "HH:MM",\n'
      + '      "check": ["根据行动耗时、移动、等待或用户指定时间推进"]\n'
      + '    }\n'
      + '  ]\n'
      + '}\n';
  }

  window.__applyExternalVariableDesign__ = function(payload) {
    payload = payload || {};
    var rawDesign = payload.design || payload;
    var rawVars = Array.isArray(rawDesign.variables) ? rawDesign.variables : [];
    if (!rawVars.length) throw new Error('没有可用的变量设计');
    var design = {
      variables: uniqueByPath(rawVars.map(normalizeVariableItem)),
      summary: String(rawDesign.summary || payload.summary || '已导入外部 MVU 变量设计').slice(0, 80),
      source: String(payload.source || rawDesign.source || 'external')
    };
    rebuildOutputsFromDesign(design, {
      message: payload.message || '已从外部工坊刷新 MVU 变量卡',
      inject: payload.inject !== false
    });
    return {
      count: design.variables.length,
      summary: design.summary
    };
  };

  /** 助手 MVU：清空 / 按 path 补丁（跳过 UI confirm） */
  window.__assistantMvuApi__ = {
    clear: function() {
      clearMvuPreview();
      if (window.__setCardExtension__) window.__setCardExtension__('zmer_mvu_design', null);
      if (window.__deleteMvuArtifacts__) {
        suppressAutoSyncUntil = Date.now() + 700;
        window.__deleteMvuArtifacts__(mvuArtifactNames());
      } else {
        clearInjectedMvuArtifacts();
      }
      lastSyncFingerprint = '';
      scheduleRefreshSync(true);
      return { cleared: true };
    },
    upsertDesign: function(payload) {
      payload = payload || {};
      return window.__applyExternalVariableDesign__({
        design: payload.design || payload,
        source: 'assistant',
        inject: payload.inject === true,
        message: '助手已写入 MVU 设计',
      });
    },
    upsertVariables: function(payload) {
      payload = payload || {};
      return window.__applyExternalVariableDesign__({
        design: payload.design || payload,
        source: 'assistant',
        inject: payload.inject !== false,
        message: '助手已注入 MVU 变量卡',
      });
    },
    patchNode: function(opts) {
      opts = opts || {};
      var path = String(opts.path || '').trim();
      if (!path) throw new Error('缺少 path');
      var design = window.__getCardExtension__ ? window.__getCardExtension__('zmer_mvu_design') : null;
      if (!design || !Array.isArray(design.variables)) throw new Error('当前无 MVU 设计');
      var vars = design.variables.slice();
      var idx = vars.findIndex(function(v) {
        return String((v && (v.path || v.name)) || '') === path;
      });
      if (idx < 0) throw new Error('未找到节点: ' + path);
      vars[idx] = Object.assign({}, vars[idx], opts.patch || {});
      var next = Object.assign({}, design, { variables: vars });
      return window.__applyExternalVariableDesign__({
        design: next,
        source: 'assistant',
        inject: opts.inject !== false,
        message: '助手已补丁 MVU 节点 ' + path,
      });
    },
  };

  /* ============================================================
   *  导出
   * ============================================================ */
  btnExport.addEventListener('click', function() {
    if (!gen.schema) return alert('请先在「状态栏」生成变量设计，或从角色卡同步已有 MVU！');
    var pack = {
      _format:'st_v3_mvu_variable_card_pack', _version:'1.0',
      _generated_at: new Date().toISOString(),
      runtime_script:gen.runtime, schema_script:gen.schema, initvar_yaml:gen.initvar,
      variable_list:gen.varlist, update_rules:gen.updateRules,
      output_format:gen.outputFormat, regex_scripts:gen.regexScripts,
      design:gen.design, summary:gen.summary
    };
    var blob = new Blob([JSON.stringify(pack, null, 2)], { type:'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = (cardData.name || 'varcard') + '_mvu_pack.json';
    a.click(); URL.revokeObjectURL(a.href);
  });
}

export function initVariableCardPanelInfer() {
var gapEl = document.getElementById('vcCorruptionGap');
    var gapMsg = document.getElementById('vcCorruptionGapMsg');
    var gapBtn = document.getElementById('vcGapInferBtn');
    var btnInfer = document.getElementById('btnVcInfer');
    var panel = document.getElementById('vcInferPanel');
    var listEl = document.getElementById('vcInferList');
    var countEl = document.getElementById('vcInferCount');
    var btnSelectAll = document.getElementById('vcInferSelectAll');
    var btnSelectNone = document.getElementById('vcInferSelectNone');
    var btnCancel = document.getElementById('vcInferCancel');
    var btnApply = document.getElementById('vcInferApply');
    var btnApplyInject = document.getElementById('vcInferApplyInject');

    /** @type {import('../lib/mvu/inferFromCard.mjs').MvuCandidate[]} */
    var lastCandidates = [];

    function esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function buildCardLike() {
      var name = (document.getElementById('charName') || {}).value || '';
      var desc = (document.getElementById('charDesc') || {}).value || '';
      var wb = window.__getWorldbookEntries__ ? window.__getWorldbookEntries__() : [];
      var adult = window.__getNsfwConfig__ ? window.__getNsfwConfig__() : {};
      var statusBar = window.__getCardExtension__
        ? window.__getCardExtension__(STATUS_BAR_EXT_KEY)
        : null;
      var mvuDesign = window.__getCardExtension__
        ? window.__getCardExtension__('zmer_mvu_design')
        : null;
      return {
        name: String(name || '').trim(),
        description: String(desc || ''),
        worldbook: wb,
        adultConfig: adult || {},
        statusBarDesign: statusBar,
        mvuDesign: mvuDesign,
      };
    }

    function refreshCorruptionGap() {
      if (!gapEl) return;
      var gap = corruptionProgressGap(buildCardLike());
      gapEl.hidden = !gap.gap;
      if (gapMsg && gap.message) gapMsg.textContent = gap.message;
    }

    function renderInferList() {
      if (!listEl) return;
      if (!lastCandidates.length) {
        listEl.innerHTML = '<div class="vc-infer-meta">未推定到候选。请先配置状态栏模块或开启恶堕/成人层。</div>';
        if (countEl) countEl.textContent = '0';
        return;
      }
      listEl.innerHTML = lastCandidates.map(function(c, i) {
        var checked = c.selected !== false ? ' checked' : '';
        var present = c.alreadyPresent ? ' is-present' : '';
        var badge = c.alreadyPresent
          ? '<span class="vc-infer-badge">已有</span>'
          : '<span class="vc-infer-badge is-new">新增</span>';
        return (
          '<label class="vc-infer-row' + present + '">'
          + '<input type="checkbox" data-infer-idx="' + i + '"' + checked + ' />'
          + '<span class="vc-infer-row-main">'
          + '<div class="vc-infer-path">' + esc(c.path) + '</div>'
          + '<div class="vc-infer-meta">'
          + esc(c.name) + ' · ' + esc(c.type)
          + ' · 初值 ' + esc(c.initial)
          + ' · ' + esc(c.source)
          + '</div>'
          + '<div class="vc-infer-meta">' + esc(c.updateHint) + '</div>'
          + '</span>'
          + badge
          + '</label>'
        );
      }).join('');
      if (countEl) {
        var nNew = lastCandidates.filter(function(c) { return !c.alreadyPresent; }).length;
        countEl.textContent = lastCandidates.length + '（新增 ' + nNew + '）';
      }
    }

    function openInferPanel() {
      lastCandidates = inferMvuCandidatesFromCard(buildCardLike());
      if (panel) panel.hidden = false;
      renderInferList();
    }

    function closeInferPanel() {
      if (panel) panel.hidden = true;
    }

    function selectedPathsFromUi() {
      if (!listEl) return [];
      var paths = [];
      listEl.querySelectorAll('input[data-infer-idx]').forEach(function(input) {
        if (!input.checked) return;
        var idx = Number(input.getAttribute('data-infer-idx'));
        var c = lastCandidates[idx];
        if (c && c.path) paths.push(c.path);
      });
      return paths;
    }

    function applyInfer(inject) {
      var paths = selectedPathsFromUi();
      if (!paths.length) {
        alert('请至少勾选一个候选变量');
        return;
      }
      var existing = window.__getCardExtension__
        ? window.__getCardExtension__('zmer_mvu_design')
        : null;
      var merged = mergeCandidatesIntoDesign(existing, lastCandidates, {
        selectedPaths: paths,
        onlySelected: true,
      });
      var design = {
        variables: merged.variables,
        summary: merged.summary || ('从卡推定 +' + merged.added),
        source: 'infer_from_card',
      };
      if (!window.__applyExternalVariableDesign__) {
        alert('MVU 注入未就绪');
        return;
      }
      var result = window.__applyExternalVariableDesign__({
        design: design,
        source: 'infer_from_card',
        inject: !!inject,
        message: inject
          ? ('已推定合并并注入（+' + merged.added + ' / 更新 ' + merged.updated + '）')
          : ('已推定合并到设计（+' + merged.added + ' / 更新 ' + merged.updated + '）'),
      });
      closeInferPanel();
      refreshCorruptionGap();
      return result;
    }

    if (btnInfer) btnInfer.addEventListener('click', openInferPanel);
    if (gapBtn) gapBtn.addEventListener('click', openInferPanel);
    if (btnCancel) btnCancel.addEventListener('click', closeInferPanel);
    if (btnSelectAll) {
      btnSelectAll.addEventListener('click', function() {
        lastCandidates.forEach(function(c) {
          if (!c.alreadyPresent) c.selected = true;
        });
        renderInferList();
      });
    }
    if (btnSelectNone) {
      btnSelectNone.addEventListener('click', function() {
        lastCandidates.forEach(function(c) { c.selected = false; });
        renderInferList();
      });
    }
    if (btnApply) btnApply.addEventListener('click', function() { applyInfer(false); });
    if (btnApplyInject) btnApplyInject.addEventListener('click', function() { applyInfer(true); });

    window.__mvuInferApi__ = {
      infer: function(cardLike) {
        return inferMvuCandidatesFromCard(cardLike || buildCardLike());
      },
      gap: function(cardLike) {
        return corruptionProgressGap(cardLike || buildCardLike());
      },
      merge: function(design, candidates, opts) {
        return mergeCandidatesIntoDesign(design, candidates, opts);
      },
      buildCardLike: buildCardLike,
      refreshGap: refreshCorruptionGap,
      openPanel: openInferPanel,
    };

    // 挂到助手 MVU API（若主脚本已就绪）
    function attachAssistant() {
      if (!window.__assistantMvuApi__) return;
      window.__assistantMvuApi__.inferVariables = function() {
        var cardLike = buildCardLike();
        return {
          candidates: inferMvuCandidatesFromCard(cardLike),
          corruptionGap: corruptionProgressGap(cardLike),
        };
      };
    }
    attachAssistant();
    setTimeout(attachAssistant, 800);
    setTimeout(attachAssistant, 2000);

    refreshCorruptionGap();
    setInterval(refreshCorruptionGap, 1600);
    window.addEventListener('nsfw-config-changed', refreshCorruptionGap);
    window.addEventListener('card-builder-data-changed', refreshCorruptionGap);
}

export function initVariableCardPanel() {
  initVariableCardPanelCore();
  initVariableCardPanelInfer();
}
