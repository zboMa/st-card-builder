<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useStore } from '@nanostores/vue';
import { stateVersion } from '../../lib/store/cardStore.mjs';
import { adultUiStore } from '../../lib/store/adultStore.mjs';
import AdultDashedList from './AdultDashedList.vue';
import AdultSelect from './AdultSelect.vue';

function api() {
  return window.__adultConfigApi__ || {};
}

const version = useStore(stateVersion);
const ui = useStore(adultUiStore);
const group = ref('');
const item = ref('');
const note = ref('');
const msg = ref('');

const view = computed(function () {
  version.value;
  if (!ui.value.addModal || !ui.value.addModal.open) return null;
  return api().addView ? api().addView() : null;
});

const currentGroup = computed(function () {
  if (!view.value) return null;
  return view.value.catalog.find(function (g) { return g.id === group.value; }) || null;
});

const items = computed(function () {
  return currentGroup.value ? currentGroup.value.items : [];
});

const preview = computed(function () {
  version.value;
  if (!view.value || !item.value) return null;
  return api().previewAddItem ? api().previewAddItem(item.value) : null;
});

watch(function () { return view.value && view.value.kind; }, function (kind) {
  if (!kind) return;
  group.value = '';
  item.value = '';
  note.value = '';
  msg.value = '';
});

watch(group, function () {
  item.value = '';
  msg.value = '';
});

function close() {
  if (api().closeAddModal) api().closeAddModal();
}

function add() {
  if (!view.value) return;
  if (!item.value) {
    msg.value = '请选择条目';
    return;
  }
  var existing = view.value.selected || [];
  if (existing.some(function (row) { return row.id === item.value; })) {
    msg.value = '已添加过该项目';
    return;
  }
  if (view.value.max && existing.length >= view.value.max) {
    msg.value = '已超过 ' + view.value.max + ' 项';
    return;
  }
  api().addItem(view.value.kind, item.value, note.value);
  msg.value = '已添加';
  item.value = '';
  note.value = '';
}

function onRemove(idx) {
  if (!view.value) return;
  Promise.resolve(api().removeItem(view.value.kind, idx)).then(function () {
    msg.value = '';
  });
}

function onMove(idx, delta) {
  if (!view.value) return;
  api().moveItem(view.value.kind, idx, delta);
}

function onNote(idx, value) {
  if (!view.value) return;
  api().setNote(view.value.kind, idx, value);
}

function onKeydown(e) {
  if (e.key === 'Escape') close();
}

onMounted(function () {
  document.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(function () {
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <Teleport to="body">
    <div v-if="view" class="app-confirm-overlay adult-add-overlay" role="presentation" tabindex="-1" @click.self="close">
      <div class="app-confirm-dialog adult-add-dialog" role="dialog" aria-modal="true" tabindex="-1">
        <div class="adult-add-head">
          <h3 class="app-confirm-title">添加{{ view.label }}</h3>
          <span class="adult-add-subtitle">{{ view.hint }}</span>
          <button type="button" class="adult-add-close" aria-label="关闭" @click="close">×</button>
        </div>
        <div class="adult-add-form">
          <AdultSelect v-model="group" aria-label="选择分组" extra-class="cs-w148" class="adult-add-group">
            <option value="">选择分组…</option>
            <option v-for="g in view.catalog" :key="g.id" :value="g.id">{{ g.label }}</option>
          </AdultSelect>
          <AdultSelect v-model="item" aria-label="选择条目" extra-class="cs-fill" class="adult-add-item">
            <option value="">选择条目…</option>
            <option v-for="it in items" :key="it.id" :value="it.id">
              {{ it.label }}{{ it.summary ? ' — ' + it.summary : '' }}
            </option>
          </AdultSelect>
          <button type="button" class="btn btn-add adult-add-confirm" @click="add">确认添加</button>
        </div>
        <div class="adult-add-body">
          <div v-if="preview" class="adult-add-preview show">
            <div class="adult-add-preview-title">{{ preview.title }}</div>
            <div class="adult-add-pv-content">
              <div v-if="preview.summary" class="adult-add-pv-sum">{{ preview.summary }}</div>
              <div v-for="block in preview.blocks" :key="block[0]" class="adult-add-pv-block">
                <div class="adult-add-pv-label">{{ block[0] }}</div>
                <div class="adult-add-pv-text">{{ block[1] }}</div>
              </div>
              <div v-if="!preview.blocks.length && preview.description">{{ preview.description }}</div>
            </div>
          </div>
          <div class="adult-add-note">
            <textarea v-model="note" rows="1" placeholder="可选：补充该条额外要求/备注"></textarea>
          </div>
          <div class="adult-add-selected-head">{{ view.selectedHead }}</div>
          <div class="adult-add-selected-list">
            <AdultDashedList
              :kind="view.kind"
              :rows="view.selected"
              empty-text="尚未添加——在上方选择条目后点「确认添加」。"
              @remove="onRemove"
              @move="onMove"
              @note="onNote"
            />
          </div>
        </div>
        <div class="adult-add-actions">
          <span class="adult-add-msg">{{ msg }}</span>
          <button type="button" class="btn btn-ghost" @click="close">完成</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
