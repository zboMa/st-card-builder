import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PERMS, ALL_PERMS, BUILTIN_ROLES, sanitizePerms } from '../src/auth/roles.mjs';

describe('roles: 权限点定义', function() {
  it('ALL_PERMS 唯一且非空', function() {
    assert.ok(ALL_PERMS.length > 20);
    var set = new Set(ALL_PERMS);
    assert.equal(set.size, ALL_PERMS.length);
  });
  it('PERMS 枚举值都是合法权限点', function() {
    Object.keys(PERMS).forEach(function(k) {
      assert.ok(ALL_PERMS.indexOf(PERMS[k]) >= 0, 'perm missing: ' + k);
    });
  });
});

describe('roles: 内置角色', function() {
  it('ops 拥有全部权限', function() {
    assert.equal(BUILTIN_ROLES.ops.perms.length, ALL_PERMS.length);
    assert.ok(BUILTIN_ROLES.ops.perms.indexOf(PERMS.cardDelete) >= 0);
  });
  it('readonly 只读，不含写权限点', function() {
    var write = [
      PERMS.userDisable, PERMS.shareToggle, PERMS.shareDelete, PERMS.tokenRevoke,
      PERMS.cardDisable, PERMS.cardDelete, PERMS.modReview, PERMS.roleManage,
    ];
    write.forEach(function(p) {
      assert.ok(BUILTIN_ROLES.readonly.perms.indexOf(p) < 0, 'readonly 不该有 ' + p);
    });
  });
});

describe('roles: sanitizePerms', function() {
  it('过滤非法 + 去重', function() {
    assert.deepEqual(
      sanitizePerms([PERMS.cardRead, 'fake.perm', PERMS.cardRead, '', null]),
      [PERMS.cardRead]
    );
  });
  it('非数组 → 空', function() {
    assert.deepEqual(sanitizePerms(null), []);
    assert.deepEqual(sanitizePerms('x'), []);
  });
});
