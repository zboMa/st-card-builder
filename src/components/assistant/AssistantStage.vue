<script setup>
import { nextTick, onMounted, ref, watch } from 'vue';
import { useStore } from '@nanostores/vue';
import { assistantStageStore } from '../../lib/store/assistantStore.mjs';
import { assistantMessageViewsStore } from '../../lib/store/assistantMessageStore.mjs';
import { assistantApi } from '../../lib/assistant/assistantBridge.mjs';
import AssistantMessage from './AssistantMessage.vue';
import AssistantToolCard from './AssistantToolCard.vue';
import AssistantCompaction from './AssistantCompaction.vue';
import AssistantPending from './AssistantPending.vue';
import AssistantComposer from './AssistantComposer.vue';
import AssistantModals from './AssistantModals.vue';

const view = useStore(assistantStageStore);
const views = useStore(assistantMessageViewsStore);
const messagesEl = ref(null);
let initialScroll = true;

function scrollToBottom(force) {
  nextTick(function () {
    var el = messagesEl.value;
    if (!el) return;
    var nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (force === true || nearBottom) el.scrollTop = el.scrollHeight;
  });
}

watch(function () { return views.value; }, function () {
  var force = initialScroll && views.value.length > 0;
  if (force) initialScroll = false;
  scrollToBottom(force);
}, { flush: 'post' });
watch(function () { return view.value.pendingHint; }, function () { scrollToBottom(); }, { flush: 'post' });

onMounted(function () {
  if (views.value.length) initialScroll = false;
  scrollToBottom(true);
});
</script>

<template>
  <div class="assistant-stage">
    <div class="assistant-panel__messages" id="assistantMessages" ref="messagesEl" role="log" aria-live="polite">
      <template v-for="(message, index) in views" :key="message.id || index">
        <AssistantToolCard v-if="message.kind === 'tool'" :tool="message.tool" />
        <AssistantCompaction v-else-if="message.kind === 'compaction'" :text="message.text" />
        <AssistantMessage
          v-else
          :message="message"
          @rag="assistantApi.ragPreviewForMessage(message.id || index)"
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
