<script setup>
import { nextTick, onMounted, ref, watch } from 'vue';
import { useStore } from '@nanostores/vue';
import { assistantStore } from '../../lib/store/assistantStore.mjs';
import { assistantApi } from '../../lib/assistant/assistantBridge.mjs';
import AssistantMessage from './AssistantMessage.vue';
import AssistantToolCard from './AssistantToolCard.vue';
import AssistantCompaction from './AssistantCompaction.vue';
import AssistantPending from './AssistantPending.vue';
import AssistantComposer from './AssistantComposer.vue';
import AssistantModals from './AssistantModals.vue';

const view = useStore(assistantStore);
const messagesEl = ref(null);

function scrollToBottom() {
  nextTick(function () {
    if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
  });
}

watch(function () { return view.value.messages; }, scrollToBottom, { flush: 'post' });
watch(function () { return view.value.pendingHint; }, scrollToBottom, { flush: 'post' });

onMounted(scrollToBottom);
</script>

<template>
  <div class="assistant-stage">
    <div class="assistant-panel__messages" id="assistantMessages" ref="messagesEl" role="log" aria-live="polite">
      <template v-for="(message, index) in view.messages" :key="index">
        <AssistantToolCard v-if="message.kind === 'tool'" :tool="message.tool" />
        <AssistantCompaction v-else-if="message.kind === 'compaction'" :text="message.text" />
        <AssistantMessage
          v-else
          :message="message"
          @rag="assistantApi.ragPreviewForMessage(index)"
          @retry="assistantApi.retry()"
          @reroll="assistantApi.reroll()"
        />
      </template>
      <div v-if="view.pendingHint" class="assistant-msg assistant-msg--pending" aria-live="polite">
        <span class="assistant-typing-dots"><span></span><span></span><span></span></span>
        {{ view.pendingHint }}
      </div>
    </div>
    <AssistantPending v-if="view.pending" :pending="view.pending" :show-auto-apply="view.showAutoApplyButton" />
    <AssistantComposer />
    <AssistantModals />
  </div>
</template>

<style scoped>
.assistant-stage {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
</style>
