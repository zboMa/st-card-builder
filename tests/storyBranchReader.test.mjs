/**
 * 分支发布 / 读者选线 / 复制草稿
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptyNovel,
  normalizeNovel,
  syncChaptersFromOutline,
  getActiveChapters,
} from '../src/lib/storyStudio/state.mjs';
import {
  forkBranchFromChapter,
  filterNovelForPublish,
  validatePublishReady,
  getChoiceOptionsAfterChapter,
  buildBranchTree,
  patchBranch,
  BRANCH_KIND_ENDING,
} from '../src/lib/storyStudio/branch.mjs';
import {
  buildReleasePayload,
  sanitizeReleaseForPublic,
  RELEASE_SCHEMA_V2,
} from '../src/lib/storyStudio/version.mjs';
import {
  isTreeRelease,
  initPlayState,
  choicesAtChapter,
  sharedNovelToEditableDraft,
  pathChapters,
} from '../src/lib/storyStudio/sharePlay.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function seedTree() {
  var n = normalizeNovel(createEmptyNovel({ title: '多结局' }));
  var bid = n.activeBranchId;
  n.outline = [
    { id: 'o1', title: '一', summary: '起', order: 0, branchId: bid },
    { id: 'o2', title: '二', summary: '承', order: 1, branchId: bid },
  ];
  n = syncChaptersFromOutline(n);
  n.chapters[0].content = '第一章';
  n.chapters[1].content = '第二章';
  var out = forkBranchFromChapter(n, {
    fromChapterId: n.chapters[0].id,
    name: '明线',
    choiceLabel: '走明路',
    kind: 'path',
  });
  n = normalizeNovel(out.novel);
  var chs = getActiveChapters(n);
  chs[chs.length - 1].content = '明线后续';
  var out2 = forkBranchFromChapter(
    setActiveMain(n),
    {
      fromChapterId: n.chapters[0].id,
      name: '暗线',
      choiceLabel: '走暗路',
      kind: BRANCH_KIND_ENDING,
      endingTitle: '黑结局',
    }
  );
  n = normalizeNovel(out2.novel);
  // 切到暗线写一章
  var dark = getActiveChapters(n);
  dark[dark.length - 1].content = '暗线终章';
  return n;
}

function setActiveMain(novel) {
  var n = normalizeNovel(novel);
  var main = n.branches.find(function(b) { return !b.parentBranchId; });
  n.activeBranchId = main.id;
  return n;
}

describe('branch publish filter', function() {
  it('filterNovelForPublish 去掉未 ready 支', function() {
    var n = seedTree();
    var dark = n.branches.find(function(b) { return b.name === '暗线'; });
    n = patchBranch(n, dark.id, { publishReady: false });
    var filtered = filterNovelForPublish(n);
    assert.ok(filtered.branches.every(function(b) { return b.id !== dark.id; }));
    assert.ok(filtered.branches.some(function(b) { return b.name === '明线'; }));
  });

  it('validatePublishReady 空正文报问题', function() {
    var n = normalizeNovel(createEmptyNovel({ title: '空' }));
    var r = validatePublishReady(n);
    assert.equal(r.ok, false);
    assert.ok(r.issues.length >= 1);
  });

  it('getChoiceOptionsAfterChapter 返回选项', function() {
    var n = seedTree();
    var main = n.branches.find(function(b) { return !b.parentBranchId; });
    var opts = getChoiceOptionsAfterChapter(n, n.chapters[0].id, main.id, { onlyReady: true });
    assert.ok(opts.length >= 2);
    assert.ok(opts.some(function(o) { return o.label === '走明路'; }));
  });

  it('buildBranchTree 有缩进行', function() {
    var n = seedTree();
    var rows = buildBranchTree(n);
    assert.ok(rows.length >= 3);
    assert.ok(rows.some(function(r) { return r.depth === 1; }));
  });
});

describe('release schema v2', function() {
  it('buildReleasePayload 含 branches 与 branchId', function() {
    var n = seedTree();
    var rel = buildReleasePayload(n, '1.0', { novelVersion: '1' });
    assert.equal(rel.schemaVersion, RELEASE_SCHEMA_V2);
    assert.ok(rel.branches.length >= 2);
    assert.ok(rel.chapters.every(function(c) { return c.branchId; }));
  });

  it('sanitizeReleaseForPublic 保留树', function() {
    var n = seedTree();
    var rel = buildReleasePayload(n, '1.0', { novelVersion: '2' });
    var pub = sanitizeReleaseForPublic(rel);
    assert.ok(isTreeRelease(pub));
    assert.equal(pub.schemaVersion, RELEASE_SCHEMA_V2);
  });
});

describe('share play & copy', function() {
  it('initPlayState 落在主线', function() {
    var n = seedTree();
    var rel = buildReleasePayload(n, '1.0');
    var play = initPlayState(rel, null);
    var root = rel.branches.find(function(b) { return !b.parentBranchId; });
    assert.equal(play.currentBranchId, root.id);
    assert.ok(pathChapters(rel, play.currentBranchId).length >= 1);
  });

  it('choicesAtChapter 在分叉章给出选项', function() {
    var n = seedTree();
    var rel = buildReleasePayload(n, '1.0');
    var root = rel.branches.find(function(b) { return !b.parentBranchId; });
    var forkCh = rel.chapters.find(function(c) {
      return rel.branches.some(function(b) { return b.forkChapterId === c.id; });
    });
    var opts = choicesAtChapter(rel, root.id, forkCh.id);
    assert.ok(opts.length >= 1);
  });

  it('sharedNovelToEditableDraft 清分享字段并新 id', function() {
    var n = seedTree();
    var rel = buildReleasePayload(n, '1.0');
    var draft = sharedNovelToEditableDraft(rel, { cardId: 'cardX' });
    assert.notEqual(draft.id, n.id);
    assert.equal(draft.shareToken, '');
    assert.equal(draft.publishedDisplayVersion, '');
    assert.equal(draft.cardId, 'cardX');
    assert.match(draft.title, /副本/);
    assert.ok(draft.branches.length >= 2);
  });
});

describe('share reader UI contract', function() {
  it('含选线与复制入口', function() {
    const share = readFileSync(join(root, 'src/components/storyStudio/ShareReaderPanel.astro'), 'utf8');
    assert.match(share, /btnShareReaderCopy/);
    assert.match(share, /share-reader__choices/);
    assert.match(share, /sharedNovelToEditableDraft/);
    assert.match(share, /data-share-pick/);
    const write = readFileSync(join(root, 'src/components/storyStudio/StoryWritePanel.astro'), 'utf8');
    assert.match(write, /id="ssBranchTree"/);
    const routes = readFileSync(join(root, 'server/src/share/logic.mjs'), 'utf8');
    assert.match(routes, /schemaVersion/);
    assert.match(routes, /choiceLabel/);
    assert.match(readFileSync(join(root, 'server/src/share/routes.mjs'), 'utf8'), /sanitizeReleaseDoc/);
  });
});
