import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashSharePassword, verifySharePassword } from '../src/share/password.mjs';

describe('share password', function() {
  it('hash + verify', async function() {
    var packed = await hashSharePassword('secret-ok');
    assert.equal(packed.v, 1);
    assert.ok(packed.salt);
    assert.ok(packed.hash);
    assert.equal(await verifySharePassword('secret-ok', packed), true);
    assert.equal(await verifySharePassword('wrong', packed), false);
    assert.equal(await verifySharePassword('', packed), false);
  });

  it('太短拒绝', async function() {
    await assert.rejects(function() { return hashSharePassword('ab'); }, /password_too_short/);
  });
});
