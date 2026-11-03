<script setup>
import { onMounted, onUnmounted, watch } from 'vue';
import { useStore } from '@nanostores/vue';
import { worldbookStore } from '../../lib/store/worldbookStore.mjs';

const ui = useStore(worldbookStore);

function api() {
  return window.__worldbookPanelApi__;
}

function closeModal() {
  api()?.closeModal();
}

function onSearch(event) {
  api()?.setQuery(event.target.value);
}

function clearSearch() {
  api()?.setQuery('');
}

function onScope(key, event) {
  api()?.setScope(key, event.target.checked);
}

function onFamily(event) {
  api()?.setFamily(event.target.value);
}

function openCreate() {
  api()?.openCreate();
}

function onEdit(index) {
  api()?.openEdit(index);
}

function onDelete(index) {
  api()?.deleteEntry(index);
}

function onRewrite(index) {
  api()?.rewrite(index);
}

function onEditorInput(key, event) {
  api()?.updateEditor({ [key]: event.target.value });
}

function onEditorCheck(key, event) {
  api()?.updateEditor({ [key]: event.target.checked });
}

function saveEditor() {
  api()?.saveEditor();
}

function onSingleInput(key, event) {
  api()?.setSingle({ [key]: event.target.value });
}

function onSingleCheck(key, event) {
  api()?.setSingle({ [key]: event.target.checked });
}

function onKey(e) {
  if (e.key === 'Escape' && ui.value.modal) closeModal();
}

watch(function () { return ui.value.modal; }, function (modal) {
  document.body.classList.toggle('wb-modal-open', !!modal);
}, { immediate: true });

onMounted(function () {
  api()?.refresh();
  document.addEventListener('keydown', onKey);
});

onUnmounted(function () {
  document.removeEventListener('keydown', onKey);
  document.body.classList.remove('wb-modal-open');
});
</script>

