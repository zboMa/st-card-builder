import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  idbNovelKey,
  idbAvatarFullKey,
  idbAvatarThumbKey,
  IDB_DB_NAME,
  IDB_STORE_JSON,
  IDB_STORE_BLOB,
} from '../src/lib/idbStore.mjs';
import { novelBucketKey, NOVEL_BUCKET_PREFIX } from '../src/lib/novel/state.mjs';

describe('idbStore keys', function() {
  it('小说桶键与 novelBucketKey 一致', function() {
    assert.equal(NOVEL_BUCKET_PREFIX, 'novelWorkshopV3:card:');
    assert.equal(idbNovelKey('draft_1'), novelBucketKey('draft_1'));
    assert.equal(idbNovelKey(''), '');
  });

  it('头像键按 draftId 分桶', function() {
    assert.equal(idbAvatarFullKey('draft_a'), 'avatar:full:draft_a');
    assert.equal(idbAvatarThumbKey('draft_a'), 'avatar:thumb:draft_a');
    assert.notEqual(idbAvatarFullKey('a'), idbAvatarThumbKey('a'));
  });

  it('数据库名与 store 常量', function() {
    assert.equal(IDB_DB_NAME, 'st-card-builder');
    assert.equal(IDB_STORE_JSON, 'json');
    assert.equal(IDB_STORE_BLOB, 'blob');
  });
});
