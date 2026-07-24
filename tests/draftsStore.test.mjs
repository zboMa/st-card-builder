import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  getDraftsMapSync,
  writeDraftsMapSync,
  hydrateDraftsStore,
  resetDraftsStoreForTests,
  isDraftsStoreHydrated,
  IDB_DRAFTS_KEY,
} from '../src/lib/draftsStore.mjs';

describe('draftsStore IDB-only', function() {
  it('源码无 LS API / 无 st_v3_builder_drafts', function() {
    var src = readFileSync(join(process.cwd(), 'src/lib/draftsStore.mjs'), 'utf8');
    assert.doesNotMatch(src, /localStorage\./);
    assert.doesNotMatch(src, /st_v3_builder_drafts/);
    assert.doesNotMatch(src, /from '\.\/card-builder\/state\.mjs'/);
    assert.match(src, /IDB_DRAFTS_KEY/);
    assert.match(src, new RegExp(IDB_DRAFTS_KEY));
  });

  it('无 IDB：仅内存，hydrate 后可读写', async function() {
    resetDraftsStoreForTests();
    assert.equal(isDraftsStoreHydrated(), false);
    await hydrateDraftsStore();
    assert.equal(isDraftsStoreHydrated(), true);
    writeDraftsMapSync({ a: { charName: 'A' } });
    assert.equal(getDraftsMapSync().a.charName, 'A');
    writeDraftsMapSync({});
    assert.deepEqual(getDraftsMapSync(), {});
    resetDraftsStoreForTests();
  });

  it('hydrate 前写入只进内存', async function() {
    resetDraftsStoreForTests();
    var wrote = writeDraftsMapSync({ early: { charName: 'E' } });
    assert.equal(wrote.ok, true);
    assert.equal(getDraftsMapSync().early.charName, 'E');
    await hydrateDraftsStore();
    assert.equal(getDraftsMapSync().early.charName, 'E');
    resetDraftsStoreForTests();
  });
});