<template>
  <div class="panel area-worldbook">
    <div class="wb-panel-head">
      <h2>世界书条目</h2>
      <span id="wbTokenCount" class="tok-text wb-token-count" :title="ui.tokenTitle" aria-live="polite">{{ ui.tokenText }}</span>
      <div class="wb-head-actions">
        <button id="btnOpenWbAuditor" class="btn btn-wb-audit" type="button" title="世界书内容监测" @click="api()?.openAuditor()">监测</button>
        <button id="btnOpenWbRelationGraph" class="btn btn-panel-tool" type="button" title="只读查看 worldbook 人物关系" @click="api()?.openRelation()">关系一览</button>
        <button id="btnOpenWbAiSingle" class="btn btn-panel-tool wb-ai-open-btn" type="button" title="AI 单条生成" @click="api()?.openAi('single')">单条生成</button>
        <button id="btnOpenWbAiOrganize" class="btn btn-panel-tool wb-ai-open-btn" type="button" title="AI 智能整理" @click="api()?.openAi('organize')">智能整理</button>
        <button id="btnOpenWbAiKeygen" class="btn btn-panel-tool wb-ai-open-btn" type="button" title="AI 补全触发词" @click="api()?.openAi('keygen')">补全触发词</button>
        <button id="btnCreateEntry" class="btn btn-add wb-entry-create-btn" type="button" @click="openCreate">新建</button>
      </div>
    </div>

    <div class="wb-toolbar">
      <div class="wb-search-wrap">
        <div class="wb-search-bar">
          <span class="wb-search-icon" aria-hidden="true">🔍</span>
          <input id="wbSearchInput" type="text" class="wb-search-input" placeholder="搜索标题 / 触发词 / 内容..." autocomplete="off" :value="ui.query" @input="onSearch" />
          <button v-if="ui.query" id="wbSearchClear" class="wb-search-clear" title="清空" type="button" @click="clearSearch">✕</button>
        </div>
        <div class="wb-search-scope">
          <label class="wb-scope-tag"><input id="wbScopeTitle" type="checkbox" :checked="ui.scopeTitle" @change="onScope('scopeTitle', $event)" /><span>标题</span></label>
          <label class="wb-scope-tag"><input id="wbScopeKeys" type="checkbox" :checked="ui.scopeKeys" @change="onScope('scopeKeys', $event)" /><span>触发词</span></label>
          <label class="wb-scope-tag"><input id="wbScopeContent" type="checkbox" :checked="ui.scopeContent" @change="onScope('scopeContent', $event)" /><span>内容</span></label>
          <label class="wb-family-filter" for="wbFamilyFilter">分组</label>
          <select id="wbFamilyFilter" class="wb-family-select" aria-label="按条目分组筛选" :value="ui.family" @change="onFamily">
            <option value="all">全部</option>
            <option value="user">用户</option>
            <option value="novel">小说</option>
            <option value="engine">AI 引擎</option>
            <option value="mvu">MVU</option>
            <option value="adult_digest">成人总纲</option>
            <option value="corruption">恶堕</option>
            <option value="affection">纯爱</option>
          </select>
          <span id="wbSearchCount" class="wb-search-count">{{ ui.searchCountText }}</span>
        </div>
        <div v-show="ui.query" id="wbSearchResults" class="wb-search-results">
          <button v-for="hit in ui.searchHits" :key="hit.index" type="button" class="wb-search-hit" @click="onEdit(hit.index)">
            <span class="wb-search-hit-main">
              <span class="wb-search-hit-title">{{ hit.title }}</span>
              <span class="wb-search-hit-fields">{{ hit.fields }}</span>
            </span>
            <span v-if="hit.snippet" class="wb-search-hit-snippet">{{ hit.snippet }}</span>
          </button>
          <p v-if="!ui.searchHits.length" class="wb-search-empty ui-empty-tip">没有匹配的世界书条目</p>
        </div>
      </div>
    </div>

    <div v-show="ui.organize.status" id="organizeStatus" class="organize-status-bar" :class="'is-' + ui.organize.statusKind">{{ ui.organize.status }}</div>
    <div v-show="ui.keygen.status" id="keygenStatus" class="organize-status-bar" :class="'is-' + ui.keygen.statusKind">{{ ui.keygen.status }}</div>
    <div v-if="ui.organize.preview.length" id="organizePreview" class="organize-preview-container">
      <div class="organize-preview-head">
        <strong>整理预览</strong>
        <button type="button" class="btn btn-add novel-btn-sm" @click="api()?.applyOrganize(ui.organize.suggestions)">应用</button>
      </div>
      <div v-for="item in ui.organize.preview" :key="item.index" class="organize-preview-item">
        <strong>{{ item.title }}</strong>
        <span>位置 {{ item.position }} · 角色 {{ item.role }} · 深度 {{ item.depth }} · 顺序 {{ item.order }} · 概率 {{ item.prob }}%</span>
        <span v-if="item.reason" class="ui-hint">{{ item.reason }}</span>
      </div>
    </div>

    <div id="entriesList" class="wb-entries-list" aria-live="polite">
      <div v-for="row in ui.rows" :key="row.index" :id="'wbEntryItem_' + row.index" class="entry-item" :data-wb-index="row.index">
        <div class="entry-item-header">
          <div class="entry-info">
            <div class="entry-info-title-row">
              <span class="entry-title-group">
                <button type="button" class="entry-title-btn" data-wb-act="edit" :data-wb-index="row.index" @click="onEdit(row.index)">{{ row.title }}</button>
                <span v-if="row.typeClass && row.typeLabel" :class="row.typeClass">{{ row.typeLabel }}</span>
              </span>
              <span class="entry-title-badges">
                <span :class="['wb-strategy-tag', row.strategyClass]"><span class="wb-strategy-dot" aria-hidden="true"></span>{{ row.strategyLabel }}</span>
                <span v-if="row.isSkeleton" class="wb-skel-badge">骨架</span>
                <span v-if="row.isSystem" class="wb-sys-badge">体系</span>
              </span>
            </div>
            <p v-if="row.preview" class="entry-preview-line">{{ row.preview }}</p>
            <p class="entry-meta-line">{{ row.meta }}</p>
          </div>
          <div class="entry-actions">
            <button class="entry-icon-btn" type="button" data-wb-act="edit" :data-wb-index="row.index" title="编辑" aria-label="编辑" @click="onEdit(row.index)">✎</button>
            <button :class="['entry-icon-btn', { 'btn-ai-expand': row.isSkeleton }]" type="button" data-wb-act="ai" :data-wb-index="row.index" :title="row.isSkeleton ? 'AI 展开' : 'AI 重写'" :aria-label="row.isSkeleton ? 'AI 展开' : 'AI 重写'" @click="onRewrite(row.index)">✦</button>
            <button class="entry-icon-btn is-danger" type="button" data-wb-act="delete" :data-wb-index="row.index" title="删除" aria-label="删除" @click="onDelete(row.index)">×</button>
          </div>
        </div>
      </div>
      <div v-if="!ui.rows.length" class="wb-entries-empty ui-empty-tip">暂无世界书条目，点击右上「新建」或「单条生成」</div>
    </div>

    <Teleport to="body">
      <div v-if="ui.modal === 'single'" id="wbModalSingle" class="wb-modal" aria-hidden="false">
        <div class="wb-modal-backdrop" data-wb-modal-close="wbModalSingle" @click="closeModal"></div>
        <div class="wb-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="wbModalSingleTitle">
          <div class="wb-modal-head"><strong id="wbModalSingleTitle">AI 单条生成</strong><span class="wb-modal-tip">自动叠加，读取已有词条保持连贯</span></div>
          <div class="wb-modal-body">
            <div class="wb-ai-row"><input id="wbSinglePrompt" type="text" placeholder="定向要求(可选)，如：写一把专属武器..." :value="ui.single.prompt" @input="onSingleInput('prompt', $event)" /></div>
            <div class="wb-ai-checks">
              <label class="wb-ai-check"><input id="wbIncludeCharData" type="checkbox" :checked="ui.single.includeCharData" @change="onSingleCheck('includeCharData', $event)" />高级：参考主角名与描述（默认关，两管道隔离）</label>
              <label class="wb-ai-check"><input id="wbIncludeOtherEntries" type="checkbox" :checked="ui.single.includeOtherEntries" @change="onSingleCheck('includeOtherEntries', $event)" />融合【已有世界书条目】</label>
            </div>
          </div>
          <div class="wb-modal-actions"><button type="button" class="btn wb-modal-cancel" data-wb-modal-close @click="closeModal">取消</button><button id="btnAiSingleWb" class="btn btn-ai wb-ai-action" type="button" :disabled="ui.single.busy" @click="api()?.runSingle()">{{ ui.single.busy ? '⏳ 生成中...' : '生成 1 条' }}</button></div>
        </div>
      </div>

      <div v-if="ui.modal === 'organize'" id="wbModalOrganize" class="wb-modal" aria-hidden="false">
        <div class="wb-modal-backdrop" data-wb-modal-close="wbModalOrganize" @click="closeModal"></div>
        <div class="wb-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="wbModalOrganizeTitle">
          <div class="wb-modal-head"><strong id="wbModalOrganizeTitle">AI 智能整理</strong><span class="wb-modal-tip">优化插入位置 · 深度 · 顺序 · 概率</span></div>
          <div class="wb-modal-body"><p class="wb-modal-desc">将对当前全部世界书条目做参数分析，完成后在列表上方展示预览，确认后再应用。</p></div>
          <div class="wb-modal-actions"><button type="button" class="btn wb-modal-cancel" data-wb-modal-close @click="closeModal">取消</button><button id="btnAiOrganize" class="btn wb-ai-action" type="button" :disabled="ui.organize.busy" @click="api()?.runOrganize()">一键整理</button></div>
        </div>
      </div>

      <div v-if="ui.modal === 'keygen'" id="wbModalKeygen" class="wb-modal" aria-hidden="false">
        <div class="wb-modal-backdrop" data-wb-modal-close="wbModalKeygen" @click="closeModal"></div>
        <div class="wb-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="wbModalKeygenTitle">
          <div class="wb-modal-head"><strong id="wbModalKeygenTitle">AI 补全触发词</strong><span class="wb-modal-tip">批量补全更自然的触发词</span></div>
          <div class="wb-modal-body"><p class="wb-modal-desc">将按批次为全部条目生成/补全触发词，结果直接写回各条目。</p></div>
          <div class="wb-modal-actions"><button type="button" class="btn wb-modal-cancel" data-wb-modal-close @click="closeModal">取消</button><button id="btnAiGenerateKeys" class="btn wb-ai-action" type="button" :disabled="ui.keygen.busy" @click="api()?.runKeygen()">一键补触发词</button></div>
        </div>
      </div>

      <div v-if="ui.modal === 'edit'" id="wbModalEdit" class="wb-modal" aria-hidden="false">
        <div class="wb-modal-backdrop" data-wb-modal-close="wbModalEdit" @click="closeModal"></div>
        <div class="wb-modal-dialog wb-modal-dialog-lg" role="dialog" aria-modal="true" aria-labelledby="wbModalEditTitle">
          <div class="wb-modal-head">
            <strong id="wbModalEditTitle">{{ ui.edit.isNew ? '新建世界书条目' : '编辑世界书条目' }}</strong>
            <span id="wbModalEditTip" class="wb-modal-tip">保存后写回列表 · Esc / 遮罩关闭</span>
            <span v-if="ui.edit.error" id="wbModalEditError" class="wb-modal-tip is-err" role="alert">{{ ui.edit.error }}</span>
          </div>
          <div id="wbModalEditBody" class="wb-modal-body wb-modal-body-scroll">
            <div v-if="ui.edit.editor" :id="ui.edit.isNew ? 'wb_editor_new' : 'wb_editor_' + ui.edit.index" class="wb-inline-editor" :data-editor-index="ui.edit.index">
              <div class="form-group"><label>条目标题</label><input type="text" data-field="displayName" placeholder="例如：===特殊武器===" :value="ui.edit.editor.displayName" :readonly="ui.edit.editor.titleReadOnly" @input="onEditorInput('displayName', $event)" /></div>
              <div class="form-group"><label>设定内容</label><textarea data-field="content" placeholder="具体设定详情..." :value="ui.edit.editor.content" @input="onEditorInput('content', $event)"></textarea></div>
              <div class="form-group"><label>触发词 — 多个用英文逗号隔开</label><input type="text" data-field="keys" placeholder="空为常驻，有词为触发" :value="ui.edit.editor.keys" @input="onEditorInput('keys', $event)" /></div>
              <div class="form-group"><label>职责</label><input type="text" data-field="job" placeholder="这条进上下文时要完成的事，可空" :value="ui.edit.editor.job" @input="onEditorInput('job', $event)" /></div>
              <div class="grid-2">
                <div class="form-group"><label>同组名</label><input type="text" data-field="group" placeholder="可空" :value="ui.edit.editor.group" @input="onEditorInput('group', $event)" /></div>
                <div class="form-group"><label>读取路径</label><input type="text" data-field="reads" placeholder="变量路径，可空" :value="ui.edit.editor.reads" @input="onEditorInput('reads', $event)" /></div>
              </div>
              <div class="grid-2">
                <div class="form-group"><label>触发策略</label><select data-field="strategy" :value="ui.edit.editor.strategy" @change="onEditorInput('strategy', $event)"><option value="constant">常驻</option><option value="selective">可选</option><option value="vectorized">向量化</option></select></div>
                <div class="form-group"><label>插入位置</label><select data-field="position" :value="ui.edit.editor.position" @change="onEditorInput('position', $event)"><option value="0">0 — 角色定义之前</option><option value="1">1 — 角色定义之后</option><option value="2">2 — 示例消息之前</option><option value="3">3 — 示例消息之后</option><option value="4">4 — 按深度插入</option><option value="5">5 — 作者注释之前</option><option value="6">6 — 作者注释之后</option></select></div>
              </div>
              <div class="grid-3">
                <div class="form-group"><label>深度</label><input type="number" data-field="depth" min="0" :value="ui.edit.editor.depth" @input="onEditorInput('depth', $event)" /></div>
                <div class="form-group"><label>角色</label><select data-field="role" :value="ui.edit.editor.role" @change="onEditorInput('role', $event)"><option value="0">系统</option><option value="1">用户</option><option value="2">助手</option></select></div>
                <div class="form-group"><label>顺序</label><input type="number" data-field="order" :value="ui.edit.editor.order" @input="onEditorInput('order', $event)" /></div>
              </div>
              <div class="form-group"><label>概率 (%)</label><input type="number" data-field="prob" min="1" max="100" :value="ui.edit.editor.prob" @input="onEditorInput('prob', $event)" /></div>
            </div>
          </div>
          <div class="wb-modal-actions"><button type="button" class="btn wb-modal-cancel" data-wb-modal-close @click="closeModal">取消</button><button id="btnWbModalSave" class="btn btn-add wb-ai-action" type="button" @click="saveEditor">{{ ui.edit.isNew ? '保存新条目' : '保存修改' }}</button></div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
