/**
 * 生图客户端：按 AI 配置服务商分派调用（浏览器直连，与文本 AI 一致）
 * 兼容系（OpenAI 兼容 images/generations + Bearer，含 Ark）/ Stability v2beta / ComfyUI 轮询。
 * 纯函数独立导出便于单测；网络调用仅限浏览器。
 */
import { providerById } from '../aiConfig/imageConfig.mjs';

export function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

export function b64ToDataUrl(b64, mime) {
  return 'data:' + (mime || 'image/png') + ';base64,' + String(b64 || '');
}

export function normalizeServerUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

export function blobToDataUrl(blob) {
  return new Promise(function(resolve, reject) {
    var fr = new FileReader();
    fr.onload = function() { resolve(String(fr.result)); };
    fr.onerror = function() { reject(new Error('图片读取失败')); };
    fr.readAsDataURL(blob);
  });
}

export async function fetchAsDataUrl(url, headers) {
  var res = await fetch(url, { headers: headers || {} });
  if (!res.ok) {
    throw new Error('图片下载失败 HTTP ' + res.status + '（可能受 CORS 限制）');
  }
  var blob = await res.blob();
  return blobToDataUrl(blob);
}

async function safeErrText(res) {
  try {
    var t = await res.text();
    return String(t || '').slice(0, 200);
  } catch (e) { return ''; }
}

/** 兼容系请求体（纯函数） */
export function buildOpenaiStyleBody(cfg, provider, prompt, opts) {
  var model = String(cfg.model || '').trim() || ((provider.models || [])[0] || '');
  var size = cfg.size === 'custom'
    ? (String(cfg.sizeCustom || '').trim() || '1024x1024')
    : (cfg.size || '1024x1024');
  var q = cfg.quality || 'medium';
  var body = {
    model: model,
    prompt: String(prompt || ''),
    n: Math.max(1, Math.min(4, Number(cfg.count) || 1)),
    size: size,
  };
  var isGptImage = /gpt-image/i.test(model);
  body.quality = isGptImage ? q : (q === 'high' ? 'hd' : 'standard');
  return body;
}

async function generateOpenaiStyle(cfg, provider, prompt, opts) {
  var base = normalizeServerUrl(cfg.baseUrl);
  if (!base) throw new Error('请先在「AI 配置 → 生图」填写 API 接口地址');
  var body = buildOpenaiStyleBody(cfg, provider, prompt, opts);
  if (!body.model) throw new Error('请先在「AI 配置 → 生图」填写生图模型');
  var headers = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) headers.Authorization = 'Bearer ' + cfg.apiKey;
  var res = await fetch(base + '/images/generations', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error('生图失败 HTTP ' + res.status + '：' + (await safeErrText(res)));
  }
  var data = await res.json();
  var items = (data && data.data) || [];
  var images = [];
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    if (!it) continue;
    if (it.b64_json) {
      images.push({ dataUrl: b64ToDataUrl(it.b64_json, 'image/png') });
    } else if (it.url) {
      images.push({ dataUrl: await fetchAsDataUrl(it.url, headers) });
    }
  }
  if (!images.length) throw new Error('接口未返回图片（data 为空）');
  return { images: images, providerLabel: provider.label };
}

/** Stability v2beta engine 映射 */
export function stabilityEngine(model) {
  var m = String(model || '');
  if (/ultra/i.test(m)) return 'ultra';
  if (/sd3|3\.5/i.test(m)) return 'sd3';
  return 'core';
}

/** Stability v2beta 支持的宽高比白名单 */
export function stabilityAspectRatio(size) {
  var map = {
    '1024x1024': '1:1', '512x512': '1:1',
    '832x1216': '2:3', '768x1344': '9:16',
    '1216x832': '3:2', '1344x768': '16:9',
  };
  return map[String(size || '')] || '1:1';
}

function buildStabilityForm(cfg, prompt, opts) {
  var form = new FormData();
  form.append('prompt', String(prompt || ''));
  form.append('output_format', 'jpeg');
  form.append('aspect_ratio', stabilityAspectRatio(cfg.stabSize));
  if (opts.negative) form.append('negative_prompt', String(opts.negative));
  if (cfg.stabSteps) form.append('steps', String(cfg.stabSteps));
  return form;
}

