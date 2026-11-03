<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';

const props = defineProps({
  nodes: { type: Array, default: () => [] },
  connections: { type: Array, default: () => [] },
  size: { type: Object, default: () => ({ width: 1900, height: 980 }) },
  expanded: { type: Boolean, default: false },
});

const emit = defineEmits(['save-positions', 'connect', 'remove-connection', 'code-change', 'expanded-change']);

const viewport = ref(null);
const space = ref(null);
const canvas = ref(null);
const localNodes = ref([]);
const codes = reactive({});
const openCodes = reactive({});
const scale = ref(1);
const panX = ref(0);
const panY = ref(0);
const panning = ref(false);
const wires = ref([]);
const tempPath = ref('');
const nodeEls = Object.create(null);
let activeWire = null;
let activeNode = null;
let activePan = null;
let drawFrame = 0;

const graphSize = computed(() => ({
  width: Math.max(1900, Number(props.size && props.size.width) || 1900),
  height: Math.max(980, Number(props.size && props.size.height) || 980),
}));
const spaceStyle = computed(() => ({
  width: graphSize.value.width + 'px',
  height: graphSize.value.height + 'px',
  transform: 'translate(' + panX.value + 'px,' + panY.value + 'px) scale(' + scale.value + ')',
}));
const viewBox = computed(() => '0 0 ' + graphSize.value.width + ' ' + graphSize.value.height);

function setNodeRef(el, id) {
  if (el) nodeEls[id] = el;
  else delete nodeEls[id];
}

function syncNodes() {
  localNodes.value = (props.nodes || []).map((node) => Object.assign({}, node));
  localNodes.value.forEach((node) => {
    codes[node.id] = String(node.code || '');
    if (openCodes[node.id] === undefined) openCodes[node.id] = false;
  });
  nextTick(refreshWires);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function wirePath(a, b) {
  const dx = Math.max(90, Math.abs(b.x - a.x) * 0.52);
  return 'M ' + a.x.toFixed(1) + ' ' + a.y.toFixed(1)
    + ' C ' + (a.x + dx).toFixed(1) + ' ' + a.y.toFixed(1)
    + ', ' + (b.x - dx).toFixed(1) + ' ' + b.y.toFixed(1)
    + ', ' + b.x.toFixed(1) + ' ' + b.y.toFixed(1);
}

function portCenter(portId) {
  if (!space.value) return { x: 0, y: 0 };
  const port = space.value.querySelector('[data-port="' + portId + '"]');
  if (!port) return { x: 0, y: 0 };
  let x = port.offsetLeft + port.offsetWidth / 2;
  let y = port.offsetTop + port.offsetHeight / 2;
  let parent = port.offsetParent;
  while (parent && parent !== space.value) {
    x += parent.offsetLeft;
    y += parent.offsetTop;
    parent = parent.offsetParent;
  }
  return { x, y };
}

function refreshWires() {
  drawFrame = 0;
  if (!space.value) return;
  wires.value = (props.connections || []).map((conn, index) => {
    const a = portCenter(conn.from);
    const b = portCenter(conn.to);
    return {
      index,
      className: conn.className || 'vc-wire-source',
      d: wirePath(a, b),
      conn,
    };
  });
}

function scheduleWireDraw() {
  if (drawFrame) return;
  drawFrame = requestAnimationFrame(refreshWires);
}

function graphPointFromClient(clientX, clientY) {
  const rect = space.value.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / scale.value,
    y: (clientY - rect.top) / scale.value,
  };
}

function applyTransform() {
  if (!space.value) return;
  space.value.style.transform = spaceStyle.value.transform;
}

function fitGraph() {
  if (!viewport.value) return;
  const rect = viewport.value.getBoundingClientRect();
  const size = graphSize.value;
  scale.value = clamp(Math.min((rect.width - 28) / size.width, (rect.height - 28) / size.height), 0.18, 1);
  panX.value = Math.round((rect.width - size.width * scale.value) / 2);
  panY.value = Math.round((rect.height - size.height * scale.value) / 2);
  applyTransform();
}

