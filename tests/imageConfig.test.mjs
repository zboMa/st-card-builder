/**
 * AI 配置 · 生图：服务商元数据与默认配置契约
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  IMAGE_PROVIDERS,
  IMAGE_CONFIG_KEY,
  providerById,
  providerTypeById,
  defaultImageConfig,
  normalizeImageConfig,
  normalizeComfyWorkflow,
  autoDetectComfyNodes,
} from '../src/lib/aiConfig/imageConfig.mjs';

var VALID_TYPES = ['compatible', 'stability', 'comfyui'];

describe('imageConfig', function() {
  it('服务商清单覆盖要求的厂商且 id 唯一', function() {
    var ids = IMAGE_PROVIDERS.map(function(p) { return p.id; });
    assert.equal(new Set(ids).size, ids.length, 'id 不得重复');
    ['openai', 'dashscope', 'zhipu', 'siliconflow', 'grok', 'nanobanana', 'ark', 'stability', 'comfyui', 'custom'].forEach(function(id) {
      assert.ok(ids.indexOf(id) >= 0, '缺少服务商 ' + id);
    });
  });

  it('每个服务商有 label/type/hint；兼容系有默认 base 与模型', function() {
    IMAGE_PROVIDERS.forEach(function(p) {
      assert.ok(p.label, p.id + ' 缺 label');
      assert.ok(VALID_TYPES.indexOf(p.type) >= 0, p.id + ' 类型非法: ' + p.type);
      assert.ok(typeof p.hint === 'string' && p.hint.length > 0, p.id + ' 缺 hint');
      if (p.type === 'compatible') {
        assert.ok(p.base && p.base.indexOf('http') === 0, p.id + ' 缺默认 base');
      }
    });
  });

  it('providerById / providerTypeById 解析与回退', function() {
    assert.equal(providerById('openai').type, 'compatible');
    assert.equal(providerById('stability').type, 'stability');
    assert.equal(providerById('comfyui').type, 'comfyui');
    assert.equal(providerTypeById('ark'), 'compatible');
    assert.equal(providerById('nope'), null);
    assert.equal(providerTypeById('nope'), 'compatible');
  });

  it('默认配置含全部命名空间字段', function() {
    var d = defaultImageConfig();
    assert.equal(d.provider, 'openai');
    assert.equal(d.stabModel, 'stable-image-core');
    assert.equal(d.comfyServerUrl, '');
    assert.ok('comfyWorkflow' in d);
    assert.ok('comfyPromptNodeId' in d);
    assert.ok(d.size === '1024x1024');
  });

  it('normalize 补缺省、保留已给字段', function() {
    var n = normalizeImageConfig({ provider: 'comfyui', comfyServerUrl: 'http://x:8188' });
    assert.equal(n.provider, 'comfyui');
    assert.equal(n.comfyServerUrl, 'http://x:8188');
    assert.equal(n.size, '1024x1024');
    assert.equal(n.stabNegative, '');
    var d = normalizeImageConfig(null);
    assert.deepEqual(d, defaultImageConfig());
    var d2 = normalizeImageConfig(undefined);
    assert.equal(d2.provider, 'openai');
  });

  it('配置 key 符合项目前缀', function() {
    assert.equal(IMAGE_CONFIG_KEY, 'st_v3_builder_image_config');
  });

  it('normalizeComfyWorkflow：UI 前端导出格式转 API 格式', function() {
    var ui = {
      nodes: [
        { id: 6, type: 'CLIPTextEncode', inputs: [{ name: 'text', value: 'hello' }] },
        { id: 9, type: 'SaveImage', inputs: [] },
      ],
      links: [],
    };
    var api = normalizeComfyWorkflow(ui);
    assert.equal(api['6'].class_type, 'CLIPTextEncode');
    assert.equal(api['6'].inputs.text, 'hello');
    assert.equal(api['9'].class_type, 'SaveImage');
    // API 格式原样返回
    var apiRaw = { '3': { class_type: 'KSampler', inputs: { positive: ['6', 0] } } };
    assert.equal(normalizeComfyWorkflow(apiRaw), apiRaw);
    assert.deepEqual(normalizeComfyWorkflow(null), {});
  });

  it('autoDetectComfyNodes：按 KSampler 连线识别正/负/输出', function() {
    var wf = {
      '6': { class_type: 'CLIPTextEncode', inputs: { text: 'pos' } },
      '7': { class_type: 'CLIPTextEncode', inputs: { text: 'neg' } },
      '3': { class_type: 'KSampler', inputs: { positive: ['6', 0], negative: ['7', 0] } },
      '9': { class_type: 'SaveImage', inputs: {} },
    };
    assert.deepEqual(autoDetectComfyNodes(wf), { promptNodeId: '6', negativeNodeId: '7', outputNodeId: '9' });
    // KSamplerAdvanced 同样命中；string 引用
    var wf2 = {
      '6': { class_type: 'CLIPTextEncode', inputs: { text: 'pos' } },
      '3': { class_type: 'KSamplerAdvanced', inputs: { positive: '6', negative: 'bad' } },
    };
    assert.deepEqual(autoDetectComfyNodes(wf2), { promptNodeId: '6', negativeNodeId: '', outputNodeId: '' });
  });

  it('autoDetectComfyNodes：无 KSampler 时回退 CLIPTextEncode；兼容 UI 格式', function() {
    var ui = {
      nodes: [
        { id: 6, type: 'CLIPTextEncode', inputs: [{ name: 'text', value: 'pos' }] },
        { id: 7, type: 'CLIPTextEncode', inputs: [{ name: 'text', value: 'neg' }] },
        { id: 9, type: 'SaveImage', inputs: [] },
      ],
    };
    var nodes = autoDetectComfyNodes(ui);
    assert.equal(nodes.promptNodeId, '6');
    assert.equal(nodes.negativeNodeId, '7');
    assert.equal(nodes.outputNodeId, '9');
    // 仅一个 CLIPTextEncode：无负面
    var single = autoDetectComfyNodes({ '6': { class_type: 'CLIPTextEncode', inputs: {} } });
    assert.deepEqual(single, { promptNodeId: '6', negativeNodeId: '', outputNodeId: '' });
  });
});
