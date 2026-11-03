/**
 * MVU 变量卡纯函数视图：变量分组、结果清单、节点画布。
 */

export const MVU_GRAPH_NODES = Object.freeze([
  {
    id: 'user-message',
    title: '用户发消息',
    desc: '本轮输入进入 SillyTavern 生成流程。',
    classes: 'vc-flow-node vc-flow-input',
    left: 48,
    top: 120,
    hasIn: false,
    hasOut: true,
    code: 'input.user_message = 本轮用户输入\ncontext.recent_messages = 最近聊天记录',
  },
  {
    id: 'st-prompt',
    title: 'SillyTavern 准备 Prompt',
    desc: '整理角色卡、聊天历史、预设、世界书和扩展注入。',
    classes: 'vc-flow-node vc-flow-st',
    left: 310,
    top: 120,
    hasIn: true,
    hasOut: true,
    code: 'SillyTavern buildPrompt()\n- 角色卡设定\n- 聊天历史\n- 预设 / 作者注释\n- 世界书与扩展注入',
  },
  {
    id: 'wb-constant',
    title: '世界书常驻条目插入',
    desc: '例如变量更新规则、输出格式、强规则、运行法则。',
    classes: 'vc-flow-node vc-flow-worldbook',
    left: 595,
    top: 48,
    hasIn: true,
    hasOut: true,
    code: '[世界书常驻条目]\n- 变量更新规则\n- 变量输出格式\n- 强规则 / 运行法则',
  },
  {
    id: 'stat-data',
    title: '变量列表插入 stat_data',
    desc: '通过变量列表条目把当前状态喂给模型。',
    classes: 'vc-flow-node vc-flow-variable',
    left: 595,
    top: 250,
    hasIn: true,
    hasOut: true,
    code: '<status_current_variables>\n{{format_message_variable::stat_data}}\n</status_current_variables>',
  },
  {
    id: 'ejs-router',
    title: 'EJS 控制器动态加载阶段世界书',
    desc: '按好感、阶段、标记决定哪些隐藏剧情条目参与本轮。',
    classes: 'vc-flow-node vc-flow-ejs',
    left: 895,
    top: 48,
    hasIn: true,
    hasOut: true,
    code: '<%\nconst affection = _.get(stat_data, "NPC.角色名.好感度", 0);\nif (affection >= 60) {\n  // 激活阶段世界书 / 阶段剧情\n}\n%>',
  },
  {
    id: 'rule-inject',
    title: 'Roll / 随机事件 / 阻尼器 / 交易规则注入',
    desc: '把好感 Roll、经济规则、随机事件和防暴走限制写进本轮提示。',
    classes: 'vc-flow-node vc-flow-rule',
    left: 895,
    top: 250,
    hasIn: true,
    hasOut: true,
    code: '规则注入草稿：\n- 好感 Roll\n- 随机事件\n- 阻尼器：限制变量剧烈跳变\n- 交易规则：金钱、库存、价格、风险',
  },
  {
    id: 'model-generate',
    title: '模型生成回复',
    desc: '模型同时写剧情正文与变量更新块。',
    classes: 'vc-flow-node vc-flow-model',
    left: 1215,
    top: 150,
    hasIn: true,
    hasOut: true,
    code: '模型应同时输出：\n<story>剧情正文</story>\n<UpdateVariable>变量更新 JSONPatch</UpdateVariable>',
  },
  {
    id: 'story-output',
    title: '输出 <story> 正文',
    desc: '展示给用户看的剧情文本。',
    classes: 'vc-flow-node vc-flow-output',
    left: 1510,
    top: 54,
    hasIn: true,
    hasOut: true,
    code: '<story>\n这里是展示给用户的剧情正文。\n</story>',
  },
  {
    id: 'update-output',
    title: '输出 <UpdateVariable>',
    desc: '模型在技术块里给出 JSONPatch 更新命令。',
    classes: 'vc-flow-node vc-flow-update',
    left: 1510,
    top: 250,
    hasIn: true,
    hasOut: true,
    code: '<UpdateVariable>\n<Analyze>简短说明</Analyze>\n<JSONPatch>\n[{"op":"replace","path":"/世界/当前时间","value":"09:00"}]\n</JSONPatch>\n</UpdateVariable>',
  },
  {
    id: 'mvu-patch',
    title: 'MVU 解析 JSONPatch',
    desc: '读取 replace / delta / insert / remove / move 等操作。',
    classes: 'vc-flow-node vc-flow-mvu',
    left: 1215,
    top: 470,
    hasIn: true,
    hasOut: true,
    code: 'MVU JSONPatch 支持：\nreplace / delta / insert / remove / move',
  },
  {
    id: 'zod-validate',
    title: 'Zod Schema 校验和自动处理',
    desc: '类型转换、默认值、范围限制、非法更新兜底。',
    classes: 'vc-flow-node vc-flow-zod',
    left: 895,
    top: 470,
    hasIn: true,
    hasOut: true,
    code: 'Zod Schema：\n- 类型转换\n- 默认值 prefault\n- 数值范围 clamp\n- 非法字段兜底',
  },
  {
    id: 'varmap',
    title: '状态向量窗口',
    desc: '',
    classes: 'vc-node-varmap vc-flow-node vc-flow-variable',
    left: 595,
    top: 470,
    hasIn: true,
    hasOut: true,
    varMap: true,
    code: 'stat_data 状态向量窗口\n每个变量节点显示：变量路径 / 读取路径 / JSONPatch 路径',
  },
  {
    id: 'status-event',
    title: 'VARIABLE_UPDATE_ENDED',
    desc: '状态栏收到变量更新结束事件后刷新显示。',
    classes: 'vc-flow-node vc-flow-event',
    left: 310,
    top: 470,
    hasIn: true,
    hasOut: true,
    code: 'eventOn(VARIABLE_UPDATE_ENDED, () => {\n  // 刷新状态栏 / 重新渲染当前变量\n});',
  },
  {
    id: 'regex-display',
    title: '正则隐藏技术内容 / 美化正文和状态栏',
    desc: '隐藏 UpdateVariable，仅显示剧情正文和美化后的状态变化。',
    classes: 'vc-flow-node vc-flow-regex',
    left: 48,
    top: 470,
    hasIn: true,
    hasOut: false,
    code: '正则处理：\n1. 提示词里去掉 <UpdateVariable>\n2. 画面上把更新收成默认折叠的列表\n3. 开场 <initvar> 不显示',
  },
]);

