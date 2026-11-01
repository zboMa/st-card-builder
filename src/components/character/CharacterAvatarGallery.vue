<script setup>
import { computed } from 'vue';

const props = defineProps({
  avatar: {
    type: Object,
    default: function () {
      return { items: [], count: 0, max: 20, emptyText: '' };
    },
  },
});

const emit = defineEmits(['select', 'remove']);

const countText = computed(function () {
  var count = Number(props.avatar.count || 0);
  var max = Number(props.avatar.max || 20);
  return count + '/' + max;
});

function select(item) {
  if (!item || item.current) return;
  emit('select', item.id);
}

function remove(id) {
  emit('remove', id);
}
</script>

<template>
  <div class="avatar-gallery avatar-gallery--strip" aria-labelledby="avatarGalleryHeading">
    <div class="avatar-gallery__head">
      <span id="avatarGalleryHeading" class="avatar-gallery__title">卡面列表</span>
      <span id="avatarGalleryCount" class="avatar-gallery__count ui-hint ui-hint--inline">{{ countText }}</span>
    </div>
    <div id="avatarGalleryList" class="avatar-gallery__list" role="list">
      <p v-if="!avatar.items || !avatar.items.length" class="avatar-gallery__empty ui-empty-tip">{{ avatar.emptyText || '暂无卡面' }}</p>
      <div v-for="item in (avatar.items || [])" :key="item.id" class="avatar-gallery__tile-wrap">
        <button
          type="button"
          class="avatar-gallery__tile"
          :class="{ 'is-active': item.current }"
          :data-avatar-id="item.id"
          :title="item.label || '卡面'"
          :aria-pressed="item.current ? 'true' : 'false'"
          @click="select(item)"
        >
          <img v-if="item.url" :src="item.url" alt="" />
          <span v-else class="avatar-gallery__tile-ph">无</span>
          <span v-if="item.published" class="avatar-gallery__mark is-published" title="已发布版本引用">已发</span>
          <span v-if="item.current" class="avatar-gallery__mark is-current">草稿</span>
        </button>
        <button
          type="button"
          class="btn-inline avatar-gallery__remove"
          :data-avatar-remove="item.id"
          title="删除卡面"
          aria-label="删除卡面"
          @click.stop="remove(item.id)"
        >×</button>
      </div>
    </div>
  </div>
</template>
