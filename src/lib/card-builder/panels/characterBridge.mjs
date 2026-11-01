/**
 * 角色设定：Vue <-> 逻辑 API 桥接。
 */
import { buildCharacterView, buildCharacterTokens, buildAvatarGenView } from './characterViewModel.mjs';
import { characterUiStore, patchAvatarGen } from '../../store/characterStore.mjs';
import { generateImages } from '../../imageGen/client.mjs';
import { providerById } from '../../aiConfig/imageConfig.mjs';

function readChatConfig() {
  var read = function (id) {
    var el = document.getElementById(id);
    return el && el.value != null ? String(el.value).trim() : '';
  };
  return { url: read('apiUrl'), model: read('modelSelect'), key: read('apiKey') };
}

function chatCharacterPayload(ctx) {
  if (typeof window.__getChatCharacterPayload__ === 'function') {
    return window.__getChatCharacterPayload__() || {};
  }
  return {
    name: ctx.state.charName || '',
    description: ctx.state.charDesc || '',
    personality: '',
    scenario: '',
    firstMes: ctx.state.firstMes || '',
  };
}

function feedback(ctx, message, level) {
  if (ctx && typeof ctx.appFeedback === 'function') {
    ctx.appFeedback({ message: message, level: level || 'warn', channel: 'toast' });
  } else {
    window.alert(message);
  }
}