function zoomGraph(delta, clientX, clientY) {
  if (!viewport.value) return;
  const oldScale = scale.value;
  const nextScale = clamp(oldScale * delta, 0.18, 1.65);
  const rect = viewport.value.getBoundingClientRect();
  const vx = (typeof clientX === 'number' ? clientX : rect.left + rect.width / 2) - rect.left;
  const vy = (typeof clientY === 'number' ? clientY : rect.top + rect.height / 2) - rect.top;
  const localX = (vx - panX.value) / oldScale;
  const localY = (vy - panY.value) / oldScale;
  scale.value = nextScale;
  panX.value = vx - localX * nextScale;
  panY.value = vy - localY * nextScale;
  applyTransform();
}

function snapshotPositions() {
  const positions = {};
  localNodes.value.forEach((node) => {
    positions[node.id] = { x: Math.round(node.left), y: Math.round(node.top) };
  });
  return positions;
}

function savePositions() {
  emit('save-positions', snapshotPositions());
}

function arrangeNodes() {
  const columns = { 0: 48, 1: 320, 2: 620, 3: 930, 4: 1240, 5: 1550 };
  const layout = {
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
    'mvu-patch': { col: 4, row: 3 },
  };
  const rowIds = [
    ['wb-constant', 'ejs-router', 'story-output'],
    ['user-message', 'st-prompt', 'model-generate'],
    ['stat-data', 'rule-inject', 'update-output'],
    ['regex-display', 'status-event', 'varmap', 'zod-validate', 'mvu-patch'],
  ];
  const rowGap = [74, 76, 88];
  const rowTops = [];
  let nextTop = 52;
  rowIds.forEach((ids, index) => {
    let maxHeight = 0;
    ids.forEach((id) => {
      const el = nodeEls[id];
      if (el) maxHeight = Math.max(maxHeight, el.offsetHeight || 0);
    });
    if (!maxHeight) maxHeight = index === 3 ? 150 : 118;
    rowTops[index] = nextTop;
    nextTop += maxHeight + (rowGap[index] || 0);
  });
  Object.keys(layout).forEach((id) => {
    const node = localNodes.value.find((item) => item.id === id);
    if (!node) return;
    node.left = columns[layout[id].col];
    node.top = rowTops[layout[id].row];
  });
  const varNodes = localNodes.value.filter((node) => node.varNode);
  if (varNodes.length) {
    let maxBottom = 0;
    localNodes.value.filter((node) => !node.varNode).forEach((node) => {
      const el = nodeEls[node.id];
      maxBottom = Math.max(maxBottom, Number(node.top || 0) + (el ? el.offsetHeight : 0));
    });
    if (!maxBottom) maxBottom = nextTop;
    const startY = Math.round(maxBottom + 92);
    const startX = 58;
    const nodeWidth = 260;
    const gapX = 36;
    const gapY = 22;
    const varColumns = varNodes.length >= 10 ? 5 : varNodes.length >= 6 ? 4 : varNodes.length >= 3 ? 3 : Math.max(1, varNodes.length);
    varNodes.forEach((node, index) => {
      const col = index % varColumns;
      const row = Math.floor(index / varColumns);
      const el = nodeEls[node.id];
      node.left = startX + col * (nodeWidth + gapX);
      node.top = startY + row * ((el ? el.offsetHeight : 118) + gapY);
    });
  }
  savePositions();
  nextTick(() => {
    scheduleWireDraw();
    fitGraph();
  });
}

function toggleCode(nodeId) {
  openCodes[nodeId] = !openCodes[nodeId];
  nextTick(scheduleWireDraw);
}

function onCodeInput(nodeId, event) {
  const value = String((event.target && event.target.value) || '');
  codes[nodeId] = value;
  emit('code-change', { id: nodeId, value });
}

function onWireClick(index) {
  const conn = (props.connections || [])[index];
  if (conn) emit('remove-connection', conn);
}

