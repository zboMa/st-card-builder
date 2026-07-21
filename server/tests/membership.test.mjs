import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { userDbName, couchUserName } from '../src/couch.mjs';
import {
  evaluateMembershipWithConfig,
  canAcceptDiscordRegistrationWithConfig,
} from '../src/auth/membershipLogic.mjs';

describe('server auth membership', function() {
  it('userDbName 规范化', function() {
    assert.equal(userDbName('discord_123'), 'userdb-stcb-discord_123');
    assert.match(userDbName('Dev User!!'), /^userdb-stcb-/);
  });

  it('couchUserName 前缀', function() {
    assert.equal(couchUserName('discord_abc'), 'stcb_discord_abc');
  });

  it('enforce 关时放行', function() {
    var r = evaluateMembershipWithConfig({
      authEnforceDiscordMembership: false,
      discord: { guildId: '', requiredRoleIds: [] },
    }, null);
    assert.equal(r.ok, true);
    assert.equal(canAcceptDiscordRegistrationWithConfig({
      authEnforceDiscordMembership: false,
      discord: { guildId: '', requiredRoleIds: [] },
    }), true);
  });

  it('enforce 开且 Guild/Role 空 → 拒绝所有正式注册', function() {
    var cfg = {
      authEnforceDiscordMembership: true,
      discord: { guildId: '', requiredRoleIds: [] },
    };
    assert.equal(canAcceptDiscordRegistrationWithConfig(cfg), false);
    var r = evaluateMembershipWithConfig(cfg, { roles: ['x'] });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'membership_config_empty');
  });

  it('enforce 开且配置齐全时校验角色', function() {
    var cfg = {
      authEnforceDiscordMembership: true,
      discord: { guildId: 'g1', requiredRoleIds: ['roleA'] },
    };
    assert.equal(canAcceptDiscordRegistrationWithConfig(cfg), true);
    assert.equal(evaluateMembershipWithConfig(cfg, null).ok, false);
    assert.equal(evaluateMembershipWithConfig(cfg, { roles: ['roleB'] }).ok, false);
    assert.equal(evaluateMembershipWithConfig(cfg, { roles: ['roleA'] }).ok, true);
  });
});
