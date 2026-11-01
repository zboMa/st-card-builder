<script setup>
import { cardManagerApi } from '../../lib/card-builder/panels/cardManagerBridge.mjs';
import CardPopover from './CardPopover.vue';

const props = defineProps({
  anchor: { type: Object, default: null },
  card: { type: Object, required: true },
  cloudLoggedIn: { type: Boolean, default: false },
});
const emit = defineEmits(['close']);

function act(action) {
  cardManagerApi.cardMoreAction(action, props.card.id);
  emit('close');
}
</script>

<template>
  <CardPopover :anchor="anchor" :width="220" class="card-more-popover card-more-menu" @close="emit('close')">
    <div class="card-more-section">
      <div class="card-more-section__title">导出</div>
      <button type="button" class="card-more-item" @click="act('export-json')">导出 JSON</button>
      <button type="button" class="card-more-item" @click="act('export-png')">导出 PNG</button>
      <button type="button" class="card-more-item" @click="act('export-check')">导出前检查</button>
    </div>
    <div class="card-more-divider" role="separator"></div>
    <div class="card-more-section">
      <div class="card-more-section__title">发布与分享</div>
      <button type="button" class="card-more-item" :disabled="!cloudLoggedIn" @click="act('publish')">发布</button>
      <button type="button" class="card-more-item" :disabled="!cloudLoggedIn" @click="act('share')">分享</button>
      <button v-if="card.hasShare" type="button" class="card-more-item" @click="act('copy-share')">复制链接</button>
      <button v-if="card.hasShare" type="button" class="card-more-item" :disabled="!cloudLoggedIn" @click="act('reset-share')">重置链接</button>
      <button v-if="card.hasShare" type="button" class="card-more-item" :disabled="!cloudLoggedIn" @click="act('unshare')">停分享</button>
    </div>
    <div class="card-more-divider" role="separator"></div>
    <div class="card-more-section">
      <div class="card-more-section__title">云端</div>
      <button type="button" class="card-more-item" :disabled="!cloudLoggedIn" @click="act('cloud-upload')">同步上云</button>
      <button type="button" class="card-more-item" :disabled="!cloudLoggedIn" @click="act('cloud-download')">从云端覆盖</button>
      <button type="button" class="card-more-item" :disabled="!cloudLoggedIn" @click="act('cloud-delete')">删除云端</button>
      <p v-if="!cloudLoggedIn" class="card-more-hint">请先在「账户与云端」登录</p>
    </div>
  </CardPopover>
</template>
