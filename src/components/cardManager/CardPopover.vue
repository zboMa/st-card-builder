<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';

defineOptions({ inheritAttrs: false });

const props = defineProps({
  anchor: { type: Object, default: null },
  width: { type: Number, default: 220 },
  gap: { type: Number, default: 6 },
});
const emit = defineEmits(['close']);

const root = ref(null);
let scrollHandler = null;
let docHandler = null;

function position() {
  const el = root.value;
  const anchor = props.anchor;
  if (!el || !anchor || !anchor.isConnected) return;
  const rect = anchor.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight || 0;
  const vw = window.innerWidth || document.documentElement.clientWidth || 0;
  el.style.position = 'fixed';
  el.style.visibility = 'hidden';
  el.style.left = '0px';
  el.style.top = '0px';
  el.style.width = props.width + 'px';
  const popH = Math.max(el.offsetHeight || 280, 120);
  const popW = Math.min(props.width, vw - 16);
  el.style.width = popW + 'px';

  const preferAbove = rect.top > vh - rect.bottom;
  let top;
  if (preferAbove) {
    top = rect.top - popH - props.gap;
    if (top < 8) top = 8;
  } else {
    top = rect.bottom + props.gap;
    if (top + popH > vh - 8) top = Math.max(8, vh - popH - 8);
  }
  let left = rect.right - popW;
  if (left < 8) left = 8;
  if (left + popW > vw - 8) left = Math.max(8, vw - popW - 8);

  el.style.left = Math.round(left) + 'px';
  el.style.top = Math.round(top) + 'px';
  el.style.visibility = '';
}

function onKey(ev) {
  if (ev.key === 'Escape') emit('close');
}

onMounted(() => {
  position();
  scrollHandler = () => {
    if (!root.value || !root.value.isConnected) return;
    position();
  };
  window.addEventListener('scroll', scrollHandler, true);
  window.addEventListener('resize', scrollHandler);
  setTimeout(() => {
    docHandler = (ev) => {
      const anchor = props.anchor;
      if (root.value && root.value.contains(ev.target)) return;
      if (anchor && (ev.target === anchor || anchor.contains(ev.target))) return;
      emit('close');
    };
    document.addEventListener('mousedown', docHandler, true);
  }, 0);
  document.addEventListener('keydown', onKey);
});

onBeforeUnmount(() => {
  if (scrollHandler) {
    window.removeEventListener('scroll', scrollHandler, true);
    window.removeEventListener('resize', scrollHandler);
  }
  if (docHandler) document.removeEventListener('mousedown', docHandler, true);
  document.removeEventListener('keydown', onKey);
});
</script>

<template>
  <Teleport to="body">
    <div ref="root" v-bind="$attrs"><slot /></div>
  </Teleport>
</template>
