/**
 * AI 配置 · 生图（imageConfig）
 * 服务商元数据 + 面板 boot + localStorage 持久化。
 * 仅做配置存储；生图调用入口（请求/队列）后续另行实现。
 */
export var IMAGE_CONFIG_KEY = 'st_v3_builder_image_config';

/** 服务商类型：compatible = OpenAI 兼容 images/generations + Bearer（含 Ark）；stability / comfyui 独立面板 */
export var IMAGE_PROVIDERS = [
  {
    id: 'openai', label: 'OpenAI（DALL·E / gpt-image）', type: 'compatible',
    base: 'https://api.openai.com/v1',
    models: ['gpt-image-1', 'dall-e-3', 'dall-e-2'],
    hint: 'POST {base}/images/generations + Bearer。gpt-image-1 走 1024 平方图；dall-e 系列请把尺寸改为 1024x1024。',
  },
  {
    id: 'dashscope', label: '通义万相（DashScope）', type: 'compatible',
    base: 'https://dashscope.aliyuncs.com/api/v1',
    models: ['wanx2.1-t2i-turbo', 'wanx2.1-t2i-plus', 'wan2.2-t2i-flash'],
    hint: 'DashScope OpenAI 兼容端点。密钥填 sk- 开头的阿里云 DashScope API Key。',
  },
  {
    id: 'zhipu', label: '智谱 CogView', type: 'compatible',
    base: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['cogview-4-250304', 'cogview-3-plus', 'cogview-3-flash'],
    hint: '智谱开放平台 OpenAI 兼容端点。模型列表可能随服务调整，可手填最新模型名。',
  },
  {
    id: 'siliconflow', label: '硅基流动 SiliconFlow', type: 'compatible',
    base: 'https://api.siliconflow.cn/v1',
    models: [
      'black-forest-labs/FLUX.1-schnell',
      'black-forest-labs/FLUX.1-dev',
      'Kwai-Kolors/Kolors',
      'stabilityai/stable-diffusion-xl-base-1.0',
    ],
    hint: 'SiliconFlow OpenAI 兼容端点，可托管 FLUX / SDXL / Kolors 等开源模型。',
  },
  {
    id: 'grok', label: 'Grok（xAI）', type: 'compatible',
    base: 'https://api.x.ai/v1',
    models: ['grok-2-image-1212', 'grok-2-mini-image-1212'],
    hint: 'xAI OpenAI 兼容 images 端点，密钥在 console.x.ai 创建。',
  },
  {
    id: 'nanobanana', label: 'nano banana', type: 'compatible',
    base: 'https://api.banana.dev/v1',
    models: ['nano-banana'],
    hint: 'nano banana 的 OpenAI 兼容端点。地址若变更，请直接修改「API 接口地址」。',
  },
  {
    id: 'ark', label: '火山引擎 / 豆包 Seedream', type: 'compatible',
    base: 'https://ark.cn-beijing.volces.com/api/v3',
    models: ['doubao-seedream-4-0-250828'],
    hint: '火山方舟 Ark 兼容 images 端点。模型处填「模型 ID 或推理接入点 ID」，密钥为 Ark API Key。',
  },
  {
    id: 'stability', label: 'Stability（官方 API）', type: 'stability',
    base: 'https://api.stability.ai',
    models: ['stable-image-core', 'sd3.5-large', 'sd3.5-medium', 'sd3.5-large-turbo', 'stable-diffusion-xl-1024-v1-0'],
    hint: 'Stability 官方 API（v2beta multipart）。模型名可手填，如 stable-image-core / sd3.5-large。',
  },
  {
    id: 'comfyui', label: 'ComfyUI（自建）', type: 'comfyui',
    base: '', models: [],
    hint: '自建 ComfyUI。填服务器地址 + 工作流 JSON；提交时替换提示词节点文本后 POST /prompt。',
  },
  {
    id: 'custom', label: '自定义（OpenAI 兼容）', type: 'compatible',
    base: 'https://',
    models: [],
    hint: '任意 OpenAI 兼容 images 接口（如中转站、内网服务）。填地址 / 密钥 / 模型即可。',
  },
];

