<script setup>
import { onMounted, onUnmounted, watch } from 'vue';

defineOptions({ inheritAttrs: false });

const props = defineProps({
  open: { type: Boolean, default: false },
  tip: { type: String, default: '使用当前选中条目' },
  input: { type: String, default: '' },
  output: { type: String, default: '' },
  error: { type: String, default: '' },
});
const emit = defineEmits(['close', 'update:input', 'parse']);

function close() {
  emit('close');
}

function onKey(e) {
  if (e.key === 'Escape' && props.open) close();
}

watch(function () { return props.open; }, function (open) {
  if (typeof document === 'undefined') return;
  document.body.classList.toggle('rx-modal-open', !!open);
}, { immediate: true });

onMounted(function () {
  document.addEventListener('keydown', onKey);
});

onUnmounted(function () {
  document.removeEventListener('keydown', onKey);
  document.body.classList.remove('rx-modal-open');
});
</script>

<template>
  <Teleport to="body">
    <div v-if="open" id="rxTestModal" class="rx-modal ui-modal" aria-hidden="false">
      <div class="rx-modal-backdrop ui-modal-backdrop" data-rx-modal-close @click="close"></div>
      <div class="rx-modal-dialog ui-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="rxTestTitle">
        <div class="rx-modal-head">
          <strong id="rxTestTitle">测试正则</strong>
          <span class="rx-modal-tip" id="rxTestTip">{{ tip }}</span>
        </div>
        <div class="rx-modal-body">
          <div class="rx-field">
            <label class="rx-label" for="rxTestInput">测试文本</label>
            <textarea id="rxTestInput" rows="6" spellcheck="false" placeholder="粘贴要解析的文本…" :value="input" @input="$emit('update:input', $event.target.value)"></textarea>
          </div>
          <div class="rx-modal-actions-inline">
            <button type="button" class="btn-primary btn-inline" id="rxBtnParse" @click="$emit('parse')">解析</button>
          </div>
          <div class="rx-field">
            <label class="rx-label" for="rxTestOutput">解析结果</label>
            <textarea id="rxTestOutput" rows="6" spellcheck="false" readonly placeholder="点击「解析」后显示" :value="output"></textarea>
          </div>
          <p id="rxTestErr" class="rx-test-err" v-show="error">{{ error }}</p>
        </div>
        <div class="rx-modal-actions">
          <button type="button" class="btn-inline btn-ghost" data-rx-modal-close @click="close">取消</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
