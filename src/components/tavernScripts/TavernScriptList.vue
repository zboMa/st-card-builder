<script setup>
defineProps({
  items: { type: Array, default: function () { return []; } },
  countText: { type: String, default: '0 条' },
});

const emit = defineEmits(['select', 'toggle', 'move', 'remove']);

function select(id) {
  emit('select', id);
}

function onToggle(id, checked) {
  emit('toggle', id, checked);
}

function onMove(id, delta) {
  emit('move', id, delta);
}

function onRemove(id) {
  emit('remove', id);
}

function onKeydown(event, id) {
  if (event.target && event.target.closest && event.target.closest('input, button')) return;
  select(id);
}
</script>

<template>
  <section class="th-list-card" aria-label="脚本列表">
    <div class="th-list-head">
      <span id="thListCount">{{ countText }}</span>
      <span class="th-tip">按名称与现有注入对齐</span>
    </div>
    <div id="thList" class="th-list">
      <div
        v-for="item in items"
        :key="item.id"
        class="th-item"
        :class="{ 'is-active': item.selected, 'is-disabled': !item.enabled }"
        :data-idx="item.index"
        role="button"
        tabindex="0"
        @click="select(item.id)"
        @keydown.enter.prevent="onKeydown($event, item.id)"
        @keydown.space.prevent="onKeydown($event, item.id)"
      >
        <input
          type="checkbox"
          class="th-toggle"
          :data-idx="item.index"
          :checked="item.enabled"
          title="启停"
          @click.stop
          @change="onToggle(item.id, $event.target.checked)"
        />
        <div>
          <div class="th-item-name">
            {{ item.name }}
            <span v-if="item.badge" class="th-badge">{{ item.badge }}</span>
          </div>
          <div class="th-item-meta">{{ item.enabled ? '已启用' : '已禁用' }} · {{ item.type }}</div>
        </div>
        <div class="th-item-actions">
          <button type="button" class="th-icon-btn" data-move="up" :data-idx="item.index" title="上移" @click.stop="onMove(item.id, -1)">↑</button>
          <button type="button" class="th-icon-btn" data-move="down" :data-idx="item.index" title="下移" @click.stop="onMove(item.id, 1)">↓</button>
          <button type="button" class="th-icon-btn is-danger" :data-del="item.id" :data-idx="item.index" title="删除" @click.stop="onRemove(item.id)">×</button>
        </div>
      </div>
    </div>
    <p id="thEmpty" class="th-empty" v-show="!items.length">暂无脚本。MVU / 状态栏注入后会出现在此；也可手动新建。</p>
  </section>
</template>
