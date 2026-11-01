<script setup>
import { ref } from 'vue';
import { cardManagerApi } from '../../lib/card-builder/panels/cardManagerBridge.mjs';

const fileInput = ref(null);
const importing = ref(false);

function pickFile() {
  if (!fileInput.value) return;
  fileInput.value.value = '';
  fileInput.value.click();
}

async function onChange(e) {
  const file = e.target && e.target.files && e.target.files[0];
  if (!file) return;
  importing.value = true;
  try {
    await cardManagerApi.importFile(file);
  } finally {
    importing.value = false;
    if (e.target) e.target.value = '';
  }
}
</script>

<template>
  <div class="card-manager-toolbar">
    <button type="button" id="btnCloudSyncAllDirty" class="btn btn-fetch btn-sm" @click="cardManagerApi.cloudUploadAll()">同步未上云</button>
    <button type="button" id="btnNewDraft" class="btn btn-add btn-sm" @click="cardManagerApi.createBlank()">新建</button>
    <button type="button" id="btnImportCard" class="btn btn-fetch btn-sm" :disabled="importing" @click="pickFile">导入</button>
    <input ref="fileInput" id="importCardInput" type="file" accept=".json,.png" style="display:none" @change="onChange" />
  </div>
</template>
