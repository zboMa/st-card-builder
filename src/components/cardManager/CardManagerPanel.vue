<script setup>
import { onMounted } from 'vue';
import { cardManagerApi } from '../../lib/card-builder/panels/cardManagerBridge.mjs';
import CardManagerToolbar from './CardManagerToolbar.vue';
import CardManagerFilters from './CardManagerFilters.vue';
import CardManagerGrid from './CardManagerGrid.vue';
import ExportChecklistModal from './ExportChecklistModal.vue';

onMounted(() => {
  cardManagerApi.onMount();
});
</script>

<template>
  <div class="panel area-card-manager">
    <div class="card-manager-header">
      <div class="card-manager-heading">
        <h2>角色卡管理</h2>
        <p class="ui-panel-lead card-manager-tip">本地多卡草稿箱；编辑仅保存在本机，不会自动上云。时间旁云标表示未上云 / 未同步 / 已同步；未同步时可点「同步上云」，或在「⋯」里从云端覆盖拉取最新。</p>
        <div id="cardJourneyHost"></div>
      </div>
      <CardManagerToolbar />
    </div>

    <CardManagerFilters />

    <div id="exportChecklistBox" class="export-checklist-bar" hidden aria-hidden="true">
      <span id="exportChecklistSummary" class="export-checklist-bar__summary"></span>
    </div>

    <CardManagerGrid />
    <ExportChecklistModal />
  </div>
</template>
