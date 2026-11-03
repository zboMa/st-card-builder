<script setup>
import { onMounted } from 'vue';
import { useStore } from '@nanostores/vue';
import { mvuStore } from '../../lib/store/mvuStore.mjs';
import MvuGraph from './MvuGraph.vue';
import MvuInferPanel from './MvuInferPanel.vue';
import MvuVariablePreview from './MvuVariablePreview.vue';

const ui = useStore(mvuStore);

const codeBlocks = [
  { key: 'schema', id: 'vcCodeSchema', title: '📜 变量结构脚本', badge: '酒馆助手脚本', badgeClass: 'script' },
  { key: 'initvar', id: 'vcCodeInitvar', title: '🎯 变量初始化', badge: '禁用条目', badgeClass: 'wb-off' },
  { key: 'update', id: 'vcCodeUpdate', title: '🔄 更新规则', badge: '常驻条目', badgeClass: 'wb-on' },
  { key: 'format', id: 'vcCodeFormat', title: '📤 输出格式', badge: 'D0 常驻', badgeClass: 'wb-on' },
  { key: 'varlist', id: 'vcCodeVarlist', title: '📋 变量列表', badge: 'D1 常驻', badgeClass: 'wb-on' },
  { key: 'regex', id: 'vcCodeRegex', title: '🔧 正则脚本', badge: '自动注入', badgeClass: 'regex' },
];

function api() {
  return window.__mvuPanelApi__;
}

async function copyCode(key) {
  const text = String((ui.value.codes && ui.value.codes[key]) || '');
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    return;
  }
}

onMounted(() => {
  api()?.refresh();
});
</script>

<template>
  <div class="panel varcard-panel">
    <div id="vcCorruptionGap" class="vc-corruption-gap" :hidden="!ui.gap.visible" role="status">
      <strong>恶堕进度缺失</strong>
      <span id="vcCorruptionGapMsg">{{ ui.gap.message || '已启用恶堕，但 MVU 尚无「恶堕进度」变量。可用「从卡推定变量」勾选补齐，或到状态栏重新生成。' }}</span>
      <button type="button" class="btn btn-ghost adult-btn-compact vc-gap-action" id="vcGapInferBtn" @click="api()?.openInfer()">从卡推定补齐</button>
    </div>

    <div class="vc-node-workbench">
      <div class="vc-workbench-head">
        <div>
          <h2>MVU 变量节点</h2>
          <p>节点编排与变量查看/编辑。整套变量请在「状态栏」生成并覆盖写入；也可
            <button type="button" class="btn btn-ghost adult-btn-compact" id="btnVcInfer" @click="api()?.openInfer()">从卡推定变量</button>
            规则合并。</p>
        </div>
        <div class="vc-workbench-meta">
          <span class="vc-mode-pill">手动链路模式</span>
          <span id="vcStatus" class="vc-status" :style="{ color: ui.statusColor }">{{ ui.statusText }}</span>
        </div>
      </div>

      <MvuInferPanel
        :infer="ui.infer"
        @close="api()?.closeInfer()"
        @select-all="api()?.selectAllInfer()"
        @select-none="api()?.selectNoneInfer()"
        @toggle="(index, selected) => api()?.toggleInfer(index, selected)"
        @apply="(inject) => api()?.applyInfer(inject)"
      />

      <MvuGraph
        :nodes="ui.graph.nodes"
        :connections="ui.graph.connections"
        :size="ui.graph.size"
        :expanded="ui.graph.expanded"
        @save-positions="(positions) => api()?.saveGraphPositions(positions)"
        @connect="(conn) => api()?.connectGraph(conn)"
        @remove-connection="(conn) => api()?.removeGraphConnection(conn)"
        @code-change="(payload) => api()?.setGraphCode(payload.id, payload.value)"
        @expanded-change="(value) => api()?.setGraphExpanded(value)"
      />
    </div>

    <div id="vcResult" class="vc-result" v-show="ui.hasResult">
      <div id="vcChecklist" class="vc-checklist">
        <div v-for="item in ui.checklist" :key="item.label" class="vc-check-item ok">
          <span class="vc-check-icon">✅</span>
          <span class="vc-check-label">{{ item.label }}</span>
          <span class="vc-check-badge">{{ item.badge }}</span>
        </div>
      </div>

      <div id="vcVariablePreview" class="vc-variable-preview" v-show="ui.variables.length">
        <div class="vc-preview-head">
          <strong>🧭 本次变量预览</strong>
          <span id="vcVariableCount">{{ ui.variables.length }} 个状态向量</span>
        </div>
        <div class="vc-preview-sub">这些变量会写入角色卡，后续回复会按更新规则维护它们。</div>
        <div class="vc-single-tools">
          <input
            id="vcSingleRequirement"
            type="text"
            placeholder="单独追加变量，例如：埃利安的警惕值、店铺库存、隐藏线索..."
            :value="ui.singleRequirement"
            @input="api()?.setSingleRequirement($event.target.value)"
          />
          <button id="btnVcAddOne" type="button" :disabled="ui.busy.add" @click="api()?.addOne(ui.singleRequirement)">{{ ui.busy.add ? '生成中...' : '＋ 生成一条' }}</button>
        </div>
        <MvuVariablePreview
          :groups="ui.groups"
          :busy="ui.busy"
          @delete="(path) => api()?.deleteVariable(path)"
          @regen="(path) => api()?.regenVariable(path)"
        />
      </div>

      <details class="vc-details">
        <summary class="vc-details-toggle">📄 查看生成详情 / 逐项复制</summary>
        <div class="vc-details-body">
          <div v-for="block in codeBlocks" :key="block.key" class="vc-detail-block">
            <div class="vc-detail-head">
              <strong>{{ block.title }}</strong>
              <span class="vc-badge" :class="block.badgeClass">{{ block.badge }}</span>
              <button class="vc-copy-btn" type="button" @click="copyCode(block.key)">📋</button>
            </div>
            <pre class="vc-pre"><code :id="block.id">{{ ui.codes[block.key] }}</code></pre>
          </div>
        </div>
      </details>

      <div class="vc-bottom">
        <span class="vc-summary" id="vcSummary">{{ ui.summary }}</span>
        <button id="btnVcClear" class="btn vc-clear-btn" type="button" @click="api()?.clearAll()">🧹 清除变量</button>
        <button id="btnVcDelete" class="btn-icon btn-icon--danger vc-delete-btn" type="button" title="删除组件" aria-label="删除组件" @click="api()?.deleteAll()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 7h16" />
            <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            <path d="M10 11v6M14 11v6" />
            <path d="M7 7l1 12a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9l1-12" />
          </svg>
        </button>
        <button id="btnVcExport" class="btn vc-export-btn" type="button" @click="api()?.exportPack()">💾 导出变量卡包</button>
      </div>
    </div>
  </div>
</template>
