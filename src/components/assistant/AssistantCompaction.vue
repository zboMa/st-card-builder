<script setup>
defineProps({
  text: { type: String, default: '' },
});
</script>

<template>
  <details class="assistant-tool-card assistant-compaction">
    <summary class="assistant-tool-card__head">
      <div class="assistant-tool-card__header-row">
        <span class="assistant-tool-card__name">上下文已压缩</span>
      </div>
      <div class="assistant-tool-card__summary">更早的对话已收成检查点，之后从这里接着送模</div>
    </summary>
    <div class="assistant-tool-card__detail">
      <pre class="assistant-tool-card__body">{{ text }}</pre>
    </div>
  </details>
</template>
