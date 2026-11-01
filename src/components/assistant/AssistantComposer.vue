<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useStore } from '@nanostores/vue';
import { assistantStore } from '../../lib/store/assistantStore.mjs';
import { assistantApi } from '../../lib/assistant/assistantBridge.mjs';

const view = useStore(assistantStore);
const inputEl = ref(null);
const quickWrap = ref(null);
const quickOpen = ref(false);

function onInput(e) {
  assistantApi.setInput(e.target.value);
}

function onKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!view.value.busy) assistantApi.primaryAction();
  }
}

function toggleQuick() {
  quickOpen.value = !quickOpen.value;
}

function pick(index) {
  assistantApi.quickInsert(index);
  quickOpen.value = false;
  nextTick(function () {
    if (inputEl.value) inputEl.value.focus();
  });
}

function onDocClick(e) {
  if (!quickOpen.value) return;
  if (quickWrap.value && !quickWrap.value.contains(e.target)) quickOpen.value = false;
}

onMounted(function () {
  document.addEventListener('click', onDocClick);
});

onBeforeUnmount(function () {
  document.removeEventListener('click', onDocClick);
});

watch(function () { return view.value.focusNonce; }, function () {
  nextTick(function () {
    if (inputEl.value) inputEl.value.focus();
  });
});
</script>

<template>
  <div class="assistant-panel__composer">
    <textarea
      id="assistantInput"
      ref="inputEl"
      class="assistant-panel__input"
      rows="3"
      placeholder="描述想做的卡或关系，我来帮你配世界观/口味并改设定…"
      :value="view.input"
      @input="onInput"
      @keydown="onKeydown"
    ></textarea>
    <div class="composer-bar assistant-panel__composer-bar">
      <div class="composer-bar__left assistant-panel__quick-wrap" ref="quickWrap">
        <button
          type="button"
          class="assistant-btn-quick"
          id="assistantQuickBtn"
          aria-haspopup="listbox"
          :aria-expanded="quickOpen ? 'true' : 'false'"
          @click.stop="toggleQuick"
        >快捷</button>
        <button
          type="button"
          class="btn-icon btn-icon--sm assistant-btn-rag-preview"
          id="assistantRagPreviewBtn"
          title="查看当前匹配 RAG"
          aria-label="查看当前匹配 RAG"
          :disabled="view.ragPreviewBusy"
          @click="assistantApi.ragPreview()"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/><path d="M8 11h6M11 8v6"/></svg>
        </button>
        <div class="assistant-quick-menu" id="assistantQuickMenu" role="listbox" :hidden="!quickOpen">
          <button
            v-for="(chip, index) in view.quickChips"
            :key="index"
            type="button"
            class="assistant-quick-item"
            role="option"
            :data-tool="chip.tool || undefined"
            @click="pick(index)"
          >{{ chip.label }}</button>
        </div>
      </div>
      <span
        id="assistantTokenCount"
        class="assistant-token-count composer-bar__meta ui-meta"
        role="button"
        tabindex="0"
        aria-label="查看上下文内容"
        aria-live="polite"
        :title="view.tokenTitle"
        @click="assistantApi.openContext()"
        @keydown.enter.prevent="assistantApi.openContext()"
        @keydown.space.prevent="assistantApi.openContext()"
      >{{ view.tokenLabel }}</span>
      <div class="composer-bar__actions assistant-panel__composer-actions">
        <button
          type="button"
          class="btn-icon assistant-btn-undo"
          id="assistantUndoBtn"
          title="撤销上一补丁"
          aria-label="撤销上一补丁"
          :disabled="view.busy"
          @click="assistantApi.undoLastBundle()"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 7H5v4"/><path d="M5 11a7 7 0 1 1 2 5.2L5 11z"/></svg>
        </button>
        <button
          type="button"
          class="btn-icon assistant-btn-clear"
          id="assistantClearBtn"
          title="清空会话"
          aria-label="清空会话"
          :disabled="view.busy"
          @click="assistantApi.clearSession()"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M10 11v6M14 11v6"/><path d="M7 7l1 12a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9l1-12"/></svg>
        </button>
        <button
          type="button"
          class="btn-icon btn-icon--primary assistant-btn-action"
          id="assistantActionBtn"
          :class="{ 'is-stop': view.busy }"
          :title="view.busy ? '停止' : '发送'"
          :aria-label="view.busy ? '停止' : '发送'"
          :disabled="!view.busy && !view.canSend"
          @click="assistantApi.primaryAction()"
        >
          <svg class="btn-icon__glyph--send" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l14-7-7 14-2-5-5-2z"/></svg>
          <svg class="btn-icon__glyph--stop" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1.5"/></svg>
        </button>
      </div>
    </div>
  </div>
</template>
