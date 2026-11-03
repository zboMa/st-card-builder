<script setup>
defineProps({
  item: { type: Object, required: true },
});

defineEmits([
  'input',
  'init-input',
  'toggle-init',
  'generate-init',
  'preview',
  'up',
  'down',
  'remove',
]);
</script>

<template>
  <div class="alt-greeting-item">
    <hr v-if="item.index > 0" class="divider" />
    <div class="alt-greeting-bar">
      <span class="alt-greeting-label">{{ item.label }}</span>
      <span class="alt-greeting-tok tok-text" :title="item.tokenTitle">{{ item.tokenText }}</span>
      <div class="alt-greeting-actions">
        <button
          type="button"
          class="btn-alt-action btn-expand-preview"
          data-action="preview"
          title="预览"
          :aria-label="'预览' + item.label"
          @click="$emit('preview', item.index)"
        >
          <svg class="icon-expand-corners" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
            <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
            <path d="M3 16v3a2 2 0 0 0 2 2h3" />
            <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        </button>
        <button
          v-if="item.canUp"
          type="button"
          class="btn-alt-action"
          data-action="up"
          title="上移"
          @click="$emit('up', item.index)"
        >↑</button>
        <button
          v-if="item.canDown"
          type="button"
          class="btn-alt-action"
          data-action="down"
          title="下移"
          @click="$emit('down', item.index)"
        >↓</button>
        <button
          type="button"
          class="btn-alt-action btn-alt-del"
          data-action="del"
          title="删除"
          @click="$emit('remove', item.index)"
        >✕</button>
      </div>
    </div>
    <textarea
      class="alt-greeting-ta"
      :data-alt-idx="item.index"
      :value="item.text"
      :placeholder="item.label + ' 的内容...'"
      @input="$emit('input', item.index, $event.target.value)"
    ></textarea>
    <div class="greeting-init-row">
      <span class="greeting-init-label">变量起点</span>
      <span class="ui-hint ui-hint--inline greeting-init-hint">{{ item.initHint }}</span>
      <button
        type="button"
        class="btn-inline btn-ghost"
        data-action="generate-init"
        :disabled="item.generateDisabled || item.busy"
        :title="item.generateTitle"
        @click="$emit('generate-init', item.index)"
      >{{ item.generateLabel }}</button>
      <button
        type="button"
        class="btn-text btn-inline"
        data-action="init"
        :aria-expanded="item.initOpen ? 'true' : 'false'"
        @click="$emit('toggle-init', item.index)"
      >手动修改</button>
    </div>
    <textarea
      v-show="item.initOpen"
      class="greeting-init-ta"
      :value="item.initText"
      rows="3"
      placeholder="每行一条：路径=值。留空则这条开场沿用世界书保底。"
      @input="$emit('init-input', item.index, $event.target.value)"
    ></textarea>
  </div>
</template>
