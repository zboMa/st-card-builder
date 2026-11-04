import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ensureDraftForAvatar } from '../src/lib/card-builder/panels/characterAvatar.mjs';

describe('characterAvatar draft gate', function() {
  it('已有 draftId 时返回 true，允许上传卡面', async function() {
    var ctx = { state: { draftId: 'card-1' } };
    assert.equal(await ensureDraftForAvatar(ctx), true);
  });
});
