<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useStore } from '@nanostores/vue';
import { assistantStore } from '../../lib/store/assistantStore.mjs';
import { assistantApi } from '../../lib/assistant/assistantBridge.mjs';

const view = useStore(assistantStore);
const ragCloseRef = ref(null);
const contextCloseRef = ref(null);
const activeId = ref('');

const rag = computed(function () { return view.value.ragModal || { open: false, meta: '', body: '' }; });
const context = computed(function () {
  return view.value.contextModal || { open: false, meta: '', sections: [], activeId: '' };
});
const anyOpen = computed(function () { return !!rag.value.open || !!context.value.open; });

function syncActiveSection(sections) {
  const list = sections || [];
  if (!list.some(function (sec) { return sec.id === activeId.value; })) {
    activeId.value = list.length ? list[0].id : '';
  }
}

watch(function () { return context.value.open; }, function (open) {
  if (!open) return;
  const sections = context.value.sections || [];
  activeId.value = sections.length ? sections[0].id : '';
  nextTick(function () {
    if (contextCloseRef.value) contextCloseRef.value.focus();
  });
});

watch(function () { return context.value.sections; }, function (sections) {
  if (!context.value.open) return;
  syncActiveSection(sections);
});

watch(function () { return rag.value.open; }, function (open) {
  if (!open) return;
  nextTick(function () {
    if (ragCloseRef.value) ragCloseRef.value.focus();
  });
});

watch(anyOpen, function (open) {
  if (typeof document === 'undefined') return;
  document.body.classList.toggle('assistant-rag-modal-open', !!open);
}, { immediate: true });

function onKeydown(e) {
  if (e.key !== 'Escape') return;
  if (context.value.open) {
    e.preventDefault();
    assistantApi.closeContextModal();
    return;
  }
  if (rag.value.open) {
    e.preventDefault();
    assistantApi.closeRagModal();
  }
}

onMounted(function () {
  document.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(function () {
  document.removeEventListener('keydown', onKeydown);
  document.body.classList.remove('assistant-rag-modal-open');
});
</script>

<template>
  <Teleport to="body">
    <div v-if="rag.open" id="assistantRagModal" class="assistant-rag-modal" aria-hidden="false">
      <div class="assistant-rag-modal__backdrop ui-modal-backdrop" aria-hidden="true" @click="assistantApi.closeRagModal()"></div>
      <div class="ui-modal-dialog assistant-rag-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="assistantRagModalTitle">
        <div class="assistant-rag-modal__head">
          <div>
            <h2 id="assistantRagModalTitle">RAG 检索预览</h2>
            <p class="assistant-rag-modal__meta ui-meta" id="assistantRagModalMeta">{{ rag.meta }}</p>
          </div>
          <button ref="ragCloseRef" type="button" class="btn-icon btn-icon--sm" id="assistantRagModalClose" aria-label="关闭 RAG 预览" @click="assistantApi.closeRagModal()">×</button>
        </div>
        <div class="assistant-rag-modal__body">
          <pre class="assistant-rag-modal__preview" id="assistantRagModalPreview">{{ rag.body }}</pre>
        </div>
      </div>
    </div>

    <div v-if="context.open" id="assistantContextModal" class="assistant-rag-modal" aria-hidden="false">
      <div class="assistant-rag-modal__backdrop ui-modal-backdrop" aria-hidden="true" @click="assistantApi.closeContextModal()"></div>
      <div class="ui-modal-dialog assistant-rag-modal__dialog assistant-context-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="assistantContextModalTitle">
        <div class="assistant-rag-modal__head">
          <div>
            <h2 id="assistantContextModalTitle">上下文内容</h2>
            <p class="assistant-rag-modal__meta ui-meta" id="assistantContextModalMeta">{{ context.meta }}</p>
          </div>
          <button ref="contextCloseRef" type="button" class="btn-icon btn-icon--sm" id="assistantContextModalClose" aria-label="关闭上下文预览" @click="assistantApi.closeContextModal()">×</button>
        </div>
        <div class="assistant-rag-modal__body assistant-context-modal__body">
          <div class="ui-tabs assistant-context-tabs" id="assistantContextTabs" role="tablist" aria-label="上下文分段">
            <button
              v-for="sec in context.sections"
              :key="sec.id"
              type="button"
              class="ui-tabs__tab"
              :class="{ 'is-active': activeId === sec.id }"
              role="tab"
              :aria-selected="activeId === sec.id ? 'true' : 'false'"
              :data-context-tab="sec.id"
              :title="sec.title + ' ≈ ' + sec.tokens + ' tok'"
              @click="activeId = sec.id"
            >{{ sec.shortTitle }}</button>
          </div>
          <div class="assistant-context-panels" id="assistantContextModalBody">
            <p v-if="!context.sections.length" class="assistant-context-empty ui-empty-tip">当前无可展示上下文</p>
            <section
              v-for="sec in context.sections"
              v-show="activeId === sec.id"
              :key="sec.id"
              class="assistant-context-section"
              :class="{ 'is-active': activeId === sec.id }"
              :data-section="sec.id"
              role="tabpanel"
            >
              <div class="assistant-context-section__head">
                <span>{{ sec.title }}</span>
                <span class="assistant-context-section__tokens ui-meta">≈ {{ sec.tokens }} tok</span>
              </div>
              <p v-if="sec.note" class="assistant-context-section__note">{{ sec.note }}</p>
              <div v-if="sec.children && sec.children.length" class="assistant-context-section__scroll">
                <div v-for="(child, index) in sec.children" :key="index" class="assistant-context-sub">
                  <div class="assistant-context-sub__head">
                    <span class="assistant-context-sub__title">{{ child.title }}</span>
                    <span class="assistant-context-sub__tokens ui-meta">≈ {{ child.tokens }} tok</span>
                  </div>
                  <pre class="assistant-context-sub__pre">{{ child.body }}</pre>
                </div>
              </div>
              <pre v-else class="assistant-context-section__pre">{{ sec.body }}</pre>
            </section>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
