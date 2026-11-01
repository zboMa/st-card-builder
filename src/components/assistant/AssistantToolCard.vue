<script setup>
defineProps({
  tool: { type: Object, required: true },
});
</script>

<template>
  <details
    class="assistant-tool-card"
    :class="{
      'assistant-tool-card--running': tool.running,
      'assistant-tool-card--error': tool.error,
      'assistant-tool-card--pending': tool.pendingConfirm,
    }"
    :open="tool.pendingConfirm || undefined"
  >
    <summary class="assistant-tool-card__head">
      <div class="assistant-tool-card__header-row">
        <span class="assistant-tool-card__name">{{ tool.displayName }}</span>
        <span class="assistant-tool-card__risk" :class="tool.riskClass">{{ tool.risk }}</span>
      </div>
      <div class="assistant-tool-card__summary">
        <span v-if="tool.running" class="assistant-typing-dots"><span></span><span></span><span></span></span>
        <template v-if="tool.running"> 执行中…</template>
        <template v-else>{{ tool.summary }}</template>
      </div>
    </summary>
    <div class="assistant-tool-card__detail">
      <pre v-if="tool.argsText" class="assistant-tool-card__args">执行参数: {{ tool.argsText }}</pre>
      <pre class="assistant-tool-card__body">{{ tool.detail }}</pre>
    </div>
  </details>
</template>
