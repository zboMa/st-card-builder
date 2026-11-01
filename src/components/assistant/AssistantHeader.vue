<script setup>
import { useStore } from '@nanostores/vue';
import { assistantStore } from '../../lib/store/assistantStore.mjs';
import { assistantApi } from '../../lib/assistant/assistantBridge.mjs';

const view = useStore(assistantStore);
</script>

<template>
  <header class="assistant-panel__header">
    <div class="assistant-panel__title-row">
      <span
        class="assistant-ready-dot"
        id="assistantReadyDot"
        :class="view.busy ? 'is-busy' : 'is-ready'"
        :title="view.busy ? (view.status || '处理中') : '就绪'"
        :aria-label="view.busy ? (view.status || '处理中') : '就绪'"
      ></span>
      <h2 class="assistant-panel__title" id="assistantPanelTitle">{{ view.mode === 'chat' ? 'AI 试聊' : 'AI 助手' }}</h2>
      <div
        class="assistant-mode-switch"
        id="assistantModeSwitch"
        :data-mode="view.mode"
        role="tablist"
        aria-label="右侧栏模式"
      >
        <span class="assistant-mode-switch__thumb" id="assistantModeThumb" aria-hidden="true"></span>
        <button
          type="button"
          class="assistant-mode-switch__btn"
          :class="{ 'is-active': view.mode === 'assistant' }"
          role="tab"
          :aria-selected="view.mode === 'assistant' ? 'true' : 'false'"
          data-assistant-mode="assistant"
          @click="assistantApi.setMode('assistant')"
        >助手</button>
        <button
          type="button"
          class="assistant-mode-switch__btn"
          :class="{ 'is-active': view.mode === 'chat' }"
          role="tab"
          :aria-selected="view.mode === 'chat' ? 'true' : 'false'"
          data-assistant-mode="chat"
          @click="assistantApi.setMode('chat')"
        >试聊</button>
      </div>
      <span v-if="view.status" class="assistant-panel__tip" id="assistantStatusTip">{{ view.status }}</span>
      <button
        type="button"
        class="assistant-panel__close"
        id="btnAssistantClose"
        aria-label="关闭 AI 助手"
        title="关闭"
        @click="assistantApi.closeSheet()"
      >×</button>
    </div>
    <p class="assistant-panel__sub ui-panel-lead" id="assistantPanelSub">{{ view.mode === 'chat' ? '按当前卡设定试聊 · 世界书/正则试运行' : '智能体对话 · 需要时调用工具' }}</p>
  </header>
</template>
