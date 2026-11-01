<script setup>
import { onMounted, ref } from 'vue';
import { cardManagerApi } from '../../lib/card-builder/panels/cardManagerBridge.mjs';
import { normalizeCharacterVersion } from '../../lib/card-builder/cardRelease.mjs';
import CardPopover from './CardPopover.vue';

const props = defineProps({
  anchor: { type: Object, default: null },
  card: { type: Object, required: true },
});
const emit = defineEmits(['close']);

const data = ref({ list: [], draftVer: '', hasDraftVer: false });

onMounted(() => {
  if (props.card) data.value = cardManagerApi.getVersions(props.card.id);
});

function isActive(v) {
  return normalizeCharacterVersion(v.ver) === normalizeCharacterVersion(data.value.draftVer);
}
function pick(ver) {
  cardManagerApi.switchVersion(props.card.id, ver);
  emit('close');
}
function bump(which) {
  cardManagerApi.bumpVersion(props.card.id, which);
  emit('close');
}
</script>

<template>
  <CardPopover :anchor="anchor" :width="280" class="card-version-popover" @close="emit('close')">
    <div class="card-more-section__title">版本列表</div>
    <p class="card-more-hint">点击版本号切换；切换会把当前草稿写入列表。发布会写入并自动升草稿版号。</p>
    <div v-if="!data.hasDraftVer" class="card-version-item is-active is-draftonly">
      <span class="card-version-item__ver">v{{ data.draftVer }}</span>
      <span class="card-version-item__meta">当前草稿（尚未写入列表）</span>
    </div>
    <button
      v-for="v in data.list"
      :key="v.ver"
      type="button"
      class="card-version-item"
      :class="{ 'is-active': isActive(v) }"
      @click="pick(v.ver)"
    >
      <span class="card-version-item__ver">v{{ v.ver }}</span>
      <span class="card-version-item__meta">{{ v.published ? '已发布' : '未发布' }}<template v-if="isActive(v)"> · 当前草稿</template></span>
    </button>
    <div v-if="!data.list.length" class="card-more-hint">暂无版本记录。增版或发布后出现在此。</div>
    <div class="card-more-divider" role="separator"></div>
    <button type="button" class="card-more-item" @click="bump('minor')">小版本增版</button>
    <button type="button" class="card-more-item" @click="bump('major')">大版本增版</button>
  </CardPopover>
</template>
