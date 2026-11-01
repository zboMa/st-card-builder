<script setup>
import { onBeforeUnmount, watch } from 'vue';
import { useStore } from '@nanostores/vue';
import { cardListStore } from '../../lib/store/cardListStore.mjs';
import { cardManagerApi } from '../../lib/card-builder/panels/cardManagerBridge.mjs';

const list = useStore(cardListStore);

function close() {
  cardManagerApi.closeExportChecklist();
}
function refresh() {
  cardManagerApi.refreshExportChecklist();
}
function jump(view) {
  close();
  if (view) cardManagerApi.goView(view);
}

watch(
  () => list.value.exportModalOpen,
  (open) => {
    try { document.body.classList.toggle('export-checklist-modal-open', !!open); } catch (e) { /* ignore */ }
  }
);

onBeforeUnmount(() => {
  try { document.body.classList.remove('export-checklist-modal-open'); } catch (e) { /* ignore */ }
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="list.exportModalOpen"
      id="exportChecklistModal"
      class="export-checklist-modal"
      role="dialog"
      aria-modal="true"
      aria-hidden="false"
      aria-labelledby="exportChecklistModalTitle"
    >
      <div class="export-checklist-modal__backdrop ui-modal-backdrop" @click="close"></div>
      <div class="ui-modal-dialog export-checklist-modal__dialog" role="document">
        <div class="export-checklist-modal__head">
          <h3 id="exportChecklistModalTitle">导出前检查</h3>
          <div class="export-checklist-modal__head-actions">
            <button type="button" id="btnRefreshExportChecklist" class="btn btn-ghost btn-inline" @click="refresh">刷新</button>
            <button type="button" class="btn-icon btn-icon--sm" aria-label="关闭" @click="close">×</button>
          </div>
        </div>
        <p id="exportChecklistModalSummary" class="ui-hint export-checklist-modal__lead">{{ list.exportCheck.summaryText }}</p>
        <ul id="exportChecklistItems" class="export-checklist-items">
          <template v-if="!list.exportCheck.items.length">
            <li>当前卡可导出 JSON{{ list.exportCheck.canExportPng ? ' / PNG' : '（PNG 需头像）' }}</li>
          </template>
          <template v-else>
            <li
              v-for="(it, i) in list.exportCheck.items"
              :key="i"
              :class="it.level === 'critical' ? 'is-critical' : (it.level === 'warning' ? 'is-warning' : '')"
            >
              <span>{{ it.message }}</span>
              <button v-if="it.view" type="button" class="export-checklist-jump" @click="jump(it.view)">去处理</button>
            </li>
          </template>
        </ul>
      </div>
    </div>
  </Teleport>
</template>
