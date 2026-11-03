/**
 * 世界书面板视图快照（纯函数）。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWorldbookEditor,
  buildWorldbookSearch,
  buildWorldbookView,
  organizePreview,
  worldbookRow,
} from '../src/lib/card-builder/panels/worldbookViewModel.mjs';

var entries = [
  {
    comment: '剑',
    content: '一把用于测试的剑，足够长，用于跨过骨架阈值并验证行预览与搜索匹配。',
    keys: ['剑', '武器'],
    strategy: 'selective',
    position: 0,
    depth: 4,
    order: 100,
    prob: 100,
  },
  {
    comment: '[系统] 变量',
    content: '系统条目',
    keys: [],
    strategy: 'constant',
    owner: 'mvu',
    kind: 'mvu_system',
  },
];

describe('worldbookViewModel', function() {
  it('行快照包含标题、策略、骨架/元信息', function() {
    var row = worldbookRow(entries[0], 0);
    assert.equal(row.index, 0);
    assert.equal(row.title, '剑');
    assert.equal(row.strategy, 'selective');
    assert.equal(row.strategyLabel, '可选');
    assert.equal(row.isSkeleton, true);
    assert.match(row.meta, /位置: 角色定义之前/);
    assert.match(row.meta, /概率: 100%/);
  });

  it('搜索按范围命中并返回 snippet/字段', function() {
    var hits = buildWorldbookSearch(entries, '武器', { title: true, keys: true, content: true }, 'all');
    assert.equal(hits.length, 1);
    assert.equal(hits[0].index, 0);
    assert.match(hits[0].fields, /触发词/);
    var none = buildWorldbookSearch(entries, '武器', { title: true, keys: false, content: false }, 'all');
    assert.equal(none.length, 0);
  });

  it('buildWorldbookView 应用家族过滤与命中计数', function() {
    var view = buildWorldbookView({ worldbookEntries: entries }, {
      family: 'user', query: '剑', scopeTitle: true, scopeKeys: true, scopeContent: true,
    });
    assert.equal(view.rows.length, 2);
    assert.equal(view.searchHits.length, 1);
    assert.match(view.searchCountText, /命中 1 条/);
  });

  it('编辑字段保留系统标题只读与触发词', function() {
    var editor = buildWorldbookEditor(entries[1], false);
    assert.equal(editor.titleReadOnly, true);
    assert.equal(editor.strategy, 'constant');
    var normal = buildWorldbookEditor(entries[0], false);
    assert.equal(normal.keys, '剑, 武器');
    assert.equal(normal.titleReadOnly, false);
  });

  it('整理预览输出可读标签', function() {
    var preview = organizePreview(entries, [
      { index: 0, position: 1, role: 2, depth: 3, order: 10, prob: 80, reason: '调整' },
    ]);
    assert.equal(preview.length, 1);
    assert.equal(preview[0].position, '角色定义之后');
    assert.equal(preview[0].role, '助手');
    assert.equal(preview[0].reason, '调整');
  });
});
