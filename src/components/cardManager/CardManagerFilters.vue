<script setup>
import { ref } from 'vue';
import { useStore } from '@nanostores/vue';
import { cardListStore } from '../../lib/store/cardListStore.mjs';
import { cardManagerApi } from '../../lib/card-builder/panels/cardManagerBridge.mjs';
import CardPopover from './CardPopover.vue';

const list = useStore(cardListStore);
const popupOpen = ref(false);
const pickerBtn = ref(null);
const searchInput = ref(null);

function onQuery(e) {
  cardManagerApi.setQuery(e.target && e.target.value);
}
function clearQuery() {
  cardManagerApi.setQuery('');
  if (searchInput.value) searchInput.value.focus();
}
function toggleTag(tag) {
  cardManagerApi.toggleTag(tag);
}
function clearTags() {
  cardManagerApi.clearTags();
}
function isSelected(tag) {
  const selected = list.value && list.value.selectedTags ? list.value.selectedTags : [];
  return selected.indexOf(tag) >= 0;
}
</script>

<template>
  <div class="card-manager-filters" id="cardManagerFilters">
    <div class="card-manager-filter-search">
      <div class="ui-search-bar wb-search-bar">
        <span class="ui-search-icon wb-search-icon" aria-hidden="true">🔍</span>
        <input
          ref="searchInput"
          type="search"
          id="cardManagerSearch"
          class="ui-search-input wb-search-input"
          placeholder="搜索角色名…"
          autocomplete="off"
          aria-label="搜索角色卡"
          :value="list.query"
          @input="onQuery"
        />
        <button
          v-if="list.query"
          type="button"
          id="cardManagerSearchClear"
          class="ui-search-clear wb-search-clear"
          title="清空"
          aria-label="清空搜索"
          @click="clearQuery"
        >✕</button>
      </div>
    </div>

    <div class="card-manager-tag-bar" id="cardManagerTagBar">
      <button
        ref="pickerBtn"
        type="button"
        id="btnCardTagPicker"
        class="card-manager-tag-picker-btn"
        title="多选标签筛选"
        aria-label="打开标签筛选"
        aria-haspopup="listbox"
        :aria-expanded="popupOpen ? 'true' : 'false'"
        @click.stop="popupOpen = !popupOpen"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M20.6 13.1 12.7 21a2 2 0 0 1-2.8 0L3 14.1V4h10.1l7.5 7.5a2 2 0 0 1 0 1.6z"/><circle cx="7.5" cy="8.5" r="1.2"/></svg>
      </button>
      <div class="card-manager-tag-scroll" id="cardManagerTagScroll" aria-label="标签筛选">
        <span v-if="!list.allTags.length" class="card-manager-tag-popup-empty">暂无标签</span>
        <button
          v-for="tag in list.allTags"
          :key="tag"
          type="button"
          class="card-manager-tag-chip"
          :class="{ 'is-active': isSelected(tag) }"
          :data-card-tag="tag"
          :aria-pressed="isSelected(tag) ? 'true' : 'false'"
          @click="toggleTag(tag)"
        >{{ tag }}</button>
      </div>
      <button
        v-if="list.selectedTags.length"
        type="button"
        id="btnCardTagClear"
        class="card-manager-tag-clear"
        @click="clearTags"
      >清除筛选</button>
    </div>

    <CardPopover
      v-if="popupOpen"
      :anchor="pickerBtn"
      :width="320"
      :gap="4"
      class="card-manager-tag-popup is-fixed-portal"
      @close="popupOpen = false"
    >
      <div v-if="!list.allTags.length" class="card-manager-tag-popup-empty">暂无标签可筛选</div>
      <button
        v-for="tag in list.allTags"
        :key="'pop-' + tag"
        type="button"
        class="card-manager-tag-option"
        :class="{ 'is-active': isSelected(tag) }"
        :data-card-tag="tag"
        role="option"
        :aria-selected="isSelected(tag) ? 'true' : 'false'"
        @click="toggleTag(tag)"
      >{{ tag }}</button>
    </CardPopover>
  </div>
</template>
