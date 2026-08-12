import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_SCHEMA_V2,
  novelNeedsMigration,
  isStorageV2,
  extractChapterBody,
  mergeBodyIntoChapter,
  chapterToStub,
  splitNovelToManifestAndBodies,
  buildCloudSyncPack,
  chapterContentHash,
  storyVersionChapterKey,
} from '../src/lib/storyStudio/storyStorage.mjs';
import { storyChapterDocId } from '../src/lib/sync/docIds.mjs';
import {
  storyChapterKey,
  storyNovelKey,
  storyNovelBackupKey,
} from '../src/lib/storyStudio/idb.mjs';
import { createEmptyNovel, normalizeNovel } from '../src/lib/storyStudio/state.mjs';
import {
  assembleOutlineContext,
  OUTLINE_NEAR_WINDOW,
} from '../src/lib/storyStudio/storyOutlineContext.mjs';

describe('storyStorage v2', function() {
  it('storyChapterKey / backup key', function() {
    assert.equal(
      storyChapterKey('cardA', 'novelB', 'ch1'),
      'storyStudioV1:card:cardA:novelB:ch:ch1'
    );
    assert.equal(
      storyNovelBackupKey('cardA', 'novelB'),
      'storyStudioV1:card:cardA:novelB:backup:v1'
    );
    assert.equal(storyNovelKey('cardA', 'novelB'), 'storyStudioV1:card:cardA:novelB');
  });

  it('novelNeedsMigration 检测 v1 内联正文', function() {
    assert.equal(novelNeedsMigration({ chapters: [{ content: 'hello' }] }), true);
    assert.equal(novelNeedsMigration({ storageSchema: STORAGE_SCHEMA_V2, chapters: [] }), false);
    assert.equal(novelNeedsMigration({ chapters: [{ title: 'x', content: '' }] }), false);
  });

  it('splitNovelToManifestAndBodies 拆 stub 与 body', function() {
    var n = normalizeNovel(createEmptyNovel({ title: '测试' }));
    n.chapters = [{
      id: 'ch_a',
      title: '第一章',
      summary: '摘要',
      content: '正文内容',
      order: 0,
      branchId: n.activeBranchId,
      advancePrompt: '推进',
      feedForward: { summary: 'ff', openThreads: [], tension: 5, updatedAt: 0 },
    }];
    var split = splitNovelToManifestAndBodies(n);
    assert.equal(split.manifest.storageSchema, STORAGE_SCHEMA_V2);
    assert.equal(split.manifest.chapters[0].content, '');
    assert.equal(split.manifest.chapters[0].contentLen, '正文内容'.length);
    assert.equal(split.bodies.ch_a.content, '正文内容');
    assert.equal(split.bodies.ch_a.advancePrompt, '推进');
  });

  it('mergeBodyIntoChapter 往返一致', function() {
    var stub = chapterToStub({
      id: 'ch_x',
      title: 'T',
      summary: 'S',
      order: 1,
      branchId: 'br1',
      content: 'ignored in stub',
    });
    var body = extractChapterBody({
      id: 'ch_x',
      content: 'Hello',
      advancePrompt: 'go',
    });
    var merged = mergeBodyIntoChapter(stub, body);
    assert.equal(merged.content, 'Hello');
    assert.equal(merged.__bodyLoaded, true);
    assert.equal(mergeBodyIntoChapter(stub, null).__bodyLoaded, false);
  });

  it('isStorageV2', function() {
    assert.equal(isStorageV2({ storageSchema: 2 }), true);
    assert.equal(isStorageV2({ storageSchema: 1 }), false);
  });

  it('chapterContentHash 稳定', function() {
    assert.equal(chapterContentHash('abc'), chapterContentHash('abc'));
    assert.notEqual(chapterContentHash('abc'), chapterContentHash('abd'));
  });

  it('storyVersionChapterKey', function() {
    assert.ok(storyVersionChapterKey('c1', 'n1', '1.0-2', 'ch_x').indexOf(':ver:') >= 0);
    assert.ok(storyVersionChapterKey('c1', 'n1', '1.0-2', 'ch_x').indexOf(':ch:ch_x') >= 0);
  });

  it('buildCloudSyncPack 大书仅含已加载/脏章', function() {
    var n = normalizeNovel(createEmptyNovel({ title: '云同步' }));
    n.chapters = [];
    for (var j = 0; j < 90; j++) {
      n.chapters.push({
        id: 'ch_' + j,
        title: '章' + j,
        summary: '',
        content: j === 0 ? 'only loaded' : 'body' + j,
        order: j,
        branchId: n.activeBranchId,
        __bodyLoaded: j === 0,
      });
    }
    var pack = buildCloudSyncPack(n);
    assert.equal(pack.manifest.storageSchema, STORAGE_SCHEMA_V2);
    assert.equal(pack.manifest.chapters[0].content, '');
    assert.equal(pack.chapters.length, 1);
    assert.equal(pack.chapters[0].id, 'ch_0');
    assert.equal(pack.chapters[0].body.content, 'only loaded');
  });

  it('storyChapterDocId', function() {
    assert.equal(storyChapterDocId('c1', 'n1', 'ch_a'), 'story/c1/n1/ch/ch_a');
  });
});

describe('storyOutlineContext', function() {
  it('continue 模式不拼接全书大纲', function() {
    var n = normalizeNovel(createEmptyNovel({ title: '长篇' }));
    var branchId = n.activeBranchId;
    for (var i = 0; i < 120; i++) {
      n.outline.push({
        id: 'ol_' + i,
        title: '第' + (i + 1) + '章',
        summary: '摘要' + i,
        order: i,
        branchId: branchId,
      });
    }
    var ctx = assembleOutlineContext(n, { mode: 'continue', direction: '主角突破' });
    assert.ok(ctx.existingOutline.indexOf('【近邻大纲】') >= 0);
    assert.ok(ctx.existingOutline.indexOf('第120章') < 0 || ctx.existingOutline.indexOf('近邻') >= 0);
    assert.ok(ctx.existingOutline.length < 120 * 50);
    assert.ok(ctx.existingOutline.split('\n').length < OUTLINE_NEAR_WINDOW * 3);
  });

  it('segment 首段仍带已有大纲', function() {
    var n = normalizeNovel(createEmptyNovel());
    n.outline.push({
      id: 'ol1',
      title: '开篇',
      summary: '起',
      order: 0,
      branchId: n.activeBranchId,
    });
    var ctx = assembleOutlineContext(n, { mode: 'segment' });
    assert.ok(ctx.existingOutline.indexOf('开篇') >= 0);
  });
});
