import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeVirtualRange } from '../src/lib/ui/virtualList.mjs';

describe('virtualList computeVirtualRange', function() {
  it('空表', function() {
    var r = computeVirtualRange({ length: 0, rowHeight: 56, scrollTop: 0, clientHeight: 400 });
    assert.deepEqual(r, { start: 0, end: 0, topPad: 0, bottomPad: 0 });
  });

  it('首屏含 overscan', function() {
    var r = computeVirtualRange({
      length: 1000,
      rowHeight: 50,
      scrollTop: 0,
      clientHeight: 200,
      overscan: 2,
    });
    // visible ~4 rows (0..4), overscan 2 → start 0 end 6
    assert.equal(r.start, 0);
    assert.equal(r.end, 6);
    assert.equal(r.topPad, 0);
    assert.equal(r.bottomPad, (1000 - 6) * 50);
  });

  it('中部滚动（含 gap）', function() {
    var r = computeVirtualRange({
      length: 500,
      rowHeight: 40,
      gap: 0,
      scrollTop: 4000,
      clientHeight: 400,
      overscan: 5,
    });
    // floor(4000/40)=100, ceil(4400/40)=110 → 95..115
    assert.equal(r.start, 95);
    assert.equal(r.end, 115);
    assert.equal(r.topPad, 95 * 40);
    assert.equal(r.bottomPad, (500 - 115) * 40);
  });

  it('底部边界不越界', function() {
    var r = computeVirtualRange({
      length: 20,
      rowHeight: 50,
      scrollTop: 900,
      clientHeight: 200,
      overscan: 10,
    });
    assert.ok(r.start >= 0);
    assert.equal(r.end, 20);
    assert.equal(r.bottomPad, 0);
  });
});
