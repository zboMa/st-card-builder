<script setup>
defineProps({
  current: { type: String, default: '1.0' },
  canRevert: { type: Boolean, default: false },
});

function api() {
  return window.__characterPanelApi__ || {};
}

function bump(which) {
  if (api().bumpVersion) api().bumpVersion(which);
}

function revert() {
  if (api().revertVersion) api().revertVersion();
}
</script>

<template>
  <div class="form-group">
    <div class="char-tags-label-row">
      <label for="characterVersion">卡片版本 (character_version)</label>
      <span class="ui-hint ui-hint--inline">酒馆字段；发布/分享按此版本固化。不可手改，请用按钮升级。</span>
    </div>
    <div class="character-version-row">
      <input
        id="characterVersion"
        type="text"
        :value="current"
        readonly
        tabindex="-1"
        title="仅可通过右侧按钮升级；SillyTavern data.character_version"
      />
      <button type="button" id="btnBumpVersionMajor" class="btn btn-meta" title="大版本 +1，小版本归零" @click="bump('major')">升级大版本</button>
      <button type="button" id="btnBumpVersionMinor" class="btn btn-meta" title="小版本 +1" @click="bump('minor')">升级小版本</button>
      <button type="button" id="btnRevertVersion" class="btn btn-meta" :hidden="!canRevert" title="恢复到修改前的版本" @click="revert">回退</button>
    </div>
  </div>
</template>