export const MVU_DEFAULT_CONNECTIONS = Object.freeze([
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
  { from: 'story-output:out', to: 'regex-display:in', className: 'vc-wire-source' },
]);

export function buildVariableGroups(variables) {
  var groups = Object.create(null);
  var order = [];
  (Array.isArray(variables) ? variables : []).forEach(function(v) {
    var top = String((v && v.path) || '').split('.')[0] || '其他';
    if (!groups[top]) {
      groups[top] = [];
      order.push(top);
    }
    groups[top].push(v);
  });
  return order.map(function(name) {
    return { name: name, count: groups[name].length, variables: groups[name] };
  });
}

export function buildResultChecklist(design, opts) {
  var o = opts || {};
  var n = design && Array.isArray(design.variables) ? design.variables.length : 0;
  if (o.existing) {
    return [
      { label: '已读取角色卡变量', badge: n + ' 个' },
      { label: '变量来源', badge: '已有 initvar' },
      { label: '生成器状态', badge: '整套请用状态栏' },
    ];
  }
  return n ? [{ label: '变量设计', badge: n + ' 个' }] : [];
}

export function buildInferView(candidates) {
  var list = Array.isArray(candidates) ? candidates : [];
  return {
    open: true,
    candidates: list,
    count: list.length,
    newCount: list.filter(function(c) { return !c.alreadyPresent; }).length,
  };
}

export function connectionKey(conn) {
  if (!conn) return '';
  return String(conn.stableKey || (conn.from + '=>' + conn.to));
}

export function isRuntimeNodeReachable(connections, nodeId) {
  var target = String(nodeId || '');
  if (!target) return false;
  var seen = { 'user-message': true };
  var queue = ['user-message'];
  while (queue.length) {
    var current = queue.shift();
    if (current === target) return true;
    (connections || []).forEach(function(conn) {
      if (!conn || conn.dynamicVar) return;
      if (String(conn.from || '').split(':')[0] !== current) return;
      var next = String(conn.to || '').split(':')[0];
      if (!seen[next]) {
        seen[next] = true;
        queue.push(next);
      }
    });
  }
  return false;
}

