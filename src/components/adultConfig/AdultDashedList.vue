<script setup>
defineProps({
  kind: { type: String, required: true },
  rows: { type: Array, default: function () { return []; } },
  emptyText: { type: String, default: '' },
});
defineEmits(['remove', 'move', 'note']);
</script>

<template>
  <div class="adult-dashed-list">
    <span v-if="!rows.length" class="adult-wv-empty">{{ emptyText }}</span>
    <div
      v-for="(row, idx) in rows"
      :key="row.id"
      class="adult-dashed-item"
      :data-idx="idx"
      :data-kind="kind"
    >
      <div class="adult-dashed-item-head">
        <div class="adult-dashed-item-meta">
          <div class="adult-dashed-item-title">
            {{ row.title }}
            <span v-if="row.tag" class="adult-dashed-tag">{{ row.tag }}</span>
          </div>
          <div v-if="row.blurb" class="adult-dashed-item-desc">{{ row.blurb }}</div>
        </div>
      </div>
      <div class="adult-dashed-item-actions">
          <button
            v-if="row.canUp"
            type="button"
            class="adult-dashed-move"
            :data-flavor-up="kind === 'flavor' ? idx : null"
            title="上移"
            @click="$emit('move', idx, -1)"
          >↑</button>
          <button
            v-if="row.canDown"
            type="button"
            class="adult-dashed-move"
            :data-flavor-down="kind === 'flavor' ? idx : null"
            title="下移"
            @click="$emit('move', idx, 1)"
          >↓</button>
          <button
            type="button"
            class="adult-dashed-remove"
            :data-flavor-remove="kind === 'flavor' ? idx : null"
            @click="$emit('remove', idx)"
          >移除</button>
      </div>
      <textarea
        :value="row.note"
        rows="1"
        :data-flavor-note="kind === 'flavor' ? idx : null"
        :placeholder="row.notePlaceholder"
        @change="$emit('note', idx, $event.target.value)"
      ></textarea>
    </div>
  </div>
</template>
