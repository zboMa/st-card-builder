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
  var prevEmails;
  var prevRoEmails;

  before(function() {
    prevOps = config.adminDiscordIds.slice();
    prevRo = config.adminReadonlyDiscordIds.slice();
    prevEmails = config.adminEmails.slice();
    prevRoEmails = config.adminReadonlyEmails.slice();
    config.adminDiscordIds.length = 0;
    config.adminReadonlyDiscordIds.length = 0;
    config.adminEmails.length = 0;
    config.adminReadonlyEmails.length = 0;
    config.adminDiscordIds.push('111');
    config.adminReadonlyDiscordIds.push('222');
    config.adminEmails.push('ops@example.com');
    config.adminReadonlyEmails.push('ro@example.com');
  });

  after(function() {
    config.adminDiscordIds.length = 0;
    config.adminReadonlyDiscordIds.length = 0;
    config.adminEmails.length = 0;
    config.adminReadonlyEmails.length = 0;
    prevOps.forEach(function(id) { config.adminDiscordIds.push(id); });
    prevRo.forEach(function(id) { config.adminReadonlyDiscordIds.push(id); });
    prevEmails.forEach(function(e) { config.adminEmails.push(e); });
    prevRoEmails.forEach(function(e) { config.adminReadonlyEmails.push(e); });
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

  it('email admins via ADMIN_EMAILS', function() {
    assert.equal(getAdminRole({ provider: 'email', email: 'ops@example.com' }), 'ops');
    assert.equal(getAdminRole({ provider: 'email', email: 'OPS@example.com' }), 'ops');
    assert.equal(getAdminRole({ provider: 'email', email: 'ro@example.com' }), 'readonly');
    assert.equal(getAdminRole({ provider: 'email', email: 'other@example.com' }), null);
    assert.equal(isOpsAdmin({ provider: 'email', email: 'ops@example.com' }), true);
    assert.equal(isAdminUser({ provider: 'email', email: 'ro@example.com' }), true);
  });
});
