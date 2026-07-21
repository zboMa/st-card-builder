import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeEmail,
  assertEmailShape,
  emailUserId,
  buildEmailSessionUser,
  inviteCodeAccepted,
  emailAuthLookupDocId,
} from '../src/auth/emailAuth.mjs';
import {
  hashAccountPassword,
  verifyAccountPassword,
  assertPasswordShape,
} from '../src/auth/password.mjs';

describe('emailAuth helpers', function() {
  it('normalizes and validates email', function() {
    assert.equal(normalizeEmail('  Foo@Bar.COM '), 'foo@bar.com');
    assert.equal(assertEmailShape('a@b.co'), 'a@b.co');
    assert.throws(function() { assertEmailShape('not-an-email'); }, /invalid_email/);
  });

  it('stable user id + session shape', function() {
    var a = emailUserId('ops@example.com');
    var b = emailUserId('OPS@example.com');
    assert.equal(a, b);
    assert.match(a, /^email_[a-f0-9]{24}$/);
    var u = buildEmailSessionUser('Ops@Example.com');
    assert.equal(u.provider, 'email');
    assert.equal(u.email, 'ops@example.com');
    assert.equal(u.id, a);
    assert.equal(u.username, 'ops');
  });

  it('invite codes exact match (trimmed)', function() {
    assert.equal(inviteCodeAccepted('abc', ['abc', 'xyz']), true);
    assert.equal(inviteCodeAccepted(' abc ', ['abc']), true);
    assert.equal(inviteCodeAccepted('ABC', ['abc']), false);
    assert.equal(inviteCodeAccepted('', ['abc']), false);
    assert.equal(inviteCodeAccepted('abc', []), false);
  });

  it('email auth doc id', function() {
    assert.equal(emailAuthLookupDocId('A@B.com'), 'email-auth/a@b.com');
  });
});

describe('account password', function() {
  it('rejects short passwords', function() {
    assert.throws(function() { assertPasswordShape('short'); }, /password_too_short/);
  });

  it('hash / verify', async function() {
    var packed = await hashAccountPassword('secret-ok');
    assert.equal(packed.v, 1);
    assert.ok(packed.salt);
    assert.ok(packed.hash);
    assert.equal(await verifyAccountPassword('secret-ok', packed), true);
    assert.equal(await verifyAccountPassword('wrong-pass', packed), false);
  });
});
