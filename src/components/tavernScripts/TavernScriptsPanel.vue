<script setup>
import { computed, onMounted } from 'vue';
import { useStore } from '@nanostores/vue';
import { stateVersion, cardStore } from '../../lib/store/cardStore.mjs';
import { tavernScriptsStore, emptyTavernEditor } from '../../lib/store/tavernScriptsStore.mjs';
import { buildTavernScriptsView } from '../../lib/card-builder/panels/tavernViewModel.mjs';
import TavernScriptList from './TavernScriptList.vue';
import TavernScriptEditor from './TavernScriptEditor.vue';

function api() {
  return window.__tavernScriptsPanelApi__ || {};
}

const version = useStore(stateVersion);
const ui = useStore(tavernScriptsStore);

const view = computed(function () {
  version.value;
  ui.value;
  return buildTavernScriptsView(cardStore.get() || {}, ui.value);
});

const editor = computed(function () {
  return view.value.editor || emptyTavernEditor();
});

function add() {
  if (api().add) api().add();
}

function select(id) {
  if (api().select) api().select(id);
}

function toggle(id, enabled) {
  if (api().toggle) api().toggle(id, enabled);
}

function move(id, delta) {
  if (api().move) api().move(id, delta);
}

function remove(id) {
  if (api().remove) api().remove(id);
}

function update(key, value) {
  if (api().updateEditor) api().updateEditor({ [key]: value });
}

onMounted(function () {
  if (api().refresh) api().refresh();
});
</script>

<template>
  <div class="panel tavern-scripts-panel" id="tavernScriptsPanel">
    <div class="panel-header th-hero">
      <div>
        <h2>酒馆脚本</h2>
        <p class="ui-hint ui-hint--inline th-hero__sub">管理 <code>tavern_helper.scripts</code>：列表选中编辑，修改即时保存。不改动 <code>variables</code> 等其它字段。</p>
      </div>
      <div class="th-hero-actions">
        <button type="button" class="btn-primary btn-inline" id="thBtnAdd" @click="add">新建</button>
      </div>
    </div>

    <div class="th-layout">
      <TavernScriptList
        :items="view.items"
        :count-text="view.countText"
        @select="select"
        @toggle="toggle"
        @move="move"
        @remove="remove"
      />
      <TavernScriptEditor
        :editor="editor"
        :live-hint="view.liveHint"
        :live-hint-kind="view.liveHintKind"
        :status="view.status"
        @update="update"
      />
    </div>
  </div>
</template>
