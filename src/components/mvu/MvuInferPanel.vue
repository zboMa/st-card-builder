<script setup>
defineProps({
  infer: { type: Object, default: () => ({ open: false, candidates: [], count: 0, newCount: 0 }) },
});

const emit = defineEmits(['close', 'select-all', 'select-none', 'toggle', 'apply']);
</script>

<template>
  <div id="vcInferPanel" class="vc-infer-panel" :hidden="!infer.open">
    <div class="vc-infer-head">
      <strong>从卡推定 · 候选变量</strong>
      <span id="vcInferCount" class="vc-infer-count">{{ infer.count }}<template v-if="infer.count">（新增 {{ infer.newCount }}）</template></span>
      <div class="vc-infer-head-actions">
        <button type="button" class="btn btn-ghost btn-sm" id="vcInferSelectAll" @click="emit('select-all')">全选新增</button>
        <button type="button" class="btn btn-ghost btn-sm" id="vcInferSelectNone" @click="emit('select-none')">全不选</button>
        <button type="button" class="btn btn-ghost btn-sm" id="vcInferCancel" @click="emit('close')">关闭</button>
      </div>
    </div>
    <p class="vc-infer-tip">勾选后合并进 <code>zmer_mvu_design</code>（已有路径默认不勾）。不覆盖整套 AI 生成，仅 upsert。</p>
    <div id="vcInferList" class="vc-infer-list">
      <div v-if="!infer.candidates.length" class="vc-infer-meta">未推定到候选。请先配置状态栏模块或开启恶堕/成人层。</div>
      <label
        v-for="(candidate, index) in infer.candidates"
        :key="candidate.path"
        class="vc-infer-row"
        :class="{ 'is-present': candidate.alreadyPresent }"
      >
        <input type="checkbox" :checked="candidate.selected !== false" @change="emit('toggle', index, $event.target.checked)" />
        <span class="vc-infer-row-main">
          <div class="vc-infer-path">{{ candidate.path }}</div>
          <div class="vc-infer-meta">{{ candidate.name }} · {{ candidate.type }} · 初值 {{ candidate.initial }} · {{ candidate.source }}</div>
          <div class="vc-infer-meta">{{ candidate.updateHint }}</div>
        </span>
        <span class="vc-infer-badge" :class="{ 'is-new': !candidate.alreadyPresent }">{{ candidate.alreadyPresent ? '已有' : '新增' }}</span>
      </label>
    </div>
    <div class="vc-infer-actions">
      <button type="button" class="btn" id="vcInferApply" @click="emit('apply', false)">应用合并</button>
      <button type="button" class="btn btn-primary" id="vcInferApplyInject" @click="emit('apply', true)">应用并注入</button>
    </div>
  </div>
</template>
