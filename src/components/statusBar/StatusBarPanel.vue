<script setup>
import { onMounted } from 'vue';
import { useStore } from '@nanostores/vue';
import { statusBarStore } from '../../lib/store/statusBarStore.mjs';
import StatusBarTree from './StatusBarTree.vue';

const ui = useStore(statusBarStore);

function api() {
  return window.__statusBarPanelApi__;
}

function onProtagonist(event) {
  api()?.toggleProtagonist(event.target.checked);
}

function onNsfw(event) {
  api()?.toggleNsfw(event.target.checked);
}

function onModule(id, event) {
  api()?.toggleModule(id, event.target.checked);
}

function onCharacter(name, event) {
  api()?.toggleCharacter(name, event.target.checked);
}

function onExtra(event) {
  api()?.setExtra(event.target.value);
}

function onLayoutPrompt(event) {
  api()?.setLayoutPrompt(event.target.value);
}

onMounted(() => {
  api()?.refresh();
});
</script>

<template>
  <div class="panel statusbar-panel" id="statusbarPanel">
    <div class="panel-header statusbar-panel-head">
      <h2>状态栏</h2>
    </div>
    <div class="sb-toolbar">
      <button type="button" class="btn btn-ghost btn-inline btn-expand-preview" id="sbBtnPreviewPrompt" title="查看提示词" aria-label="查看提示词" @click="api()?.previewPrompt()">
        <svg class="icon-expand-corners" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M8 3H5a2 2 0 0 0-2 2v3" />
          <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
          <path d="M3 16v3a2 2 0 0 0 2 2h3" />
          <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
        </svg>
      </button>
      <button type="button" class="btn btn-inline" id="sbBtnSampleFloors" :disabled="ui.busy.sample" @click="api()?.generateSampleFloors()">生成3楼样例变量数据</button>
    </div>

    <div class="sb-layout">
      <ol class="sb-rail">
        <li class="sb-step" data-sb-step="1">
          <span class="ui-step-pill sb-step-mark" :class="{ 'is-done': ui.stepDone[1] }" data-sb-mark="1"><span>1</span></span>
          <div class="sb-step-body">
            <h3>人物</h3>
            <div class="sb-line">
              <label class="sb-check" for="sbIncludeProtagonist">
                <input type="checkbox" id="sbIncludeProtagonist" :checked="ui.includeProtagonist" @change="onProtagonist" />
                <span>主角</span>
              </label>
              <span class="ui-hint ui-hint--inline" id="sbCharName">#{{ ui.charName }}</span>
            </div>
            <div id="sbCharList" class="sb-char-list">
              <p v-if="!ui.characters.length" class="ui-hint">世界书里还没有人物条目。</p>
              <label v-for="c in ui.characters" :key="c.name" class="sb-check">
                <input type="checkbox" :checked="c.selected" @change="onCharacter(c.name, $event)" />
                <span>{{ c.name }}</span>
              </label>
            </div>
          </div>
        </li>

        <li class="sb-step" data-sb-step="2">
          <span class="ui-step-pill sb-step-mark" :class="{ 'is-done': ui.stepDone[2] }" data-sb-mark="2"><span>2</span></span>
          <div class="sb-step-body">
            <h3>预设</h3>
            <label class="sb-check" for="sbNsfw">
              <input type="checkbox" id="sbNsfw" :checked="ui.nsfw" @change="onNsfw" />
              <span>NSFW</span>
            </label>
            <div id="sbPresetGrid" class="sb-presets">
              <button
                v-for="preset in ui.presets"
                :key="preset.id"
                type="button"
                class="btn btn-inline"
                :class="{ 'is-active': preset.active }"
                @click="api()?.selectPreset(preset.id)"
              >{{ preset.label }}</button>
            </div>
            <div class="sb-line">
              <span class="sb-k">模块</span>
              <button type="button" class="btn btn-inline" id="sbBtnResetModules" @click="api()?.resetModules()">重置</button>
            </div>
            <div id="sbModuleGrid" class="sb-modules">
              <div v-for="group in ui.moduleGroups" :key="group.id" class="sb-module-group">
                <div class="sb-k">{{ group.label }}</div>
                <div class="sb-module-group__items">
                  <label v-for="mod in group.items" :key="mod.id" class="sb-check" :title="mod.hint">
                    <input type="checkbox" :checked="mod.checked" @change="onModule(mod.id, $event)" />
                    <span>{{ mod.label }}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </li>

        <li class="sb-step" data-sb-step="3">
          <span class="ui-step-pill sb-step-mark" :class="{ 'is-done': ui.stepDone[3] }" data-sb-mark="3"><span>3</span></span>
          <div class="sb-step-body">
            <div class="sb-step-head">
              <h3>变量</h3>
              <button type="button" class="btn btn-inline" id="sbBtnVars" :disabled="ui.busy.vars" @click="api()?.generateVariables()">{{ ui.generateLabel }}</button>
            </div>
            <label class="sb-k" for="sbExtra">额外要求</label>
            <textarea id="sbExtra" rows="2" placeholder="如：强调契约进度" :value="ui.extra" @input="onExtra"></textarea>
          </div>
        </li>

        <li class="sb-step" data-sb-step="4">
          <span class="ui-step-pill sb-step-mark" :class="{ 'is-done': ui.stepDone[4] }" data-sb-mark="4"><span>4</span></span>
          <div class="sb-step-body">
            <div class="sb-step-head">
              <h3>排版</h3>
              <div class="sb-step-actions">
                <button type="button" class="btn btn-inline" id="sbBtnLayoutRegen" :disabled="ui.busy.layout" @click="api()?.generateLayout(false)">重新生成</button>
                <button type="button" class="btn btn-inline" id="sbBtnLayoutRevise" :disabled="ui.busy.layout" @click="api()?.generateLayout(true)">修改</button>
              </div>
            </div>
            <label class="sb-k" for="sbLayoutPrompt">排版风格说明</label>
            <textarea id="sbLayoutPrompt" rows="4" placeholder="如：窄条清单，数值用细进度条" :value="ui.layoutPrompt" @input="onLayoutPrompt"></textarea>
          </div>
        </li>
      </ol>

      <section class="sb-preview-pane">
        <div class="assistant-mode-switch" id="sbViewSwitch" :data-mode="ui.view" role="tablist" aria-label="预览、变量与注入脚本">
          <span class="assistant-mode-switch__thumb" aria-hidden="true"></span>
          <button type="button" class="assistant-mode-switch__btn" :class="{ 'is-active': ui.view === 'preview' }" role="tab" :aria-selected="ui.view === 'preview' ? 'true' : 'false'" data-sb-view="preview" @click="api()?.setView('preview')">预览</button>
          <button type="button" class="assistant-mode-switch__btn" :class="{ 'is-active': ui.view === 'vars' }" role="tab" :aria-selected="ui.view === 'vars' ? 'true' : 'false'" data-sb-view="vars" @click="api()?.setView('vars')">变量</button>
          <button type="button" class="assistant-mode-switch__btn" :class="{ 'is-active': ui.view === 'script' }" role="tab" :aria-selected="ui.view === 'script' ? 'true' : 'false'" data-sb-view="script" @click="api()?.setView('script')">注入脚本</button>
        </div>
        <div v-show="ui.view === 'preview'" class="sb-view-pane" data-sb-view-pane="preview">
          <p class="ui-hint" id="sbPreviewHint">{{ ui.hintText }}</p>
          <iframe id="sbPreviewFrame" class="sb-preview-frame" title="状态栏预览" sandbox="allow-same-origin" :srcdoc="ui.previewHtml"></iframe>
          <div class="sb-floor-nav">
            <button type="button" class="btn btn-inline" id="sbFloorPrev" @click="api()?.shiftFloor(-1)">上一楼</button>
            <span id="sbFloorLabel">{{ ui.floorLabel }}</span>
            <button type="button" class="btn btn-inline" id="sbFloorNext" @click="api()?.shiftFloor(1)">下一楼</button>
          </div>
        </div>
        <div v-show="ui.view === 'vars'" class="sb-view-pane" data-sb-view-pane="vars">
          <div id="sbVarTree" class="sb-tree">
            <StatusBarTree v-if="ui.hasTree" :node="ui.tree" />
            <p v-else class="ui-hint">勾选主角或至少一名角色并开启模块后，这里显示变量结构。</p>
          </div>
        </div>
        <div v-show="ui.view === 'script'" class="sb-view-pane" data-sb-view-pane="script">
          <pre id="sbSnippetCode" class="sb-code">{{ ui.snippetCode }}</pre>
        </div>
      </section>
    </div>
  </div>
</template>