function savedPosition(layout, nodeId) {
  var pos = layout && layout.positions && layout.positions[nodeId];
  if (!pos) return null;
  var x = Number(pos.x);
  var y = Number(pos.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: x, y: y };
}

function lastPathPart(path) {
  var parts = String(path || '').split('.').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

function statDataPath(path) {
  return 'stat_data.' + String(path || '').split('.').filter(Boolean).join('.');
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

/**
 * 固定节点 + 变量节点 + 连线投影。布局来自 zmer_mvu_runtime_graph。
 * @param {object} design
 * @param {object} [layout]
 * @returns {{ nodes: any[], connections: any[], size: { width: number, height: number }, nodeCount: number }}
 */
export function buildGraphView(design, layout) {
  var vars = design && Array.isArray(design.variables) ? design.variables : [];
  var saved = layout && typeof layout === 'object' ? layout : {};
  var disabled = Object.create(null);
  (Array.isArray(saved.disabledDynamicConnections) ? saved.disabledDynamicConnections : []).forEach(function(key) {
    if (key) disabled[key] = true;
  });
  var codes = saved.codes && typeof saved.codes === 'object' ? saved.codes : {};
  var nodes = MVU_GRAPH_NODES.map(function(node) {
    var pos = savedPosition(saved, node.id);
    return Object.assign({}, node, {
      left: pos ? pos.x : node.left,
      top: pos ? pos.y : node.top,
      inPort: node.hasIn ? node.id + ':in' : '',
      outPort: node.hasOut ? node.id + ':out' : '',
      code: codes[node.id] !== undefined ? String(codes[node.id]) : node.code,
      varMapText: node.varMap
        ? (vars.length
          ? '已展开 ' + vars.length + ' 个变量窗口。拖动窗口或滚轮缩放查看。'
          : '导入或生成 MVU 后，会在下方展开每个变量节点。')
        : '',
    });
  });

  var startX = 48;
  var startY = 740;
  var columns = 5;
  var nodeW = 260;
  var gapX = 58;
  var rowH = 150;
  var varNodes = vars.map(function(v, i) {
    var path = String((v && v.path) || '');
    var id = 'var:' + path;
    var pos = savedPosition(saved, id);
    var col = i % columns;
    var row = Math.floor(i / columns);
    return {
      id: id,
      varNode: true,
      varIndex: i,
      title: lastPathPart(path) || path || '变量',
      classes: 'vc-node-varitem',
      hasIn: true,
      hasOut: false,
      left: pos ? pos.x : startX + col * (nodeW + gapX),
      top: pos ? pos.y : startY + row * rowH,
      inPort: 'var:' + i + ':in',
      outPort: '',
      type: String(v.type || 'string'),
      path: path,
      description: String(v.description || ''),
      check: (v.check && v.check[0]) || '',
      statPath: statDataPath(path),
      patchPath: jsonPatchPath(path),
    };
  });

  var savedConns = Array.isArray(saved.connections) ? saved.connections : null;
  var baseConns = (savedConns || MVU_DEFAULT_CONNECTIONS).map(function(conn) {
    return {
      from: String(conn.from || ''),
      to: String(conn.to || ''),
      className: conn.className || 'vc-wire-source',
    };
  }).filter(function(conn) { return conn.from && conn.to; });
  var connections = baseConns;
  varNodes.forEach(function(node, i) {
    var stableKey = 'varmap:out=>varpath:' + node.path;
    if (disabled[stableKey]) return;
    connections.push({
      from: 'varmap:out',
      to: 'var:' + i + ':in',
      className: 'vc-wire-var',
      dynamicVar: true,
      stableKey: stableKey,
    });
  });

  var maxLeft = 1900;
  var maxTop = 980;
  nodes.concat(varNodes).forEach(function(node) {
    maxLeft = Math.max(maxLeft, Number(node.left || 0) + 360);
    maxTop = Math.max(maxTop, Number(node.top || 0) + 200);
  });
  var rows = Math.ceil(varNodes.length / columns);
  maxTop = Math.max(maxTop, startY + rows * rowH + 120);

  return {
    nodes: nodes.concat(varNodes),
    connections: connections,
    size: { width: Math.max(1900, maxLeft), height: Math.max(980, maxTop) },
    nodeCount: nodes.length + varNodes.length,
  };
}
