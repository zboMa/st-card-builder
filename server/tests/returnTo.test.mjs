import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeReturnTo, buildReturnToAllowlist } from '../src/auth/returnTo.mjs';

describe('oauth return_to', function() {
  var allow = buildReturnToAllowlist({
    publicAppUrl: 'https://card.taojiu.love',
    publicAdminUrl: 'https://card-admin.taojiu.love',
  });

  it('白名单含主站与管理端', function() {
    assert.ok(allow.indexOf('https://card.taojiu.love') >= 0);
    assert.ok(allow.indexOf('https://card-admin.taojiu.love') >= 0);
  });

  it('允许同 Origin 回跳', function() {
    assert.equal(
      sanitizeReturnTo('https://card.taojiu.love/#auth', allow),
      'https://card.taojiu.love/#auth'
    );
    assert.equal(
      sanitizeReturnTo('https://card-admin.taojiu.love/?x=1', allow),
      'https://card-admin.taojiu.love/?x=1'
    );
  });

  it('拒绝外站', function() {
    assert.equal(sanitizeReturnTo('https://evil.example/phish', allow), null);
    assert.equal(sanitizeReturnTo('javascript:alert(1)', allow), null);
    assert.equal(sanitizeReturnTo('', allow), null);
  });
});