async function generateStability(cfg, provider, prompt, opts) {
  var engine = stabilityEngine(cfg.stabModel);
  var base = normalizeServerUrl(cfg.stabBaseUrl || 'https://api.stability.ai');
  var headers = {};
  if (cfg.stabApiKey) headers.Authorization = 'Bearer ' + cfg.stabApiKey;
  var url = base + '/v2beta/stable-image/generate/' + engine;
  var count = Math.max(1, Math.min(4, Number(cfg.stabCount) || 1));
  var images = [];
  for (var i = 0; i < count; i++) {
    var res = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: buildStabilityForm(cfg, prompt, opts),
    });
    if (!res.ok) {
      throw new Error('Stability 生成失败 HTTP ' + res.status + '：' + (await safeErrText(res)));
    }
    var blob = await res.blob();
    images.push({ dataUrl: await blobToDataUrl(blob) });
  }
  return { images: images, providerLabel: provider.label };
}

/** 解析工作流 JSON（纯函数，抛错带可读信息） */
export function parseWorkflowJson(text) {
  var raw = String(text || '').trim();
  if (!raw) throw new Error('请先在「AI 配置 → 生图」粘贴 ComfyUI 工作流 JSON（Save (API Format) 导出）');
  var wf;
  try {
    wf = JSON.parse(raw);
  } catch (e) {
    throw new Error('工作流 JSON 解析失败：' + (e && e.message || e));
  }
  if (!wf || typeof wf !== 'object') throw new Error('工作流 JSON 不是对象');
  return wf;
}

/** 读取指定节点 text 字段（纯函数） */
export function comfyNodeText(workflow, nodeId) {
  var n = workflow && workflow[nodeId];
  return (n && n.inputs && typeof n.inputs.text === 'string') ? n.inputs.text : '';
}

/** 不可变注入节点 text（纯函数） */
export function injectComfyText(workflow, nodeId, text) {
  if (!nodeId || text == null) return workflow;
  var n = workflow && workflow[nodeId];
  if (n && n.inputs && typeof n.inputs.text === 'string') {
    return Object.assign({}, workflow, {
      [nodeId]: Object.assign({}, n, {
        inputs: Object.assign({}, n.inputs, { text: String(text) }),
      }),
    });
  }
  return workflow;
}

async function generateComfyui(cfg, prompt, opts) {
  var server = normalizeServerUrl(cfg.comfyServerUrl);
  if (!server) throw new Error('请先在「AI 配置 → 生图」填写 ComfyUI 服务器地址');
  var workflow = parseWorkflowJson(cfg.comfyWorkflow);
  workflow = injectComfyText(workflow, String(cfg.comfyPromptNodeId || ''), prompt);
  if (opts.negative) {
    workflow = injectComfyText(workflow, String(cfg.comfyNegativeNodeId || ''), opts.negative);
  }
  var headers = { 'Content-Type': 'application/json' };
  if (cfg.comfyApiKey) headers.Authorization = 'Bearer ' + cfg.comfyApiKey;
  var clientId = 'stcb-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  var res = await fetch(server + '/prompt', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ prompt: workflow, client_id: clientId }),
  });
  if (!res.ok) {
    throw new Error('ComfyUI 提交失败 HTTP ' + res.status + '：' + (await safeErrText(res)));
  }
  var data = await res.json();
  var pid = data && data.prompt_id;
  if (!pid) throw new Error('ComfyUI 未返回 prompt_id');
  var deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    await sleep(1200);
    var hist = null;
    try {
      var hres = await fetch(server + '/history/' + pid, { headers: headers });
      if (hres.ok) hist = await hres.json();
    } catch (e) { /* 404 = 执行中，继续 */ }
    var images = [];
    if (hist && hist[pid] && hist[pid].outputs) {
      var outs = hist[pid].outputs;
      for (var k in outs) {
        var node = outs[k];
        if (!node || !Array.isArray(node.images)) continue;
        for (var j = 0; j < node.images.length; j++) {
          var im = node.images[j];
          if (!im || !im.filename) continue;
          var viewUrl = server + '/view?filename=' + encodeURIComponent(im.filename)
            + (im.subfolder ? '&subfolder=' + encodeURIComponent(im.subfolder) : '')
            + '&type=' + encodeURIComponent(im.type || 'output');
          images.push({ dataUrl: await fetchAsDataUrl(viewUrl, headers) });
        }
      }
    }
    if (images.length) return { images: images, providerLabel: 'ComfyUI' };
  }
  throw new Error('ComfyUI 生成超时（180s）');
}

/** 统一入口：按 cfg.provider 分派 */
export async function generateImages(cfg, opts) {
  opts = opts || {};
  var prompt = String(opts.prompt || '').trim();
  if (!prompt) throw new Error('请填写生图提示词');
  var provider = providerById(cfg && cfg.provider) || providerById('custom');
  var type = provider.type;
  if (type === 'stability') return generateStability(cfg, provider, prompt, opts);
  if (type === 'comfyui') return generateComfyui(cfg, prompt, opts);
  return generateOpenaiStyle(cfg, provider, prompt, opts);
}
