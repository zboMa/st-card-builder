<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { cardManagerApi } from '../../lib/card-builder/panels/cardManagerBridge.mjs';
import CardCloudStatus from './CardCloudStatus.vue';
import CardMoreMenu from './CardMoreMenu.vue';
import CardVersionMenu from './CardVersionMenu.vue';

const props = defineProps({
  card: { type: Object, required: true },
  cloudLoggedIn: { type: Boolean, default: false },
});

const thumbUrl = ref('');
const moreOpen = ref(false);
const versionOpen = ref(false);
const moreBtn = ref(null);
const verBtn = ref(null);

const coverSrc = computed(() => props.card.avatarBase64 || thumbUrl.value);

const icons = {
  dup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/></svg>',
  delete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M10 11v6M14 11v6"/><path d="M7 7l1 12a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9l1-12"/></svg>',
  'cloud-upload': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.7-1.5A3.5 3.5 0 0 0 7 18z"/><path d="M12 15V9"/><path d="M9.5 11.5 12 9l2.5 2.5"/></svg>',
  'cloud-download': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.7-1.5A3.5 3.5 0 0 0 7 18z"/><path d="M12 9v6"/><path d="M9.5 13.5 12 16l2.5-2.5"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
};

const checkCount = computed(() => {
  const b = props.card.checkBadge;
  if (!b) return 0;
  return b.critical > 0 ? b.critical : b.warning;
});
const checkTitle = computed(() => {
  const b = props.card.checkBadge;
  if (!b) return '';
  return b.critical > 0
    ? ('导出检查：严重 ' + b.critical + (b.warning ? ' · 警告 ' + b.warning : ''))
    : ('导出检查：警告 ' + b.warning);
});

function open() { cardManagerApi.openCard(props.card.id); }
function rename() { cardManagerApi.rename(props.card.id); }
function removeCard() { cardManagerApi.remove(props.card.id); }
function duplicate() { cardManagerApi.duplicate(props.card.id); }
function runCloudQuick() {
  if (props.card.cloudQuick) cardManagerApi.cardMoreAction(props.card.cloudQuick.action, props.card.id);
}

onMounted(() => {
  if (!props.card.needsThumb || props.card.avatarBase64) return;
  cardManagerApi.loadThumb(props.card.id, props.card.avatarId).then((url) => {
    if (url) thumbUrl.value = url;
  }).catch(() => {});
});

onBeforeUnmount(() => {
  if (thumbUrl.value) {
    try { URL.revokeObjectURL(thumbUrl.value); } catch (e) { /* ignore */ }
    thumbUrl.value = '';
  }
});
</script>

<template>
  <div class="card-manager-item" :class="{ 'is-active': card.active }" :data-draft-id="card.id">
    <div class="card-manager-cover" @click="open">
      <img v-if="coverSrc" :src="coverSrc" alt="" />
      <span v-else class="card-manager-cover-placeholder">{{ card.needsThumb ? '…' : '无封面' }}</span>

      <div class="card-manager-cover-badges">
        <button
          v-if="card.checkBadge"
          type="button"
          class="card-manager-check-badge"
          :class="{ 'is-warning': !card.checkBadge.critical }"
          :title="checkTitle"
          :aria-label="checkTitle"
          @click.stop="cardManagerApi.openExportCheck()"
          v-html="icons.warn + '<span>' + checkCount + '</span>'"
        ></button>
        <span v-if="card.active" class="card-manager-badge">当前</span>
        <button
          ref="verBtn"
          type="button"
          class="card-manager-version-badge"
          title="版本列表 / 切换版本"
          @click.stop="versionOpen = !versionOpen"
        >{{ card.versionLabel }}</button>
      </div>

      <div class="card-manager-cover-overlay">
        <button type="button" class="card-manager-item-name" title="点击重命名" @click.stop="rename">{{ card.name }}</button>
        <div class="card-manager-item-meta">
          更新 {{ card.updatedAt }}{{ card.stubHint }}
          <CardCloudStatus :status="card.cloudStatus" />
          <br />{{ card.shareLine }}
        </div>
      </div>
    </div>

    <div class="card-manager-item-actions">
      <div class="card-manager-item-actions__group">
        <button type="button" class="btn-icon btn-icon--sm card-mgr-icon" title="复制" aria-label="复制" @click.stop="duplicate" v-html="icons.dup"></button>
        <button type="button" class="btn-icon btn-icon--sm card-mgr-icon card-mgr-icon--danger btn-icon--danger" title="删除" aria-label="删除" @click.stop="removeCard" v-html="icons.delete"></button>
      </div>
      <div class="card-manager-item-actions__group card-manager-item-actions__group--end">
        <button
          v-if="card.cloudQuick"
          type="button"
          class="btn-icon btn-icon--sm card-mgr-icon card-mgr-icon--cloud"
          :title="card.cloudQuick.label"
          :aria-label="card.cloudQuick.label"
          @click.stop="runCloudQuick"
          v-html="icons[card.cloudQuick.action] || ''"
        ></button>
        <button ref="moreBtn" type="button" class="btn-icon btn-icon--sm card-mgr-icon" title="更多操作" aria-label="更多操作" @click.stop="moreOpen = !moreOpen" v-html="icons.more"></button>
      </div>
    </div>

    <CardMoreMenu
      v-if="moreOpen"
      :anchor="moreBtn"
      :card="card"
      :cloud-logged-in="cloudLoggedIn"
      @close="moreOpen = false"
    />
    <CardVersionMenu v-if="versionOpen" :anchor="verBtn" :card="card" @close="versionOpen = false" />
  </div>
</template>
