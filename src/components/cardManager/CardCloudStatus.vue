<script setup>
import { computed } from 'vue';

const props = defineProps({ status: { type: String, default: 'local_only' } });

const base = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.7-1.5A3.5 3.5 0 0 0 7 18z"/></svg>';
const check = base.replace('</svg>', '<path d="M9.5 13.2l1.8 1.8 3.4-3.6"/></svg>');
const up = base.replace('</svg>', '<path d="M12 15V9"/><path d="M9.5 11.5 12 9l2.5 2.5"/></svg>');
const down = base.replace('</svg>', '<path d="M12 9v6"/><path d="M9.5 13.5 12 16l2.5-2.5"/></svg>');
const local = base.replace('</svg>', '<path d="M9 12h6M12 9v6"/></svg>');

const html = computed(() => {
  switch (props.status) {
    case 'cloud_synced':
      return '<span class="card-cloud-status is-synced" title="上云已同步" aria-label="上云已同步">' + check + '</span>';
    case 'dirty_local':
      return '<span class="card-cloud-status is-dirty-local" title="本地有新改动" aria-label="本地有新改动">' + up + '</span>';
    case 'dirty_remote':
      return '<span class="card-cloud-status is-dirty-remote" title="云端有更新" aria-label="云端有更新">' + down + '</span>';
    case 'dirty_both':
      return '<span class="card-cloud-status-group" aria-label="本地与云端均有新改动">'
        + '<span class="card-cloud-status is-dirty-local" title="本地有新改动">' + up + '</span>'
        + '<span class="card-cloud-status is-dirty-remote" title="云端有更新">' + down + '</span>'
        + '</span>';
    default:
      return '<span class="card-cloud-status is-local" title="未上云" aria-label="未上云">' + local + '</span>';
  }
});
</script>

<template>
  <span class="card-cloud-status-wrap" v-html="html"></span>
</template>
