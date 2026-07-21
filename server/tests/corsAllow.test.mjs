import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isCorsOriginAllowed, corsAllowlist } from '../src/config.mjs';

describe('cors allow', function() {
  it('CORS_ORIGINS=* 语义：allowAll 时放行任意 Origin（非字面匹配 *）', function() {
    assert.equal(
      isCorsOriginAllowed('https://card-admin.taojiu.love', { allowAll: true }),
      true
    );
    assert.equal(
      isCorsOriginAllowed('https://st.example.com', { allowAll: true }),
      true
    );
  });

  it('白名单命中管理端 Origin', function() {
    var list = [
      'https://card.taojiu.love',
      'https://card-admin.taojiu.love',
    ];
    assert.equal(
      isCorsOriginAllowed('https://card-admin.taojiu.love', { allowAll: false, allowlist: list }),
      true
    );
    assert.equal(
      isCorsOriginAllowed('https://evil.example', { allowAll: false, allowlist: list }),
      false
    );
  });

  it('allowlist 不含字面 *', function() {
    assert.ok(corsAllowlist().indexOf('*') < 0);
  });

  it('无 Origin 放行（同源 / 非浏览器）', function() {
    assert.equal(isCorsOriginAllowed('', { allowAll: false, allowlist: [] }), true);
    assert.equal(isCorsOriginAllowed(undefined, { allowAll: false, allowlist: [] }), true);
  });
});
