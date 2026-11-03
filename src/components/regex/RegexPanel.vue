<script setup>
import { computed, onMounted } from 'vue';
import { useStore } from '@nanostores/vue';
import { cardStore, stateVersion } from '../../lib/store/cardStore.mjs';
import { emptyRegexEditor, regexStore } from '../../lib/store/regexStore.mjs';
import { buildRegexView } from '../../lib/card-builder/panels/regexViewModel.mjs';
import RegexList from './RegexList.vue';
import RegexEditor from './RegexEditor.vue';
import RegexTestModal from './RegexTestModal.vue';

const version = useStore(stateVersion);
const ui = useStore(regexStore);
const view = computed(() => {
  version.value;
  return buildRegexView(cardStore.get(), ui.value);
});
const editor = computed(() => ui.value.editor || emptyRegexEditor());

function api() {
  return window.__regexPanelApi__;
}

function onUpdate(patch) {
  api()?.updateEditor(patch);
}

function onPlacement(placement, enabled) {
  api()?.setPlacement(placement, enabled);
}

function onSelect(index) {
  api()?.select(index);
}

function onToggle(index) {
  api()?.toggleAt(index);
}

function onMove(index, direction) {
  api()?.moveAt(index, direction);
}

function onRemove(index) {
  api()?.deleteAt(index);
}

function onAdd() {
  api()?.add();
}

function onOpenTest() {
  api()?.openTest();
}

function onCloseTest() {
  api()?.closeTest();
}

function onTestInput(text) {
  api()?.setTestInput(text);
}

function onParse() {
  api()?.runParse();
}

onMounted(() => {
  api()?.refresh();
});
</script>

<template>
  <div class="panel regex-panel" id="regexPanel">
    <div class="panel-header rx-hero">
      <div>
        <h2>正则</h2>
        <p class="ui-hint ui-hint--inline rx-hero__sub">管理 SillyTavern <code>regex_scripts</code>：列表选中编辑，修改即时保存。导出仍写原字段。</p>
      </div>
      <div class="rx-hero-actions">
        <button type="button" class="btn-inline btn-ghost" id="rxBtnTest" @click="onOpenTest">测试</button>
        <button type="button" class="btn-primary btn-inline" id="rxBtnAdd" @click="onAdd">新建</button>
      </div>
    </div>

    <div class="rx-layout">
      <RegexList
        :items="view.items"
        :count-text="view.countText"
        @select="onSelect"
        @toggle="onToggle"
        @move="onMove"
        @remove="onRemove"
      />
      <RegexEditor
        v-show="view.selectedId"
        :editor="editor"
        :live-hint="ui.liveHint"
        :live-hint-kind="ui.liveHintKind"
        :status="ui.status"
        :status-kind="ui.statusKind"
        @update="onUpdate"
        @placement="onPlacement"
      />
    </div>

    <RegexTestModal
      :open="ui.testOpen"
      :tip="ui.testTip"
      :input="ui.testInput"
      :output="ui.testOutput"
      :error="ui.testError"
      @close="onCloseTest"
      @update:input="onTestInput"
      @parse="onParse"
    />
  </div>
</template>
