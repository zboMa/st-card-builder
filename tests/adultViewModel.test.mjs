import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildAdultLists,
  buildWorldframeView,
  buildCorruptionTargets,
  buildAddCatalog,
  buildAddModal,
} from '../src/lib/card-builder/panels/adultViewModel.mjs';
import { listWorldviewPresetsByGroup } from '../src/lib/presets/worldviews/index.mjs';

const data = {
  maxItems: 5,
  groups: ['基础'],
  ids: ['f1', 'f2'],
  presets: {
    f1: { label: '口味一', summary: '摘要一', group: '基础' },
    f2: { label: '口味二', summary: '摘要二', group: '基础' },
  },
  speechPresets: {},
  speechGroups: [],
  speechIds: [],
  posturePresets: {},
  postureGroups: [],
  postureIds: [],
  tabooIds: ['t1'],
  tabooTypes: { t1: { label: '禁忌一', summary: '', group: 'power' } },
  worldframes: { w1: { label: '框架一', summary: '摘要' } },
  worldframeIds: ['w1', 'generic'],
};

describe('adultViewModel', function () {
  it('构建列表行与上限文案', function () {
    var groups = listWorldviewPresetsByGroup();
    var wvId = groups[0].items[0].id;
    var view = buildAdultLists({
      worldviewPresetItems: [{ id: wvId, note: '备' }],
      nsfwFlavorItems: [{ id: 'f1', note: '注' }],
      eroticPostureItems: [],
      eroticSpeechItems: [],
      ntlTabooItems: [],
    }, data);
    assert.equal(view.worldview[0].tag, '主');
    assert.equal(view.worldview[0].note, '备');
    assert.equal(view.flavor[0].title, '口味一');
    assert.equal(view.flavor[0].note, '注');
    assert.match(view.caps.worldview, /已选 1 \/ 3/);
    assert.match(view.caps.flavor, /已选 1 \/ 5/);
  });

  it('载体框架：手动覆盖优先，选项含自动与通用', function () {
    var view = buildWorldframeView({
      adultWorldframeForced: 'w1',
      adultWorldframe: 'w1',
      worldviewPresetItems: [],
    }, data);
    assert.equal(view.forced, 'w1');
    assert.match(view.label, /框架一/);
    assert.match(view.label, /手动/);
    assert.match(view.mapHint, /手动强制/);
    assert.ok(view.options.some(function (o) { return o.value === ''; }));
    assert.ok(view.options.some(function (o) { return o.value === 'generic'; }));
  });

  it('恶堕目标：仅女角色时默认勾选女性与未知', function () {
    var picks = buildCorruptionTargets([
      { name: '女一', gender: '女' },
      { name: '男一', gender: '男' },
      { name: '未知' },
    ], {
      corruptionDefaultFemaleOnly: true,
      corruptionSelectedNames: ['女一', '未知'],
    });
    var byName = {};
    picks.forEach(function (p) { byName[p.name] = p; });
    assert.equal(byName['女一'].selected, true);
    assert.equal(byName['男一'].selected, false);
    assert.equal(byName['未知'].selected, true);
  });

  it('添加目录排除已选条目并保留预览字段', function () {
    var catalog = buildAddCatalog('flavor', {
      nsfwFlavorItems: [{ id: 'f1', note: '' }],
    }, data);
    assert.equal(catalog.length, 1);
    assert.equal(catalog[0].items.length, 1);
    assert.equal(catalog[0].items[0].id, 'f2');
    assert.equal(catalog[0].items[0].summary, '摘要二');
  });

  it('刷新角色列表不重新播种默认勾选', function () {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..');
    const src = readFileSync(join(root, 'src/lib/card-builder/panels/adultConfigBridge.mjs'), 'utf8');
    const start = src.indexOf('refreshTargets:');
    const end = src.indexOf('setWorldframe:', start);
    assert.ok(start >= 0 && end > start);
    const block = src.slice(start, end);
    assert.doesNotMatch(block, /initSelections/);
    assert.match(block, /setCorruptionSelected/);
    assert.match(block, /setAffectionSelected/);
  });

  it('添加弹窗快照含上限与选中列表', function () {
    var view = buildAddModal('flavor', {
      nsfwFlavorItems: [{ id: 'f1', note: '' }],
    }, data);
    assert.equal(view.kind, 'flavor');
    assert.equal(view.max, 5);
    assert.equal(view.selected.length, 1);
    assert.match(view.selectedHead, /已选： 1/);
  });
});