/** @param {object} ctx @param {object} panel */
export function installCharacterBridge(ctx, panel) {
  if (panel.__characterBridgeInstalled) return;
  panel.__characterBridgeInstalled = true;

  var avatarGenConfig = null;

  function buildView() {
    return buildCharacterView(ctx.state, characterUiStore.get());
  }

  function buildTokens() {
    return buildCharacterTokens(ctx.state);
  }

  function openJsonPreview() {
    var modal = document.getElementById('jsonPreviewModal');
    if (!modal) return false;
    if (modal.parentNode !== document.body) document.body.appendChild(modal);
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('panel-feature-modal-open');
    try {
      var json = null;
      if (typeof window.__buildCurrentCardJSON__ === 'function') {
        json = window.__buildCurrentCardJSON__();
      }
      if (!json && window.getPreviewJSON) json = window.getPreviewJSON();
      if (typeof window.updatePreviewPanel === 'function' && json) {
        window.updatePreviewPanel(json);
      }
    } catch (e) { /* ignore */ }
    return true;
  }

  function closeJsonPreview() {
    var modal = document.getElementById('jsonPreviewModal');
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('panel-feature-modal-open');
  }

  function bindJsonPreview() {
    var modal = document.getElementById('jsonPreviewModal');
    if (!modal || modal.__characterJsonBound) return;
    modal.__characterJsonBound = true;
    modal.querySelectorAll('[data-json-preview-close]').forEach(function (el) {
      el.addEventListener('click', closeJsonPreview);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) closeJsonPreview();
    });
  }

  function openAvatarGen() {
    var cfg = typeof window.__getImageConfig__ === 'function'
      ? window.__getImageConfig__()
      : null;
    if (!cfg) {
      feedback(ctx, '请先在「设置 → AI 配置 → 生图服务商」配置生图服务。', 'warn');
      return false;
    }
    avatarGenConfig = cfg;
    var prov = providerById(cfg.provider) || providerById('custom') || { label: '生图服务', type: 'compatible' };
    var size = cfg.size === 'custom' ? (cfg.sizeCustom || '1024x1024') : (cfg.size || '1024x1024');
    var current = characterUiStore.get().avatarGen || {};
    var prompt = current.prompt || '';
    if (prov.type === 'comfyui' && cfg.comfyDefaultPrompt && !String(prompt).trim()) {
      prompt = cfg.comfyDefaultPrompt;
    }
    patchAvatarGen({
      open: true,
      meta: prov.label + ' · ' + size + ' · ×' + (cfg.count || 1),
      showNegative: prov.type !== 'compatible',
      status: '',
      statusKind: '',
      images: [],
      prompt: prompt,
      negative: current.negative || '',
    });
    document.body.classList.add('panel-feature-modal-open');
    return true;
  }

  function closeAvatarGen() {
    patchAvatarGen({ open: false });
    document.body.classList.remove('panel-feature-modal-open');
  }

  async function generateAvatarPrompt() {
    var ai = readChatConfig();
    if (!ai.url || !ai.model) {
      patchAvatarGen({ status: '请先在「AI 配置」填写文本接口与模型', statusKind: 'err' });
      return false;
    }
    var payload = chatCharacterPayload(ctx);
    var lines = [
      '角色名称：' + (payload.name || '未命名'),
      '角色描述：' + (payload.description || ''),
      '性格：' + (payload.personality || ''),
      '场景：' + (payload.scenario || ''),
      '开场白：' + (payload.firstMes || ''),
    ].filter(function (line) {
      return String(line.split('：').slice(1).join('：') || '').trim();
    });
    if (!lines.length) {
      patchAvatarGen({ status: '请先填写角色名称或角色设定', statusKind: 'err' });
      return false;
    }
    patchAvatarGen({ busyPrompt: true, status: '正在根据角色描述生成提示词。', statusKind: '' });
    try {
      var headers = { 'Content-Type': 'application/json' };
      if (ai.key) headers.Authorization = 'Bearer ' + ai.key;
      var messages = [
        { role: 'system', content: '你是一个角色头像生图提示词助手。根据用户提供的角色信息，写出适合生图模型的英文提示词：自动用逗号分隔的关键词（tags），包含外貌、服饰、姿态、场景、光线与氛围；不要输出解释，不要加分析，不要加引号。' },
        { role: 'user', content: lines.join('\n') },
      ];
      var content = '';
      if (typeof window.__assistantFetchAI__ === 'function') {
        var r = await window.__assistantFetchAI__({
          context: '头像生图提示词',
          url: ai.url + '/chat/completions',
          headers: headers,
          model: ai.model,
          messages: messages,
          temperature: 0.7,
        });
        content = (r && r.content) || '';
      } else {
        var res = await fetch(ai.url + '/chat/completions', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({ model: ai.model, messages: messages, temperature: 0.7 }),
        });
        if (!res.ok) throw new Error('请求失败 HTTP ' + res.status);
        var data = await res.json();
        content = ((((data || {}).choices || [])[0] || {}).message || {}).content || '';
      }
      content = String(content || '').replace(/```[\s\S]*?```/g, '').replace(/`/g, '').trim();
      if (!content) throw new Error('模型未返回提示词');
      patchAvatarGen({ prompt: content, status: '已生成提示词，可直接点生成。', statusKind: '' });
      return true;
    } catch (e) {
      patchAvatarGen({ status: String(e && e.message || e), statusKind: 'err' });
      return false;
    } finally {
      patchAvatarGen({ busyPrompt: false });
    }
  }

  async function runAvatarGen() {
    if (!avatarGenConfig) {
      openAvatarGen();
      return false;
    }
    var gen = characterUiStore.get().avatarGen || {};
    var prompt = String(gen.prompt || '').trim();
    if (!prompt) {
      patchAvatarGen({ status: '请先填写提示词', statusKind: 'err' });
      return false;
    }
    patchAvatarGen({ busyRun: true, status: '生成中。', statusKind: '' });
    try {
      var res = await generateImages(avatarGenConfig, {
        prompt: prompt,
        negative: gen.negative || '',
      });
      var images = (res && Array.isArray(res.images)) ? res.images : [];
      patchAvatarGen({
        images: images,
        status: '生成 ' + images.length + ' 张，点击任意一张设为头像。',
        statusKind: '',
      });
      return true;
    } catch (e) {
      patchAvatarGen({ status: String(e && e.message || e), statusKind: 'err' });
      return false;
    } finally {
      patchAvatarGen({ busyRun: false });
    }
  }

  async function applyAvatarImage(dataUrl) {
    patchAvatarGen({ status: '正在设为头像。', statusKind: '' });
    try {
      await panel.applyAvatarDataUrl(dataUrl);
      closeAvatarGen();
      return true;
    } catch (e) {
      patchAvatarGen({ status: '保存头像失败：' + (e && e.message || e), statusKind: 'err' });
      return false;
    }
  }

  function openAiEngine() {
    if (typeof window.__openAiEngineModal__ === 'function') window.__openAiEngineModal__();
  }

  function goAdultConfig() {
    location.hash = 'adult-config';
  }

  window.__characterPanelApi__ = {
    buildView: buildView,
    buildTokens: buildTokens,
    buildAvatarGenView: function () {
      return buildAvatarGenView(characterUiStore.get().avatarGen);
    },
    init: function () {
      panel.captureVersionBaseline();
      panel.scheduleTokens();
      panel.refreshAvatarUi().catch(function () { /* ignore */ });
    },
    setField: panel.setField,
    setTags: panel.setCharTags,
    addTag: panel.addCharTagFromInput,
    removeTag: panel.removeCharTag,
    generateTags: panel.generateTags,
    bumpVersion: panel.bumpVersion,
    revertVersion: panel.revertVersion,
    captureVersionBaseline: panel.captureVersionBaseline,
    uploadAvatarFile: panel.uploadAvatarFile,
    selectAvatar: panel.selectAvatar,
    removeAvatar: panel.removeAvatar,
    refreshAvatars: panel.refreshAvatarUi,
    revokeAvatarUrls: panel.revokeAvatarUrls,
    openJsonPreview: openJsonPreview,
    closeJsonPreview: closeJsonPreview,
    openAiEngine: openAiEngine,
    goAdultConfig: goAdultConfig,
    openAvatarGen: openAvatarGen,
    closeAvatarGen: closeAvatarGen,
    setGenPrompt: function (value) { patchAvatarGen({ prompt: String(value == null ? '' : value) }); },
    setGenNegative: function (value) { patchAvatarGen({ negative: String(value == null ? '' : value) }); },
    generateAvatarPrompt: generateAvatarPrompt,
    runAvatarGen: runAvatarGen,
    applyAvatarImage: applyAvatarImage,
  };

  window.__openJsonPreviewModal__ = openJsonPreview;
  window.__closeJsonPreviewModal__ = closeJsonPreview;
  window.__characterApplyAvatarDataUrl__ = function (dataUrl) {
    return panel.applyAvatarDataUrl(dataUrl);
  };

  bindJsonPreview();
  panel.captureVersionBaseline();
  panel.scheduleTokens();
  panel.refreshAvatarUi().catch(function () { /* ignore */ });

  window.addEventListener('card-draft-changed', function () {
    setTimeout(function () {
      panel.captureVersionBaseline();
      panel.scheduleTokens();
    }, 0);
    panel.refreshAvatarUi().catch(function () { /* ignore */ });
  });
  window.addEventListener('app-view-changed', function () {
    panel.scheduleTokens();
  });
}
