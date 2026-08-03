/**
 * 头像 AI 生图弹窗 boot（挂载于 CharacterPanel）
 * 读取 imageConfig → 填提示词（可 LLM 辅助）→ 生成 → 点选设为头像
 */
import { generateImages } from './client.mjs';
import { providerById } from '../aiConfig/imageConfig.mjs';

var LLM_SYS = '你是一名角色卡头像生图提示词助手。把用户给的角色信息改写成适合文生图模型的英文提示词：' +
  '以逗号分隔的关键词（tags），包含外貌、服饰、神态、背景氛围，不出现完整句子或换行，' +
  '不要输出解释、不要加反引号、不要用中文。';

function readAiChatConfig() {
  var v = function(id) {
    var el = document.getElementById(id);
    return el && el.value != null ? String(el.value).trim() : '';
  };
  return { url: v('apiUrl'), key: v('apiKey'), model: v('modelSelect') };
}

export function initAvatarImageGen() {
  var modal = document.getElementById('avatarImageGenModal');
  if (!modal) return;

  var promptEl   = document.getElementById('imgGenPrompt');
  var negRowEl   = document.getElementById('imgGenNegativeRow');
  var negEl      = document.getElementById('imgGenNegative');
  var btnLlm     = document.getElementById('btnImgGenLlm');
  var btnRun     = document.getElementById('btnImgGenRun');
  var statusEl   = document.getElementById('imgGenStatus');
  var gridEl     = document.getElementById('imgGenGrid');
  var metaEl     = document.getElementById('avatarImgGenMeta');
  var btnOpen    = document.getElementById('btnOpenAvatarImageGen');

  var cfgCache = null;
  var providerTypeCache = 'compatible';

  function setStatus(text, isError) {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.style.color = isError ? 'var(--color-danger)' : 'var(--color-text-muted)';
  }

  function openModal() {
    var cfg = (typeof window.__getImageConfig__ === 'function')
      ? window.__getImageConfig__()
      : null;
    if (!cfg) {
      alert('请先在「配置 → AI 配置 → 生图」配置生图服务商');
      return;
    }
    cfgCache = cfg;
    var prov = providerById(cfg.provider) || providerById('custom');
    providerTypeCache = prov.type;
    if (metaEl) {
      var size = cfg.size === 'custom' ? (cfg.sizeCustom || '1024x1024') : (cfg.size || '1024x1024');
      metaEl.textContent = prov.label + ' · ' + size + ' · ×' + (cfg.count || 1);
    }
    if (negRowEl) negRowEl.style.display = providerTypeCache === 'compatible' ? 'none' : '';
    if (providerTypeCache === 'comfyui' && cfg.comfyDefaultPrompt && promptEl && !promptEl.value.trim()) {
      promptEl.value = cfg.comfyDefaultPrompt;
    }
    if (modal.parentNode !== document.body) {
      if (!modal._home) modal._home = modal.parentNode;
      document.body.appendChild(modal);
    }
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('panel-feature-modal-open');
    setStatus('');
    if (gridEl) gridEl.innerHTML = '';
  }

  function closeModal() {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('panel-feature-modal-open');
    if (modal._home && modal.parentNode === document.body) {
      modal._home.appendChild(modal);
    }
  }

  if (btnOpen) btnOpen.addEventListener('click', openModal);
  modal.querySelectorAll('[data-avimg-close]').forEach(function(el) {
    el.addEventListener('click', closeModal);
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });

  // ── LLM 辅助：把角色信息转成生图提示词 ──
  btnLlm.addEventListener('click', async function() {
    var ai = readAiChatConfig();
    if (!ai.url || !ai.model) {
      setStatus('❌ 请先在「AI 配置」填写文本接口与模型', true);
      return;
    }
    var payload = (typeof window.__getChatCharacterPayload__ === 'function')
      ? window.__getChatCharacterPayload__()
      : {};
    var user = [
      '角色名：' + (payload.name || '未命名'),
      '描述：' + (payload.description || ''),
      '性格：' + (payload.personality || ''),
      '场景：' + (payload.scenario || ''),
      '开场：' + (payload.firstMes || ''),
    ].filter(function(s) { return s.split('：')[1]; }).join('\n');
    if (!user) {
      setStatus('❌ 请先填写角色名与角色描述', true);
      return;
    }
    btnLlm.disabled = true;
    setStatus('正在用角色描述生成提示词…');
    try {
      var headers = { 'Content-Type': 'application/json' };
      if (ai.key) headers.Authorization = 'Bearer ' + ai.key;
      var messages = [
        { role: 'system', content: LLM_SYS },
        { role: 'user', content: user },
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
      content = String(content || '').replace(/`{3}[\s\S]*?`{3}/g, '').replace(/`/g, '').trim();
      if (!content) throw new Error('模型未返回提示词');
      if (promptEl) promptEl.value = content;
      setStatus('✅ 已生成提示词，可直接点击「生成」');
    } catch (e) {
      setStatus('❌ ' + (e && e.message || e), true);
    } finally {
      btnLlm.disabled = false;
    }
  });

  // ── 生成 ──
  btnRun.addEventListener('click', async function() {
    if (!cfgCache) { openModal(); return; }
    var prompt = promptEl ? promptEl.value.trim() : '';
    if (!prompt) {
      setStatus('❌ 请先填写提示词', true);
      return;
    }
    btnRun.disabled = true;
    setStatus('生成中…');
    try {
      var res = await generateImages(cfgCache, {
        prompt: prompt,
        negative: negEl ? negEl.value.trim() : '',
      });
      renderGrid(res.images);
      setStatus('✅ 生成 ' + res.images.length + ' 张，点击其中一张设为头像');
    } catch (e) {
      setStatus('❌ ' + (e && e.message || e), true);
    } finally {
      btnRun.disabled = false;
    }
  });

  function renderGrid(images) {
    if (!gridEl) return;
    gridEl.innerHTML = '';
    images.forEach(function(img, i) {
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'img-gen-card';
      var im = document.createElement('img');
      im.src = img.dataUrl;
      im.alt = '生成图 ' + (i + 1);
      im.loading = 'lazy';
      item.appendChild(im);
      item.title = '点击设为头像';
      item.addEventListener('click', function() { applyImage(img.dataUrl); });
      gridEl.appendChild(item);
    });
  }

  async function applyImage(dataUrl) {
    setStatus('正在设置为头像…');
    try {
      if (typeof window.__characterApplyAvatarDataUrl__ === 'function') {
        await window.__characterApplyAvatarDataUrl__(dataUrl);
      }
      closeModal();
    } catch (e) {
      setStatus('❌ 设置头像失败：' + (e && e.message || e), true);
    }
  }
}
