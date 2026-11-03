import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCharacterView,
  buildModuleGroupsView,
  buildPresetView,
  buildStatusBarStepMarks,
  buildStatusBarView,
} from '../src/lib/card-builder/panels/statusBarViewModel.mjs';
import { normalizeDesign, STATUS_BAR_MODULES } from '../src/lib/statusBar.mjs';

function sampleDesign() {
  return normalizeDesign({
    presetId: 'scrapbook',
    includeProtagonist: true,
    nsfw: false,
    layoutPrompt: '窄条清单',
    moduleFlags: { time_weather: true },
    characters: [
      { name: '秦玥', selected: true },
      { name: '林雾', selected: false },
    ],
  });
}

describe('statusBarViewModel', function() {
  it('预设与模块按当前设计投影，NSFW 模块默认隐藏', function() {
    const view = buildPresetView(sampleDesign());
    assert.ok(view.length > 0);
    assert.ok(view.some(function(item) { return item.active; }));
    const groups = buildModuleGroupsView(sampleDesign());
    assert.ok(groups.length > 0);
    const ids = groups.flatMap(function(group) { return group.items.map(function(item) { return item.id; }); });
    assert.ok(ids.includes('time_weather'));
    const nsfw = STATUS_BAR_MODULES.find(function(mod) { return mod.nsfw; });
    if (nsfw) assert.ok(!ids.includes(nsfw.id));
  });

  it('人物列表排除卡角色，路径与步骤标记来自路径', function() {
    const chars = buildCharacterView(sampleDesign(), '林雾');
    assert.deepEqual(chars.map(function(c) { return c.name; }), ['秦玥']);
    assert.equal(chars[0].selected, true);
    const marks = buildStatusBarStepMarks(sampleDesign(), [{ path: '角色.体力' }], '林雾');
    assert.equal(marks[1], true);
    assert.equal(marks[2], true);
    assert.equal(marks[3], true);
    assert.equal(marks[4], true);
  });

  it('buildStatusBarView 汇总生成按钮与预览状态', function() {
    const view = buildStatusBarView(sampleDesign(), {
      charName: '林雾',
      paths: [{ path: '角色.体力' }],
      tree: { 角色: { 体力: '8' } },
      view: 'vars',
      busy: { vars: true },
      previewHtml: '<div>ok</div>',
      snippetCode: '{}',
      hintText: '已勾主角',
      floorLabel: '尚无样例',
    });
    assert.equal(view.generateLabel, '重新生成');
    assert.equal(view.hasPaths, true);
    assert.equal(view.hasTree, true);
    assert.equal(view.view, 'vars');
    assert.equal(view.busy.vars, true);
    assert.equal(view.hasLayout, false);
    assert.equal(view.characters.length, 1);
  });
});
