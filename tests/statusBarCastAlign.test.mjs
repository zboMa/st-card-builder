/**
 * 多人状态栏同套对齐
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeMultiCastMvuVariables,
  alignCastPaths,
  castCharFieldSpecs,
  pruneStatusBarMvuDesign,
} from '../src/lib/statusBarCastAlign.mjs';
import { buildPlaceholderPaths } from '../src/lib/statusBarBuild.mjs';

describe('statusBarCastAlign', function() {
  it('normalizeMultiCastMvuVariables：AI 只给主视角时也为人人展开同套', function() {
    var chars = [{ name: '林雾', selected: true }, { name: '秦玥', selected: true }];
    var flags = { emotion: true, action: true, affection: true };
    var raw = {
      summary: 'test',
      variables: [
        { path: '世界.当前时间', type: 'string', default: '08:00', description: '时间' },
        { path: 'NPC.林雾.情绪', type: 'string', default: '平静', description: '情绪' },
        { path: 'NPC.林雾.好感度', type: 'number', default: 40, description: '好感' },
        { path: 'NPC.秦玥.情绪', type: 'string', default: '旁观', description: '情绪' },
      ],
    };
    var out = normalizeMultiCastMvuVariables(raw, {
      characters: chars,
      moduleFlags: flags,
      mainName: '林雾',
    });
    var paths = out.variables.map(function(v) { return v.path; });
    assert.ok(paths.includes('NPC.林雾.行动'));
    assert.ok(paths.includes('NPC.秦玥.行动'));
    assert.ok(paths.includes('NPC.秦玥.好感度'));
    var linWu = paths.filter(function(p) { return p.indexOf('NPC.林雾.') === 0; });
    var qin = paths.filter(function(p) { return p.indexOf('NPC.秦玥.') === 0; });
    assert.equal(linWu.length, qin.length);
    assert.equal(linWu.length, castCharFieldSpecs(flags).length);
  });

  it('alignCastPaths：两名角色 label 集合一致', function() {
    var chars = [{ name: '林雾', selected: true }, { name: '秦玥', selected: true }];
    var flags = { emotion: true, action: true, outfit: true };
    var uneven = [
      { path: '世界.时间', label: '时间', group: '世界', sample: '08:00' },
      { path: 'NPC.林雾.情绪', label: '情绪', group: 'NPC', sample: '平静', role: '林雾' },
      { path: 'NPC.林雾.行动', label: '行动', group: 'NPC', sample: '观望', role: '林雾' },
      { path: 'NPC.秦玥.情绪', label: '情绪', group: 'NPC', sample: '旁观', role: '秦玥' },
    ];
    var aligned = alignCastPaths(uneven, {
      castMode: 'multi',
      characters: chars,
      moduleFlags: flags,
      mainName: '林雾',
    });
    function labelsFor(name) {
      return aligned.filter(function(p) { return p.role === name; }).map(function(p) { return p.label; }).sort();
    }
    assert.deepEqual(labelsFor('林雾'), labelsFor('秦玥'));
  });

  it('buildPlaceholderPaths 与 castCharFieldSpecs 字段数一致', function() {
    var flags = { emotion: true, attributes: true, quest: true };
    var chars = [{ name: 'A', selected: true }, { name: 'B', selected: true }];
    var ph = buildPlaceholderPaths({
      castMode: 'multi',
      moduleFlags: flags,
      characters: chars,
      mainName: 'A',
    });
    var perChar = castCharFieldSpecs(flags).length;
    assert.equal(ph.filter(function(p) { return p.role === 'A'; }).length, perChar);
    assert.equal(ph.filter(function(p) { return p.role === 'B'; }).length, perChar);
  });

  it('normalizeSingleCastMvuVariables：关 NSFW/恶堕/亲密度时不保留对应变量', function() {
    var flags = {
      emotion: true,
      action: true,
      affection: false,
      corruption_stage: false,
      affection_stage: false,
      nsfw_orgasm: false,
      nsfw_breasts: false,
    };
    var raw = {
      variables: [
        { path: '世界.当前时间', type: 'string', default: '08:00', description: '时间' },
        { path: '角色.情绪', type: 'string', default: '平静', description: '情绪' },
        { path: '角色.好感度', type: 'number', default: 40, description: '好感' },
        { path: '角色.恶堕进度', type: 'number', default: 0, description: '恶堕' },
        { path: '角色.亲密度', type: 'number', default: 30, description: '亲密度' },
        { path: '角色.快感', type: 'number', default: 0, description: '快感' },
        { path: '角色.双乳', type: 'string', default: '—', description: '双乳' },
      ],
    };
    var out = pruneStatusBarMvuDesign(raw, {
      castMode: 'single',
      moduleFlags: flags,
      mainName: '沈若冰',
    });
    var paths = out.variables.map(function(v) { return v.path; });
    assert.ok(paths.includes('角色.情绪'));
    assert.ok(!paths.includes('角色.好感度'));
    assert.ok(!paths.includes('角色.恶堕进度'));
    assert.ok(!paths.includes('角色.亲密度'));
    assert.ok(!paths.some(function(p) { return /快感|双乳/.test(p); }));
  });
});
