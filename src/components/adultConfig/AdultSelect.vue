<script setup>
import { nextTick, onMounted, ref, watch } from 'vue';
import { enhanceSelectMini, syncEnhancedSelectLabel } from '../../lib/ui/enhanceSelectMini.mjs';

defineOptions({ inheritAttrs: false });

const props = defineProps({
  modelValue: { type: String, default: '' },
  ariaLabel: { type: String, default: '' },
  extraClass: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue']);
const el = ref(null);

function syncLabel() {
  if (el.value) syncEnhancedSelectLabel(el.value);
}

onMounted(function () {
  if (!el.value) return;
  el.value.value = props.modelValue || '';
  enhanceSelectMini(el.value, props.extraClass);
  syncLabel();
});

watch(function () { return props.modelValue; }, function (value) {
  nextTick(function () {
    if (!el.value) return;
    if (el.value.value !== (value || '')) el.value.value = value || '';
    syncLabel();
  });
});

function onChange(e) {
  emit('update:modelValue', e.target.value);
}
</script>

<template>
  <div class="adult-select-host">
    <select ref="el" v-bind="$attrs" class="adult-select-compact" :value="modelValue" :aria-label="ariaLabel" @change="onChange">
      <slot />
    </select>
  </div>
</template>
