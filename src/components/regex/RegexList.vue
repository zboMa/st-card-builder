<script setup>
defineProps({
  items: { type: Array, default: function () { return []; } },
  countText: { type: String, default: '0 条' },
});
const emit = defineEmits(['select', 'toggle', 'move', 'remove']);

function onRowClick(index) {
  emit('select', index);
}

function onToggle(index, checked) {
  emit('toggle', index, checked);
}

function onMove(index, direction) {
  emit('move', index, direction);
}

function onRemove(index) {
  emit('remove', index);
}

function onKeydown(event, index) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  if (event.target && event.target.closest && event.target.closest('input, button')) return;
  event.preventDefault();
  emit('select', index);
}
</script>

<template>
  <section class="rx-list-card" aria-label="正则列表">
    <div class="rx-list-head">
      <span id="rxListCount">{{ countText }}</span>
      <span class="rx-tip">按脚本名与 MVU/状态栏注入对齐</span>
    </div>
    <div id="rxList" class="rx-list">
      <div
        v-for="item in items"
        :key="item.id"
        :class="['rx-item', { 'is-active': item.selected, 'is-disabled': item.disabled }]"
        :data-idx="item.index"
        role="button"
        tabindex="0"
        @click="onRowClick(item.index)"
        @keydown="onKeydown($event, item.index)"
      >
        <input
          type="checkbox"
          class="rx-toggle"
          :data-idx="item.index"
          :checked="!item.disabled"
          title="启停"
          @click.stop
          @change="onToggle(item.index, $event.target.checked)"
        />
        <div>
          <div class="rx-item-name">
            {{ item.name }}<span v-if="item.badge" class="rx-badge">{{ item.badge }}</span>
          </div>
          <div class="rx-item-meta">{{ item.disabled ? '已禁用 · ' : '' }}{{ item.placementLabel }}</div>
        </div>
        <div class="rx-item-actions">
          <button type="button" class="rx-icon-btn" :data-move="'up'" :data-idx="item.index" title="上移" @click.stop="onMove(item.index, 'up')">↑</button>
          <button type="button" class="rx-icon-btn" :data-move="'down'" :data-idx="item.index" title="下移" @click.stop="onMove(item.index, 'down')">↓</button>
          <button type="button" class="rx-icon-btn is-danger" :data-del="item.index" title="删除" @click.stop="onRemove(item.index)">×</button>
        </div>
      </div>
    </div>
    <p id="rxEmpty" class="rx-empty" v-show="!items.length">暂无正则。MVU / 状态栏注入后会出现在此；也可手动新建。</p>
  </section>
</template>
