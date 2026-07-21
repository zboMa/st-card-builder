import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canAcceptDiscordRegistrationWithConfig } from '../src/auth/membershipLogic.mjs';

describe('admin gate helpers', function() {
  it('生产门禁：enforce + 空 guild → 拒正式注册', function() {
    assert.equal(canAcceptDiscordRegistrationWithConfig({
      authEnforceDiscordMembership: true,
      discord: { guildId: '', requiredRoleIds: [] },
    }), false);
  });
});
