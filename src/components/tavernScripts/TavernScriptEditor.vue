<script setup>
const props = defineProps({
  editor: {
    type: Object,
    default: function () {
      return {
        id: '',
        name: '',
        type: 'script',
        enabled: true,
        info: '',
        content: '',
        buttonEnabled: true,
        buttonJson: '[]',
        dataJson: '{}',
      };
    },
  },
  liveHint: { type: String, default: '' },
  liveHintKind: { type: String, default: '' },
  status: { type: String, default: '' },
});

const emit = defineEmits(['update']);

function update(key, value) {
  emit('update', key, value);
}

function onText(key, event) {
  update(key, event.target.value);
}

function onCheck(key, event) {
  update(key, !!event.target.checked);
}

function hintClass() {
  return {
    'is-ok': props.liveHintKind === 'ok',
    'is-err': props.liveHintKind === 'err',
  };
}
</script>

<template>
  <section id="thEditor" class="th-editor-card" :hidden="!editor.id">
    <div class="th-editor-head">
      <h3>编辑脚本</h3>
      <span id="thLiveHint" class="th-live-hint" :class="hintClass()">{{ liveHint }}</span>
    </div>

    <input type="hidden" id="thId" :value="editor.id" />

    <div class="th-field">
      <label class="th-label" for="thName">名称</label>
      <input id="thName" type="text" autocomplete="off" :value="editor.name" @input="onText('name', $event)" @change="onText('name', $event)" />
    </div>
    <div class="th-field">
      <label class="th-label" for="thInfo">说明</label>
      <input id="thInfo" type="text" placeholder="脚本用途说明" :value="editor.info" @input="onText('info', $event)" @change="onText('info', $event)" />
    </div>
    <div class="th-field">
      <label class="th-label" for="thContent">脚本内容</label>
      <textarea id="thContent" rows="12" spellcheck="false" placeholder="脚本源码…" :value="editor.content" @input="onText('content', $event)" @change="onText('content', $event)"></textarea>
    </div>

    <div class="th-editor-cols">
      <div class="th-col">
        <div class="th-section-title">基本选项</div>
        <div class="th-checks th-checks-stack">
          <label class="th-check"><input id="thEnabled" type="checkbox" :checked="editor.enabled" @change="onCheck('enabled', $event)" /><span>启用</span></label>
        </div>
        <div class="th-field th-field-tight" style="margin-top:12px">
          <label class="th-label" for="thType">类型</label>
          <input id="thType" type="text" placeholder="script" :value="editor.type" @input="onText('type', $event)" @change="onText('type', $event)" />
        </div>
      </div>
      <div class="th-col">
        <div class="th-section-title">按钮</div>
        <div class="th-checks th-checks-stack">
          <label class="th-check"><input id="thButtonEnabled" type="checkbox" :checked="editor.buttonEnabled" @change="onCheck('buttonEnabled', $event)" /><span>启用按钮</span></label>
        </div>
        <div class="th-field th-field-tight" style="margin-top:12px">
          <label class="th-label" for="thButtonJson">按钮列表（JSON）</label>
          <textarea id="thButtonJson" rows="4" spellcheck="false" placeholder="[]" :value="editor.buttonJson" @input="onText('buttonJson', $event)" @change="onText('buttonJson', $event)"></textarea>
        </div>
      </div>
    </div>

    <details class="th-advanced">
      <summary>高级：附加数据 data（JSON）</summary>
      <div class="th-field">
        <label class="th-label" for="thDataJson">附加数据</label>
        <textarea id="thDataJson" rows="4" spellcheck="false" :value="editor.dataJson" @input="onText('dataJson', $event)" @change="onText('dataJson', $event)"></textarea>
      </div>
    </details>

    <div id="thStatus" class="th-status">{{ status }}</div>
  </section>
</template>
