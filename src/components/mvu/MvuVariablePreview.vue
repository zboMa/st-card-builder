<script setup>
defineProps({
  groups: { type: Array, default: () => [] },
  busy: { type: Object, default: () => ({ add: false, regenPath: '' }) },
});

const emit = defineEmits(['delete', 'regen']);

function compactDefault(value) {
  if (value === undefined) return 'undefined';
  let text = typeof value === 'string' ? value : JSON.stringify(value);
  if (text == null) text = '';
  return text.length > 80 ? text.slice(0, 77) + '...' : text;
}
</script>

<template>
  <div id="vcVariablePreviewList" class="vc-preview-grid">
    <section v-for="group in groups" :key="group.name" class="vc-var-group">
      <div class="vc-var-group-title">{{ group.name }}<span>{{ group.count }}</span></div>
      <div class="vc-var-list">
        <article v-for="variable in group.variables" :key="variable.path" class="vc-var-item">
          <div class="vc-var-path">{{ variable.path }}</div>
          <div class="vc-var-type">{{ variable.type || 'string' }}</div>
          <div v-if="variable.description || (variable.check && variable.check[0])" class="vc-var-desc">
            {{ variable.description || variable.check[0] }}
          </div>
          <div class="vc-var-default">默认值：<code>{{ compactDefault(variable.default) }}</code></div>
          <div class="vc-var-actions">
            <button
              type="button"
              class="vc-var-action"
              data-vc-action="regen"
              :data-path="variable.path"
              :disabled="busy.regenPath === variable.path"
              @click="emit('regen', variable.path)"
            >{{ busy.regenPath === variable.path ? '生成中...' : '单独重写' }}</button>
            <button
              type="button"
              class="vc-var-action danger"
              data-vc-action="delete"
              :data-path="variable.path"
              @click="emit('delete', variable.path)"
            >删除</button>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>
