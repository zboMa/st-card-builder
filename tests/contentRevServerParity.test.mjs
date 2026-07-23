import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeDraftContentRev as clientRev } from '../src/lib/sync/contentRev.mjs';
import { computeDraftContentRev as serverRev } from '../server/src/quota/draftContentRev.mjs';

describe('contentRev client/server parity', function() {
  it('相同草稿正文得相同 rev', function() {
    var samples = [
      { charName: 'A', charDesc: 'x', updatedAt: '1' },
      {
        charName: '角色',
        charTags: ['tag1', 'tag2', 'tag1'],
        nsfwEnabled: true,
        nsfwFlavorItems: [{ id: 'f1', note: 'n' }],
        ntlTabooTypes: ['t1'],
        avatarInIdb: true,
        avatarBase64: 'should-strip',
      },
      { charName: '', worldbookEntries: [{ comment: 'wb', content: 'c' }] },
    ];
    for (var i = 0; i < samples.length; i++) {
      assert.equal(serverRev(samples[i]), clientRev(samples[i]), 'sample ' + i);
    }
  });
});
