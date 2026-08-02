import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cardIndexEntryId,
  novelIndexEntryId,
  normalizeModeration,
  buildShareMaps,
  buildCardEntryFromParts,
  buildNovelEntriesFromParts,
} from '../src/index/aggregate.mjs';

describe('aggregate: ids', function() {
  it('card / novel 索引 id', function() {
    assert.equal(cardIndexEntryId('discord_1', 'abc'), 'card/discord_1/abc');
    assert.equal(novelIndexEntryId('u1', 'c1', 'n1'), 'novel/u1/c1/n1');
  });
});

describe('aggregate: normalizeModeration', function() {
  it('空 / 无 status → null', function() {
    assert.equal(normalizeModeration(null), null);
    assert.equal(normalizeModeration({}), null);
    assert.equal(normalizeModeration({ status: '' }), null);
  });
  it('规范化字段', function() {
    var m = normalizeModeration({ status: 'removed', by: 'admin', at: 't', reason: '违规' });
    assert.equal(m.status, 'removed');
    assert.equal(m.by, 'admin');
    assert.equal(m.at, 't');
    assert.equal(m.reason, '违规');
  });
});

describe('aggregate: buildShareMaps', function() {
  it('按卡 / 按小说分组，含过期判定', function() {
    var maps = buildShareMaps([
      { ownerUserId: 'u1', type: 'card-share', cardId: 'c1', token: 't1', enabled: true },
      { ownerUserId: 'u1', type: 'novel-share', cardId: 'c1', novelId: 'n1', token: 't2', enabled: false },
      { ownerUserId: 'u1', type: 'card-share', cardId: 'c2', token: 't3', expiresAt: '2020-01-01T00:00:00Z' },
    ]);
    assert.deepEqual(maps.byCard['u1|c1'], { token: 't1', enabled: true, expired: false });
    assert.deepEqual(maps.byNovel['u1|c1|n1'], { token: 't2', enabled: false, expired: false });
    assert.equal(maps.byCard['u1|c2'].expired, true);
    assert.equal(maps.byCard['u1|c1'], maps.byCard['u1|c1']);
  });
});

describe('aggregate: buildCardEntryFromParts', function() {
  it('组装卡索引条目（行 + 草稿 + 分享 + 处置）', function() {
    var entry = buildCardEntryFromParts('u1', 'c1', {
      row: { charName: '爱丽丝', updatedAt: '2026-01-01', contentRev: 'r1', wbCount: 3, bundleBytes: 100, avatarInIdb: true },
      cardDoc: {
        data: { charTags: ['傲娇'], nsfwEnabled: true, characterVersion: '1.2', moderation: { status: 'removed', by: 'ops', at: '2026-02-01', reason: '违规' } },
      },
      catalogDoc: { data: [{ id: 'n1' }, { id: 'n2' }] },
      novelExists: true,
      share: { token: 't1', enabled: true, expired: false },
    });
    assert.equal(entry.type, 'card-index-entry');
    assert.equal(entry.userId, 'u1');
    assert.equal(entry.charName, '爱丽丝');
    assert.deepEqual(entry.charTags, ['傲娇']);
    assert.equal(entry.nsfw, true);
    assert.equal(entry.novelCount, 1);
    assert.equal(entry.storyCount, 2);
    assert.equal(entry.moderated.status, 'removed');
    assert.equal(entry.share.token, 't1');
  });

  it('无 row / 无 cardDoc 时仍出基本条目（兜底）', function() {
    var entry = buildCardEntryFromParts('u1', 'c2', {});
    assert.equal(entry.charName, '');
    assert.equal(entry.moderated, null);
    assert.equal(entry.share, null);
  });
});

describe('aggregate: buildNovelEntriesFromParts', function() {
  it('组装小说索引条目', function() {
    var entries = buildNovelEntriesFromParts('u1', 'c1', {
      catalogDoc: { data: [{ id: 'n1', title: '第一章测试', published: true }] },
      novelDocs: { n1: { updatedAt: '2026-01-02', data: { title: '第一章测试', chapters: [{}, {}, {}] } } },
      shareByNovel: { 'u1|c1|n1': { token: 't2', enabled: true, expired: false } },
    });
    assert.equal(entries.length, 1);
    var e = entries[0];
    assert.equal(e.type, 'novel-index-entry');
    assert.equal(e.novelId, 'n1');
    assert.equal(e.title, '第一章测试');
    assert.equal(e.chapterCount, 3);
    assert.equal(e.published, true);
    assert.equal(e.share.token, 't2');
  });

  it('chapters 为对象（分支结构）时数键', function() {
    var entries = buildNovelEntriesFromParts('u1', 'c1', {
      catalogDoc: { data: [{ id: 'n1' }] },
      novelDocs: { n1: { data: { chapters: { a: {}, b: {} } } } },
    });
    assert.equal(entries[0].chapterCount, 2);
  });
});
