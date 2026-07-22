import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { catalogNovelsList } from '../src/lib/sync/docIds.mjs';
import {
  formatSyncCountdown,
  friendlySyncError,
  computeShouldSkipSyncWhenClean,
} from '../src/lib/sync/syncEngine.mjs';

describe('cloud product helpers', function() {
  it('catalogNovelsList', function() {
    assert.deepEqual(catalogNovelsList([{ id: 'a' }]), [{ id: 'a' }]);
    assert.deepEqual(catalogNovelsList({ data: { novels: [{ id: 'b' }] } }), [{ id: 'b' }]);
  });

  it('countdown + skip clean still work', function() {
    assert.equal(formatSyncCountdown(60000), '1:00');
    assert.equal(
      computeShouldSkipSyncWhenClean({ skipIfClean: true }, { lastSyncAt: 'x', localDirty: false }),
      true
    );
    assert.match(friendlySyncError(new Error('conflict')), /冲突/);
  });
});
