import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { limitsForTier, QUOTA_TIERS, formatBytes } from '../src/quota/quotaPolicy.mjs';
import { computeDraftContentRev, estimateBundleBytes } from '../src/quota/draftContentRev.mjs';

describe('quotaPolicy', function() {
  it('registered limits', function() {
    var lim = limitsForTier(QUOTA_TIERS.REGISTERED);
    assert.equal(lim.cardsOnCloud, 10);
    assert.equal(lim.activeShares, 3);
    assert.equal(lim.batchUploadMax, 5);
  });

  it('member limits higher', function() {
    var reg = limitsForTier(QUOTA_TIERS.REGISTERED);
    var mem = limitsForTier(QUOTA_TIERS.MEMBER);
    assert.ok(mem.cloudBytes > reg.cloudBytes);
    assert.ok(mem.cardsOnCloud > reg.cardsOnCloud);
  });

  it('formatBytes', function() {
    assert.match(formatBytes(500 * 1024 * 1024), /MB/);
  });
});

describe('draftContentRev server', function() {
  it('computeDraftContentRev stable', function() {
    var a = computeDraftContentRev({ charName: 'X', charDesc: 'd' });
    var b = computeDraftContentRev({ charName: 'X', charDesc: 'd', updatedAt: '1' });
    assert.equal(a, b);
    assert.match(a, /^[0-9a-f]{8}$/);
  });

  it('estimateBundleBytes', function() {
    assert.ok(estimateBundleBytes({ card: { charName: 'a' } }) > 10);
  });
});