function onPointerDown(event) {
  if (!viewport.value) return;
  const target = event.target;
  const port = target && target.closest ? target.closest('.vc-port') : null;
  const handle = target && target.closest ? target.closest('[data-drag-handle]') : null;
  const ignored = target && target.closest ? target.closest('textarea, button, input, select') : null;

  if (port && port.dataset.kind === 'out') {
    event.preventDefault();
    activeWire = { from: port.dataset.port };
    tempPath.value = wirePath(portCenter(activeWire.from), graphPointFromClient(event.clientX, event.clientY));
    viewport.value.setPointerCapture(event.pointerId);
    return;
  }
  if (handle && !ignored) {
    const nodeEl = handle.closest('.vc-node');
    if (!nodeEl) return;
    const node = localNodes.value.find((item) => item.id === nodeEl.dataset.node);
    if (!node) return;
    event.preventDefault();
    activeNode = {
      node,
      start: graphPointFromClient(event.clientX, event.clientY),
      left: node.left,
      top: node.top,
    };
    viewport.value.setPointerCapture(event.pointerId);
    return;
  }
  if (!ignored) {
    event.preventDefault();
    activePan = { x: event.clientX, y: event.clientY, tx: panX.value, ty: panY.value };
    panning.value = true;
    viewport.value.setPointerCapture(event.pointerId);
  }
}

function onPointerMove(event) {
  if (activeWire) {
    tempPath.value = wirePath(portCenter(activeWire.from), graphPointFromClient(event.clientX, event.clientY));
    return;
  }
  if (activeNode) {
    const now = graphPointFromClient(event.clientX, event.clientY);
    activeNode.node.left = activeNode.left + now.x - activeNode.start.x;
    activeNode.node.top = activeNode.top + now.y - activeNode.start.y;
    scheduleWireDraw();
    return;
  }
  if (activePan) {
    panX.value = activePan.tx + event.clientX - activePan.x;
    panY.value = activePan.ty + event.clientY - activePan.y;
    applyTransform();
  }
}

function onPointerUp(event) {
  if (activeWire) {
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const inPort = target && target.closest ? target.closest('.vc-port[data-kind="in"]') : null;
    if (inPort) {
      const className = String(activeWire.from || '').indexOf('require') === 0 ? 'vc-wire-require'
        : String(activeWire.from || '').indexOf('engine') === 0 ? 'vc-wire-output'
          : 'vc-wire-source';
      emit('connect', { from: activeWire.from, to: inPort.dataset.port, className });
    }
    activeWire = null;
    tempPath.value = '';
    scheduleWireDraw();
  }
  const movedNode = !!activeNode;
  activeNode = null;
  activePan = null;
  panning.value = false;
  if (movedNode) savePositions();
}

function onPointerCancel() {
  activeWire = null;
  activeNode = null;
  activePan = null;
  tempPath.value = '';
  panning.value = false;
  scheduleWireDraw();
}

function onWheel(event) {
  event.preventDefault();
  zoomGraph(event.deltaY < 0 ? 1.08 : 0.92, event.clientX, event.clientY);
}

function toggleExpanded() {
  emit('expanded-change', !props.expanded);
}

function onKeydown(event) {
  if (event.key === 'Escape' && props.expanded) emit('expanded-change', false);
}

function onAppViewChanged(event) {
  var view = event && event.detail && event.detail.view;
  if (view !== 'mvu') return;
  nextTick(function() {
    fitGraph();
    scheduleWireDraw();
  });
}

watch(() => props.nodes, syncNodes, { immediate: true });
watch(() => props.connections, scheduleWireDraw, { deep: true });
watch(() => props.size, scheduleWireDraw, { deep: true });
watch(() => props.expanded, (expanded) => {
  if (document && document.body) document.body.classList.toggle('vc-graph-body-locked', !!expanded);
  nextTick(() => {
    fitGraph();
    scheduleWireDraw();
  });
});

onMounted(() => {
  window.addEventListener('resize', fitGraph);
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('app-view-changed', onAppViewChanged);
  nextTick(() => {
    fitGraph();
    scheduleWireDraw();
  });
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', fitGraph);
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('app-view-changed', onAppViewChanged);
  if (document && document.body) document.body.classList.remove('vc-graph-body-locked');
  if (drawFrame) cancelAnimationFrame(drawFrame);
});
</script>

