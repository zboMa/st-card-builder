import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeManifestRev } from '../src/lib/card-builder/cardAvatarGallery.mjs';

test('computeManifestRev 区分不同 hash 的条目', function() {
  var a = [
    { id: 'av_one', hash: 'hash_a', primary: true },
    { id: 'av_two', hash: 'hash_b', primary: false },
  ];
  var b = [
    { id: 'av_one', hash: 'hash_a', primary: true },
    { id: 'av_two', hash: 'hash_c', primary: false },
  ];
  assert.notEqual(computeManifestRev(a), computeManifestRev(b));
});

test('computeManifestRev 同 id 不同 hash 会改变 rev', function() {
  var v1 = computeManifestRev([{ id: 'av_dup', hash: 'h1', primary: true }]);
  var v2 = computeManifestRev([
    { id: 'av_dup', hash: 'h1', primary: true },
    { id: 'av_dup', hash: 'h2', primary: false },
  ]);
  assert.notEqual(v1, v2);
});
