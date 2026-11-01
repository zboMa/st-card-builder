<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { useStore } from '@nanostores/vue';
import { characterUiStore } from '../../lib/store/characterStore.mjs';

const ui = useStore(characterUiStore);
const gen = computed(function () {
  return ui.value.avatarGen || {};
});

function api() {
  return window.__characterPanelApi__ || {};
}

function close() {
  if (api().closeAvatarGen) api().closeAvatarGen();
}

function setPrompt(event) {
  if (api().setGenPrompt) api().setGenPrompt(event.target.value);
}

function setNegative(event) {
  if (api().setGenNegative) api().setGenNegative(event.target.value);
}

function generatePrompt() {
  if (api().generateAvatarPrompt) api().generateAvatarPrompt();
}

function run() {
  if (api().runAvatarGen) api().runAvatarGen();
}

function applyImage(image) {
  if (image && api().applyAvatarImage) api().applyAvatarImage(image.dataUrl);
}

function onKeydown(event) {
  if (event.key === 'Escape' && gen.value.open) close();
}

onMounted(function () {
  document.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(function () {
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="gen.open"
      id="avatarImageGenModal"
      class="panel-feature-modal"
      aria-hidden="false"
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatarImageGenModalTitle"
    >
      <div class="ui-modal-backdrop" data-avimg-close aria-hidden="true" @click="close"></div>
      <div class="ui-modal-dialog panel-feature-modal__dialog panel-feature-modal__dialog--wide" role="document">
        <div class="panel-feature-modal__head">
          <h2 id="avatarImageGenModalTitle">AI 生成头像</h2>
          <button type="button" class="btn-icon btn-icon--sm" data-avimg-close aria-label="关闭" @click="close">×</button>
        </div>
        <div class="panel-feature-modal__body avatar-img-gen-body">
          <div id="avatarImgGenMeta" class="avatar-img-gen-meta">{{ gen.meta }}</div>
          <div class="form-group">
            <label for="imgGenPrompt">正向提示词</label>
            <textarea
              id="imgGenPrompt"
              rows="3"
              placeholder="1girl, portrait, ..."
              :value="gen.prompt"
              @input="setPrompt"
            ></textarea>
          </div>
          <div id="imgGenNegativeRow" class="form-group" v-show="gen.showNegative">
            <label for="imgGenNegative">负向提示词</label>
            <input
              id="imgGenNegative"
              type="text"
              placeholder="nsfw, lowres, blurry..."
              :value="gen.negative"
              @input="setNegative"
            />
          </div>
          <div class="img-gen-actions">
            <button type="button" id="btnImgGenLlm" class="btn btn-fetch" :disabled="gen.busyPrompt" @click="generatePrompt">用角色描述生成提示词</button>
            <button type="button" id="btnImgGenRun" class="btn btn-primary" :disabled="gen.busyRun" @click="run">生成</button>
          </div>
          <div
            id="imgGenStatus"
            class="img-gen-status"
            aria-live="polite"
            :style="{ color: gen.statusKind === 'err' ? 'var(--color-danger)' : 'var(--color-text-muted)' }"
          >{{ gen.status }}</div>
          <div id="imgGenGrid" class="img-gen-grid">
            <button
              v-for="(img, index) in (gen.images || [])"
              :key="index"
              type="button"
              class="img-gen-card"
              title="点击设为头像"
              @click="applyImage(img)"
            >
              <img :src="img.dataUrl" :alt="'生成图 ' + (index + 1)" loading="lazy" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
