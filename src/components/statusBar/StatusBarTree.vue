<script setup>
defineProps({
  node: { type: Object, default: () => ({}) },
  depth: { type: Number, default: 0 },
});

function isBranch(value) {
  return !!value && typeof value === 'object';
}

function isNumber(value) {
  if (typeof value === 'number' && isFinite(value)) return true;
  return typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim());
}

function entries(node) {
  return Object.keys(node || {}).map((key) => ({ key, value: node[key] }));
}
</script>

<template>
  <template v-for="item in entries(node)" :key="item.key">
    <details v-if="isBranch(item.value)" class="sb-tree-node" :open="depth < 1">
      <summary>
        <span class="sb-tree-key">{{ item.key }}</span>
        <span v-if="Array.isArray(item.value)" class="sb-tree-meta">{{ item.value.length }} 项</span>
      </summary>
      <div class="sb-tree-body">
        <StatusBarTree :node="item.value" :depth="depth + 1" />
      </div>
    </details>
    <div v-else class="sb-tree-row">
      <span class="sb-tree-key">{{ item.key }}</span>
      <span class="sb-tree-sep">:</span>
      <span :class="isNumber(item.value) ? 'sb-tree-num' : 'sb-tree-str'">{{ item.value == null ? '—' : item.value }}</span>
    </div>
  </template>
</template>
