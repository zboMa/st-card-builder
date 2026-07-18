import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeScaledSize,
  AVATAR_FULL_MAX_DIM,
  AVATAR_THUMB_MAX_DIM,
  AVATAR_FULL_JPEG_QUALITY,
  AVATAR_THUMB_JPEG_QUALITY,
} from '../src/lib/avatarIdb.mjs';

describe('avatarIdb pure helpers', function() {
  it('computeScaledSize 等比缩放到 maxDim 内', function() {
    var s = computeScaledSize(4000, 2000, AVATAR_FULL_MAX_DIM);
    assert.equal(s.width, 2048);
    assert.equal(s.height, 1024);
    assert.ok(s.scale < 1);
  });

  it('小图不放大', function() {
    var s = computeScaledSize(200, 100, AVATAR_THUMB_MAX_DIM);
    assert.equal(s.width, 200);
    assert.equal(s.height, 100);
    assert.equal(s.scale, 1);
  });

  it('质量常量合理', function() {
    assert.ok(AVATAR_FULL_JPEG_QUALITY > AVATAR_THUMB_JPEG_QUALITY);
    assert.ok(AVATAR_THUMB_MAX_DIM < AVATAR_FULL_MAX_DIM);
  });
});