export function providerById(id) {
  for (var i = 0; i < IMAGE_PROVIDERS.length; i++) {
    if (IMAGE_PROVIDERS[i].id === id) return IMAGE_PROVIDERS[i];
  }
  return null;
}

export function providerTypeById(id) {
  var p = providerById(id);
  return p ? p.type : 'compatible';
}

export function defaultImageConfig() {
  return {
    provider: 'openai',
    // 兼容系（openaiStyle / ark 共用）
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-image-1',
    size: '1024x1024',
    sizeCustom: '',
    count: 1,
    quality: 'medium',
    // Stability 独立
    stabApiKey: '',
    stabModel: 'stable-image-core',
    stabSize: '1024x1024',
    stabCount: 1,
    stabSteps: 30,
    stabNegative: '',
    // ComfyUI 独立
    comfyServerUrl: '',
    comfyApiKey: '',
    comfyWorkflow: '',
    comfyWorkflowName: '',
    comfyPromptNodeId: '6',
    comfyNegativeNodeId: '7',
    comfyOutputNodeId: '9',
    comfyDefaultPrompt: '',
  };
}

export function normalizeImageConfig(cfg) {
  var d = defaultImageConfig();
  if (!cfg || typeof cfg !== 'object') return d;
  var out = {};
  Object.keys(d).forEach(function(k) {
    out[k] = cfg[k] === undefined || cfg[k] === null ? d[k] : cfg[k];
  });
  return out;
}

export var IMAGE_SIZES = [
  { value: '1024x1024', label: '1:1 1024×1024' },
  { value: '832x1216', label: '3:4 832×1216' },
  { value: '1216x832', label: '4:3 1216×832' },
  { value: '768x1344', label: '9:16 768×1344' },
  { value: '1344x768', label: '16:9 1344×768' },
  { value: '512x512', label: '小图 512×512' },
  { value: 'custom', label: '自定义尺寸' },
];

/**
 * ComfyUI 工作流归一化：前端 UI 导出格式（nodes[]/links[]）→ API 格式（nodeId → {class_type, inputs}）。
 * 已是 API 格式或非法对象时原样返回。
 */
export function normalizeComfyWorkflow(wf) {
  if (wf && Array.isArray(wf.nodes) && !wf.class_type) {
    var out = {};
    wf.nodes.forEach(function(n) {
      if (!n || n.id == null) return;
      var inputs = {};
      (Array.isArray(n.inputs) ? n.inputs : []).forEach(function(inp) {
        if (inp && inp.name != null) inputs[inp.name] = inp.value;
      });
      out[String(n.id)] = { class_type: String(n.type || ''), inputs: inputs };
    });
    return out;
  }
  return wf || {};
}

function resolveNodeRef(ref, api) {
  var id = Array.isArray(ref) ? ref[0]
    : (ref && typeof ref === 'object' && ref[0] != null ? ref[0] : ref);
  id = String(id == null ? '' : id);
  return (id && api[id]) ? id : '';
}

/**
 * 自动识别 ComfyUI 节点（纯函数）：
 * - 正向/负面：KSampler / KSamplerAdvanced 的 positive / negative 连线引用的节点 id
 * - 输出：SaveImage / PreviewImage 节点
 * - 无 KSampler 时回退：CLIPTextEncode 首个当正向、次个当负面
 * @returns {{ promptNodeId: string, negativeNodeId: string, outputNodeId: string }}
 */
export function autoDetectComfyNodes(wf) {
  var api = normalizeComfyWorkflow(wf);
  var out = { promptNodeId: '', negativeNodeId: '', outputNodeId: '' };
  var sampler = null;
  var clips = [];
  Object.keys(api).forEach(function(id) {
    var n = api[id];
    if (!n) return;
    var ct = String(n.class_type || '');
    if (!sampler && /KSampler/i.test(ct)) sampler = n;
    if (!out.outputNodeId && /SaveImage|PreviewImage/i.test(ct)) out.outputNodeId = id;
    if (/CLIPTextEncode/i.test(ct)) clips.push(id);
  });
  if (sampler && sampler.inputs) {
    out.promptNodeId = resolveNodeRef(sampler.inputs.positive, api);
    out.negativeNodeId = resolveNodeRef(sampler.inputs.negative, api);
  }
  if (!out.promptNodeId && clips.length) out.promptNodeId = clips[0];
  if (!out.negativeNodeId && clips.length > 1) out.negativeNodeId = clips[1];
  return out;
}

