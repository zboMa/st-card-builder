<script setup>
import { ref } from 'vue';
import { useStore } from '@nanostores/vue';
import { characterUiStore } from '../../lib/store/characterStore.mjs';

defineProps({
  tags: { type: Array, default: function () { return []; } },
});

const ui = useStore(characterUiStore);
const input = ref('');
const inputEl = ref(null);

function api() {
  return window.__characterPanelApi__ || {};
}

function add() {
  if (api().addTag) api().addTag(input.value);
  input.value = '';
  if (inputEl.value) inputEl.value.focus();
}

function remove(index) {
  if (api().removeTag) api().removeTag(index);
}

function generate() {
  if (api().generateTags) api().generateTags();
}
</script>

<template>
  <div class="form-group char-tags-group">
    <div class="char-tags-label-row">
      <label for="charTagInput">角色标签 (Tags)</label>
      <span class="ui-hint ui-hint--inline char-tags-tip">ST tags / data.tags</span>
    </div>
    <div class="form-section char-tags-section">
      <div id="charTagsList" class="chip-list char-tags-list" aria-live="polite">
        <span
          v-for="(tag, index) in tags"
          :key="tag + ':' + index"
          class="char-tag-chip"
          :data-tag-index="index"
        >
          <span class="char-tag-chip-text">{{ tag }}</span>
          <button
            type="button"
            class="char-tag-chip-remove"
            data-tag-action="remove"
            :data-tag-index="index"
            title="移除"
            aria-label="移除标签"
            @click="remove(index)"
          >×</button>
        </span>
      </div>
      <div class="char-tags-add-row">
        <input
          id="charTagInput"
          ref="inputEl"
          v-model="input"
          type="text"
          class="char-tag-input"
          placeholder="输入标签，回车添加"
          autocomplete="off"
          @keydown.enter.prevent="add"
        />
        <button type="button" id="btnAddCharTag" class="btn btn-meta" @click="add">添加</button>
        <button
          type="button"
          id="btnAiGenCharTags"
          class="btn btn-panel-tool btn-ai-tag"
          :disabled="ui.tagBusy"
          @click="generate"
        >AI 生成</button>
      </div>
    </div>
  </div>
</template>
