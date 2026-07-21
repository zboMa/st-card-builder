import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAdminRole,
  isAdminUser,
  isOpsAdmin,
  isAdminDiscordId,
  config,
} from '../src/config.mjs';

describe('admin roles', function() {
  var prevOps;
  var prevRo;

  before(function() {
    prevOps = config.adminDiscordIds.slice();
    prevRo = config.adminReadonlyDiscordIds.slice();
    config.adminDiscordIds.length = 0;
    config.adminReadonlyDiscordIds.length = 0;
    config.adminDiscordIds.push('111');
    config.adminReadonlyDiscordIds.push('222');
  });

  after(function() {
    config.adminDiscordIds.length = 0;
    config.adminReadonlyDiscordIds.length = 0;
    prevOps.forEach(function(id) { config.adminDiscordIds.push(id); });
    prevRo.forEach(function(id) { config.adminReadonlyDiscordIds.push(id); });
  });

  it('ops / readonly / none', function() {
    assert.equal(getAdminRole({ provider: 'discord', discordId: '111' }), 'ops');
    assert.equal(getAdminRole({ provider: 'discord', discordId: '222' }), 'readonly');
    assert.equal(getAdminRole({ provider: 'discord', discordId: '999' }), null);
    assert.equal(isOpsAdmin({ provider: 'discord', discordId: '111' }), true);
    assert.equal(isOpsAdmin({ provider: 'discord', discordId: '222' }), false);
    assert.equal(isAdminUser({ provider: 'discord', discordId: '222' }), true);
    assert.equal(isAdminDiscordId('discord_111'), true);
    assert.equal(isAdminDiscordId('222'), true);
  });
});
