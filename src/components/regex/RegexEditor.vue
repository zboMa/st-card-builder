<script setup>
defineProps({
  editor: { type: Object, required: true },
  liveHint: { type: String, default: '' },
  liveHintKind: { type: String, default: '' },
  status: { type: String, default: '' },
  statusKind: { type: String, default: '' },
});
const emit = defineEmits(['update', 'placement']);

function hasPlacement(placement, value) {
  return Array.isArray(placement) && placement.indexOf(value) >= 0;
}

function onInput(key, event) {
  emit('update', { [key]: event.target.value });
}

function onCheck(key, event) {
  emit('update', { [key]: event.target.checked });
}

function onPlacement(value, event) {
  emit('placement', value, event.target.checked);
}
</script>

<template>
  <section class="rx-editor-card" id="rxEditor" :hidden="!editor.id">
    <div class="rx-editor-head">
      <h3>编辑正则</h3>
      <span id="rxLiveHint" :class="['rx-live-hint', liveHintKind ? 'is-' + liveHintKind : '']">{{ liveHint }}</span>
    </div>

    <input type="hidden" id="rxId" :value="editor.id" />

    <div class="rx-field">
      <label class="rx-label" for="rxScriptName">脚本名称</label>
      <input id="rxScriptName" type="text" autocomplete="off" :value="editor.scriptName" @input="onInput('scriptName', $event)" @change="onInput('scriptName', $event)" />
    </div>
    <div class="rx-field">
      <label class="rx-label" for="rxFind">匹配正则</label>
      <textarea id="rxFind" rows="3" spellcheck="false" placeholder="如：&lt;StatusBar&gt;([\s\S]*?)&lt;/StatusBar&gt;" :value="editor.findRegex" @input="onInput('findRegex', $event)" @change="onInput('findRegex', $event)"></textarea>
    </div>
    <div class="rx-field">
      <label class="rx-label" for="rxReplace">替换内容</label>
      <textarea id="rxReplace" rows="4" spellcheck="false" placeholder="可用 $1 引用捕获组" :value="editor.replaceString" @input="onInput('replaceString', $event)" @change="onInput('replaceString', $event)"></textarea>
    </div>

    <div class="rx-editor-cols">
      <div class="rx-col">
        <div class="rx-section-title">作用范围</div>
        <div class="rx-checks rx-checks-stack">
          <label class="rx-check"><input type="checkbox" id="rxPlaceUser" value="1" :checked="hasPlacement(editor.placement, 1)" @change="onPlacement(1, $event)" /><span>用户输入</span></label>
          <label class="rx-check"><input type="checkbox" id="rxPlaceAi" value="2" :checked="hasPlacement(editor.placement, 2)" @change="onPlacement(2, $event)" /><span>AI输出</span></label>
          <label class="rx-check"><input type="checkbox" id="rxPlaceSlash" value="3" :checked="hasPlacement(editor.placement, 3)" @change="onPlacement(3, $event)" /><span>快捷命令</span></label>
          <label class="rx-check"><input type="checkbox" id="rxPlaceWorld" value="5" :checked="hasPlacement(editor.placement, 5)" @change="onPlacement(5, $event)" /><span>世界书</span></label>
          <label class="rx-check"><input type="checkbox" id="rxPlaceReason" value="6" :checked="hasPlacement(editor.placement, 6)" @change="onPlacement(6, $event)" /><span>推理</span></label>
        </div>
        <div class="rx-depth-row">
          <div class="rx-field rx-field-tight">
            <label class="rx-label" for="rxMinDepth">最小深度</label>
            <input type="number" id="rxMinDepth" placeholder="空=不限" :value="editor.minDepth" @input="onInput('minDepth', $event)" @change="onInput('minDepth', $event)" />
          </div>
          <div class="rx-field rx-field-tight">
            <label class="rx-label" for="rxMaxDepth">最大深度</label>
            <input type="number" id="rxMaxDepth" placeholder="空=不限" :value="editor.maxDepth" @input="onInput('maxDepth', $event)" @change="onInput('maxDepth', $event)" />
          </div>
        </div>
      </div>
      <div class="rx-col">
        <div class="rx-section-title">其他选项</div>
        <div class="rx-checks rx-checks-stack">
          <label class="rx-check"><input type="checkbox" id="rxDisabled" :checked="editor.disabled" @change="onCheck('disabled', $event)" /><span>已禁用</span></label>
          <label class="rx-check"><input type="checkbox" id="rxRunOnEdit" :checked="editor.runOnEdit" @change="onCheck('runOnEdit', $event)" /><span>编辑时运行</span></label>
        </div>
        <div class="rx-section-title">宏</div>
        <div class="rx-checks">
          <label class="rx-check"><input type="checkbox" id="rxSubstitute" :checked="editor.substituteRegex" @change="onCheck('substituteRegex', $event)" /><span>宏查找替换</span></label>
        </div>
        <div class="rx-section-title">表层替换</div>
        <div class="rx-checks rx-checks-stack">
          <label class="rx-check"><input type="checkbox" id="rxMarkdownOnly" :checked="editor.markdownOnly" @change="onCheck('markdownOnly', $event)" /><span>仅显示</span></label>
          <label class="rx-check"><input type="checkbox" id="rxPromptOnly" :checked="editor.promptOnly" @change="onCheck('promptOnly', $event)" /><span>仅后端提示词</span></label>
        </div>
      </div>
    </div>

    <div id="rxStatus" :class="['rx-status', statusKind ? 'is-' + statusKind : '']">{{ status }}</div>
  </section>
</template>
