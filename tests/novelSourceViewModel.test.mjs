/**
 * 小说原始资料面板视图快照（纯函数）。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSourceView,
  sourceFileSummary,
  sourceStats,
} from '../src/lib/novel/panels/sourceViewModel.mjs';

describe('novelSourceViewModel', function() {
  it('文件摘要与统计 chips', function() {
    var file = sourceFileSummary({ fileText: 'abc', fileMeta: { name: 'novel.txt' } });
    assert.deepEqual(file, { name: 'novel.txt', length: 3 });
    assert.equal(sourceFileSummary({ fileText: '', fileMeta: { name: 'x' } }), null);
    var stats = sourceStats({
      sourceLen: 12,
      enabledChapterCount: 2,
      chapterCount: 3,
      characterCount: 4,
      wbEntryCount: 5,
    });
    assert.deepEqual(stats.map(function(s) { return s.text; }), [
      '12 字', '章节 2/3', '人物 4', '世界书草稿 5',
    ]);
  });

  it('buildSourceView 生成表单值并保留 UI 状态', function() {
    var view = buildSourceView({
      sourceText: '原文',
      contextText: '说明',
      narrativeMode: 'worldbuilding',
      concurrency: 5,
      expandBudget: 42000,
      strictQuality: true,
      fileText: 'abc',
      fileMeta: { name: 'novel.txt' },
    }, { sourceLen: 2 }, {
      status: '已导入',
      dragging: true,
    });
    assert.equal(view.sourceText, '原文');
    assert.equal(view.contextText, '说明');
    assert.equal(view.narrativeMode, 'worldbuilding');
    assert.equal(view.concurrency, '5');
    assert.equal(view.expandBudget, '42000');
    assert.equal(view.strictQuality, true);
    assert.deepEqual(view.file, { name: 'novel.txt', length: 3 });
    assert.equal(view.status, '已导入');
    assert.equal(view.dragging, true);
  });

  it('空状态回退默认模式/并发/预算', function() {
    var view = buildSourceView({}, {}, {});
    assert.equal(view.narrativeMode, 'story');
    assert.equal(view.concurrency, '3');
    assert.equal(view.expandBudget, '12000');
    assert.equal(view.file, null);
  });
});
