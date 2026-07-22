/**
 * 小说版号 / release / 分享解析
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCharacterVersion,
  normalizeNovelVersion,
  buildDisplayVersion,
  bumpNovelVersion,
  buildReleasePayload,
  sanitizeReleaseForPublic,
} from '../src/lib/storyStudio/version.mjs';
import { parseShareTokenFromHash, buildLocalShareUrl } from '../src/lib/storyStudio/shareClient.mjs';
import { createEmptyNovel, normalizeNovel, toCatalogEntry } from '../src/lib/storyStudio/state.mjs';
import { storyReleaseDocId } from '../src/lib/sync/docIds.mjs';
import { sanitizeReleaseDoc, buildShareDocId } from '../server/src/share/logic.mjs';

describe('storyStudio version', function() {
  it('displayVersion = 卡版本-小说版本', function() {
    assert.equal(buildDisplayVersion('1.2', '3'), '1.2-3');
    assert.equal(buildDisplayVersion('', ''), '1.0-1');
    assert.equal(normalizeCharacterVersion(' 2.0 '), '2.0');
    assert.equal(normalizeNovelVersion(''), '1');
  });

  it('bumpNovelVersion 仅主动增版用，整数 +1', function() {
    assert.equal(bumpNovelVersion('1'), '2');
    assert.equal(bumpNovelVersion('9'), '10');
    assert.equal(bumpNovelVersion('x'), '2');
  });

  it('buildReleasePayload 不含书签与写作设置', function() {
    var novel = createEmptyNovel({
      id: 'n1',
      cardId: 'c1',
      title: '测试书',
      novelVersion: '1',
    });
    novel.chapters = [{ id: 'ch1', title: '一', content: '正文A', summary: '', order: 0, advancePrompt: 'secret' }];
    novel.bookmarks = [{ id: 'b1', chapterId: 'ch1', note: '私', createdAt: 1 }];
    novel.writeSettings.autoContinue = true;
    var release = buildReleasePayload(novel, '1.0', { publishedAt: 100 });
    assert.equal(release.displayVersion, '1.0-1');
    assert.equal(release.chapters.length, 1);
    assert.equal(release.chapters[0].content, '正文A');
    assert.equal(release.chapters[0].advancePrompt, undefined);
    assert.equal(release.bookmarks, undefined);
    assert.equal(release.publishedAt, 100);
    var pub = sanitizeReleaseForPublic(release);
    assert.equal(pub.title, '测试书');
    assert.equal(pub.displayVersion, '1.0-1');
  });

  it('normalizeNovel 保留 novelVersion / shareToken', function() {
    var n = normalizeNovel({
      title: 'x',
      novelVersion: '4',
      publishedDisplayVersion: '1.0-4',
      shareToken: 'tok',
    });
    assert.equal(n.novelVersion, '4');
    assert.equal(n.publishedDisplayVersion, '1.0-4');
    assert.equal(n.shareToken, 'tok');
    var cat = toCatalogEntry(n);
    assert.equal(cat.novelVersion, '4');
    assert.equal(cat.shareToken, 'tok');
  });
});

describe('share client / server helpers', function() {
  it('parseShareTokenFromHash', function() {
    assert.deepEqual(parseShareTokenFromHash('#share/abc'), { token: 'abc', version: '' });
    assert.deepEqual(parseShareTokenFromHash('#share/a%2Fb'), { token: 'a/b', version: '' });
    assert.deepEqual(parseShareTokenFromHash('#share/tok/v/1.0-2'), { token: 'tok', version: '1.0-2' });
    assert.deepEqual(parseShareTokenFromHash('#story-read'), { token: '', version: '' });
  });

  it('buildLocalShareUrl', function() {
    assert.match(buildLocalShareUrl('t1'), /#share\/t1$/);
  });

  it('server sanitizeReleaseDoc', function() {
    var out = sanitizeReleaseDoc({
      displayVersion: '1.1-2',
      publishedAt: 9,
      data: {
        title: '云',
        chapters: [{ id: '1', title: 'a', content: 'b', order: 0 }],
      },
    });
    assert.equal(out.title, '云');
    assert.equal(out.displayVersion, '1.1-2');
    assert.equal(out.chapters[0].content, 'b');
    assert.equal(buildShareDocId('xyz'), 'share/xyz');
  });

  it('storyReleaseDocId', function() {
    assert.equal(storyReleaseDocId('c', 'n'), 'story/c/n/release');
  });
});
