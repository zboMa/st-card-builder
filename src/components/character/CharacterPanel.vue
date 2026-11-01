<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { useStore } from '@nanostores/vue';
import { stateVersion } from '../../lib/store/cardStore.mjs';
import { characterUiStore } from '../../lib/store/characterStore.mjs';
import CharacterAvatarAside from './CharacterAvatarAside.vue';
import CharacterAvatarGallery from './CharacterAvatarGallery.vue';
import CharacterTags from './CharacterTags.vue';
import CharacterVersionBar from './CharacterVersionBar.vue';
import CharacterAvatarGenModal from './CharacterAvatarGenModal.vue';

function api() {
  return window.__characterPanelApi__ || {};
}

const version = useStore(stateVersion);
const ui = useStore(characterUiStore);

const EMPTY_VIEW = {
  fields: { charName: '', wbName: '', charDesc: '', creatorNotes: '', characterVersion: '1.0' },
  tags: [],
  version: { current: '1.0', baseline: '1.0', canRevert: false },
};

const EMPTY_TOKENS = {
  descText: '0 tok',
  notesText: '0 tok',
  totalText: '0 tok',
  descTitle: '0 tokens',
  notesTitle: '0 tokens',
  totalTitle: '0 tokens',
};

const view = computed(function () {
  version.value;
  ui.value;
  return (api().buildView && api().buildView()) || EMPTY_VIEW;
});

const tokens = computed(function () {
  ui.value.tokenTick;
  return (api().buildTokens && api().buildTokens()) || EMPTY_TOKENS;
});

function onField(key, event) {
  if (api().setField) api().setField(key, event.target.value);
}

function openJson() {
  if (api().openJsonPreview) api().openJsonPreview();
}

function openAiEngine() {
  if (api().openAiEngine) api().openAiEngine();
}

function goAdult() {
  if (api().goAdultConfig) api().goAdultConfig();
}

function uploadAvatar(file) {
  if (api().uploadAvatarFile) api().uploadAvatarFile(file);
}

function openAvatarGen() {
  if (api().openAvatarGen) api().openAvatarGen();
}

function selectAvatar(id) {
  if (api().selectAvatar) api().selectAvatar(id);
}

function removeAvatar(id) {
  if (api().removeAvatar) api().removeAvatar(id);
}

onMounted(function () {
  if (api().init) api().init();
});

onBeforeUnmount(function () {
  if (api().revokeAvatarUrls) api().revokeAvatarUrls();
});
</script>

<template>
  <div class="panel area-character">
    <div class="character-config-head">
      <div class="panel-header character-panel-head">
        <h2>角色设定</h2>
        <span id="charTokenCount" class="tok-text" :title="tokens.totalTitle" aria-live="polite">{{ tokens.totalText }}</span>
        <div class="panel-header__end">
          <button type="button" id="btnOpenJsonPreview" class="btn btn-panel-tool" title="查看当前卡 JSON" @click="openJson">JSON</button>
          <button type="button" id="btnOpenAiEngine" class="btn btn-ai-engine" title="打开 AI 引擎" @click="openAiEngine">AI 引擎</button>
          <span id="saveIndicator" class="panel-header__badge character-saved" style="display: none;">已保存</span>
        </div>
      </div>
      <p class="ui-hint character-config-lead">
        本页编辑<strong>场景标识 + 场景契约</strong>（`charName` / `charDesc`）及开场；<strong>NPC 人设写世界书</strong>，勿把全体人物传记堆进描述。
        世界观预设、口味、NTL 等请到「世界与限定」。
        <button type="button" id="btnGotoWorldLimitsFromCharacter" class="ai-engine-link-btn" @click="goAdult">去「世界与限定」配置</button>
      </p>
    </div>

    <div class="character-layout">
      <div class="character-layout__aside">
        <CharacterAvatarAside :avatar="ui.avatar" @upload="uploadAvatar" @open-gen="openAvatarGen" />
      </div>

      <div class="character-layout__right">
        <div class="character-layout__main">
          <div class="grid-2">
            <div class="form-group">
              <label>场景标识 (charName)</label>
              <input
                id="charName"
                type="text"
                placeholder="作品名 / 地点 / 群像名（非唯一 AI 扮演对象）"
                :value="view.fields.charName"
                @input="onField('charName', $event)"
              />
            </div>
            <div class="form-group">
              <label>世界书名 (Worldbook)</label>
              <input
                id="wbName"
                type="text"
                placeholder="世界书名称"
                :value="view.fields.wbName"
                @input="onField('wbName', $event)"
              />
            </div>
          </div>

          <CharacterVersionBar :current="view.version.current" :can-revert="view.version.canRevert" />
          <CharacterTags :tags="view.tags" />
        </div>

        <CharacterAvatarGallery :avatar="ui.avatar" @select="selectAvatar" @remove="removeAvatar" />
      </div>
    </div>

    <hr class="divider character-panel-divider" />

    <div class="form-group">
      <div class="ui-label-row">
        <label>场景契约 (charDesc)</label>
        <span id="charDescTok" class="tok-text" :title="tokens.descTitle" aria-live="polite">{{ tokens.descText }}</span>
      </div>
      <textarea
        id="charDesc"
        style="min-height: 130px;"
        placeholder="局面、叙事视角、多 NPC 调度约定、禁止 OOC；NPC 传记写 worldbook，勿堆在此处…"
        :value="view.fields.charDesc"
        @input="onField('charDesc', $event)"
      ></textarea>
    </div>

    <hr class="divider" />

    <div class="form-group">
      <div class="ui-label-row">
        <label>作者注释 (Creator Notes)</label>
        <span id="creatorNotesTok" class="tok-text" :title="tokens.notesTitle" aria-live="polite">{{ tokens.notesText }}</span>
      </div>
      <textarea
        id="creatorNotes"
        placeholder="给使用者的说明..."
        :value="view.fields.creatorNotes"
        @input="onField('creatorNotes', $event)"
      ></textarea>
    </div>

    <CharacterAvatarGenModal />
  </div>
</template>
