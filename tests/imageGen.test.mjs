/**
 * 生图客户端纯函数契约
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  b64ToDataUrl,
  normalizeServerUrl,
  buildOpenaiStyleBody,
  stabilityEngine,
  stabilityAspectRatio,
  parseWorkflowJson,
  comfyNodeText,
  injectComfyText,
} from '../src/lib/imageGen/client.mjs';
import { providerById } from '../src/lib/aiConfig/imageConfig.mjs';

describe('imageGen client pure', function() {
  it('b64ToDataUrl / normalizeServerUrl', function() {
    assert.equal(b64ToDataUrl('aGk=', 'image/png'), 'data:image/png;base64,aGk=');
    assert.equal(normalizeServerUrl('  http://x:8188/// '), 'http://x:8188');
    assert.equal(normalizeServerUrl(''), '');
  });

  it('buildOpenaiStyleBody：尺寸/数量/质量映射', function() {
    var prov = providerById('openai');
    var cfg = { model: 'gpt-image-1', size: '1024x1024', sizeCustom: '', count: 2, quality: 'high' };
    var b1 = buildOpenaiStyleBody(cfg, prov, 'a cat', {});
    assert.equal(b1.model, 'gpt-image-1');
    assert.equal(b1.n, 2);
    assert.equal(b1.size, '1024x1024');
    assert.equal(b1.quality, 'high');

    var b2 = buildOpenaiStyleBody({ model: 'dall-e-3', size: 'custom', sizeCustom: '896x1344', count: 1, quality: 'low' }, prov, 'x', {});
    assert.equal(b2.quality, 'standard');
    assert.equal(b2.size, '896x1344');

    var b3 = buildOpenaiStyleBody({ model: 'dall-e-3', size: '1024x1024', count: 1, quality: 'high' }, prov, 'x', {});
    assert.equal(b3.quality, 'hd');

    var b4 = buildOpenaiStyleBody({ model: '', size: '512x512', count: 0, quality: 'medium' }, prov, 'x', {});
    assert.equal(b4.model, prov.models[0]);
    assert.equal(b4.n, 1);
  });

  it('stabilityEngine / stabilityAspectRatio', function() {
    assert.equal(stabilityEngine('stable-image-core'), 'core');
    assert.equal(stabilityEngine('sd3.5-large'), 'sd3');
    assert.equal(stabilityEngine('stable-image-ultra'), 'ultra');
    assert.equal(stabilityEngine('foo'), 'core');
    assert.equal(stabilityAspectRatio('832x1216'), '2:3');
    assert.equal(stabilityAspectRatio('1344x768'), '16:9');
    assert.equal(stabilityAspectRatio('1024x1024'), '1:1');
    assert.equal(stabilityAspectRatio('bogus'), '1:1');
  });

  it('parseWorkflowJson：合法/非法', function() {
    var wf = { '6': { class_type: 'CLIPTextEncode', inputs: { text: 'hello' } } };
    assert.deepEqual(parseWorkflowJson(JSON.stringify(wf)), wf);
    assert.throws(function() { parseWorkflowJson(''); }, /工作流 JSON/);
    assert.throws(function() { parseWorkflowJson('{oops'); }, /解析失败/);
    assert.throws(function() { parseWorkflowJson('"str"'); }, /不是对象/);
  });

  it('comfyNodeText / injectComfyText 不可变注入', function() {
    var wf = { '6': { class_type: 'CLIPTextEncode', inputs: { text: 'old' } } };
    assert.equal(comfyNodeText(wf, '6'), 'old');
    var next = injectComfyText(wf, '6', 'new prompt');
    assert.equal(comfyNodeText(next, '6'), 'new prompt');
    assert.equal(comfyNodeText(wf, '6'), 'old', '原对象不可变');
    assert.notEqual(next, wf);
    // 节点不存在或非 string 不注入
    assert.equal(injectComfyText(wf, '99', 'x'), wf);
    var wfNoText = { '6': { inputs: {} } };
    assert.equal(injectComfyText(wfNoText, '6', 'x'), wfNoText);
  });
});
