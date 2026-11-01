<script setup>
import { assistantApi } from '../../lib/assistant/assistantBridge.mjs';

defineProps({
  pending: { type: Object, required: true },
  showAutoApply: { type: Boolean, default: true },
});
</script>

<template>
  <div class="assistant-panel__pending" id="assistantPendingBox">
    <div class="assistant-panel__pending-summary" id="assistantPendingSummary">{{ pending.summary }}</div>
    <div class="assistant-panel__preview-wrap">
      <pre class="assistant-panel__preview" id="assistantPendingPreview">{{ pending.preview }}</pre>
    </div>
    <div class="assistant-panel__pending-actions">
      <button type="button" class="btn btn-sm btn-primary assistant-btn-apply" id="assistantApplyBtn" @click="assistantApi.applyPending()">应用</button>
      <button type="button" class="btn btn-sm btn-ghost assistant-btn-reject" id="assistantRejectBtn" @click="assistantApi.rejectPending()">拒绝</button>
      <button v-if="showAutoApply" type="button" class="btn-inline" id="assistantAutoApplyBtn" @click="assistantApi.enableAutoApply()">开启自动应用</button>
    </div>
  </div>
</template>
