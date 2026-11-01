<script setup>
defineProps({
  avatar: {
    type: Object,
    default: function () {
      return { mainUrl: '', full: false };
    },
  },
});

const emit = defineEmits(['upload', 'open-gen']);

function onFile(event) {
  var file = event.target.files && event.target.files[0];
  if (file) emit('upload', file);
  event.target.value = '';
}

function openGen() {
  emit('open-gen');
}
</script>

<template>
  <div class="avatar-upload avatar-upload--aside">
    <div class="avatar-upload__preview">
      <span id="avatarPlaceholder" class="avatar-upload__placeholder" v-show="!avatar.mainUrl">无图</span>
      <img id="avatarImg" class="avatar-upload__img" :src="avatar.mainUrl || null" :style="{ display: avatar.mainUrl ? 'block' : 'none' }" alt="avatar" />
    </div>
    <div class="avatar-upload__actions">
      <label
        id="charAvatarUploadLabel"
        class="btn btn-panel-tool avatar-upload__file-btn"
        :class="{ 'is-disabled': avatar.full }"
        for="charImageInput"
        :title="avatar.full ? '已超过 20 张' : '添加卡面（将嵌入 PNG 卡片）'"
      >添加卡面</label>
      <input id="charImageInput" type="file" accept="image/*" hidden :disabled="avatar.full" @change="onFile" />
      <button type="button" id="btnOpenAvatarImageGen" class="btn btn-ai-engine" title="用 AI 生图生成头像（需先在 AI 配置配置生图服务商）" @click="openGen">AI 生成头像</button>
    </div>
    <p class="avatar-upload__hint">当前草稿使用的卡面会嵌入 PNG</p>
  </div>
</template>
