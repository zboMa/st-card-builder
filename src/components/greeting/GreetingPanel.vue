<script setup>
import { nextTick, onMounted, ref } from 'vue';
import { useStore } from '@nanostores/vue';
import { greetingStore } from '../../lib/store/greetingStore.mjs';
import GreetingAltItem from './GreetingAltItem.vue';

const ui = useStore(greetingStore);
const listRef = ref(null);

function api() {
  return window.__greetingPanelApi__;
}

async function focusAlt(index) {
  await nextTick();
  const el = listRef.value && listRef.value.querySelector('[data-alt-idx="' + index + '"]');
  if (el) el.focus();
}

function onFirstInput(event) {
  api()?.setFirstMes(event.target.value);
}

function onFirstInitInput(event) {
  api()?.setMainInitText(event.target.value);
}

function onAdd() {
  const index = api()?.addAlt();
  if (index != null) focusAlt(index);
}

function onAltInput(index, value) {
  api()?.updateAltText(index, value);
}

function onAltInitInput(index, value) {
  api()?.setAltInitText(index, value);
}

function onToggleAltInit(index) {
  api()?.toggleAltInit(index);
}

function onGenerateAltInit(index) {
  api()?.generateAltInit(index);
}

function onPreviewAlt(index) {
  api()?.previewAlt(index);
}

function onMove(index, direction) {
  api()?.moveAlt(index, direction);
}

function onRemove(index) {
  api()?.removeAlt(index);
}

onMounted(() => {
  api()?.refresh();
});
</script>

<template>
  <div class="panel area-greetings">
    <div class="greetings-head">
      <h2>开场白</h2>
      <span id="greetingsTokenCount" class="tok-text" :title="ui.totalTokenTitle" aria-live="polite">{{ ui.totalTokenText }}</span>
    </div>
    <p class="greetings-tip ui-panel-lead">这里只写开场场景。每条开场可以另有变量起点，不填就用世界书保底，填了的在导出和试聊时接到这条开场后面。</p>
    <p v-show="ui.showFlavorTip" id="greetingsFlavorTip" class="greetings-flavor-tip">{{ ui.flavorTip }}</p>

    <div class="form-group">
      <div class="ui-label-row greetings-first-bar">
        <label for="firstMes">主开场白 (First Message)</label>
        <span id="firstMesTok" class="tok-text" :title="ui.firstMesTokenTitle" aria-live="polite">{{ ui.firstMesTokenText }}</span>
        <button type="button" id="btnPreviewFirstMes" class="btn-alt-action btn-expand-preview" title="预览" aria-label="预览主开场白" @click="api()?.previewMain()">
          <svg class="icon-expand-corners" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
            <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
            <path d="M3 16v3a2 2 0 0 0 2 2h3" />
            <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        </button>
      </div>
      <textarea
        id="firstMes"
        style="min-height: 160px;"
        :value="ui.firstMes"
        placeholder="角色的开场白（首次对话发送的第一条消息）..."
        @input="onFirstInput"
      ></textarea>
      <div class="greeting-init-row">
        <span class="greeting-init-label">变量起点</span>
        <span id="greetingInitMainHint" class="ui-hint ui-hint--inline">{{ ui.main.initHint }}</span>
        <button
          type="button"
          id="btnGreetingInitGenerate"
          class="btn-inline btn-ghost"
          :disabled="ui.main.generateDisabled || ui.main.busy"
          :title="ui.main.generateTitle"
          @click="api()?.generateMainInit()"
        >{{ ui.main.generateLabel }}</button>
        <button
          type="button"
          id="btnGreetingInitMain"
          class="btn-text btn-inline"
          :aria-expanded="ui.main.initOpen ? 'true' : 'false'"
          @click="api()?.toggleMainInit()"
        >手动修改</button>
      </div>
      <textarea
        v-show="ui.main.initOpen"
        id="greetingInitMain"
        class="greeting-init-ta"
        :value="ui.main.initText"
        rows="3"
        placeholder="每行一条：路径=值。留空则这条开场沿用世界书保底。"
        @input="onFirstInitInput"
      ></textarea>
    </div>

    <hr class="divider" />

    <div class="alt-greetings-section">
      <div class="alt-greetings-header ui-label-row">
        <label class="alt-greetings-label">备选开场白 (Alternate Greetings)</label>
        <span class="ui-hint ui-hint--inline alt-greetings-tip">酒馆中用户可在多个开场白之间切换选择</span>
        <button id="btnAddGreeting" type="button" class="btn-alt-add" title="添加备选开场白" @click="onAdd">＋</button>
      </div>
      <div id="altGreetingsList" ref="listRef">
        <div v-if="!ui.alts.length" class="alt-greetings-empty">暂无备选开场白，点击右上角 ＋ 添加</div>
        <GreetingAltItem
          v-for="item in ui.alts"
          :key="item.index"
          :item="item"
          @input="onAltInput"
          @init-input="onAltInitInput"
          @toggle-init="onToggleAltInit"
          @generate-init="onGenerateAltInit"
          @preview="onPreviewAlt"
          @up="onMove(item.index, -1)"
          @down="onMove(item.index, 1)"
          @remove="onRemove"
        />
      </div>
    </div>
  </div>
</template>