<template>
  <Teleport to="body" :disabled="!expanded">
    <div :class="expanded ? 'vc-graph-modal' : 'vc-graph-host'">
      <div id="vcNodeCanvas" ref="canvas" class="vc-node-canvas" :class="{ 'is-expanded': expanded }">
        <div class="vc-graph-toolbar">
          <button type="button" class="vc-graph-btn" id="vcZoomOut" title="缩小" @click="zoomGraph(0.88)">−</button>
          <button type="button" class="vc-graph-btn" id="vcZoomReset" title="适应画布" @click="fitGraph">适应</button>
          <button type="button" class="vc-graph-btn" id="vcZoomIn" title="放大" @click="zoomGraph(1.14)">+</button>
          <button type="button" class="vc-graph-btn vc-graph-btn-arrange" id="vcGraphArrange" title="一键整理节点" @click="arrangeNodes">整理</button>
          <button type="button" class="vc-graph-btn" id="vcGraphExpand" title="展开编辑" @click="toggleExpanded">{{ expanded ? '×' : '⛶' }}</button>
          <span class="vc-graph-hint">拖节点移动，拖圆点连线，滚轮缩放</span>
        </div>

        <div
          id="vcGraphViewport"
          ref="viewport"
          class="vc-graph-viewport"
          :class="{ 'is-panning': panning }"
          @wheel="onWheel"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerCancel"
        >
          <div id="vcGraphSpace" ref="space" class="vc-graph-space" :style="spaceStyle">
            <svg id="vcGraphSvg" class="vc-node-lines" :viewBox="viewBox" preserveAspectRatio="none" aria-hidden="true">
              <g id="vcGraphWires">
                <path
                  v-for="wire in wires"
                  :key="'hit-' + wire.index"
                  class="vc-wire-hit"
                  :data-conn-index="wire.index"
                  :d="wire.d"
                  @pointerdown.stop
                  @click.stop="onWireClick(wire.index)"
                />
                <path
                  v-for="wire in wires"
                  :key="'wire-' + wire.index"
                  class="vc-wire"
                  :class="wire.className"
                  :d="wire.d"
                />
              </g>
              <path class="vc-wire vc-wire-temp" :class="{ active: !!tempPath }" :d="tempPath" />
            </svg>

            <section
              v-for="node in localNodes"
              :key="node.id"
              :ref="(el) => setNodeRef(el, node.id)"
              class="vc-node"
              :class="node.classes"
              :data-node="node.id"
              :style="{ left: node.left + 'px', top: node.top + 'px' }"
            >
              <div class="vc-node-head" data-drag-handle>
                <span v-if="node.hasIn" class="vc-port vc-port-in" :data-port="node.inPort" data-kind="in"></span>
                <span class="vc-node-title">{{ node.title }}</span>
                <span v-if="node.hasOut" class="vc-port vc-port-out" :data-port="node.outPort" data-kind="out"></span>
              </div>
              <p v-if="node.desc" class="vc-node-desc">{{ node.desc }}</p>

              <div v-if="node.varMap" id="vcGraphVarMap" class="vc-varmap-list">
                <div class="vc-varmap-empty">{{ node.varMapText }}</div>
              </div>

              <div v-if="node.varNode" class="vc-varnode-body">
                <div class="vc-varmap-path">{{ node.path }}</div>
                <div class="vc-varmap-meta">
                  <span class="vc-varmap-chip">{{ node.type }}</span>
                  <span class="vc-varmap-chip">{{ node.statPath }}</span>
                  <span class="vc-varmap-chip update">{{ node.patchPath }}</span>
                </div>
                <div class="vc-varmap-desc">{{ node.description }}</div>
                <div class="vc-varmap-check">更新条件：{{ node.check }}</div>
              </div>

              <div v-if="!node.varNode" class="vc-node-code-panel" :class="{ 'is-open': openCodes[node.id] }">
                <button type="button" class="vc-node-code-toggle" @click="toggleCode(node.id)">代码</button>
                <div class="vc-node-code-body">
                  <textarea
                    class="vc-node-code-editor"
                    spellcheck="false"
                    :value="codes[node.id]"
                    @input="onCodeInput(node.id, $event)"
                  ></textarea>
                  <div class="vc-node-code-hint">保存到角色卡 extensions，仅构建器读取。</div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
