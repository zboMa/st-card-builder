import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureCardVersions,
  commitCardDraftToVersions,
  bumpCardDraftVersion,
  switchCardDraftVersion,
  publishCardDraft,
  listCardVersions,
  compareCharacterVersion,
  getMaxPublishedCharacterVersion,
} from '../src/lib/card-builder/cardVersions.mjs';
import {
  ensureNovelVersions,
  bumpNovelDraftVersion,
  publishNovelDraft,
  switchNovelDraftVersion,
  listNovelVersions,
  compareDisplayVersion,
} from '../src/lib/storyStudio/novelVersions.mjs';

function blankCard() {
  return ensureCardVersions({
    draftId: 'c1',
    charName: 'Alice',
    charDesc: 'desc',
    charTags: [],
    firstMes: 'hi',
    alternateGreetings: [],
    worldbookEntries: [],
    characterVersion: '1.0',
    versions: [],
  });
}

describe('cardVersions', function() {
  it('compare + 保存不写 versions', function() {
    assert.ok(compareCharacterVersion('1.1', '1.0') > 0);
    var d = blankCard();
    d.charName = 'Bob';
    assert.equal(d.versions.length, 0);
  });

  it('增版写入旧版快照且新号 > 已发', function() {
    var d = blankCard();
    d.charName = 'V1';
    var r = bumpCardDraftVersion(d, 'minor');
    assert.equal(r.ok, true);
    assert.equal(d.characterVersion, '1.1');
    assert.equal(d.versions.length, 1);
    assert.equal(d.versions[0].ver, '1.0');
    assert.equal(d.versions[0].published, false);
    assert.equal(d.versions[0].snapshot.charName, 'V1');
  });

  it('发布写入 published 并自动增草稿版号', function() {
    var d = blankCard();
    d.charName = 'Pub';
    var pub = publishCardDraft(d);
    assert.equal(pub.publishedVer, '1.0');
    assert.equal(pub.draftVer, '1.1');
    assert.equal(d.characterVersion, '1.1');
    assert.equal(getMaxPublishedCharacterVersion(d.versions), '1.0');
    assert.ok(d.versions.some(function(v) { return v.ver === '1.0' && v.published; }));
  });

  it('二次发布版号抬升', function() {
    var d = blankCard();
    publishCardDraft(d);
    d.charName = 'Second';
    var pub2 = publishCardDraft(d);
    assert.equal(pub2.publishedVer, '1.1');
    assert.equal(d.characterVersion, '1.2');
  });

  it('切版：提交当前并加载历史', function() {
    var d = blankCard();
    d.charName = 'A';
    bumpCardDraftVersion(d, 'minor'); // versions 1.0, draft 1.1
    d.charName = 'B';
    var sw = switchCardDraftVersion(d, '1.0');
    assert.equal(sw.ok, true);
    assert.equal(d.characterVersion, '1.0');
    assert.equal(d.charName, 'A');
    // 1.1 应已进列表
    assert.ok(d.versions.some(function(v) { return v.ver === '1.1'; }));
  });

  it('list 含未发版', function() {
    var d = blankCard();
    bumpCardDraftVersion(d, 'minor');
    var list = listCardVersions(d);
    assert.ok(list.length >= 1);
    assert.equal(list.some(function(v) { return !v.published; }), true);
  });
});

function blankNovel() {
  return ensureNovelVersions({
    id: 'n1',
    title: 'Story',
    novelVersion: '1',
    outline: [],
    chapters: [],
    branches: [],
    versions: [],
  });
}

describe('novelVersions', function() {
  it('compare display', function() {
    assert.ok(compareDisplayVersion('1.0-2', '1.0-1') > 0);
  });

  it('发布自动增 novelVersion', function() {
    var n = blankNovel();
    var pub = publishNovelDraft(n, '1.0');
    assert.equal(pub.publishedVer, '1.0-1');
    assert.equal(n.novelVersion, '2');
    assert.ok(n.versions[0].published);
  });

  it('增版与切版', function() {
    var n = blankNovel();
    n.title = 'Old';
    bumpNovelDraftVersion(n, '1.0');
    assert.equal(n.novelVersion, '2');
    assert.equal(n.versions[0].ver, '1.0-1');
    n.title = 'New';
    switchNovelDraftVersion(n, '1.0', '1.0-1');
    assert.equal(n.title, 'Old');
    assert.equal(n.novelVersion, '1');
  });

  it('listNovelVersions', function() {
    var n = blankNovel();
    bumpNovelDraftVersion(n, '1.0');
    assert.ok(listNovelVersions(n).length >= 1);
  });
});
