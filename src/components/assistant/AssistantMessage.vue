<script setup>
defineProps({
  message: { type: Object, required: true },
});

defineEmits(['rag', 'retry', 'reroll']);
</script>

<template>
  <div v-if="message.kind === 'user'" class="assistant-msg-wrap assistant-msg-wrap--user">
    <div class="assistant-msg assistant-msg--user">{{ message.text }}</div>
    <div class="assistant-msg-actions">
      <button
        type="button"
        class="btn-icon btn-icon--sm assistant-msg-rag-btn"
        title="查看本回合 RAG"
        aria-label="查看本回合 RAG"
        @click="$emit('rag')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
          <path d="M8 11h6M11 8v6" />
        </svg>
      </button>
    </div>
  </div>

  <div v-else class="assistant-msg-wrap assistant-msg-wrap--assistant">
    <div
      class="assistant-msg assistant-msg--assistant"
      :class="{ 'assistant-msg--error': message.error }"
      v-html="message.html"
    ></div>
    <div v-if="message.showRetry || message.showReroll" class="assistant-msg-actions">
      <button
        v-if="message.showRetry"
        type="button"
        class="btn-icon btn-icon--sm"
        title="重试"
        aria-label="重试"
        @click="$emit('retry')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
      </button>
      <button
        v-else
        type="button"
        class="btn-icon btn-icon--sm"
        title="重新生成"
        aria-label="重新生成"
        @click="$emit('reroll')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
      </button>
    </div>
  </div>
</template>
