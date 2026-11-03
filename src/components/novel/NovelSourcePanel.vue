<script setup>
import { onMounted, ref } from 'vue';
import { useStore } from '@nanostores/vue';
import { novelSourceStore } from '../../lib/store/novelSourceStore.mjs';

const ui = useStore(novelSourceStore);
const fileInput = ref(null);

function api() {
  return window.__novelSourceApi__;
}

function onInput(key, event) {
  api()?.setField(key, event.target.value);
}

function onCheck(key, event) {
  api()?.setField(key, event.target.checked);
}

function onFileChange(event) {
  var file = event.target.files && event.target.files[0];
  if (file) api()?.loadFile(file);
}

function onClearFile() {
  if (api()?.clearFile() && fileInput.value) fileInput.value.value = '';
}

function onDragover() {
  api()?.setDragging(true);
}

function onDragleave() {
  api()?.setDragging(false);
}

function onDrop(event) {
  api()?.setDragging(false);
  var file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
  if (file) api()?.loadFile(file);
}

function onReset() {
  api()?.resetAll();
}

onMounted(function () {
  api()?.refresh();
});
</script>

<template>
  <div class="panel novel-workshop-panel" data-novel-panel="source">
    <h2>原始资料</h2>
    <p class="novel-panel-tip">导入长文后，经拆章 → 角色设定/开场白生成 → 人物/世界书/知识图谱抽取 → 文风蒸馏；抽取模块内可同步到主卡。</p>
    <div class="novel-stats" id="novelStatsBar">
      <span v-for="(stat, index) in ui.stats" :key="index" class="novel-stat-chip">{{ stat.text }}</span>
    </div>

    <section class="novel-card">
      <div class="novel-card-head">
        <strong>原始资料</strong>
        <span>支持 txt / md / json，可拖拽导入</span>
      </div>
      <div class="novel-card-body">
        <label
          id="novelDropzone"
          :class="['novel-dropzone', { 'is-dragover': ui.dragging }]"
          for="novelSourceFile"
          @dragover.prevent="onDragover"
          @dragleave="onDragleave"
          @drop.prevent="onDrop"
        >
          <span style="font-size:1.4rem">📥</span>
          <span class="novel-dropzone-title">点击或拖拽导入小说文件</span>
          <span class="novel-dropzone-subtitle">适合 txt / md / json</span>
        </label>
        <div class="novel-upload-row">
          <label class="btn btn-fetch novel-btn-sm novel-upload-btn" for="novelSourceFile">选择文件</label>
          <input ref="fileInput" id="novelSourceFile" type="file" accept=".txt,.md,.json" style="display:none;" @change="onFileChange" />
          <span id="novelFileHint" class="novel-dropzone-subtitle">支持 txt / md / json</span>
          <button v-if="ui.file" id="btnNovelClearFile" type="button" class="btn btn-fetch novel-btn-sm" @click="onClearFile">清空文件</button>
        </div>
        <div v-if="ui.file" id="novelFileSummary" class="novel-stat-chip" style="margin-bottom:12px;">
          <strong>{{ ui.file.name }}</strong> · {{ ui.file.length }} 字
        </div>
        <div class="novel-source-layout">
          <div class="form-group">
            <label for="novelSourceText">手动补充文本</label>
            <textarea id="novelSourceText" placeholder="贴入章节原文、人物设定表等。" :value="ui.sourceText" @input="onInput('sourceText', $event)"></textarea>
          </div>
          <div class="form-group">
            <label for="novelContextText">补充说明 (AI Context)</label>
            <textarea id="novelContextText" placeholder="例如：优先抽取男主设定，忽略路人。" :value="ui.contextText" @input="onInput('contextText', $event)"></textarea>
          </div>
        </div>
      </div>
    </section>

    <section class="novel-card">
      <div class="novel-card-head">
        <strong>全局处理配置</strong>
        <span>模式 / 并行 / 召回；分片字数在拆章与各抽取模块内配置</span>
      </div>
      <div class="novel-card-body">
        <div class="grid-3 novel-source-global-grid">
          <div class="form-group">
            <label for="novelNarrativeMode">处理模式</label>
            <select id="novelNarrativeMode" :value="ui.narrativeMode" @change="onInput('narrativeMode', $event)">
              <option value="story">剧情延续</option>
              <option value="worldbuilding">世界观重建</option>
            </select>
          </div>
          <div class="form-group">
            <label for="novelConcurrency">并行任务数</label>
            <input id="novelConcurrency" type="number" min="1" step="1" :value="ui.concurrency" @input="onInput('concurrency', $event)" @change="onInput('concurrency', $event)" />
          </div>
          <div class="form-group">
            <label for="novelExpandBudget">AI 扩展召回预算（字）</label>
            <input id="novelExpandBudget" type="number" min="1000" step="1000" :value="ui.expandBudget" @input="onInput('expandBudget', $event)" @change="onInput('expandBudget', $event)" />
          </div>
        </div>
        <label class="novel-switch">
          <input id="novelStrictQuality" type="checkbox" :checked="ui.strictQuality" @change="onCheck('strictQuality', $event)" />
          <span>严格质量检查</span>
        </label>
        <div class="novel-toolbar" style="margin-top:12px;justify-content:space-between;">
          <span class="novel-dropzone-subtitle">清空章节/人物/世界书草稿/知识图谱/文风等产出，保留原文与分片等配置</span>
          <button id="btnNovelResetAll" type="button" class="btn btn-delete novel-btn-sm" @click="onReset">重置并清空结果</button>
        </div>
        <div id="novelSourceStatus" class="novel-status-text">{{ ui.status }}</div>
      </div>
    </section>
  </div>
</template>