export function initImageConfig() {
  var providerEl   = document.getElementById('imgProviderSelect');
  var hintEl       = document.getElementById('imgProviderHint');
  if (!providerEl || !hintEl) return;

  var compatibleEl = document.getElementById('imgCompatiblePanel');
  var stabEl       = document.getElementById('imgStabPanel');
  var comfyEl      = document.getElementById('imgComfyPanel');

  var el = {
    baseUrl:       document.getElementById('imgBaseUrl'),
    apiKey:        document.getElementById('imgApiKey'),
    model:         document.getElementById('imgModelInput'),
    modelList:     document.getElementById('imgModelList'),
    size:          document.getElementById('imgSize'),
    sizeCustom:    document.getElementById('imgSizeCustom'),
    sizeCustomWrap: document.getElementById('imgSizeCustomWrap'),
    count:         document.getElementById('imgCount'),
    quality:       document.getElementById('imgQuality'),
    stabApiKey:    document.getElementById('imgStabApiKey'),
    stabModel:     document.getElementById('imgStabModel'),
    stabModelList: document.getElementById('imgStabModelList'),
    stabSize:      document.getElementById('imgStabSize'),
    stabCount:     document.getElementById('imgStabCount'),
    stabSteps:     document.getElementById('imgStabSteps'),
    stabNegative:  document.getElementById('imgStabNegative'),
    comfyServerUrl:  document.getElementById('imgComfyServerUrl'),
    comfyApiKey:     document.getElementById('imgComfyApiKey'),
    comfyWorkflow:   document.getElementById('imgComfyWorkflow'),
    comfyWorkflowName: document.getElementById('imgComfyWorkflowName'),
    comfyPromptNodeId: document.getElementById('imgComfyPromptNodeId'),
    comfyNegativeNodeId: document.getElementById('imgComfyNegativeNodeId'),
    comfyOutputNodeId: document.getElementById('imgComfyOutputNodeId'),
    comfyDefaultPrompt: document.getElementById('imgComfyDefaultPrompt'),
    comfyUpload:     document.getElementById('imgComfyUpload'),
    comfyDetect:     document.getElementById('imgComfyDetect'),
    comfyDetectHint: document.getElementById('imgComfyDetectHint'),
  };

  function currentProvider() {
    return providerById(providerEl.value) || providerById('custom');
  }

  function fillDatalist(dl, models) {
    if (!dl) return;
    dl.innerHTML = '';
    (models || []).forEach(function(m) {
      var o = document.createElement('option');
      o.value = m;
      dl.appendChild(o);
    });
  }

  function isCompatibleType(type) { return type === 'compatible' || type === 'ark'; }

  function switchProvider(isInit) {
    var p = currentProvider();
    var type = p.type;
    if (compatibleEl) compatibleEl.style.display = isCompatibleType(type) ? '' : 'none';
    if (stabEl)       stabEl.style.display       = type === 'stability' ? '' : 'none';
    if (comfyEl)      comfyEl.style.display      = type === 'comfyui'   ? '' : 'none';
    hintEl.textContent = p.hint || '';

    if (isCompatibleType(type)) {
      fillDatalist(el.modelList, p.models);
      if (el.baseUrl) {
        el.baseUrl.placeholder = p.base || 'https://';
        if (!el.baseUrl.value.trim()) el.baseUrl.value = p.base || '';
      }
      if (el.model && !el.model.value.trim() && p.models && p.models.length) {
        el.model.value = p.models[0];
      }
    }
    if (type === 'stability' && isInit) {
      fillDatalist(el.stabModelList, p.models);
    }
  }

  function collect() {
    var cfg = defaultImageConfig();
    var p = currentProvider();
    cfg.provider = providerEl.value;
    if (isCompatibleType(p.type)) {
      cfg.baseUrl = el.baseUrl ? el.baseUrl.value.trim() : '';
      cfg.apiKey  = el.apiKey ? el.apiKey.value.trim() : '';
      cfg.model   = el.model ? el.model.value.trim() : '';
      cfg.size    = el.size ? el.size.value : '1024x1024';
      cfg.sizeCustom = el.sizeCustom ? el.sizeCustom.value.trim() : '';
      cfg.count   = parseInt(el.count && el.count.value, 10) || 1;
      cfg.quality = el.quality ? el.quality.value : 'medium';
    } else if (p.type === 'stability') {
      cfg.stabApiKey  = el.stabApiKey ? el.stabApiKey.value.trim() : '';
      cfg.stabModel   = el.stabModel ? el.stabModel.value.trim() : '';
      cfg.stabSize    = el.stabSize ? el.stabSize.value : '1024x1024';
      cfg.stabCount   = parseInt(el.stabCount && el.stabCount.value, 10) || 1;
      cfg.stabSteps   = parseInt(el.stabSteps && el.stabSteps.value, 10) || 30;
      cfg.stabNegative = el.stabNegative ? el.stabNegative.value.trim() : '';
    } else if (p.type === 'comfyui') {
      cfg.comfyServerUrl = el.comfyServerUrl ? el.comfyServerUrl.value.trim() : '';
      cfg.comfyApiKey    = el.comfyApiKey ? el.comfyApiKey.value.trim() : '';
      cfg.comfyWorkflow  = el.comfyWorkflow ? el.comfyWorkflow.value.trim() : '';
      cfg.comfyWorkflowName = el.comfyWorkflowName ? el.comfyWorkflowName.value.trim() : '';
      cfg.comfyPromptNodeId   = el.comfyPromptNodeId ? el.comfyPromptNodeId.value.trim() : '6';
      cfg.comfyNegativeNodeId = el.comfyNegativeNodeId ? el.comfyNegativeNodeId.value.trim() : '7';
      cfg.comfyOutputNodeId   = el.comfyOutputNodeId ? el.comfyOutputNodeId.value.trim() : '9';
      cfg.comfyDefaultPrompt  = el.comfyDefaultPrompt ? el.comfyDefaultPrompt.value.trim() : '';
    }
    return cfg;
  }

  function save() {
    try { localStorage.setItem(IMAGE_CONFIG_KEY, JSON.stringify(collect())); } catch (e) { /* ignore */ }
  }

  function applyToDom(cfg) {
    cfg = normalizeImageConfig(cfg);
    providerEl.value = cfg.provider;
    if (el.baseUrl) el.baseUrl.value = cfg.baseUrl || '';
    if (el.apiKey) el.apiKey.value = cfg.apiKey || '';
    if (el.model) el.model.value = cfg.model || '';
    if (el.size) el.size.value = cfg.size || '1024x1024';
    if (el.sizeCustom) {
      el.sizeCustom.value = cfg.sizeCustom || '';
    }
    if (el.sizeCustomWrap) {
      el.sizeCustomWrap.style.display = (cfg.size === 'custom') ? '' : 'none';
    }
    if (el.count) el.count.value = String(cfg.count || 1);
    if (el.quality) el.quality.value = cfg.quality || 'medium';
    if (el.stabApiKey) el.stabApiKey.value = cfg.stabApiKey || '';
    if (el.stabModel) el.stabModel.value = cfg.stabModel || '';
    if (el.stabSize) el.stabSize.value = cfg.stabSize || '1024x1024';
    if (el.stabCount) el.stabCount.value = String(cfg.stabCount || 1);
    if (el.stabSteps) el.stabSteps.value = String(cfg.stabSteps || 30);
    if (el.stabNegative) el.stabNegative.value = cfg.stabNegative || '';
    if (el.comfyServerUrl) el.comfyServerUrl.value = cfg.comfyServerUrl || '';
    if (el.comfyApiKey) el.comfyApiKey.value = cfg.comfyApiKey || '';
    if (el.comfyWorkflow) el.comfyWorkflow.value = cfg.comfyWorkflow || '';
    if (el.comfyWorkflowName) el.comfyWorkflowName.value = cfg.comfyWorkflowName || '';
    if (el.comfyPromptNodeId) el.comfyPromptNodeId.value = cfg.comfyPromptNodeId || '6';
    if (el.comfyNegativeNodeId) el.comfyNegativeNodeId.value = cfg.comfyNegativeNodeId || '7';
    if (el.comfyOutputNodeId) el.comfyOutputNodeId.value = cfg.comfyOutputNodeId || '9';
    if (el.comfyDefaultPrompt) el.comfyDefaultPrompt.value = cfg.comfyDefaultPrompt || '';
    switchProvider(true);
  }

  function load() {
    var cfg = null;
    try {
      var raw = localStorage.getItem(IMAGE_CONFIG_KEY);
      if (raw) cfg = JSON.parse(raw);
    } catch (e) { cfg = null; }
    applyToDom(cfg || null);
  }

  providerEl.addEventListener('change', function() { switchProvider(false); save(); });

  var inputBind = [
    el.baseUrl, el.apiKey, el.model, el.sizeCustom,
    el.stabApiKey, el.stabModel, el.stabSteps, el.stabNegative,
    el.comfyServerUrl, el.comfyApiKey, el.comfyWorkflow, el.comfyWorkflowName,
    el.comfyPromptNodeId, el.comfyNegativeNodeId, el.comfyOutputNodeId, el.comfyDefaultPrompt,
  ];
  inputBind.forEach(function(i) { if (i) i.addEventListener('input', save); });
  var changeBind = [el.size, el.count, el.quality, el.stabSize, el.stabCount];
  changeBind.forEach(function(i) { if (i) i.addEventListener('change', save); });
  if (el.size) {
    el.size.addEventListener('change', function() {
      if (el.sizeCustomWrap) el.sizeCustomWrap.style.display = (el.size.value === 'custom') ? '' : 'none';
    });
  }

  function comfyStatus(text, isError) {
    if (!el.comfyDetectHint) return;
    el.comfyDetectHint.textContent = text || '';
    el.comfyDetectHint.style.color = isError ? 'var(--color-danger)' : '';
  }

  function fillComfyNodes(nodes) {
    if (nodes.promptNodeId && el.comfyPromptNodeId) el.comfyPromptNodeId.value = nodes.promptNodeId;
    if (nodes.negativeNodeId && el.comfyNegativeNodeId) el.comfyNegativeNodeId.value = nodes.negativeNodeId;
    if (nodes.outputNodeId && el.comfyOutputNodeId) el.comfyOutputNodeId.value = nodes.outputNodeId;
  }

  function applyComfyDetection(text) {
    var wf = JSON.parse(String(text || ''));
    var nodes = autoDetectComfyNodes(wf);
    fillComfyNodes(nodes);
    return nodes;
  }

  // 上传工作流 JSON：载入 → 自动识别节点
  if (el.comfyUpload) {
    el.comfyUpload.addEventListener('change', function(e) {
      var file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(ev) {
        try {
          var wf = JSON.parse(String(ev.target.result));
          if (el.comfyWorkflow) el.comfyWorkflow.value = JSON.stringify(wf, null, 2);
          var nodes = applyComfyDetection(String(ev.target.result));
          comfyStatus('已载入并自动识别：正向 ' + (nodes.promptNodeId || '—')
            + ' · 负面 ' + (nodes.negativeNodeId || '—')
            + ' · 输出 ' + (nodes.outputNodeId || '—'));
          save();
        } catch (err) {
          comfyStatus('上传失败：' + (err && err.message || err), true);
        }
      };
      reader.onerror = function() { comfyStatus('文件读取失败', true); };
      reader.readAsText(file);
    });
  }

  // 自动识别当前工作流 JSON 文本的节点
  if (el.comfyDetect) {
    el.comfyDetect.addEventListener('click', function() {
      var text = el.comfyWorkflow ? el.comfyWorkflow.value : '';
      try {
        var nodes = applyComfyDetection(text);
        comfyStatus('已识别：正向 ' + (nodes.promptNodeId || '—')
          + ' · 负面 ' + (nodes.negativeNodeId || '—')
          + ' · 输出 ' + (nodes.outputNodeId || '—'));
        save();
      } catch (err) {
        comfyStatus('识别失败：' + (err && err.message || err), true);
      }
    });
  }

  load();

  window.__getImageConfig__ = function() { return collect(); };
  window.__setImageConfig__ = function(cfg) { applyToDom(cfg); save(); };
  window.__getImageProvider__ = function() { return providerEl.value; };
}
